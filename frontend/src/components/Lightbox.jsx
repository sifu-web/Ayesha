import React, { useEffect } from 'react';

export default function Lightbox({ item, onClose, isAdmin, onDelete, onDownload }) {
  useEffect(() => {
    if (!item) return undefined;

    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute right-5 top-5 flex gap-2" onClick={(e) => e.stopPropagation()}>
        {isAdmin && (
          <button
            onClick={() => onDownload?.(item)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            aria-label="Download"
          >
            ⬇️
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => onDelete?.(item)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            aria-label="Delete"
          >
            🗑️
          </button>
        )}
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {item.resource_type === 'video' ? (
          <video
            src={item.secure_url}
            poster={item.thumbnail_url}
            controls
            autoPlay
            className="max-h-[85vh] w-full rounded-2xl shadow-glass"
          />
        ) : (
          <img
            src={item.secure_url}
            alt={item.original_filename}
            decoding="async"
            className="max-h-[85vh] w-full rounded-2xl object-contain shadow-glass"
          />
        )}
        <p className="mt-3 text-center text-sm text-mist">{item.original_filename}</p>
      </div>
    </div>
  );
}
