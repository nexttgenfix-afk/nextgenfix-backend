/**
 * MongoDB Migration: Tiers — Remove Bronze, Add Platinum
 *
 * This migration:
 * 1. Updates all users with tier: "bronze" → tier: "silver"
 * 2. Removes the bronze key from the settings tierConfig document
 * 3. Ensures the platinum tier config exists in settings
 *
 * Run with: node migrations/migrate-tiers-bronze-to-silver-add-platinum.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextgenfix';

mongoose.connect(mongoUri);

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('Connection error:', error);
  process.exit(1);
});

db.once('open', async () => {
  console.log('✅ Connected to MongoDB');
  try {
    await migrateUsers();
    await migrateSettings();
    console.log('\n✅ Migration complete');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
  process.exit(0);
});

async function migrateUsers() {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  // Count affected users before migrating
  const bronzeCount = await User.countDocuments({ tier: 'bronze' });
  console.log(`\n👥 Users with tier "bronze": ${bronzeCount}`);

  if (bronzeCount === 0) {
    console.log('   Nothing to update.');
    return;
  }

  const result = await User.updateMany(
    { tier: 'bronze' },
    { $set: { tier: 'silver' } }
  );

  console.log(`   ✅ Updated ${result.modifiedCount} users: bronze → silver`);
}

async function migrateSettings() {
  const Settings = mongoose.model(
    'Settings',
    new mongoose.Schema({}, { strict: false }),
    'settings'
  );

  const settings = await Settings.findOne({ settingsId: 'app-settings' });

  if (!settings) {
    console.log('\n⚙️  No settings document found — skipping (will be created with correct defaults on first server start).');
    return;
  }

  console.log('\n⚙️  Updating settings tierConfig...');

  const updateOps = {};

  // Remove bronze if present
  if (settings.tierConfig?.bronze !== undefined) {
    updateOps.$unset = { 'tierConfig.bronze': '' };
    console.log('   ✅ Removing tierConfig.bronze');
  } else {
    console.log('   ℹ️  tierConfig.bronze not present — skipping unset');
  }

  // Add platinum defaults if missing
  if (!settings.tierConfig?.platinum) {
    updateOps.$set = {
      'tierConfig.platinum': {
        minOrders: 30,
        discount: 15,
        benefits: ['Get List of Coupons', 'Members-only Deals', 'Priority Support', 'Free Delivery']
      }
    };
    console.log('   ✅ Adding tierConfig.platinum with defaults');
  } else {
    console.log('   ℹ️  tierConfig.platinum already exists — skipping');
  }

  if (Object.keys(updateOps).length > 0) {
    await Settings.updateOne({ settingsId: 'app-settings' }, updateOps);
    console.log('   ✅ Settings document updated');
  } else {
    console.log('   Nothing to update in settings.');
  }
}
