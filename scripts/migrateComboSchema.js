/**
 * Migration script to update existing combo offers to new schema
 * 
 * This script:
 * 1. Converts old items array [ObjectId] to new structure [{menuItem, quantity}]
 * 2. Sets originalPrice = current price
 * 3. Sets discount to 'none' with value 0
 * 4. Preserves existing final price
 * 
 * Run with: node scripts/migrateComboSchema.js
 */

const mongoose = require('mongoose');
const ComboOffer = require('../models/comboOfferModel');
const MenuItem = require('../models/menuItemModel');
require('dotenv').config();

const migrateComboSchema = async () => {
  try {
    console.log('🚀 Starting combo schema migration...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database\n');

    // Find all combos
    const combos = await ComboOffer.find();
    console.log(`📊 Found ${combos.length} combos to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const combo of combos) {
      try {
        console.log(`Processing: ${combo.name} (${combo._id})`);

        // Check if already migrated (has new structure)
        if (combo.items && combo.items.length > 0 && combo.items[0].menuItem) {
          console.log(`  ⏭️  Already migrated - skipping\n`);
          skippedCount++;
          continue;
        }

        // Get old items array
        const oldItems = combo.items || [];
        
        if (oldItems.length === 0) {
          console.log(`  ⚠️  No items found - skipping\n`);
          skippedCount++;
          continue;
        }

        // Transform to new structure
        const newItems = [];
        let calculatedOriginalPrice = 0;

        for (const itemId of oldItems) {
          try {
            const menuItem = await MenuItem.findById(itemId);
            
            if (!menuItem) {
              console.log(`  ⚠️  Menu item ${itemId} not found - skipping this item`);
              continue;
            }

            newItems.push({
              menuItem: itemId,
              quantity: 1 // Default quantity for existing combos
            });

            calculatedOriginalPrice += menuItem.price;
          } catch (itemError) {
            console.log(`  ❌ Error processing item ${itemId}:`, itemError.message);
          }
        }

        if (newItems.length === 0) {
          console.log(`  ⚠️  No valid items found - skipping\n`);
          errorCount++;
          continue;
        }

        // Round to 2 decimal places
        calculatedOriginalPrice = Math.round(calculatedOriginalPrice * 100) / 100;

        // Update combo with new structure (bypass validation)
        await ComboOffer.updateOne(
          { _id: combo._id },
          {
            $set: {
              items: newItems,
              originalPrice: calculatedOriginalPrice,
              'discount.type': 'none',
              'discount.value': 0,
              price: combo.price || calculatedOriginalPrice, // Keep existing price or use calculated
              'priceWarning.hasWarning': false,
              'priceWarning.lastChecked': new Date()
            }
          }
        );

        console.log(`  ✅ Migrated successfully`);
        console.log(`     - Items: ${newItems.length}`);
        console.log(`     - Original Price: ₹${calculatedOriginalPrice}`);
        console.log(`     - Final Price: ₹${combo.price || calculatedOriginalPrice}\n`);
        
        migratedCount++;
      } catch (error) {
        console.log(`  ❌ Error migrating combo ${combo._id}:`, error.message, '\n');
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total Combos: ${combos.length}`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✨ Migration completed!\n');

    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if executed directly
if (require.main === module) {
  migrateComboSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrateComboSchema;
