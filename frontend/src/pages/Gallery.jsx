import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MediaCard from '../components/MediaCard';
import Lightbox from '../components/Lightbox';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'largest', label: 'Largest size' },
  { value: 'smallest', label: 'Smallest size' },
  { value: 'name', label: 'Name (A–Z)' },
];

export default function Gallery() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [active, setActive] = useState(null);

  // Long-press-to-select, like a phone's photo gallery: holding a tile
  // enters select mode and selects it; further taps toggle other tiles;
  // the toolbar lets you bulk-delete everything selected at once.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sentinelRef = useRef(null);

  const loadPage = useCallback(
    async (pageToLoad, reset = false) => {
      setLoading(true);
      try {
        const { data } = await api.get('/media', {
          params: { type, search, sort, page: pageToLoad, limit: 24 },
        });
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setHasMore(data.pagination.hasMore);
        setPage(pageToLoad);
      } finally {
        setLoading(false);
      }
    },
    [type, search, sort]
  );

  useEffect(() => {
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, sort]);

  useEffect(() => {
    const t = setTimeout(() => loadPage(1, true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPage(page + 1);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadPage]);

  const handleOpen = useCallback((item) => setActive(item), []);

  const handleDelete = useCallback(async (item) => {
    if (!window.confirm(`Delete "${item.original_filename}"? This cannot be undone.`)) return;
    await api.delete(`/media/${item.id}`);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setActive((prev) => (prev?.id === item.id ? null : prev));
  }, []);

  const handleDownload = useCallback(async (item) => {
    const { data } = await api.get(`/media/${item.id}/download`);
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = data.filename;
    link.click();
  }, []);

  const handleCloseLightbox = useCallback(() => setActive(null), []);

  const handleLongPress = useCallback((item) => {
    setSelectMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const handleToggleSelect = useCallback((item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} item(s)? This cannot be undone.`)) return;

    setBulkDeleting(true);
    const failedIds = new Set();
    // One at a time keeps this gentle on the connection, same as uploads.
    for (const id of ids) {
      try {
        await api.delete(`/media/${id}`);
      } catch (err) {
        console.error('Delete failed for', id, err);
        failedIds.add(id);
      }
    }
    setBulkDeleting(false);

    setItems((prev) => prev.filter((i) => failedIds.has(i.id) || !ids.includes(i.id)));
    setSelectedIds(new Set());
    setSelectMode(false);

    if (failedIds.size > 0) {
      alert(`${failedIds.size} item(s) could not be deleted. Please try again.`);
    }
  }, [selectedIds]);

  const title = type === 'video' ? 'Videos' : 'Photos';

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {selectMode ? (
          <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="px-2 text-sm text-pearl">{selectedIds.size} selected</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSelectAll} className="chip border border-white/10 text-mist">
                Select all
              </button>
              <button onClick={handleCancelSelect} className="chip border border-white/10 text-mist">
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="chip border border-coral/40 bg-coral/15 text-coral disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : `🗑️ Delete (${selectedIds.size})`}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link to="/" className="text-sm text-mist hover:text-pearl">← Home</Link>
              <h1 className="font-display italic text-3xl text-pearl">{title}</h1>
            </div>

            <div className="flex flex-1 flex-wrap justify-end gap-3 sm:flex-nowrap">
              <input
                type="search"
                placeholder={`Search ${title.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input max-w-xs"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="glass-input max-w-[10rem] cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-charcoal">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {items.length === 0 && !loading ? (
          <EmptyState type={type} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onDownload={handleDownload}
                selectMode={selectMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={handleToggleSelect}
                onLongPress={handleLongPress}
              />
            ))}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => <div key={`sk-${i}`} className="skeleton aspect-square" />)}
          </div>
        )}

        <div ref={sentinelRef} className="h-8" />
      </main>

      <Lightbox
        item={active}
        onClose={handleCloseLightbox}
        isAdmin={isAdmin}
        onDelete={handleDelete}
        onDownload={handleDownload}
      />
    </div>
  );
}

function EmptyState({ type }) {
  return (
    <div className="glass-panel animate-fade-in flex flex-col items-center gap-3 p-16 text-center">
      <span className="text-5xl">{type === 'video' ? '🎬' : '📷'}</span>
      <p className="font-display italic text-xl text-pearl">Nothing here yet</p>
      <p className="text-sm text-mist">
        {type === 'video' ? 'Videos you upload will appear here.' : 'Photos you upload will appear here.'}
      </p>
    </div>
  );
}
