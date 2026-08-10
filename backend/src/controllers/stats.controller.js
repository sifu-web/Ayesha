const db = require('../config/db');
const { cloudinary } = require('../config/cloudinary');

async function getDashboardStats(req, res) {
  const photoCountResult = await db.query("SELECT COUNT(*) AS c FROM media WHERE resource_type = 'image'");
  const videoCountResult = await db.query("SELECT COUNT(*) AS c FROM media WHERE resource_type = 'video'");
  const photoCount = Number(photoCountResult.rows[0].c);
  const videoCount = Number(videoCountResult.rows[0].c);
  const totalFiles = photoCount + videoCount;

  const usedBytesResult = await db.query('SELECT COALESCE(SUM(bytes), 0) AS total FROM media');
  const usedBytesDb = Number(usedBytesResult.rows[0].total);

  const totalStorage = Number(process.env.CLOUDINARY_PLAN_STORAGE_BYTES || 26843545600);
  let usedStorage = usedBytesDb;

  try {
    const usage = await cloudinary.api.usage();
    if (usage && typeof usage.storage?.usage === 'number') {
      usedStorage = usage.storage.usage;
    }
  } catch (err) {
    console.warn('Could not reach Cloudinary usage API, falling back to local totals:', err.message);
  }

  const availableStorage = Math.max(totalStorage - usedStorage, 0);
  const storagePercentage = totalStorage > 0 ? Math.min(100, (usedStorage / totalStorage) * 100) : 0;

  const userCountResult = await db.query('SELECT COUNT(*) AS c FROM users');
  const userCount = Number(userCountResult.rows[0].c);

  const recentActivityResult = await db.query(
    'SELECT action, username, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10'
  );

  res.json({
    success: true,
    stats: {
      totalStorage,
      usedStorage,
      availableStorage,
      storagePercentage: Number(storagePercentage.toFixed(2)),
      photoCount,
      videoCount,
      totalFiles,
      userCount,
    },
    recentActivity: recentActivityResult.rows,
  });
}

module.exports = { getDashboardStats };
