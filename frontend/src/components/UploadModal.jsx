import React, { useRef, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';

const MAX_FILES = 100;
// Cloudinary's chunked-upload protocol needs two custom cross-origin headers
// (X-Unique-Upload-Id, Content-Range). Sending those from the browser forces
// a CORS preflight on every chunk, and that preflight was failing for every
// video (photos stayed under the old 6MB threshold and never hit this path,
// which is why only videos were failing). The free Cloudinary plan already
// rejects any video over 100MB no matter how it's uploaded, so there's
// nothing to gain from chunking below that — set the threshold safely above
// the plan's own cap so every video that Cloudinary would actually accept
// takes the same plain, single-request path that already works for photos.
const CHUNK_SIZE = 150 * 1024 * 1024; // 150MB — comfortably above the free-plan's 100MB video cap

// Separate, bare axios instance for talking directly to Cloudinary.
// It must NOT carry our app's cookies/credentials or custom headers
// (those are only meaningful for our own backend).
const cloudinaryClient = axios.create();

function makeUploadId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Uploads one file straight from the browser to Cloudinary — our backend
 * never touches the file bytes. Files over CHUNK_SIZE go through Cloudinary's
 * chunked upload protocol (same request URL, split into pieces via the
 * Content-Range / X-Unique-Upload-Id headers), which removes Cloudinary's
 * per-request size ceiling and survives a shaky mobile connection much
 * better than sending one giant request.
 *
 * onProgress is called with a 0–1 fraction of *this file's* bytes sent.
 */
async function uploadFileToCloudinary(file, sig, onProgress) {
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

  const baseFields = {
    api_key: sig.apiKey,
    timestamp: sig.timestamp,
    signature: sig.signature,
    folder: sig.folder,
  };

  if (file.size <= CHUNK_SIZE) {
    const formData = new FormData();
    Object.entries(baseFields).forEach(([k, v]) => formData.append(k, v));
    formData.append('file', file);

    const { data } = await cloudinaryClient.post(url, formData, {
      onUploadProgress: (evt) => onProgress(evt.loaded / file.size),
    });
    return { result: data, resourceType };
  }

  // Chunked upload for large files (mainly video, but any big file benefits).
  const uploadId = makeUploadId();
  let start = 0;
  let lastResult = null;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    Object.entries(baseFields).forEach(([k, v]) => formData.append(k, v));
    formData.append('file', chunk, file.name);

    const { data } = await cloudinaryClient.post(url, formData, {
      headers: {
        'X-Unique-Upload-Id': uploadId,
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
      },
      onUploadProgress: (evt) => onProgress((start + evt.loaded) / file.size),
    });

    lastResult = data;
    start = end;
  }

  return { result: lastResult, resourceType };
}

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadModal({ onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState('original');
  const [progress, setProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
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
    setLoadedBytes(0);

    const totalBytesForRun = files.reduce((sum, f) => sum + f.size, 0) || 1;
    setTotalBytes(totalBytesForRun);
    const perFileLoaded = new Array(files.length).fill(0);

    function reportProgress(i, loaded) {
      perFileLoaded[i] = loaded;
      const loadedTotal = perFileLoaded.reduce((sum, v) => sum + v, 0);
      setLoadedBytes(loadedTotal);
      setProgress(Math.round((loadedTotal / totalBytesForRun) * 100));
    }

    let failedCount = 0;

    // Uploaded one at a time (not in parallel) — kinder to a phone's
    // connection/battery than firing off several large uploads at once.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { data: sig } = await api.post('/media/upload-signature');
        const { result, resourceType } = await uploadFileToCloudinary(file, sig, (frac) =>
          reportProgress(i, frac * file.size)
        );

        await api.post('/media/confirm', {
          publicId: result.public_id,
          resourceType,
          quality,
          originalFilename: file.name,
        });
      } catch (err) {
        console.error('Upload failed for', file.name, err);
        failedCount += 1;
      }
    }

    if (failedCount > 0) {
      setError(`${failedCount} file(s) failed to upload.`);
    }

    setUploading(false);
    // Let the parent decide whether to close the modal — on failure we pass
    // the count along so it can leave the modal open (previously the parent
    // closed it unconditionally, which unmounted the error message before
    // anyone could read it).
    onUploaded?.(failedCount);
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
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-rose-orchid transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-center text-xs text-mist">
              {formatMB(loadedBytes)} / {formatMB(totalBytes)} uploaded — {progress}% ({formatMB(Math.max(totalBytes - loadedBytes, 0))} left)
            </p>
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
