import fs from 'fs';

const DB_PATH = './local_database.json';

try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let totalUpdated = 0;
    
    // IDs or exact names we want to keep
    const targets = [
        "ช้างขวด620ml",
        "เบียร์สิงห์ 620ml",
        "ลีโอ เบียร์ 620 มล."
    ];

    data.products = data.products.map(p => {
        // Find if this product matches any of our targets
        const isMatch = targets.some(name => p.name.includes(name));
        
        let show = isMatch;

        if (p.showInPOS !== show) {
            totalUpdated++;
        }

        return { 
            ...p, 
            showInPOS: show,
            posIndex: isMatch ? targets.indexOf(targets.find(n => p.name.includes(n))) : 999999
        };
    });

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Success: Updated ${totalUpdated} products.`);
    console.log(`📡 POS grid is now exclusively showing the 3 big beers.`);

} catch (error) {
    console.error("❌ Visibility update failed:", error);
}
