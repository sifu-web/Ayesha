const express = require('express');
const { body } = require('express-validator');
const { login, logout, me, changePassword, keyLogin, clearSession } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required.').escape(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

router.post(
  '/key-login',
  authLimiter,
  [body('key').trim().notEmpty().withMessage('Access key is required.')],
  validate,
  keyLogin
);

router.post('/logout', verifyToken, logout);
router.post('/clear-session', clearSession);
router.get('/me', verifyToken, me);

router.post(
  '/change-password',
  verifyToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
      .isLength({ min: 4 })
      .withMessage('New password must be at least 4 characters long.'),
  ],
  validate,
  changePassword
);

module.exports = router;
