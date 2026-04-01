@echo off
setlocal
set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo.
echo ======================================================
echo 🛠️ Minimart POS - กำลังติดตั้งระบบพื้นฐาน (ครั้งแรก)
echo ======================================================
echo.

:: 1. Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [❌] ไม่พบ Node.js ในเครื่องนี้!
    echo กรุณาไปดาวน์โหลดและติดตั้ง Node.js จาก https://nodejs.org/ ก่อนครับ
    pause
    exit /b
)

:: 2. Install dependencies
echo [📦] กำลังติดตั้ง Library ที่จำเป็น (npm install)...
echo ขั้นตอนนี้อาจใช้เวลา 1-3 นาทีขึ้นอยู่กับอินเทอร์เน็ต (ต้องการเน็ตแค่ครั้งนี้ครั้งเดียว)
echo.
call npm install

echo.
echo [✅] การติดตั้งเสร็จสมบูรณ์!
echo คุณสามารถเปิดใช้งานแอปได้โดยการรันไฟล์ "run_minimart.bat" ครับ
echo.
pause
