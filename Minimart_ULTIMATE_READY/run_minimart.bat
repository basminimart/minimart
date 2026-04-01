@echo off
setlocal
title Minimart POS - ULTRA-WIDE DUAL SCREEN
echo ======================================================
echo MINIMART POS - CONFIG FOR DUAL SCREEN
echo ======================================================
echo.

:: 1. AUTO REPAIR: Check and Install dependencies
if not exist "node_modules\" (
    echo [!] System components missing. Auto-installing...
    call npm install
)

:: 2. MONITOR CONFIG
:: Monitor 1 width is 3440
set "MON_X=3440"
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

:: 3. Start Data Server (Backend)
echo [*] Starting Local Data Server...
start /b node local_server.mjs

:: 4. Start Frontend Engine (Vite) with --host to fix IPv6 issues
echo [*] Starting Frontend Engine...
start /b npx vite --host

:: Wait for Everything to be warm and ready 🔥
echo [*] Waiting for system to warm up (10 seconds)...
timeout /t 10 /nobreak > nul

:: 5. Launch Chrome Windows (Only after everything is ready)
if exist "%CHROME_EXE%" (
    echo [*] Launching POS on Main Monitor...
    start "" "%CHROME_EXE%" --window-position=0,0 "http://localhost:5173"

    echo [*] Launching Customer Display on Monitor 2...
    start "" "%CHROME_EXE%" --app="http://localhost:5173/customer-display" --window-position=%MON_X%,0 --start-fullscreen --user-data-dir="%temp%\chrome_customer_display"
) else (
    echo [!] Chrome not found. Opening in default browser.
    start http://localhost:5173
    start http://localhost:5173/customer-display
)

echo.
echo ======================================================
echo ✅ MINIMART POS IS NOW RUNNING!
echo Close this window to STOP everything.
echo ======================================================
echo.
pause
