/**
 * Model Schema Validation Tests (No DB Connection Required)
 * Run this with: node tests/model-validation.js
 */

const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const MenuItem = require('../models/menuItemModel');

console.log('🧪 Testing Model Schemas (No DB Connection Required)\n');

// Test 1: User Model - New Moods
console.log('Test 1: User Model - New Mood Values');
try {
  const userSchema = User.schema;
  const moodEnum = userSchema.path('questionAnswers.mood').enumValues;
  console.log('  Current mood enum values:', moodEnum);

  const expectedMoods = ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug'];
  const hasAllNewMoods = expectedMoods.every(mood => moodEnum.includes(mood));

  if (hasAllNewMoods) {
    console.log('  ✅ All new mood values are present');
  } else {
    console.log('  ❌ Missing new mood values');
  }

  const oldMoods = ['good', 'angry', 'in_love', 'sad'];
  const hasOldMoods = oldMoods.some(mood => moodEnum.includes(mood));

  if (!hasOldMoods) {
    console.log('  ✅ Old mood values removed');
  } else {
    console.log('  ⚠️  Old mood values still present');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 2: User Model - Calorie Goal
console.log('\nTest 2: User Model - Calorie Goal Field');
try {
  const userSchema = User.schema;
  const calorieGoalPath = userSchema.path('calorieGoal');

  if (calorieGoalPath) {
    console.log('  ✅ calorieGoal field exists');
    console.log('  Field type:', calorieGoalPath.instance);
    console.log('  Default value:', calorieGoalPath.defaultValue);
  } else {
    console.log('  ❌ calorieGoal field not found');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 3: User Model - Allergens in Preferences
console.log('\nTest 3: User Model - Allergens in Preferences');
try {
  const userSchema = User.schema;
  const allergensPath = userSchema.path('preferences.allergens');

  if (allergensPath) {
    console.log('  ✅ preferences.allergens field exists');
    console.log('  Field type:', allergensPath.instance);
  } else {
    console.log('  ❌ preferences.allergens field not found');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 4: Order Model - New Order Types
console.log('\nTest 4: Order Model - New Order Types');
try {
  const orderSchema = Order.schema;
  const orderTypeEnum = orderSchema.path('orderType').enumValues;
  console.log('  Current orderType enum values:', orderTypeEnum);

  const expectedTypes = ['delivery', 'take_away', 'car'];
  const hasAllNewTypes = expectedTypes.every(type => orderTypeEnum.includes(type));

  if (hasAllNewTypes) {
    console.log('  ✅ All new order types are present');
  } else {
    console.log('  ❌ Missing new order types');
  }

  const oldTypes = ['on_site_dining'];
  const hasOldTypes = oldTypes.some(type => orderTypeEnum.includes(type));

  if (!hasOldTypes) {
    console.log('  ✅ Old order types removed');
  } else {
    console.log('  ⚠️  Old order types still present');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 5: Order Model - Delivery Instructions
console.log('\nTest 5: Order Model - Delivery and Cooking Instructions');
try {
  const orderSchema = Order.schema;
  const deliveryInstructionsPath = orderSchema.path('deliveryInstructions');
  const cookingInstructionsPath = orderSchema.path('cookingInstructions');

  if (deliveryInstructionsPath) {
    console.log('  ✅ deliveryInstructions field exists');
  } else {
    console.log('  ❌ deliveryInstructions field not found');
  }

  if (cookingInstructionsPath) {
    console.log('  ✅ cookingInstructions field exists');
  } else {
    console.log('  ❌ cookingInstructions field not found');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 6: Order Model - Scheduled Time
console.log('\nTest 6: Order Model - Scheduled Time Field');
try {
  const orderSchema = Order.schema;
  const scheduledTimePath = orderSchema.path('scheduledTime');

  if (scheduledTimePath) {
    console.log('  ✅ scheduledTime field exists');
    console.log('  Field type:', scheduledTimePath.instance);
  } else {
    console.log('  ❌ scheduledTime field not found');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 7: MenuItem Model - New Moods
console.log('\nTest 7: MenuItem Model - New Mood Values');
try {
  const menuItemSchema = MenuItem.schema;
  const moodTagEnum = menuItemSchema.path('moodTag').enumValues;
  console.log('  Current moodTag enum values:', moodTagEnum);

  const expectedMoods = ['locked_in', 'bougie', 'homesick', 'burnt_tf_out', 'need_a_hug'];
  const hasAllNewMoods = expectedMoods.every(mood => moodTagEnum.includes(mood));

  if (hasAllNewMoods) {
    console.log('  ✅ All new mood values are present');
  } else {
    console.log('  ❌ Missing new mood values');
  }

  const oldMoods = ['good', 'angry', 'in_love', 'sad'];
  const hasOldMoods = oldMoods.some(mood => moodTagEnum.includes(mood));

  if (!hasOldMoods) {
    console.log('  ✅ Old mood values removed');
  } else {
    console.log('  ⚠️  Old mood values still present');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Test 8: Cart Model - Abandoned Status
console.log('\nTest 8: Cart Model - Abandoned Status');
try {
  const cartSchema = Cart.schema;
  const statusEnum = cartSchema.path('status').enumValues;
  console.log('  Current status enum values:', statusEnum);

  if (statusEnum.includes('abandoned')) {
    console.log('  ✅ "abandoned" status is present');
  } else {
    console.log('  ❌ "abandoned" status not found');
  }

  const abandonedAtPath = cartSchema.path('abandonedAt');
  if (abandonedAtPath) {
    console.log('  ✅ abandonedAt field exists');
  } else {
    console.log('  ❌ abandonedAt field not found');
  }
} catch (err) {
  console.log('  ❌ Error:', err.message);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ Schema validation tests completed!');
console.log('='.repeat(50));
console.log('\nNote: These tests validate the model schemas only.');
console.log('Run "npm test" with MongoDB running for full integration tests.\n');
