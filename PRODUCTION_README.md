# Klinik Payment Backend - Production Guide

This guide covers the production deployment and configuration of the Klinik Payment Backend, a Node.js application that handles payment processing for a dental clinic using Midtrans and Firebase.

## 🚀 Production Features

### Security Enhancements
- **Rate Limiting**: Prevents abuse with configurable request limits
- **Input Sanitization**: Protects against XSS and injection attacks
- **Enhanced Validation**: Comprehensive input validation with Indonesian phone number support
- **Security Headers**: Helmet.js with production-optimized CSP
- **CORS Protection**: Configurable origin restrictions
- **Audit Logging**: Complete transaction and action logging
- **Error Handling**: Production-safe error responses

### Reliability Features
- **Retry Logic**: Automatic retry for failed operations
- **Graceful Shutdown**: Proper cleanup on application termination
- **Health Checks**: Comprehensive health monitoring
- **Transaction Recovery**: Ability to retry failed payments
- **Request Timeouts**: Configurable timeout handling

### Monitoring & Logging
- **Structured Logging**: JSON-formatted logs with timestamps
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Detailed error logging with stack traces
- **Audit Trails**: Complete transaction history
- **Health Endpoints**: `/health` endpoint for monitoring

## 📋 Prerequisites

### System Requirements
- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- 2GB RAM minimum (4GB recommended)
- 10GB disk space
- Stable internet connection

### External Services
- Firebase project with Firestore
- Midtrans production account
- Domain name with SSL certificate
- Reverse proxy (nginx/IIS/Apache)

## 🔧 Installation & Setup

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your production credentials:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Base URL for callbacks
BASE_URL=https://yourdomain.com

# CORS origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Midtrans Configuration
MIDTRANS_SERVER_KEY=Mid-server-your-production-key
MIDTRANS_CLIENT_KEY=Mid-client-your-production-key
MIDTRANS_IS_PRODUCTION=true

# Security
ENABLE_SIGNATURE_VERIFICATION=true
ENABLE_RATE_LIMITING=true
```

### 2. Dependencies Installation

```bash
npm ci --only=production
```

### 3. Security Audit

```bash
npm audit --audit-level=moderate
```

### 4. Application Test

```bash
node -e "require('./server.js')"
```

## 🚀 Deployment Options

### Option 1: PM2 (Recommended)

Install PM2 globally:
```bash
npm install -g pm2
```

Start the application:
```bash
pm2 start ecosystem.config.js
```

PM2 commands:
```bash
pm2 status                    # Check status
pm2 logs klinik-payment-backend  # View logs
pm2 restart klinik-payment-backend  # Restart
pm2 stop klinik-payment-backend     # Stop
pm2 delete klinik-payment-backend   # Remove
```

### Option 2: Windows Service

Run the deployment script:
```bash
scripts\deploy-production.bat
```

Then install as Windows service using nssm:
```bash
nssm install KlinikPaymentBackend
nssm set KlinikPaymentBackend Application "C:\Program Files\nodejs\node.exe"
nssm set KlinikPaymentBackend AppParameters "server.js"
nssm set KlinikPaymentBackend AppDirectory "C:\path\to\your\app"
nssm set KlinikPaymentBackend AppEnvironmentExtra NODE_ENV=production
net start KlinikPaymentBackend
```

### Option 3: Direct Execution

```bash
set NODE_ENV=production
node server.js
```

## 🔒 Security Configuration

### Firewall Rules

Configure your firewall to allow:
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000 (Application - internal only)

### Reverse Proxy Configuration

#### Nginx Example
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

#### IIS Configuration
Use the generated `web.config` file for IIS reverse proxy setup.

## 📊 Monitoring & Health Checks

### Health Check Endpoint
```
GET /health
```

Response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 10485760
  },
  "version": "1.0.0"
}
```

### Log Monitoring

Logs are stored in:
- Console output (for PM2/systemd)
- `logs/` directory (if configured)
- External logging service (recommended for production)

### Key Metrics to Monitor
- Response times
- Error rates
- Memory usage
- CPU usage
- Payment success rates
- Failed transaction counts

## 🔄 API Endpoints

### Payment Endpoints
- `POST /api/create-transaction` - Create payment transaction
- `POST /api/notification` - Handle Midtrans notifications
- `GET /api/order/:orderId` - Get order details
- `GET /api/check-status/:orderId` - Check payment status
- `POST /api/retry-transaction/:orderId` - Retry failed transaction

### Utility Endpoints
- `GET /health` - Health check
- `GET /` - API documentation

## 🛠️ Troubleshooting

### Common Issues

#### 1. Payment Creation Fails
- Check Midtrans credentials
- Verify Firebase connection
- Check rate limiting
- Review server logs

#### 2. Notifications Not Received
- Verify webhook URL in Midtrans dashboard
- Check server accessibility
- Review notification logs
- Test with Midtrans simulator

#### 3. High Memory Usage
- Monitor memory usage
- Restart application if needed
- Consider increasing memory limits
- Review for memory leaks

#### 4. Slow Response Times
- Check database performance
- Monitor external API calls
- Review rate limiting settings
- Consider scaling horizontally

### Log Analysis

Key log patterns to monitor:
```
✅ Transaction created successfully
❌ Error creating transaction
⚠️  Security warning
🛑 Server shutdown
```

### Performance Optimization

1. **Database Optimization**
   - Index frequently queried fields
   - Implement connection pooling
   - Regular cleanup of old data

2. **Caching**
   - Enable Redis caching (if configured)
   - Cache frequently accessed data
   - Implement response caching

3. **Load Balancing**
   - Use multiple application instances
   - Implement sticky sessions if needed
   - Monitor load distribution

## 🔄 Maintenance

### Regular Tasks

#### Daily
- Monitor error logs
- Check payment success rates
- Verify health check status

#### Weekly
- Review security logs
- Clean up old audit logs
- Update dependencies (if needed)
- Backup database

#### Monthly
- Security audit
- Performance review
- Update SSL certificates
- Review rate limiting settings

### Backup Strategy

1. **Database Backup**
   - Export Firestore data
   - Store in secure location
   - Test restore procedures

2. **Configuration Backup**
   - Backup `.env` file
   - Backup configuration files
   - Version control for code

3. **Log Backup**
   - Archive old logs
   - Compress log files
   - Store in separate location

## 🚨 Emergency Procedures

### Server Down
1. Check server status
2. Review error logs
3. Restart application
4. Verify all services
5. Notify stakeholders

### Payment Issues
1. Check Midtrans status
2. Review transaction logs
3. Verify webhook delivery
4. Manual status checks
5. Contact Midtrans support if needed

### Security Incident
1. Isolate affected systems
2. Review audit logs
3. Identify breach scope
4. Implement fixes
5. Report to authorities if required

## 📞 Support

### Internal Support
- Check logs first
- Review this documentation
- Test with known good data
- Verify configuration

### External Support
- **Midtrans**: Contact through dashboard
- **Firebase**: Google Cloud support
- **Node.js**: Community support

### Emergency Contacts
- System Administrator: [Contact Info]
- Payment Provider: Midtrans Support
- Database Provider: Firebase Support

## 📈 Scaling Considerations

### Vertical Scaling
- Increase server resources
- Optimize application code
- Use faster storage

### Horizontal Scaling
- Multiple application instances
- Load balancer configuration
- Database read replicas
- CDN for static content

### Performance Tuning
- Connection pooling
- Query optimization
- Caching strategies
- Async processing

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Maintainer**: [Your Name/Team] 