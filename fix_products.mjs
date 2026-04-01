import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'local_database.json');

async function fixProducts() {
    try {
        const raw = await fs.readFile(DB_FILE, 'utf-8');
        const db = JSON.parse(raw);
        
        let count = 0;
        db.products.forEach(p => {
            const name = p.name || '';
            // Check for Beer brands mentioned by user
            if (name.includes('ลีโอ') || name.includes('สิงห์') || name.includes('ช้าง')) {
                if (p.showInPOS !== true) {
                    p.showInPOS = true;
                    count++;
                }
            }
        });
        
        if (count > 0) {
            await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
            console.log(`✅ Successfully enabled ${count} beer products to show in POS.`);
        } else {
            console.log(`ℹ️ All target beer products were already enabled.`);
        }
    } catch (err) {
        console.error("Error fixing products:", err.message);
    }
}

fixProducts();
