@echo off
echo.
echo ========================================================
echo ☁️  MiniMart Sync: Cloud -> Local Disk
echo ========================================================
echo.
echo [📡] กำลังดึงข้อมูลสินค้าจาก Supabase (Cloud)...
node sync_to_disk.mjs
echo.
echo [✅] เสร็จสิ้น! ข้อมูลถูกเก็บไว้ในไฟล์ local_database.json แล้ว
echo [📦] ก่อนการ Zip โฟลเดอร์เพื่อย้ายเครื่อง "อย่าลืมรันไฟล์นี้เสมอ"
echo.
pause
