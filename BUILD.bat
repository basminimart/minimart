@echo off
echo ==========================================
echo Building Minimart POS for Deployment...
echo ==========================================

REM Clean old build
if exist dist rmdir /s /q dist

REM Install dependencies
npm install

REM Build
call npm run build

REM Create deployment folder
if exist deploy rmdir /s /q deploy
mkdir deploy

REM Copy dist folder
copy dist deploy\

REM Copy required files
copy local_server.mjs deploy\
copy package.json deploy\
copy .env deploy\
copy START.bat deploy\

echo ==========================================
echo Build Complete!
echo ==========================================
echo.
echo Deploy folder created.
echo To deploy on another machine:
echo 1. Copy the 'deploy' folder to target machine
echo 2. Run START.bat on the target machine
echo.
pause
