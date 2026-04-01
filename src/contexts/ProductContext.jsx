import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { diskDB } from '../utils/diskStorage';
import { useAuth } from './AuthContext';

const ProductContext = createContext(null);

export const useProduct = () => {
    const context = useContext(ProductContext);
    if (!context) throw new Error('useProduct must be used within a ProductProvider');
    return context;
};

const MAIN_COLUMNS = "id, name, barcode, price, cost, stock, category, unit, packSize, packPrice, minStock, zone, showInPOS, posIndex, packBarcode, caseBarcode, caseSize, casePrice, showInStore, isRecommended, isHero, updatedAt, createdAt, soldToday, image";

export const ProductProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const { user } = useAuth();
    const fetchedRef = useRef(false);

    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach(p => map.set(p.id, p));
        return map;
    }, [products]);

    const barcodeMap = useMemo(() => {
        const map = new Map();
        products.forEach(p => {
            if (p.barcode) map.set(String(p.barcode).trim().toLowerCase(), { product: p, type: 'unit' });
            if (p.packBarcode) map.set(String(p.packBarcode).trim().toLowerCase(), { product: p, type: 'pack' });
            if (p.caseBarcode) map.set(String(p.caseBarcode).trim().toLowerCase(), { product: p, type: 'case' });
        });
        return map;
    }, [products]);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const loadData = async () => {
            setLoading(true);
            
            // Race between Supabase and local disk - whichever is faster
            const supabasePromise = (async () => {
                try {
                    if (!supabase || !supabase.from) return [];
                    
                    // Fetch all products at once (no pagination for speed)
                    const { data, error } = await supabase
                        .from('products')
                        .select(MAIN_COLUMNS)
                        .limit(10000); // Get all at once
                    
                    if (error) throw error;
                    console.log(`[Supabase] Loaded ${data?.length || 0} products`);
                    return data || [];
                } catch (err) {
                    console.error('[Supabase] Error:', err.message);
                    return [];
                }
            })();
            
            const diskPromise = (async () => {
                try {
                    const data = await diskDB.getAll('products');
                    console.log(`[Disk] Loaded ${data.length} products`);
                    return data;
                } catch (err) {
                    console.error('[Disk] Error:', err.message);
                    return [];
                }
            })();
            
            // Try Supabase first with timeout
            let products = [];
            let source = '';
            
            try {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                products = await Promise.race([supabasePromise, timeoutPromise]);
                if (products.length > 0) {
                    source = 'supabase';
                }
            } catch {
                console.log('[ProductContext] Supabase timeout, trying disk...');
                products = await diskPromise;
                if (products.length > 0) source = 'disk';
            }
            
            // If Supabase failed/timeout, wait for disk
            if (products.length === 0) {
                products = await diskPromise;
                if (products.length > 0) source = 'disk';
            }
            
            // If still no products, wait for Supabase without timeout
            if (products.length === 0) {
                products = await supabasePromise;
                if (products.length > 0) source = 'supabase';
            }
            
            setProducts(products);
            setConnectionStatus(source === 'supabase' ? 'connected' : source === 'disk' ? 'offline_disk' : 'error');
            setLoading(false);
            
            console.log(`[ProductContext] Loaded ${products.length} products from ${source || 'none'}`);
        };

        loadData();
    }, []);

    const addProduct = async (productData) => {
        const newProduct = {
            ...productData,
            id: productData.id || Date.now().toString(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Save directly to disk
        await diskDB.put('products', newProduct);
        setProducts(prev => [...prev, newProduct]);
        
        // Background update for cloud
        supabase.from('products').insert(newProduct).then(() => {});
        return newProduct;
    };

    const updateProduct = async (productId, updates) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const updatedProduct = { ...product, ...updates, updatedAt: new Date().toISOString() };
        await diskDB.put('products', updatedProduct);
        setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));

        supabase.from('products').update(updates).eq('id', productId).then(() => {});
        return updatedProduct;
    };

    const deleteProduct = async (productId) => {
        await diskDB.delete('products', productId);
        setProducts(prev => prev.filter(p => p.id !== productId));
        supabase.from('products').delete().eq('id', productId).then(() => {});
    };

    const deductStock = async (productId, amount) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const newStock = (product.stock || 0) - amount;
        return updateProduct(productId, { stock: newStock });
    };

    const bulkDeductStock = async (deductions) => {
        // 1. Prepare updated products
        const updatedProducts = [];
        const localUpdates = products.map(p => {
            const deduction = deductions.find(d => d.productId === p.id);
            if (deduction) {
                const updated = { ...p, stock: (p.stock || 0) - deduction.amount, updatedAt: new Date().toISOString() };
                updatedProducts.push(updated);
                return updated;
            }
            return p;
        });

        // 2. State update (Instant UI)
        setProducts(localUpdates);

        // 3. Persist to Machine Drive (Disk)
        await diskDB.bulkPut('products', updatedProducts);

        // 4. Background Sync to Cloud (Silent)
        deductions.forEach(d => {
            // Use a safe wrapper to avoid .catch issues
            try {
                supabase.rpc('deduct_product_stock', {
                    p_id: d.productId,
                    p_amount: d.amount
                }).then(() => {}); 
            } catch (e) {}
        });
    };

    const value = {
        products,
        productMap,
        barcodeMap,
        loading,
        connectionStatus,
        addProduct,
        updateProduct,
        deleteProduct,
        deductStock,
        bulkDeductStock,
        updateProductOrder: async (updates) => {
            // updates is [{id, posIndex}, ...]
            const productsToUpdate = [];
            const newProducts = products.map(p => {
                const update = updates.find(u => u.id === p.id);
                if (update) {
                    const updated = { ...p, posIndex: update.posIndex, updatedAt: new Date().toISOString() };
                    productsToUpdate.push(updated);
                    return updated;
                }
                return p;
            });

            // 1. Update state (Interactive UI)
            setProducts(newProducts);

            // 2. Persist to local drive
            const result = await diskDB.bulkPut('products', productsToUpdate);
            
            if (!result || !result.success) {
                console.error("[ProductContext] bulkPut failed:", result?.error || "Unknown error");
                throw new Error("บันทึกลงดิสก์ไม่สำเร็จ: " + (result?.error || "ไม่ทราบสาเหตุ"));
            }

            // 3. Optional Background Supabase Sync
            updates.forEach(u => {
                supabase.from('products').update({ posIndex: u.posIndex }).eq('id', u.id).then(() => {});
            });
            return true;
        },
        getProductByBarcode: (barcode) => barcodeMap.get(String(barcode).trim().toLowerCase()),
        refreshProducts: () => fetchedRef.current = false 
    };

    return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};
