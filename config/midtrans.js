require('dotenv').config();
const midtransClient = require('midtrans-client');

// Initialize Midtrans configuration
const midtransConfig = {
  isProduction: true, // Production mode
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
  merchantId: process.env.MIDTRANS_MERCHANT_ID,
};

// Validate required configuration
const requiredConfig = ['serverKey', 'clientKey', 'merchantId'];
for (const config of requiredConfig) {
  if (!midtransConfig[config]) {
    throw new Error(`Missing required Midtrans configuration: ${config}`);
  }
}

// Initialize Midtrans Snap client with proper error handling
let snap;
try {
  snap = new midtransClient.Snap({
    isProduction: midtransConfig.isProduction,
    serverKey: midtransConfig.serverKey,
    clientKey: midtransConfig.clientKey
  });
  console.log('Midtrans Snap client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Midtrans Snap client:', error);
  throw error;
}

// Initialize Midtrans Core API client with proper error handling
let core;
try {
  core = new midtransClient.CoreApi({
    isProduction: midtransConfig.isProduction,
    serverKey: midtransConfig.serverKey,
    clientKey: midtransConfig.clientKey
  });
  console.log('Midtrans Core API client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Midtrans Core API client:', error);
  throw error;
}

// Test Midtrans connection on startup
async function testMidtransConnection() {
  try {
    // Try a simple API call to verify connection
    await core.transaction.status('test-connection-' + Date.now());
  } catch (error) {
    // 404 is expected for a non-existent transaction
    if (error.httpStatusCode === '404') {
      console.log('Midtrans connection test successful (404 expected)');
    } else {
      console.error('Midtrans connection test failed:', error);
      // Don't throw, just log the error
    }
  }
}

// Run connection test
testMidtransConnection();

module.exports = {
  midtransConfig,
  snap,
  core
}; 