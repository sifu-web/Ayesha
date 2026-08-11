import React from 'react';
import { useSongsPlayer } from '../context/SongsPlayerContext';

export default function MiniPlayer() {
  const { current, isPlaying, backgroundPlay, setBackgroundPlay, togglePlay, stop } = useSongsPlayer();

  if (!current) return null;

  return (
    <div className="gpu-layer glass-panel-solid animate-fade-up fixed bottom-28 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 px-4 py-3 sm:bottom-6">
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-orchid text-lg text-white shadow-glow"
      >
        {isPlaying ? '⏸' : '▶️'}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-pearl">
          {current.kind === 'voice' ? '🎤 ' : '🎵 '}
          {current.display_name}
        </p>
        <button
          onClick={() => setBackgroundPlay((v) => !v)}
          className={`mt-0.5 flex items-center gap-1 text-xs font-medium transition ${
            backgroundPlay ? 'text-mint' : 'text-mist hover:text-pearl'
          }`}
        >
          <span>{backgroundPlay ? '🟢' : '⚪️'}</span>
          Background play {backgroundPlay ? 'on' : 'off'}
        </button>
      </div>

      <button
        onClick={stop}
        aria-label="Stop and close player"
        className="shrink-0 text-mist hover:text-coral"
      >
        ✕
      </button>
    </div>
  );
}
