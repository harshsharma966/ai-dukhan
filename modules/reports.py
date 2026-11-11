"""
modules/reports.py - Module 4: Shaam ki Closing / Day End (Daily Closing Report).

Provides 3 simple insights:
1. Financial Summary: Cash + UPI + Udhaar = Kul Bikri
2. Items Summary: Aaj kaun sa samaan kitna bika
3. Re-order List: Low stock aur Out of stock samaan ki list
"""

from database import db
from datetime import date

class DailyReports:
    @staticmethod
    def get_financial_summary(report_date: str = None) -> dict:
        """
        1. Vittiya Hisab (Financial Summary):
        Aaj ki kul bikri, Cash, UPI, aur Udhaar ka hisab.
        """
        if not report_date:
            report_date = str(date.today())

        with db.connection() as conn:
            # Confirmed bills ka hisab
            row = conn.execute("""
                SELECT 
                    COUNT(id) AS total_bills,
                    COALESCE(SUM(total_amount), 0) AS gross_sales,
                    COALESCE(SUM(discount), 0) AS total_discount,
                    COALESCE(SUM(final_amount), 0) AS total_sales,
                    COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN paid_amount 
                                     WHEN payment_mode = 'PARTIAL' THEN paid_amount 
                                     ELSE 0 END), 0) AS sales_cash,
                    COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN paid_amount ELSE 0 END), 0) AS sales_upi,
                    COALESCE(SUM(due_amount), 0) AS new_udhaar
                FROM sales_bills
                WHERE status = 'CONFIRMED'
                  AND DATE(bill_date) = DATE(?);
            """, (report_date,)).fetchone()

            # Aaj purani udhari kitni wasool hui (customer_payments)
            pay_row = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END), 0) AS recovered_cash,
                    COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount ELSE 0 END), 0) AS recovered_upi,
                    COALESCE(SUM(amount), 0) AS total_recovered
                FROM customer_payments
                WHERE DATE(payment_date) = DATE(?);
            """, (report_date,)).fetchone()

            total_cash_in_drawer = row["sales_cash"] + pay_row["recovered_cash"]
            total_upi_received = row["sales_upi"] + pay_row["recovered_upi"]
            new_udhaar_given = float(row["new_udhaar"])
            total_recovered = float(pay_row["total_recovered"])
            net_udhaar_today = max(0.0, round(new_udhaar_given - total_recovered, 2))

            # Total outstanding currently across all registered customers
            cust_due_row = conn.execute("""
                SELECT COALESCE(SUM(current_due), 0) AS total_market_due
                FROM customers;
            """).fetchone()
            total_market_due = float(cust_due_row["total_market_due"] if cust_due_row else 0.0)

            return {
                "date": report_date,
                "total_bills": row["total_bills"],
                "total_sales": row["total_sales"],
                "total_discount": row["total_discount"],
                "sales_breakdown": {
                    "cash_sales": row["sales_cash"],
                    "upi_sales": row["sales_upi"],
                    "new_udhaar": new_udhaar_given,
                    "net_udhaar_today": net_udhaar_today,
                    "total_market_due": total_market_due
                },
                "udhaar_recovered": {
                    "cash": pay_row["recovered_cash"],
                    "upi": pay_row["recovered_upi"],
                    "total": total_recovered
                },
                "total_money_in": {
                    "cash_in_drawer": total_cash_in_drawer,
                    "upi_in_bank": total_upi_received,
                    "total_cash_plus_upi": total_cash_in_drawer + total_upi_received
                }
            }

    @staticmethod
    def get_items_sold_summary(report_date: str = None) -> list:
        """
        2. Samaan ka Hisab (Stock Summary):
        Aaj kaun sa samaan kitni quantity me bika.
        """
        if not report_date:
            report_date = str(date.today())

        with db.connection() as conn:
            rows = conn.execute("""
                SELECT 
                    si.product_name,
                    si.unit,
                    SUM(si.quantity) AS total_qty_sold,
                    SUM(si.line_total) AS total_amount
                FROM sales_items si
                JOIN sales_bills sb ON sb.id = si.sales_bill_id
                WHERE sb.status = 'CONFIRMED'
                  AND DATE(sb.bill_date) = DATE(?)
                GROUP BY si.product_id, si.product_name, si.unit
                ORDER BY total_qty_sold DESC;
            """, (report_date,)).fetchall()

            return [dict(r) for r in rows]

    @staticmethod
    def get_reorder_list() -> dict:
        """
        3. Re-order List (Purchase List):
        - Out of Stock: Stock = 0 (khatam ho gaya)
        - Low Stock: Stock <= Limit (khatam hone wala hai)
        """
        out_of_stock = db.get_out_of_stock_products()
        low_stock = db.get_low_stock_products()

        return {
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "total_items_to_reorder": len(out_of_stock) + len(low_stock)
        }

    @classmethod
    def get_full_closing_report(cls, report_date: str = None) -> dict:
        """Teeno reports ek sath lata hai."""
        return {
            "financial": cls.get_financial_summary(report_date),
            "items_sold": cls.get_items_sold_summary(report_date),
            "reorder_list": cls.get_reorder_list()
        }

    @classmethod
    def print_closing_report(cls, report_date: str = None):
        """Shaam ki closing report ko sundar format me terminal me print karta hai."""
        data = cls.get_full_closing_report(report_date)
        fin = data["financial"]
        items = data["items_sold"]
        reorder = data["reorder_list"]

        print("\n" + "=" * 65)
        print(f"  🌙 DAINIK CLOSING REPORT (DATE: {fin['date']})")
        print("=" * 65)

        # 1. Financial
        print("\n💰 1. VITTIYA HISAB (FINANCIAL SUMMARY):")
        print(f"   • Kul Bills (Invoices):      {fin['total_bills']}")
        print(f"   • Kul Bikri (Total Sales):   ₹{fin['total_sales']:.2f}")
        print(f"   • Di Gayi Chhoot (Discount): ₹{fin['total_discount']:.2f}")
        print("   ---------------------------------------------")
        print(f"   • Bikri se Cash:             ₹{fin['sales_breakdown']['cash_sales']:.2f}")
        print(f"   • Bikri se UPI:              ₹{fin['sales_breakdown']['upi_sales']:.2f}")
        print(f"   • Naya Udhaar (Baki):        ₹{fin['sales_breakdown']['new_udhaar']:.2f}")
        print("   ---------------------------------------------")
        print(f"   • Purana Udhaar Wasooli:     ₹{fin['udhaar_recovered']['total']:.2f} (Cash: ₹{fin['udhaar_recovered']['cash']}, UPI: ₹{fin['udhaar_recovered']['upi']})")
        print(f"   👉 GALLE ME CASH (Drawer):   ₹{fin['total_money_in']['cash_in_drawer']:.2f}")
        print(f"   👉 BANK ME UPI (Online):     ₹{fin['total_money_in']['upi_in_bank']:.2f}")

        # 2. Items Sold
        print("\n📦 2. SAMAAN KA HISAB (ITEMS SOLD TODAY):")
        if not items:
            print("   (Aaj koi samaan nahi bika)")
        else:
            print(f"   {'Samaan':<28} {'Bika (Qty)':<16} {'Kul Daam':<12}")
            print("   " + "-" * 56)
            for it in items:
                qty_str = f"{it['total_qty_sold']} {it['unit']}"
                print(f"   {it['product_name']:<28} {qty_str:<16} ₹{it['total_amount']:.2f}")

        # 3. Reorder List
        print("\n🛒 3. RE-ORDER LIST (KAL KYA MAL MANGANA HAI):")
        if reorder["total_items_to_reorder"] == 0:
            print("   ✅ Sabhi samaan ka stock theek hai!")
        else:
            if reorder["out_of_stock"]:
                print("   🔴 OUT OF STOCK (Khatam ho gaya):")
                for p in reorder["out_of_stock"]:
                    print(f"      • {p['name']} (Stock: 0 {p['unit']})")
            if reorder["low_stock"]:
                print("   ⚠️ LOW STOCK (Khatam hone wala hai):")
                for p in reorder["low_stock"]:
                    print(f"      • {p['name']} (Stock: {p['current_stock']} {p['unit']} | Limit: {p['low_stock_limit']})")

        print("=" * 65 + "\n")


reports = DailyReports()

