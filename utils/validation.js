/**
 * Validation utilities for payment transactions
 * Enhanced for production security
 */

const crypto = require('crypto');

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '')
    .trim();
};

// Validate create transaction request with enhanced security
const validateCreateTransaction = (req, res, next) => {
  try {
    const { bookingId, amount, customer_details, payment_type } = req.body;

    // Check required fields
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required'
      });
    }

    // Sanitize and validate bookingId
    const sanitizedBookingId = sanitizeInput(bookingId);
    if (sanitizedBookingId.length < 3 || sanitizedBookingId.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'bookingId must be between 3 and 50 characters'
      });
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a positive number'
      });
    }

    // Ensure amount is an integer (Midtrans requirement)
    if (!Number.isInteger(amount)) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a whole number (no decimals)'
      });
    }

    // Check for reasonable amount limits (prevent abuse)
    if (amount > 10000000) { // 10 million IDR limit
      return res.status(400).json({
        success: false,
        message: 'amount exceeds maximum allowed limit'
      });
    }

    // Check minimum amount (Midtrans requirement)
    if (amount < 1000) { // 1 thousand IDR minimum
      return res.status(400).json({
        success: false,
        message: 'amount must be at least 1000 IDR'
      });
    }

    if (!customer_details) {
      return res.status(400).json({
        success: false,
        message: 'customer_details is required'
      });
    }

    // Validate customer details
    const { name, email, phone } = customer_details;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.name is required and must be a non-empty string'
      });
    }

    // Sanitize and validate name
    const sanitizedName = sanitizeInput(name);
    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.name must be between 2 and 100 characters'
      });
    }

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.email is required and must be a valid email'
      });
    }

    // Sanitize email
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    if (sanitizedEmail.length > 254) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.email is too long'
      });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.phone is required and must be a non-empty string'
      });
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizeInput(phone);
    if (!isValidPhone(sanitizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'customer_details.phone must be a valid phone number'
      });
    }

    // Validate payment_type if provided
    if (payment_type && !isValidPaymentType(payment_type)) {
      return res.status(400).json({
        success: false,
        message: 'payment_type must be a valid payment method'
      });
    }

    // Store sanitized values in request
    req.sanitizedBody = {
      bookingId: sanitizedBookingId,
      amount,
      customer_details: {
        name: sanitizedName,
        email: sanitizedEmail,
        phone: sanitizedPhone
      },
      payment_type: payment_type ? sanitizeInput(payment_type) : undefined
    };

    next();
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error'
    });
  }
};

// Validate order ID parameter with enhanced security
const validateOrderId = (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId parameter is required and must be a non-empty string'
      });
    }

    // Sanitize orderId
    const sanitizedOrderId = sanitizeInput(orderId);
    if (sanitizedOrderId.length < 3 || sanitizedOrderId.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be between 3 and 50 characters'
      });
    }

    // Check for valid characters only
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'orderId contains invalid characters'
      });
    }

    req.sanitizedOrderId = sanitizedOrderId;
    next();
  } catch (error) {
    console.error('OrderId validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error'
    });
  }
};

// Enhanced email validation
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Phone number validation for Indonesian numbers
const isValidPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Check if it's a valid Indonesian phone number
  // Indonesian numbers start with 08, +628, or 628
  const indonesianPhoneRegex = /^(08|\+?628|628)\d{8,11}$/;
  
  return indonesianPhoneRegex.test(cleanPhone) && cleanPhone.length >= 10 && cleanPhone.length <= 15;
};

// Payment type validation
const isValidPaymentType = (paymentType) => {
  const validTypes = [
    'bank_transfer', 'credit_card', 'gopay', 'shopeepay', 
    'qris', 'indomaret', 'alfamart', 'kioson'
  ];
  return validTypes.includes(paymentType);
};

// Enhanced Midtrans notification signature validation
const validateMidtransSignature = (req, res, next) => {
  try {
    const { signature_key, order_id, status_code, gross_amount } = req.body;
    
    if (!signature_key) {
      return res.status(400).json({
        success: false,
        message: 'signature_key is required for notification verification'
      });
    }

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required for notification verification'
      });
    }

    // Validate status_code
    if (status_code && !isValidStatusCode(status_code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status_code in notification'
      });
    }

    // Validate gross_amount if provided
    if (gross_amount && (typeof gross_amount !== 'string' || !/^\d+$/.test(gross_amount))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gross_amount in notification'
      });
    }

    // In production, you should implement proper signature verification
    // For now, we'll do basic validation
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement proper Midtrans signature verification
      console.warn('⚠️  Production signature verification not implemented');
    }

    // Sanitize the notification data
    req.sanitizedNotification = {
      signature_key: sanitizeInput(signature_key),
      order_id: sanitizeInput(order_id),
      status_code: status_code ? sanitizeInput(status_code) : undefined,
      gross_amount: gross_amount ? sanitizeInput(gross_amount) : undefined,
      ...req.body
    };

    next();
  } catch (error) {
    console.error('Signature validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error'
    });
  }
};

// Status code validation
const isValidStatusCode = (statusCode) => {
  const validCodes = ['200', '201', '202', '400', '401', '402', '403', '404', '500'];
  return validCodes.includes(statusCode);
};

// Rate limiting helper
const createRateLimiter = (windowMs, max, message) => {
  return {
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };
};

// Validate transaction request
function validateTransaction(data) {
  const { order_id, amount, booking_id, customer_details } = data;

  if (!order_id) {
    return 'Order ID is required';
  }

  if (!amount || amount <= 0) {
    return 'Valid amount is required';
  }

  if (!booking_id) {
    return 'Booking ID is required';
  }

  if (!customer_details) {
    return 'Customer details are required';
  }

  if (!customer_details.name) {
    return 'Customer name is required';
  }

  if (!customer_details.email) {
    return 'Customer email is required';
  }

  if (!customer_details.phone) {
    return 'Customer phone is required';
  }

  return null;
}

module.exports = {
  validateCreateTransaction,
  validateOrderId,
  validateMidtransSignature,
  isValidEmail,
  isValidPhone,
  isValidPaymentType,
  isValidStatusCode,
  sanitizeInput,
  createRateLimiter,
  validateTransaction
}; 