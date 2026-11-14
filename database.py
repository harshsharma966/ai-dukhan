"""
database.py - Database layer supporting Multi-Shop / Multi-Tenant SaaS on PostgreSQL.

Features:
- Configured via DATABASE_URL or PG_* credentials in .env
- Full transactional safety and constraint checks
- Multi-shop data isolation (shop_id filtering across all tables)
- Safe parameter escaping and returning ID capture for PostgreSQL
"""

import os
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import psycopg2
import psycopg2.extras

BASE_DIR = Path(__file__).resolve().parent
SCHEMA_POSTGRES = BASE_DIR / "schema_postgres.sql"


class PostgresRow(dict):
    """Row wrapper allowing both key access (row['name']) and numeric index (row[0])."""
    def __init__(self, d):
        super().__init__(d if d is not None else {})
        self._keys = list(self.keys())

    def __getitem__(self, item):
        if isinstance(item, int):
            return super().__getitem__(self._keys[item])
        return super().__getitem__(item)


class PostgresCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor
        self.lastrowid = None

    def execute(self, sql, params=None):
        sql = sql.strip()
        # Escape literal % to %% for psycopg2 string formatting, then convert SQLite style ? to %s
        converted_sql = sql.replace('%', '%%').replace('?', '%s')
        
        # Capture lastrowid on INSERT queries if not already requesting RETURNING
        upper_sql = converted_sql.upper()
        is_insert = upper_sql.startswith("INSERT INTO") or " INSERT INTO " in upper_sql
        has_returning = "RETURNING" in upper_sql
        
        if is_insert and not has_returning:
            converted_sql += " RETURNING id"
            self.cursor.execute(converted_sql, params or ())
            try:
                ret = self.cursor.fetchone()
                if ret:
                    if isinstance(ret, dict):
                        self.lastrowid = ret.get("id")
                    elif hasattr(ret, "__getitem__"):
                        self.lastrowid = ret[0]
            except Exception:
                self.lastrowid = None
            return self

        self.cursor.execute(converted_sql, params or ())
        return self

    def executemany(self, sql, seq_of_params):
        converted_sql = sql.replace('%', '%%').replace('?', '%s')
        self.cursor.executemany(converted_sql, seq_of_params)
        return self

    def fetchone(self):
        row = self.cursor.fetchone()
        return PostgresRow(row) if row is not None else None

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [PostgresRow(r) for r in rows]

    @property
    def rowcount(self):
        return self.cursor.rowcount


class PostgresConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return PostgresCursorWrapper(self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, sql, params=None):
        cur = self.cursor()
        return cur.execute(sql, params)

    def executemany(self, sql, seq_of_params):
        cur = self.cursor()
        return cur.executemany(sql, seq_of_params)

    def executescript(self, script):
        with self.conn.cursor() as cur:
            cur.execute(script)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


class Database:
    def __init__(self):
        self.schema_postgres = Path(SCHEMA_POSTGRES)
        self.db_type = "postgres"
        self.pg_config = None

        self._configure_engine()
        self.initialize()

    def _configure_engine(self):
        """Sets up PostgreSQL connection using .env configuration."""
        db_url_env = os.getenv("DATABASE_URL", "").strip()

        if db_url_env:
            if db_url_env.startswith("postgres://"):
                db_url_env = db_url_env.replace("postgres://", "postgresql://", 1)
            self.pg_config = {"dsn": db_url_env}
        else:
            self.pg_config = {
                "host": os.getenv("PG_HOST", "localhost"),
                "port": int(os.getenv("PG_PORT", 5433)),
                "database": os.getenv("PG_DATABASE", "kirana_shop"),
                "user": os.getenv("PG_USER", "postgres"),
                "password": os.getenv("PG_PASSWORD", "postgres")
            }

        try:
            conn = self._get_raw_pg_connection()
            conn.close()
            target = self.pg_config.get("database") or self.pg_config.get("dsn", "")
            port = self.pg_config.get("port", "")
            print(f"🐘 [Database] Connected successfully to PostgreSQL ({target} on port {port})")
        except Exception as e:
            raise ConnectionError(
                f"❌ [Database] PostgreSQL connection failed: {e}\n"
                f"Please ensure PostgreSQL server is running and .env credentials are correct."
            )

    def _get_raw_pg_connection(self):
        if "dsn" in self.pg_config:
            return psycopg2.connect(self.pg_config["dsn"], connect_timeout=5)
        return psycopg2.connect(**self.pg_config, connect_timeout=5)

    @contextmanager
    def connection(self):
        raw_conn = self._get_raw_pg_connection()
        wrapper = PostgresConnectionWrapper(raw_conn)
        try:
            yield wrapper
            wrapper.commit()
        except Exception:
            wrapper.rollback()
            raise
        finally:
            wrapper.close()

    def initialize(self):
        """Initializes tables and ensures Shop #1 exists in PostgreSQL."""
        if not self.schema_postgres.exists():
            return
        with open(self.schema_postgres, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        with self.connection() as conn:
            # 1. First ensure schema is applied
            try:
                conn.executescript(schema_sql)
            except Exception:
                conn.rollback()

            # 2. Add shop_id to any pre-existing tables if upgrading
            tables_to_migrate = ["products", "customers", "purchase_bills", "sales_bills", "customer_payments", "sales_returns"]
            for tbl in tables_to_migrate:
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) DEFAULT 1;")
                except Exception:
                    conn.rollback()
                try:
                    conn.execute(f"UPDATE {tbl} SET shop_id = 1 WHERE shop_id IS NULL;")
                except Exception:
                    conn.rollback()

            # Ensure proper PostgreSQL constraints
            try:
                conn.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;")
            except Exception:
                conn.rollback()
            try:
                conn.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;")
            except Exception:
                conn.rollback()
            try:
                conn.execute("ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_mobile_key;")
            except Exception:
                conn.rollback()
            try:
                conn.execute("ALTER TABLE sales_bills DROP CONSTRAINT IF EXISTS sales_bills_bill_number_key;")
            except Exception:
                conn.rollback()

            # 4. Staff table migration + sales_bills staff columns
            try:
                conn.execute("""
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
                """)
            except Exception:
                conn.rollback()
            try:
                conn.execute("CREATE INDEX IF NOT EXISTS idx_staff_shop ON staff(shop_id);")
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_shop_mobile ON staff(shop_id, mobile);")
            except Exception:
                conn.rollback()
            try:
                conn.execute("ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS created_by_staff_id INTEGER REFERENCES staff(id);")
                conn.execute("ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);")
            except Exception:
                conn.rollback()

            # 5. Ensure Shop 1 exists
            try:
                existing_shop = conn.execute("SELECT id FROM shops WHERE id = 1").fetchone()
                if not existing_shop:
                    conn.execute("""
                        INSERT INTO shops (id, shop_name, owner_name, mobile, password_hash, address)
                        VALUES (1, 'किराना दुकान AI', 'दुकानदार', '9756770000', '1234', 'मेन मार्केट, नियर बस स्टैंड')
                    """)
                conn.execute("SELECT setval(pg_get_serial_sequence('shops', 'id'), COALESCE(MAX(id), 1)) FROM shops;")
            except Exception:
                conn.rollback()

    # =========================================================
    # MODULE 0: SHOPS & MULTI-TENANT AUTH
    # =========================================================

    def get_shop(self, shop_id: int):
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM shops WHERE id = ?", (shop_id,)).fetchone()
            return dict(row) if row else None

    def get_shop_by_mobile(self, mobile: str):
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM shops WHERE mobile = ?", (mobile.strip(),)).fetchone()
            return dict(row) if row else None

    def create_shop(self, shop_name: str, owner_name: str, mobile: str, password: str = None, address: str = None):
        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO shops (shop_name, owner_name, mobile, password_hash, address)
                VALUES (?, ?, ?, ?, ?)
            """, (shop_name.strip(), owner_name.strip(), mobile.strip(), password, address))
            return cur.lastrowid

    def update_shop(self, shop_id: int, shop_name: str = None, owner_name: str = None, address: str = None):
        with self.connection() as conn:
            conn.execute("""
                UPDATE shops
                SET shop_name = COALESCE(?, shop_name),
                    owner_name = COALESCE(?, owner_name),
                    address = COALESCE(?, address)
                WHERE id = ?
            """, (shop_name, owner_name, address, shop_id))
            return self.get_shop(shop_id)

    # =========================================================
    # MODULE 0.5: STAFF MANAGEMENT (कर्मचारी प्रबंधन)
    # =========================================================

    def add_staff(self, shop_id: int, name: str, mobile: str, pin: str, role: str = 'cashier'):
        if role not in ('owner', 'cashier'):
            raise ValueError("Role must be 'owner' or 'cashier'")
        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO staff (shop_id, name, mobile, pin_hash, role)
                VALUES (?, ?, ?, ?, ?)
            """, (shop_id, name.strip(), mobile.strip(), pin.strip(), role))
            return cur.lastrowid

    def get_staff(self, staff_id: int, shop_id: int):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM staff WHERE id = ? AND shop_id = ?", (staff_id, shop_id)
            ).fetchone()
            return dict(row) if row else None

    def get_staff_by_mobile(self, mobile: str, shop_id: int):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM staff WHERE mobile = ? AND shop_id = ? AND is_active IS NOT FALSE",
                (mobile.strip(), shop_id)
            ).fetchone()
            return dict(row) if row else None

    def get_staff_by_mobile_any(self, mobile: str):
        with self.connection() as conn:
            row = conn.execute("""
                SELECT s.*, sh.shop_name, sh.owner_name, sh.address as shop_address 
                FROM staff s 
                JOIN shops sh ON sh.id = s.shop_id 
                WHERE s.mobile = ? AND s.is_active IS NOT FALSE 
                ORDER BY s.id DESC
            """, (mobile.strip(),)).fetchone()
            return dict(row) if row else None

    def get_all_staff(self, shop_id: int):
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, name, mobile, role, is_active, created_at FROM staff WHERE shop_id = ? ORDER BY id",
                (shop_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def update_staff(self, staff_id: int, shop_id: int, name: str = None, pin: str = None, is_active: bool = None):
        with self.connection() as conn:
            if name:
                conn.execute("UPDATE staff SET name = ? WHERE id = ? AND shop_id = ?", (name.strip(), staff_id, shop_id))
            if pin:
                conn.execute("UPDATE staff SET pin_hash = ? WHERE id = ? AND shop_id = ?", (pin.strip(), staff_id, shop_id))
            if is_active is not None:
                conn.execute("UPDATE staff SET is_active = ? WHERE id = ? AND shop_id = ?", (is_active, staff_id, shop_id))
            return self.get_staff(staff_id, shop_id)

    def delete_staff(self, staff_id: int, shop_id: int):
        with self.connection() as conn:
            conn.execute("UPDATE staff SET is_active = FALSE WHERE id = ? AND shop_id = ?", (staff_id, shop_id))
            return True

    # =========================================================
    # MODULE 1: PRODUCTS & PURCHASE (STOCK IN)
    # =========================================================

    def add_product(self, name, unit="packet", cost_price=0,
                    selling_price=0, current_stock=0, hindi_name=None,
                    low_stock_limit=5, barcode=None, shop_id=1):
        name = name.strip()
        if not name:
            raise ValueError("Product name is required.")

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO products
                (shop_id, name, hindi_name, unit, current_stock, cost_price,
                 selling_price, low_stock_limit, barcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (shop_id, name, hindi_name, unit, current_stock, cost_price,
                  selling_price, low_stock_limit, barcode))
            return cur.lastrowid

    def get_product(self, product_id, shop_id=1):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)
            ).fetchone()
            return dict(row) if row else None

    def update_product_limit(self, product_id: int, low_stock_limit: float, shop_id=1):
        if low_stock_limit < 0:
            raise ValueError("Limit negative nahi ho sakti.")
        with self.connection() as conn:
            conn.execute("""
                UPDATE products
                SET low_stock_limit = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND shop_id = ?
            """, (low_stock_limit, product_id, shop_id))
            return True

    def update_product_price(self, product_id: int, cost_price: float = None, selling_price: float = None, shop_id=1):
        with self.connection() as conn:
            prod = conn.execute("SELECT * FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)).fetchone()
            if not prod:
                raise ValueError("Product nahi mila.")

            cp = float(cost_price) if cost_price is not None else float(prod["cost_price"])
            sp = float(selling_price) if selling_price is not None else float(prod["selling_price"])

            if cp < 0 or sp < 0:
                raise ValueError("Rate (Price) zero ya usse bada hona chahiye.")

            conn.execute("""
                UPDATE products
                SET cost_price = ?,
                    selling_price = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND shop_id = ?
            """, (cp, sp, product_id, shop_id))
            return dict(conn.execute("SELECT * FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)).fetchone())

    def delete_product(self, product_id: int, shop_id: int = 1) -> bool:
        with self.connection() as conn:
            prod = conn.execute("SELECT id FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)).fetchone()
            if not prod:
                return False

            sales_row = conn.execute("SELECT COUNT(*) as cnt FROM sales_items WHERE product_id=?", (product_id,)).fetchone()
            s_cnt = sales_row["cnt"] if sales_row else 0
            purch_row = conn.execute("SELECT COUNT(*) as cnt FROM purchase_items WHERE product_id=?", (product_id,)).fetchone()
            p_cnt = purch_row["cnt"] if purch_row else 0

            if s_cnt == 0 and p_cnt == 0:
                conn.execute("DELETE FROM products WHERE id=? AND shop_id=?", (product_id, shop_id))
            else:
                conn.execute("UPDATE products SET is_active=FALSE, current_stock=0, updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?", (product_id, shop_id))
            return True

    def find_product_by_name(self, name, shop_id=1):
        with self.connection() as conn:
            row = conn.execute("""
                SELECT * FROM products
                WHERE LOWER(name)=LOWER(?) AND shop_id=? AND is_active IS NOT FALSE LIMIT 1
            """, (name.strip(), shop_id)).fetchone()
            return dict(row) if row else None

    def match_product_smart(self, raw_name, shop_id=1):
        raw_name = raw_name.strip()
        with self.connection() as conn:
            # 1. Exact match
            row = conn.execute("""
                SELECT * FROM products
                WHERE (LOWER(name)=LOWER(?) OR LOWER(hindi_name)=LOWER(?)) AND shop_id=? AND is_active IS NOT FALSE
                LIMIT 1
            """, (raw_name, raw_name, shop_id)).fetchone()
            if row:
                return dict(row)

            # 2. Substring match
            pattern = f"%{raw_name}%"
            row = conn.execute("""
                SELECT * FROM products
                WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(hindi_name) LIKE LOWER(?)) AND shop_id=? AND is_active IS NOT FALSE
                LIMIT 1
            """, (pattern, pattern, shop_id)).fetchone()
            if row:
                return dict(row)

            # 3. Token-based / Keyword match
            words = [w for w in raw_name.replace('/', ' ').split() if len(w) > 2]
            for w in words:
                p = f"%{w}%"
                row = conn.execute("""
                    SELECT * FROM products
                    WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(hindi_name) LIKE LOWER(?)) AND shop_id=? AND is_active IS NOT FALSE
                    LIMIT 1
                """, (p, p, shop_id)).fetchone()
                if row:
                    return dict(row)

            return None

    def search_products(self, text, shop_id=1):
        pattern = f"%{text.strip()}%"
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(hindi_name) LIKE LOWER(?) OR barcode LIKE ?)
                  AND shop_id=?
                  AND is_active IS NOT FALSE
                ORDER BY name LIMIT 50
            """, (pattern, pattern, pattern, shop_id)).fetchall()
            return [dict(row) for row in rows]

    # -------------------- PURCHASE BILL / PARCHA --------------------

    def create_purchase_bill(self, image_path=None, bill_date=None, shop_id=1):
        if not bill_date:
            bill_date = datetime.now().strftime("%Y-%m-%d")
        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO purchase_bills (shop_id, image_path, bill_date)
                VALUES (?, ?, ?)
            """, (shop_id, image_path, bill_date))
            return cur.lastrowid

    def add_purchase_item(self, purchase_bill_id, raw_name, quantity,
                          cost_price, unit="packet", product_id=None,
                          selling_price=None, is_new_item=False):
        raw_name = raw_name.strip()
        if not raw_name:
            raise ValueError("Item name is required.")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")
        if cost_price < 0:
            raise ValueError("Cost price cannot be negative.")

        with self.connection() as conn:
            bill = conn.execute(
                "SELECT status, shop_id FROM purchase_bills WHERE id=?",
                (purchase_bill_id,)
            ).fetchone()
            if not bill:
                raise ValueError("Purchase bill not found.")
            if bill["status"] != "DRAFT":
                raise ValueError("Only DRAFT bills can be edited.")

            line_total = round(quantity * cost_price, 2)
            cur = conn.execute("""
                INSERT INTO purchase_items
                (purchase_bill_id, product_id, raw_name, quantity, unit,
                 cost_price, selling_price, line_total, is_new_item)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (purchase_bill_id, product_id, raw_name, quantity, unit,
                  cost_price, selling_price, line_total, int(is_new_item)))

            self._recalculate_purchase_total(conn, purchase_bill_id)
            return cur.lastrowid

    @staticmethod
    def _recalculate_purchase_total(conn, bill_id):
        conn.execute("""
            UPDATE purchase_bills
            SET total_amount = (
                SELECT COALESCE(SUM(line_total), 0)
                FROM purchase_items WHERE purchase_bill_id=?
            )
            WHERE id=?
        """, (bill_id, bill_id))

    def get_purchase_bill(self, bill_id, shop_id=1):
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM purchase_bills WHERE id=? AND shop_id=?", (bill_id, shop_id)
            ).fetchone()
            if not bill:
                return None
            items = conn.execute("""
                SELECT pi.*, p.name AS matched_product_name
                FROM purchase_items pi
                LEFT JOIN products p ON p.id=pi.product_id
                WHERE pi.purchase_bill_id=?
                ORDER BY pi.id
            """, (bill_id,)).fetchall()
            result = dict(bill)
            result["items"] = [dict(item) for item in items]
            return result

    def confirm_purchase(self, bill_id, shop_id=1):
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM purchase_bills WHERE id=? AND shop_id=?", (bill_id, shop_id)
            ).fetchone()
            if not bill:
                raise ValueError("Purchase bill not found.")
            if bill["status"] != "DRAFT":
                raise ValueError("Only a DRAFT bill can be confirmed.")

            items = conn.execute("""
                SELECT * FROM purchase_items
                WHERE purchase_bill_id=? ORDER BY id
            """, (bill_id,)).fetchall()
            if not items:
                raise ValueError("Cannot confirm an empty purchase bill.")

            for item in items:
                product_id = item["product_id"]

                if product_id is None:
                    existing_prod = conn.execute(
                        "SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND shop_id=?",
                        (item["raw_name"].strip(), shop_id)
                    ).fetchone()
                    if existing_prod:
                        product_id = existing_prod["id"]
                        conn.execute(
                            "UPDATE purchase_items SET product_id=? WHERE id=?",
                            (product_id, item["id"])
                        )

                if product_id is None:
                    if not item["is_new_item"]:
                        raise ValueError(
                            f"'{item['raw_name']}' is unmatched. Match it to an "
                            "existing product or mark it as a new product."
                        )
                    if item["selling_price"] is None:
                        raise ValueError(
                            f"Set selling price for new product: {item['raw_name']}"
                        )

                    cur = conn.execute("""
                        INSERT INTO products
                        (shop_id, name, unit, current_stock, cost_price, selling_price)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (shop_id, item["raw_name"], item["unit"], item["quantity"],
                          item["cost_price"], item["selling_price"]))
                    product_id = cur.lastrowid
                    conn.execute(
                        "UPDATE purchase_items SET product_id=? WHERE id=?",
                        (product_id, item["id"])
                    )
                else:
                    exists = conn.execute(
                        "SELECT id FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)
                    ).fetchone()
                    if not exists:
                        raise ValueError(f"Product ID {product_id} does not exist.")

                    conn.execute("""
                        UPDATE products
                        SET current_stock = current_stock + ?,
                            cost_price = ?,
                            selling_price = COALESCE(?, selling_price),
                            unit = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id=? AND shop_id=?
                    """, (item["quantity"], item["cost_price"],
                          item["selling_price"], item["unit"], product_id, shop_id))

            conn.execute("""
                UPDATE purchase_bills
                SET status='CONFIRMED', confirmed_at=CURRENT_TIMESTAMP
                WHERE id=? AND shop_id=?
            """, (bill_id, shop_id))

    def cancel_draft_purchase(self, bill_id, shop_id=1):
        with self.connection() as conn:
            cur = conn.execute("""
                UPDATE purchase_bills SET status='CANCELLED'
                WHERE id=? AND status='DRAFT' AND shop_id=?
            """, (bill_id, shop_id))
            if cur.rowcount == 0:
                raise ValueError("Bill not found or is not in DRAFT status.")

    # =========================================================
    # MODULE 2: CUSTOMERS & SALES (STOCK OUT)
    # =========================================================

    def add_customer(self, name, mobile=None, shop_id=1):
        name = name.strip()
        if not name:
            raise ValueError("Customer name is required.")
        mobile = mobile.strip() if mobile else None

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO customers (shop_id, name, mobile)
                VALUES (?, ?, ?)
            """, (shop_id, name, mobile))
            return cur.lastrowid

    def get_customer(self, customer_id, shop_id=1):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            return dict(row) if row else None

    def find_customer_by_mobile(self, mobile, shop_id=1):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE mobile=? AND shop_id=?", (mobile.strip(), shop_id)
            ).fetchone()
            return dict(row) if row else None

    def get_all_customers(self, shop_id=1):
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM customers WHERE shop_id=? ORDER BY name", (shop_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def create_sales_bill(self, customer_id=None, payment_mode="CASH",
                          amount_received=0, discount=0, bill_number=None, shop_id=1,
                          created_by_staff_id=None, created_by_name=None):
        if not bill_number:
            now_str = datetime.now().strftime("%Y%m%d%H%M%S%f")
            bill_number = f"BILL-{now_str}"

        payment_mode = payment_mode.upper()
        if payment_mode not in ('CASH', 'UPI', 'UDHAAR', 'PARTIAL'):
            raise ValueError(f"Invalid payment mode: {payment_mode}")

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO sales_bills
                (shop_id, bill_number, customer_id, total_amount, discount, final_amount,
                 payment_mode, amount_received, paid_amount, change_amount, due_amount,
                 created_by_staff_id, created_by_name)
                VALUES (?, ?, ?, 0, 0, 0, ?, ?, 0, 0, 0, ?, ?)
            """, (shop_id, bill_number, customer_id, payment_mode, amount_received, created_by_staff_id, created_by_name))
            return cur.lastrowid

    def add_sales_item(self, sales_bill_id, product_id, quantity, selling_price=None):
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")

        with self.connection() as conn:
            bill = conn.execute(
                "SELECT status, shop_id FROM sales_bills WHERE id=?", (sales_bill_id,)
            ).fetchone()
            if not bill:
                raise ValueError("Sales bill not found.")
            if bill["status"] != "DRAFT":
                raise ValueError("Only DRAFT sales bills can be edited.")

            product = conn.execute(
                "SELECT * FROM products WHERE id=?", (product_id,)
            ).fetchone()
            if not product:
                raise ValueError(f"Product ID {product_id} not found.")

            price = selling_price if selling_price is not None else product["selling_price"]
            if price < 0:
                raise ValueError("Selling price cannot be negative.")

            line_total = round(quantity * price, 2)

            cur = conn.execute("""
                INSERT INTO sales_items
                (sales_bill_id, product_id, product_name, quantity, unit, selling_price, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (sales_bill_id, product_id, product["name"], quantity, product["unit"], price, line_total))

            self._recalculate_sales_bill(conn, sales_bill_id)
            return cur.lastrowid

    @staticmethod
    def _recalculate_sales_bill(conn, sales_bill_id, discount=None, payment_mode=None, amount_received=None):
        bill = conn.execute(
            "SELECT * FROM sales_bills WHERE id=?", (sales_bill_id,)
        ).fetchone()

        total_amount = conn.execute(
            "SELECT COALESCE(SUM(line_total), 0) FROM sales_items WHERE sales_bill_id=?",
            (sales_bill_id,)
        ).fetchone()[0]

        raw_disc = discount if discount is not None else bill["discount"]
        disc = min(max(0.0, float(raw_disc or 0.0)), float(total_amount))
        pm = payment_mode if payment_mode is not None else bill["payment_mode"]
        recv = amount_received if amount_received is not None else bill["amount_received"]

        final_amount = max(0.0, round(float(total_amount) - disc, 2))

        if pm == 'CASH':
            paid_amount = min(recv, final_amount)
            change_amount = max(0.0, round(recv - final_amount, 2))
            due_amount = max(0.0, round(final_amount - paid_amount, 2))
        elif pm == 'UPI':
            recv = final_amount
            paid_amount = final_amount
            change_amount = 0.0
            due_amount = 0.0
        elif pm == 'UDHAAR':
            recv = 0.0
            paid_amount = 0.0
            change_amount = 0.0
            due_amount = final_amount
        elif pm == 'PARTIAL':
            if recv >= final_amount:
                raise ValueError(f"Partial payment (₹{recv:.2f}) bill total (₹{final_amount:.2f}) se kam hona chahiye. Poora ya zyada paisa mila ho toh CASH mode chunein.")
            if recv <= 0:
                raise ValueError("Partial payment amount 0 se zyada hona chahiye. Agar koi paisa nahi mila toh UDHAAR mode chunein.")
            paid_amount = recv
            change_amount = 0.0
            due_amount = max(0.0, round(final_amount - paid_amount, 2))
        else:
            paid_amount = 0.0
            change_amount = 0.0
            due_amount = final_amount

        conn.execute("""
            UPDATE sales_bills
            SET total_amount=?, discount=?, final_amount=?, payment_mode=?,
                amount_received=?, paid_amount=?, change_amount=?, due_amount=?
            WHERE id=?
        """, (total_amount, disc, final_amount, pm, recv, paid_amount, change_amount, due_amount, sales_bill_id))

    def update_sales_payment(self, sales_bill_id, payment_mode, amount_received=0, discount=0):
        with self.connection() as conn:
            bill = conn.execute("SELECT status FROM sales_bills WHERE id=?", (sales_bill_id,)).fetchone()
            if not bill or bill["status"] != "DRAFT":
                raise ValueError("Only DRAFT bills can be updated.")
            self._recalculate_sales_bill(conn, sales_bill_id, discount=discount,
                                         payment_mode=payment_mode, amount_received=amount_received)

    def get_sales_bill(self, sales_bill_id, shop_id=1):
        with self.connection() as conn:
            bill = conn.execute("""
                SELECT sb.*, c.name AS customer_name, c.mobile AS customer_mobile,
                       s.shop_name, s.owner_name AS shop_owner, s.address AS shop_address, s.mobile AS shop_mobile
                FROM sales_bills sb
                LEFT JOIN customers c ON c.id=sb.customer_id
                LEFT JOIN shops s ON s.id=sb.shop_id
                WHERE sb.id=? AND sb.shop_id=?
            """, (sales_bill_id, shop_id)).fetchone()
            if not bill:
                return None

            items = conn.execute("""
                SELECT * FROM sales_items WHERE sales_bill_id=? ORDER BY id
            """, (sales_bill_id,)).fetchall()

            res = dict(bill)
            res["items"] = [dict(it) for it in items]
            return res

    def get_sales_bills(self, query=None, date=None, status=None, limit=100, shop_id=1):
        with self.connection() as conn:
            sql = """
                SELECT sb.*, 
                       c.name AS customer_name, 
                       c.mobile AS customer_mobile,
                       c.current_due AS customer_current_due,
                       COUNT(si.id) AS item_count,
                       COALESCE((SELECT COUNT(*) FROM sales_returns sr WHERE sr.sales_bill_id = sb.id), 0) AS returns_count
                FROM sales_bills sb
                LEFT JOIN customers c ON c.id = sb.customer_id
                LEFT JOIN sales_items si ON si.sales_bill_id = sb.id
                WHERE sb.shop_id = ?
            """
            params = [shop_id]
            if date:
                sql += " AND DATE(sb.bill_date) = DATE(?)"
                params.append(date)
            if status and status != 'ALL':
                sql += " AND sb.status = ?"
                params.append(status)
            if query and query.strip():
                q_like = f"%{query.strip()}%"
                sql += " AND (sb.bill_number LIKE ? OR LOWER(c.name) LIKE LOWER(?) OR c.mobile LIKE ?)"
                params.extend([q_like, q_like, q_like])
            
            sql += " GROUP BY sb.id, c.name, c.mobile, c.current_due ORDER BY sb.id DESC LIMIT ?"
            params.append(limit)
            
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    def get_sales_bill_details(self, sales_bill_id, shop_id=1):
        with self.connection() as conn:
            bill = conn.execute("""
                SELECT sb.*, c.name AS customer_name, c.mobile AS customer_mobile, c.current_due AS customer_current_due,
                       s.shop_name, s.owner_name AS shop_owner, s.address AS shop_address, s.mobile AS shop_mobile
                FROM sales_bills sb
                LEFT JOIN customers c ON c.id=sb.customer_id
                LEFT JOIN shops s ON s.id=sb.shop_id
                WHERE sb.id=? AND sb.shop_id=?
            """, (sales_bill_id, shop_id)).fetchone()
            if not bill:
                return None

            items = conn.execute("""
                SELECT si.*,
                       COALESCE((SELECT SUM(sri.quantity) FROM sales_return_items sri WHERE sri.sales_item_id = si.id), 0) AS returned_quantity
                FROM sales_items si
                WHERE si.sales_bill_id=?
                ORDER BY si.id
            """, (sales_bill_id,)).fetchall()

            res = dict(bill)
            res["subtotal"] = float(bill["total_amount"])
            res["items"] = []
            for it in items:
                d = dict(it)
                d["available_return_qty"] = max(0.0, round(float(d["quantity"]) - float(d["returned_quantity"]), 2))
                res["items"].append(d)
            return res

    def confirm_sale(self, sales_bill_id, shop_id=1):
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM sales_bills WHERE id=? AND shop_id=?", (sales_bill_id, shop_id)
            ).fetchone()
            if not bill:
                raise ValueError("Sales bill not found.")
            if bill["status"] != "DRAFT":
                raise ValueError("Only a DRAFT bill can be confirmed.")

            items = conn.execute(
                "SELECT * FROM sales_items WHERE sales_bill_id=?", (sales_bill_id,)
            ).fetchall()
            if not items:
                raise ValueError("Cannot confirm an empty sales bill.")

            if bill["due_amount"] > 0 and bill["customer_id"] is None:
                raise ValueError("Walk-in customers cannot have pending udhaar. Register customer first.")

            for item in items:
                prod = conn.execute(
                    "SELECT current_stock, name FROM products WHERE id=? AND shop_id=?", (item["product_id"], shop_id)
                ).fetchone()
                if not prod:
                    raise ValueError(f"Product ID {item['product_id']} not found.")
                if prod["current_stock"] < item["quantity"]:
                    raise ValueError(
                        f"Insufficient stock for '{prod['name']}'! "
                        f"Available: {prod['current_stock']}, Requested: {item['quantity']}"
                    )

            for item in items:
                conn.execute("""
                    UPDATE products
                    SET current_stock = current_stock - ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id=? AND shop_id=?
                """, (item["quantity"], item["product_id"], shop_id))

            if bill["customer_id"] is not None and bill["due_amount"] > 0:
                conn.execute("""
                    UPDATE customers
                    SET current_due = current_due + ?
                    WHERE id=? AND shop_id=?
                """, (bill["due_amount"], bill["customer_id"], shop_id))

            conn.execute("""
                UPDATE sales_bills
                SET status='CONFIRMED', confirmed_at=CURRENT_TIMESTAMP
                WHERE id=? AND shop_id=?
            """, (sales_bill_id, shop_id))

    def cancel_sales_bill(self, sales_bill_id, shop_id=1):
        with self.connection() as conn:
            cur = conn.execute("""
                UPDATE sales_bills SET status='CANCELLED'
                WHERE id=? AND status='DRAFT' AND shop_id=?
            """, (sales_bill_id, shop_id))
            if cur.rowcount == 0:
                raise ValueError("Bill not found or is not in DRAFT status.")

    # -------------------- INVENTORY & ALERTS --------------------

    def get_all_products(self, shop_id=1):
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM products WHERE shop_id=? AND is_active IS NOT FALSE ORDER BY name", (shop_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_low_stock_products(self, shop_id=1):
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE current_stock > 0
                  AND current_stock <= low_stock_limit
                  AND shop_id=?
                  AND is_active IS NOT FALSE
                ORDER BY current_stock
            """, (shop_id,)).fetchall()
            return [dict(row) for row in rows]

    def get_out_of_stock_products(self, shop_id=1):
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE current_stock <= 0
                  AND shop_id=?
                  AND is_active IS NOT FALSE
                ORDER BY name
            """, (shop_id,)).fetchall()
            return [dict(row) for row in rows]

    def seed_sample_products(self, shop_id=1):
        with self.connection() as conn:
            count_row = conn.execute("SELECT COUNT(*) as cnt FROM products WHERE shop_id=?", (shop_id,)).fetchone()
            count = count_row["cnt"] if count_row else 0
            if count == 0:
                sample_items = [
                    (shop_id, "Tata Salt 1kg", "टाटा नमक", "packet", 10.0, 22.0, 28.0, 5.0, f"890123456701_{shop_id}"),
                    (shop_id, "Aashirvaad Atta 5kg", "आशीर्वाद आटा 5 किलो", "packet", 4.0, 230.0, 270.0, 3.0, f"890123456702_{shop_id}"),
                    (shop_id, "Fortune Mustard Oil 1L", "फॉर्च्यून सरसों तेल", "liter", 8.0, 125.0, 145.0, 5.0, f"890123456703_{shop_id}"),
                    (shop_id, "Sugar / Chini (Loose)", "चीनी खुला", "kg", 25.0, 40.0, 45.0, 10.0, None),
                    (shop_id, "Maggi 2-Minute Noodles", "मैगी नूडल्स", "packet", 24.0, 11.5, 14.0, 6.0, f"890123456704_{shop_id}")
                ]
                conn.executemany("""
                    INSERT INTO products
                    (shop_id, name, hindi_name, unit, current_stock, cost_price,
                     selling_price, low_stock_limit, barcode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, sample_items)
                print("🌱 Sample Products successfully seeded for Shop", shop_id)


# Global database instance
db = Database()


if __name__ == "__main__":
    db.seed_sample_products()
    print(f"\n✅ Active Database Engine: {db.db_type.upper()}")
    print("\n📦 Dukaan me maujood Samaan (Current Stock for Shop 1):")
    for p in db.get_all_products(shop_id=1):
        print(f"  • {p['name']} | Stock: {p['current_stock']} {p['unit']} | CP: ₹{p['cost_price']} | SP: ₹{p['selling_price']}")
