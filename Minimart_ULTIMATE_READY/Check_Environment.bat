@echo off
setlocal
echo ======================================================
echo MINIMART POS - SYSTEM CHECK
echo ======================================================
echo.

:: 1. Check Node.js
echo [*] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] !!! NO NODE.JS FOUND !!!
    echo.
    echo Please download and install Node.js from: https://nodejs.org/
    echo Install the (LTS) version. After installing, try running the POS again.
    goto :FAIL
) else (
    echo [OK] Node.js is installed.
)

:: 2. Check NPM
echo [*] Checking for NPM...
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NPM not found. Something is wrong with your Node.js installation.
    goto :FAIL
) else (
    echo [OK] NPM is installed.
)

:: 3. Check Folder Permission
echo [*] Checking folder access...
echo test > .perm_test 2>nul
if exist .perm_test (
    echo [OK] Folder is writable.
    del .perm_test
) else (
    echo [ERROR] Restricted folder. Try moving the folder to C:\Minimart
    goto :FAIL
)

echo.
echo ======================================================
echo SUCCESS: Your computer is ready to run the POS!
echo You can now close this and run 'run_minimart.bat'
echo ======================================================
goto :END

:FAIL
echo.
echo ======================================================
echo FAILED: Please fix the errors above first.
echo ======================================================
:END
pause
