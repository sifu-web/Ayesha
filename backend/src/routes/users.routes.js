const express = require('express');
const { body } = require('express-validator');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/users.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/', listUsers);

router.post(
  '/',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters.').escape(),
    body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters.'),
    body('role').isIn(['admin', 'user']).withMessage('Role must be admin or user.'),
  ],
  validate,
  createUser
);

router.put(
  '/:id',
  [
    body('username').optional().trim().isLength({ min: 3, max: 30 }).escape(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 4 }),
    body('role').optional().isIn(['admin', 'user']),
  ],
  validate,
  updateUser
);

router.delete('/:id', deleteUser);

module.exports = router;
