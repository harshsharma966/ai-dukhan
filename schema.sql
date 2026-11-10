PRAGMA foreign_keys = ON;

-- =========================================================
-- MODULE 1: PURCHASE & STOCK IN (माल खरीद व स्टॉक इन)
-- =========================================================

-- 1. Products Table (Dukaan ka Samaan aur Live Stock)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    hindi_name TEXT,
    unit TEXT NOT NULL DEFAULT 'packet',
    current_stock REAL NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
    cost_price REAL NOT NULL DEFAULT 0 CHECK(cost_price >= 0),
    selling_price REAL NOT NULL DEFAULT 0 CHECK(selling_price >= 0),
    low_stock_limit REAL NOT NULL DEFAULT 5 CHECK(low_stock_limit >= 0),
    barcode TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_hindi ON products(hindi_name);

-- 2. Purchase Bills Table (Parcha / Bill Record)
CREATE TABLE IF NOT EXISTS purchase_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_date TEXT NOT NULL DEFAULT (DATE('now','localtime')),
    image_path TEXT,
    total_amount REAL NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK(status IN ('DRAFT','CONFIRMED','CANCELLED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT
);

-- 3. Purchase Items Table (Parcha ke andar ke Line Items)
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_bill_id INTEGER NOT NULL,
    product_id INTEGER,
    raw_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL DEFAULT 'packet',
    cost_price REAL NOT NULL CHECK(cost_price >= 0),
    selling_price REAL CHECK(selling_price IS NULL OR selling_price >= 0),
    line_total REAL NOT NULL CHECK(line_total >= 0),
    is_new_item INTEGER NOT NULL DEFAULT 0 CHECK(is_new_item IN (0,1)),
    FOREIGN KEY(purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_bill
    ON purchase_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product
    ON purchase_items(product_id);


-- =========================================================
-- MODULE 2: CUSTOMER BILLING & SELLING (ग्राहक बिलिंग व बिक्री)
-- =========================================================

-- 4. Customers Table (ग्राहक पहचान और उधारी खाता)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE,
    current_due REAL NOT NULL DEFAULT 0 CHECK(current_due >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

-- 5. Sales Bills Table (बिक्री बिल और भुगतान विवरण)
-- Note: customer_id is NULL for Quick Walk-in customers.
CREATE TABLE IF NOT EXISTS sales_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,                     -- Unique Bill No. (e.g. BILL-20261106-0001)
    customer_id INTEGER,                                  -- Nullable (NULL = Quick Walk-in)
    bill_date TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
    total_amount REAL NOT NULL CHECK(total_amount >= 0),  -- Subtotal of items
    discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),-- Discount given
    final_amount REAL NOT NULL CHECK(final_amount >= 0),  -- total_amount - discount
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'UDHAAR', 'PARTIAL')),
    amount_received REAL NOT NULL DEFAULT 0 CHECK(amount_received >= 0), -- ग्राहक ने कितने पैसे दिए (e.g. ₹500)
    paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),         -- बिल में कितने जमा हुए (e.g. ₹324)
    change_amount REAL NOT NULL DEFAULT 0 CHECK(change_amount >= 0),     -- छुट्टे कितने वापस किए (e.g. ₹176)
    due_amount REAL NOT NULL DEFAULT 0 CHECK(due_amount >= 0),           -- बची हुई उधारी (e.g. ₹0 ya ₹124)
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CHECK(discount <= total_amount),
    CHECK(paid_amount <= final_amount),
    CHECK(due_amount <= final_amount)
);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales_bills(status);

-- 6. Sales Items Table (बिल में बिके सामान की लाइन आइटम्स)
-- Note: product_name and unit are snapshotted so historical bills never change.
CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_bill_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,                           -- Snapshot of item name at time of sale
    quantity REAL NOT NULL CHECK(quantity > 0),           -- Quantity sold (e.g. 2 or 1.5 for loose)
    unit TEXT NOT NULL,                                   -- Snapshot of unit (packet, kg, liter)
    selling_price REAL NOT NULL CHECK(selling_price >= 0),-- Selling price applied
    line_total REAL NOT NULL CHECK(line_total >= 0),      -- quantity * selling_price
    FOREIGN KEY(sales_bill_id) REFERENCES sales_bills(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_items_bill ON sales_items(sales_bill_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_items(product_id);


-- =========================================================
-- MODULE 3: POST-SALE OPERATIONS (पोस्ट-सेल क्रियाएँ)
-- =========================================================

-- 7. Customer Payments Table (ग्राहक द्वारा पुरानी उधारी चुकाने का रिकॉर्ड)
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'UPI')),
    payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);

-- 8. Sales Returns Table (सामान वापसी का मास्टर रिकॉर्ड)
CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_bill_id INTEGER NOT NULL,
    refund_amount REAL NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
    refund_mode TEXT NOT NULL CHECK(refund_mode IN ('CASH', 'UPI', 'DUE_ADJUSTMENT')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sales_bill_id) REFERENCES sales_bills(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_bill ON sales_returns(sales_bill_id);

-- 9. Sales Return Items Table (कौन-कौन सा सामान और कितनी मात्रा वापस हुई)
CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_id INTEGER NOT NULL,
    sales_item_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    refund_price REAL NOT NULL CHECK(refund_price >= 0),
    line_total REAL NOT NULL CHECK(line_total >= 0),
    FOREIGN KEY(sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY(sales_item_id) REFERENCES sales_items(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_item ON sales_return_items(sales_item_id);
