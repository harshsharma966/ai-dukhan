-- =========================================================
-- PostgreSQL Schema for Kirana Shop AI (किराना दुकान AI)
-- Multi-Tenant / Multi-Shop Architecture
-- =========================================================

-- 0. Compatibility Helper for SQLite strftime function
CREATE OR REPLACE FUNCTION strftime(format text, ts timestamp)
RETURNS text AS $$
BEGIN
    IF format = '%Y-%m' THEN
        RETURN TO_CHAR(ts, 'YYYY-MM');
    ELSIF format = '%Y-%m-%d' THEN
        RETURN TO_CHAR(ts, 'YYYY-MM-DD');
    ELSE
        RETURN TO_CHAR(ts, 'YYYY-MM-DD');
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION strftime(format text, dt date)
RETURNS text AS $$
BEGIN
    IF format = '%Y-%m' THEN
        RETURN TO_CHAR(dt, 'YYYY-MM');
    ELSE
        RETURN TO_CHAR(dt, 'YYYY-MM-DD');
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =========================================================
-- 0. SHOPS TABLE (दुकानें व मल्टी-टेनेंट मास्टर)
-- =========================================================
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan VARCHAR(50) DEFAULT 'FREE_TRIAL'
);

-- =========================================================
-- 0.5 STAFF TABLE (कर्मचारी / बिल बॉय)
-- =========================================================
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'cashier' CHECK(role IN ('owner', 'cashier')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_shop ON staff(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_shop_mobile ON staff(shop_id, mobile);

-- =========================================================
-- MODULE 1: PURCHASE & STOCK IN (माल खरीद व स्टॉक इन)
-- =========================================================

-- 1. Products Table (Dukaan ka Samaan aur Live Stock)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    hindi_name VARCHAR(255),
    unit VARCHAR(50) NOT NULL DEFAULT 'packet',
    current_stock DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
    cost_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(cost_price >= 0),
    selling_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(selling_price >= 0),
    low_stock_limit DOUBLE PRECISION NOT NULL DEFAULT 5 CHECK(low_stock_limit >= 0),
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_hindi ON products(hindi_name);

-- 2. Purchase Bills Table (Parcha / Bill Record)
CREATE TABLE IF NOT EXISTS purchase_bills (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    image_path TEXT,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK(status IN ('DRAFT','CONFIRMED','CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_shop ON purchase_bills(shop_id);

-- 3. Purchase Items Table (Parcha ke andar ke Line Items)
CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_bill_id INTEGER NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    raw_name VARCHAR(255) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL CHECK(quantity > 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'packet',
    cost_price DOUBLE PRECISION NOT NULL CHECK(cost_price >= 0),
    selling_price DOUBLE PRECISION CHECK(selling_price IS NULL OR selling_price >= 0),
    line_total DOUBLE PRECISION NOT NULL CHECK(line_total >= 0),
    is_new_item SMALLINT NOT NULL DEFAULT 0 CHECK(is_new_item IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_bill ON purchase_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);


-- =========================================================
-- MODULE 2: CUSTOMER BILLING & SELLING (ग्राहक बिलिंग व बिक्री)
-- =========================================================

-- 4. Customers Table (ग्राहक पहचान और उधारी खाता)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(50),
    current_due DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(current_due >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

-- 5. Sales Bills Table (बिक्री बिल और भुगतान विवरण)
CREATE TABLE IF NOT EXISTS sales_bills (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    bill_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    bill_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DOUBLE PRECISION NOT NULL CHECK(total_amount >= 0),
    discount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(discount >= 0),
    final_amount DOUBLE PRECISION NOT NULL CHECK(final_amount >= 0),
    payment_mode VARCHAR(20) NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'UDHAAR', 'PARTIAL')),
    amount_received DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(amount_received >= 0),
    paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
    change_amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(change_amount >= 0),
    due_amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(due_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    created_by_staff_id INTEGER REFERENCES staff(id),
    created_by_name VARCHAR(255),
    CHECK(discount <= total_amount),
    CHECK(paid_amount <= final_amount),
    CHECK(due_amount <= final_amount)
);

CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales_bills(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales_bills(status);

-- 6. Sales Items Table (बिल में बिके सामान की लाइन आइटम्स)
CREATE TABLE IF NOT EXISTS sales_items (
    id SERIAL PRIMARY KEY,
    sales_bill_id INTEGER NOT NULL REFERENCES sales_bills(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL CHECK(quantity > 0),
    unit VARCHAR(50) NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL CHECK(selling_price >= 0),
    line_total DOUBLE PRECISION NOT NULL CHECK(line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_items_bill ON sales_items(sales_bill_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_items(product_id);


-- =========================================================
-- MODULE 3: POST-SALE OPERATIONS (पोस्ट-सेल क्रियाएँ)
-- =========================================================

-- 7. Customer Payments Table (ग्राहक द्वारा पुरानी उधारी चुकाने का रिकॉर्ड)
CREATE TABLE IF NOT EXISTS customer_payments (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    amount DOUBLE PRECISION NOT NULL CHECK(amount > 0),
    payment_mode VARCHAR(20) NOT NULL CHECK(payment_mode IN ('CASH', 'UPI')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_shop ON customer_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);

-- 8. Sales Returns Table (सामान वापसी का मास्टर रिकॉर्ड)
CREATE TABLE IF NOT EXISTS sales_returns (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) DEFAULT 1,
    sales_bill_id INTEGER NOT NULL REFERENCES sales_bills(id) ON DELETE RESTRICT,
    refund_amount DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
    refund_mode VARCHAR(30) NOT NULL CHECK(refund_mode IN ('CASH', 'UPI', 'DUE_ADJUSTMENT')),
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_shop ON sales_returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_bill ON sales_returns(sales_bill_id);

-- 9. Sales Return Items Table (कौन-कौन सा सामान और कितनी मात्रा वापस हुई)
CREATE TABLE IF NOT EXISTS sales_return_items (
    id SERIAL PRIMARY KEY,
    sales_return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    sales_item_id INTEGER NOT NULL REFERENCES sales_items(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DOUBLE PRECISION NOT NULL CHECK(quantity > 0),
    refund_price DOUBLE PRECISION NOT NULL CHECK(refund_price >= 0),
    line_total DOUBLE PRECISION NOT NULL CHECK(line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_item ON sales_return_items(sales_item_id);
