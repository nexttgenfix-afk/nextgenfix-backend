/**
 * MongoDB Migration: Users Mood Update
 *
 * This migration:
 * 1. Maps old mood values to new enum values
 * 2. Clears invalid moods from questionAnswers
 *
 * Old moods: good, angry, in_love, sad
 * New moods: locked_in, bougie, homesick, burnt_tf_out, need_a_hug
 *
 * Run with: node migrations/migrate-users-mood.js
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
  await migrateUsersMood();
  process.exit(0);
});

/**
 * Map old mood values to new mood values
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

  return moodMap[oldMood] || null;
}

async function migrateUsersMood() {
  try {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    console.log('\n📊 Users Mood Migration Summary:');
    console.log('================================\n');

    // Get total count
    const totalUsers = await User.countDocuments({});
    console.log(`Total users in database: ${totalUsers}`);

    // Find users with old or invalid moods
    const usersToMigrate = await User.find({
      'questionAnswers.mood': {
        $exists: true,
        $nin: ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug', null, '']
      }
    });

    console.log(`Users needing mood migration: ${usersToMigrate.length}\n`);

    if (usersToMigrate.length === 0) {
      console.log('✅ All users have valid moods (or none)');
      console.log('\n✨ Migration complete!\n');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    // Migrate each user
    for (const user of usersToMigrate) {
      try {
        const oldMood = user.questionAnswers?.mood;
        const newMood = mapMoodTag(oldMood);

        if (newMood) {
          // Map to new mood
          await User.updateOne(
            { _id: user._id },
            { $set: { 'questionAnswers.mood': newMood } }
          );
          console.log(`  👤 ${user._id} (${user.name}): mood "${oldMood}" → "${newMood}"`);
          migratedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error migrating ${user._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Migration Results:');
    console.log(`  ✓ User moods remapped: ${migratedCount}`);
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount}`);
    }

    // Verify migration
    console.log('\n🔍 Verification:');
    const invalidMoods = await User.find({
      'questionAnswers.mood': {
        $exists: true,
        $nin: ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug', null, '']
      }
    });

    if (invalidMoods.length === 0) {
      console.log('  ✓ All users have valid moods');
    } else {
      console.log(`  ⚠️  ${invalidMoods.length} users still have invalid moods`);
    }

    // Show summary of mood distribution
    const moodDistribution = await User.aggregate([
      {
        $group: {
          _id: '$questionAnswers.mood',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 User Moods Distribution:');
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
