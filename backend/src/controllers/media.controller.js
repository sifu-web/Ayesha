const db = require('../config/db');
const { cloudinary, FOLDER } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

/**
 * Upload flow: Phone → Cloudinary (direct, chunked) → Backend saves only the URL.
 *
 * The browser uploads the raw file straight to Cloudinary using a short-lived
 * signature issued by getUploadSignature() below; our server never sees the
 * file bytes. Once Cloudinary has the asset, the frontend calls confirmMedia()
 * with just the public_id — the backend re-fetches the authoritative asset
 * info (bytes/dimensions/format/url) directly from Cloudinary's Admin API
 * rather than trusting numbers the client could tamper with, and writes the
 * DB row from that.
 *
 * This removes the old phone → our server → Cloudinary relay entirely, so:
 *  - there's no server-side file size ceiling or in-memory buffering of the
 *    whole video
 *  - the phone only transfers the file once (not twice), which was the
 *    biggest cause of long upload times / the device heating up
 *  - a slow/interrupted mobile connection can't hang our server's request
 *    handling — Cloudinary's own chunked upload protocol handles retry of
 *    individual chunks on the client
 */

/** Builds the delivery URL for a given quality mode without waiting on any upload-time processing. */
function buildFinalUrl(resource, resourceType, quality) {
  if (quality !== 'hd') return resource.secure_url;

  return cloudinary.url(resource.public_id, {
    resource_type: resourceType,
    secure: true,
    quality: 'auto:good',
    fetch_format: 'auto',
    ...(resourceType === 'video'
      ? { video_codec: 'auto' }
      : { crop: 'limit', width: 2560, height: 2560 }),
  });
}

function buildThumbnail(publicId, resourceType) {
  return resourceType === 'video'
    ? cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        start_offset: '0',
        width: 500,
        crop: 'fill',
      })
    : cloudinary.url(publicId, { width: 500, crop: 'fill', quality: 'auto', fetch_format: 'auto' });
}

/**
 * Issues a short-lived signature the browser uses to upload directly to
 * Cloudinary. Only `folder` + `timestamp` are signed (and therefore locked
 * down) — the client cannot smuggle in extra params like a different folder
 * or upload preset, since Cloudinary rejects any signed param that doesn't
 * match what was signed here.
 */
async function getUploadSignature(req, res) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.json({
    success: true,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: FOLDER,
  });
}

/**
 * Called by the frontend after a file has already landed on Cloudinary
 * directly. We re-fetch the asset from Cloudinary ourselves (never trusting
 * client-supplied bytes/dimensions) and write the DB row from that.
 */
async function confirmMedia(req, res) {
  const { publicId, resourceType, quality = 'original', originalFilename } = req.body;

  if (!publicId || !['image', 'video'].includes(resourceType)) {
    return res.status(400).json({ success: false, message: 'publicId and a valid resourceType are required.' });
  }
  if (!['original', 'hd'].includes(quality)) {
    return res.status(400).json({ success: false, message: 'Quality must be "original" or "hd".' });
  }

  // A previously confirmed upload (e.g. a retried request) — return the
  // existing row instead of erroring, so retries are safe.
  const existing = await db.query('SELECT * FROM media WHERE public_id = $1', [publicId]);
  if (existing.rows[0]) {
    return res.status(200).json({ success: true, media: existing.rows[0] });
  }

  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary resource lookup failed:', err.message);
    return res.status(404).json({ success: false, message: 'Could not verify the uploaded file with Cloudinary.' });
  }

  // Only accept assets that actually live in our own upload folder.
  if (!resource.public_id.startsWith(`${FOLDER}/`) && resource.folder !== FOLDER) {
    return res.status(403).json({ success: false, message: 'That file is not in the expected folder.' });
  }

  const finalUrl = buildFinalUrl(resource, resourceType, quality);
  const thumbnail = buildThumbnail(resource.public_id, resourceType);

  const inserted = await db.query(
    `INSERT INTO media
      (public_id, resource_type, format, url, secure_url, thumbnail_url, original_filename, quality_mode, bytes, width, height, duration, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      resource.public_id,
      resourceType,
      resource.format,
      resource.url,
      finalUrl,
      thumbnail,
      originalFilename || resource.public_id,
      quality,
      resource.bytes,
      resource.width || null,
      resource.height || null,
      resource.duration || null,
      req.user.id,
    ]
  );

  const media = inserted.rows[0];

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'MEDIA_UPLOADED',
    details: `Uploaded 1 ${resourceType} (${quality})`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, media });
}

async function listMedia(req, res) {
  const {
    type = 'all',
    search = '',
    sort = 'newest',
    page = 1,
    limit = 24,
  } = req.query;

  const conditions = [];
  const params = [];

  if (type === 'photo') conditions.push("resource_type = 'image'");
  if (type === 'video') conditions.push("resource_type = 'video'");

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`original_filename ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    largest: 'bytes DESC',
    smallest: 'bytes ASC',
    name: 'original_filename ASC',
  };
  const orderBy = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  const totalResult = await db.query(`SELECT COUNT(*) AS count FROM media ${where}`, params);
  const total = Number(totalResult.rows[0].count);

  const itemsResult = await db.query(
    `SELECT * FROM media ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limitNum, offset]
  );
  const items = itemsResult.rows;

  res.json({
    success: true,
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      hasMore: offset + items.length < total,
    },
  });
}

async function deleteMedia(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM media WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  try {
    await cloudinary.uploader.destroy(item.public_id, { resource_type: item.resource_type });
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }

  await db.query('DELETE FROM media WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'MEDIA_DELETED',
    details: `Deleted ${item.resource_type} "${item.original_filename}"`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'File deleted successfully.' });
}

async function getDownloadUrl(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM media WHERE id = $1', [id]);
  const item = result.rows[0];

  if (!item) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  const downloadUrl = cloudinary.url(item.public_id, {
    resource_type: item.resource_type,
    flags: 'attachment',
    secure: true,
  });

  res.json({ success: true, downloadUrl, filename: item.original_filename });
}

module.exports = { getUploadSignature, confirmMedia, listMedia, deleteMedia, getDownloadUrl };
