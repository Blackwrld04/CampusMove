import React from 'react';

interface PreviewPanelProps {
  speed: number;
  onStop: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ speed, onStop }) => {
  return (
    <div className="absolute bottom-6 left-3 right-3 z-[1000] max-w-md mx-auto bg-slate-900/95 backdrop-blur-md border border-amber-500/70 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black text-white uppercase tracking-wider">
            Preview ride
          </p>
          <p className="text-[11px] font-medium text-amber-300 truncate">
            Not shared — visible only on this screen.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold text-emerald-300">{speed} km/h</span>
        <button
          onClick={onStop}
          className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all"
        >
          STOP
        </button>
      </div>
    </div>
  );
};
