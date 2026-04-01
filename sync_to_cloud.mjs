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

async function syncToCloud() {
  console.log("☁️ กำลังเตรียมส่งข้อมูลสินค้าขึ้นหน้าเว็บออนไลน์...");

  try {
    // 1. อ่านข้อมูลจากเครื่อง (Local DB)
    const localData = JSON.parse(fs.readFileSync('./local_database.json', 'utf8'));
    const products = localData.products || [];

    if (products.length === 0) {
      console.log("ℹ️ ไม่มีข้อมูลสินค้าในเครื่องที่จะส่งขึ้นเว็บ");
      return;
    }

    console.log(`📦 พบสินค้า ${products.length} รายการ กำลังอัปเดตบน Cloud...`);

    // 2. อัปเดตข้อมูลขึ้น Supabase (ล้างของเก่าแล้วลงของใหม่เพื่อให้ตรงกัน 100%)
    // หมายเหตุ: วิธีนี้ปลอดภัยที่สุดเพื่อให้รายการหน้าเว็บตรงกับหน่า POS
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // ลบทั้งหมดที่มี

    if (deleteError) throw deleteError;

    // เตรียมข้อมูล (ลบฟิลด์ที่ Supabase ไม่ต้องการออก)
    const cloudProducts = products.map(p => {
        const cleanProduct = { ...p };
        delete cleanProduct.posIndex; // กรองฟิลด์เสริมออก
        return cleanProduct;
    });

    // แบ่ง insert เป็น batch ย่อย (100 รายการต่อครั้ง)
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(cloudProducts.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const batch = cloudProducts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      console.log(`  📤 Batch ${i + 1}/${totalBatches}: ${batch.length} รายการ...`);
      
      const { error: insertError } = await supabase
        .from('products')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Batch ${i + 1} failed:`, insertError.message);
        throw insertError;
      }
      
      // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ rate limit
      if (i < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log("✅ ส่งข้อมูลขึ้นหน้าเว็บออนไลน์สำเร็จแล้ว! ลูกค้าเห็นสินค้าแล้วครับ!");

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการ Sync:", err.message);
  }
}

syncToCloud();
