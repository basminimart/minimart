-- แก้ไข RLS Policy สำหรับตาราง orders
-- ให้ทุกคนสามารถ insert ออเดอร์ได้ (ไม่ต้อง login)

-- ลบ policy เก่า
DROP POLICY IF EXISTS "Allow all" ON orders;

-- สร้าง policy ใหม่ที่ allow ทุกคน
CREATE POLICY "Allow all operations" 
ON orders 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- หรือถ้ายังไม่ได้ enable RLS ให้ enable
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
