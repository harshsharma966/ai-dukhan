"""
modules/sales.py - Module 2: Customer Selling & Billing (Stock OUT).

Quick Walk-in supported (customer_id is None).
Stock changes ONLY when confirm_sale() succeeds in a single atomic transaction.
"""

from database import db

class SalesManager:
    @staticmethod
    def create_bill(customer_id: int = None, payment_mode: str = "CASH",
                    amount_received: float = 0.0, discount: float = 0.0,
                    bill_number: str = None) -> int:
        """
        Naya Sales Bill (DRAFT) shuru karta hai.
        customer_id=None means Quick Walk-in customer.
        """
        return db.create_sales_bill(
            customer_id=customer_id,
            payment_mode=payment_mode,
            amount_received=amount_received,
            discount=discount,
            bill_number=bill_number
        )

    @staticmethod
    def add_item_to_cart(sales_bill_id: int, product_id: int, quantity: float,
                         selling_price: float = None) -> int:
        """
        Cart me item jodta hai.
        Product name aur unit ka snapshot save karta hai taaki historical bills safe rahein.
        """
        # Quick stock warning check (non-blocking for draft, strictly enforced on confirm)
        prod = db.get_product(product_id)
        if not prod:
            raise ValueError(f"Product ID {product_id} nahi mila.")
        
        if prod["current_stock"] <= 0:
            print(f"⚠️ Warning: '{prod['name']}' ka stock 0 hai (Out of Stock)!")
        elif prod["current_stock"] < quantity:
            print(f"⚠️ Warning: '{prod['name']}' ka stock sirf {prod['current_stock']} hai, jabki manga {quantity} gaya hai!")

        return db.add_sales_item(
            sales_bill_id=sales_bill_id,
            product_id=product_id,
            quantity=quantity,
            selling_price=selling_price
        )

    @staticmethod
    def update_payment(sales_bill_id: int, payment_mode: str,
                       amount_received: float = 0.0, discount: float = 0.0):
        """
        Payment mode, discount aur amount received update karta hai
        aur automatically paid, change, aur due calculate karta hai.
        """
        db.update_sales_payment(
            sales_bill_id=sales_bill_id,
            payment_mode=payment_mode,
            amount_received=amount_received,
            discount=discount
        )

    @staticmethod
    def get_bill(sales_bill_id: int) -> dict:
        """Sales bill aur uske saare cart items details ke sath lata hai."""
        return db.get_sales_bill(sales_bill_id)

    @staticmethod
    def get_bills(query: str = None, date: str = None, status: str = None, limit: int = 100) -> list:
        """Puraane bills search aur filter karta hai."""
        return db.get_sales_bills(query=query, date=date, status=status, limit=limit)

    @staticmethod
    def get_bill_details(sales_bill_id: int) -> dict:
        """Bill ki poori detail aur return eligibility lata hai."""
        return db.get_sales_bill_details(sales_bill_id)

    @staticmethod
    def confirm_sale(sales_bill_id: int) -> bool:
        """
        Atomic Confirmation (Stock OUT):
        1. Check karta hai ki bill DRAFT ho.
        2. Sabhi items ka stock check karta hai (kisi ka stock kam ho toh turant rollback).
        3. Check karta hai ki Walk-in customer ka due_amount 0 ho (Udhaar sirf registered customer ko).
        4. Har product ka stock ghatata hai (current_stock - quantity).
        5. Agar udhaar hai, toh customer.current_due badhata hai.
        6. Bill status 'CONFIRMED' karta hai.
        """
        db.confirm_sale(sales_bill_id)
        return True

    @staticmethod
    def cancel_sale(sales_bill_id: int) -> bool:
        """Draft sales bill ko cancel karta hai."""
        db.cancel_sales_bill(sales_bill_id)
        return True


sales = SalesManager()

