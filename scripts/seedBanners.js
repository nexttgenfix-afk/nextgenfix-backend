/**
 * Seed script to add sample banners.
 * Run with: node scripts/seedBanners.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Banner = require('../models/bannerModel');

const banners = [
  {
    title: 'Weekend Special — 30% Off',
    mediaType: 'image',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/banners/weekend_special.jpg',
    link: '',
    type: 'offer',
    isActive: true,
    displayOrder: 1,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31')
  },
  {
    title: 'New on the Menu — Beta Taste v1.0',
    mediaType: 'image',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/banners/new_menu.jpg',
    link: '',
    type: 'new_item',
    isActive: true,
    displayOrder: 2,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31')
  },
  {
    title: 'Free Delivery on Orders Above ₹250',
    mediaType: 'image',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/banners/free_delivery.jpg',
    link: '',
    type: 'promotion',
    isActive: true,
    displayOrder: 3,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31')
  },
  {
    title: 'Refer a Friend & Earn ₹100',
    mediaType: 'image',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/banners/referral.jpg',
    link: '',
    type: 'announcement',
    isActive: true,
    displayOrder: 4,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31')
  },
  {
    title: 'Season Special — Limited Time Dishes',
    mediaType: 'video',
    video: 'https://res.cloudinary.com/dpuireso8/video/upload/v1773268701/4912725-uhd_3840_2160_24fps_g7m06e.mp4',
    link: '',
    type: 'promotion',
    isActive: true,
    displayOrder: 5,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31')
  }
];

async function seed() {
  await connectDB();

  let added = 0;
  let skipped = 0;

  for (const banner of banners) {
    const exists = await Banner.findOne({ title: banner.title });
    if (exists) {
      console.log(`⏭  Skipping (already exists): ${banner.title}`);
      skipped++;
    } else {
      await Banner.create(banner);
      console.log(`✅ Created: [${banner.mediaType}] ${banner.title}`);
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
