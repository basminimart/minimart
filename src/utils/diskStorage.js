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
        try {
            const res = await fetch(`${SERVER_URL}/bulk/${collection}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { success: true, data: await res.json() };
        } catch (err) {
            console.error(`Disk Sync Bulk Error (${collection}):`, err.message);
            // Fallback to sequential if bulk endpoint fails
            try {
                for (const item of items) {
                    await this.put(collection, item);
                }
                return { success: true };
            } catch (fallbackErr) {
                console.error(`Disk Sync Bulk Fallback Error:`, fallbackErr.message);
                return { success: false, error: fallbackErr.message };
            }
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
