const db = require('../config/db');
const { cloudinary, FOLDER } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

/**
 * Songs & recorded voices live in their own Cloudinary subfolder, separate
 * from the photo/video gallery and the diary voice notes — same
 * direct-to-Cloudinary signed-upload pattern used everywhere else in this
 * app (see media.controller.js for the full rationale): the phone uploads
 * straight to Cloudinary, and the backend only ever re-fetches the
 * authoritative asset info from Cloudinary's Admin API before writing a row.
 */
const SONGS_FOLDER = `${FOLDER}/songs`;

async function getUploadSignature(req, res) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: SONGS_FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.json({
    success: true,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: SONGS_FOLDER,
  });
}

async function confirmSong(req, res) {
  const { publicId, kind = 'song', displayName, originalFilename } = req.body;

  if (!publicId) {
    return res.status(400).json({ success: false, message: 'publicId is required.' });
  }
  if (!['song', 'voice'].includes(kind)) {
    return res.status(400).json({ success: false, message: 'kind must be "song" or "voice".' });
  }

  // A previously confirmed upload (e.g. a retried request) — return the
  // existing row instead of erroring, so retries are safe.
  const existing = await db.query('SELECT * FROM songs WHERE public_id = $1', [publicId]);
  if (existing.rows[0]) {
    return res.status(200).json({ success: true, song: existing.rows[0] });
  }

  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: 'video' });
  } catch (err) {
    console.error('Cloudinary resource lookup failed:', err.message);
    return res.status(404).json({ success: false, message: 'Could not verify the uploaded audio with Cloudinary.' });
  }

  if (!resource.public_id.startsWith(`${SONGS_FOLDER}/`)) {
    return res.status(403).json({ success: false, message: 'That file is not in the expected folder.' });
  }

  const fallbackName = kind === 'voice' ? 'Voice recording' : 'Untitled song';
  const name = (displayName || originalFilename || fallbackName).trim() || fallbackName;

  const inserted = await db.query(
    `INSERT INTO songs
      (public_id, kind, display_name, original_filename, url, format, bytes, duration, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      resource.public_id,
      kind,
      name,
      originalFilename || null,
      resource.secure_url,
      resource.format,
      resource.bytes,
      resource.duration || null,
      req.user.id,
    ]
  );

  const song = inserted.rows[0];

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: kind === 'voice' ? 'VOICE_UPLOADED' : 'SONG_UPLOADED',
    details: `Uploaded ${kind === 'voice' ? 'voice recording' : 'song'} "${name}"`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, song });
}

async function listSongs(req, res) {
  const { kind = 'all', search = '' } = req.query;

  const conditions = [];
  const params = [];

  if (kind === 'song' || kind === 'voice') {
    params.push(kind);
    conditions.push(`kind = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`display_name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(`SELECT * FROM songs ${where} ORDER BY created_at DESC`, params);
  res.json({ success: true, items: result.rows });
}

async function renameSong(req, res) {
  const { id } = req.params;
  const { displayName } = req.body;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ success: false, message: 'A name is required.' });
  }

  const existing = await db.query('SELECT * FROM songs WHERE id = $1', [id]);
  if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Not found.' });

  const updated = await db.query(
    'UPDATE songs SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [displayName.trim(), id]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'SONG_RENAMED',
    details: `Renamed "${existing.rows[0].display_name}" to "${displayName.trim()}"`,
    ip: req.ip,
  });

  res.json({ success: true, song: updated.rows[0] });
}

async function deleteSong(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM songs WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'Not found.' });
  }

  try {
    await cloudinary.uploader.destroy(item.public_id, { resource_type: 'video' });
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }

  await db.query('DELETE FROM songs WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'SONG_DELETED',
    details: `Deleted ${item.kind} "${item.display_name}"`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Deleted successfully.' });
}

async function getDownloadUrl(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM songs WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  const downloadUrl = cloudinary.url(item.public_id, {
    resource_type: 'video',
    flags: 'attachment',
    secure: true,
  });

  res.json({ success: true, downloadUrl, filename: item.original_filename || item.display_name });
}

module.exports = { getUploadSignature, confirmSong, listSongs, renameSong, deleteSong, getDownloadUrl };
