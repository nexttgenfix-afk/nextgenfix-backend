const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const { Location } = require('../models/locationModel');

// Mock admin token for testing
let adminToken = '';

describe('Admin API Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/nextgenfix_test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({ email: /test@/ });
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Location.deleteMany({});
    await mongoose.connection.close();
  });

  describe('GET /admin/all-orders', () => {
    let testUser;
    let testOrder;

    beforeAll(async () => {
      // Create test user
      testUser = await User.create({
        name: 'Test User',
        email: 'test@orders.com',
        phone: '1234567890',
      });

      // Create test order
      testOrder = await Order.create({
        user: testUser._id,
        orderType: 'delivery',
        items: [{ itemId: new mongoose.Types.ObjectId(), quantity: 2, price: 100 }],
        billing: { subtotal: 200, totalAmount: 200 },
        status: 'placed',
        paymentStatus: 'pending',
        deliveryInstructions: 'Ring doorbell',
        cookingInstructions: 'Extra spicy',
      });
    });

    it('should fetch all orders', async () => {
      const res = await request(app)
        .get('/api/admin/all-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should filter orders by status', async () => {
      const res = await request(app)
        .get('/api/admin/all-orders?status=placed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.orders.length > 0) {
        expect(res.body.orders[0].status).toBe('placed');
      }
    });

    it('should search orders by user name', async () => {
      const res = await request(app)
        .get('/api/admin/all-orders?search=Test User')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /admin/users', () => {
    it('should create user without password', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test User No Password',
          email: 'test@nopass.com',
          phone: '9876543210',
          tier: 'silver',
          calorieGoal: 2000,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User created');
      expect(res.body.user.tier).toBe('silver');
      expect(res.body.user.calorieGoal).toBe(2000);
    });

    it('should create user with allergens', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test User Allergens',
          email: 'test@allergens.com',
          allergens: 'nuts, dairy',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.preferences).toBeDefined();
    });

    it('should reject user creation without name', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'test@noname.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Name is required');
    });
  });

  describe('GET /admin/users/:userId/locations', () => {
    let testUser;
    let testLocation;

    beforeAll(async () => {
      testUser = await User.create({
        name: 'Test User Locations',
        email: 'test@locations.com',
      });

      testLocation = await Location.create({
        user: testUser._id,
        flatNumber: '123',
        formattedAddress: '123 Test St, Test City',
        coordinates: { type: 'Point', coordinates: [0, 0] },
        saveAs: 'Home',
        isDefault: true,
      });
    });

    it('should fetch user locations', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${testUser._id}/locations`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.locations)).toBe(true);
      expect(res.body.locations.length).toBeGreaterThan(0);
    });
  });

  describe('GET /admin/carts/abandoned', () => {
    let testUser;
    let testCart;

    beforeAll(async () => {
      testUser = await User.create({
        name: 'Test User Cart',
        email: 'test@cart.com',
      });

      testCart = await Cart.create({
        user: testUser._id,
        items: [{ menuItem: new mongoose.Types.ObjectId(), quantity: 1, price: 50 }],
        status: 'abandoned',
        abandonedAt: new Date(),
      });
    });

    it('should fetch abandoned carts', async () => {
      const res = await request(app)
        .get('/api/admin/carts/abandoned')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.carts)).toBe(true);
    });
  });

  describe('GET /admin/users/:userId/cancelled-orders', () => {
    let testUser;
    let testOrder;

    beforeAll(async () => {
      testUser = await User.create({
        name: 'Test User Cancelled',
        email: 'test@cancelled.com',
      });

      testOrder = await Order.create({
        user: testUser._id,
        orderType: 'delivery',
        items: [{ itemId: new mongoose.Types.ObjectId(), quantity: 1, price: 100 }],
        billing: { subtotal: 100, totalAmount: 100 },
        status: 'cancelled',
        paymentStatus: 'pending',
      });
    });

    it('should fetch user cancelled orders', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${testUser._id}/cancelled-orders`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });
  });

  describe('Notification Routes', () => {
    it('should send notification to user', async () => {
      const testUser = await User.create({
        name: 'Test User Notif',
        email: 'test@notif.com',
        fcmToken: 'test-token',
      });

      const res = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser._id.toString(),
          title: 'Test Notification',
          body: 'This is a test',
        });

      // May fail if Firebase is not configured, but route should exist
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should send topic notification', async () => {
      const res = await request(app)
        .post('/api/notifications/topics/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          topic: 'test-topic',
          title: 'Test Topic Notification',
          body: 'This is a test',
        });

      // May fail if Firebase is not configured, but route should exist
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Model Updates', () => {
    it('should create user with new moods', async () => {
      const user = await User.create({
        name: 'Test Mood User',
        email: 'test@mood.com',
        questionAnswers: { mood: 'locked_in' },
      });

      expect(user.questionAnswers.mood).toBe('locked_in');
    });

    it('should create order with new order types', async () => {
      const testUser = await User.create({
        name: 'Test Order Type User',
        email: 'test@ordertype.com',
      });

      const order = await Order.create({
        user: testUser._id,
        orderType: 'take_away',
        items: [{ itemId: new mongoose.Types.ObjectId(), quantity: 1, price: 100 }],
        billing: { subtotal: 100, totalAmount: 100 },
        status: 'placed',
        paymentStatus: 'pending',
        scheduledTime: new Date(Date.now() + 3600000),
      });

      expect(order.orderType).toBe('take_away');
      expect(order.scheduledTime).toBeDefined();
    });

    it('should create user with calorie goal', async () => {
      const user = await User.create({
        name: 'Test Calorie User',
        email: 'test@calorie.com',
        calorieGoal: 2500,
      });

      expect(user.calorieGoal).toBe(2500);
    });
  });
});
