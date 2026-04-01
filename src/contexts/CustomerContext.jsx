import React, { createContext, useContext, useState, useEffect } from 'react';
import { diskDB } from '../utils/diskStorage';
import { supabase } from '../services/supabase';

const CustomerContext = createContext(null);

export const useCustomer = () => {
    const context = useContext(CustomerContext);
    if (!context) throw new Error('useCustomer must be used within a CustomerProvider');
    return context;
};

export const CustomerProvider = ({ children }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCustomers = async () => {
            setLoading(true);
            try {
                // 1. Fetch customers from local drive file
                const diskData = await diskDB.getAll('customers');
                if (diskData.length > 0) {
                    setCustomers(diskData.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
                }

                // Cloud migration removed. Local only access.
                setLoading(false);
            } catch (err) {
                console.error("[Disk Storage] Customer load failed:", err);
            } finally {
                setLoading(false);
            }
        };

        loadCustomers();
    }, []);

    const addCustomer = async (customerData) => {
        const newCustomer = {
            ...customerData,
            id: customerData.id || Date.now().toString(),
            totalDebt: 0,
            history: [],
            createdAt: new Date().toISOString()
        };

        // Save customer profile directly to disk
        await diskDB.put('customers', newCustomer);
        setCustomers(prev => [...prev, newCustomer].sort((a,b) => (a.name || '').localeCompare(b.name || '')));
        
        supabase.from('customers').insert(newCustomer).then(() => {});
        return newCustomer;
    };

    const updateCustomer = async (id, data) => {
        const customer = customers.find(c => c.id === id);
        if (!customer) return;

        const updatedCustomer = { ...customer, ...data };
        await diskDB.put('customers', updatedCustomer);
        setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));

        supabase.from('customers').update(data).eq('id', id).then(() => {});
    };

    const deleteCustomer = async (id) => {
        await diskDB.delete('customers', id);
        setCustomers(prev => prev.filter(c => c.id !== id));
        supabase.from('customers').delete().eq('id', id).then(() => {});
    };

    const addDebt = async (customerId, amount, note) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newHistoryItem = {
            id: 'debt_' + Date.now(),
            date: new Date().toISOString(),
            amount: amount,
            type: 'credit',
            ref: note || 'Manual Adjustment'
        };

        const updatedHistory = [...(customer.history || []), newHistoryItem];
        const newDebt = (customer.totalDebt || 0) + amount;

        await updateCustomer(customerId, {
            totalDebt: newDebt,
            history: updatedHistory
        });
    };

    const repayDebt = async (customerId, amount) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newHistoryItem = {
            id: 'pay_' + Date.now(),
            date: new Date().toISOString(),
            amount: -amount,
            type: 'payment',
            ref: 'Manual Repayment'
        };

        const updatedHistory = [...(customer.history || []), newHistoryItem];
        const newDebt = Math.max(0, (customer.totalDebt || 0) - amount);

        await updateCustomer(customerId, {
            totalDebt: newDebt,
            history: updatedHistory
        });
    };

    const value = {
        customers,
        loading,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addDebt,
        repayDebt
    };

    return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
};
