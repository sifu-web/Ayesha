const express = require('express');
const { getUploadSignature, confirmMedia, listMedia, deleteMedia, getDownloadUrl } = require('../controllers/media.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All media routes require authentication.
router.use(verifyToken);

router.get('/', listMedia);

// Upload (signature + confirm), delete, and download are administrator-only.
// The actual file bytes go straight from the browser to Cloudinary — see
// media.controller.js for why.
router.get('/:id/download', requireAdmin, getDownloadUrl);
router.post('/upload-signature', requireAdmin, uploadLimiter, getUploadSignature);
router.post('/confirm', requireAdmin, uploadLimiter, confirmMedia);
router.delete('/:id', requireAdmin, deleteMedia);

module.exports = router;
