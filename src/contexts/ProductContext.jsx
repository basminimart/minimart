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
            try {
                // 1. Try Supabase first (faster for online deployment)
                console.log('[ProductContext] Fetching from Supabase...');
                
                if (supabase && supabase.from) {
                    let allProducts = [];
                    let from = 0;
                    const batchSize = 1000;
                    let hasMore = true;
                    
                    while (hasMore) {
                        const { data: batch, error } = await supabase
                            .from('products')
                            .select(MAIN_COLUMNS)
                            .range(from, from + batchSize - 1);
                        
                        if (error) {
                            console.error('[Supabase] Batch fetch error:', error);
                            break;
                        }
                        
                        if (batch && batch.length > 0) {
                            allProducts = [...allProducts, ...batch];
                            if (batch.length < batchSize) {
                                hasMore = false;
                            } else {
                                from += batchSize;
                            }
                        } else {
                            hasMore = false;
                        }
                    }
                    
                    console.log(`[Supabase] Loaded ${allProducts.length} products`);
                    
                    if (allProducts.length > 0) {
                        setProducts(allProducts);
                        setLoading(false);
                        setConnectionStatus('connected');
                        return; // Success, exit early
                    }
                }

                // 2. Fallback to local disk if Supabase empty/failed
                console.log('[ProductContext] Supabase empty, trying local disk...');
                const diskData = await diskDB.getAll('products');
                console.log(`[ProductContext] Disk returned ${diskData.length} products`);
                
                if (diskData.length > 0) {
                    setProducts(diskData);
                    setConnectionStatus('offline_disk');
                    console.log(`[Disk Storage] 💾 Loaded ${diskData.length} products from machine drive.`);
                } else {
                    setProducts([]);
                    setConnectionStatus('offline_disk');
                    console.log('[ProductContext] No products found anywhere.');
                }
                setLoading(false);
                
            } catch (err) {
                console.error("[ProductContext] Data load failed:", err);
                setProducts([]);
                setConnectionStatus('error');
                setLoading(false);
            }
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
