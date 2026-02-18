/**
 * MongoDB Migration: Menu Items Mood Tags Update
 *
 * This migration:
 * 1. Maps old mood tag values to new enum values
 * 2. Clears invalid mood tags
 * 3. Maintains data integrity
 *
 * Old moods: good, angry, in_love, sad
 * New moods: locked_in, bougie, homesick, burnt_tf_out, need_a_hug
 *
 * Run with: node migrations/migrate-menu-items-mood.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextgenfix';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (error) => {
  console.error('Connection error:', error);
  process.exit(1);
});

db.once('open', async () => {
  console.log('✅ Connected to MongoDB');
  await migrateMenuItemsMood();
  process.exit(0);
});

/**
 * Map old mood values to new mood values
 * Returns null if no mapping (will be cleared)
 */
function mapMoodTag(oldMood) {
  const moodMap = {
    'good': 'locked_in',
    'angry': 'bougie',
    'in_love': 'homesick',
    'sad': 'burnt_tf_out',
    // New moods (already valid)
    'locked_in': 'locked_in',
    'bougie': 'bougie',
    'homesick': 'homesick',
    'burnt_tf_out': 'burnt_tf_out',
    'need_a_hug': 'need_a_hug',
  };

  return moodMap[oldMood] || null; // null means invalid, will be removed
}

async function migrateMenuItemsMood() {
  try {
    const MenuItem = mongoose.model('MenuItem', new mongoose.Schema({}, { strict: false }));

    console.log('\n📊 Menu Items Mood Tags Migration Summary:');
    console.log('==========================================\n');

    // Get total count
    const totalMenuItems = await MenuItem.countDocuments({});
    console.log(`Total menu items in database: ${totalMenuItems}`);

    // Find menu items with old or invalid mood tags
    const menuItemsToMigrate = await MenuItem.find({
      moodTag: {
        $exists: true,
        $nin: ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug', null, '']
      }
    });

    console.log(`Menu items needing mood migration: ${menuItemsToMigrate.length}\n`);

    if (menuItemsToMigrate.length === 0) {
      console.log('✅ All menu items have valid mood tags (or none)');
      console.log('\n✨ Migration complete!\n');
      return;
    }

    let migratedCount = 0;
    let clearedCount = 0;
    let errorCount = 0;

    // Migrate each menu item
    for (const menuItem of menuItemsToMigrate) {
      try {
        const oldMood = menuItem.moodTag;
        const newMood = mapMoodTag(oldMood);

        if (newMood) {
          // Map to new mood
          await MenuItem.updateOne({ _id: menuItem._id }, { $set: { moodTag: newMood } });
          console.log(`  🏷️  ${menuItem._id} (${menuItem.name}): "${oldMood}" → "${newMood}"`);
          migratedCount++;
        } else {
          // Invalid mood, clear it
          await MenuItem.updateOne({ _id: menuItem._id }, { $set: { moodTag: '' } });
          console.log(`  🚫 ${menuItem._id} (${menuItem.name}): "${oldMood}" → [CLEARED]`);
          clearedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error migrating ${menuItem._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Migration Results:');
    console.log(`  ✓ Mood tags remapped: ${migratedCount}`);
    console.log(`  ✓ Invalid moods cleared: ${clearedCount}`);
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount}`);
    }

    // Verify migration
    console.log('\n🔍 Verification:');
    const invalidMoods = await MenuItem.find({
      moodTag: {
        $exists: true,
        $nin: ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug', null, '']
      }
    });

    if (invalidMoods.length === 0) {
      console.log('  ✓ All menu items have valid mood tags');
    } else {
      console.log(`  ⚠️  ${invalidMoods.length} menu items still have invalid mood tags`);
      console.log('  Invalid items:', invalidMoods.map(m => m._id).join(', '));
    }

    // Show summary of new mood distribution
    const moodDistribution = await MenuItem.aggregate([
      {
        $group: {
          _id: '$moodTag',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 Mood Tags Distribution:');
    for (const mood of moodDistribution) {
      const label = mood._id || '[none/empty]';
      console.log(`  ${label}: ${mood.count}`);
    }

    console.log('\n✨ Migration complete!\n');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
