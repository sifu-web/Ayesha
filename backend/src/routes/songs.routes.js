const express = require('express');
const {
  getUploadSignature,
  confirmSong,
  listSongs,
  renameSong,
  deleteSong,
} = require('../controllers/songs.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Songs & voice recordings are private — same access level as the diary.
router.use(verifyToken);
router.use(requireAdmin);

router.get('/', listSongs);
router.post('/upload-signature', uploadLimiter, getUploadSignature);
router.post('/confirm', uploadLimiter, confirmSong);
router.put('/:id', renameSong);
router.delete('/:id', deleteSong);

module.exports = router;
