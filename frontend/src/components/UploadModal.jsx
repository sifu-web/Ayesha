import React, { useRef, useState } from 'react';
import api from '../api/axios';

const MAX_FILES = 100;

export default function UploadModal({ onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState('original');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    const combined = [...files, ...incoming].slice(0, MAX_FILES);
    setFiles(combined);
    setError('');
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('quality', quality);

    try {
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      if (data.failed?.length) {
        setError(`${data.failed.length} file(s) failed to upload.`);
      }
      onUploaded?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="glass-panel animate-fade-up flex max-h-[90vh] w-full max-w-lg flex-col p-6 sm:m-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display italic text-2xl text-pearl">Upload Media</h2>
          <button onClick={onClose} className="text-mist hover:text-pearl" aria-label="Close">
            ✕
          </button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragging ? 'border-rose bg-rose/5' : 'border-white/15 hover:border-white/30'
          }`}
        >
          <p className="text-3xl">📤</p>
          <p className="mt-2 text-sm text-mist">
            Tap to choose, or drag & drop photos and videos here (up to {MAX_FILES} at once)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-white/10 p-2">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                <span className="truncate text-pearl">{file.name}</span>
                <button onClick={() => removeFile(i)} className="shrink-0 text-mist hover:text-coral" aria-label="Remove">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-mist">Upload quality</p>
          <div className="flex gap-3">
            <button
              onClick={() => setQuality('original')}
              className={`chip flex-1 border ${quality === 'original' ? 'border-rose bg-rose/15 text-rose' : 'border-white/10 text-mist'}`}
            >
              Original Quality
            </button>
            <button
              onClick={() => setQuality('hd')}
              className={`chip flex-1 border ${quality === 'hd' ? 'border-rose bg-rose/15 text-rose' : 'border-white/10 text-mist'}`}
            >
              HD (Compressed)
            </button>
          </div>
        </div>

        {uploading && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-rose-orchid transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-coral">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1" disabled={uploading}>
            Cancel
          </button>
          <button onClick={handleUpload} className="btn-primary flex-1" disabled={uploading || files.length === 0}>
            {uploading ? `Uploading… ${progress}%` : `Upload ${files.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
