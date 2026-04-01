import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { diskDB } from '../utils/diskStorage';
import { supabase } from '../services/supabase';

const OrderContext = createContext(null);

export const useOrder = () => {
    const context = useContext(OrderContext);
    if (!context) throw new Error('useOrder must be used within an OrderProvider');
    return context;
};

export const OrderProvider = ({ children }) => {
    const [pendingOrdersActive, setPendingOrdersActive] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            try {
                // 1. Fetch from local machine (IndexedDB/Disk)
                const diskData = await diskDB.getAll('orders');
                if (diskData.length > 0) {
                    const sorted = diskData.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setOrders(sorted);
                    setPendingOrdersActive(sorted.some(o => o.status === 'pending'));
                }

                // 2. Fetch from Cloud (Supabase) if disk is empty or to sync
                const { data: cloudData, error } = await supabase
                    .from('orders')
                    .select('*')
                    .order('createdAt', { ascending: false });

                if (!error && cloudData && cloudData.length > 0) {
                    const mapped = cloudData.map(o => ({
                        ...o,
                        customer: o.customer || { name: o.customerName, phone: o.customerPhone, address: o.customerAddress }
                    }));
                    setOrders(mapped);
                    setPendingOrdersActive(mapped.some(o => o.status === 'pending'));
                    // Background sync to disk
                    await diskDB.bulkPut('orders', mapped);
                } else if (error) {
                    console.error("[Cloud] Order fetch error:", error.message);
                }

                setLoading(false);
            } catch (err) {
                console.error("[Storage] Order load failed:", err);
                setLoading(false);
            }
        };

        loadOrders();

        // 3. 🚀 REAL-TIME CLOUD SYNC: Listen for online orders from Vercel/Store
        console.log("[Hybrid Mode] 📡 Listening for incoming online orders...");
        const channel = supabase
            .channel('public:orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
                const newOrder = payload.new;
                console.log("[Hybrid Mode] 🔔 NEW ONLINE ORDER RECEIVED:", newOrder.id);
                
                // Save to Machine Drive immediately
                await diskDB.put('orders', newOrder);
                
                // Update Local UI
                setOrders(prev => {
                    if (prev.find(o => o.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                });
                setNewOrderAlert(true);
                
                // Optional: Play alert sound if you have one
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const createOrder = async (orderData) => {
        const date = new Date();
        const datePart = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const todayStr = date.toLocaleDateString('en-CA');
        const todayCount = orders.filter(o => new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr).length;

        const sequence = (todayCount + 1).toString().padStart(4, '0');
        const customId = `W-${datePart}-${sequence}`;

        const newOrder = {
            ...orderData,
            id: customId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            paymentStatus: orderData.paymentMethod === 'cod' ? 'pending' : 'pending_verification'
        };

        // Prepare data for Supabase (Mapping to new schema)
        const supabaseOrder = {
            id: newOrder.id,
            customerName: orderData.customer?.name || orderData.customerName || 'Guest',
            customerPhone: orderData.customer?.phone || orderData.customerPhone || '',
            customerAddress: orderData.customer?.address || orderData.customerAddress || '',
            items: orderData.items,
            total: orderData.total,
            status: 'pending',
            paymentMethod: orderData.paymentMethod || 'cod',
            paymentStatus: orderData.paymentStatus || 'pending',
            paymentProof: orderData.slipUrl || orderData.paymentProof || null, // Map slipUrl to paymentProof
            note: orderData.customer?.memo || orderData.note || '',
            createdAt: newOrder.createdAt,
            updatedAt: newOrder.updatedAt
        };

        // Save order directly to disk file (local_database.json)
        await diskDB.put('orders', newOrder);
        setOrders(prev => [newOrder, ...prev]);
        setNewOrderAlert(true);
        
        supabase.from('orders').insert(supabaseOrder).then(({ error }) => {
            if (error) console.error("[Supabase] Order sync failed:", error.message);
        });
        return newOrder;
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedOrder = { ...order, status: newStatus, updatedAt: new Date().toISOString() };
        await diskDB.put('orders', updatedOrder);
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        supabase.from('orders').update({ status: newStatus }).eq('id', orderId).then(() => {});
    };

    const deleteOrder = async (orderId) => {
        await diskDB.delete('orders', orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId));
        supabase.from('orders').delete().eq('id', orderId).then(() => {});
    };

    const value = {
        orders,
        loading,
        newOrderAlert,
        pendingOrdersActive,
        createOrder,
        updateOrderStatus,
        acknowledgeNewOrder: () => setNewOrderAlert(false),
        deleteOrder
    };

    return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
};
