const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const transactionRoutes = require('./routes/transaction');
const bookingRoutes = require('./routes/booking');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Routes
app.use('/api', [transactionRoutes, bookingRoutes]);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Midtrans notification webhook
app.post('/api/notification/midtrans', async (req, res) => {
  try {
    const notification = req.body;
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    console.log('Received Midtrans notification:', {
      orderId,
      transactionStatus,
      fraudStatus,
    });

// Forward to transaction handler
const response = await fetch(`https://be-klinik.onrender.com/api/notification`, {
//const response = await fetch(`http://172.20.10.3:3001/api/notification`, {


      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error('Failed to process notification');
    }

    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('Error processing Midtrans notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: process.env.SHOW_DETAILED_ERRORS ? err.message : 'Internal server error' 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
}); 