/**
 * Script to add database indexes for optimal analytics query performance
 * Run this script once to create all necessary indexes
 * 
 * Usage: node scripts/addAnalyticsIndexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const MenuItem = require('../models/menuItemModel');
const SessionAnalytics = require('../models/sessionAnalyticsModel');
const ProductAnalytics = require('../models/productAnalyticsModel');
const KPICache = require('../models/kpiCacheModel');

const addIndexes = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // ==================== USER COLLECTION ====================
    console.log('📊 Adding User collection indexes...');
    
    await User.collection.createIndex({ createdAt: -1 });
    console.log('  ✓ Created index: { createdAt: -1 }');
    
    await User.collection.createIndex({ gender: 1, ageGroup: 1 });
    console.log('  ✓ Created index: { gender: 1, ageGroup: 1 }');
    
    await User.collection.createIndex({ 'location.city': 1 });
    console.log('  ✓ Created index: { location.city: 1 }');
    
    await User.collection.createIndex({ deviceType: 1, preferredLoginMethod: 1 });
    console.log('  ✓ Created index: { deviceType: 1, preferredLoginMethod: 1 }');
    
    await User.collection.createIndex({ tier: 1 });
    console.log('  ✓ Created index: { tier: 1 }');
    
    await User.collection.createIndex({ lastLogin: -1 });
    console.log('  ✓ Created index: { lastLogin: -1 }');

    // ==================== ORDER COLLECTION ====================
    console.log('\n📊 Adding Order collection indexes...');
    
    await Order.collection.createIndex({ createdAt: -1 });
    console.log('  ✓ Created index: { createdAt: -1 }');
    
    await Order.collection.createIndex({ user: 1, createdAt: -1 });
    console.log('  ✓ Created index: { user: 1, createdAt: -1 }');
    
    await Order.collection.createIndex({ status: 1, createdAt: -1 });
    console.log('  ✓ Created index: { status: 1, createdAt: -1 }');
    
    await Order.collection.createIndex({ dayPart: 1, createdAt: -1 });
    console.log('  ✓ Created index: { dayPart: 1, createdAt: -1 }');
    
    await Order.collection.createIndex({ orderType: 1 });
    console.log('  ✓ Created index: { orderType: 1 }');
    
    await Order.collection.createIndex({ 'billing.totalAmount': -1 });
    console.log('  ✓ Created index: { billing.totalAmount: -1 }');
    
    await Order.collection.createIndex({ user: 1, status: 1 });
    console.log('  ✓ Created index: { user: 1, status: 1 }');

    // ==================== CART COLLECTION ====================
    console.log('\n📊 Adding Cart collection indexes...');
    
    await Cart.collection.createIndex({ user: 1, status: 1 });
    console.log('  ✓ Created index: { user: 1, status: 1 }');
    
    await Cart.collection.createIndex({ status: 1, abandonedAt: -1 });
    console.log('  ✓ Created index: { status: 1, abandonedAt: -1 }');
    
    await Cart.collection.createIndex({ createdAt: -1 });
    console.log('  ✓ Created index: { createdAt: -1 }');
    
    await Cart.collection.createIndex({ convertedToOrder: 1 });
    console.log('  ✓ Created index: { convertedToOrder: 1 }');

    // ==================== MENU ITEM COLLECTION ====================
    console.log('\n📊 Adding MenuItem collection indexes...');
    
    await MenuItem.collection.createIndex({ category: 1 });
    console.log('  ✓ Created index: { category: 1 }');
    
    await MenuItem.collection.createIndex({ isAvailable: 1 });
    console.log('  ✓ Created index: { isAvailable: 1 }');
    
    await MenuItem.collection.createIndex({ price: 1 });
    console.log('  ✓ Created index: { price: 1 }');
    
    await MenuItem.collection.createIndex({ 'nutritionInfo.tags': 1 });
    console.log('  ✓ Created index: { nutritionInfo.tags: 1 }');

    // ==================== SESSION ANALYTICS COLLECTION ====================
    console.log('\n📊 Adding SessionAnalytics collection indexes...');
    
    await SessionAnalytics.collection.createIndex({ userId: 1, startTime: -1 });
    console.log('  ✓ Created index: { userId: 1, startTime: -1 }');
    
    await SessionAnalytics.collection.createIndex({ sessionId: 1 });
    console.log('  ✓ Created index: { sessionId: 1 }');
    
    await SessionAnalytics.collection.createIndex({ deviceType: 1, startTime: -1 });
    console.log('  ✓ Created index: { deviceType: 1, startTime: -1 }');
    
    await SessionAnalytics.collection.createIndex({ loginMethod: 1, startTime: -1 });
    console.log('  ✓ Created index: { loginMethod: 1, startTime: -1 }');
    
    await SessionAnalytics.collection.createIndex({ startTime: -1 });
    console.log('  ✓ Created index: { startTime: -1 }');

    // ==================== PRODUCT ANALYTICS COLLECTION ====================
    console.log('\n📊 Adding ProductAnalytics collection indexes...');
    
    await ProductAnalytics.collection.createIndex({ productId: 1 });
    console.log('  ✓ Created index: { productId: 1 }');
    
    await ProductAnalytics.collection.createIndex({ category: 1 });
    console.log('  ✓ Created index: { category: 1 }');
    
    await ProductAnalytics.collection.createIndex({ purchases: -1 });
    console.log('  ✓ Created index: { purchases: -1 }');
    
    await ProductAnalytics.collection.createIndex({ totalRevenue: -1 });
    console.log('  ✓ Created index: { totalRevenue: -1 }');
    
    await ProductAnalytics.collection.createIndex({ views: -1 });
    console.log('  ✓ Created index: { views: -1 }');

    // ==================== KPI CACHE COLLECTION ====================
    console.log('\n📊 Adding KPICache collection indexes...');
    
    await KPICache.collection.createIndex({ metricKey: 1 });
    console.log('  ✓ Created index: { metricKey: 1 }');
    
    await KPICache.collection.createIndex({ metricName: 1 });
    console.log('  ✓ Created index: { metricName: 1 }');
    
    await KPICache.collection.createIndex({ validUntil: 1 });
    console.log('  ✓ Created index: { validUntil: 1 }');
    
    await KPICache.collection.createIndex({ calculatedAt: -1 });
    console.log('  ✓ Created index: { calculatedAt: -1 }');
    
    await KPICache.collection.createIndex({ isValid: 1, validUntil: 1 });
    console.log('  ✓ Created index: { isValid: 1, validUntil: 1 }');

    // ==================== COMPOUND INDEXES FOR COMPLEX QUERIES ====================
    console.log('\n📊 Adding compound indexes for complex analytics queries...');
    
    // Order analytics compound indexes
    await Order.collection.createIndex({ status: 1, createdAt: -1, user: 1 });
    console.log('  ✓ Created compound index: { status: 1, createdAt: -1, user: 1 }');
    
    await Order.collection.createIndex({ dayPart: 1, orderType: 1, createdAt: -1 });
    console.log('  ✓ Created compound index: { dayPart: 1, orderType: 1, createdAt: -1 }');
    
    // User analytics compound indexes
    await User.collection.createIndex({ gender: 1, tier: 1, createdAt: -1 });
    console.log('  ✓ Created compound index: { gender: 1, tier: 1, createdAt: -1 }');
    
    console.log('\n✅ All indexes created successfully!');
    console.log('\n📈 Verifying indexes...');
    
    // List all indexes for verification
    const userIndexes = await User.collection.indexes();
    const orderIndexes = await Order.collection.indexes();
    const cartIndexes = await Cart.collection.indexes();
    
    console.log(`\n📊 User Collection Indexes: ${userIndexes.length}`);
    console.log(`📊 Order Collection Indexes: ${orderIndexes.length}`);
    console.log(`📊 Cart Collection Indexes: ${cartIndexes.length}`);
    
    console.log('\n✨ Index creation complete! Your analytics queries will now be much faster.\n');
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
addIndexes();
