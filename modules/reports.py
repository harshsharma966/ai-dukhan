"""
modules/reports.py - Module 4: Shaam ki Closing / Day End (Daily Closing Report) with Multi-Shop isolation.
"""

from database import db
from datetime import date

class DailyReports:
    @staticmethod
    def get_financial_summary(report_date: str = None, shop_id: int = 1) -> dict:
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
                  AND shop_id = ?
                  AND DATE(bill_date) = DATE(?);
            """, (shop_id, report_date)).fetchone()

            # Aaj purani udhari kitni wasool hui (customer_payments)
            pay_row = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END), 0) AS recovered_cash,
                    COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount ELSE 0 END), 0) AS recovered_upi,
                    COALESCE(SUM(amount), 0) AS total_recovered
                FROM customer_payments
                WHERE shop_id = ? AND DATE(payment_date) = DATE(?);
            """, (shop_id, report_date)).fetchone()

            # Aaj samaan wapas (Returns) kitna hua
            ret_row = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN refund_mode = 'CASH' THEN refund_amount ELSE 0 END), 0) AS refund_cash,
                    COALESCE(SUM(CASE WHEN refund_mode = 'UPI' THEN refund_amount ELSE 0 END), 0) AS refund_upi,
                    COALESCE(SUM(CASE WHEN refund_mode = 'DUE_ADJUSTMENT' THEN refund_amount ELSE 0 END), 0) AS refund_due_adj,
                    COALESCE(SUM(refund_amount), 0) AS total_refund
                FROM sales_returns
                WHERE shop_id = ? AND DATE(created_at) = DATE(?);
            """, (shop_id, report_date)).fetchone()

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

            cust_due_row = conn.execute("""
                SELECT COALESCE(SUM(current_due), 0) AS total_market_due
                FROM customers
                WHERE shop_id = ?;
            """, (shop_id,)).fetchone()
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
    def get_items_sold_summary(report_date: str = None, shop_id: int = 1) -> list:
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
                    WHERE sr.shop_id = ? AND DATE(sr.created_at) = DATE(?)
                    GROUP BY sri.sales_item_id
                )
                SELECT 
                    si.product_name,
                    si.unit,
                    ROUND(CAST(SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0) AS NUMERIC), 2) AS total_qty_sold,
                    ROUND(CAST(SUM(si.line_total) - COALESCE(SUM(rs.ret_amt), 0) AS NUMERIC), 2) AS total_amount,
                    ROUND(CAST((SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0)) * p.cost_price AS NUMERIC), 2) AS total_cost,
                    ROUND(CAST((SUM(si.line_total) - COALESCE(SUM(rs.ret_amt), 0)) - ((SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0)) * p.cost_price) AS NUMERIC), 2) AS profit
                FROM sales_items si
                JOIN sales_bills sb ON sb.id = si.sales_bill_id
                JOIN products p ON p.id = si.product_id
                LEFT JOIN ret_summary rs ON rs.sales_item_id = si.id
                WHERE sb.status = 'CONFIRMED'
                  AND sb.shop_id = ?
                  AND DATE(sb.bill_date) = DATE(?)
                GROUP BY si.product_id, si.product_name, si.unit, p.cost_price
                HAVING SUM(si.quantity) - COALESCE(SUM(rs.ret_qty), 0) > 0
                ORDER BY total_amount DESC;
            """, (shop_id, report_date, shop_id, report_date)).fetchall()

            return [dict(r) for r in rows]

    @staticmethod
    def get_daywise_earnings(limit: int = 15, shop_id: int = 1) -> list:
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
                    WHERE sb.status = 'CONFIRMED' AND sb.shop_id = ?
                    GROUP BY sb.id, sb.bill_date, sb.total_amount, sb.discount, sb.final_amount
                ),
                daily_returns AS (
                    SELECT 
                        DATE(sr.created_at) AS ret_date,
                        COALESCE(SUM(sr.refund_amount), 0) AS total_refund,
                        COALESCE(SUM(sri.quantity * p.cost_price), 0) AS ret_cost
                    FROM sales_returns sr
                    JOIN sales_return_items sri ON sri.sales_return_id = sr.id
                    JOIN products p ON p.id = sri.product_id
                    WHERE sr.shop_id = ?
                    GROUP BY DATE(sr.created_at)
                )
                SELECT 
                    bc.b_date AS date,
                    COUNT(bc.id) AS bills_count,
                    ROUND(CAST(SUM(bc.total_amount) AS NUMERIC), 2) AS gross_sales,
                    ROUND(CAST(SUM(bc.discount) AS NUMERIC), 2) AS total_discount,
                    ROUND(CAST(SUM(bc.final_amount) - COALESCE(MAX(dr.total_refund), 0) AS NUMERIC), 2) AS net_sales,
                    ROUND(CAST(SUM(bc.bill_cost) - COALESCE(MAX(dr.ret_cost), 0) AS NUMERIC), 2) AS total_cost,
                    ROUND(CAST((SUM(bc.final_amount) - COALESCE(MAX(dr.total_refund), 0)) - (SUM(bc.bill_cost) - COALESCE(MAX(dr.ret_cost), 0)) AS NUMERIC), 2) AS net_profit
                FROM bill_costs bc
                LEFT JOIN daily_returns dr ON dr.ret_date = bc.b_date
                GROUP BY bc.b_date
                ORDER BY bc.b_date DESC
                LIMIT ?;
            """, (shop_id, shop_id, limit)).fetchall()

            result = []
            for r in rows:
                d = dict(r)
                sales = float(d["net_sales"] or 0)
                profit = float(d["net_profit"] or 0)
                d["margin_pct"] = round((profit / sales * 100), 1) if sales > 0 else 0.0
                result.append(d)
            return result

    @staticmethod
    def get_monthwise_earnings(limit: int = 12, shop_id: int = 1) -> list:
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
                    WHERE sb.status = 'CONFIRMED' AND sb.shop_id = ?
                    GROUP BY sb.id, sb.bill_date, sb.total_amount, sb.discount, sb.final_amount
                ),
                monthly_returns AS (
                    SELECT 
                        strftime('%Y-%m', sr.created_at) AS ret_month,
                        COALESCE(SUM(sr.refund_amount), 0) AS total_refund,
                        COALESCE(SUM(sri.quantity * p.cost_price), 0) AS ret_cost
                    FROM sales_returns sr
                    JOIN sales_return_items sri ON sri.sales_return_id = sr.id
                    JOIN products p ON p.id = sri.product_id
                    WHERE sr.shop_id = ?
                    GROUP BY strftime('%Y-%m', sr.created_at)
                )
                SELECT 
                    bc.b_month AS month_key,
                    COUNT(bc.id) AS bills_count,
                    ROUND(CAST(SUM(bc.total_amount) AS NUMERIC), 2) AS gross_sales,
                    ROUND(CAST(SUM(bc.discount) AS NUMERIC), 2) AS total_discount,
                    ROUND(CAST(SUM(bc.final_amount) - COALESCE(MAX(mr.total_refund), 0) AS NUMERIC), 2) AS net_sales,
                    ROUND(CAST(SUM(bc.bill_cost) - COALESCE(MAX(mr.ret_cost), 0) AS NUMERIC), 2) AS total_cost,
                    ROUND(CAST((SUM(bc.final_amount) - COALESCE(MAX(mr.total_refund), 0)) - (SUM(bc.bill_cost) - COALESCE(MAX(mr.ret_cost), 0)) AS NUMERIC), 2) AS net_profit
                FROM bill_costs bc
                LEFT JOIN monthly_returns mr ON mr.ret_month = bc.b_month
                GROUP BY bc.b_month
                ORDER BY bc.b_month DESC
                LIMIT ?;
            """, (shop_id, shop_id, limit)).fetchall()

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
    def get_earnings_summary(cls, report_date: str = None, shop_id: int = 1) -> dict:
        if not report_date:
            report_date = str(date.today())
        month_key = report_date[:7]

        day_list = cls.get_daywise_earnings(limit=60, shop_id=shop_id)
        month_list = cls.get_monthwise_earnings(limit=24, shop_id=shop_id)

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
    def get_reorder_list(shop_id: int = 1) -> dict:
        out_of_stock = db.get_out_of_stock_products(shop_id=shop_id)
        low_stock = db.get_low_stock_products(shop_id=shop_id)

        return {
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "total_items_to_reorder": len(out_of_stock) + len(low_stock)
        }

    @classmethod
    def get_full_closing_report(cls, report_date: str = None, shop_id: int = 1) -> dict:
        if not report_date:
            report_date = str(date.today())

        return {
            "financial": cls.get_financial_summary(report_date, shop_id=shop_id),
            "earnings": cls.get_earnings_summary(report_date, shop_id=shop_id),
            "daywise_earnings": cls.get_daywise_earnings(limit=15, shop_id=shop_id),
            "monthwise_earnings": cls.get_monthwise_earnings(limit=12, shop_id=shop_id),
            "items_sold": cls.get_items_sold_summary(report_date, shop_id=shop_id),
            "reorder_list": cls.get_reorder_list(shop_id=shop_id)
        }


reports = DailyReports()
