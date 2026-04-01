import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'local_database.json');

async function fix() {
    console.log('🔍 Reading local_database.json...');
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const db = JSON.parse(data);

    if (!db.products) {
        console.error('❌ No products found in database!');
        return;
    }

    console.log(`📦 Found ${db.products.length} products.`);
    console.log('✨ Setting showInPOS = true for all products...');

    let updatedCount = 0;
    db.products = db.products.map(p => {
        if (p.showInPOS !== true) {
            updatedCount++;
            return { ...p, showInPOS: true };
        }
        return p;
    });

    console.log(`✅ Updated ${updatedCount} products.`);
    
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    console.log('💾 Database saved successfully!');
}

fix().catch(err => {
    console.error('❌ Error:', err.message);
});
