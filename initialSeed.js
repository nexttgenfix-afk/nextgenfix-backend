const mongoose = require('mongoose');
const Admin = require('./models/adminModel');
const Settings = require('./models/settingsModel');
const User = require('./models/userModel');
const Category = require('./models/categoryModel');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    // Check if MongoDB URI is available and not a placeholder
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB;
    if (!uri || uri.includes('username:password') || uri.includes('your-project-id')) {
      console.log('No valid MongoDB URI provided. Skipping database seeding (running in mock mode).');
      console.log('To seed the database, set a valid MONGODB_URI in your .env file');
      return;
    }

    // Connect to MongoDB
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Seed admin user
    const adminExists = await Admin.findOne({ email: 'admin@naanly.com' });
    if (!adminExists) {
      // Let model pre-save hook hash the password
      const admin = await Admin.create({
        name: 'Super Admin',
        email: 'admin@naanly.com',
        password: 'admin123',
        permissions: Admin.getDefaultPermissions('super_admin'),
        role: 'super_admin'
      });

      console.log('Admin user created:', admin.email);
    } else {
      console.log('Admin user already exists');
    }

    // Seed default settings
    const settingsExists = await Settings.findOne();
    if (!settingsExists) {
      const settings = await Settings.create({
        businessHours: {
          monday: { open: '09:00', close: '22:00', isOpen: true },
          tuesday: { open: '09:00', close: '22:00', isOpen: true },
          wednesday: { open: '09:00', close: '22:00', isOpen: true },
          thursday: { open: '09:00', close: '22:00', isOpen: true },
          friday: { open: '09:00', close: '22:00', isOpen: true },
          saturday: { open: '09:00', close: '22:00', isOpen: true },
          sunday: { open: '09:00', close: '22:00', isOpen: true }
        },
        tax: {
          cgst: 2.5,
          sgst: 2.5,
          serviceCharge: 0
        },
        deliveryCharges: {
          baseDeliveryFee: 40,
          freeDeliveryThreshold: 300,
          extraFeePerKm: 10
        },
        tierConfig: [
          {
            name: 'Bronze',
            minSpend: 0,
            benefits: ['Basic support', 'Standard delivery'],
            discount: 0
          },
          {
            name: 'Silver',
            minSpend: 1000,
            benefits: ['Priority support', 'Free delivery on orders above ₹200', '5% discount'],
            discount: 5,
            nextTier: 'Gold'
          },
          {
            name: 'Gold',
            minSpend: 5000,
            benefits: ['VIP support', 'Free delivery', '10% discount', 'Exclusive offers'],
            discount: 10,
            // No next tier
          },
          
        ],
        referralConfig: {
          referrerBonus: 100,
          refereeBonus: 50,
          maxReferrals: 50
        },
        schedulingConfig: {
          advanceBookingDays: 7,
          slotDuration: 30,
          operatingHours: { start: '09:00', end: '22:00' }
        }
      });

      console.log('Default settings created');
    } else {
      console.log('Settings already exist');
    }

    // Seed default categories
    const categoriesExist = await Category.findOne();
    if (!categoriesExist) {
      const categories = await Category.insertMany([
        {
          name: 'Main Course',
          description: 'Delicious main course dishes',
          order: 1,
          isActive: true
        },
        {
          name: 'Appetizers',
          description: 'Tasty starters and appetizers',
          order: 2,
          isActive: true
        },
        {
          name: 'Desserts',
          description: 'Sweet treats and desserts',
          order: 3,
          isActive: true
        },
        {
          name: 'Beverages',
          description: 'Refreshing drinks and beverages',
          order: 4,
          isActive: true
        },
        {
          name: 'Snacks',
          description: 'Quick bites and snacks',
          order: 5,
          isActive: true
        }
      ]);

      console.log('Default categories created:', categories.length);
    } else {
      console.log('Categories already exist');
    }

    // Seed demo user
    const demoUserExists = await User.findOne({ email: 'demo@naanly.com' });
    if (!demoUserExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('demo123', salt);

      const referralCode = `REF${Date.now()}DEMO`;

      const demoUser = await User.create({
        name: 'Demo User',
        email: 'demo@naanly.com',
        phone: '+919876543210',
        password: hashedPassword,
        referralCode,
        isPhoneVerified: true,
        preferences: {
          dietaryRestrictions: [],
          favoriteCuisines: ['Indian', 'Chinese'],
          spiceLevel: 'medium'
        }
      });

      console.log('Demo user created:', demoUser.email);
    } else {
      console.log('Demo user already exists');
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error.message);
    console.log('Make sure your MongoDB URI is correct and accessible');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }
  }
};

// Run seeder if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };