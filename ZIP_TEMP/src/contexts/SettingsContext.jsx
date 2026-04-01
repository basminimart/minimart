import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { diskDB } from '../utils/diskStorage';

const SettingsContext = createContext(null);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [shopSettings, setShopSettings] = useState({
        name: 'My Shop',
        address: '',
        phone: '',
        taxId: '',
        promptPayId: '0107536000315',
        ttsVoice: null
    });

    const [backupLoading, setBackupLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const diskData = await diskDB.getAll('settings');
                const globalSettings = diskData.find(s => s.id === 'global');
                if (globalSettings) {
                    setShopSettings(globalSettings);
                } else {
                    // Try cloud fallback/migration
                    const { data, error } = await supabase
                        .from('settings')
                        .select('*')
                        .eq('id', 'global')
                        .single();
                    
                    if (data) {
                        setShopSettings(data);
                        await diskDB.put('settings', data);
                    }
                }
            } catch (err) {
                console.warn("[Disk Storage] Settings load failed:", err);
            }
        };
        fetchSettings();
    }, []);

    const updateShopSettings = async (newSettings) => {
        const updated = { ...shopSettings, ...newSettings, id: 'global' };
        setShopSettings(updated);
        
        // Save to disk
        await diskDB.put('settings', updated);
        
        // Background sync to cloud
        supabase.from('settings').upsert(updated).catch(() => {});
    };

    const clearAllData = async () => {
        if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมดในเครื่อง? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
            // This would need a bulk delete on disk server if we wanted it perfect
            // For now, simple implementation or just tell user to delete the json file
            alert('กรุณาลบไฟล์ local_database.json ในโฟลเดอร์โปรแกรมเพื่อล้างข้อมูลทั้งหมด');
        }
    };

    const createBackup = async () => {
        try {
            setBackupLoading(true);

            // Fetch all core collections from local disk server
            const products = await diskDB.getAll('products');
            const shifts = await diskDB.getAll('shifts');
            const customers = await diskDB.getAll('customers');
            const orders = await diskDB.getAll('orders');
            const settings = await diskDB.getAll('settings');

            const backupData = {
                version: 4, // Upgraded version for local format
                timestamp: new Date().toISOString(),
                tables: {
                    products,
                    shifts,
                    customers,
                    orders,
                    settings
                }
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `minimart_backup_local_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();

            setBackupLoading(false);
        } catch (error) {
            console.error("Backup failed", error);
            alert("Backup failed: " + error.message);
            setBackupLoading(false);
        }
    };

    const restoreBackup = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!window.confirm(`กู้คืนข้อมูลจากวันที่ ${new Date(data.timestamp).toLocaleString('th-TH')}? ทุกอย่างจะถูกทับลงในเครื่องนี้`)) return;

                if (data.tables) {
                    // Restore each collection to local disk
                    if (data.tables.products) await diskDB.bulkPut('products', data.tables.products);
                    if (data.tables.shifts) await diskDB.bulkPut('shifts', data.tables.shifts);
                    if (data.tables.customers) await diskDB.bulkPut('customers', data.tables.customers);
                    if (data.tables.orders) await diskDB.bulkPut('orders', data.tables.orders);
                    if (data.tables.settings) {
                        for (const s of data.tables.settings) {
                            await diskDB.put('settings', s);
                        }
                    }
                }

                alert('กู้คืนข้อมูลสำเร็จ ระบบจะประมวลผลใหม่');
                window.location.reload();
            } catch (error) {
                console.error("Restore failed", error);
                alert('Restore error: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    const value = {
        shopSettings,
        updateShopSettings,
        clearAllData,
        createBackup,
        restoreBackup,
        backupLoading
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
