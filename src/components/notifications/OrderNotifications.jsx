import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useOrder } from '../../contexts/OrderContext';
import { Bell, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import './OrderNotifications.css';

const NOTIFICATION_SOUND = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";

const OrderNotifications = () => {
    const { orders, newOrderAlert, acknowledgeNewOrder } = useOrder();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastOrderCount, setLastOrderCount] = useState(0);
    const [showFullscreenAlert, setShowFullscreenAlert] = useState(false);
    const [newOrdersList, setNewOrdersList] = useState([]);
    const audioRef = useRef(new Audio(NOTIFICATION_SOUND));
    const prevPendingCount = useRef(0);

    // Monitor for new orders
    useEffect(() => {
        const pendingOrders = orders.filter(o => o.status === 'pending');
        const currentPendingCount = pendingOrders.length;

        // Check if we have new pending orders
        if (currentPendingCount > prevPendingCount.current && prevPendingCount.current > 0) {
            // Find the newest pending orders
            const newPending = pendingOrders.slice(0, currentPendingCount - prevPendingCount.current);
            
            if (newPending.length > 0) {
                console.log('[Notifications] New orders detected:', newPending.map(o => o.id));
                setNewOrdersList(newPending);
                setShowFullscreenAlert(true);
                
                // Play sound
                if (soundEnabled) {
                    playNotificationSound();
                }
            }
        }

        prevPendingCount.current = currentPendingCount;
    }, [orders, soundEnabled]);

    const playNotificationSound = () => {
        const audio = audioRef.current;
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.log('[Notifications] Audio play blocked:', err);
            // Try again with user interaction
            setTimeout(() => {
                audio.play().catch(() => {});
            }, 1000);
        });
    };

    const handleDismissAlert = () => {
        setShowFullscreenAlert(false);
        acknowledgeNewOrder();
        setNewOrdersList([]);
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    // Fullscreen alert for new orders
    if (showFullscreenAlert && newOrdersList.length > 0) {
        return (
            <div className="fullscreen-order-alert">
                <div className="alert-content">
                    <div className="alert-icon">
                        <Bell size={64} className="bell-ring" />
                    </div>
                    <h1 className="alert-title">
                        {newOrdersList.length > 1 
                            ? `มี ${newOrdersList.length} ออเดอร์ใหม่!` 
                            : 'มีออเดอร์ใหม่!'}
                    </h1>
                    
                    <div className="new-orders-list">
                        {newOrdersList.map(order => (
                            <div key={order.id} className="new-order-item">
                                <div className="order-id">#{order.id}</div>
                                <div className="order-customer">
                                    {order.customer?.name || 'ไม่ระบุชื่อ'}
                                </div>
                                <div className="order-total">
                                    ฿{Number(order.total).toLocaleString()}
                                </div>
                                <div className="order-items-count">
                                    {(order.items || []).length} รายการ
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="alert-actions">
                        <button 
                            className="btn-acknowledge"
                            onClick={handleDismissAlert}
                        >
                            ✓ รับทราบ (เข้าไปดูออเดอร์)
                        </button>
                        <button 
                            className="btn-refresh"
                            onClick={handleRefresh}
                        >
                            <RefreshCw size={20} /> รีเฟรชหน้า
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Normal notification bar
    const pendingCount = orders.filter(o => o.status === 'pending').length;

    return (
        <div className="order-notifications-bar">
            <div className="notification-status">
                {newOrderAlert ? (
                    <div className="new-alert-badge">
                        <Bell size={18} className="bell-icon" />
                        <span>มีออเดอร์ใหม่!</span>
                    </div>
                ) : (
                    <div className="normal-status">
                        <Bell size={18} />
                        <span>รอออเดอร์... ({pendingCount} รอรับ)</span>
                    </div>
                )}
            </div>

            <div className="notification-controls">
                <button 
                    className="sound-toggle"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
                >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                
                <button 
                    className="refresh-btn"
                    onClick={handleRefresh}
                    title="รีเฟรชหน้า"
                >
                    <RefreshCw size={18} />
                </button>
            </div>
        </div>
    );
};

export default OrderNotifications;
