import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const cloudinaryClient = axios.create();

function stripExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function extensionOf(name) {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toUpperCase() : '';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function iconFor(format) {
  const f = (format || '').toLowerCase();
  if (f === 'pdf') return '📕';
  if (['doc', 'docx'].includes(f)) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(f)) return '📗';
  if (['ppt', 'pptx'].includes(f)) return '📙';
  if (['zip', 'rar', '7z'].includes(f)) return '🗜️';
  if (['txt', 'md'].includes(f)) return '📄';
  return '📁';
}

export default function Documents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  async function fetchItems(searchTerm = search) {
    setLoading(true);
    try {
      const { data } = await api.get('/documents', { params: searchTerm ? { search: searchTerm } : {} });
      setItems(data.items);
    } catch (err) {
      setError('Could not load your documents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchItems(search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /** Uploads a file (any type) straight to Cloudinary as a raw asset and confirms it. */
  async function uploadDocumentFile(file) {
    const { data: sig } = await api.post('/documents/upload-signature');
    const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/raw/upload`;

    const formData = new FormData();
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);
    formData.append('file', file, file.name);

    const { data } = await cloudinaryClient.post(url, formData, {
      onUploadProgress: (evt) => setUploadProgress(Math.round((evt.loaded / evt.total) * 100)),
    });

    const { data: confirmed } = await api.post('/documents/confirm', {
      publicId: data.public_id,
      displayName: stripExtension(file.name),
      originalFilename: file.name,
    });

    return confirmed.document;
  }

  async function handleFilesChosen(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setError('');
    setUploadProgress(0);

    for (const file of files) {
      try {
        const doc = await uploadDocumentFile(file);
        setItems((prev) => [doc, ...prev]);
      } catch (err) {
        console.error('Document upload failed:', err);
        setError(`Could not upload "${file.name}".`);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleRename(item) {
    const nextName = window.prompt('Rename to:', item.display_name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === item.display_name) return;

    try {
      const { data } = await api.put(`/documents/${item.id}`, { displayName: trimmed });
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.document : i)));
    } catch (err) {
      setError('Could not rename that document.');
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.display_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/documents/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError('Could not delete that document.');
    }
  }

  async function handleDownload(item) {
    try {
      const { data } = await api.get(`/documents/${item.id}/download`);
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename || item.display_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError('Could not prepare that download.');
    }
  }

  return (
    <div className="min-h-screen pb-28">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm text-mist hover:text-pearl">← Home</Link>
            <h1 className="font-display italic text-3xl text-pearl">Documents</h1>
          </div>
          <input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input max-w-xs"
          />
        </div>

        {error && (
          <div className="glass-panel mb-4 border border-coral/30 p-3.5 text-sm text-coral">{error}</div>
        )}

        {/* Upload from phone */}
        <div className="glass-panel mb-8 p-5">
          <p className="mb-3 text-sm font-medium text-mist">Upload documents or files from your phone</p>
          <p className="mb-3 text-xs text-mist/80">
            Any file type — PDF, Word, Excel, PowerPoint, text, zip, and more.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? `Uploading… ${uploadProgress}%` : '📁 Choose files to upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
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

        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel p-6 text-center text-sm text-mist">No documents uploaded yet.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <DocumentRow
                key={item.id}
                item={item}
                onDownload={() => handleDownload(item)}
                onRename={() => handleRename(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DocumentRow({ item, onDownload, onRename, onDelete }) {
  return (
    <div className="glass-panel flex items-center gap-3 p-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
        {iconFor(item.format || extensionOf(item.original_filename || ''))}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-pearl">{item.display_name}</p>
        <p className="text-xs text-mist">
          {(item.format || '').toUpperCase()}
          {item.format && item.bytes ? ' · ' : ''}
          {formatBytes(item.bytes)}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        <IconButton label="Download" onClick={onDownload}>⬇️</IconButton>
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
