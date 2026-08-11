import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DiaryEditor from '../components/DiaryEditor';
import api from '../api/axios';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function Diary() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const sentinelRef = useRef(null);

  const loadPage = useCallback(
    async (pageToLoad, reset = false) => {
      setLoading(true);
      try {
        const { data } = await api.get('/diary', { params: { search, page: pageToLoad, limit: 20 } });
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setHasMore(data.pagination.hasMore);
        setPage(pageToLoad);
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    const t = setTimeout(() => loadPage(1, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) loadPage(page + 1);
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadPage]);

  function openNew() {
    setEditingEntry(null);
    setEditorOpen(true);
  }

  function openEdit(entry) {
    setEditingEntry(entry);
    setEditorOpen(true);
  }

  function handleSaved(entry) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === entry.id);
      const next = exists ? prev.map((i) => (i.id === entry.id ? entry : i)) : [entry, ...prev];
      return next.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
    });
    setEditorOpen(false);
  }

  function handleDeleted(entry) {
    setItems((prev) => prev.filter((i) => i.id !== entry.id));
    setEditorOpen(false);
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm text-mist hover:text-pearl">← Home</Link>
            <h1 className="font-display italic text-3xl text-pearl">Diary</h1>
          </div>
          <input
            type="search"
            placeholder="Search entries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input max-w-xs"
          />
        </div>

        {items.length === 0 && !loading ? (
          <div className="glass-panel animate-fade-in flex flex-col items-center gap-3 p-16 text-center">
            <span className="text-5xl">📔</span>
            <p className="font-display italic text-xl text-pearl">Nothing written yet</p>
            <p className="text-sm text-mist">Tap the pencil to write your first entry.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((entry) => (
              <DiaryRow key={entry.id} entry={entry} onClick={() => openEdit(entry)} />
            ))}
            {loading &&
              Array.from({ length: 3 }).map((_, i) => <div key={`sk-${i}`} className="skeleton h-20 rounded-2xl" />)}
          </div>
        )}

        <div ref={sentinelRef} className="h-8" />
      </main>

      <button
        onClick={openNew}
        className="gpu-layer fixed bottom-8 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-rose-orchid text-2xl text-white shadow-glow animate-breathe sm:right-10"
        aria-label="Write new entry"
      >
        ✏️
      </button>

      {editorOpen && (
        <DiaryEditor
          entry={editingEntry}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
          onDelete={handleDeleted}
        />
      )}
    </div>
  );
}

function DiaryRow({ entry, onClick }) {
  const d = new Date(entry.entry_date);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();

  return (
    <div
      onClick={onClick}
      className="glass-panel flex cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div
        style={{ backgroundColor: entry.color }}
        className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 py-3 text-white"
      >
        <span className="text-xs font-bold tracking-wide opacity-90">{month}</span>
        <span className="font-display text-2xl leading-none">{day}</span>
        <span className="text-[10px] opacity-80">{year}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1 p-3.5">
        <div className="flex items-center gap-2">
          <h3 style={{ color: entry.text_color }} className="truncate font-display text-lg italic">
            {entry.title}
          </h3>
          {entry.voice_url && <span className="shrink-0 text-sm" title="Has a voice note">🎙️</span>}
        </div>
        {entry.content && (
          <p className="line-clamp-2 text-sm text-mist">{entry.content}</p>
        )}
      </div>
    </div>
  );
}
