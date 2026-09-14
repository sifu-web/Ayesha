const db = require('../config/db');
const { cloudinary, FOLDER } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

/**
 * Documents (PDF, Word, Excel, plain text, zip — any file type) live in
 * their own Cloudinary subfolder and are stored as Cloudinary's "raw"
 * resource type, which stores the file byte-for-byte with no image/video
 * processing applied (that only makes sense for photos/videos).
 *
 * Same direct-to-Cloudinary signed-upload pattern used everywhere else in
 * this app (see media.controller.js for the full rationale): the phone
 * uploads straight to Cloudinary, and the backend only ever re-fetches the
 * authoritative asset info from Cloudinary's Admin API before writing a row
 * — never trusting client-supplied size/name.
 */
const DOCUMENTS_FOLDER = `${FOLDER}/documents`;

async function getUploadSignature(req, res) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: DOCUMENTS_FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.json({
    success: true,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: DOCUMENTS_FOLDER,
  });
}

async function confirmDocument(req, res) {
  const { publicId, displayName, originalFilename } = req.body;

  if (!publicId) {
    return res.status(400).json({ success: false, message: 'publicId is required.' });
  }

  // A previously confirmed upload (e.g. a retried request) — return the
  // existing row instead of erroring, so retries are safe.
  const existing = await db.query('SELECT * FROM documents WHERE public_id = $1', [publicId]);
  if (existing.rows[0]) {
    return res.status(200).json({ success: true, document: existing.rows[0] });
  }

  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
  } catch (err) {
    console.error('Cloudinary resource lookup failed:', err.message);
    return res.status(404).json({ success: false, message: 'Could not verify the uploaded file with Cloudinary.' });
  }

  if (!resource.public_id.startsWith(`${DOCUMENTS_FOLDER}/`)) {
    return res.status(403).json({ success: false, message: 'That file is not in the expected folder.' });
  }

  const fallbackName = 'Untitled document';
  const name = (displayName || originalFilename || fallbackName).trim() || fallbackName;

  const inserted = await db.query(
    `INSERT INTO documents
      (public_id, display_name, original_filename, url, format, bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      resource.public_id,
      name,
      originalFilename || null,
      resource.secure_url,
      resource.format || null,
      resource.bytes,
      req.user.id,
    ]
  );

  const document = inserted.rows[0];

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DOCUMENT_UPLOADED',
    details: `Uploaded document "${name}"`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, document });
}

async function listDocuments(req, res) {
  const { search = '' } = req.query;

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`display_name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(`SELECT * FROM documents ${where} ORDER BY created_at DESC`, params);
  res.json({ success: true, items: result.rows });
}

async function renameDocument(req, res) {
  const { id } = req.params;
  const { displayName } = req.body;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ success: false, message: 'A name is required.' });
  }

  const existing = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
  if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Not found.' });

  const updated = await db.query(
    'UPDATE documents SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [displayName.trim(), id]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DOCUMENT_RENAMED',
    details: `Renamed "${existing.rows[0].display_name}" to "${displayName.trim()}"`,
    ip: req.ip,
  });

  res.json({ success: true, document: updated.rows[0] });
}

async function deleteDocument(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'Not found.' });
  }

  try {
    await cloudinary.uploader.destroy(item.public_id, { resource_type: 'raw' });
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }

  await db.query('DELETE FROM documents WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DOCUMENT_DELETED',
    details: `Deleted document "${item.display_name}"`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Deleted successfully.' });
}

async function getDownloadUrl(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  // Raw assets (PDF/Word/zip/etc.) are delivered by Cloudinary under a
  // stricter access policy than images/videos — an unsigned raw URL comes
  // back as an HTTP 401 even though the asset is "public" in our own app.
  // Signing the URL (sign_url: true) attaches an expiring signature so
  // Cloudinary authorizes the delivery regardless of that stricter default.
  const downloadUrl = cloudinary.url(item.public_id, {
    resource_type: 'raw',
    type: 'upload',
    flags: 'attachment',
    sign_url: true,
    secure: true,
  });

  res.json({ success: true, downloadUrl, filename: item.original_filename || item.display_name });
}

module.exports = {
  getUploadSignature,
  confirmDocument,
  listDocuments,
  renameDocument,
  deleteDocument,
  getDownloadUrl,
};
