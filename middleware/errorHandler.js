/**
 * Error handling middleware for production use
 */

const rateLimit = require('express-rate-limit');

// Custom error class for API errors
class ApiError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error logging function
const logError = (error, req = null) => {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    isOperational: error.isOperational !== false
  };

  // Log to console with different levels
  if (error.statusCode >= 500) {
    console.error('❌ SERVER ERROR:', errorLog);
  } else if (error.statusCode >= 400) {
    console.warn('⚠️  CLIENT ERROR:', errorLog);
  } else {
    console.log('ℹ️  INFO:', errorLog);
  }

  // In production, you might want to send to external logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to external logging service (e.g., Sentry, LogRocket)
    // Example: Sentry.captureException(error);
  }
};

// 404 Not Found Handler
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Rate limiter for status check endpoint
const statusCheckLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 1, // limit each IP to 1 request per second
  message: { success: false, error: 'Too many status check requests, please wait' }
});

// Global Error Handler
const errorHandler = (error, req, res, next) => {
  // Log the error
  logError(error, req);

  // Set default values
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Determine if we should show detailed error in production
  const isProduction = process.env.NODE_ENV === 'production';
  const showDetails = !isProduction || error.isOperational === false;

  // Prepare error response
  const errorResponse = {
    success: false,
    message: showDetails ? message : 'An error occurred',
    ...(showDetails && { 
      error: {
        type: error.constructor.name,
        details: error.message,
        ...(error.stack && !isProduction && { stack: error.stack })
      }
    }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    errorResponse.message = 'Validation Error';
    errorResponse.error = {
      type: 'ValidationError',
      details: error.message,
      fields: error.fields || []
    };
  }

  if (error.name === 'CastError') {
    errorResponse.message = 'Invalid ID format';
    errorResponse.error = {
      type: 'CastError',
      details: 'The provided ID is not in the correct format'
    };
  }

  if (error.code === 11000) {
    errorResponse.message = 'Duplicate field value';
    errorResponse.error = {
      type: 'DuplicateError',
      details: 'A record with this value already exists'
    };
  }

  // Handle Midtrans specific errors
  if (error.message && error.message.includes('Midtrans')) {
    errorResponse.message = 'Payment service error';
    errorResponse.error = {
      type: 'PaymentError',
      details: isProduction ? 'Payment service temporarily unavailable' : error.message
    };
  }

  // Handle Firebase specific errors
  if (error.code && error.code.startsWith('firebase')) {
    errorResponse.message = 'Database error';
    errorResponse.error = {
      type: 'DatabaseError',
      details: isProduction ? 'Database service temporarily unavailable' : error.message
    };
  }

  // Set appropriate status code
  res.status(statusCode);

  // Send error response
  res.json(errorResponse);
};

// Async error wrapper for route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request timeout middleware
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      const error = new ApiError('Request timeout', 408);
      next(error);
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Request size limit error handler
const handlePayloadTooLarge = (error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    const apiError = new ApiError('Request payload too large', 413);
    return next(apiError);
  }
  next(error);
};

// CORS error handler
const handleCorsError = (error, req, res, next) => {
  if (error.message && error.message.includes('CORS')) {
    const apiError = new ApiError('CORS policy violation', 403);
    return next(apiError);
  }
  next(error);
};

// Rate limit error handler
const handleRateLimitError = (error, req, res, next) => {
  if (error.statusCode === 429) {
    const apiError = new ApiError('Too many requests, please try again later', 429);
    return next(apiError);
  }
  next(error);
};

// Database connection error handler
const handleDatabaseError = (error, req, res, next) => {
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    const apiError = new ApiError('Database connection failed', 503);
    return next(apiError);
  }
  next(error);
};

// Security error handler
const handleSecurityError = (error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    const apiError = new ApiError('Invalid JSON payload', 400);
    return next(apiError);
  }
  
  if (error.type === 'encoding.unsupported') {
    const apiError = new ApiError('Unsupported encoding', 400);
    return next(apiError);
  }
  
  next(error);
};

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  timeoutHandler,
  handlePayloadTooLarge,
  handleCorsError,
  handleRateLimitError,
  handleDatabaseError,
  handleSecurityError,
  logError,
  statusCheckLimiter
}; 