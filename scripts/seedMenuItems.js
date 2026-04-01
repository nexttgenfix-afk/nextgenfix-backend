/**
 * Seed script to add sample menu items across all categories.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const MenuItem = require('../models/menuItemModel');
const Category = require('../models/categoryModel');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const menuItems = [
  {
    categoryName: 'Balanced AF',
    item: {
      name: 'Grilled Chicken Quinoa Bowl',
      description: { text: 'Juicy grilled chicken over fluffy quinoa with roasted veggies.' },
      price: 299,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      cuisine: 'Continental',
      isVeg: false,
      tags: ['high-protein'],
      keyIngredients: ['Chicken Breast', 'Quinoa'],
      preparationTime: 20,
      status: 'Available',
      isAvailable: true
    }
  },
  {
    categoryName: 'Desi AF',
    subcategoryName: 'Tikka Section',
    item: {
      name: 'Paneer Tikka Angara',
      description: { text: 'Spicy and smoky cottage cheese cubes marinated in a fiery blend of chillies.' },
      price: 249,
      image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['spicy', 'tandoor'],
      keyIngredients: ['Paneer', 'Yogurt'],
      preparationTime: 25,
      status: 'Available',
      isAvailable: true
    }
  },
  {
    categoryName: 'Desi AF',
    subcategoryName: 'Bread Winners',
    item: {
      name: 'Garlic Butter Naan',
      description: { text: 'Soft tandoori bread topped with fresh garlic and plenty of melted butter.' },
      price: 60,
      image: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['bread'],
      keyIngredients: ['Refined Flour', 'Garlic'],
      preparationTime: 10,
      status: 'Available',
      isAvailable: true
    }
  }
];

async function seed() {
  await connectDB();
  let added = 0;
  let skipped = 0;

  for (const entry of menuItems) {
    const exists = await MenuItem.findOne({ name: entry.item.name });
    if (exists) {
      console.log(`⏭  Skipping: ${entry.item.name}`);
      skipped++;
      continue;
    }

    const category = await Category.findOne({ name: entry.categoryName });
    if (!category) {
      console.warn(`⚠️  Category ${entry.categoryName} not found.`);
      continue;
    }

    const itemData = { ...entry.item, category: category._id };

    if (entry.subcategoryName) {
      const sub = await Category.findOne({ name: entry.subcategoryName, parentCategory: category._id });
      if (sub) itemData.subcategory = sub._id;
    }

    await MenuItem.create(itemData);
    console.log(`✅ Created: ${entry.item.name}`);
    added++;
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
