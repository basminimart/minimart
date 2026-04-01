import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
    
    // Use ref to track current orders for polling (avoid stale closure)
    const ordersRef = useRef(orders);
    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            try {
                // 1. Load from local disk first (fast)
                const diskData = await diskDB.getAll('orders');
                if (diskData.length > 0) {
                    const sorted = diskData.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    setOrders(sorted);
                    console.log(`[OrderContext] Loaded ${diskData.length} orders from local disk (initial)`);
                }

                // 2. ALWAYS fetch from Supabase to get latest (merge with local)
                console.log('[OrderContext] Fetching latest orders from Supabase...');
                const { data: supabaseOrders, error } = await supabase
                    .from('orders')
                    .select('*')
                    .order('createdAt', { ascending: false });
                
                if (error) {
                    console.error('[OrderContext] Supabase fetch error:', error);
                } else if (supabaseOrders && supabaseOrders.length > 0) {
                    // Merge: Supabase data takes priority, add any missing local orders
                    const mergedMap = new Map();
                    
                    // Add Supabase orders first (newer)
                    supabaseOrders.forEach(o => mergedMap.set(o.id, o));
                    
                    // Add local orders if not in Supabase (for offline orders)
                    diskData.forEach(o => {
                        if (!mergedMap.has(o.id)) {
                            mergedMap.set(o.id, o);
                        }
                    });
                    
                    const merged = Array.from(mergedMap.values())
                        .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    
                    setOrders(merged);
                    const hasPending = merged.some(order => order.status === 'pending');
                    setPendingOrdersActive(hasPending);
                    console.log(`[OrderContext] Merged ${merged.length} orders (Supabase: ${supabaseOrders.length}, Local: ${diskData.length})`);
                }
            } catch (err) {
                console.error("[OrderContext] Order load failed:", err);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();

        // 3. 🚀 REAL-TIME CLOUD SYNC: Listen for online orders from Vercel/Store
        console.log("[Hybrid Mode] 📡 Setting up realtime subscription...");
        const channel = supabase
            .channel('public:orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
                const newOrder = payload.new;
                console.log("[Hybrid Mode] 🔔 NEW ONLINE ORDER RECEIVED:", newOrder.id);
                console.log("[Hybrid Mode] Order details:", { id: newOrder.id, customer: newOrder.customer?.name, total: newOrder.total });
                
                // Save to Machine Drive immediately
                try {
                    await diskDB.put('orders', newOrder);
                    console.log("[Hybrid Mode] Saved to local disk");
                } catch (err) {
                    console.error("[Hybrid Mode] Failed to save to disk:", err);
                }
                
                // Update Local UI
                setOrders(prev => {
                    if (prev.find(o => o.id === newOrder.id)) return prev;
                    console.log("[Hybrid Mode] Adding new order to state");
                    return [newOrder, ...prev];
                });
                setPendingOrdersActive(true);
                setNewOrderAlert(true);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async (payload) => {
                const updatedOrder = payload.new;
                console.log("[Hybrid Mode] 🔄 ORDER UPDATED:", updatedOrder.id, "Status:", updatedOrder.status);
                
                // Update local state
                setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                
                // Update disk
                await diskDB.put('orders', updatedOrder);
            })
            .subscribe((status) => {
                console.log("[Hybrid Mode] Realtime subscription status:", status);
            });

        // 4. POLLING BACKUP: Check for new orders every 10 seconds (in case realtime fails)
        const pollingInterval = setInterval(async () => {
            try {
                const { data: latestOrders, error } = await supabase
                    .from('orders')
                    .select('*')
                    .order('createdAt', { ascending: false })
                    .limit(20);
                
                if (!error && latestOrders) {
                    // Use ref to get current orders (avoid stale closure)
                    const currentIds = new Set(ordersRef.current.map(o => o.id));
                    const newOrders = latestOrders.filter(o => !currentIds.has(o.id));
                    
                    if (newOrders.length > 0) {
                        console.log("[Polling] Found", newOrders.length, "new orders:", newOrders.map(o => o.id));
                        // Add to state using functional update to avoid duplicates
                        setOrders(prev => {
                            const existingIds = new Set(prev.map(o => o.id));
                            const trulyNew = newOrders.filter(o => !existingIds.has(o.id));
                            if (trulyNew.length === 0) return prev;
                            return [...trulyNew, ...prev];
                        });
                        setNewOrderAlert(true);
                        setPendingOrdersActive(true);
                        
                        // Save to disk
                        for (const order of newOrders) {
                            await diskDB.put('orders', order);
                        }
                    }
                }
            } catch (err) {
                console.error("[Polling] Error:", err);
            }
        }, 10000); // 10 seconds

        return () => {
            console.log("[Hybrid Mode] Cleaning up subscriptions...");
            supabase.removeChannel(channel);
            clearInterval(pollingInterval);
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

        // 1. Save to Supabase FIRST (cloud)
        console.log('[OrderContext] Creating order in Supabase:', customId);
        const { data: supabaseData, error: supabaseError } = await supabase
            .from('orders')
            .insert(newOrder)
            .select()
            .single();
        
        if (supabaseError) {
            console.error('[OrderContext] Supabase insert error:', supabaseError);
            throw new Error(`Failed to create order: ${supabaseError.message}`);
        }
        
        console.log('[OrderContext] Order created in Supabase:', supabaseData?.id);

        // 2. Save to local disk (for POS system)
        await diskDB.put('orders', newOrder);
        setOrders(prev => [newOrder, ...prev]);
        setNewOrderAlert(true);
        
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
