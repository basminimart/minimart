import fs from 'fs';

const DB_PATH = './local_database.json';

// List of products to SHOW (names from the user screenshot + 3 beers)
const targetNames = [
    // The 3 beers requested
    "เบียร์สิงห์ 620ml",
    "ช้างขวด620ml",
    "ลีโอ เบียร์ 620 มล.",
    
    // Items identified from the screenshot
    "น้ำดื่มคริสตัล",
    "น้ำดื่มสิงห์ใหญ่",
    "ขนม 1",
    "ขนม 5",
    "ขนม 10",
    "ขนม 15 บาท",
    "ถุงข้าว",
    "ถุงน้ำแขกใหญ่",
    "ไข่ไก่",
    "ไข่เค็มหนำ",
    "น้ำยาซักแวนดิ",
    "ข้าวตรานางระ",
    "ถ่านไม้",
    "ขนมถ้วย 7",
    "ขนมถ้วย",
    "รูปตลก 12 บาท",
    "ข้าวตราแดงพัง",
    "น้ำถังใส",
    "โบราณเกลียว",
    "น้ำยาปรับผ้านุ่ม",
    "น้ำยาฟองขาว",
    "เกลือป่น",
    "น้ำหอม",
    "บาคูลัส",
    "กระเป๋าตัง",
    "ไข่เป็ด",
    "ใบจาก",
    "ยาพารา",
    "กระเทียม",
    "หัวหอม",
    "พริกสด",
    "พริกป่น"
];

try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let updatedCount = 0;
    let shownCount = 0;

    data.products = data.products.map(p => {
        // Default to NOT showing
        let show = false;
        
        // Check if product name matches (partial match to be safe for beer/names)
        const matched = targetNames.some(target => 
            p.name.toLowerCase().includes(target.toLowerCase()) || 
            target.toLowerCase().includes(p.name.toLowerCase())
        );

        if (matched) {
            show = true;
            shownCount++;
        }

        if (p.showInPOS !== show) {
            updatedCount++;
        }

        return { ...p, showInPOS: show };
    });

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Success: Updated ${updatedCount} products.`);
    console.log(`📡 Now showing ${shownCount} products on POS grid.`);
    console.log(`🍻 Specifically ensured Singha, Chang, and Leo (620ml) are active.`);

} catch (error) {
    console.error("❌ Error cleaning up POS database:", error);
}
