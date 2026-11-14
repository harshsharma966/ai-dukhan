"""
modules/purchase.py - Module 1: Purchase / Stock IN from Parcha (Supplier Bill) with Multi-Shop isolation.
"""

from database import db

class PurchaseManager:
    @staticmethod
    def match_product(raw_name: str, shop_id: int = 1) -> dict:
        return db.match_product_smart(raw_name, shop_id=shop_id)

    @staticmethod
    def create_bill(image_path: str = None, bill_date: str = None, shop_id: int = 1) -> int:
        return db.create_purchase_bill(image_path=image_path, bill_date=bill_date, shop_id=shop_id)

    @staticmethod
    def add_item(purchase_bill_id: int, raw_name: str, quantity: float,
                 cost_price: float, unit: str = "packet", product_id: int = None,
                 selling_price: float = None, is_new_item: bool = False, shop_id: int = 1) -> int:
        if product_id is None and not is_new_item:
            matched = db.match_product_smart(raw_name, shop_id=shop_id)
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
    def get_bill(bill_id: int, shop_id: int = 1) -> dict:
        return db.get_purchase_bill(bill_id, shop_id=shop_id)

    @staticmethod
    def confirm_purchase(bill_id: int, shop_id: int = 1) -> bool:
        db.confirm_purchase(bill_id, shop_id=shop_id)
        return True

    @staticmethod
    def cancel_draft(bill_id: int, shop_id: int = 1) -> bool:
        db.cancel_draft_purchase(bill_id, shop_id=shop_id)
        return True


purchase = PurchaseManager()
