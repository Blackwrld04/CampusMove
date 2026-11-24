import React, { useEffect, useRef, useState } from 'react';
import { MapView } from './components/MapView';
import { TopBar } from './components/TopBar';
import { RiderToggle } from './components/RiderToggle';
import { PreviewPanel } from './components/PreviewPanel';
import {
  PREVIEW_SPEED_KMH,
  bearingDegrees,
  buildPreviewTrack
} from './previewRoute';
import { Rider } from './types';

export const App: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [myRiderId, setMyRiderId] = useState<string | null>(null);
  const [previewRider, setPreviewRider] = useState<Rider | null>(null);

  const previewTimerRef = useRef<number | null>(null);
  const previewTrackRef = useRef<[number, number][]>([]);
  const previewIndexRef = useRef(0);
  const previewRiderRef = useRef<Rider | null>(null);

  // Initial snapshot.
  useEffect(() => {
    fetch('/api/riders')
      .then((res) => res.json())
      .then((data) => {
        if (data.riders) setRiders(data.riders);
      })
      .catch((error) => console.error('Error loading riders:', error));
  }, []);

  // Live updates. This effect must stay dependency-free so the SSE connection
  // is opened once, not recreated on every position update.
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.riders) setRiders(payload.riders);
      } catch (error) {
        console.error('Could not parse live update:', error);
      }
    };

    eventSource.onerror = () => {
      // EventSource reconnects automatically.
    };

    return () => eventSource.close();
  }, []);

  const stopPreview = () => {
    if (previewTimerRef.current !== null) {
      window.clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    previewTrackRef.current = [];
    previewIndexRef.current = 0;
    previewRiderRef.current = null;
    setPreviewRider(null);
  };

  const startPreview = () => {
    // Never run the demo on top of a real location share.
    if (myRiderId) return;

    stopPreview();

    const track = buildPreviewTrack();
    if (track.length < 2) return;

    previewTrackRef.current = track;
    previewIndexRef.current = 0;

    const first = track[0];
    const initial: Rider = {
      id: 'preview-rider',
      lat: first[0],
      lng: first[1],
      speed: PREVIEW_SPEED_KMH,
      heading: bearingDegrees(track[0], track[1]),
      accuracy: 5,
      lastUpdated: Date.now(),
      path: [[first[0], first[1]]]
    };

    previewRiderRef.current = initial;
    setPreviewRider(initial);

    previewTimerRef.current = window.setInterval(() => {
      const currentTrack = previewTrackRef.current;
      const previous = previewRiderRef.current;

      if (!currentTrack.length || !previous) return;

      const nextIndex = (previewIndexRef.current + 1) % currentTrack.length;
      previewIndexRef.current = nextIndex;

      const point = currentTrack[nextIndex];
      const next: Rider = {
        ...previous,
        lat: point[0],
        lng: point[1],
        speed: PREVIEW_SPEED_KMH,
        heading: bearingDegrees([previous.lat, previous.lng], point),
        accuracy: 5,
        lastUpdated: Date.now(),
        path: [...previous.path, point].slice(-300)
      };

      previewRiderRef.current = next;
      setPreviewRider(next);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) {
        window.clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  const mapRiders = previewRider ? [...riders, previewRider] : riders;
  const previewActive = previewRider !== null;

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <TopBar riders={riders} previewActive={previewActive} />

      <MapView
        riders={mapRiders}
        focusRiderId={previewRider ? previewRider.id : myRiderId}
        previewRiderId={previewRider ? previewRider.id : null}
      />

      {riders.length === 0 && !previewActive && (
        <div className="absolute top-24 left-3 right-3 z-[900] max-w-xs mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-4 py-3 shadow-xl text-center pointer-events-none">
          <p className="text-xs font-extrabold text-white">No one is sharing yet</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1 leading-snug">
            Tap <span className="font-bold text-emerald-400">I'M ON A SHUTTLE</span> below
            and your green dot and trail will appear here. Works only inside OAU campus.
          </p>

          {!myRiderId && (
            <button
              onClick={startPreview}
              className="pointer-events-auto mt-2 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Preview a sample ride (no GPS)
            </button>
          )}
        </div>
      )}

      {previewRider ? (
        <PreviewPanel speed={previewRider.speed} onStop={stopPreview} />
      ) : (
        <RiderToggle onSharingChange={setMyRiderId} />
      )}
    </div>
  );
};

export default App;
