/**
 * Test script for Analytics API endpoints
 * 
 * This script tests all analytics endpoints to ensure they work correctly
 * Run after setting up indexes and seeding data
 * 
 * Usage: node scripts/testAnalyticsEndpoints.js
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'your-admin-token-here';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`)
};

// Create axios instance with auth header
const api = axios.create({
  baseURL: `${BASE_URL}/api/admin/analytics`,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Test result tracker
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Generic test function
const testEndpoint = async (name, endpoint, expectedFields = []) => {
  try {
    log.info(`Testing: ${name}`);
    const startTime = Date.now();
    
    const response = await api.get(endpoint);
    const duration = Date.now() - startTime;
    
    // Check response structure
    if (!response.data || !response.data.success) {
      throw new Error('Invalid response structure');
    }
    
    // Check for expected fields in data
    if (expectedFields.length > 0 && response.data.data) {
      const missingFields = expectedFields.filter(field => !(field in response.data.data));
      if (missingFields.length > 0) {
        log.warn(`  Missing fields: ${missingFields.join(', ')}`);
      }
    }
    
    log.success(`${name} (${duration}ms) ${response.data.cached ? '[CACHED]' : ''}`);
    console.log(`  Data keys: ${Object.keys(response.data.data || {}).join(', ')}`);
    
    results.passed++;
    return response.data;
    
  } catch (error) {
    log.error(`${name}: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Message: ${error.response.data?.message || 'No message'}`);
    }
    results.failed++;
    results.errors.push({ name, error: error.message });
  }
};

const runTests = async () => {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════╗`);
  console.log(`║  Analytics API Endpoint Test Suite    ║`);
  console.log(`╚════════════════════════════════════════╝${colors.reset}\n`);
  
  log.info(`Base URL: ${BASE_URL}`);
  log.info(`Testing with period: 30d\n`);

  // ==================== PHASE 1: CRITICAL BUSINESS METRICS ====================
  log.section('PHASE 1: Critical Business Metrics');
  
  await testEndpoint(
    'Order Overview',
    '/orders/overview?period=30d',
    ['totalOrders', 'completedOrders', 'completionRate', 'averageOrderValue', 'basketSize']
  );
  
  await testEndpoint(
    'Abandoned Carts',
    '/orders/abandoned-carts?period=30d',
    ['totalAbandonedCarts', 'recoveryRate', 'avgCartValue']
  );
  
  await testEndpoint(
    'Peak Order Times',
    '/orders/peak-times?period=30d',
    ['totalDataPoints', 'peakOrderTime', 'avgOrdersPerHour']
  );
  
  await testEndpoint(
    'Revenue Overview',
    '/revenue/overview?period=30d',
    ['totalRevenue', 'netRevenue']
  );
  
  await testEndpoint(
    'User Overview',
    '/users/overview?period=30d',
    ['totalUsers', 'activeUsers', 'newUsers']
  );
  
  await testEndpoint(
    'Top Selling Products',
    '/products/top-selling?period=30d&limit=10',
    []
  );
  
  await testEndpoint(
    'Category Performance',
    '/products/category-performance?period=30d',
    []
  );

  // ==================== PHASE 2: USER BEHAVIOR & ENGAGEMENT ====================
  log.section('PHASE 2: User Behavior & Engagement');
  
  await testEndpoint(
    'User Demographics',
    '/users/demographics?period=30d',
    ['genderDistribution', 'ageGroupDistribution']
  );
  
  await testEndpoint(
    'User Retention',
    '/users/retention?period=30d',
    []
  );
  
  await testEndpoint(
    'Session Analytics',
    '/engagement/sessions?period=30d',
    ['totalSessions', 'avgSessionDuration']
  );
  
  await testEndpoint(
    'Favorites Analytics',
    '/engagement/favorites?period=30d',
    []
  );
  
  await testEndpoint(
    'Push Notification Analytics',
    '/engagement/push-notifications?period=30d',
    ['totalNotificationsSent', 'avgOpenRate', 'avgClickThroughRate']
  );
  
  await testEndpoint(
    'Loyalty Analytics',
    '/loyalty/overview?period=30d',
    ['enrollmentRate', 'tierDistribution']
  );

  // ==================== PHASE 3: ADVANCED ANALYTICS ====================
  log.section('PHASE 3: Advanced Analytics');
  
  await testEndpoint(
    'Customer Lifetime Value',
    '/advanced/ltv?period=90d',
    ['avgLTV', 'totalCustomers', 'avgOrdersPerCustomer']
  );
  
  await testEndpoint(
    'Gender Trends',
    '/advanced/gender-trends?period=30d',
    ['totalTrends', 'topTrends']
  );
  
  await testEndpoint(
    'High-Value Customers',
    '/advanced/high-value-customers?period=90d',
    ['totalCustomers', 'totalRevenue', 'top20Share']
  );
  
  await testEndpoint(
    'Time to Second Order',
    '/advanced/time-to-second-order?period=90d',
    ['avgDaysToSecondOrder', 'medianDaysToSecondOrder', 'totalRepeatCustomers']
  );
  
  await testEndpoint(
    'Product Search Analytics',
    '/products/search-analytics?period=30d',
    ['totalSearches', 'failedSearchRate']
  );
  
  await testEndpoint(
    'Customization Analytics',
    '/products/customization-usage?period=30d',
    ['customizationRate', 'customizedItems']
  );

  // ==================== TEST SUMMARY ====================
  log.section('TEST SUMMARY');
  
  console.log(`\nTotal Tests: ${results.passed + results.failed}`);
  log.success(`Passed: ${results.passed}`);
  
  if (results.failed > 0) {
    log.error(`Failed: ${results.failed}`);
    console.log('\nFailed Tests:');
    results.errors.forEach(err => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
  }
  
  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(2);
  console.log(`\nSuccess Rate: ${successRate}%\n`);
  
  if (results.failed === 0) {
    log.success('🎉 All tests passed! Analytics API is working correctly.');
  } else {
    log.warn('⚠️  Some tests failed. Please check the errors above.');
  }
};

// Run tests with error handling
runTests()
  .then(() => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    log.error(`Test suite error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
