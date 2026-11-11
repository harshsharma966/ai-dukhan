"""
database.py - SQLite database layer for Kirana Shop AI.

Module 1: Purchase / Stock IN (Supplier is optional, Stock increases ONLY on confirm_purchase)
Module 2: Customer Billing / Stock OUT (Walk-in supported, Stock decreases ONLY on confirm_sale)

Production-ready class architecture with transactional safety, constraints, and separate schema.sql.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "kirana_shop.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


class Database:
    def __init__(self, db_path=DB_PATH, schema_path=SCHEMA_PATH):
        self.db_path = Path(db_path)
        self.schema_path = Path(schema_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize(self):
        """Alag schema.sql file se SQL script padh kar tables banata hai."""
        if not self.schema_path.exists():
            raise FileNotFoundError(f"Schema file not found at: {self.schema_path}")
            
        with open(self.schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        with self.connection() as conn:
            conn.executescript(schema_sql)

    # =========================================================
    # MODULE 1: PRODUCTS & PURCHASE (STOCK IN)
    # =========================================================

    def add_product(self, name, unit="packet", cost_price=0,
                    selling_price=0, current_stock=0, hindi_name=None,
                    low_stock_limit=5, barcode=None):
        name = name.strip()
        if not name:
            raise ValueError("Product name is required.")

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO products
                (name, hindi_name, unit, current_stock, cost_price,
                 selling_price, low_stock_limit, barcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, hindi_name, unit, current_stock, cost_price,
                  selling_price, low_stock_limit, barcode))
            return cur.lastrowid

    def get_product(self, product_id):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM products WHERE id=?", (product_id,)
            ).fetchone()
            return dict(row) if row else None

    def update_product_limit(self, product_id: int, low_stock_limit: float):
        """Dukandar kisi bhi product ki alert limit update kar sakta hai."""
        if low_stock_limit < 0:
            raise ValueError("Limit negative nahi ho sakti.")
        with self.connection() as conn:
            conn.execute("""
                UPDATE products
                SET low_stock_limit = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (low_stock_limit, product_id))
            return True

    def find_product_by_name(self, name):
        """Exact match check karta hai name ke basis par."""
        with self.connection() as conn:
            row = conn.execute("""
                SELECT * FROM products
                WHERE LOWER(name)=LOWER(?) LIMIT 1
            """, (name.strip(),)).fetchone()
            return dict(row) if row else None

    def match_product_smart(self, raw_name):
        """
        Smart matching (Exact -> Substring -> Word tokens / Hindi match)
        Taaki parcha par 'Tata Salt 1kg' ya 'टाटा नमक 1kg' likha ho toh bhi purana item mil jaye.
        """
        raw_name = raw_name.strip()
        with self.connection() as conn:
            # 1. Exact match pehle try karo
            row = conn.execute("""
                SELECT * FROM products
                WHERE LOWER(name)=LOWER(?) OR LOWER(hindi_name)=LOWER(?)
                LIMIT 1
            """, (raw_name, raw_name)).fetchone()
            if row:
                return dict(row)

            # 2. Substring match (e.g. 'Chini' matches 'Sugar / Chini (Loose)')
            pattern = f"%{raw_name}%"
            row = conn.execute("""
                SELECT * FROM products
                WHERE name LIKE ? OR hindi_name LIKE ?
                LIMIT 1
            """, (pattern, pattern)).fetchone()
            if row:
                return dict(row)

            # 3. Token-based / Keyword match (e.g. 'टाटा नमक 1kg' matches 'टाटा नमक' or 'Tata Salt')
            words = [w for w in raw_name.replace('/', ' ').split() if len(w) > 2]
            for w in words:
                p = f"%{w}%"
                row = conn.execute("""
                    SELECT * FROM products
                    WHERE name LIKE ? OR hindi_name LIKE ?
                    LIMIT 1
                """, (p, p)).fetchone()
                if row:
                    return dict(row)

            return None

    def search_products(self, text):
        pattern = f"%{text.strip()}%"
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE name LIKE ? OR hindi_name LIKE ? OR barcode LIKE ?
                ORDER BY name LIMIT 50
            """, (pattern, pattern, pattern)).fetchall()
            return [dict(row) for row in rows]

    # -------------------- PURCHASE BILL / PARCHA --------------------

    def create_purchase_bill(self, image_path=None, bill_date=None):
        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO purchase_bills (image_path, bill_date)
                VALUES (?, COALESCE(?, DATE('now','localtime')))
            """, (image_path, bill_date))
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
                "SELECT status FROM purchase_bills WHERE id=?",
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

    def get_purchase_bill(self, bill_id):
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM purchase_bills WHERE id=?", (bill_id,)
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

    def confirm_purchase(self, bill_id):
        """
        Atomic operation:
        - Existing product: current_stock += purchased quantity.
        - New product: create product with purchased quantity as opening stock.
        - Mark bill CONFIRMED.
        """
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM purchase_bills WHERE id=?", (bill_id,)
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
                        (name, unit, current_stock, cost_price, selling_price)
                        VALUES (?, ?, ?, ?, ?)
                    """, (item["raw_name"], item["unit"], item["quantity"],
                          item["cost_price"], item["selling_price"]))
                    product_id = cur.lastrowid
                    conn.execute(
                        "UPDATE purchase_items SET product_id=? WHERE id=?",
                        (product_id, item["id"])
                    )
                else:
                    exists = conn.execute(
                        "SELECT id FROM products WHERE id=?", (product_id,)
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
                        WHERE id=?
                    """, (item["quantity"], item["cost_price"],
                          item["selling_price"], item["unit"], product_id))

            conn.execute("""
                UPDATE purchase_bills
                SET status='CONFIRMED', confirmed_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (bill_id,))

    def cancel_draft_purchase(self, bill_id):
        with self.connection() as conn:
            cur = conn.execute("""
                UPDATE purchase_bills SET status='CANCELLED'
                WHERE id=? AND status='DRAFT'
            """, (bill_id,))
            if cur.rowcount == 0:
                raise ValueError("Bill not found or is not in DRAFT status.")

    # =========================================================
    # MODULE 2: CUSTOMERS & SALES (STOCK OUT)
    # =========================================================

    def add_customer(self, name, mobile=None):
        name = name.strip()
        if not name:
            raise ValueError("Customer name is required.")
        mobile = mobile.strip() if mobile else None

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO customers (name, mobile)
                VALUES (?, ?)
            """, (name, mobile))
            return cur.lastrowid

    def get_customer(self, customer_id):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE id=?", (customer_id,)
            ).fetchone()
            return dict(row) if row else None

    def find_customer_by_mobile(self, mobile):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE mobile=?", (mobile.strip(),)
            ).fetchone()
            return dict(row) if row else None

    def get_all_customers(self):
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM customers ORDER BY name"
            ).fetchall()
            return [dict(row) for row in rows]

    def create_sales_bill(self, customer_id=None, payment_mode="CASH",
                          amount_received=0, discount=0, bill_number=None):
        """
        Creates a new sales bill (DRAFT).
        customer_id is None for Quick Walk-in customers.
        """
        if not bill_number:
            now_str = datetime.now().strftime("%Y%m%d%H%M%S%f")
            bill_number = f"BILL-{now_str}"

        payment_mode = payment_mode.upper()
        if payment_mode not in ('CASH', 'UPI', 'UDHAAR', 'PARTIAL'):
            raise ValueError(f"Invalid payment mode: {payment_mode}")

        with self.connection() as conn:
            cur = conn.execute("""
                INSERT INTO sales_bills
                (bill_number, customer_id, total_amount, discount, final_amount,
                 payment_mode, amount_received, paid_amount, change_amount, due_amount)
                VALUES (?, ?, 0, 0, 0, ?, ?, 0, 0, 0)
            """, (bill_number, customer_id, payment_mode, amount_received))
            return cur.lastrowid

    def add_sales_item(self, sales_bill_id, product_id, quantity, selling_price=None):
        """
        Adds an item to the sales bill cart.
        Snapshots product_name and unit for invoice stability.
        """
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")

        with self.connection() as conn:
            # Check bill status
            bill = conn.execute(
                "SELECT status FROM sales_bills WHERE id=?", (sales_bill_id,)
            ).fetchone()
            if not bill:
                raise ValueError("Sales bill not found.")
            if bill["status"] != "DRAFT":
                raise ValueError("Only DRAFT sales bills can be edited.")

            # Get product details
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
        """Recalculates totals, paid, change, and due amounts based on payment mode."""
        bill = conn.execute(
            "SELECT * FROM sales_bills WHERE id=?", (sales_bill_id,)
        ).fetchone()

        # Sum of line totals
        total_amount = conn.execute(
            "SELECT COALESCE(SUM(line_total), 0) FROM sales_items WHERE sales_bill_id=?",
            (sales_bill_id,)
        ).fetchone()[0]

        raw_disc = discount if discount is not None else bill["discount"]
        disc = min(max(0.0, float(raw_disc or 0.0)), float(total_amount))
        pm = payment_mode if payment_mode is not None else bill["payment_mode"]
        recv = amount_received if amount_received is not None else bill["amount_received"]

        final_amount = max(0.0, round(total_amount - disc, 2))

        # Payment calculations
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
            paid_amount = min(recv, final_amount)
            change_amount = max(0.0, round(recv - final_amount, 2))
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

    def get_sales_bill(self, sales_bill_id):
        with self.connection() as conn:
            bill = conn.execute("""
                SELECT sb.*, c.name AS customer_name, c.mobile AS customer_mobile
                FROM sales_bills sb
                LEFT JOIN customers c ON c.id=sb.customer_id
                WHERE sb.id=?
            """, (sales_bill_id,)).fetchone()
            if not bill:
                return None

            items = conn.execute("""
                SELECT * FROM sales_items WHERE sales_bill_id=? ORDER BY id
            """, (sales_bill_id,)).fetchall()

            res = dict(bill)
            res["items"] = [dict(it) for it in items]
            return res

    def confirm_sale(self, sales_bill_id):
        """
        Atomic operation:
        1. Checks bill is DRAFT.
        2. Validates stock for ALL items (insufficient stock stops everything).
        3. Validates Udhaar rule: Walk-in customer CANNOT have due_amount > 0.
        4. Decrements current_stock for all sold items (Stock OUT).
        5. Updates customer current_due if due_amount > 0.
        6. Marks bill CONFIRMED.
        """
        with self.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM sales_bills WHERE id=?", (sales_bill_id,)
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

            # Validation 1: Udhaar without registered customer is forbidden
            if bill["due_amount"] > 0 and bill["customer_id"] is None:
                raise ValueError("Walk-in customers cannot have pending udhaar. Register customer first.")

            # Validation 2: Check stock availability for all items before touching anything
            for item in items:
                prod = conn.execute(
                    "SELECT current_stock, name FROM products WHERE id=?", (item["product_id"],)
                ).fetchone()
                if not prod:
                    raise ValueError(f"Product ID {item['product_id']} not found.")
                if prod["current_stock"] < item["quantity"]:
                    raise ValueError(
                        f"Insufficient stock for '{prod['name']}'! "
                        f"Available: {prod['current_stock']}, Requested: {item['quantity']}"
                    )

            # Execution 1: Decrement Stock (Stock OUT)
            for item in items:
                conn.execute("""
                    UPDATE products
                    SET current_stock = current_stock - ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id=?
                """, (item["quantity"], item["product_id"]))

            # Execution 2: Update Customer Udhaar Ledger
            if bill["customer_id"] is not None and bill["due_amount"] > 0:
                conn.execute("""
                    UPDATE customers
                    SET current_due = current_due + ?
                    WHERE id=?
                """, (bill["due_amount"], bill["customer_id"]))

            # Execution 3: Confirm Bill
            conn.execute("""
                UPDATE sales_bills
                SET status='CONFIRMED', confirmed_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (sales_bill_id,))

    def cancel_sales_bill(self, sales_bill_id):
        with self.connection() as conn:
            cur = conn.execute("""
                UPDATE sales_bills SET status='CANCELLED'
                WHERE id=? AND status='DRAFT'
            """, (sales_bill_id,))
            if cur.rowcount == 0:
                raise ValueError("Bill not found or is not in DRAFT status.")

    # -------------------- INVENTORY & ALERTS --------------------

    def get_all_products(self):
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM products ORDER BY name"
            ).fetchall()
            return [dict(row) for row in rows]

    def get_low_stock_products(self):
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE current_stock > 0
                  AND current_stock <= low_stock_limit
                ORDER BY current_stock
            """).fetchall()
            return [dict(row) for row in rows]

    def get_out_of_stock_products(self):
        with self.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM products
                WHERE current_stock <= 0
                ORDER BY name
            """).fetchall()
            return [dict(row) for row in rows]

    def seed_sample_products(self):
        """Testing ke liye basic sample products."""
        with self.connection() as conn:
            count = conn.execute("SELECT COUNT(*) as cnt FROM products").fetchone()["cnt"]
            if count == 0:
                sample_items = [
                    ("Tata Salt 1kg", "टाटा नमक", "packet", 10.0, 22.0, 28.0, 5.0, "890123456701"),
                    ("Aashirvaad Atta 5kg", "आशीर्वाद आटा 5 किलो", "packet", 4.0, 230.0, 270.0, 3.0, "890123456702"),
                    ("Fortune Mustard Oil 1L", "फॉर्च्यून सरसों तेल", "liter", 8.0, 125.0, 145.0, 5.0, "890123456703"),
                    ("Sugar / Chini (Loose)", "चीनी खुला", "kg", 25.0, 40.0, 45.0, 10.0, None),
                    ("Maggi 2-Minute Noodles", "मैगी नूडल्स", "packet", 24.0, 11.5, 14.0, 6.0, "890123456704")
                ]
                conn.executemany("""
                    INSERT INTO products
                    (name, hindi_name, unit, current_stock, cost_price,
                     selling_price, low_stock_limit, barcode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, sample_items)
                print("🌱 5 Sample Products successfully seeded!")


# Global ready-to-use database instance
db = Database()


if __name__ == "__main__":
    db.seed_sample_products()
    print(f"\n✅ Schema loaded from: {SCHEMA_PATH}")
    print(f"✅ Database ready at: {DB_PATH}")
    print("\n📦 Dukaan me maujood Samaan (Current Stock):")
    for p in db.get_all_products():
        print(f"  • {p['name']} | Stock: {p['current_stock']} {p['unit']} | CP: ₹{p['cost_price']} | SP: ₹{p['selling_price']}")
