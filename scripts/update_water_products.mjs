import fs from 'fs';

const DB_FILE = './local_database.json';

// Read database
const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

// Find water pack products
const waterProducts = data.products.filter(p => 
    p.name && (
        p.name.includes('น้ำแพ็ค') || 
        p.name.includes('แพ็คน้ำ') ||
        p.name.includes('น้ำดื่ม') && p.name.includes('แพ็ค') ||
        p.name.toLowerCase().includes('water') && p.name.includes('แพ็ค')
    )
);

console.log('Found water products:', waterProducts.length);
waterProducts.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (ID: ${p.id})`);
    console.log(`   Current: isRecommended=${p.isRecommended}, posIndex=${p.posIndex}, showInStore=${p.showInStore}`);
});

// Update first 2 water products to be recommended at top positions
if (waterProducts.length >= 2) {
    waterProducts.slice(0, 2).forEach((p, i) => {
        const index = data.products.findIndex(prod => prod.id === p.id);
        if (index !== -1) {
            data.products[index].isRecommended = true;
            data.products[index].posIndex = i; // 0 for first, 1 for second
            data.products[index].showInStore = true;
            data.products[index].updatedAt = new Date().toISOString();
            console.log(`\n✅ Updated: ${p.name} -> posIndex=${i}, isRecommended=true, showInStore=true`);
        }
    });
    
    // Save database
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log('\n💾 Database saved!');
    console.log('\n🔄 Refresh the /store page to see changes.');
} else if (waterProducts.length === 1) {
    const index = data.products.findIndex(prod => prod.id === waterProducts[0].id);
    if (index !== -1) {
        data.products[index].isRecommended = true;
        data.products[index].posIndex = 0;
        data.products[index].showInStore = true;
        data.products[index].updatedAt = new Date().toISOString();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log(`\n✅ Updated: ${waterProducts[0].name} -> posIndex=0, isRecommended=true`);
    }
} else {
    console.log('\n❌ No water pack products found. Please add products with names containing "น้ำแพ็ค" or similar.');
}
