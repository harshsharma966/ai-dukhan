"""
main.py - Kirana Shop AI Main Entry Point.

Demonstrates:
1. Module 1: Purchase / Stock IN (via modules.purchase)
2. Module 2: Customer Billing / Stock OUT (via modules.sales & modules.customers)
"""

import sys
from pathlib import Path

# Ensure root directory is in python path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database import db
from modules.customers import customers
from modules.purchase import purchase
from modules.sales import sales

def separator(title):
    print("\n" + "=" * 70)
    print(f"  📌 {title}")
    print("=" * 70)

def display_inventory():
    print(f"{'ID':<4} {'Samaan ka Naam':<26} {'Stock':<16} {'CP (₹)':<10} {'SP (₹)':<10}")
    print("-" * 70)
    for p in db.get_all_products():
        print(f"{p['id']:<4} {p['name']:<26} {str(p['current_stock']) + ' ' + p['unit']:<16} {p['cost_price']:<10.1f} {p['selling_price']:<10.1f}")

def demo_full_workflow():
    separator("1. SHURUATI STOCK (Initial Shop Inventory)")
    db.seed_sample_products()
    display_inventory()

    # -------------------------------------------------------------
    # DEMO 1: PURCHASE / STOCK IN (MODULE 1)
    # -------------------------------------------------------------
    separator("2. MODULE 1: PARCHA SCAN SE STOCK IN (Purchase)")
    print("📸 Parcha Photo upload hui: 'uploads/parcha_01.jpg'")
    
    # 1. Create Purchase Bill
    p_bill_id = purchase.create_bill(image_path="uploads/parcha_01.jpg")
    
    # 2. Add Items (1 Existing: Tata Salt, 1 New: Good Day Biscuit)
    purchase.add_item(p_bill_id, raw_name="Tata Salt 1kg", quantity=10, cost_price=23)
    purchase.add_item(p_bill_id, raw_name="Britannia Good Day", quantity=20, cost_price=16, selling_price=20, is_new_item=True)
    
    p_bill = purchase.get_bill(p_bill_id)
    print(f"📄 Purchase Draft Bill #{p_bill['id']} bana (Total: ₹{p_bill['total_amount']:.2f}, Status: {p_bill['status']})")
    print("👉 Confirming Purchase Stock IN...")
    purchase.confirm_purchase(p_bill_id)
    print("✅ Purchase Bill CONFIRMED! Naya stock add ho gaya.")

    # -------------------------------------------------------------
    # DEMO 2: CUSTOMER BILLING - QUICK WALK-IN (CASH + CHANGE)
    # -------------------------------------------------------------
    separator("3. MODULE 2: QUICK WALK-IN BILL (Cash Payment + Change Calculator)")
    print("⚡ 70% bheed wala Walk-in Grahak aaya (No customer registration needed)")
    
    # Quick walk-in bill (customer_id=None)
    w_bill_id = sales.create_bill(customer_id=None, payment_mode="CASH")
    
    # Cart me samaan dala: 2 Tata Salt
    tata = db.match_product_smart("Tata Salt")
    sales.add_item_to_cart(w_bill_id, product_id=tata["id"], quantity=2)
    
    # Payment: Grahak ne ₹500 ka note diya
    sales.update_payment(w_bill_id, payment_mode="CASH", amount_received=500.0)
    
    w_bill = sales.get_bill(w_bill_id)
    print(f"🧾 Bill No: {w_bill['bill_number']}")
    print(f"   Subtotal: ₹{w_bill['total_amount']:.2f}")
    print(f"   Amount Received (Grahak ne diya): ₹{w_bill['amount_received']:.2f}")
    print(f"   Paid Amount (Bill me jama):      ₹{w_bill['paid_amount']:.2f}")
    print(f"   🔄 Change to Return (Chhutte):    ₹{w_bill['change_amount']:.2f}")
    
    print("👉 Confirming Walk-in Sale...")
    sales.confirm_sale(w_bill_id)
    print(f"✅ Walk-in Bill CONFIRMED! Tata Salt stock 2 kam ho gaya.")

    # -------------------------------------------------------------
    # DEMO 3: REGULAR CUSTOMER - UDHAAR / PARTIAL PAYMENT
    # -------------------------------------------------------------
    separator("4. MODULE 2: REGULAR CUSTOMER (Partial / Udhaar Payment)")
    # Register or find customer
    c = customers.find_by_mobile("9876543210")
    if not c:
        c_id = customers.add_customer(name="Ramesh Kumar", mobile="9876543210")
        c = customers.get_customer(c_id)
    else:
        c_id = c["id"]

    print(f"👤 Grahak: {c['name']} (Mobile: {c['mobile']} | Purana Udhaar: ₹{c['current_due']:.2f})")

    # Bill banaya: Aashirvaad Atta 5kg (1 pkt @ ₹270)
    atta = db.match_product_smart("Aashirvaad Atta")
    r_bill_id = sales.create_bill(customer_id=c_id, payment_mode="PARTIAL")
    sales.add_item_to_cart(r_bill_id, product_id=atta["id"], quantity=1)

    # Partial payment: Bill बना ₹270, Ramesh ne ₹200 diya, baki ₹70 udhaar!
    sales.update_payment(r_bill_id, payment_mode="PARTIAL", amount_received=200.0)
    
    r_bill = sales.get_bill(r_bill_id)
    print(f"🧾 Bill No: {r_bill['bill_number']}")
    print(f"   Final Bill: ₹{r_bill['final_amount']:.2f}")
    print(f"   Paid Now (Jama kiya):  ₹{r_bill['paid_amount']:.2f}")
    print(f"   Udhaar Due (Baki):     ₹{r_bill['due_amount']:.2f}")

    print("👉 Confirming Partial Udhaar Sale...")
    sales.confirm_sale(r_bill_id)
    print("✅ Sale CONFIRMED! Atta stock 1 kam hua aur Ramesh ke khate me udhaar jud gaya.")

    # Customer updated ledger
    c_updated = customers.get_customer(c_id)
    print(f"📒 Ramesh Kumar ka Naya Udhaar Balance: ₹{c_updated['current_due']:.2f}")

    # -------------------------------------------------------------
    # DEMO 4: STOCK PROTECTION VALIDATION (OUT OF STOCK TEST)
    # -------------------------------------------------------------
    separator("5. SAFETY TEST: INSUFFICIENT STOCK CHECK")
    print("Ek aur grahak aaya jisne 10 packet Aashirvaad Atta manga (dukaan me sirf 3 bache hain)")
    fail_bill_id = sales.create_bill(customer_id=None, payment_mode="CASH", amount_received=3000)
    sales.add_item_to_cart(fail_bill_id, product_id=atta["id"], quantity=10)
    
    try:
        sales.confirm_sale(fail_bill_id)
    except ValueError as e:
        print(f"🛑 BLOCKED BY SYSTEM: {e}")
        print("🛡️ Stock bach gaya! Adha ya bina stock ka bill kabhi confirm nahi hoga.")

    # -------------------------------------------------------------
    # FINAL INVENTORY
    # -------------------------------------------------------------
    separator("6. FINAL DUKAAN STOCK (After Purchase & Sales)")
    display_inventory()
    print("=" * 70 + "\n")

if __name__ == "__main__":
    demo_full_workflow()
