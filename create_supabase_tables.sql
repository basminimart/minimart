-- ===========================================================
-- 🇹🇭 MINIMART — สร้างตารางทั้งหมดสำหรับ Supabase ใหม่
-- ===========================================================

-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    barcode TEXT DEFAULT '',
    price NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    "packSize" NUMERIC DEFAULT 1,
    "packPrice" NUMERIC DEFAULT 0,
    "packBarcode" TEXT DEFAULT '',
    "caseSize" NUMERIC DEFAULT 1,
    "casePrice" NUMERIC DEFAULT 0,
    "caseBarcode" TEXT DEFAULT '',
    "minStock" NUMERIC DEFAULT 0,
    zone TEXT DEFAULT '',
    "showInPOS" BOOLEAN DEFAULT false,
    "showInStore" BOOLEAN DEFAULT false,
    "isRecommended" BOOLEAN DEFAULT false,
    "isHero" BOOLEAN DEFAULT false,
    "posIndex" INTEGER DEFAULT 0,
    "soldToday" NUMERIC DEFAULT 0,
    "lastSoldAt" TIMESTAMPTZ,
    image TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true);

-- ==================== CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    "totalDebt" NUMERIC DEFAULT 0,
    history JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);

-- ==================== ORDERS ====================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    "customerId" UUID REFERENCES customers(id),
    customer JSONB,
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    "paymentMethod" TEXT DEFAULT 'cash',
    "paymentStatus" TEXT DEFAULT 'pending',
    "slipUrl" TEXT,
    "deliveryTime" TEXT,
    "shiftId" UUID,
    type TEXT DEFAULT 'pos',
    memo TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON orders FOR ALL USING (true) WITH CHECK (true);

-- ==================== SHIFTS ====================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "startCash" NUMERIC DEFAULT 0,
    "endCash" NUMERIC,
    "totalSales" NUMERIC DEFAULT 0,
    "totalOrders" INTEGER DEFAULT 0,
    "openedAt" TIMESTAMPTZ DEFAULT now(),
    "closedAt" TIMESTAMPTZ,
    "openedBy" TEXT,
    "closedBy" TEXT
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- ==================== SETTINGS ====================
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    "shopName" TEXT DEFAULT 'Minimart POS',
    currency TEXT DEFAULT '฿',
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO settings (id, "shopName", currency) 
VALUES ('shop_settings', 'Minimart POS', '฿')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================
-- ✅ เสร็จสิ้น! ตารางพร้อมใช้งาน
-- ===========================================================
