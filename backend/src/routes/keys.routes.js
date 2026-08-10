const express = require('express');
const { body } = require('express-validator');
const { generateKey, listKeys, deleteKey } = require('../controllers/keys.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Every key route is administrator-only.
router.use(verifyToken, requireAdmin);

router.get('/', listKeys);

router.post(
  '/',
  [
    body('durationType')
      .isIn(['one_time', '1_hour', '1_day', '1_week', '1_month'])
      .withMessage('durationType must be one of: one_time, 1_hour, 1_day, 1_week, 1_month.'),
  ],
  validate,
  generateKey
);

router.delete('/:id', deleteKey);

module.exports = router;
