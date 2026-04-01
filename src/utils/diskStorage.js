import { supabase } from './supabase';

const SERVER_URL = 'http://localhost:5005/api';

// Helper to check if local server is running
async function isServerAvailable() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500); // 500ms timeout
        const res = await fetch(`${SERVER_URL}/products`, { 
            method: 'HEAD',
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        return res.ok;
    } catch {
        return false;
    }
}

export const diskDB = {
    async getAll(collection) {
        // Try local server first (fast)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
            const res = await fetch(`${SERVER_URL}/${collection}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                console.log(`[diskStorage] Loaded ${data.length} items from local disk`);
                return data;
            }
        } catch (err) {
            console.log(`[diskStorage] Local server not available, using Supabase...`);
        }
        
        // Fallback to Supabase
        try {
            const { data, error } = await supabase.from(collection).select('*');
            if (error) throw error;
            console.log(`[diskStorage] Loaded ${data?.length || 0} items from Supabase`);
            return data || [];
        } catch (err) {
            console.error(`[diskStorage] Supabase fallback error:`, err.message);
            return [];
        }
    },

    async put(collection, item) {
        // Try local server first
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${SERVER_URL}/${collection}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                return { success: true };
            }
        } catch (err) {
            console.log(`[diskStorage] Local save failed, using Supabase...`);
        }
        
        // Fallback to Supabase - use upsert
        try {
            const { error } = await supabase.from(collection).upsert(item, { onConflict: 'id' });
            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error(`[diskStorage] Supabase save error:`, err.message);
            return { success: false, error: err.message };
        }
    },

    async bulkPut(collection, items) {
        // Try local server first
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s for bulk
            const res = await fetch(`${SERVER_URL}/bulk/${collection}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                return { success: true };
            }
        } catch (err) {
            console.log(`[diskStorage] Local bulk save failed, using Supabase...`);
        }
        
        // Fallback to Supabase - use upsert for all items
        try {
            const { error } = await supabase.from(collection).upsert(items, { onConflict: 'id' });
            if (error) throw error;
            console.log(`[diskStorage] Saved ${items.length} items to Supabase`);
            return { success: true, count: items.length };
        } catch (err) {
            console.error(`[diskStorage] Supabase bulk save error:`, err.message);
            return { success: false, error: err.message };
        }
    },

    async delete(collection, id) {
        // Try local server first
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${SERVER_URL}/${collection}/${id}`, {
                method: 'DELETE',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) return { success: true };
        } catch (err) {
            console.log(`[diskStorage] Local delete failed, using Supabase...`);
        }
        
        // Fallback to Supabase
        try {
            const { error } = await supabase.from(collection).delete().eq('id', id);
            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error(`[diskStorage] Supabase delete error:`, err.message);
            return { success: false, error: err.message };
        }
    }
};
