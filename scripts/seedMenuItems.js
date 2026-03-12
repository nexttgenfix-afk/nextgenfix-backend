/**
 * Seed script to add sample menu items across all categories.
 *
 * Run with: node scripts/seedMenuItems.js
 *
 * NOTE: Run seedCategories.js first to ensure categories exist.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const MenuItem = require('../models/menuItemModel');
const Category = require('../models/categoryModel');

const menuItems = [
  // ── Balanced AF ─────────────────────────────────────────────────────────────
  {
    categoryName: 'Balanced AF',
    item: {
      name: 'Grilled Chicken Quinoa Bowl',
      description: { text: 'Juicy grilled chicken over fluffy quinoa with roasted veggies and a lemon-herb drizzle. Clean fuel that actually tastes good.' },
      price: 299,
      discountedPrice: 269,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      cuisine: 'Continental',
      isVeg: false,
      tags: ['high-protein', 'low-carb', 'gluten-free'],
      keyIngredients: ['Chicken Breast', 'Quinoa', 'Bell Peppers', 'Zucchini', 'Lemon', 'Olive Oil'],
      allergens: [],
      badge: 'Healthiest',
      moodTag: 'locked_in',
      hungerLevelTag: 'quite_hungry',
      preparationTime: 20,
      nutritionInfo: { calories: 420, protein: 38, carbs: 32, fat: 12, fiber: 6, sugar: 4, servingSize: '1 bowl (380g)' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Extra Chicken', price: 80, isVeg: false },
          { name: 'Avocado Slice', price: 60, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'Balanced AF',
    item: {
      name: 'Paneer & Chickpea Power Bowl',
      description: { text: 'Spiced paneer cubes with protein-packed chickpeas, brown rice, cucumber raita and a mint chutney drizzle.' },
      price: 259,
      image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['vegetarian', 'high-protein', 'balanced'],
      keyIngredients: ['Paneer', 'Chickpeas', 'Brown Rice', 'Cucumber', 'Mint'],
      allergens: ['Dairy'],
      badge: 'Recommended',
      moodTag: 'need_a_hug',
      hungerLevelTag: 'quite_hungry',
      preparationTime: 18,
      nutritionInfo: { calories: 380, protein: 22, carbs: 45, fat: 11, fiber: 8, sugar: 5, servingSize: '1 bowl (350g)' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Paneer', price: 50, isVeg: true },
          { name: 'Brown Rice Upgrade', price: 20, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  },

  // ── Appeteasers ──────────────────────────────────────────────────────────────
  {
    categoryName: 'Appeteasers',
    item: {
      name: 'Crispy Corn Chaat',
      description: { text: 'Golden fried corn kernels tossed with tangy tamarind, crunchy onions, green chilli and a squeeze of lime. Street food vibes at their best.' },
      price: 149,
      image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['snack', 'street-food', 'vegan'],
      keyIngredients: ['Sweet Corn', 'Tamarind', 'Green Chilli', 'Onion', 'Lime'],
      allergens: [],
      badge: 'Bestseller',
      moodTag: 'burnt_tf_out',
      hungerLevelTag: 'little_hungry',
      preparationTime: 10,
      nutritionInfo: { calories: 210, protein: 4, carbs: 38, fat: 6, fiber: 3, sugar: 8, servingSize: '1 plate (150g)' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Tamarind Chutney', price: 15, isVeg: true },
          { name: 'Sev Topping', price: 20, isVeg: true }
        ],
        needsCutlery: false
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'Appeteasers',
    item: {
      name: 'Chicken Seekh Bites',
      description: { text: 'Minced chicken seekh kabab bites straight off the grill, served with green chutney and sliced onions. Small but mighty.' },
      price: 199,
      image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',
      cuisine: 'Indian',
      isVeg: false,
      tags: ['starter', 'grilled', 'high-protein'],
      keyIngredients: ['Minced Chicken', 'Ginger', 'Garlic', 'Green Chilli', 'Coriander'],
      allergens: [],
      badge: 'Our Choice',
      moodTag: 'bougie',
      hungerLevelTag: 'little_hungry',
      preparationTime: 15,
      nutritionInfo: { calories: 260, protein: 24, carbs: 8, fat: 14, fiber: 1, sugar: 2, servingSize: '4 pieces (180g)' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Green Chutney', price: 15, isVeg: true },
          { name: 'Cheese Dip', price: 30, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  },

  // ── Desi AF ──────────────────────────────────────────────────────────────────
  {
    categoryName: 'Desi AF',
    item: {
      name: 'Butter Chicken with Garlic Naan',
      description: { text: 'Slow-cooked chicken in a rich, buttery tomato gravy. Served with pillowy hand-stretched garlic naan. The OG comfort meal.' },
      price: 349,
      image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',
      cuisine: 'Indian',
      isVeg: false,
      tags: ['curry', 'comfort-food', 'classic'],
      keyIngredients: ['Chicken', 'Tomato', 'Butter', 'Cream', 'Kashmiri Chilli', 'Garlic Naan'],
      allergens: ['Dairy', 'Gluten'],
      badge: 'Bestseller',
      moodTag: 'homesick',
      hungerLevelTag: 'very_hungry',
      preparationTime: 25,
      nutritionInfo: { calories: 620, protein: 36, carbs: 58, fat: 24, fiber: 4, sugar: 10, servingSize: '1 portion + 2 naans' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Extra Naan', price: 30, isVeg: true },
          { name: 'Extra Gravy', price: 50, isVeg: false },
          { name: 'Steamed Rice', price: 40, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'Desi AF',
    item: {
      name: 'Dal Makhani & Jeera Rice',
      description: { text: 'Slow-simmered black lentils in a creamy tomato-butter sauce, paired with fragrant cumin rice. Classic done right.' },
      price: 249,
      image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['vegetarian', 'comfort-food', 'classic', 'high-protein'],
      keyIngredients: ['Black Lentils', 'Kidney Beans', 'Tomato', 'Butter', 'Cream', 'Cumin Rice'],
      allergens: ['Dairy'],
      badge: 'Recommended',
      moodTag: 'homesick',
      hungerLevelTag: 'very_hungry',
      preparationTime: 20,
      nutritionInfo: { calories: 480, protein: 18, carbs: 68, fat: 14, fiber: 12, sugar: 6, servingSize: '1 bowl + 1 plate rice' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Butter Naan', price: 35, isVeg: true },
          { name: 'Pickle', price: 10, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  },
  {
    categoryName: 'Desi AF',
    item: {
      name: 'Chole Bhature',
      description: { text: 'Spicy, tangy chickpea curry with two giant puffy bhaturas. The kind of meal that makes you loosen your belt — worth it every time.' },
      price: 219,
      image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['vegetarian', 'street-food', 'classic'],
      keyIngredients: ['Chickpeas', 'Onion', 'Tomato', 'Bhatura', 'Anardana', 'Black Cardamom'],
      allergens: ['Gluten'],
      badge: 'Bestseller',
      moodTag: 'homesick',
      hungerLevelTag: 'super_hungry',
      preparationTime: 20,
      nutritionInfo: { calories: 680, protein: 20, carbs: 88, fat: 26, fiber: 14, sugar: 8, servingSize: '2 bhaturas + 1 bowl chole' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Bhatura', price: 25, isVeg: true },
          { name: 'Lassi (Sweet)', price: 60, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 3
    }
  },

  // ── Lowkey Sweet ─────────────────────────────────────────────────────────────
  {
    categoryName: 'Lowkey Sweet',
    item: {
      name: 'Matcha Chia Pudding',
      description: { text: 'Creamy coconut chia pudding layered with ceremonial-grade matcha, topped with fresh berries and a honey drizzle.' },
      price: 179,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
      cuisine: 'Continental',
      isVeg: true,
      tags: ['dessert', 'healthy', 'vegan'],
      keyIngredients: ['Chia Seeds', 'Coconut Milk', 'Matcha', 'Berries', 'Honey'],
      allergens: [],
      badge: 'New',
      moodTag: 'bougie',
      hungerLevelTag: 'little_hungry',
      preparationTime: 5,
      nutritionInfo: { calories: 220, protein: 6, carbs: 28, fat: 10, fiber: 9, sugar: 14, servingSize: '1 jar (220g)' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Extra Berries', price: 30, isVeg: true },
          { name: 'Granola Topping', price: 25, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'Lowkey Sweet',
    item: {
      name: 'Gulab Jamun Cheesecake',
      description: { text: 'A desi-fusion dessert: velvety cheesecake base topped with warm gulab jamuns and a rose-cardamom syrup. Two classics, one legend.' },
      price: 199,
      image: 'https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=800&q=80',
      cuisine: 'Indian',
      isVeg: true,
      tags: ['dessert', 'fusion', 'indulgent'],
      keyIngredients: ['Cream Cheese', 'Gulab Jamun', 'Rose Water', 'Cardamom', 'Biscuit Base'],
      allergens: ['Dairy', 'Gluten'],
      badge: 'Our Choice',
      moodTag: 'bougie',
      hungerLevelTag: 'little_hungry',
      preparationTime: 5,
      nutritionInfo: { calories: 380, protein: 6, carbs: 48, fat: 18, fiber: 1, sugar: 38, servingSize: '1 slice (150g)' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Extra Gulab Jamun', price: 30, isVeg: true },
          { name: 'Vanilla Ice Cream Scoop', price: 50, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  },

  // ── H2-Oh Nice! ──────────────────────────────────────────────────────────────
  {
    categoryName: 'H2-Oh Nice!',
    item: {
      name: 'Watermelon Mint Cooler',
      description: { text: 'Fresh watermelon blended with mint and a hint of black salt. Chilled, refreshing, and the perfect summer sip.' },
      price: 119,
      image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800&q=80',
      cuisine: 'Continental',
      isVeg: true,
      tags: ['beverage', 'cold', 'vegan', 'refreshing'],
      keyIngredients: ['Watermelon', 'Mint', 'Black Salt', 'Lime'],
      allergens: [],
      moodTag: 'burnt_tf_out',
      hungerLevelTag: 'little_hungry',
      preparationTime: 5,
      nutritionInfo: { calories: 90, protein: 1, carbs: 22, fat: 0, fiber: 1, sugar: 18, servingSize: '1 glass (300ml)' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Extra Ice', price: 0, isVeg: true },
          { name: 'Chia Seeds', price: 20, isVeg: true }
        ],
        needsCutlery: false
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'H2-Oh Nice!',
    item: {
      name: 'Cold Brew Coffee',
      description: { text: '12-hour slow-steeped coffee over ice. Smooth, low-acid, and hits different. Add milk if you\'re feeling soft.' },
      price: 149,
      image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80',
      cuisine: 'Continental',
      isVeg: true,
      tags: ['beverage', 'coffee', 'cold'],
      keyIngredients: ['Cold Brew Concentrate', 'Filtered Water', 'Ice'],
      allergens: [],
      badge: 'Bestseller',
      moodTag: 'locked_in',
      hungerLevelTag: 'little_hungry',
      preparationTime: 3,
      nutritionInfo: { calories: 15, protein: 1, carbs: 2, fat: 0, fiber: 0, sugar: 0, servingSize: '1 glass (350ml)' },
      customizationOptions: {
        spiceLevel: 'Classic',
        addOns: [
          { name: 'Oat Milk', price: 30, isVeg: true },
          { name: 'Vanilla Syrup', price: 20, isVeg: true },
          { name: 'Brown Sugar Shot', price: 15, isVeg: true }
        ],
        needsCutlery: false
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  },

  // ── Beta Taste v1.0 ──────────────────────────────────────────────────────────
  {
    categoryName: 'Beta Taste v1.0',
    item: {
      name: 'Miso Ramen Bowl',
      description: { text: 'Rich miso broth with ramen noodles, soft-boiled egg, nori, corn, and spring onions. A Japanese classic making its debut on our menu.' },
      price: 329,
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80',
      cuisine: 'Japanese',
      isVeg: false,
      tags: ['ramen', 'japanese', 'experimental', 'noodles'],
      keyIngredients: ['Ramen Noodles', 'Miso Paste', 'Soft Boiled Egg', 'Nori', 'Corn', 'Spring Onion'],
      allergens: ['Gluten', 'Soy', 'Eggs'],
      badge: 'New',
      moodTag: 'need_a_hug',
      hungerLevelTag: 'very_hungry',
      preparationTime: 22,
      nutritionInfo: { calories: 520, protein: 22, carbs: 68, fat: 16, fiber: 5, sugar: 6, servingSize: '1 bowl (450g)' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Egg', price: 25, isVeg: false },
          { name: 'Bamboo Shoots', price: 30, isVeg: true },
          { name: 'Chashu Pork', price: 80, isVeg: false }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 1
    }
  },
  {
    categoryName: 'Beta Taste v1.0',
    item: {
      name: 'Korean BBQ Wrap',
      description: { text: 'Gochujang-glazed chicken with pickled daikon, kimchi slaw and sriracha mayo, all wrapped in a warm flour tortilla. Seoul food, delivered.' },
      price: 279,
      image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
      cuisine: 'Korean',
      isVeg: false,
      tags: ['wrap', 'korean', 'experimental', 'fusion'],
      keyIngredients: ['Chicken Thigh', 'Gochujang', 'Kimchi', 'Daikon', 'Sriracha Mayo', 'Flour Tortilla'],
      allergens: ['Gluten', 'Eggs', 'Soy'],
      badge: 'New',
      moodTag: 'bougie',
      hungerLevelTag: 'quite_hungry',
      preparationTime: 18,
      nutritionInfo: { calories: 490, protein: 30, carbs: 48, fat: 18, fiber: 4, sugar: 8, servingSize: '1 wrap (320g)' },
      customizationOptions: {
        spiceLevel: 'Spicy',
        addOns: [
          { name: 'Extra Kimchi', price: 30, isVeg: true },
          { name: 'Sweet Potato Fries', price: 80, isVeg: true }
        ],
        needsCutlery: true
      },
      status: 'Available',
      isAvailable: true,
      displayOrder: 2
    }
  }
];

async function seed() {
  await connectDB();

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const { categoryName, item } of menuItems) {
    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      console.log(`❌ Category not found: "${categoryName}" — run seedCategories.js first`);
      failed++;
      continue;
    }

    const exists = await MenuItem.findOne({ name: item.name });
    if (exists) {
      console.log(`⏭  Skipping (already exists): ${item.name}`);
      skipped++;
      continue;
    }

    await MenuItem.create({ ...item, category: category._id });
    console.log(`✅ Created: ${item.name} [${categoryName}]`);
    added++;
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}, Failed: ${failed}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
