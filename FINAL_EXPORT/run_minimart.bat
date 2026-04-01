@echo off
setlocal
title Minimart POS - ULTRA-WIDE DUAL SCREEN
echo ======================================================
echo MINIMART POS - CONFIG FOR DUAL SCREEN (FORCE SEPARATE)
echo ======================================================
echo.

:: 1. AUTO REPAIR: Check and Install dependencies
if not exist "node_modules\" (
    echo [!] System components missing. Auto-installing...
    call npm install
)

:: 2. MONITOR CONFIG (DETERMINED FROM SYSTEM SETTINGS)
:: Monitor 2 (Left) is 1920 wide -> Coordinate is -1920
set "MON2_X=-1920"
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

:: 3. Start Data Server (Backend)
echo [*] Starting Local Data Server...
start /b node local_server.mjs

:: 4. Start Frontend Engine (Vite)
echo [*] Starting Frontend Engine...
start /b npx vite --host

:: Wait for Everything to be warm and ready ☀️
echo [*] Waiting for system to warm up (10 seconds)...
timeout /t 10 /nobreak > nul

:: 5. Launch Chrome Windows (FORCE SEPARATE WINDOWS) 🛰️
if exist "%CHROME_EXE%" (
    echo [*] Launching POS on Main Monitor (Right)...
    :: Use --new-window to prevent tabbing
    start "" "%CHROME_EXE%" --new-window --window-position=0,0 --start-maximized "http://localhost:5173"

    echo [*] Launching Customer Display on Monitor 2 (Left)...
    :: Wait 2 seconds before 2nd window to let Chrome handle the positioning
    timeout /t 2 /nobreak > nul
    start "" "%CHROME_EXE%" --new-window --app="http://localhost:5173/customer-display" --window-position=%MON2_X%,0 --start-fullscreen
) else (
    echo [!] Chrome not found. Opening in default browser.
    start http://localhost:5173
    start http://localhost:5173/customer-display
)

echo.
echo ======================================================
echo ✅ MINIMART POS IS NOW RUNNING!
echo POS -> RIGHT MONITOR (3440)
echo CUSTOMER -> LEFT MONITOR (-1920)
echo ======================================================
echo.
pause
