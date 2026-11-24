import React from 'react';
import { Rider } from '../types';

interface TopBarProps {
  riders: Rider[];
  previewActive: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ riders, previewActive }) => {
  const count = riders.length;
  const hasRiders = count > 0;

  return (
    <header className="absolute top-0 left-0 right-0 z-[1000] p-3 pointer-events-none flex justify-center">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-xl pointer-events-auto flex items-center gap-3 max-w-md w-full">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <span className="text-xl">🚍</span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-white tracking-tight">CampusMove</h1>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                hasRiders
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {hasRiders ? 'LIVE' : 'IDLE'}
            </span>
            {previewActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-950/80 border-amber-500/40 text-amber-300">
                PREVIEW
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hasRiders
                  ? 'bg-emerald-400 animate-ping'
                  : previewActive
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
              }`}
            ></span>
            <span
              className={`text-xs font-semibold ${
                hasRiders
                  ? 'text-emerald-400'
                  : previewActive
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              {hasRiders
                ? `${count} ${count === 1 ? 'rider' : 'riders'} sharing`
                : previewActive
                  ? 'Preview ride — not shared'
                  : 'No one is sharing'}
            </span>
          </div>
        </div>

        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-500">
          OAU
        </span>
      </div>
    </header>
  );
};
