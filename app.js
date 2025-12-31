const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');

// Import middleware
const { errorHandler } = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimiter');

// Import routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const menuRoutes = require('./routes/menuRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const homeRoutes = require('./routes/homeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const promoCodeRoutes = require('./routes/promoCodeRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const tableRoutes = require('./routes/tableRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const healthRoutes = require('./routes/healthRoutes');
const comboRoutes = require('./routes/comboRoutes');
const couponRoutes = require('./routes/couponRoutes');
const dotenv = require('dotenv');

require('dotenv').config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g., mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
}));

// Rate limiting
app.use(generalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Increase timeout for file uploads (2 minutes)
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000); // 2 minutes
  next();
});

// API Routes
// Health check (no auth required)
app.use('/api/health', healthRoutes);

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/coupons', couponRoutes);

// Protected routes (require authentication)
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tables', tableRoutes);

// Admin routes (require admin authentication)
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Note: uploads are served from Cloudinary; do not serve local 'uploads' directory
// (previously: app.use('/uploads', express.static('uploads')))

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Naanly API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Get port from environment or use default
const PORT = process.env.PORT || 5000;

// Setup cron jobs
const { cleanupGuests } = require('./utils/guestCleanup');
cron.schedule('0 2 * * *', cleanupGuests); // Daily at 2 AM
console.log('🧹 Guest cleanup cron job scheduled (daily at 2 AM)');

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Naanly API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;