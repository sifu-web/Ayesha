const express = require('express');
const { getDashboardStats } = require('../controllers/stats.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, requireAdmin, getDashboardStats);

module.exports = router;
