const express = require('express');
const {
  listDiary,
  getDiaryEntry,
  createDiary,
  updateDiary,
  deleteDiary,
  getVoiceUploadSignature,
} = require('../controllers/diary.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// The diary is private — every route requires an authenticated administrator.
router.use(verifyToken);
router.use(requireAdmin);

router.get('/', listDiary);
router.get('/:id', getDiaryEntry);
router.post('/', createDiary);
router.put('/:id', updateDiary);
router.delete('/:id', deleteDiary);
router.post('/voice-upload-signature', uploadLimiter, getVoiceUploadSignature);

module.exports = router;
