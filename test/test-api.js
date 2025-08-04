/**
 * Simple test file for the Payment Backend API
 * Run with: node test/test-api.js
 */

const axios = require('axios');

//const BASE_URL = 'http://localhost:3000/api';
const BASE_URL = 'http://172.20.10.3:3001/api';


// Test data
const testOrder = {
  bookingId: `TEST_BOOKING_${Date.now()}`,
  amount: 50000,
  customer_details: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '081234567890'
  }
};

// Helper function to make API calls
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
};

// Test functions
const testCreateTransaction = async () => {
  console.log('\n🧪 Testing Create Transaction...');
  const result = await makeRequest('POST', '/create-transaction', testOrder);
  
  if (result && result.success) {
    console.log('✅ Create transaction successful');
    console.log('📋 Order ID:', result.data.order_id);
    console.log('🔗 Redirect URL:', result.data.redirect_url);
    return result.data.order_id;
  } else {
    console.log('❌ Create transaction failed');
    return null;
  }
};

const testGetOrder = async (orderId) => {
  console.log('\n🧪 Testing Get Order...');
  const result = await makeRequest('GET', `/order/${orderId}`);
  
  if (result && result.success) {
    console.log('✅ Get order successful');
    console.log('📋 Order details:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Get order failed');
  }
};

const testCheckStatus = async (orderId) => {
  console.log('\n🧪 Testing Check Status...');
  const result = await makeRequest('GET', `/check-status/${orderId}`);
  
  if (result && result.success) {
    console.log('✅ Check status successful');
    console.log('📋 Status details:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Check status failed');
  }
};

const testHealthCheck = async () => {
  console.log('\n🧪 Testing Health Check...');
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('✅ Health check successful');
    console.log('📋 Server status:', response.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting API Tests...');
  console.log('📍 Base URL:', BASE_URL);

  // Test health check first
  await testHealthCheck();

  // Test create transaction
  const orderId = await testCreateTransaction();

  if (orderId) {
    // Test get order
    await testGetOrder(orderId);

    // Test check status
    await testCheckStatus(orderId);
  }

  console.log('\n✨ Tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCreateTransaction,
  testGetOrder,
  testCheckStatus,
  testHealthCheck,
  runTests
}; 