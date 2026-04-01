import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL หรือ ANON_KEY หายไปในไฟล์ .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Fields ที่มีใน Supabase schema เท่านั้น
const ALLOWED_FIELDS = [
  'id', 'name', 'barcode', 'price', 'cost', 'stock', 'category', 'unit',
  'packSize', 'packPrice', 'packBarcode', 'caseSize', 'casePrice', 'caseBarcode',
  'minStock', 'zone', 'showInPOS', 'showInStore', 'isRecommended', 'isHero',
  'posIndex', 'soldToday', 'lastSoldAt', 'image', 'updatedAt', 'createdAt'
];

async function syncToCloud() {
  console.log("☁️ กำลังเตรียมส่งข้อมูลสินค้าขึ้นหน้าเว็บออนไลน์...");

  try {
    // 1. อ่านข้อมูลจากเครื่อง (Local DB)
    console.log("📖 กำลังอ่าน local_database.json...");
    const localData = JSON.parse(fs.readFileSync('./local_database.json', 'utf8'));
    const products = localData.products || [];

    if (products.length === 0) {
      console.log("ℹ️ ไม่มีข้อมูลสินค้าในเครื่องที่จะส่งขึ้นเว็บ");
      return;
    }

    console.log(`📦 พบสินค้า ${products.length} รายการ`);

    // 2. ล้างข้อมูลเก่าใน Supabase
    console.log("🗑️  กำลังลบข้อมูลเก่าใน Supabase...");
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('⚠️ Delete warning:', deleteError.message);
    } else {
      console.log('✅ ลบข้อมูลเก่าแล้ว');
    }

    // 3. เตรียมข้อมูล (กรองเฉพาะ field ที่ Supabase รองรับ)
    console.log("🔧 กำลังเตรียมข้อมูล...");
    const cloudProducts = products.map(p => {
      const cleanProduct = {};
      ALLOWED_FIELDS.forEach(field => {
        if (p[field] !== undefined) {
          cleanProduct[field] = p[field];
        }
      });
      return cleanProduct;
    });

    // 4. แบ่ง insert เป็น batch ย่อย (50 รายการต่อครั้ง)
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(cloudProducts.length / BATCH_SIZE);
    
    console.log(`🚀 กำลังส่งข้อมูล ${totalBatches} batches...`);
    
    for (let i = 0; i < totalBatches; i++) {
      const batch = cloudProducts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      process.stdout.write(`  📤 Batch ${i + 1}/${totalBatches}... `);
      
      const { error: insertError } = await supabase
        .from('products')
        .insert(batch);

      if (insertError) {
        console.error(`❌ FAILED: ${insertError.message}`);
        if (insertError.details) console.error('   Details:', insertError.details);
        // Continue with next batch instead of throwing
        continue;
      }
      
      console.log('✅');
      
      // หน่วงเวลาเล็กน้อย
      if (i < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log("\n✅ ส่งข้อมูลสำเร็จ! ลูกค้าเห็นสินค้าแล้วครับ!");
    console.log("🌐 URL: https://minimart-topaz.vercel.app/store");

  } catch (err) {
    console.error("\n❌ เกิดข้อผิดพลาด:", err.message);
    console.error(err.stack);
  }
}

syncToCloud();
