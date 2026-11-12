"""
app.py - Kirana Shop AI Web Application Backend (FastAPI).

Integrates all 4 modules:
1. Purchase (Stock IN)
2. Sales & Billing (Stock OUT)
3. Post-Sale (Udhaar Recovery, Returns, Cancellation)
4. Daily Closing Reports
"""

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
import uvicorn
import os

from database import db
from modules.customers import customers
from modules.purchase import purchase
from modules.sales import sales
from modules.post_sale import post_sale
from modules.reports import reports

# Ensure sample products are seeded on start
db.seed_sample_products()

app = FastAPI(title="Kirana Shop AI System", version="1.0.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# -------------------------------------------------------------
# PYDANTIC SCHEMAS
# -------------------------------------------------------------
class PurchaseItemIn(BaseModel):
    raw_name: str
    quantity: float
    unit: str = "packet"
    cost_price: float
    selling_price: Optional[float] = None
    low_stock_limit: Optional[float] = 5.0

class UpdateLimitPayload(BaseModel):
    low_stock_limit: float

class ManualPurchasePayload(BaseModel):
    items: List[PurchaseItemIn]

class CartItemIn(BaseModel):
    product_id: int
    quantity: float
    selling_price: Optional[float] = None

class CreateSalePayload(BaseModel):
    customer_id: Optional[int] = None
    items: List[CartItemIn]
    discount: float = 0.0
    payment_mode: str = "CASH"
    amount_received: float = 0.0

class AddCustomerPayload(BaseModel):
    name: str
    mobile: Optional[str] = None

class RecoverUdhaarPayload(BaseModel):
    customer_id: int
    amount: float
    payment_mode: str = "CASH"
    notes: Optional[str] = None

class ReturnItemIn(BaseModel):
    sales_item_id: int
    quantity: float

class ReturnProductPayload(BaseModel):
    sales_bill_id: int
    return_items: List[ReturnItemIn]
    refund_mode: str = "CASH"
    reason: Optional[str] = None

class CancelBillPayload(BaseModel):
    sales_bill_id: int
    reason: Optional[str] = None

# -------------------------------------------------------------
# HOME ROUTE
# -------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")

# -------------------------------------------------------------
# 1. PRODUCTS & INVENTORY APIs
# -------------------------------------------------------------
@app.get("/api/products")
async def get_products(q: Optional[str] = None):
    if q and q.strip():
        items = db.search_products(q.strip())
    else:
        items = db.get_all_products()
    return {"success": True, "products": items}

@app.get("/api/products/match")
async def match_product(name: str = Query(...)):
    matched = db.match_product_smart(name.strip())
    return {"success": True, "matched": matched}

@app.post("/api/products/{product_id}/update-limit")
async def update_product_limit(product_id: int, payload: UpdateLimitPayload):
    try:
        db.update_product_limit(product_id, payload.low_stock_limit)
        prod = db.get_product(product_id)
        return {"success": True, "message": "Alert limit update ho gayi!", "product": prod}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# 2. PURCHASE APIs (MODULE 1: STOCK IN)
# -------------------------------------------------------------
@app.post("/api/purchase/manual-stock-in")
async def manual_stock_in(payload: ManualPurchasePayload):
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Koi samaan nahi bheja gaya")

        bill_id = purchase.create_bill()
        for it in payload.items:
            purchase.add_item(
                purchase_bill_id=bill_id,
                raw_name=it.raw_name,
                quantity=it.quantity,
                cost_price=it.cost_price,
                unit=it.unit,
                selling_price=it.selling_price
            )

        purchase.confirm_purchase(bill_id)
        bill = purchase.get_bill(bill_id)

        # Update alert limits if specified
        for it in payload.items:
            if it.low_stock_limit is not None:
                matched = db.match_product_smart(it.raw_name)
                if matched:
                    db.update_product_limit(matched["id"], it.low_stock_limit)

        return {"success": True, "message": "Stock successfully add ho gaya!", "bill": bill}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# 3. CUSTOMER APIs
# -------------------------------------------------------------
@app.get("/api/customers")
async def get_customers():
    return {"success": True, "customers": customers.get_all_customers()}

@app.get("/api/customers/search")
async def search_customer(q: str = Query("")):
    found = customers.search_customers(q.strip())
    return {"success": True, "customers": found}

@app.get("/api/customers/{customer_id}/statement")
async def get_customer_statement(customer_id: int):
    try:
        stmt = customers.get_monthly_statement(customer_id)
        return {"success": True, "statement": stmt}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/customers/add")
async def add_customer(payload: AddCustomerPayload):
    try:
        c_id = customers.add_customer(name=payload.name, mobile=payload.mobile)
        c = customers.get_customer(c_id)
        return {"success": True, "customer": c}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# 4. SALES & BILLING APIs (MODULE 2: STOCK OUT)
# -------------------------------------------------------------
@app.post("/api/sales/create-bill")
async def create_sales_bill(payload: CreateSalePayload):
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Cart khali hai!")

        payment_mode = payload.payment_mode.upper()

        # Validate Partial payment logic
        subtotal = sum(it.quantity * it.selling_price for it in payload.items)
        final_amount = max(0.0, round(subtotal - float(payload.discount or 0), 2))
        if payment_mode == 'PARTIAL':
            if payload.amount_received >= final_amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Partial payment (₹{payload.amount_received:.2f}) bill total (₹{final_amount:.2f}) se kam honi chahiye. Agar poora ya zyada paisa mila hai toh CASH mode chunein."
                )
            if payload.amount_received <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Partial payment amount 0 se zyada honi chahiye. Agar koi paisa nahi mila toh UDHAAR mode chunein."
                )

        # Check customer previous due
        prev_due = 0.0
        if payload.customer_id:
            c_info = customers.get_customer(payload.customer_id)
            if c_info:
                prev_due = float(c_info["current_due"])

        # 1. Create draft bill (with discount=0 initially so CHECK constraint holds)
        bill_id = sales.create_bill(
            customer_id=payload.customer_id,
            payment_mode=payment_mode,
            amount_received=payload.amount_received,
            discount=0.0
        )

        # 2. Add cart items
        for it in payload.items:
            sales.add_item_to_cart(
                bill_id,
                product_id=it.product_id,
                quantity=it.quantity,
                selling_price=it.selling_price
            )

        # 3. Recalculate payment
        sales.update_payment(
            bill_id,
            payment_mode=payment_mode,
            amount_received=payload.amount_received,
            discount=payload.discount
        )

        # 4. Confirm sale (Stock OUT + Validations)
        sales.confirm_sale(bill_id)
        bill = sales.get_bill(bill_id)

        # Attach customer ledger & monthly summary for receipt
        bill["subtotal"] = float(bill["total_amount"])
        bill["previous_due"] = prev_due
        bill["customer_previous_due"] = prev_due
        bill["total_current_due"] = prev_due + float(bill["due_amount"])
        bill["monthly_summary"] = []

        if payload.customer_id:
            try:
                stmt = customers.get_monthly_statement(payload.customer_id)
                bill["monthly_summary"] = stmt.get("months_summary", [])
            except Exception:
                pass

        return {"success": True, "message": "Bill ban gaya aur Stock update ho gaya!", "bill": bill}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# 5. POST-SALE APIs (MODULE 3)
# -------------------------------------------------------------
@app.post("/api/post-sale/recover-udhaar")
async def recover_udhaar(payload: RecoverUdhaarPayload):
    try:
        res = post_sale.recover_udhaar(
            customer_id=payload.customer_id,
            amount=payload.amount,
            payment_mode=payload.payment_mode,
            notes=payload.notes
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/post-sale/return-product")
async def return_product(payload: ReturnProductPayload):
    try:
        items_dict = [{"sales_item_id": i.sales_item_id, "quantity": i.quantity} for i in payload.return_items]
        res = post_sale.return_product(
            sales_bill_id=payload.sales_bill_id,
            return_items=items_dict,
            refund_mode=payload.refund_mode,
            reason=payload.reason
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/post-sale/cancel-bill")
async def cancel_bill(payload: CancelBillPayload):
    try:
        res = post_sale.cancel_bill(sales_bill_id=payload.sales_bill_id, reason=payload.reason)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------------------------------------------------------
# 6. REPORTS API (MODULE 4)
# -------------------------------------------------------------
@app.get("/api/reports/daily")
async def daily_report(date: Optional[str] = None):
    report_date = date if date else str(datetime.now().date())
    rep = reports.get_full_closing_report(report_date)
    return {"success": True, "report": rep}

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
