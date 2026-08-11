const express = require('express');
const {
  getUploadSignature,
  confirmDocument,
  listDocuments,
  renameDocument,
  deleteDocument,
  getDownloadUrl,
} = require('../controllers/documents.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Documents are private — same access level as the diary and songs.
router.use(verifyToken);
router.use(requireAdmin);

router.get('/', listDocuments);
router.get('/:id/download', getDownloadUrl);
router.post('/upload-signature', uploadLimiter, getUploadSignature);
router.post('/confirm', uploadLimiter, confirmDocument);
router.put('/:id', renameDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
