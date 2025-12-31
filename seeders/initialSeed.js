/**
 * NextGenFix - Database Seed Script
 * 
 * This script creates initial data for the NextGenFix application:
 * - Initial Super Admin user
 * - Default Settings
 * - Sample Categories
 * 
 * Run this script ONCE after setting up the database
 * 
 * Usage: node naanly-backend/seeders/initialSeed.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import models
const Admin = require('../models/adminModel');
const Settings = require('../models/settingsModel');
const Category = require('../models/categoryModel');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create initial super admin
const createSuperAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: 'admin@example.com' });
    
    if (existingAdmin) {
      console.log('ℹ️  Super admin already exists');
      return existingAdmin;
    }

    // Do not pre-hash here; the Admin model hashes password in pre-save middleware
    const plainPassword = 'admin123';

    const superAdmin = await Admin.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: plainPassword,
      role: 'super_admin',
      // Use the model helper to set the default permissions for super_admin
      permissions: Admin.getDefaultPermissions('super_admin'),
      isActive: true,
    });

    console.log('✅ Super admin created successfully');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('   ⚠️  IMPORTANT: Change password after first login!');
    
    return superAdmin;
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    throw error;
  }
};

// Create default settings
const createDefaultSettings = async () => {
  try {
    const existingSettings = await Settings.findOne();
    
    if (existingSettings) {
      console.log('ℹ️  Settings already exist');
      return existingSettings;
    }

    const defaultSettings = await Settings.create({
      // Business Hours - Default 11 AM to 10 PM
      businessHours: {
        dineIn: {
          monday: { open: '11:00', close: '22:00', isClosed: false },
          tuesday: { open: '11:00', close: '22:00', isClosed: false },
          wednesday: { open: '11:00', close: '22:00', isClosed: false },
          thursday: { open: '11:00', close: '22:00', isClosed: false },
          friday: { open: '11:00', close: '22:00', isClosed: false },
          saturday: { open: '11:00', close: '23:00', isClosed: false },
          sunday: { open: '11:00', close: '23:00', isClosed: false },
        },
        delivery: {
          monday: { open: '11:00', close: '21:00', isClosed: false },
          tuesday: { open: '11:00', close: '21:00', isClosed: false },
          wednesday: { open: '11:00', close: '21:00', isClosed: false },
          thursday: { open: '11:00', close: '21:00', isClosed: false },
          friday: { open: '11:00', close: '22:00', isClosed: false },
          saturday: { open: '11:00', close: '22:00', isClosed: false },
          sunday: { open: '11:00', close: '22:00', isClosed: false },
        },
      },
      
      // Tax Configuration
      tax: {
        gstRate: 5, // 5% GST
        isInclusive: false, // Tax added on top
      },
      
      // Delivery Charges - Default flat rate
      deliveryCharges: {
        type: 'flat',
        flatRate: 50,
        freeDeliveryThreshold: 500,
        perKmRate: 0,
        baseCharge: 0,
        maxDistance: 10,
      },
      
      // Tier System - Default values
      tierSystem: {
        bronze: {
          requiredOrders: 0,
          discount: 2,
        },
        silver: {
          requiredOrders: 10,
          discount: 5,
        },
        gold: {
          requiredOrders: 25,
          discount: 10,
        },
      },
      
      // Referral Rewards
      referralRewards: {
        referrerDiscount: 10,
        referrerDiscountType: 'percentage',
        referredDiscount: 10,
        referredDiscountType: 'percentage',
        maxReferrals: 0, // Unlimited
        validityDays: 30,
      },
      
      // Scheduling
      scheduling: {
        maxAdvanceDays: 30,
        timeSlotDuration: 30, // 30 minutes
        minAdvanceHours: 2,
        timeSlots: [], // Custom slots (empty = use duration)
      },
      
      // Table Reservation
      tableReservation: {
        enabled: true,
        maxReservationDays: 30,
        minDuration: 60,
        maxDuration: 180,
        defaultDuration: 90,
      },
    });

    console.log('✅ Default settings created successfully');
    return defaultSettings;
  } catch (error) {
    console.error('❌ Error creating default settings:', error);
    throw error;
  }
};

// Create sample categories
const createSampleCategories = async () => {
  try {
    const existingCategories = await Category.find();
    
    if (existingCategories.length > 0) {
      console.log('ℹ️  Categories already exist');
      return existingCategories;
    }

    // Ensure there's at least one restaurant to attach categories to
    const Restaurant = require('../models/restaurantModel');
    let restaurant = await Restaurant.findOne();
    if (!restaurant) {
      restaurant = await Restaurant.create({
        name: 'Default Restaurant',
        cuisines: ['Indian'],
        isVegOnly: false,
        eatingPreference: 'non-vegetarian',
        location: { type: 'Point', coordinates: [0, 0] }
      });
    }

    const categories = [
      {
        name: 'Main Course',
        description: 'Hearty meals and main dishes',
        displayOrder: 1,
        isActive: true,
        restaurantId: restaurant._id
      },
      {
        name: 'Appetizers',
        description: 'Starters and light bites',
        displayOrder: 2,
        isActive: true,
        restaurantId: restaurant._id
      },
      {
        name: 'Beverages',
        description: 'Drinks and refreshments',
        displayOrder: 3,
        isActive: true,
        restaurantId: restaurant._id
      },
      {
        name: 'Desserts',
        description: 'Sweet treats and desserts',
        displayOrder: 4,
        isActive: true,
        restaurantId: restaurant._id
      },
    ];

    const createdCategories = await Category.insertMany(categories);
    console.log('✅ Sample categories created successfully');
    console.log(`   Created ${createdCategories.length} categories`);
    
    return createdCategories;
  } catch (error) {
    console.error('❌ Error creating sample categories:', error);
    throw error;
  }
};

// Main seed function
const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    await connectDB();
    
    await createSuperAdmin();
    console.log('');
    
    await createDefaultSettings();
    console.log('');
    
    await createSampleCategories();
    console.log('');
    
    console.log('✅ Database seeding completed successfully!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Login to admin panel with admin@example.com / admin123');
    console.log('   2. Change the default password immediately');
    console.log('   3. Configure business settings through the admin dashboard');
    console.log('   4. Add menu items');
    console.log('   5. Configure tables for dine-in\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run the seed script
seedDatabase();
