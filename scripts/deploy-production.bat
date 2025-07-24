@echo off
setlocal enabledelayedexpansion

REM Production Deployment Script for Klinik Payment Backend (Windows)
REM This script sets up the backend for production deployment

echo 🚀 Starting production deployment...

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [WARNING] This script should not be run as administrator
    pause
    exit /b 1
)

REM Check Node.js version
echo [INFO] Checking Node.js version...
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
if "%NODE_VERSION%"=="" (
    echo [ERROR] Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo [SUCCESS] Node.js version %NODE_VERSION% found

REM Check npm version
echo [INFO] Checking npm version...
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VERSION=%%i
if "%NPM_VERSION%"=="" (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)

echo [SUCCESS] npm version %NPM_VERSION% found

REM Check if .env file exists
if not exist ".env" (
    echo [ERROR] .env file not found. Please create it from env.example
    echo [INFO] Copying env.example to .env...
    copy "env.example" ".env" >nul
    echo [WARNING] Please edit .env file with your production credentials before continuing
    pause
    exit /b 1
)

echo [SUCCESS] .env file found

REM Install dependencies
echo [INFO] Installing dependencies...
call npm ci --only=production
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [SUCCESS] Dependencies installed successfully

REM Run security audit
echo [INFO] Running security audit...
call npm audit --audit-level=moderate
if %errorLevel% neq 0 (
    echo [WARNING] Security audit found vulnerabilities. Please review and fix them
    set /p CONTINUE="Do you want to continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        pause
        exit /b 1
    )
)

echo [SUCCESS] Security audit passed

REM Create logs directory
echo [INFO] Creating logs directory...
if not exist "logs" mkdir logs

REM Test the application
echo [INFO] Testing the application...
node -e "const app = require('./server.js'); const http = require('http'); const server = http.createServer(app); server.listen(0, () => { const port = server.address().port; console.log('Server started on port ' + port); server.close(() => { console.log('Test completed successfully'); process.exit(0); }); });"
if %errorLevel% neq 0 (
    echo [ERROR] Application test failed
    pause
    exit /b 1
)

echo [SUCCESS] Application test passed

REM Create PM2 ecosystem file
echo [INFO] Creating PM2 ecosystem file...
(
echo module.exports = {
echo   apps: [{
echo     name: 'klinik-payment-backend',
echo     script: 'server.js',
echo     instances: 'max',
echo     exec_mode: 'cluster',
echo     env: {
echo       NODE_ENV: 'production',
echo       PORT: 3000
echo     },
echo     error_file: './logs/err.log',
echo     out_file: './logs/out.log',
echo     log_file: './logs/combined.log',
echo     time: true,
echo     max_memory_restart: '1G',
echo     node_args: '--max-old-space-size=1024',
echo     restart_delay: 4000,
echo     max_restarts: 10,
echo     min_uptime: '10s'
echo   }]
echo };
) > ecosystem.config.js

echo [SUCCESS] PM2 ecosystem file created

REM Create Windows service configuration (using nssm)
echo [INFO] Creating Windows service configuration...
(
echo @echo off
echo REM Install as Windows Service using nssm
echo REM Download nssm from: https://nssm.cc/download
echo REM Then run: nssm install KlinikPaymentBackend
echo REM Set path: nssm set KlinikPaymentBackend Application "C:\Program Files\nodejs\node.exe"
echo REM Set args: nssm set KlinikPaymentBackend AppParameters "server.js"
echo REM Set directory: nssm set KlinikPaymentBackend AppDirectory "%~dp0"
echo REM Set environment: nssm set KlinikPaymentBackend AppEnvironmentExtra NODE_ENV=production
echo REM Start service: net start KlinikPaymentBackend
echo REM Stop service: net stop KlinikPaymentBackend
echo REM Remove service: nssm remove KlinikPaymentBackend confirm
) > install-windows-service.bat

echo [SUCCESS] Windows service configuration created

REM Create IIS web.config for reverse proxy
echo [INFO] Creating IIS web.config...
(
echo ^<?xml version="1.0" encoding="UTF-8"?^>
echo ^<configuration^>
echo   ^<system.webServer^>
echo     ^<rewrite^>
echo       ^<rules^>
echo         ^<rule name="ReverseProxyInboundRule1" stopProcessing="true"^>
echo           ^<match url="^\(.*\)" /^>
echo           ^<conditions logicalGrouping="MatchAll" trackAllCaptures="false"^>
echo             ^<add input="{CACHE_URL}" pattern="^\(.*\)" /^>
echo           ^</conditions^>
echo           ^<action type="Rewrite" url="http://localhost:3000/{R:1}" /^>
echo         ^</rule^>
echo       ^</rules^>
echo     ^</rewrite^>
echo     ^<security^>
echo       ^<requestFiltering^>
echo         ^<requestLimits maxAllowedContentLength="10485760" /^>
echo       ^</requestFiltering^>
echo     ^</security^>
echo     ^<httpProtocol^>
echo       ^<customHeaders^>
echo         ^<add name="X-Frame-Options" value="DENY" /^>
echo         ^<add name="X-Content-Type-Options" value="nosniff" /^>
echo         ^<add name="X-XSS-Protection" value="1; mode=block" /^>
echo         ^<add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" /^>
echo       ^</customHeaders^>
echo     ^</httpProtocol^>
echo   ^</system.webServer^>
echo ^</configuration^>
) > web.config

echo [SUCCESS] IIS web.config created

REM Create deployment checklist
echo [INFO] Creating deployment checklist...
(
echo # Production Deployment Checklist
echo.
echo ## Pre-deployment
echo - [ ] Environment variables configured in .env
echo - [ ] Firebase credentials verified
echo - [ ] Midtrans production keys configured
echo - [ ] SSL certificate installed ^(if using IIS^)
echo - [ ] Domain DNS configured
echo - [ ] Database backup completed ^(if applicable^)
echo.
echo ## Security
echo - [ ] Windows Firewall rules configured
echo - [ ] Rate limiting enabled
echo - [ ] CORS origins restricted
echo - [ ] Helmet security headers enabled
echo - [ ] Environment variables secured
echo - [ ] Log files permissions set correctly
echo.
echo ## Monitoring
echo - [ ] Health check endpoint accessible
echo - [ ] Log monitoring configured
echo - [ ] Error tracking service configured ^(optional^)
echo - [ ] Performance monitoring enabled ^(optional^)
echo.
echo ## Testing
echo - [ ] API endpoints tested
echo - [ ] Payment flow tested with test transactions
echo - [ ] Error handling verified
echo - [ ] Load testing completed ^(recommended^)
echo.
echo ## Post-deployment
echo - [ ] Service started successfully
echo - [ ] Health check passing
echo - [ ] Payment notifications working
echo - [ ] Logs being generated correctly
echo - [ ] Monitoring alerts configured
echo.
echo ## Maintenance
echo - [ ] Regular log rotation configured
echo - [ ] Database cleanup scheduled
echo - [ ] Security updates automated
echo - [ ] Backup strategy implemented
) > DEPLOYMENT_CHECKLIST.md

echo [SUCCESS] Deployment checklist created

REM Create start script
echo [INFO] Creating start script...
(
echo @echo off
echo echo Starting Klinik Payment Backend...
echo set NODE_ENV=production
echo node server.js
) > start-production.bat

echo [SUCCESS] Start script created

REM Final summary
echo.
echo [SUCCESS] Production deployment setup completed!
echo.
echo [INFO] Next steps:
echo 1. Edit .env file with your production credentials
echo 2. Configure your reverse proxy ^(IIS/nginx^)
echo 3. Set up SSL certificates
echo 4. Configure Windows Firewall rules
echo 5. Start the application:
echo    - Using PM2: pm2 start ecosystem.config.js
echo    - Using Windows Service: install-windows-service.bat
echo    - Direct: start-production.bat
echo.
echo [INFO] Check DEPLOYMENT_CHECKLIST.md for detailed steps
echo.
echo [WARNING] Remember to:
echo - Test payment flows with small amounts first
echo - Monitor logs for any errors
echo - Set up proper monitoring and alerting
echo - Configure regular backups
echo.
echo [SUCCESS] Deployment script completed successfully!
pause 