import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import UploadModal from '../components/UploadModal';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Home() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState({ photo: null, video: null });
  const [uploadOpen, setUploadOpen] = useState(false);

  async function fetchCounts() {
    try {
      const [photos, videos] = await Promise.all([
        api.get('/media', { params: { type: 'photo', limit: 1 } }),
        api.get('/media', { params: { type: 'video', limit: 1 } }),
      ]);
      setCounts({ photo: photos.data.pagination.total, video: videos.data.pagination.total });
    } catch {
      setCounts({ photo: 0, video: 0 });
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
          onUploaded={() => {
            setUploadOpen(false);
            fetchCounts();
          }}
        />
      )}
    </div>
  );
}

function HomeCard({ to, emoji, title, count, gradient }) {
  return (
    <Link
      to={to}
      className={`glass-panel animate-fade-up group relative overflow-hidden p-10 transition duration-300 hover:-translate-y-1 hover:shadow-glow sm:p-14`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition group-hover:opacity-100`} />
      <div className="relative flex flex-col items-center text-center">
        <span className="text-6xl transition group-hover:scale-110">{emoji}</span>
        <h2 className="mt-5 font-display italic text-3xl text-pearl">{title}</h2>
        <p className="mt-2 font-mono text-sm text-mist">
          {count === null ? 'Loading…' : `${count.toLocaleString()} file${count === 1 ? '' : 's'}`}
        </p>
      </div>
    </Link>
  );
}
