"""
modules/post_sale.py - Module 3: Post-Sale Operations with Multi-Shop isolation.
"""

from database import db

class PostSaleService:
    @staticmethod
    def get_customer_due(customer_id: int, shop_id: int = 1) -> float:
        with db.connection() as conn:
            row = conn.execute(
                "SELECT current_due, name FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            if not row:
                raise ValueError(f"Customer ID {customer_id} nahi mila.")
            return float(row["current_due"])

    @staticmethod
    def recover_udhaar(customer_id: int, amount: float, payment_mode: str = "CASH",
                       notes: str = None, shop_id: int = 1) -> dict:
        if amount <= 0:
            raise ValueError("Payment amount zero se bada hona chahiye.")
        
        payment_mode = payment_mode.upper()
        if payment_mode not in ('CASH', 'UPI'):
            raise ValueError(f"Invalid payment mode: {payment_mode}. CASH ya UPI use karein.")

        with db.connection() as conn:
            cust = conn.execute(
                "SELECT id, name, mobile, current_due FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            if not cust:
                raise ValueError(f"Customer ID {customer_id} nahi mila.")

            current_due = float(cust["current_due"])
            if current_due <= 0:
                raise ValueError(f"{cust['name']} ke naam par koi purana udhaar baki nahi hai (Due = 0).")

            if amount > current_due:
                raise ValueError(
                    f"Payment amount (₹{amount}) baki udhaar (₹{current_due}) se zyada nahi ho sakta!"
                )

            # 1. Insert into customer_payments history
            cur = conn.execute("""
                INSERT INTO customer_payments (shop_id, customer_id, amount, payment_mode, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (shop_id, customer_id, amount, payment_mode, notes))
            payment_id = cur.lastrowid

            # 2. Update customer balance
            new_due = round(current_due - amount, 2)
            conn.execute("""
                UPDATE customers SET current_due=? WHERE id=? AND shop_id=?
            """, (new_due, customer_id, shop_id))

            # Fetch payment record for exact timestamp
            pay_record = conn.execute(
                "SELECT payment_date FROM customer_payments WHERE id=?", (payment_id,)
            ).fetchone()
            payment_date_str = str(pay_record["payment_date"]) if pay_record and pay_record["payment_date"] else ""

            # Fetch shop details
            shop_record = conn.execute(
                "SELECT shop_name, mobile, address FROM shops WHERE id=?", (shop_id,)
            ).fetchone()

            return {
                "payment_id": payment_id,
                "receipt_number": f"PAY-{payment_id:05d}",
                "customer_id": customer_id,
                "customer_name": cust["name"],
                "customer_mobile": cust["mobile"] or "",
                "amount_paid": amount,
                "payment_mode": payment_mode,
                "previous_due": current_due,
                "new_due": new_due,
                "payment_date": payment_date_str,
                "notes": notes or "",
                "shop_name": shop_record["shop_name"] if shop_record else "",
                "shop_mobile": shop_record["mobile"] if shop_record else "",
                "shop_address": shop_record["address"] if shop_record else ""
            }

    @staticmethod
    def return_product(sales_bill_id: int, return_items: list,
                       refund_mode: str = "CASH", reason: str = None, shop_id: int = 1) -> dict:
        if not return_items:
            raise ValueError("Return items ki list khali nahi ho sakti.")

        refund_mode = refund_mode.upper()
        if refund_mode not in ('CASH', 'UPI', 'DUE_ADJUSTMENT'):
            raise ValueError(f"Invalid refund mode: {refund_mode}")

        with db.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM sales_bills WHERE id=? AND shop_id=?", (sales_bill_id, shop_id)
            ).fetchone()
            if not bill:
                raise ValueError(f"Sales Bill ID {sales_bill_id} nahi mila.")
            if bill["status"] != "CONFIRMED":
                raise ValueError(f"Sirf CONFIRMED bill ka samaan wapas ho sakta hai (Current status: {bill['status']}).")

            if refund_mode == 'DUE_ADJUSTMENT' and bill["customer_id"] is None:
                raise ValueError("Walk-in customer ke liye DUE_ADJUSTMENT nahi ho sakta. CASH ya UPI refund chunein.")

            total_refund = 0.0
            processed_items = []

            for item_req in return_items:
                s_item_id = item_req["sales_item_id"]
                ret_qty = float(item_req["quantity"])
                if ret_qty <= 0:
                    raise ValueError("Return quantity zero se badi honi chahiye.")

                s_item = conn.execute(
                    "SELECT * FROM sales_items WHERE id=? AND sales_bill_id=?",
                    (s_item_id, sales_bill_id)
                ).fetchone()
                if not s_item:
                    raise ValueError(f"Sales Item ID {s_item_id} is bill me nahi mila.")

                already_ret = conn.execute("""
                    SELECT COALESCE(SUM(quantity), 0) FROM sales_return_items WHERE sales_item_id=?
                """, (s_item_id,)).fetchone()[0]

                max_allowed = round(s_item["quantity"] - already_ret, 2)
                if ret_qty > max_allowed:
                    raise ValueError(
                        f"'{s_item['product_name']}' ki zyada quantity return nahi ho sakti! "
                        f"Sold: {s_item['quantity']}, Pehle Return: {already_ret}, Ab allowed: {max_allowed}"
                    )

                price = s_item["selling_price"]
                line_refund = round(ret_qty * price, 2)
                total_refund += line_refund

                processed_items.append({
                    "sales_item_id": s_item_id,
                    "product_id": s_item["product_id"],
                    "product_name": s_item["product_name"],
                    "quantity": ret_qty,
                    "refund_price": price,
                    "line_total": line_refund
                })

            total_refund = round(total_refund, 2)

            cur = conn.execute("""
                INSERT INTO sales_returns (shop_id, sales_bill_id, refund_amount, refund_mode, reason)
                VALUES (?, ?, ?, ?, ?)
            """, (shop_id, sales_bill_id, total_refund, refund_mode, reason))
            return_id = cur.lastrowid

            for pi in processed_items:
                conn.execute("""
                    INSERT INTO sales_return_items
                    (sales_return_id, sales_item_id, product_id, quantity, refund_price, line_total)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (return_id, pi["sales_item_id"], pi["product_id"], pi["quantity"], pi["refund_price"], pi["line_total"]))

                conn.execute("""
                    UPDATE products
                    SET current_stock = current_stock + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id=? AND shop_id=?
                """, (pi["quantity"], pi["product_id"], shop_id))

            if refund_mode == 'DUE_ADJUSTMENT' and bill["customer_id"]:
                conn.execute("""
                    UPDATE customers
                    SET current_due = MAX(0.0, current_due - ?)
                    WHERE id=? AND shop_id=?
                """, (total_refund, bill["customer_id"], shop_id))

            return {
                "return_id": return_id,
                "sales_bill_id": sales_bill_id,
                "refund_amount": total_refund,
                "refund_mode": refund_mode,
                "returned_items": processed_items
            }

    @staticmethod
    def cancel_bill(sales_bill_id: int, reason: str = None, shop_id: int = 1) -> dict:
        with db.connection() as conn:
            bill = conn.execute(
                "SELECT * FROM sales_bills WHERE id=? AND shop_id=?", (sales_bill_id, shop_id)
            ).fetchone()
            if not bill:
                raise ValueError(f"Sales Bill ID {sales_bill_id} nahi mila.")
            if bill["status"] == "CANCELLED":
                raise ValueError(f"Bill #{sales_bill_id} pehle se CANCELLED hai!")
            if bill["status"] != "CONFIRMED":
                raise ValueError(f"Sirf CONFIRMED bill cancel kiya ja sakta hai (Current status: {bill['status']}).")

            items = conn.execute(
                "SELECT * FROM sales_items WHERE sales_bill_id=?", (sales_bill_id,)
            ).fetchall()

            restored_summary = []
            for item in items:
                already_ret = conn.execute("""
                    SELECT COALESCE(SUM(quantity), 0) FROM sales_return_items WHERE sales_item_id=?
                """, (item["id"],)).fetchone()[0]

                remaining_to_restore = max(0.0, round(item["quantity"] - already_ret, 2))

                if remaining_to_restore > 0:
                    conn.execute("""
                        UPDATE products
                        SET current_stock = current_stock + ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id=? AND shop_id=?
                    """, (remaining_to_restore, item["product_id"], shop_id))

                restored_summary.append({
                    "product_name": item["product_name"],
                    "restored_quantity": remaining_to_restore
                })

            due_reversed = 0.0
            if bill["customer_id"] and bill["due_amount"] > 0:
                due_reversed = bill["due_amount"]
                conn.execute("""
                    UPDATE customers
                    SET current_due = MAX(0.0, current_due - ?)
                    WHERE id=? AND shop_id=?
                """, (due_reversed, bill["customer_id"], shop_id))

            conn.execute("""
                UPDATE sales_bills SET status='CANCELLED' WHERE id=? AND shop_id=?
            """, (sales_bill_id, shop_id))

            return {
                "sales_bill_id": sales_bill_id,
                "status": "CANCELLED",
                "restored_items": restored_summary,
                "due_reversed": due_reversed
            }


post_sale = PostSaleService()
