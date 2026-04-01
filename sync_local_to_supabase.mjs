// =====================================================
// 🚀 SYNC LOCAL TO SUPABASE
// ดึงข้อมูลจากไฟล์เครื่อง (local_database.json) -> Supabase ใหม่
// =====================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ใช้ข้อมูลจาก .env (ที่อัปเดตเป็นของใหม่แล้ว)
const NEW_URL = 'https://axymwdgufxbsrpsvtioe.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4eW13ZGd1Znhic3Jwc3Z0aW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1ODU2MCwiZXhwIjoyMDkwNjM0NTYwfQ.FzyCYXzUF7-qSS1Qt8fCkuQ0I7Y5GtpNHauhZvLoGRQ';

const supabase = createClient(NEW_URL, NEW_KEY);

const JSON_FILE = './local_database.json';
const TABLES = ['settings', 'products', 'customers', 'shifts', 'orders'];

async function syncTable(table, data) {
    if (!data || data.length === 0) {
        console.log(`  ⏭️  No data for ${table}, skipping.`);
        return 0;
    }

    console.log(`📦 Syncing: ${table} (${data.length} rows)...`);

    // Mapping & Sanitizing Data
    let processedData = data;
    if (table === 'products') {
        processedData = data.map(row => {
            // ดึงเฉพาะคอลัมน์ที่ "ชัวร์" ว่าอยู่ในฐานข้อมูลแน่นอนเพื่อป้องกัน Schema Cache Error
            return {
                id: row.id,
                name: row.name || '',
                barcode: row.barcode || '',
                price: row.price || 0,
                cost: row.cost || 0,
                stock: row.stock || 0,
                category: row.category || '',
                unit: row.unit || '',
                packSize: row.packSize || 1,
                packPrice: row.packPrice || 0,
                packBarcode: row.packBarcode || '',
                caseSize: row.caseSize || 1,
                casePrice: row.casePrice || 0,
                caseBarcode: row.caseBarcode || '',
                minStock: row.minStock || 0,
                zone: row.zone || '',
                showInPOS: row.showInPOS || false,
                showInStore: row.showInStore || false,
                isRecommended: row.isRecommended || false,
                isHero: row.isHero || false,
                posIndex: row.posIndex || 0,
                updatedAt: row.updatedAt || new Date().toISOString(),
                createdAt: row.createdAt || new Date().toISOString()
            };
        });
    } else if (table === 'orders') {
        processedData = data.map(row => ({
            ...row,
            paymentProof: row.paymentProof || row.slipUrl || null,
            customerAddress: row.customerAddress || row.shippingAddress || row.addressMemo || '',
            note: row.note || row.addressMemo || row.deliveryTime || ''
        }));
    }

    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < processedData.length; i += CHUNK) {
        const chunk = processedData.slice(i, i + CHUNK);
        const { error } = await supabase
            .from(table)
            .upsert(chunk, { onConflict: 'id' });

        if (error) {
            console.error(`  ❌ Error in ${table} chunk:`, error.message);
            // ลองส่งทีละตัวถ้าค้าง
            for (const item of chunk) {
                const { error: err } = await supabase.from(table).upsert(item, { onConflict: 'id' });
                if (!err) inserted++;
            }
        } else {
            inserted += chunk.length;
        }
        process.stdout.write(`  Progress: ${inserted}/${processedData.length}\r`);
    }
    console.log(`\n  ✅ Done: ${table}`);
    return inserted;
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 LOCAL SYNC: [local_database.json] -> [New Supabase]');
    console.log('='.repeat(60));

    if (!fs.existsSync(JSON_FILE)) {
        console.error('❌ Error: local_database.json not found!');
        return;
    }

    const rawData = fs.readFileSync(JSON_FILE, 'utf8');
    const db = JSON.parse(rawData);

    let total = 0;
    for (const table of TABLES) {
        if (db[table]) {
            total += await syncTable(table, db[table]);
        }
    }

    console.log('='.repeat(60));
    console.log(`🎉 SYNC COMPLETE! Total ${total} rows uploaded.`);
    console.log('='.repeat(60));
}

main().catch(console.error);
