/**
 * MongoDB Migration: Complaints Schema Update
 *
 * This migration:
 * 1. Maps old category values to new enum values
 * 2. Converts single 'response' field to 'responses' array format
 * 3. Adds missing fields with default values
 * 4. Maintains backward compatibility
 *
 * Run with: node migrations/migrate-complaints.js
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
  await migrateComplaints();
  process.exit(0);
});

/**
 * Map old category values to new enum
 * Defaults to 'general_inquiry' if unmapped
 */
function mapCategory(oldCategory) {
  const categoryMap = {
    'order_issue': 'order_issue',
    'order-issue': 'order_issue',
    'delivery_issue': 'delivery_issue',
    'delivery-issue': 'delivery_issue',
    'payment_issue': 'payment_issue',
    'payment-issue': 'payment_issue',
    'quality_issue': 'menu_issue',
    'quality-issue': 'menu_issue',
    'other': 'general_inquiry',
    'complaint': 'order_issue',
  };

  const mapped = categoryMap[oldCategory?.toLowerCase()] || 'general_inquiry';
  return mapped;
}

/**
 * Convert old response format to new array format
 */
function convertResponseFormat(complaint) {
  const responses = [];

  // If old 'response' field exists, convert it
  if (complaint.response) {
    responses.push({
      adminId: complaint.respondedBy || null,
      adminName: 'Admin',
      message: complaint.response,
      isInternal: false,
      createdAt: complaint.respondedAt || complaint.updatedAt || new Date(),
    });
  }

  return responses;
}

async function migrateComplaints() {
  try {
    const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }));

    console.log('\n📊 Migration Summary:');
    console.log('====================\n');

    // Get total count
    const totalComplaints = await Complaint.countDocuments({});
    console.log(`Total complaints to migrate: ${totalComplaints}`);

    // Find complaints that need migration
    const complaintsToMigrate = await Complaint.find({
      $or: [
        { category: null },
        { category: { $type: 'string', $nin: ['order_issue', 'delivery_issue', 'payment_issue', 'account_issue', 'technical_issue', 'menu_issue', 'general_inquiry', 'feedback'] } },
        { responses: { $exists: false } },
      ],
    });

    console.log(`Complaints needing migration: ${complaintsToMigrate.length}\n`);

    let migratedCount = 0;
    let errorCount = 0;

    // Migrate each complaint
    for (const complaint of complaintsToMigrate) {
      try {
        const updates = {};

        // Map category
        if (!complaint.category || !['order_issue', 'delivery_issue', 'payment_issue', 'account_issue', 'technical_issue', 'menu_issue', 'general_inquiry', 'feedback'].includes(complaint.category)) {
          updates.category = mapCategory(complaint.category);
          console.log(`  📝 ${complaint._id}: category "${complaint.category}" → "${updates.category}"`);
        }

        // Convert response format
        if (!complaint.responses || complaint.responses.length === 0) {
          updates.responses = convertResponseFormat(complaint);
          if (complaint.response) {
            console.log(`  📝 ${complaint._id}: converted single response to array format`);
          }
        }

        // Add missing fields if they don't exist
        if (!complaint.assignedTo) updates.assignedTo = null;
        if (!complaint.relatedOrderId) updates.relatedOrderId = null;
        if (!complaint.resolvedAt) updates.resolvedAt = null;
        if (!complaint.resolvedBy) updates.resolvedBy = null;
        if (!complaint.closedAt) updates.closedAt = null;
        if (!complaint.lastResponseAt && complaint.responses?.length > 0) {
          updates.lastResponseAt = complaint.responses[0].createdAt;
        }
        if (!complaint.tags) updates.tags = [];

        // Update the complaint
        if (Object.keys(updates).length > 0) {
          await Complaint.updateOne({ _id: complaint._id }, { $set: updates });
          migratedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error migrating ${complaint._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Migration Results:');
    console.log(`  ✓ Successfully migrated: ${migratedCount}`);
    if (errorCount > 0) {
      console.log(`  ✗ Errors: ${errorCount}`);
    }

    // Verify migration
    console.log('\n🔍 Verification:');
    const invalidComplaints = await Complaint.find({
      $or: [
        { category: { $nin: ['order_issue', 'delivery_issue', 'payment_issue', 'account_issue', 'technical_issue', 'menu_issue', 'general_inquiry', 'feedback'] } },
        { category: null },
      ],
    });

    if (invalidComplaints.length === 0) {
      console.log('  ✓ All complaints have valid categories');
    } else {
      console.log(`  ⚠️  ${invalidComplaints.length} complaints still have invalid categories`);
    }

    const complaintsWithoutResponses = await Complaint.find({
      responses: { $exists: false },
    });

    if (complaintsWithoutResponses.length === 0) {
      console.log('  ✓ All complaints have responses array');
    } else {
      console.log(`  ⚠️  ${complaintsWithoutResponses.length} complaints missing responses array`);
    }

    console.log('\n✨ Migration complete!\n');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
