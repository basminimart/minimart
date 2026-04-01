import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Supabase Credentials (Singapore)
const SUPABASE_URL = 'https://igwwmzgszgzlaawcbyxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd3dtemdzemd6bGFhd2NieXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MzQ5NywiZXhwIjoyMDkwMDM5NDk3fQ.0r_FWYSr3wyZ2MHvCTcJQ0fRHJXqKMP34wiLPh0IfN0';

const DB_FILE = path.join(process.cwd(), 'local_database.json');
const TABLES = ['products', 'settings', 'customers', 'shifts', 'orders'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sync() {
    console.log('🚀 Starting Cloud -> Disk Sync...');
    
    let dbData = {
        products: [],
        orders: [],
        shifts: [],
        customers: [],
        profiles: [],
        meta: { lastSync: new Date().toISOString() }
    };

    // Try to read existing file for orders/shifts (we don't want to overwrite them if they exist)
    try {
        const existing = await fs.readFile(DB_FILE, 'utf-8');
        const parsed = JSON.parse(existing);
        dbData = { ...dbData, ...parsed };
    } catch (e) {
        console.log('📝 Creating new local database file structure.');
    }

    for (const table of TABLES) {
        console.log(`📥 Downloading ${table}...`);
        
        let allData = [];
        let from = 0;
        const step = 1000;
        
        while (true) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .range(from, from + step - 1);
            
            if (error) {
                console.error(`❌ Error fetching ${table} (range ${from}-${from + step}):`, error.message);
                break;
            }
            
            if (!data || data.length === 0) break;
            
            allData = [...allData, ...data];
            console.log(`   Fetched ${allData.length} rows so far...`);
            
            if (data.length < step) break; // Last page
            from += step;
        }

        dbData[table] = allData;
        console.log(`✅ Loaded ${dbData[table].length} rows for ${table}.`);
    }

    await fs.writeFile(DB_FILE, JSON.stringify(dbData, null, 2));
    console.log('\n✨ SYNC COMPLETE!');
    console.log(`📂 Data saved to: ${DB_FILE}`);
    console.log('💡 Now you can zip this folder and move it to another machine.');
}

sync().catch(console.error);
