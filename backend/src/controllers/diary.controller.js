const db = require('../config/db');
const { cloudinary, FOLDER } = require('../config/cloudinary');
const { logAction } = require('../utils/audit');

// Voice notes live in their own Cloudinary subfolder, separate from the
// photo/video gallery, so they never show up mixed into the media counts.
const VOICE_FOLDER = `${FOLDER}/diary-voice`;

async function listDiary(req, res) {
  const { search = '', page = 1, limit = 20 } = req.query;

  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = 'WHERE title ILIKE $1 OR content ILIKE $1';
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const totalResult = await db.query(`SELECT COUNT(*) AS count FROM diary_entries ${where}`, params);
  const total = Number(totalResult.rows[0].count);

  const itemsResult = await db.query(
    `SELECT * FROM diary_entries ${where}
     ORDER BY entry_date DESC, created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limitNum, offset]
  );

  res.json({
    success: true,
    items: itemsResult.rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: offset + itemsResult.rows.length < total,
    },
  });
}

async function getDiaryEntry(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM diary_entries WHERE id = $1', [id]);
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Entry not found.' });
  res.json({ success: true, entry: result.rows[0] });
}

/** Re-fetches a voice note from Cloudinary's Admin API rather than trusting client-supplied data. */
async function resolveVoice(voicePublicId) {
  if (!voicePublicId) return { voice_url: null, voice_public_id: null, voice_duration: null };

  let resource;
  try {
    resource = await cloudinary.api.resource(voicePublicId, { resource_type: 'video' });
  } catch (err) {
    throw Object.assign(new Error('Could not verify the voice note with Cloudinary.'), { status: 404 });
  }

  if (!resource.public_id.startsWith(`${VOICE_FOLDER}/`)) {
    throw Object.assign(new Error('That voice note is not in the expected folder.'), { status: 403 });
  }

  return {
    voice_url: resource.secure_url,
    voice_public_id: resource.public_id,
    voice_duration: resource.duration || null,
  };
}

async function createDiary(req, res) {
  const { title, content = '', entryDate, color = '#FF4D7D', textColor = '#FFFFFF', voicePublicId } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required.' });
  }

  const voice = await resolveVoice(voicePublicId);

  const inserted = await db.query(
    `INSERT INTO diary_entries
      (title, content, entry_date, color, text_color, voice_url, voice_public_id, voice_duration, created_by)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      title.trim(),
      content,
      entryDate || null,
      color,
      textColor,
      voice.voice_url,
      voice.voice_public_id,
      voice.voice_duration,
      req.user.id,
    ]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DIARY_CREATED',
    details: `Created diary entry "${title.trim()}"`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, entry: inserted.rows[0] });
}

async function updateDiary(req, res) {
  const { id } = req.params;
  const existing = await db.query('SELECT * FROM diary_entries WHERE id = $1', [id]);
  const current = existing.rows[0];
  if (!current) return res.status(404).json({ success: false, message: 'Entry not found.' });

  const { title, content, entryDate, color, textColor, voicePublicId, removeVoice } = req.body;

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
  }

  let voiceFields = {
    voice_url: current.voice_url,
    voice_public_id: current.voice_public_id,
    voice_duration: current.voice_duration,
  };

  if (removeVoice && current.voice_public_id) {
    try {
      await cloudinary.uploader.destroy(current.voice_public_id, { resource_type: 'video' });
    } catch (err) {
      console.error('Voice delete failed:', err.message);
    }
    voiceFields = { voice_url: null, voice_public_id: null, voice_duration: null };
  } else if (voicePublicId && voicePublicId !== current.voice_public_id) {
    if (current.voice_public_id) {
      try {
        await cloudinary.uploader.destroy(current.voice_public_id, { resource_type: 'video' });
      } catch (err) {
        console.error('Voice delete failed:', err.message);
      }
    }
    voiceFields = await resolveVoice(voicePublicId);
  }

  const updated = await db.query(
    `UPDATE diary_entries SET
      title = $1, content = $2, entry_date = $3, color = $4, text_color = $5,
      voice_url = $6, voice_public_id = $7, voice_duration = $8, updated_at = now()
     WHERE id = $9
     RETURNING *`,
    [
      title !== undefined ? title.trim() : current.title,
      content !== undefined ? content : current.content,
      entryDate || current.entry_date,
      color || current.color,
      textColor || current.text_color,
      voiceFields.voice_url,
      voiceFields.voice_public_id,
      voiceFields.voice_duration,
      id,
    ]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DIARY_UPDATED',
    details: `Updated diary entry "${updated.rows[0].title}"`,
    ip: req.ip,
  });

  res.json({ success: true, entry: updated.rows[0] });
}

async function deleteDiary(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM diary_entries WHERE id = $1', [id]);
  const entry = result.rows[0];
  if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.' });

  if (entry.voice_public_id) {
    try {
      await cloudinary.uploader.destroy(entry.voice_public_id, { resource_type: 'video' });
    } catch (err) {
      console.error('Voice delete failed:', err.message);
    }
  }

  await db.query('DELETE FROM diary_entries WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'DIARY_DELETED',
    details: `Deleted diary entry "${entry.title}"`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Entry deleted successfully.' });
}

/** Same direct-to-Cloudinary signed-upload pattern as media uploads, scoped to the voice-note subfolder. */
async function getVoiceUploadSignature(req, res) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: VOICE_FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.json({
    success: true,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: VOICE_FOLDER,
  });
}

module.exports = {
  listDiary,
  getDiaryEntry,
  createDiary,
  updateDiary,
  deleteDiary,
  getVoiceUploadSignature,
};
