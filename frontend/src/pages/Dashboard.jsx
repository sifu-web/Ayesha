import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StorageRing from '../components/StorageRing';
import UploadModal from '../components/UploadModal';
import api from '../api/axios';

function formatBytes(bytes) {
  if (!bytes) return '0 GB';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function fetchStats() {
    const { data } = await api.get('/stats');
    setStats(data.stats);
    setActivity(data.recentActivity);
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <h1 className="mb-6 font-display italic text-3xl text-pearl">Dashboard</h1>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuickAction to="/gallery/photo" emoji="📷" label="Photos" />
          <QuickAction to="/gallery/video" emoji="🎬" label="Videos" />
          <QuickAction onClick={() => setUploadOpen(true)} emoji="📤" label="Upload" />
          <QuickAction to="/keys" emoji="🔑" label="Key Generator" />
        </div>

        {!stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-32" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="glass-panel animate-fade-up flex flex-col items-center justify-center gap-4 p-8 lg:col-span-1">
                <div className="relative flex items-center justify-center">
                  <StorageRing percentage={stats.storagePercentage} />
                  <div className="absolute flex flex-col items-center">
                    <span className="font-mono text-2xl text-pearl">{stats.storagePercentage}%</span>
                    <span className="text-xs text-mist">used</span>
                  </div>
                </div>
                <p className="text-sm text-mist">
                  {formatBytes(stats.usedStorage)} of {formatBytes(stats.totalStorage)}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
                <StatCard label="Total Storage" value={formatBytes(stats.totalStorage)} icon="💾" />
                <StatCard label="Used Storage" value={formatBytes(stats.usedStorage)} icon="📦" />
                <StatCard label="Available Storage" value={formatBytes(stats.availableStorage)} icon="✅" />
                <StatCard label="Total Files" value={stats.totalFiles.toLocaleString()} icon="🗂️" />
                <StatCard label="Photos" value={stats.photoCount.toLocaleString()} icon="📷" />
                <StatCard label="Videos" value={stats.videoCount.toLocaleString()} icon="🎬" />
              </div>
            </div>

            <div className="glass-panel animate-fade-up mt-6 p-6">
              <h2 className="mb-4 font-display italic text-xl text-pearl">Recent Activity</h2>
              {activity.length === 0 ? (
                <p className="text-sm text-mist">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {activity.map((log, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="text-pearl">
                        <span className="font-medium">{log.username || 'System'}</span>{' '}
                        <span className="text-mist">{log.action.replaceAll('_', ' ').toLowerCase()}</span>
                        {log.details ? <span className="text-mist"> — {log.details}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-mist">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={(failedCount) => {
            // Only auto-close on a full success — if anything failed, keep
            // the modal open so the person can actually see the error.
            if (!failedCount) setUploadOpen(false);
            fetchStats();
          }}
        />
      )}
    </div>
  );
}

function QuickAction({ to, onClick, emoji, label }) {
  const content = (
    <>
      <span className="text-2xl">{emoji}</span>
      <span className="mt-2 text-sm font-medium text-pearl">{label}</span>
    </>
  );
  const className =
    'glass-panel animate-fade-up flex flex-col items-center justify-center gap-1 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-glow';

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="glass-panel animate-fade-up flex items-center gap-4 p-5">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="font-mono text-xl text-pearl">{value}</p>
        <p className="text-xs text-mist">{label}</p>
      </div>
    </div>
  );
}
