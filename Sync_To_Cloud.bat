@echo off
setlocal
title Minimart Cloud Sync Engine
echo ======================================================
echo MINIMART - SYNC LOCAL PRODUCTS TO CLOUD STORE
echo ======================================================
echo.

REM 1. Run the Node.js Sync Script
echo [*] Processing data...
node sync_to_cloud.mjs

echo.
echo ======================================================
echo ✅ SYNC COMPLETE! Your customers can now see your products online.
echo ======================================================
echo.
pause
