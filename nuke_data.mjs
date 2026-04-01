import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'local_database.json');

async function nukeData() {
    try {
        const raw = await fs.readFile(DB_FILE, 'utf-8');
        const db = JSON.parse(raw);
        
        console.log(`[Cleaner] 🧹 Cleaning up... Current orders: ${db.orders?.length || 0}, Current shifts: ${db.shifts?.length || 0}`);
        
        // Reset only transactional data
        db.orders = [];
        db.shifts = [];
        // Keep products, customers, and settings
        
        db.meta = { lastUpdate: new Date().toISOString(), action: 'nuked' };
        
        await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
        console.log(`[Cleaner] ✨ DONE! Your dashboard will now be 0 Baht.`);
        console.log(`[Cleaner] 🚀 Please RESTART your 'run_minimart.bat' to see changes.`);
        
    } catch (err) {
        console.error("Error cleaning database:", err.message);
    }
}

nukeData();
