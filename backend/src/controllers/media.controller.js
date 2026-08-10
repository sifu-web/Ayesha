const streamifier = require('streamifier');
const db = require('../config/db');
const { cloudinary, FOLDER } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

/** Uploads a single in-memory buffer to Cloudinary, returning its result. */
function uploadBufferToCloudinary(buffer, { resourceType, quality }) {
  return new Promise((resolve, reject) => {
    const options = {
      folder: FOLDER,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    if (quality === 'hd') {
      // "HD" = compress while preserving good visual quality.
      options.eager = [
        resourceType === 'video'
          ? { quality: 'auto:good', fetch_format: 'auto', video_codec: 'auto' }
          : { quality: 'auto:good', fetch_format: 'auto', crop: 'limit', width: 2560, height: 2560 },
      ];
      options.eager_async = false;
    }
    // quality === 'original' → no transformation, file stored as-is.

    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadMedia(req, res) {
  const files = req.files;
  const { quality = 'original' } = req.body;

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files were provided.' });
  }

  if (!['original', 'hd'].includes(quality)) {
    return res.status(400).json({ success: false, message: 'Quality must be "original" or "hd".' });
  }

  const results = [];
  const failures = [];

  for (const file of files) {
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');

    if (!isVideo && !isImage) {
      failures.push({ filename: file.originalname, reason: 'Unsupported file type.' });
      continue;
    }

    try {
      const resourceType = isVideo ? 'video' : 'image';
      const uploaded = await uploadBufferToCloudinary(file.buffer, { resourceType, quality });

      const eager = uploaded.eager && uploaded.eager[0];
      const finalUrl = eager ? eager.secure_url : uploaded.secure_url;
      const thumbnail =
        resourceType === 'video'
          ? cloudinary.url(uploaded.public_id, {
              resource_type: 'video',
              format: 'jpg',
              start_offset: '0',
              width: 500,
              crop: 'fill',
            })
          : cloudinary.url(uploaded.public_id, { width: 500, crop: 'fill', quality: 'auto', fetch_format: 'auto' });

      const inserted = await db.query(
        `INSERT INTO media
          (public_id, resource_type, format, url, secure_url, thumbnail_url, original_filename, quality_mode, bytes, width, height, duration, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          uploaded.public_id,
          resourceType,
          uploaded.format,
          uploaded.url,
          finalUrl,
          thumbnail,
          file.originalname,
          quality,
          eager ? eager.bytes : uploaded.bytes,
          uploaded.width || null,
          uploaded.height || null,
          uploaded.duration || null,
          req.user.id,
        ]
      );

      results.push(inserted.rows[0]);
    } catch (err) {
      console.error('Cloudinary upload failed:', err.message);
      failures.push({ filename: file.originalname, reason: 'Upload failed.' });
    }
  }

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'MEDIA_UPLOADED',
    details: `Uploaded ${results.length} file(s) (${quality}), ${failures.length} failed`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, uploaded: results, failed: failures });
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

module.exports = { uploadMedia, listMedia, deleteMedia, getDownloadUrl };
