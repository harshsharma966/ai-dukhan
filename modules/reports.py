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

            # Aaj samaan wapas (Returns) kitna hua
            ret_row = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN refund_mode = 'CASH' THEN refund_amount ELSE 0 END), 0) AS refund_cash,
                    COALESCE(SUM(CASE WHEN refund_mode = 'UPI' THEN refund_amount ELSE 0 END), 0) AS refund_upi,
                    COALESCE(SUM(CASE WHEN refund_mode = 'DUE_ADJUSTMENT' THEN refund_amount ELSE 0 END), 0) AS refund_due_adj,
                    COALESCE(SUM(refund_amount), 0) AS total_refund
                FROM sales_returns
                WHERE DATE(created_at) = DATE(?);
            """, (report_date,)).fetchone()

            refund_cash = float(ret_row["refund_cash"] or 0)
            refund_upi = float(ret_row["refund_upi"] or 0)
            refund_due_adj = float(ret_row["refund_due_adj"] or 0)
            total_refund = float(ret_row["total_refund"] or 0)

            net_total_sales = max(0.0, round(float(row["total_sales"]) - total_refund, 2))
            total_cash_in_drawer = max(0.0, round(float(row["sales_cash"]) + float(pay_row["recovered_cash"]) - refund_cash, 2))
            total_upi_received = max(0.0, round(float(row["sales_upi"]) + float(pay_row["recovered_upi"]) - refund_upi, 2))
            new_udhaar_given = max(0.0, round(float(row["new_udhaar"]) - refund_due_adj, 2))
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
                "total_sales": net_total_sales,
                "gross_sales": row["gross_sales"],
                "total_discount": row["total_discount"],
                "total_returns": total_refund,
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
        Aaj kaun sa samaan kitni quantity me bika aur usse kitni kamai (profit) hui.
        """
        if not report_date:
            report_date = str(date.today())

        with db.connection() as conn:
            rows = conn.execute("""
                WITH ret_summary AS (
                    SELECT sri.sales_item_id, 
                           SUM(sri.quantity) AS ret_qty, 
                           SUM(sri.line_total) AS ret_amt
                    FROM sales_return_items sri
                    JOIN sales_returns sr ON sr.id = sri.sales_return_id
                    WHERE DATE(sr.created_at) = DATE(?)
                    GROUP BY sri.sales_item_id
                )
                SELECT 
                    si.product_name,
                    si.unit,
                    ROUND(SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0), 2) AS total_qty_sold,
                    ROUND(SUM(si.line_total) - COALESCE(SUM(rs.ret_amt), 0), 2) AS total_amount,
                    ROUND((SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0)) * p.cost_price, 2) AS total_cost,
                    ROUND((SUM(si.line_total) - COALESCE(SUM(rs.ret_amt), 0)) - ((SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0)) * p.cost_price), 2) AS profit
                FROM sales_items si
                JOIN sales_bills sb ON sb.id = si.sales_bill_id
                JOIN products p ON p.id = si.product_id
                LEFT JOIN ret_summary rs ON rs.sales_item_id = si.id
                WHERE sb.status = 'CONFIRMED'
                  AND DATE(sb.bill_date) = DATE(?)
                GROUP BY si.product_id, si.product_name, si.unit
                HAVING total_qty_sold > 0
                ORDER BY total_amount DESC;
            """, (report_date, report_date)).fetchall()

            return [dict(r) for r in rows]

    @staticmethod
    def get_daywise_earnings(limit: int = 15) -> list:
        """Din-war bikri, lagat aur shuddh munafa (Day-wise Earnings) deducting returns."""
        with db.connection() as conn:
            rows = conn.execute("""
                WITH bill_costs AS (
                    SELECT 
                        sb.id,
                        DATE(sb.bill_date) AS b_date,
                        sb.total_amount,
                        sb.discount,
                        sb.final_amount,
                        COALESCE(SUM(si.quantity * p.cost_price), 0) AS bill_cost
                    FROM sales_bills sb
                    JOIN sales_items si ON si.sales_bill_id = sb.id
                    JOIN products p ON p.id = si.product_id
                    WHERE sb.status = 'CONFIRMED'
                    GROUP BY sb.id
                ),
                daily_returns AS (
                    SELECT 
                        DATE(sr.created_at) AS ret_date,
                        COALESCE(SUM(sr.refund_amount), 0) AS total_refund,
                        COALESCE(SUM(sri.quantity * p.cost_price), 0) AS ret_cost
                    FROM sales_returns sr
                    JOIN sales_return_items sri ON sri.sales_return_id = sr.id
                    JOIN products p ON p.id = sri.product_id
                    GROUP BY DATE(sr.created_at)
                )
                SELECT 
                    bc.b_date AS date,
                    COUNT(bc.id) AS bills_count,
                    ROUND(SUM(bc.total_amount), 2) AS gross_sales,
                    ROUND(SUM(bc.discount), 2) AS total_discount,
                    ROUND(SUM(bc.final_amount) - COALESCE(dr.total_refund, 0), 2) AS net_sales,
                    ROUND(SUM(bc.bill_cost) - COALESCE(dr.ret_cost, 0), 2) AS total_cost,
                    ROUND((SUM(bc.final_amount) - COALESCE(dr.total_refund, 0)) - (SUM(bc.bill_cost) - COALESCE(dr.ret_cost, 0)), 2) AS net_profit
                FROM bill_costs bc
                LEFT JOIN daily_returns dr ON dr.ret_date = bc.b_date
                GROUP BY bc.b_date
                ORDER BY bc.b_date DESC
                LIMIT ?;
            """, (limit,)).fetchall()

            result = []
            for r in rows:
                d = dict(r)
                sales = float(d["net_sales"] or 0)
                profit = float(d["net_profit"] or 0)
                d["margin_pct"] = round((profit / sales * 100), 1) if sales > 0 else 0.0
                result.append(d)
            return result

    @staticmethod
    def get_monthwise_earnings(limit: int = 12) -> list:
        """Mahine-war bikri, lagat aur shuddh munafa (Month-wise Earnings) deducting returns."""
        with db.connection() as conn:
            rows = conn.execute("""
                WITH bill_costs AS (
                    SELECT 
                        sb.id,
                        strftime('%Y-%m', sb.bill_date) AS b_month,
                        sb.total_amount,
                        sb.discount,
                        sb.final_amount,
                        COALESCE(SUM(si.quantity * p.cost_price), 0) AS bill_cost
                    FROM sales_bills sb
                    JOIN sales_items si ON si.sales_bill_id = sb.id
                    JOIN products p ON p.id = si.product_id
                    WHERE sb.status = 'CONFIRMED'
                    GROUP BY sb.id
                ),
                monthly_returns AS (
                    SELECT 
                        strftime('%Y-%m', sr.created_at) AS ret_month,
                        COALESCE(SUM(sr.refund_amount), 0) AS total_refund,
                        COALESCE(SUM(sri.quantity * p.cost_price), 0) AS ret_cost
                    FROM sales_returns sr
                    JOIN sales_return_items sri ON sri.sales_return_id = sr.id
                    JOIN products p ON p.id = sri.product_id
                    GROUP BY strftime('%Y-%m', sr.created_at)
                )
                SELECT 
                    bc.b_month AS month_key,
                    COUNT(bc.id) AS bills_count,
                    ROUND(SUM(bc.total_amount), 2) AS gross_sales,
                    ROUND(SUM(bc.discount), 2) AS total_discount,
                    ROUND(SUM(bc.final_amount) - COALESCE(mr.total_refund, 0), 2) AS net_sales,
                    ROUND(SUM(bc.bill_cost) - COALESCE(mr.ret_cost, 0), 2) AS total_cost,
                    ROUND((SUM(bc.final_amount) - COALESCE(mr.total_refund, 0)) - (SUM(bc.bill_cost) - COALESCE(mr.ret_cost, 0)), 2) AS net_profit
                FROM bill_costs bc
                LEFT JOIN monthly_returns mr ON mr.ret_month = bc.b_month
                GROUP BY bc.b_month
                ORDER BY bc.b_month DESC
                LIMIT ?;
            """, (limit,)).fetchall()

            result = []
            for r in rows:
                d = dict(r)
                sales = float(d["net_sales"] or 0)
                profit = float(d["net_profit"] or 0)
                d["margin_pct"] = round((profit / sales * 100), 1) if sales > 0 else 0.0
                try:
                    from datetime import datetime
                    dt = datetime.strptime(d["month_key"], "%Y-%m")
                    d["month_label"] = dt.strftime("%B %Y")
                except Exception:
                    d["month_label"] = d["month_key"]
                result.append(d)
            return result

    @classmethod
    def get_earnings_summary(cls, report_date: str = None) -> dict:
        """Aaj ki aur is mahine ki shuddh kamai (Profit Summary)."""
        if not report_date:
            report_date = str(date.today())
        month_key = report_date[:7]

        day_list = cls.get_daywise_earnings(limit=60)
        month_list = cls.get_monthwise_earnings(limit=24)

        today_data = next((d for d in day_list if d["date"] == report_date), {
            "date": report_date, "bills_count": 0, "gross_sales": 0.0, "total_discount": 0.0,
            "net_sales": 0.0, "total_cost": 0.0, "net_profit": 0.0, "margin_pct": 0.0
        })

        month_data = next((m for m in month_list if m["month_key"] == month_key), {
            "month_key": month_key, "bills_count": 0, "gross_sales": 0.0, "total_discount": 0.0,
            "net_sales": 0.0, "total_cost": 0.0, "net_profit": 0.0, "margin_pct": 0.0, "month_label": month_key
        })

        return {
            "today": today_data,
            "month": month_data
        }

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
        """Sabhi reports ek sath lata hai (Financial, Earnings, Day-wise, Month-wise, Items, Reorder)."""
        if not report_date:
            report_date = str(date.today())

        return {
            "financial": cls.get_financial_summary(report_date),
            "earnings": cls.get_earnings_summary(report_date),
            "daywise_earnings": cls.get_daywise_earnings(limit=15),
            "monthwise_earnings": cls.get_monthwise_earnings(limit=12),
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

