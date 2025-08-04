/**
 * Production configuration for the payment backend
 */

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    trustProxy: true, // Trust proxy for rate limiting
    timeout: 30000, // 30 seconds
  },

  // Security configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['https://yourdomain.com'],
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.midtrans.com"],
          frameSrc: ["'self'", "https://app.midtrans.com"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      frameguard: { action: 'deny' }
    }
  },

  // Database configuration
  database: {
    firestore: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      retryOptions: {
        initialRetryDelayMillis: 100,
        maxRetryDelayMillis: 60000,
        backoffMultiplier: 1.3,
        maxRetries: 5
      }
    }
  },

  // Payment configuration
  payment: {
    midtrans: {
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000
    },
    limits: {
      maxAmount: 10000000, // 10 million IDR
      minAmount: 1000, // 1 thousand IDR
      maxRetries: 3
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    timestamp: true,
    requestId: true,
    sensitiveFields: ['password', 'token', 'secret', 'key']
  },

  // Monitoring configuration
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000 // 5 seconds
    },
    metrics: {
      enabled: process.env.ENABLE_METRICS === 'true',
      port: process.env.METRICS_PORT || 9090
    }
  },

  // Cache configuration
  cache: {
    enabled: process.env.ENABLE_CACHE === 'true',
    ttl: 300, // 5 minutes
    maxSize: 1000
  },

  // Feature flags
  features: {
    auditLogging: true,
    transactionRetry: true,
    signatureVerification: process.env.ENABLE_SIGNATURE_VERIFICATION === 'true',
    webhookValidation: true,
    rateLimiting: true
  }
}; 