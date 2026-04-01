# Minimart POS - คู่มือการติดตั้งบนเครื่องใหม่

## วิธีที่ 1: ใช้ Dev Server (แนะนำสำหรับทดสอบ)

1. แตกไฟล์ ZIP
2. เปิด Terminal/Command Prompt ในโฟลเดอร์
3. รันคำสั่ง:
   ```
   npm install
   npm run dev
   ```
4. เปิด browser ไปที่ http://localhost:5173

## วิธีที่ 2: ใช้ Production Build (แนะนำสำหรับใช้จริง)

### ขั้นตอนที่ 1: Build บนเครื่องต้นทาง
```
npm install
npm run build
```

### ขั้นตอนที่ 2: คัดลอกไปเครื่องเป้าหมาย
คัดลอกโฟลเดอร์ทั้งหมดไปเครื่องใหม่ รวมถึง:
- dist/
- local_server.mjs
- package.json
- .env
- START.bat

### ขั้นตอนที่ 3: รันบนเครื่องเป้าหมาย
1. เปิด Command Prompt ในโฟลเดอร์
2. รัน:
   ```
   START.bat
   ```
   หรือ
   ```
   node local_server.mjs
   ```
3. เปิด browser ไปที่ http://localhost:5005

## ไฟล์ที่จำเป็นต้องมี

- `.env` - ต้องมีค่า Supabase
- `local_server.mjs` - server สำหรับเก็บข้อมูล local
- `dist/` - โฟลเดอร์ build (ต้อง build ก่อน)
- `node_modules/` - dependencies (หรือรัน npm install ใหม่)

## แก้ปัญหาเบื้องต้น

### "กำลังเริ่มระบบ..." ค้างนาน
- ตรวจสอบว่า local_server.mjs รันอยู่
- ตรวจสอบว่า .env มีค่า Supabase ถูกต้อง
- เปิด F12 → Console ดู error

### เปิดแล้วเป็นหน้าขาว
- ตรวจสอบว่า dist/assets/ ไม่ว่างเปล่า
- ต้องรัน npm run build ก่อน deploy

### จัดเรียงสินค้าแล้วบันทึกไม่ได้
- ตรวจสอบว่า local_server.mjs รันอยู่
- ดู error ใน Console (F12)

## ติดต่อ
- GitHub: https://github.com/basminimart/minimart.git
