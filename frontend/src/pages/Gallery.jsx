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
  const { type } = useParams(); // "photo" | "video"
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [active, setActive] = useState(null);
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

  // Reload from page 1 whenever type/search/sort changes.
  useEffect(() => {
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, sort]);

  useEffect(() => {
    const t = setTimeout(() => loadPage(1, true), 350); // debounce search
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
  }, []);

  const handleDownload = useCallback(async (item) => {
    const { data } = await api.get(`/media/${item.id}/download`);
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = data.filename;
    link.click();
  }, []);

  const handleCloseLightbox = useCallback(() => setActive(null), []);

  const title = type === 'video' ? 'Videos' : 'Photos';

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
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
              />
            ))}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => <div key={`sk-${i}`} className="skeleton aspect-square" />)}
          </div>
        )}

        <div ref={sentinelRef} className="h-8" />
      </main>

      <Lightbox item={active} onClose={handleCloseLightbox} />
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
