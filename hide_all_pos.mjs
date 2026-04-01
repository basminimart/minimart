import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'local_database.json');

async function hideAll() {
    try {
        console.log("🔍 Reading local_database.json...");
        const data = await fs.readFile(DB_FILE, 'utf-8');
        const db = JSON.parse(data);

        if (!db.products) {
            console.error("❌ No products collection found!");
            return;
        }

        console.log(`📦 Found ${db.products.length} products.`);
        console.log("🙈 Hiding all products from POS (setting showInPOS = false)...");

        const updatedProducts = db.products.map(p => ({
            ...p,
            showInPOS: false // Hide from POS by default as requested
        }));

        db.products = updatedProducts;
        db.meta = { lastUpdate: new Date().toISOString() };

        await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
        console.log("✅ Successfully hid all products from POS!");
        console.log("💡 You can now manually select which ones to show in the Inventory page.");

    } catch (err) {
        console.error("❌ Error updating database:", err.message);
    }
}

hideAll();
