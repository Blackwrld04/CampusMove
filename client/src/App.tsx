import React, { useEffect, useState } from 'react';
import { MapView } from './components/MapView';
import { TopBar } from './components/TopBar';
import { RiderToggle } from './components/RiderToggle';
import { Rider } from './types';

export const App: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [myRiderId, setMyRiderId] = useState<string | null>(null);

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

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <TopBar riders={riders} />

      <MapView riders={riders} focusRiderId={myRiderId} />

      {riders.length === 0 && (
        <div className="absolute top-24 left-3 right-3 z-[900] max-w-xs mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-4 py-3 shadow-xl text-center pointer-events-none">
          <p className="text-xs font-extrabold text-white">No one is sharing yet</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1 leading-snug">
            Tap <span className="font-bold text-emerald-400">I'M ON A SHUTTLE</span> below
            and your green dot and trail will appear here. Works only inside OAU campus.
          </p>
        </div>
      )}

      <RiderToggle onSharingChange={setMyRiderId} />
    </div>
  );
};

export default App;
