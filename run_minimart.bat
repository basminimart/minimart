@echo off
setlocal
title Minimart POS - ULTRA-WIDE DUAL SCREEN
echo ======================================================
echo MINIMART POS - CONFIG FOR DUAL SCREEN (HARD-STABLE)
echo ======================================================
echo.

REM --- 1. AUTO REPAIR ---
if exist "node_modules\" goto START_SERVER
echo [!] System components missing. Auto-installing...
call npm install

:START_SERVER
REM --- 2. MONITOR CONFIG ---
set "MON2_X=-1920"
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "%CHROME_EXE%" goto HAVE_CHROME
set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

:HAVE_CHROME
REM --- 3. START ENGINES ---
echo [*] Starting Local Data Server...
start /b node local_server.mjs

echo [*] Starting Frontend Engine...
start /b npx vite --host

echo [*] Waiting for system to warm up (10 seconds)...
timeout /t 10 /nobreak > nul

REM --- 4. LAUNCH WINDOWS (NO BRACKETS VERSION) ---
if not exist "%CHROME_EXE%" goto NO_CHROME_FOUND

echo [*] Launching POS on Main Monitor (Right)...
start "" "%CHROME_EXE%" --new-window --window-position=0,0 --start-maximized "http://localhost:5173"

echo [*] Launching Customer Display on Monitor 2 (Left)...
timeout /t 2 /nobreak > nul
start "" "%CHROME_EXE%" --new-window --app="http://localhost:5173/customer-display" --window-position=%MON2_X%,0 --start-fullscreen
goto SUCCESS_END

:NO_CHROME_FOUND
echo [!] Chrome not found. Opening in default browser.
start http://localhost:5173
start http://localhost:5173/customer-display

:SUCCESS_END
echo.
echo ======================================================
echo ✅ MINIMART POS IS NOW RUNNING!
echo POS - RIGHT MONITOR (3440)
echo CUSTOMER - LEFT MONITOR (-1920)
echo ======================================================
echo.
pause
