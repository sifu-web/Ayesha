import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { startCleanRecording } from '../utils/audioRecording';

const ACCENT_PRESETS = ['#FF4D7D', '#A78BFA', '#4ADE80', '#FBBF24', '#38BDF8', '#FB7185'];
const TEXT_PRESETS = ['#FFFFFF', '#F3F1F7', '#FF4D7D', '#A78BFA'];

const cloudinaryClient = axios.create();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DiaryEditor({ entry, onClose, onSaved, onDelete }) {
  const isEdit = Boolean(entry);

  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [entryDate, setEntryDate] = useState(entry?.entry_date?.slice(0, 10) || todayISO());
  const [color, setColor] = useState(entry?.color || ACCENT_PRESETS[0]);
  const [textColor, setTextColor] = useState(entry?.text_color || '#FFFFFF');

  // Voice note state: either the entry's existing voice, or a freshly
  // recorded (not-yet-uploaded) blob waiting to be sent on Save.
  const [existingVoiceUrl, setExistingVoiceUrl] = useState(entry?.voice_url || null);
  const [removeVoiceFlag, setRemoveVoiceFlag] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Full-screen distraction-free writing mode for the textarea.
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenPushedRef = useRef(false);

  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const fullscreenTextareaRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      recordingRef.current?.cancel();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      // If this component unmounts while a fullscreen history entry is
      // still pending (e.g. the whole editor was closed from outside),
      // consume it so the browser's back stack doesn't get left with a
      // dangling entry that would need an extra back press later.
      if (fullscreenPushedRef.current) {
        fullscreenPushedRef.current = false;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open full-screen writing mode. We push a history entry so that the
  // device/browser back button closes full-screen mode (returning to this
  // Edit Entry page) instead of leaving the app or the editor entirely.
  function openFullscreen() {
    if (!fullscreenPushedRef.current) {
      window.history.pushState({ diaryFullscreenEditor: true }, '');
      fullscreenPushedRef.current = true;
    }
    setFullscreen(true);
    setTimeout(() => fullscreenTextareaRef.current?.focus(), 50);
  }

  // Close full-screen writing mode via the in-app back button. We go
  // through history.back() (instead of setting state directly) so there is
  // only one code path — the popstate handler below — that actually closes
  // the view. That keeps the in-app back button and the phone's back
  // button perfectly in sync.
  function closeFullscreen() {
    if (fullscreenPushedRef.current) {
      window.history.back();
    } else {
      setFullscreen(false);
    }
  }

  useEffect(() => {
    function onPopState() {
      if (fullscreenPushedRef.current) {
        fullscreenPushedRef.current = false;
        setFullscreen(false);
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  async function startRecording() {
    setError('');
    try {
      // Noise-cancelled recording — see utils/audioRecording.js. The saved
      // voice note is the cleaned-up signal, not the raw microphone input.
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
    setRecordedBlob(blob);
    setRecordedUrl(URL.createObjectURL(blob));
  }

  function removeVoice() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setExistingVoiceUrl(null);
    setRemoveVoiceFlag(true);
  }

  async function uploadVoice() {
    const { data: sig } = await api.post('/diary/voice-upload-signature');
    const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`;

    const formData = new FormData();
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);
    formData.append('file', recordedBlob, 'voice-note.webm');

    const { data } = await cloudinaryClient.post(url, formData);
    return data.public_id;
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Please give this entry a title.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { title: title.trim(), content, entryDate, color, textColor };

      if (recordedBlob) {
        payload.voicePublicId = await uploadVoice();
      } else if (removeVoiceFlag) {
        payload.removeVoice = true;
      }

      let saved;
      if (isEdit) {
        const { data } = await api.put(`/diary/${entry.id}`, payload);
        saved = data.entry;
      } else {
        const { data } = await api.post('/diary', payload);
        saved = data.entry;
      }
      onSaved?.(saved);
    } catch (err) {
      console.error('Diary save failed:', err);
      setError(err.response?.data?.message || 'Could not save this entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await api.delete(`/diary/${entry.id}`);
      onDelete?.(entry);
    } catch (err) {
      setError('Could not delete this entry. Please try again.');
      setSaving(false);
    }
  }

  const hasVoice = Boolean(recordedUrl || existingVoiceUrl);

  // Shared voice note controls — used both in the normal editor and in the
  // full-screen writing view, so add/record/play/remove behave identically
  // in both places.
  function renderVoiceSection() {
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-mist">Voice note</p>
        {!recording && !hasVoice && (
          <button onClick={startRecording} className="chip border border-white/10 text-mist">
            🎙️ Record a voice note
          </button>
        )}
        {recording && (
          <button onClick={stopRecording} className="chip border border-coral/40 bg-coral/15 text-coral">
            ⏹ Stop recording — {recordSeconds}s
          </button>
        )}
        {!recording && hasVoice && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 p-2.5">
            <audio controls src={recordedUrl || existingVoiceUrl} className="h-9 flex-1" />
            <button onClick={removeVoice} className="shrink-0 text-mist hover:text-coral" aria-label="Remove voice note">
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="glass-panel animate-fade-up flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto p-6 sm:m-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display italic text-2xl text-pearl">{isEdit ? 'Edit Entry' : 'New Diary Entry'}</h2>
          <button onClick={onClose} className="text-mist hover:text-pearl" aria-label="Close" disabled={saving}>
            ✕
          </button>
        </div>

        <label className="mb-1 text-sm font-medium text-mist">Date</label>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          className="glass-input mb-4"
        />

        <label className="mb-1 text-sm font-medium text-mist">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give this entry a title…"
          className="glass-input mb-4"
        />

        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-mist">What's on your mind?</label>
          <button
            type="button"
            onClick={openFullscreen}
            className="chip flex items-center gap-1.5 border border-white/15 bg-white/[0.06] text-sm font-semibold text-pearl transition hover:border-rose/50 hover:bg-rose/10 hover:text-rose"
            aria-label="Open full screen writing mode"
          >
            <span className="text-base leading-none">⛶</span> Full screen
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Write freely…"
          className="glass-input mb-4 resize-none"
        />

        <div className="mb-4">{renderVoiceSection()}</div>

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-mist">Tag color</p>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-8 w-8 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : ''}`}
                aria-label={`Use ${c}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent"
              aria-label="Custom tag color"
            />
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-mist">Text color</p>
          <div className="flex flex-wrap items-center gap-2">
            {TEXT_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                style={{ backgroundColor: c }}
                className={`h-8 w-8 rounded-full border border-white/20 transition ${
                  textColor === c ? 'ring-2 ring-rose ring-offset-2 ring-offset-panel' : ''
                }`}
                aria-label={`Use ${c}`}
              />
            ))}
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent"
              aria-label="Custom text color"
            />
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-coral">{error}</p>}

        <div className="mt-auto flex gap-3">
          {isEdit && (
            <button onClick={handleDelete} className="btn-ghost text-coral" disabled={saving}>
              🗑️ Delete
            </button>
          )}
          <button onClick={onClose} className="btn-ghost flex-1" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>

    {fullscreen && (
      <div className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-ink">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={closeFullscreen}
            aria-label="Close full screen, back to Edit Entry"
            className="chip flex h-11 shrink-0 items-center gap-1.5 border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-pearl transition hover:border-rose/50 hover:bg-rose/10 hover:text-rose"
          >
            <span className="text-lg leading-none">←</span> Close full screen
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display italic text-lg text-pearl">{title || 'Write freely'}</p>
            <p className="text-xs text-mist">{entryDate}</p>
          </div>
        </div>

        <textarea
          ref={fullscreenTextareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write freely…"
          className="flex-1 resize-none bg-transparent px-5 py-5 text-lg leading-relaxed text-pearl outline-none placeholder:text-mist/60"
        />

        <div className="shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {renderVoiceSection()}
        </div>
      </div>
    )}
    </>
  );
}
