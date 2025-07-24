@echo off
REM Development startup script for Payment Backend (Windows)

echo 🚀 Starting Payment Backend in development mode...

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo 📝 Please copy env.example to .env and configure your environment variables
    echo    copy env.example .env
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
)

REM Start the development server
echo 🔥 Starting server with nodemon...
npm run dev 