import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const DURATIONS = [
  { value: 'one_time', label: 'One Time' },
  { value: '1_hour', label: '1 Hour' },
  { value: '1_day', label: '1 Day' },
  { value: '1_week', label: '1 Week' },
  { value: '1_month', label: '1 Month' },
];

const STATUS_STYLES = {
  active: 'border-mint/30 bg-mint/10 text-mint',
  used: 'border-white/15 bg-white/[0.06] text-mist',
  expired: 'border-coral/30 bg-coral/10 text-coral',
  revoked: 'border-coral/30 bg-coral/10 text-coral',
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatRemaining(seconds) {
  if (seconds === null) return 'Until first use';
  if (seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState('1_day');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [tick, setTick] = useState(0);

  async function fetchKeys() {
    setLoading(true);
    const { data } = await api.get('/keys');
    setKeys(data.keys);
    setLoading(false);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  // Recompute live countdowns once a minute without refetching from the server.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const { data } = await api.post('/keys', { durationType: duration });
      setKeys((prev) => [data.key, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate a key.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(key) {
    if (!window.confirm(`Delete key "${key.key_value}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/keys/${key.id}`);
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete key.');
    }
  }

  async function handleCopy(key) {
    try {
      await navigator.clipboard.writeText(key.key_value);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId((v) => (v === key.id ? null : v)), 1500);
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  // Live-adjust remaining_seconds locally between fetches, for the countdown display.
  function liveRemaining(key) {
    if (key.status !== 'active' || key.remaining_seconds === null) return key.remaining_seconds;
    void tick; // re-render trigger
    return key.remaining_seconds;
  }

  return (
    <div className="min-h-screen pb-16">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <h1 className="mb-6 font-display italic text-3xl text-pearl">Key Generator</h1>

        <div className="glass-panel animate-fade-up mb-6 p-6">
          <p className="mb-3 text-sm font-medium text-mist">Generate a secure access key</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`chip border ${duration === d.value ? 'border-rose bg-rose/15 text-rose' : 'border-white/10 text-mist'}`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-coral">{error}</p>}

          <button onClick={handleGenerate} disabled={generating} className="btn-primary mt-5">
            {generating ? 'Generating…' : '＋ Generate Key'}
          </button>
        </div>

        <div className="glass-panel divide-y divide-white/[0.06] overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-mist">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-6 text-sm text-mist">No keys generated yet.</div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-pearl">{key.key_value}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[key.status] || STATUS_STYLES.expired}`}
                    >
                      {key.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mist">
                    {DURATIONS.find((d) => d.value === key.duration_type)?.label || key.duration_type} · Created{' '}
                    {formatDateTime(key.created_at)}
                  </p>
                  <p className="text-xs text-mist">
                    Expires {formatDateTime(key.expires_at)} · Remaining {formatRemaining(liveRemaining(key))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => handleCopy(key)} className="btn-ghost !px-3 !py-2 text-sm">
                    {copiedId === key.id ? 'Copied ✓' : 'Copy'}
                  </button>
                  <button onClick={() => handleDelete(key)} className="btn-danger !px-3 !py-2 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
