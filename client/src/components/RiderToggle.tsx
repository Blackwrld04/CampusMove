import React, { useEffect, useRef, useState } from 'react';

interface RiderToggleProps {
  onSharingChange: (riderId: string | null) => void;
}

interface Fix {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number | null;
  timestamp: number;
}

// A fix fuzzier than this is not shown; the client waits for the GPS to settle.
const MAX_ACCURACY_METERS = 50;

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371e3;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const deltaPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const RiderToggle: React.FC<RiderToggleProps> = ({ onSharingChange }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');

  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const lastFixRef = useRef<Fix | null>(null);
  const riderIdRef = useRef('');
  const geoFailuresRef = useRef(0);

  const stopSharing = (message = '') => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (riderIdRef.current) {
      fetch('/api/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId: riderIdRef.current }),
        keepalive: true
      }).catch(() => undefined);
    }

    riderIdRef.current = '';
    lastFixRef.current = null;
    geoFailuresRef.current = 0;
    setIsSharing(false);
    setIsLive(false);
    setSpeed(0);
    setStatus('');
    setNotice(message);
    onSharingChange(null);
  };

  const sendPing = async (fix: Omit<Fix, 'timestamp'>) => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: riderIdRef.current,
          ...fix
        })
      });

      if (response.ok) {
        setIsLive(true);
        setStatus(
          fix.accuracy !== null
            ? `Precise fix ±${fix.accuracy} m.`
            : 'Location visible on the map.'
        );
        return;
      }

      const payload = await response.json().catch(() => ({}));

      if (response.status === 403 && payload.error === 'outside_oau') {
        stopSharing(
          'You are outside OAU campus. Sharing works only inside OAU territory.'
        );
      } else if (response.status === 422 && payload.error === 'low_accuracy') {
        setStatus(
          fix.accuracy !== null
            ? `GPS ±${fix.accuracy} m — waiting for ≤${MAX_ACCURACY_METERS} m`
            : 'GPS signal is not precise enough yet. Move outdoors and wait.'
        );
      } else {
        setStatus('Connection issue — retrying.');
      }
    } catch (error) {
      setStatus('Connection issue — retrying.');
    } finally {
      sendingRef.current = false;
    }
  };

  const handlePosition = (position: GeolocationPosition) => {
    geoFailuresRef.current = 0;

    const {
      latitude,
      longitude,
      speed: rawSpeed,
      heading,
      accuracy: rawAccuracy
    } = position.coords;
    const now = Date.now();
    const previous = lastFixRef.current;
    const accuracyMeters =
      Number.isFinite(rawAccuracy) && rawAccuracy > 0
        ? Math.round(rawAccuracy)
        : null;

    let speedKmh = 0;

    if (rawSpeed !== null && !Number.isNaN(rawSpeed)) {
      speedKmh = Math.max(0, Math.round(rawSpeed * 3.6));
    } else if (previous) {
      // Some browsers report null speed. Derive it from the last two fixes.
      const seconds = (now - previous.timestamp) / 1000;

      if (seconds > 0) {
        const meters = distanceMeters(previous, { lat: latitude, lng: longitude });
        speedKmh = Math.max(0, Math.round((meters / seconds) * 3.6));
      }
    }

    const fix = {
      lat: latitude,
      lng: longitude,
      speed: speedKmh,
      heading: heading || 0,
      accuracy: accuracyMeters
    };

    // Send every fix for boundary validation, even a fuzzy one. The server
    // checks OAU first, so someone outside campus gets an immediate answer
    // instead of waiting forever for a tighter GPS fix.
    setSpeed(speedKmh);
    setStatus(
      accuracyMeters !== null && accuracyMeters > MAX_ACCURACY_METERS
        ? `GPS ±${accuracyMeters} m — waiting for ≤${MAX_ACCURACY_METERS} m`
        : 'Sending your precise location…'
    );
    void sendPing(fix);

    // Only remember fixes good enough to draw; the heartbeat must never
    // keep re-sending a position the server already rejected as fuzzy.
    if (accuracyMeters === null || accuracyMeters <= MAX_ACCURACY_METERS) {
      lastFixRef.current = { ...fix, timestamp: now };
    }
  };

  const handleError = (error: GeolocationPositionError) => {
    console.warn('Geolocation error', error.code, error.message);

    if (error.code === error.PERMISSION_DENIED) {
      stopSharing('Location permission denied. Allow access and try again.');
      return;
    }

    geoFailuresRef.current += 1;

    // Do not spin forever when the device has no location source (common on
    // laptops and VMs without GPS or Wi-Fi positioning).
    if (geoFailuresRef.current >= 2) {
      stopSharing(
        'No location received. This device may not have GPS — try a phone with location enabled.'
      );
      return;
    }

    if (error.code === error.TIMEOUT) {
      setStatus(
        'No GPS fix yet. Move outdoors and use HTTPS if you are on a phone.'
      );
    } else {
      setStatus('Location unavailable — retrying…');
    }
  };

  const startSharing = () => {
    if (!('geolocation' in navigator)) {
      setNotice('Geolocation is not supported in this browser.');
      return;
    }

    const riderId = 'rider-' + Math.random().toString(36).slice(2, 10);
    riderIdRef.current = riderId;
    lastFixRef.current = null;
    geoFailuresRef.current = 0;

    setNotice('');
    setIsSharing(true);
    setIsLive(false);
    setStatus('Finding your location…');
    onSharingChange(riderId);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );

    // Keep the dot alive even when the rider is waiting at a stop.
    heartbeatRef.current = window.setInterval(() => {
      const fix = lastFixRef.current;

      if (fix) {
        void sendPing({
          lat: fix.lat,
          lng: fix.lng,
          speed: fix.speed,
          heading: fix.heading,
          accuracy: fix.accuracy
        });
      }
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
      }

      if (riderIdRef.current && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/exit',
          new Blob([JSON.stringify({ riderId: riderIdRef.current })], {
            type: 'application/json'
          })
        );
      }
    };
  }, []);

  if (isSharing) {
    return (
      <div className="absolute bottom-6 left-3 right-3 z-[1000] max-w-md mx-auto bg-slate-900/95 backdrop-blur-md border border-emerald-500/70 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>

          <div className="min-w-0">
            <p className="text-xs font-black text-white uppercase tracking-wider">
              {isLive ? 'Sharing live' : 'Getting GPS fix'}
            </p>
            <p className="text-[11px] font-medium text-slate-300 truncate">
              {status || 'Sending your location…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-emerald-300">{speed} km/h</span>
          <button
            onClick={() => stopSharing()}
            className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all"
          >
            STOP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-0 right-0 z-[1000] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {notice && (
        <p className="max-w-xs text-center text-[11px] font-semibold text-rose-300 bg-slate-900/90 border border-rose-500/40 rounded-full px-3 py-1.5">
          {notice}
        </p>
      )}

      <button
        onClick={startSharing}
        className="pointer-events-auto bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold text-sm px-7 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border-2 border-emerald-300 transition-all"
      >
        <span className="text-xl">🚍</span>
        <span>I'M ON A SHUTTLE</span>
      </button>

      <p className="text-[10px] font-medium text-slate-400 text-center">
        Your precise location and trail appear on the map. OAU campus only.
      </p>
    </div>
  );
};
