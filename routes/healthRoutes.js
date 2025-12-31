const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Simple health check
router.get('/', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 0 = disconnected, 1 = connected
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    dbState,
    env: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
