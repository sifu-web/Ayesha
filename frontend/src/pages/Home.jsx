import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import UploadModal from '../components/UploadModal';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Home() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState({ photo: null, video: null, diary: null, songs: null, documents: null });
  const [uploadOpen, setUploadOpen] = useState(false);

  async function fetchCounts() {
    try {
      const [photos, videos] = await Promise.all([
        api.get('/media', { params: { type: 'photo', limit: 1 } }),
        api.get('/media', { params: { type: 'video', limit: 1 } }),
      ]);
      setCounts((prev) => ({ ...prev, photo: photos.data.pagination.total, video: videos.data.pagination.total }));
    } catch {
      setCounts((prev) => ({ ...prev, photo: 0, video: 0 }));
    }

    if (isAdmin) {
      try {
        const diary = await api.get('/diary', { params: { limit: 1 } });
        setCounts((prev) => ({ ...prev, diary: diary.data.pagination.total }));
      } catch {
        setCounts((prev) => ({ ...prev, diary: 0 }));
      }

      try {
        const songs = await api.get('/songs');
        setCounts((prev) => ({ ...prev, songs: songs.data.items.length }));
      } catch {
        setCounts((prev) => ({ ...prev, songs: 0 }));
      }

      try {
        const documents = await api.get('/documents');
        setCounts((prev) => ({ ...prev, documents: documents.data.items.length }));
      } catch {
        setCounts((prev) => ({ ...prev, documents: 0 }));
      }
    }
  }

  useEffect(() => {
    fetchCounts();
  }, []);

  return (
    <div className="min-h-screen pb-28">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
        <div className="animate-fade-up mb-10 text-center sm:mb-14">
          <h1 className="font-display italic text-4xl text-pearl sm:text-5xl">Welcome back 💗</h1>
          <p className="mt-3 text-mist">Everything you've saved, safe in one beautiful place.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <HomeCard
            to="/gallery/photo"
            emoji="📷"
            title="Photos"
            count={counts.photo}
            gradient="from-rose/20 to-transparent"
          />
          <HomeCard
            to="/gallery/video"
            emoji="🎬"
            title="Videos"
            count={counts.video}
            gradient="from-orchid/20 to-transparent"
          />
          {isAdmin && (
            <HomeCard
              to="/diary"
              emoji="📔"
              title="Diary"
              count={counts.diary}
              countLabel="entry"
              gradient="from-mint/20 to-transparent"
            />
          )}
          {isAdmin && (
            <HomeCard
              to="/songs"
              emoji="🎵"
              title="Songs"
              count={counts.songs}
              countLabel="track"
              gradient="from-sky/20 to-transparent"
            />
          )}
          {isAdmin && (
            <HomeCard
              to="/documents"
              emoji="📁"
              title="Documents"
              count={counts.documents}
              countLabel="file"
              gradient="from-amber/20 to-transparent"
            />
          )}
        </div>
      </main>

      {isAdmin && (
        <button
          onClick={() => setUploadOpen(true)}
          className="gpu-layer fixed bottom-8 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-rose-orchid text-2xl text-white shadow-glow animate-breathe sm:right-10"
          aria-label="Upload media"
        >
          ＋
        </button>
      )}

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={(failedCount) => {
            // Only auto-close on a full success — if anything failed, keep
            // the modal open so the person can actually see the error.
            if (!failedCount) setUploadOpen(false);
            fetchCounts();
          }}
        />
      )}
    </div>
  );
}

function HomeCard({ to, emoji, title, count, gradient, countLabel = 'file', className = '' }) {
  const plural = countLabel === 'entry' ? 'entries' : `${countLabel}s`;
  const label = count === 1 ? countLabel : plural;

  return (
    <Link
      to={to}
      className={`glass-panel animate-fade-up group relative overflow-hidden p-10 transition duration-300 hover:-translate-y-1 hover:shadow-glow sm:p-14 ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition group-hover:opacity-100`} />
      <div className="relative flex flex-col items-center text-center">
        <span className="text-6xl transition group-hover:scale-110">{emoji}</span>
        <h2 className="mt-5 font-display italic text-3xl text-pearl">{title}</h2>
        <p className="mt-2 font-mono text-sm text-mist">
          {count === null ? 'Loading…' : `${count.toLocaleString()} ${label}`}
        </p>
      </div>
    </Link>
  );
}
