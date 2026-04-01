import fs from 'fs';

const DB_PATH = './local_database.json';

try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let totalUpdated = 0;

    data.products = data.products.map(p => {
        // 1. CLEAR ALL from POS
        let show = false;

        // 2. EXCEPTION: Specifically FORCE the 3 requested beers to show
        const isTargetBeer = 
            p.name.includes("เบียร์สิงห์ 620ml") || 
            p.name.includes("ช้างขวด620ml") || 
            p.name.includes("ลีโอ เบียร์ 620 มล.");

        if (isTargetBeer) {
            show = true;
            console.log(`🍻 Found and Unlocked: ${p.name}`);
        }

        if (p.showInPOS !== show) {
            totalUpdated++;
        }

        return { 
            ...p, 
            showInPOS: show,
            isHero: isTargetBeer ? true : (p.isHero || false) // Ensure they pass any hero filters
        };
    });

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Success: Reset visibility for ${totalUpdated} products.`);
    console.log(`📡 POS is now CLEAN. Only Singha, Chang, and Leo are forced active.`);

} catch (error) {
    console.error("❌ Database reset failed:", error);
}
