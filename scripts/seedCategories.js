/**
 * Seed script to add menu categories shown in the Explore Menu screen.
 *
 * Run with: node scripts/seedCategories.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/categoryModel');

const categories = [
  {
    name: 'Balanced AF',
    description: 'Nutritious, well-balanced meals for a healthy lifestyle',
    displayOrder: 1,
    isActive: true
  },
  {
    name: 'Appeteasers',
    description: 'Starters and small bites to kick things off',
    displayOrder: 2,
    isActive: true
  },
  {
    name: 'Desi AF',
    description: 'Bold Indian flavours done right',
    displayOrder: 3,
    isActive: true
  },
  // --- Subcategories for Desi AF ---
  {
    name: 'Tikka Section',
    description: 'Grilled and tandoori starters',
    parentCategory: 'Desi AF',
    displayOrder: 1,
    isActive: true
  },
  {
    name: 'Bread Winners',
    description: 'Assorted Indian breads',
    parentCategory: 'Desi AF',
    displayOrder: 2,
    isActive: true
  },
  {
    name: 'Mood for makahni',
    description: 'Creamy and rich gravies',
    parentCategory: 'Desi AF',
    displayOrder: 3,
    isActive: true
  },
  {
    name: 'One Grain Wonder',
    description: 'Rice and biryani specialties',
    parentCategory: 'Desi AF',
    displayOrder: 4,
    isActive: true
  },
  {
    name: 'Condiments',
    description: 'Sides and accompaniments',
    parentCategory: 'Desi AF',
    displayOrder: 5,
    isActive: true
  },
  {
    name: 'But Serious',
    description: 'Main course specialties',
    parentCategory: 'Desi AF',
    displayOrder: 6,
    isActive: true
  },
  {
    name: 'Lowkey Sweet',
    description: 'Desserts and sweet treats for a subtle indulgence',
    displayOrder: 4,
    isActive: true
  },
  {
    name: 'H2-Oh Nice!',
    description: 'Refreshing beverages and drinks',
    displayOrder: 5,
    isActive: true
  },
  {
    name: 'Beta Taste v1.0',
    description: 'New experimental items — try before everyone else',
    displayOrder: 6,
    isActive: true
  }
];

async function seed() {
  await connectDB();

  let added = 0;
  let skipped = 0;

  for (const cat of categories) {
    const exists = await Category.findOne({ name: cat.name });
    if (exists) {
      console.log(`⏭  Skipping (already exists): ${cat.name}`);
      skipped++;
    } else {
      const catData = { ...cat };
      
      // Resolve parentCategory if it exists by name reference
      if (cat.parentCategory) {
        const parent = await Category.findOne({ name: cat.parentCategory });
        if (parent) {
          catData.parentCategory = parent._id;
        } else {
          console.warn(`⚠️  Parent category "${cat.parentCategory}" not found for "${cat.name}"`);
          delete catData.parentCategory;
        }
      }

      await Category.create(catData);
      console.log(`✅ Created: ${cat.name}`);
      added++;
    }
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
