"""
modules/purchase.py - Module 1: Purchase / Stock IN from Parcha (Supplier Bill).

Supplier is optional. Stock changes ONLY when confirm_purchase() succeeds.
"""

from database import db

class PurchaseManager:
    @staticmethod
    def match_product(raw_name: str) -> dict:
        """Parcha par likhe naam ko dukaan ke purane product se match karta hai."""
        return db.match_product_smart(raw_name)

    @staticmethod
    def create_bill(image_path: str = None, bill_date: str = None) -> int:
        """Naya Purchase Bill (DRAFT) banata hai."""
        return db.create_purchase_bill(image_path=image_path, bill_date=bill_date)

    @staticmethod
    def add_item(purchase_bill_id: int, raw_name: str, quantity: float,
                 cost_price: float, unit: str = "packet", product_id: int = None,
                 selling_price: float = None, is_new_item: bool = False) -> int:
        """
        Parcha ke andar item jodta hai.
        Agar product_id nahi diya aur pehle se maujood hai, toh auto-link karta hai.
        """
        if product_id is None and not is_new_item:
            matched = db.match_product_smart(raw_name)
            if matched:
                product_id = matched["id"]
                if selling_price is None:
                    selling_price = matched["selling_price"]
            else:
                is_new_item = True

        return db.add_purchase_item(
            purchase_bill_id=purchase_bill_id,
            raw_name=raw_name,
            quantity=quantity,
            cost_price=cost_price,
            unit=unit,
            product_id=product_id,
            selling_price=selling_price,
            is_new_item=is_new_item
        )

    @staticmethod
    def get_bill(bill_id: int) -> dict:
        """Purchase bill aur uske saare items fetch karta hai."""
        return db.get_purchase_bill(bill_id)

    @staticmethod
    def confirm_purchase(bill_id: int) -> bool:
        """
        Atomic confirmation:
        - Existing products: current_stock += purchased quantity
        - New products: Auto-created with purchased quantity as opening stock
        - Bill status marked CONFIRMED
        """
        db.confirm_purchase(bill_id)
        return True

    @staticmethod
    def cancel_draft(bill_id: int) -> bool:
        """Draft purchase bill ko cancel karta hai."""
        db.cancel_draft_purchase(bill_id)
        return True


purchase = PurchaseManager()

