import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { diskDB } from '../utils/diskStorage';
import { supabase } from '../services/supabase';

const ShiftContext = createContext(null);

export const useShift = () => {
    const context = useContext(ShiftContext);
    if (!context) throw new Error('useShift must be used within a ShiftProvider');
    return context;
};

export const ShiftProvider = ({ children }) => {
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftHistory, setShiftHistory] = useState([]);
    const [globalTransactions, setGlobalTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const loadShifts = async () => {
            setLoading(true);
            try {
                // 1. Fetch from drive
                const diskData = await diskDB.getAll('shifts');
                if (diskData.length > 0) {
                    const sorted = diskData.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
                    const active = sorted.find(s => s.status === 'open');
                    
                    setCurrentShift(active || null);
                    setShiftHistory(sorted.filter(s => s.status === 'closed'));
                    setGlobalTransactions(sorted.flatMap(s => s.transactions || []).sort((a,b) => new Date(b.time) - new Date(a.time)));
                }

                // Cloud migration removed. Local storage is king.
                setLoading(false);
            } catch (err) {
                console.error("[Disk Storage] Shift load failed:", err);
            } finally {
                setLoading(false);
            }
        };

        loadShifts();
    }, []);

    const openShift = async (startCash) => {
        if (currentShift) return;
        const newShift = {
            id: 'local_shift_' + Date.now(),
            startTime: new Date().toISOString(),
            startCash: parseFloat(startCash),
            status: 'open',
            sales: 0,
            expenses: 0,
            transactions: [],
            productSales: {}
        };

        // Save shift directly to disk
        await diskDB.put('shifts', newShift);
        setCurrentShift(newShift);
        supabase.from('shifts').insert(newShift).catch(e => console.warn("Cloud sync ignored. Disk is safe."));
    };

    const closeShift = async (actualCash, note = '') => {
        if (!currentShift) return;
        const updatedShift = {
            ...currentShift,
            status: 'closed',
            endTime: new Date().toISOString(),
            actualCash: parseFloat(actualCash),
            note
        };

        // Update shift directly on disk
        await diskDB.put('shifts', updatedShift);
        setCurrentShift(null);
        setShiftHistory(prev => [updatedShift, ...prev]);

        localStorage.removeItem('pos_current_cart');
        localStorage.removeItem('pos_parked_carts');
        
        supabase.from('shifts').update(updatedShift).eq('id', currentShift.id).catch(e => console.warn("Cloud sync ignored. Disk is safe."));
        setTimeout(() => window.location.reload(), 500);
    };

    const recordTransaction = async (params) => {
        if (!currentShift) return;
        const newTx = {
            id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 5),
            shiftId: currentShift.id,
            time: new Date().toISOString(),
            amount: parseFloat(params.total || params.amount || 0),
            items: params.items || [],
            method: params.paymentMethod || params.method || 'cash',
            payments: params.payments || [],
            customerId: params.customerId || null,
            customerName: params.customerName || null,
            note: params.note || null,
            change: parseFloat(params.change || 0),
            cashReceived: parseFloat(params.cashReceived || 0),
            status: 'completed',
            type: 'sale'
        };

        const updatedTxs = [newTx, ...(currentShift.transactions || [])];
        const newSales = (parseFloat(currentShift.sales) || 0) + newTx.amount;
        const updatedProductSales = { ...(currentShift.productSales || {}) };
        newTx.items.forEach(item => {
            const id = String(item.id).replace(/\./g, '_');
            updatedProductSales[id] = (updatedProductSales[id] || 0) + (parseFloat(item.quantity) || 0);
        });

        const updatedShift = { ...currentShift, transactions: updatedTxs, sales: newSales, productSales: updatedProductSales };
        
        // Save update to disk
        await diskDB.put('shifts', updatedShift);
        setCurrentShift(updatedShift);
        
        // Background sync (Safe)
        try {
            supabase.from('shifts')
                .update({ transactions: updatedTxs, sales: newSales, productSales: updatedProductSales })
                .eq('id', currentShift.id)
                .then(() => {});
        } catch (e) {}

        return newTx;
    };

    const value = {
        currentShift,
        currentTransactions: currentShift?.transactions || [],
        globalTransactions,
        shiftHistory,
        isShiftOpen: !!currentShift && currentShift.status === 'open',
        openShift,
        closeShift,
        recordTransaction,
        getSoldToday: (productId) => {
            const key = String(productId).replace(/\./g, '_');
            return currentShift?.productSales?.[key] || 0;
        },
        deleteShift: async (id) => {
            await diskDB.delete('shifts', id);
            setShiftHistory(prev => prev.filter(s => s.id !== id));
            // Non-blocking cloud sync
            supabase.from('shifts').delete().eq('id', id).then(() => {});
        }
    };

    return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
};
