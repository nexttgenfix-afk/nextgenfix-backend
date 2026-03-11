const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { requireAuth } = require('../middlewares/unifiedAuth');

router.get('/summary', requireAuth, nutritionController.getSummary);
router.get('/goals', requireAuth, nutritionController.getGoals);
router.put('/goals', requireAuth, nutritionController.updateGoals);

module.exports = router;
