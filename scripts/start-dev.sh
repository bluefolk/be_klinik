#!/bin/bash

# Development startup script for Payment Backend

echo "🚀 Starting Payment Backend in development mode..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please copy env.example to .env and configure your environment variables"
    echo "   cp env.example .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
echo "🔥 Starting server with nodemon..."
npm run dev 