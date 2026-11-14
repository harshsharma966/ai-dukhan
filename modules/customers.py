"""
modules/customers.py - Customer management and Udhaar ledger tracking with Multi-Shop isolation.
"""

from database import db
from collections import defaultdict
from datetime import datetime

class CustomerManager:
    @staticmethod
    def add_customer(name: str, mobile: str = None, shop_id: int = 1) -> int:
        """Naya customer register karta hai."""
        name = name.strip()
        if not name:
            raise ValueError("Customer name is required.")
        mobile = mobile.strip() if mobile else None

        with db.connection() as conn:
            cur = conn.execute("""
                INSERT INTO customers (shop_id, name, mobile)
                VALUES (?, ?, ?)
            """, (shop_id, name, mobile))
            return cur.lastrowid

    @staticmethod
    def get_customer(customer_id: int, shop_id: int = 1) -> dict:
        """Customer details with current due balance."""
        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def find_by_mobile(mobile: str, shop_id: int = 1) -> dict:
        """Mobile number se customer search karta hai."""
        if not mobile:
            return None
        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM customers WHERE mobile=? AND shop_id=?", (mobile.strip(), shop_id)
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def search_customers(query: str, shop_id: int = 1) -> list:
        """Name ya mobile se customer search."""
        pattern = f"%{query.strip()}%"
        with db.connection() as conn:
            rows = conn.execute("""
                SELECT * FROM customers 
                WHERE (LOWER(name) LIKE LOWER(?) OR mobile LIKE ?) AND shop_id=?
                ORDER BY name LIMIT 20
            """, (pattern, pattern, shop_id)).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_all_customers(shop_id: int = 1) -> list:
        """Saare customers ki list for this shop."""
        with db.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM customers WHERE shop_id=? ORDER BY name", (shop_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def update_due(customer_id: int, due_change: float, shop_id: int = 1) -> float:
        with db.connection() as conn:
            conn.execute("""
                UPDATE customers
                SET current_due = MAX(0.0, current_due + ?)
                WHERE id=? AND shop_id=?
            """, (due_change, customer_id, shop_id))
            
            row = conn.execute(
                "SELECT current_due FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            return row["current_due"] if row else 0.0

    @staticmethod
    def get_monthly_statement(customer_id: int, shop_id: int = 1) -> dict:
        with db.connection() as conn:
            cust = conn.execute(
                "SELECT * FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            if not cust:
                raise ValueError(f"Customer ID {customer_id} nahi mila.")

            # 1. Fetch all bills where udhaar was taken
            bills = conn.execute("""
                SELECT id, bill_number, bill_date, final_amount, paid_amount, due_amount, payment_mode
                FROM sales_bills
                WHERE customer_id = ? AND status = 'CONFIRMED' AND due_amount > 0 AND shop_id = ?
                ORDER BY bill_date ASC
            """, (customer_id, shop_id)).fetchall()

            # 2. Fetch all payments made by customer
            payments = conn.execute("""
                SELECT id, amount, payment_mode, payment_date, notes
                FROM customer_payments
                WHERE customer_id = ? AND shop_id = ?
                ORDER BY payment_date ASC
            """, (customer_id, shop_id)).fetchall()

            monthly_data = defaultdict(lambda: {"credit_taken": 0.0, "paid_amount": 0.0, "bills_count": 0, "payments_count": 0})

            for b in bills:
                b_date = str(b["bill_date"]).split()[0]
                month_key = b_date[:7]
                monthly_data[month_key]["credit_taken"] += b["due_amount"]
                monthly_data[month_key]["bills_count"] += 1

            for p in payments:
                p_date = str(p["payment_date"]).split()[0]
                month_key = p_date[:7]
                monthly_data[month_key]["paid_amount"] += p["amount"]
                monthly_data[month_key]["payments_count"] += 1

            months_summary = []
            for m_key in sorted(monthly_data.keys()):
                d = monthly_data[m_key]
                try:
                    dt = datetime.strptime(m_key, "%Y-%m")
                    m_label = dt.strftime("%B %Y")
                except Exception:
                    m_label = m_key

                net_due = round(d["credit_taken"] - d["paid_amount"], 2)
                months_summary.append({
                    "month_key": m_key,
                    "month_label": m_label,
                    "credit_taken": round(d["credit_taken"], 2),
                    "paid_amount": round(d["paid_amount"], 2),
                    "net_balance": net_due,
                    "bills_count": d["bills_count"],
                    "payments_count": d["payments_count"]
                })

            return {
                "customer": dict(cust),
                "total_current_due": float(cust["current_due"]),
                "months_summary": months_summary,
                "total_bills_on_credit": len(bills),
                "total_payments_made": len(payments),
                "payments": [dict(p) for p in payments]
            }


customers = CustomerManager()
