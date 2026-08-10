import React from 'react';

export default function LoadingScreen({ label = 'Loading your memories…' }) {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-ink">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-28 w-28 rounded-full bg-rose-orchid blur-2xl opacity-40 animate-breathe" />
        <span className="relative text-6xl animate-breathe select-none">💗</span>
      </div>
      <p className="mt-8 font-display italic text-lg text-mist tracking-wide">{label}</p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 rounded-full bg-rose-orchid animate-[shimmer_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
