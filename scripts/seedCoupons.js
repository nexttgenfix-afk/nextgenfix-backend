/**
 * Seed script to add sample coupons.
 * Run with: node scripts/seedCoupons.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Coupon = require('../models/couponModel');

const coupons = [
  {
    code: 'TRYFIRST',
    title: 'Flat ₹100 off on your first order',
    discountType: 'fixed',
    discountValue: 100,
    minOrderValue: 199,
    maxDiscount: 100,
    usageLimit: 500,
    usageLimitPerUser: 1,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    applicableTiers: ['all'],
    termsAndConditions: [
      'Applicable only on first transaction on the app',
      'Maximum discount is ₹100 per transaction',
      'Minimum order value ₹199'
    ]
  },
  {
    code: 'SAVE20',
    title: '20% off up to ₹150',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 300,
    maxDiscount: 150,
    usageLimit: 200,
    usageLimitPerUser: 2,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    applicableTiers: ['all'],
    termsAndConditions: [
      '20% discount on orders above ₹300',
      'Maximum discount capped at ₹150',
      'Can be used twice per user'
    ]
  },
  {
    code: 'GOLD50',
    title: 'Flat ₹50 off for Gold members',
    discountType: 'fixed',
    discountValue: 50,
    minOrderValue: 0,
    maxDiscount: 50,
    usageLimit: 100,
    usageLimitPerUser: 5,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    applicableTiers: ['gold'],
    termsAndConditions: [
      'Exclusive for Gold tier members',
      'No minimum order value required',
      'Can be used up to 5 times per user'
    ]
  },
  {
    code: 'FREEDEL',
    title: 'Free delivery on your order',
    discountType: 'free_delivery',
    discountValue: 0,
    minOrderValue: 250,
    maxDiscount: null,
    usageLimit: 300,
    usageLimitPerUser: 3,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    applicableTiers: ['all'],
    termsAndConditions: [
      'Free delivery on orders above ₹250',
      'Valid for delivery orders only',
      'Can be used up to 3 times per user'
    ]
  },
  {
    code: 'WEEKEND30',
    title: '30% off every weekend',
    discountType: 'percentage',
    discountValue: 30,
    minOrderValue: 400,
    maxDiscount: 200,
    usageLimit: 150,
    usageLimitPerUser: 1,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    applicableTiers: ['silver', 'gold'],
    termsAndConditions: [
      'Valid on weekends only (Saturday & Sunday)',
      'Applicable for Silver and Gold members',
      'Minimum order value ₹400',
      'Maximum discount ₹200'
    ]
  }
];

async function seed() {
  await connectDB();

  let added = 0;
  let skipped = 0;

  for (const coupon of coupons) {
    const exists = await Coupon.findOne({ code: coupon.code });
    if (exists) {
      console.log(`⏭  Skipping (already exists): ${coupon.code}`);
      skipped++;
    } else {
      await Coupon.create(coupon);
      console.log(`✅ Created: ${coupon.code} — ${coupon.title}`);
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
