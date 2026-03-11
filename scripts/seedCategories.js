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
      await Category.create(cat);
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
