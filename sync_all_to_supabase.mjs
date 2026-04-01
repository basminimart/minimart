import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL หรือ ANON_KEY หายไป!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// SQL สำหรับสร้างตารางทั้งหมด
const CREATE_TABLES_SQL = `
-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    barcode TEXT DEFAULT '',
    price NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    "packSize" NUMERIC DEFAULT 1,
    "packPrice" NUMERIC DEFAULT 0,
    "packBarcode" TEXT DEFAULT '',
    "caseSize" NUMERIC DEFAULT 1,
    "casePrice" NUMERIC DEFAULT 0,
    "caseBarcode" TEXT DEFAULT '',
    "minStock" NUMERIC DEFAULT 0,
    zone TEXT DEFAULT '',
    "showInPOS" BOOLEAN DEFAULT false,
    "showInStore" BOOLEAN DEFAULT false,
    "isRecommended" BOOLEAN DEFAULT false,
    "isHero" BOOLEAN DEFAULT false,
    "posIndex" INTEGER DEFAULT 0,
    "soldToday" NUMERIC DEFAULT 0,
    "lastSoldAt" TIMESTAMPTZ,
    image TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    "totalDebt" NUMERIC DEFAULT 0,
    history JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== ORDERS ====================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerId" UUID REFERENCES customers(id),
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    "paymentMethod" TEXT DEFAULT 'cash',
    "shiftId" UUID,
    type TEXT DEFAULT 'pos',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== SHIFTS ====================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "startCash" NUMERIC DEFAULT 0,
    "endCash" NUMERIC,
    "totalSales" NUMERIC DEFAULT 0,
    "totalOrders" INTEGER DEFAULT 0,
    "openedAt" TIMESTAMPTZ DEFAULT now(),
    "closedAt" TIMESTAMPTZ,
    "openedBy" TEXT,
    "closedBy" TEXT
);

-- ==================== SETTINGS ====================
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    "shopName" TEXT DEFAULT 'Minimart POS',
    currency TEXT DEFAULT '฿',
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);
`;

async function createTables() {
  console.log("🔧 กำลังสร้างตารางใน Supabase...");
  
  const statements = CREATE_TABLES_SQL.split(';').filter(s => s.trim());
  
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: sql + ';' });
    if (error) {
      console.log(`⚠️ ข้าม: ${error.message}`);
    }
  }
  
  console.log("✅ ตารางพร้อมใช้งาน");
}

async function syncTable(tableName, data, allowedFields, batchSize = 50) {
  if (!data || data.length === 0) {
    console.log(`ℹ️ ไม่มีข้อมูล ${tableName}`);
    return;
  }

  console.log(`\n📦 ${tableName}: ${data.length} รายการ`);
  
  // Clean data - keep only allowed fields
  const cleanData = data.map(item => {
    const clean = {};
    allowedFields.forEach(field => {
      if (item[field] !== undefined) {
        clean[field] = item[field];
      }
    });
    return clean;
  });

  // Delete existing data
  const { error: deleteError } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.log(`  ⚠️ ลบข้อมูลเก่า: ${deleteError.message}`);
  }

  // Insert in batches
  const totalBatches = Math.ceil(cleanData.length / batchSize);
  let successCount = 0;
  
  for (let i = 0; i < totalBatches; i++) {
    const batch = cleanData.slice(i * batchSize, (i + 1) * batchSize);
    process.stdout.write(`  📤 Batch ${i + 1}/${totalBatches}... `);
    
    const { error } = await supabase.from(tableName).insert(batch);
    
    if (error) {
      console.error(`❌ ${error.message}`);
    } else {
      successCount += batch.length;
      console.log('✅');
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`  ✅ สำเร็จ ${successCount}/${data.length} รายการ`);
}

async function main() {
  console.log("☁️ เริ่มต้น Sync ข้อมูลขึ้น Supabase...\n");
  
  // 1. อ่านข้อมูลจาก local
  console.log("📖 อ่าน local_database.json...");
  const localData = JSON.parse(fs.readFileSync('./local_database.json', 'utf8'));
  
  // 2. สร้างตาราง
  await createTables();
  
  // 3. Sync แต่ละตาราง
  const tableConfigs = {
    products: ['id', 'name', 'barcode', 'price', 'cost', 'stock', 'category', 'unit', 
               'packSize', 'packPrice', 'packBarcode', 'caseSize', 'casePrice', 'caseBarcode',
               'minStock', 'zone', 'showInPOS', 'showInStore', 'isRecommended', 'isHero',
               'posIndex', 'soldToday', 'lastSoldAt', 'image', 'updatedAt', 'createdAt'],
    customers: ['id', 'name', 'phone', 'address', 'totalDebt', 'history', 'createdAt'],
    orders: ['id', 'customerId', 'items', 'total', 'status', 'paymentMethod', 'shiftId', 'type', 'createdAt'],
    shifts: ['id', 'startCash', 'endCash', 'totalSales', 'totalOrders', 'openedAt', 'closedAt', 'openedBy', 'closedBy'],
    settings: ['id', 'shopName', 'currency', 'updatedAt']
  };
  
  for (const [tableName, fields] of Object.entries(tableConfigs)) {
    await syncTable(tableName, localData[tableName] || [], fields);
  }
  
  console.log("\n🎉 Sync เสร็จสิ้น!");
  console.log("🌐 เว็บไซต์: https://minimart-topaz.vercel.app/store");
}

main().catch(err => {
  console.error("\n❌ เกิดข้อผิดพลาด:", err.message);
  console.error(err.stack);
});
