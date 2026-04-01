@echo off
echo ==========================================
echo Starting Minimart POS...
echo ==========================================
echo.
echo Step 1: Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js found.
echo.

echo Step 2: Installing dependencies (if needed)...
if not exist node_modules (
    call npm install
)
echo.

echo Step 3: Starting local server...
echo The POS will open automatically in your browser.
echo.
echo URL: http://localhost:5005
echo.
echo Press Ctrl+C to stop the server.
echo ==========================================

start http://localhost:5005
node local_server.mjs
