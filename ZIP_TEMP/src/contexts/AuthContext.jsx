import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // QUICK CHECK: If we have a local session, start immediately!
        const localUser = localStorage.getItem('local_auth_user');
        if (localUser) {
            try {
                setUser(JSON.parse(localUser));
                setLoading(false);
            } catch (e) {
                console.error("Local auth error:", e);
            }
        }

        // Parallel: Try to check Supabase for real session
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    fetchProfile(session.user);
                } else {
                    if (!localUser) setLoading(false);
                }
            } catch (err) {
                console.warn("Offline: Supabase unreachable, staying in local mode");
                if (!localUser) setLoading(false);
            }
        };

        initAuth();

        // Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                fetchProfile(session.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem('local_auth_user');
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (supabaseUser) => {
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (fetchError && fetchError.code === 'PGRST116') {
                // No profile: Create default
                const ownerEmails = ['qwaser9801@gmail.com'];
                const isOwner = ownerEmails.includes(supabaseUser.email?.toLowerCase());
                const newProfile = {
                    id: supabaseUser.id,
                    username: supabaseUser.email.split('@')[0],
                    name: isOwner ? 'เจ้าของร้าน' : (supabaseUser.user_metadata?.full_name || 'New User'),
                    role: isOwner ? 'owner' : 'cashier',
                    createdAt: new Date().toISOString()
                };
                const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
                const fullUser = { ...supabaseUser, ...created };
                setUser(fullUser);
                localStorage.setItem('local_auth_user', JSON.stringify(fullUser));
            } else {
                const fullUser = { ...supabaseUser, ...profile };
                setUser(fullUser);
                localStorage.setItem('local_auth_user', JSON.stringify(fullUser));
            }
        } catch (err) {
            console.error("Profile fetch skipped (Offline mode active):", err.message);
            if (!user) {
                 setUser(supabaseUser);
                 localStorage.setItem('local_auth_user', JSON.stringify(supabaseUser));
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Login Error:", error);
            let message = error.message;
            if (message.includes('Invalid login credentials')) message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            throw message;
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const value = {
        user,
        loading,
        error,
        login,
        logout,
        isOwner: user?.role === 'owner',
        isCashier: user?.role === 'cashier',
        isAuthenticated: !!user
    };

    // Full Offline Bypass - Modified for Auto-Login
    useEffect(() => {
        if (!loading && !user) {
            // Auto-login logic: If no user and not loading, automatically mock the local owner
            const mockOwner = {
                id: 'local_owner',
                email: 'local@minimart.pos',
                role: 'owner',
                name: 'Local Admin',
                createdAt: new Date().toISOString()
            };
            setUser(mockOwner);
            localStorage.setItem('local_auth_user', JSON.stringify(mockOwner));
        }
    }, [loading, user]);

    if (loading || !user) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                color: 'white',
                gap: '1.5rem'
            }}>
                <div style={{
                    width: '56px',
                    height: '56px',
                    border: '4px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#10b981',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>OFFLINE DISK MODE</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>กำลังเชื่อมต่อฐานข้อมูลในเครื่อง...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9 }}>กำลังเชื่อมต่อระบบ...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};
