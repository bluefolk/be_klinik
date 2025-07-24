# Payment Backend Service

A production-ready backend service for handling payment transactions using Express.js, Firebase Firestore, and Midtrans Snap API.

## 🚀 Features

- **Express.js** backend with security middleware
- **Firebase Firestore** integration for data persistence
- **Midtrans Snap API** for payment processing
- **Comprehensive validation** and error handling
- **Production-ready** with proper logging and monitoring
- **RESTful API** design with clear endpoints

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Midtrans account with API credentials

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd payment-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your credentials:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Midtrans Configuration
   MIDTRANS_SERVER_KEY=your_midtrans_server_key
   MIDTRANS_CLIENT_KEY=your_midtrans_client_key
   MIDTRANS_IS_PRODUCTION=false
   
   # Firebase Configuration
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Firebase Private Key Here\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=your_firebase_client_email@your_project.iam.gserviceaccount.com
   ```

4. **Set up Firebase**
   - Go to Firebase Console
   - Create a new project or use existing one
   - Enable Firestore Database
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Download the JSON file and extract the required fields

5. **Set up Midtrans**
   - Create a Midtrans account
   - Get your Server Key and Client Key from the dashboard
   - For testing, use the sandbox environment

## 🚀 Running the Application

### Quick Start (Development)
```bash
# On Linux/Mac
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh

# On Windows
scripts\start-dev.bat
```

### Manual Start

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### 1. Create Transaction
**POST** `/create-transaction`

Creates a new payment transaction and returns Midtrans Snap token.

**Request Body:**
```json
{
  "order_id": "ORDER_123456",
  "amount": 100000,
  "customer_details": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "081234567890"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "order_id": "ORDER_123456",
    "snap_token": "abc123...",
    "redirect_url": "https://app.midtrans.com/snap/v2/vtweb/abc123..."
  }
}
```

#### 2. Payment Notification
**POST** `/notification`

Handles payment status updates from Midtrans.

**Request Body:** (Sent by Midtrans)
```json
{
  "order_id": "ORDER_123456",
  "transaction_status": "settlement",
  "signature_key": "abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification processed successfully",
  "data": {
    "order_id": "ORDER_123456",
    "status": "success"
  }
}
```

#### 3. Get Order Details
**GET** `/order/:orderId`

Retrieves order details and payment status.

**Response:**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "order_id": "ORDER_123456",
    "amount": 100000,
    "status": "success",
    "customer_details": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "081234567890"
    },
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:05:00.000Z"
  }
}
```

#### 4. Check Payment Status
**GET** `/check-status/:orderId`

Manually checks payment status via Midtrans API.

**Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "order_id": "ORDER_123456",
    "transaction_status": "settlement",
    "payment_type": "bank_transfer",
    "gross_amount": "100000",
    "transaction_time": "2024-01-01 00:05:00"
  }
}
```

## 🧪 Testing

### Using the Test Script
```bash
# Install axios for testing
npm install axios

# Run the test script
node test/test-api.js
```

### Using cURL

1. **Create a transaction:**
   ```bash
   curl -X POST http://localhost:3000/api/create-transaction \
     -H "Content-Type: application/json" \
     -d '{
       "order_id": "TEST_ORDER_001",
       "amount": 50000,
       "customer_details": {
         "name": "Test User",
         "email": "test@example.com",
         "phone": "081234567890"
       }
     }'
   ```

2. **Get order details:**
   ```bash
   curl http://localhost:3000/api/order/TEST_ORDER_001
   ```

3. **Check payment status:**
   ```bash
   curl http://localhost:3000/api/check-status/TEST_ORDER_001
   ```

### Using Postman

Import the following collection:

```json
{
  "info": {
    "name": "Payment API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Transaction",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"order_id\": \"TEST_ORDER_001\",\n  \"amount\": 50000,\n  \"customer_details\": {\n    \"name\": \"Test User\",\n    \"email\": \"test@example.com\",\n    \"phone\": \"081234567890\"\n  }\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/create-transaction",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "create-transaction"]
        }
      }
    }
  ]
}
```

## 🔒 Security Features

- **Helmet.js** for security headers
- **CORS** configuration
- **Input validation** and sanitization
- **Error handling** without exposing sensitive information
- **Request logging** for monitoring

## 📊 Firestore Structure

### Collection: `orders`

```javascript
{
  order_id: "ORDER_123456",
  amount: 100000,
  status: "success", // pending, success, failed
  customer_details: {
    name: "John Doe",
    email: "john@example.com",
    phone: "081234567890"
  },
  midtrans_response: {
    // Full Midtrans API response
  },
  created_at: Timestamp,
  updated_at: Timestamp
}
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=your_production_server_key
MIDTRANS_CLIENT_KEY=your_production_client_key
FIREBASE_PROJECT_ID=your_production_project_id
FIREBASE_PRIVATE_KEY="your_production_private_key"
FIREBASE_CLIENT_EMAIL=your_production_client_email
NOTIFICATION_URL=https://your-domain.com/api/notification
```

### Deployment Platforms

- **Heroku**: Use the provided `Procfile`
- **Vercel**: Configure as Node.js project
- **AWS**: Use Elastic Beanstalk or EC2
- **Google Cloud**: Use App Engine or Cloud Run

## 🔧 Configuration

### Midtrans Configuration

1. **Sandbox Environment** (for testing):
   - Server Key: `SB-Mid-server-...`
   - Client Key: `SB-Mid-client-...`
   - Set `MIDTRANS_IS_PRODUCTION=false`

2. **Production Environment**:
   - Server Key: `Mid-server-...`
   - Client Key: `Mid-client-...`
   - Set `MIDTRANS_IS_PRODUCTION=true`

### Firebase Configuration

1. **Service Account Setup**:
   - Download service account JSON from Firebase Console
   - Extract required fields to environment variables
   - Ensure Firestore rules allow read/write access

## 📝 Logging

The application includes comprehensive logging:

- **Request logging**: All incoming requests
- **Error logging**: Detailed error information
- **Transaction logging**: Payment processing events
- **Console output**: Development-friendly logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

1. Check the [Issues](../../issues) page
2. Review the API documentation
3. Contact the development team

## 🔄 Changelog

### v1.0.0
- Initial release
- Basic payment transaction functionality
- Firebase Firestore integration
- Midtrans Snap API integration
- Comprehensive error handling
- Production-ready security features 