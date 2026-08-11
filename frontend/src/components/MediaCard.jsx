import React, { useRef } from 'react';

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

function MediaCard({ item, isAdmin, onOpen, onDelete, onDownload, selectMode, selected, onToggleSelect, onLongPress }) {
  const pressTimer = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const longPressFired = useRef(false);

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown(e) {
    if (!isAdmin) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressFired.current = false;
    clearTimer();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onLongPress?.(item);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e) {
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
  }

  function handlePointerUp() {
    clearTimer();
  }

  function handleClick() {
    if (longPressFired.current) {
      // The long-press already handled this interaction — swallow the
      // click that follows it so we don't also open/toggle.
      longPressFired.current = false;
      return;
    }
    if (selectMode) {
      onToggleSelect?.(item);
    } else {
      onOpen(item);
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={`group relative aspect-square animate-fade-up cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03] transition ${
        selected ? 'ring-2 ring-rose' : ''
      }`}
    >
      <img
        src={item.thumbnail_url}
        alt={item.original_filename}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition duration-300 ${
          selectMode && selected ? 'scale-95 opacity-80' : 'group-hover:scale-105'
        }`}
      />

      {item.resource_type === 'video' && !selectMode && (
        <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
          🎬 {formatDuration(item.duration)}
        </span>
      )}

      {selectMode && (
        <span
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs backdrop-blur-sm ${
            selected ? 'border-rose bg-rose text-white' : 'border-white/70 bg-black/30 text-transparent'
          }`}
        >
          ✓
        </span>
      )}

      {!selectMode && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/10 to-transparent">
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
      )}
    </div>
  );
}

export default React.memo(MediaCard);

function IconButton({ children, label, ...props }) {
  return (
    <button
      {...props}
      aria-label={label}
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
