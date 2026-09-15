import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { useSongsPlayer } from '../context/SongsPlayerContext';
import { startCleanRecording } from '../utils/audioRecording';

const cloudinaryClient = axios.create();

function stripExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Songs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Song upload (from the phone's files)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const [savingVoice, setSavingVoice] = useState(false);

  const { current, isPlaying, play, togglePlay, stop } = useSongsPlayer();

  async function fetchItems() {
    setLoading(true);
    try {
      const { data } = await api.get('/songs');
      setItems(data.items);
    } catch (err) {
      setError('Could not load your songs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  /** Uploads a song file (from the phone) straight to Cloudinary and confirms it. */
  async function uploadSongFile(file) {
    const { data: sig } = await api.post('/songs/upload-signature');
    const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`;

    const formData = new FormData();
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);
    formData.append('file', file, file.name);

    const { data } = await cloudinaryClient.post(url, formData, {
      onUploadProgress: (evt) => setUploadProgress(Math.round((evt.loaded / evt.total) * 100)),
    });

    const { data: confirmed } = await api.post('/songs/confirm', {
      publicId: data.public_id,
      kind: 'song',
      displayName: stripExtension(file.name),
      // The name the file was saved under on the phone, kept for reference.
      originalFilename: file.name,
    });

    return confirmed.song;
  }

  /** Uploads a recorded voice-note Blob straight to Cloudinary and confirms it. */
  async function uploadVoiceBlob(blob) {
    const { data: sig } = await api.post('/songs/upload-signature');
    const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`;

    const formData = new FormData();
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);
    formData.append('file', blob, 'voice-note.webm');

    const { data } = await cloudinaryClient.post(url, formData);

    const { data: confirmed } = await api.post('/songs/confirm', {
      publicId: data.public_id,
      kind: 'voice',
      displayName: `Voice note — ${new Date().toLocaleString()}`,
    });

    return confirmed.song;
  }

  async function handleFilesChosen(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setError('');
    setUploadProgress(0);

    for (const file of files) {
      try {
        const song = await uploadSongFile(file);
        setItems((prev) => [song, ...prev]);
      } catch (err) {
        console.error('Song upload failed:', err);
        setError(`Could not upload "${file.name}".`);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function startRecording() {
    setError('');
    try {
      recordingRef.current = await startCleanRecording();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError('Could not access the microphone. Check your browser permission.');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    setRecording(false);
    if (!recordingRef.current) return;
    const blob = await recordingRef.current.stop();
    recordingRef.current = null;

    setSavingVoice(true);
    try {
      const song = await uploadVoiceBlob(blob);
      setItems((prev) => [song, ...prev]);
    } catch (err) {
      console.error('Voice upload failed:', err);
      setError('Could not save the voice recording.');
    } finally {
      setSavingVoice(false);
    }
  }

  async function handleRename(item) {
    const nextName = window.prompt('Rename to:', item.display_name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === item.display_name) return;

    try {
      const { data } = await api.put(`/songs/${item.id}`, { displayName: trimmed });
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.song : i)));
    } catch (err) {
      setError('Could not rename that item.');
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.display_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/songs/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // If the deleted track is the one loaded in the mini player, stop and
      // clear it — otherwise the player keeps showing/playing a track that
      // no longer exists.
      if (current?.id === item.id) stop();
    } catch (err) {
      setError('Could not delete that item.');
    }
  }

  const songs = items.filter((i) => i.kind === 'song');
  const voices = items.filter((i) => i.kind === 'voice');

  return (
    <div className="min-h-screen pb-40">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <div className="mb-6">
          <Link to="/" className="text-sm text-mist hover:text-pearl">← Home</Link>
          <h1 className="font-display italic text-3xl text-pearl">Songs</h1>
        </div>

        {error && (
          <div className="glass-panel mb-4 border border-coral/30 p-3.5 text-sm text-coral">{error}</div>
        )}

        {/* Upload from phone */}
        <div className="glass-panel mb-6 p-5">
          <p className="mb-3 text-sm font-medium text-mist">Upload songs from your phone</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? `Uploading… ${uploadProgress}%` : '🎵 Choose songs to upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
          {uploading && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-rose-orchid transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Record own voice */}
        <div className="glass-panel mb-8 p-5">
          <p className="mb-3 text-sm font-medium text-mist">Record your own voice</p>
          <p className="mb-3 text-xs text-mist/80">
            Recordings are automatically cleaned up with noise cancellation, so background hiss and hum
            are reduced and your voice sounds clearer.
          </p>
          {!recording && (
            <button
              onClick={startRecording}
              disabled={savingVoice}
              className="chip w-full justify-center border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold text-pearl transition hover:border-rose/50 hover:bg-rose/10 hover:text-rose"
            >
              🎙️ {savingVoice ? 'Saving…' : 'Record a voice note'}
            </button>
          )}
          {recording && (
            <button
              onClick={stopRecording}
              className="chip w-full justify-center border border-coral/40 bg-coral/15 py-3 text-sm font-semibold text-coral"
            >
              ⏹ Stop recording — {recordSeconds}s
            </button>
          )}
        </div>

        <Section title="Songs" emoji="🎵" items={songs} loading={loading} empty="No songs uploaded yet.">
          {songs.map((item) => (
            <SongRow
              key={item.id}
              item={item}
              isCurrent={current?.id === item.id}
              isPlaying={isPlaying}
              onPlay={() => (current?.id === item.id ? togglePlay() : play(item))}
              onRename={() => handleRename(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </Section>

        <Section title="Your voice" emoji="🎤" items={voices} loading={loading} empty="No voice recordings yet.">
          {voices.map((item) => (
            <SongRow
              key={item.id}
              item={item}
              isCurrent={current?.id === item.id}
              isPlaying={isPlaying}
              onPlay={() => (current?.id === item.id ? togglePlay() : play(item))}
              onRename={() => handleRename(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, emoji, items, loading, empty, children }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 font-display italic text-xl text-pearl">
        {emoji} {title}
      </h2>
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel p-6 text-center text-sm text-mist">{empty}</div>
      ) : (
        <div className="flex flex-col gap-2.5">{children}</div>
      )}
    </div>
  );
}

function SongRow({ item, isCurrent, isPlaying, onPlay, onRename, onDelete }) {
  const playing = isCurrent && isPlaying;
  return (
    <div className="glass-panel flex items-center gap-3 p-3.5">
      <button
        onClick={onPlay}
        aria-label={playing ? 'Pause' : 'Play'}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white shadow-glow transition ${
          playing ? 'bg-rose-orchid' : 'bg-white/10 hover:bg-white/20'
        }`}
      >
        {playing ? '⏸' : '▶️'}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${isCurrent ? 'text-rose' : 'text-pearl'}`}>{item.display_name}</p>
        <p className="text-xs text-mist">{formatDuration(item.duration)}</p>
      </div>

      <div className="flex shrink-0 gap-1">
        <IconButton label="Rename" onClick={onRename}>✏️</IconButton>
        <IconButton label="Delete" onClick={onDelete}>🗑️</IconButton>
      </div>
    </div>
  );
}

function IconButton({ children, label, ...props }) {
  return (
    <button
      {...props}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-mist transition hover:bg-white/10 hover:text-pearl"
    >
      {children}
    </button>
  );
}
