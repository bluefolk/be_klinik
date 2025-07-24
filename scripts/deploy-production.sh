#!/bin/bash

# Production Deployment Script for Klinik Payment Backend
# This script sets up the backend for production deployment

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version)
REQUIRED_VERSION="v16.0.0"

if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    print_error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION or higher"
    exit 1
fi

print_success "Node.js version $NODE_VERSION is compatible"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version)
REQUIRED_NPM_VERSION="8.0.0"

if [[ "$(printf '%s\n' "$REQUIRED_NPM_VERSION" "$NPM_VERSION" | sort -V | head -n1)" != "$REQUIRED_NPM_VERSION" ]]; then
    print_error "npm version $NPM_VERSION is too old. Required: $REQUIRED_NPM_VERSION or higher"
    exit 1
fi

print_success "npm version $NPM_VERSION is compatible"

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it from env.example"
    print_status "Copying env.example to .env..."
    cp env.example .env
    print_warning "Please edit .env file with your production credentials before continuing"
    exit 1
fi

print_success ".env file found"

# Validate environment variables
print_status "Validating environment variables..."

# Check required variables
REQUIRED_VARS=(
    "FIREBASE_PROJECT_ID"
    "FIREBASE_PRIVATE_KEY"
    "FIREBASE_CLIENT_EMAIL"
    "MIDTRANS_SERVER_KEY"
    "MIDTRANS_CLIENT_KEY"
    "NODE_ENV"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_success "All required environment variables are set"

# Check if NODE_ENV is set to production
if [ "$NODE_ENV" != "production" ]; then
    print_warning "NODE_ENV is not set to 'production'. Current value: $NODE_ENV"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci --only=production

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Run security audit
print_status "Running security audit..."
npm audit --audit-level=moderate

if [ $? -eq 0 ]; then
    print_success "Security audit passed"
else
    print_warning "Security audit found vulnerabilities. Please review and fix them"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Set proper permissions
print_status "Setting file permissions..."
chmod 755 .
chmod 644 .env
chmod 755 logs

# Test the application
print_status "Testing the application..."
node -e "
const app = require('./server.js');
const http = require('http');
const server = http.createServer(app);
server.listen(0, () => {
    const port = server.address().port;
    console.log('Server started on port ' + port);
    server.close(() => {
        console.log('Test completed successfully');
        process.exit(0);
    });
});
"

if [ $? -eq 0 ]; then
    print_success "Application test passed"
else
    print_error "Application test failed"
    exit 1
fi

# Create systemd service file (if running on Linux)
if command -v systemctl &> /dev/null; then
    print_status "Creating systemd service file..."
    
    SERVICE_FILE="/etc/systemd/system/klinik-payment-backend.service"
    CURRENT_DIR=$(pwd)
    USER=$(whoami)
    
    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Klinik Payment Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/klinik-payment-backend.log
StandardError=append:/var/log/klinik-payment-backend.error.log

[Install]
WantedBy=multi-user.target
EOF

    print_success "Systemd service file created at $SERVICE_FILE"
    print_status "To enable and start the service, run:"
    echo "sudo systemctl daemon-reload"
    echo "sudo systemctl enable klinik-payment-backend"
    echo "sudo systemctl start klinik-payment-backend"
fi

# Create PM2 ecosystem file (alternative to systemd)
print_status "Creating PM2 ecosystem file..."
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'klinik-payment-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

print_success "PM2 ecosystem file created"

# Create nginx configuration example
print_status "Creating nginx configuration example..."
cat > nginx.conf.example <<EOF
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 30s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

print_success "Nginx configuration example created"

# Create deployment checklist
print_status "Creating deployment checklist..."
cat > DEPLOYMENT_CHECKLIST.md <<EOF
# Production Deployment Checklist

## Pre-deployment
- [ ] Environment variables configured in .env
- [ ] Firebase credentials verified
- [ ] Midtrans production keys configured
- [ ] SSL certificate installed (if using nginx)
- [ ] Domain DNS configured
- [ ] Database backup completed (if applicable)

## Security
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS origins restricted
- [ ] Helmet security headers enabled
- [ ] Environment variables secured
- [ ] Log files permissions set correctly

## Monitoring
- [ ] Health check endpoint accessible
- [ ] Log monitoring configured
- [ ] Error tracking service configured (optional)
- [ ] Performance monitoring enabled (optional)

## Testing
- [ ] API endpoints tested
- [ ] Payment flow tested with test transactions
- [ ] Error handling verified
- [ ] Load testing completed (recommended)

## Post-deployment
- [ ] Service started successfully
- [ ] Health check passing
- [ ] Payment notifications working
- [ ] Logs being generated correctly
- [ ] Monitoring alerts configured

## Maintenance
- [ ] Regular log rotation configured
- [ ] Database cleanup scheduled
- [ ] Security updates automated
- [ ] Backup strategy implemented
EOF

print_success "Deployment checklist created"

# Final summary
echo
print_success "Production deployment setup completed!"
echo
print_status "Next steps:"
echo "1. Edit .env file with your production credentials"
echo "2. Configure your reverse proxy (nginx/apache)"
echo "3. Set up SSL certificates"
echo "4. Configure firewall rules"
echo "5. Start the application:"
echo "   - Using PM2: pm2 start ecosystem.config.js"
echo "   - Using systemd: sudo systemctl start klinik-payment-backend"
echo "   - Direct: NODE_ENV=production node server.js"
echo
print_status "Check DEPLOYMENT_CHECKLIST.md for detailed steps"
echo
print_warning "Remember to:"
echo "- Test payment flows with small amounts first"
echo "- Monitor logs for any errors"
echo "- Set up proper monitoring and alerting"
echo "- Configure regular backups"
echo
print_success "Deployment script completed successfully!" 