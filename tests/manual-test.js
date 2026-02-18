/**
 * Manual Test Script for Recent Implementation
 * Run this with: node tests/manual-test.js
 */

const mongoose = require('mongoose');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const MenuItem = require('../models/menuItemModel');
const { Location } = require('../models/locationModel');

async function runTests() {
  console.log('🧪 Starting Manual Tests...\n');

  try {
    // Connect to database
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextgenfix';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to database\n');

    // Test 1: New Mood Values
    console.log('Test 1: New Mood Values in User Model');
    try {
      const testUser = new User({
        name: 'Test User Moods',
        email: `test-mood-${Date.now()}@test.com`,
        questionAnswers: { mood: 'locked_in' }
      });
      await testUser.validate();
      console.log('✅ User model accepts new mood: locked_in');
      await testUser.save();
      await User.deleteOne({ _id: testUser._id });
    } catch (err) {
      console.log('❌ User mood validation failed:', err.message);
    }

    // Test 2: New Order Types
    console.log('\nTest 2: New Order Types in Order Model');
    try {
      const user = await User.findOne();
      if (!user) throw new Error('No user found for testing');

      const testOrder = new Order({
        user: user._id,
        orderType: 'take_away',
        items: [{ itemId: new mongoose.Types.ObjectId(), quantity: 1, price: 100 }],
        billing: { subtotal: 100, totalAmount: 100 },
        status: 'placed',
        paymentStatus: 'pending',
        deliveryInstructions: 'Test delivery instructions',
        cookingInstructions: 'Test cooking instructions',
        scheduledTime: new Date(Date.now() + 3600000)
      });
      await testOrder.validate();
      console.log('✅ Order model accepts new orderType: take_away');
      console.log('✅ Order model accepts deliveryInstructions');
      console.log('✅ Order model accepts cookingInstructions');
      console.log('✅ Order model accepts scheduledTime');
      await testOrder.save();
      await Order.deleteOne({ _id: testOrder._id });
    } catch (err) {
      console.log('❌ Order validation failed:', err.message);
    }

    // Test 3: Calorie Goal in User Model
    console.log('\nTest 3: Calorie Goal Field in User Model');
    try {
      const testUser = new User({
        name: 'Test User Calorie',
        email: `test-calorie-${Date.now()}@test.com`,
        calorieGoal: 2000
      });
      await testUser.validate();
      console.log('✅ User model accepts calorieGoal field');
      await testUser.save();
      console.log('✅ User saved with calorieGoal:', testUser.calorieGoal);
      await User.deleteOne({ _id: testUser._id });
    } catch (err) {
      console.log('❌ User calorieGoal validation failed:', err.message);
    }

    // Test 4: Menu Item New Moods
    console.log('\nTest 4: New Mood Values in MenuItem Model');
    try {
      const testMenuItem = new MenuItem({
        name: 'Test Menu Item',
        description: { text: 'Test description' },
        price: 100,
        image: 'test.jpg',
        cuisine: 'Indian',
        isVeg: true,
        category: new mongoose.Types.ObjectId(),
        tags: ['test'],
        moodTag: 'bougie'
      });
      await testMenuItem.validate();
      console.log('✅ MenuItem model accepts new moodTag: bougie');
      await testMenuItem.save();
      await MenuItem.deleteOne({ _id: testMenuItem._id });
    } catch (err) {
      console.log('❌ MenuItem mood validation failed:', err.message);
    }

    // Test 5: Abandoned Cart Status
    console.log('\nTest 5: Abandoned Cart Status');
    try {
      const user = await User.findOne();
      if (!user) throw new Error('No user found for testing');

      const testCart = new Cart({
        user: user._id,
        items: [{ menuItem: new mongoose.Types.ObjectId(), quantity: 1, price: 50 }],
        status: 'abandoned',
        abandonedAt: new Date()
      });
      await testCart.validate();
      console.log('✅ Cart model accepts status: abandoned');
      await testCart.save();
      await Cart.deleteOne({ _id: testCart._id });
    } catch (err) {
      console.log('❌ Cart validation failed:', err.message);
    }

    // Test 6: Location Model
    console.log('\nTest 6: Location Model Structure');
    try {
      const user = await User.findOne();
      if (!user) throw new Error('No user found for testing');

      const testLocation = new Location({
        user: user._id,
        flatNumber: 'Test 123',
        formattedAddress: '123 Test St',
        coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] }, // Bangalore coords
        saveAs: 'Home',
        isDefault: true,
        landmark: 'Test landmark'
      });
      await testLocation.validate();
      console.log('✅ Location model validates correctly');
      await testLocation.save();
      console.log('✅ Location saved with saveAs:', testLocation.saveAs);
      await Location.deleteOne({ _id: testLocation._id });
    } catch (err) {
      console.log('❌ Location validation failed:', err.message);
    }

    // Test 7: User with Allergens
    console.log('\nTest 7: User Preferences with Allergens');
    try {
      const testUser = new User({
        name: 'Test User Allergens',
        email: `test-allergens-${Date.now()}@test.com`,
        preferences: {
          allergens: ['nuts', 'dairy', 'gluten']
        }
      });
      await testUser.validate();
      console.log('✅ User model accepts allergens in preferences');
      await testUser.save();
      console.log('✅ User saved with allergens:', testUser.preferences.allergens);
      await User.deleteOne({ _id: testUser._id });
    } catch (err) {
      console.log('❌ User allergens validation failed:', err.message);
    }

    // Test 8: All New Moods
    console.log('\nTest 8: All New Mood Values');
    const moods = ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug'];
    for (const mood of moods) {
      try {
        const testUser = new User({
          name: `Test ${mood}`,
          email: `test-${mood}-${Date.now()}@test.com`,
          questionAnswers: { mood }
        });
        await testUser.validate();
        console.log(`  ✅ Mood "${mood}" is valid`);
        await testUser.save();
        await User.deleteOne({ _id: testUser._id });
      } catch (err) {
        console.log(`  ❌ Mood "${mood}" failed:`, err.message);
      }
    }

    // Test 9: All New Order Types
    console.log('\nTest 9: All New Order Types');
    const orderTypes = ['delivery', 'take_away', 'car'];
    const user = await User.findOne();
    if (user) {
      for (const orderType of orderTypes) {
        try {
          const testOrder = new Order({
            user: user._id,
            orderType,
            items: [{ itemId: new mongoose.Types.ObjectId(), quantity: 1, price: 100 }],
            billing: { subtotal: 100, totalAmount: 100 },
            status: 'placed',
            paymentStatus: 'pending'
          });
          await testOrder.validate();
          console.log(`  ✅ OrderType "${orderType}" is valid`);
          await testOrder.save();
          await Order.deleteOne({ _id: testOrder._id });
        } catch (err) {
          console.log(`  ❌ OrderType "${orderType}" failed:`, err.message);
        }
      }
    }

    console.log('\n✅ All manual tests completed!\n');

  } catch (err) {
    console.error('❌ Test suite failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run tests
runTests().catch(console.error);
