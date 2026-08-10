import React from 'react';

function MediaCard({ item, isAdmin, onOpen, onDelete, onDownload }) {
  return (
    <div className="group relative aspect-square animate-fade-up cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03]">
      <img
        src={item.thumbnail_url}
        alt={item.original_filename}
        loading="lazy"
        decoding="async"
        onClick={() => onOpen(item)}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />

      {item.resource_type === 'video' && (
        <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
          🎬 {formatDuration(item.duration)}
        </span>
      )}

      <div
        onClick={() => onOpen(item)}
        className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"
      >
        <div className="flex w-full items-center justify-between p-2.5">
          <span className="truncate text-xs text-white/90">{item.original_filename}</span>
          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isAdmin && (
              <IconButton label="Download" onClick={() => onDownload(item)}>
                ⬇️
              </IconButton>
            )}
            {isAdmin && (
              <IconButton label="Delete" onClick={() => onDelete(item)}>
                🗑️
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MediaCard);

function IconButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm backdrop-blur-sm transition hover:bg-black/70"
    >
      {children}
    </button>
  );
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
