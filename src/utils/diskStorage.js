const SERVER_URL = 'http://localhost:5005/api';

export const diskDB = {
    async getAll(collection) {
        try {
            const res = await fetch(`${SERVER_URL}/${collection}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`Disk Sync Error (Read ${collection}):`, err.message);
            return [];
        }
    },

    async put(collection, item) {
        try {
            const res = await fetch(`${SERVER_URL}/${collection}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`Disk Sync Error (Write ${collection}):`, err.message);
            return { success: false, error: err.message };
        }
    },

    async bulkPut(collection, items) {
        // Use sequential put instead of bulk endpoint for compatibility
        console.log(`[diskStorage] bulkPut: Saving ${items.length} items to ${collection}`);
        try {
            for (const item of items) {
                const result = await this.put(collection, item);
                if (!result || result.success === false) {
                    console.error(`[diskStorage] Failed to save item ${item.id}:`, result?.error);
                    throw new Error(`Failed to save item ${item.id}: ${result?.error || 'Unknown error'}`);
                }
            }
            console.log(`[diskStorage] bulkPut: Successfully saved ${items.length} items`);
            return { success: true, count: items.length };
        } catch (err) {
            console.error(`[diskStorage] bulkPut error:`, err.message);
            return { success: false, error: err.message };
        }
    },

    async delete(collection, id) {
        try {
            const res = await fetch(`${SERVER_URL}/${collection}/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`Disk Sync Error (Delete ${collection}):`, err.message);
            return { success: false, error: err.message };
        }
    }
};
