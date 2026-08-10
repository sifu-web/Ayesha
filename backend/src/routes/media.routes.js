const express = require('express');
const multer = require('multer');
const { uploadMedia, listMedia, deleteMedia, getDownloadUrl } = require('../controllers/media.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB per file ceiling (Cloudinary plan limits still apply)
    files: 100,
  },
  fileFilter: (req, file, cb) => {
    const allowed = /^(image|video)\//;
    if (!allowed.test(file.mimetype)) {
      return cb(new Error('Only image and video files are allowed.'));
    }
    cb(null, true);
  },
});

// All media routes require authentication.
router.use(verifyToken);

router.get('/', listMedia);

// Upload, delete, and download are administrator-only.
router.get('/:id/download', requireAdmin, getDownloadUrl);
router.post('/upload', requireAdmin, uploadLimiter, upload.array('files', 100), uploadMedia);
router.delete('/:id', requireAdmin, deleteMedia);

module.exports = router;
