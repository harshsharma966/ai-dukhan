"""
modules/sales.py - Module 2: Customer Selling & Billing (Stock OUT) with Multi-Shop isolation.
"""

from database import db

class SalesManager:
    @staticmethod
    def create_bill(customer_id: int = None, payment_mode: str = "CASH",
                    amount_received: float = 0.0, discount: float = 0.0,
                    bill_number: str = None, shop_id: int = 1,
                    created_by_staff_id: int = None, created_by_name: str = None) -> int:
        return db.create_sales_bill(
            customer_id=customer_id,
            payment_mode=payment_mode,
            amount_received=amount_received,
            discount=discount,
            bill_number=bill_number,
            shop_id=shop_id,
            created_by_staff_id=created_by_staff_id,
            created_by_name=created_by_name
        )

    @staticmethod
    def add_item_to_cart(sales_bill_id: int, product_id: int, quantity: float,
                         selling_price: float = None, shop_id: int = 1) -> int:
        prod = db.get_product(product_id, shop_id=shop_id)
        if not prod:
            raise ValueError(f"Product ID {product_id} nahi mila.")
        
        return db.add_sales_item(
            sales_bill_id=sales_bill_id,
            product_id=product_id,
            quantity=quantity,
            selling_price=selling_price
        )

    @staticmethod
    def update_payment(sales_bill_id: int, payment_mode: str,
                       amount_received: float = 0.0, discount: float = 0.0):
        db.update_sales_payment(
            sales_bill_id=sales_bill_id,
            payment_mode=payment_mode,
            amount_received=amount_received,
            discount=discount
        )

    @staticmethod
    def get_bill(sales_bill_id: int, shop_id: int = 1) -> dict:
        return db.get_sales_bill(sales_bill_id, shop_id=shop_id)

    @staticmethod
    def get_bills(query: str = None, date: str = None, status: str = None, limit: int = 100, shop_id: int = 1) -> list:
        return db.get_sales_bills(query=query, date=date, status=status, limit=limit, shop_id=shop_id)

    @staticmethod
    def get_bill_details(sales_bill_id: int, shop_id: int = 1) -> dict:
        return db.get_sales_bill_details(sales_bill_id, shop_id=shop_id)

    @staticmethod
    def confirm_sale(sales_bill_id: int, shop_id: int = 1) -> bool:
        db.confirm_sale(sales_bill_id, shop_id=shop_id)
        return True

    @staticmethod
    def cancel_sale(sales_bill_id: int, shop_id: int = 1) -> bool:
        db.cancel_sales_bill(sales_bill_id, shop_id=shop_id)
        return True


sales = SalesManager()
