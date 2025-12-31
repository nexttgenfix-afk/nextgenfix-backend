const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { optionalAuth } = require('../middlewares/auth');
const { validateTableReservation } = require('../middlewares/validation');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Specific routes (must be before /:id to avoid conflicts)
router.post('/reserve', optionalAuth, validateTableReservation, tableController.reserveTable);
router.get('/reservations', optionalAuth, tableController.getUserReservations);
router.post('/bulk', verifyAdmin, tableController.bulkCreateTables);
router.get('/reservations/all', verifyAdmin, tableController.getAllReservations);
router.put('/reservations/:id', verifyAdmin, tableController.updateReservationStatus);

// Public routes
router.get('/', optionalAuth, tableController.getAvailableTables);
router.get('/:id', optionalAuth, tableController.getTableById);

// Admin routes
router.post('/', verifyAdmin, tableController.createTable);
router.put('/:id', verifyAdmin, tableController.updateTable);
router.delete('/:id', verifyAdmin, tableController.deleteTable);

module.exports = router;
