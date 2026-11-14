"""
app.py - Kirana Shop AI Web Application Backend (FastAPI).
Supports Multi-Shop / Multi-Tenant SaaS with Mobile OTP (975677) & JWT Authentication.

Integrates:
0. Authentication & Multi-Shop Manager
1. Purchase (Stock IN)
2. Sales & Billing (Stock OUT)
3. Post-Sale (Udhaar Recovery, Returns, Cancellation)
4. Daily Closing Reports
"""

from fastapi import FastAPI, Request, HTTPException, Query, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
import uvicorn
import os
import jwt

from database import db
from modules.customers import customers
from modules.purchase import purchase
from modules.sales import sales
from modules.post_sale import post_sale
from modules.reports import reports

# Ensure sample products are seeded on start for Shop 1
db.seed_sample_products(shop_id=1)

app = FastAPI(title="Kirana Shop AI System - Multi-Shop SaaS", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# -------------------------------------------------------------
# JWT & OTP CONFIGURATION
# -------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "kirana_ai_secret_key_975677_secure")
JWT_ALGORITHM = "HS256"
FIXED_OTP = "975677"

def create_jwt_token(shop: dict, role: str = "owner", staff_id: int = None, staff_name: str = None) -> str:
    payload = {
        "shop_id": shop["id"],
        "shop_name": shop["shop_name"],
        "owner_name": shop["owner_name"],
        "mobile": shop["mobile"],
        "address": shop.get("address", "") or "",
        "role": role,
        "staff_id": staff_id,
        "staff_name": staff_name or shop["owner_name"],
        "exp": datetime.utcnow().timestamp() + (365 * 24 * 3600)  # 1 Year validity
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_shop_id(request: Request, allow_fallback: bool = True) -> Optional[int]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            val = payload.get("shop_id")
            if val is not None:
                return int(val)
        except Exception:
            pass
    # Fallback to query param or default Shop 1
    query_shop_id = request.query_params.get("shop_id")
    if query_shop_id and query_shop_id.isdigit():
        return int(query_shop_id)
    return 1 if allow_fallback else None

def get_current_role(request: Request) -> str:
    """Returns the role from JWT token: 'owner' or 'cashier'."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload.get("role", "owner")
        except Exception:
            pass
    return "owner"

def get_current_staff_info(request: Request) -> dict:
    """Returns staff_id, staff_name, role from JWT."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return {
                "staff_id": payload.get("staff_id"),
                "staff_name": payload.get("staff_name", ""),
                "role": payload.get("role", "owner")
            }
        except Exception:
            pass
    return {"staff_id": None, "staff_name": "", "role": "owner"}

def require_owner(request: Request):
    """Raises 403 if current user is not owner."""
    role = get_current_role(request)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Sirf dukaan ke malik ko ye karne ki ijazat hai.")


# -------------------------------------------------------------
# PYDANTIC SCHEMAS
# -------------------------------------------------------------
class SendOtpPayload(BaseModel):
    mobile: str

class VerifyOtpPayload(BaseModel):
    mobile: str
    otp: str

class RegisterShopPayload(BaseModel):
    shop_name: str
    owner_name: str
    mobile: str
    address: Optional[str] = None
    password: Optional[str] = None

class LoginPasswordPayload(BaseModel):
    mobile: str
    password: str

class UpdateShopPayload(BaseModel):
    shop_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None

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

class UpdatePricePayload(BaseModel):
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None

class AddStaffPayload(BaseModel):
    name: str
    mobile: str
    pin: str
    role: str = "cashier"

class UpdateStaffPayload(BaseModel):
    name: Optional[str] = None
    pin: Optional[str] = None
    is_active: Optional[bool] = None


# -------------------------------------------------------------
# 0. AUTH & MULTI-SHOP APIs
# -------------------------------------------------------------
@app.post("/api/auth/send-otp")
async def send_otp(payload: SendOtpPayload):
    mob = payload.mobile.strip()
    if not mob or len(mob) < 10:
        raise HTTPException(status_code=400, detail="Mobile number is required (min 10 digits)")
    existing = db.get_shop_by_mobile(mob)
    print(f"📲 [OTP Service] Generated OTP for {mob}: {FIXED_OTP}")
    return {
        "success": True,
        "is_registered": bool(existing),
        "shop_name": existing["shop_name"] if existing else None,
        "owner_name": existing["owner_name"] if existing else None,
        "message": f"OTP successfully sent to {mob} (Testing OTP: {FIXED_OTP})",
        "otp": FIXED_OTP
    }

@app.post("/api/auth/verify-otp")
async def verify_otp(payload: VerifyOtpPayload):
    mob = payload.mobile.strip()
    otp = payload.otp.strip()
    if otp != FIXED_OTP:
        raise HTTPException(status_code=400, detail="Galat OTP! Kripya '975677' daalein.")
    
    shop = db.get_shop_by_mobile(mob)
    if shop:
        token = create_jwt_token(shop)
        return {
            "success": True,
            "is_new_shop": False,
            "token": token,
            "shop": {
                "id": shop["id"],
                "shop_name": shop["shop_name"],
                "owner_name": shop["owner_name"],
                "mobile": shop["mobile"],
                "address": shop.get("address", "") or ""
            }
        }
    else:
        return {
            "success": True,
            "is_new_shop": True,
            "mobile": mob,
            "message": "Nayi dukan! Kripya dukaan ka naam aur apna naam register karein."
        }

@app.post("/api/auth/register-shop")
async def register_shop(payload: RegisterShopPayload):
    mob = payload.mobile.strip()
    existing = db.get_shop_by_mobile(mob)
    if existing:
        token = create_jwt_token(existing)
        return {"success": True, "token": token, "shop": existing}

    shop_id = db.create_shop(
        shop_name=payload.shop_name,
        owner_name=payload.owner_name,
        mobile=mob,
        password=payload.password,
        address=payload.address
    )
    # New shops start clean with 0 items (no auto-seeding)
    shop = db.get_shop(shop_id)
    token = create_jwt_token(shop)
    return {"success": True, "token": token, "shop": shop}

@app.post("/api/auth/login-password")
async def login_password(payload: LoginPasswordPayload):
    mob = payload.mobile.strip()
    pwd = payload.password.strip()

    # 1. Try owner login
    shop = db.get_shop_by_mobile(mob)
    if shop:
        if shop.get("password_hash") and shop["password_hash"] != pwd:
            raise HTTPException(status_code=400, detail="Galat password!")
        token = create_jwt_token(shop, role="owner")
        return {
            "success": True, 
            "token": token, 
            "shop": shop,
            "role": "owner",
            "staff_name": shop["owner_name"]
        }

    # 2. Try staff / cashier login
    staff = db.get_staff_by_mobile_any(mob)
    if staff:
        if staff.get("pin_hash") and staff["pin_hash"] != pwd:
            raise HTTPException(status_code=400, detail="Galat PIN!")
        shop = db.get_shop(staff["shop_id"])
        if not shop:
            raise HTTPException(status_code=400, detail="Dukaan nahi mili.")
        token = create_jwt_token(shop, role=staff["role"], staff_id=staff["id"], staff_name=staff["name"])
        return {
            "success": True,
            "token": token,
            "shop": shop,
            "role": staff["role"],
            "staff_id": staff["id"],
            "staff_name": staff["name"]
        }

    raise HTTPException(status_code=400, detail="Ye mobile number registered nahi hai (na dukan malik, na staff).")

@app.post("/api/auth/demo-login")
async def demo_login():
    shop = db.get_shop(1)
    if not shop:
        raise HTTPException(status_code=404, detail="Demo shop nahi mili.")
    token = create_jwt_token(shop, role="owner")
    return {"success": True, "token": token, "shop": shop, "role": "owner", "staff_name": shop["owner_name"]}

@app.get("/api/auth/me")
async def get_my_shop(request: Request):
    shop_id = get_current_shop_id(request, allow_fallback=False)
    if not shop_id:
        return {"success": False, "authenticated": False, "shop": None}
    shop = db.get_shop(shop_id)
    if not shop:
        return {"success": False, "authenticated": False, "shop": None}
    
    role = get_current_role(request)
    staff_info = get_current_staff_info(request)
    return {
        "success": True, 
        "authenticated": True, 
        "shop": shop,
        "role": role,
        "staff_id": staff_info.get("staff_id"),
        "staff_name": staff_info.get("staff_name") or shop["owner_name"]
    }

@app.post("/api/auth/update-shop")
async def update_my_shop(request: Request, payload: UpdateShopPayload):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    updated = db.update_shop(
        shop_id=shop_id,
        shop_name=payload.shop_name,
        owner_name=payload.owner_name,
        address=payload.address
    )
    return {"success": True, "shop": updated}

# -------------------------------------------------------------
# 0.5 STAFF APIs (Owner Only)
# -------------------------------------------------------------
@app.get("/api/staff")
async def list_staff(request: Request):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    staff_list = db.get_all_staff(shop_id=shop_id)
    return {"success": True, "staff": staff_list}

@app.post("/api/staff")
async def add_staff(request: Request, payload: AddStaffPayload):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    try:
        staff_id = db.add_staff(
            shop_id=shop_id,
            name=payload.name,
            mobile=payload.mobile,
            pin=payload.pin,
            role=payload.role or "cashier"
        )
        return {"success": True, "staff_id": staff_id, "message": f"{payload.name} ko staff me jod diya gaya!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/staff/{staff_id}")
async def update_staff(request: Request, staff_id: int, payload: UpdateStaffPayload):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    updated = db.update_staff(
        staff_id=staff_id,
        shop_id=shop_id,
        name=payload.name,
        pin=payload.pin,
        is_active=payload.is_active
    )
    return {"success": True, "staff": updated}

@app.delete("/api/staff/{staff_id}")
async def delete_staff(request: Request, staff_id: int):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    db.delete_staff(staff_id=staff_id, shop_id=shop_id)
    return {"success": True, "message": "Staff ko deactivate kar diya gaya."}



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
async def get_products(request: Request, q: Optional[str] = None):
    shop_id = get_current_shop_id(request)
    if q and q.strip():
        items = db.search_products(q.strip(), shop_id=shop_id)
    else:
        items = db.get_all_products(shop_id=shop_id)
    return {"success": True, "products": items}

@app.get("/api/products/match")
async def match_product(request: Request, name: str = Query(...)):
    shop_id = get_current_shop_id(request)
    matched = db.match_product_smart(name.strip(), shop_id=shop_id)
    return {"success": True, "matched": matched}

@app.post("/api/products/{product_id}/update-limit")
async def update_product_limit(request: Request, product_id: int, payload: UpdateLimitPayload):
    shop_id = get_current_shop_id(request)
    try:
        db.update_product_limit(product_id, payload.low_stock_limit, shop_id=shop_id)
        prod = db.get_product(product_id, shop_id=shop_id)
        return {"success": True, "message": "Alert limit update ho gayi!", "product": prod}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/products/{product_id}/update-price")
async def update_product_price(request: Request, product_id: int, payload: UpdatePricePayload):
    shop_id = get_current_shop_id(request)
    try:
        updated = db.update_product_price(
            product_id,
            cost_price=payload.cost_price,
            selling_price=payload.selling_price,
            shop_id=shop_id
        )
        return {"success": True, "message": "Bhav (Price) update ho gaya!", "product": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/products/{product_id}")
@app.post("/api/products/{product_id}/delete")
async def delete_product(request: Request, product_id: int):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    if not shop_id:
        raise HTTPException(status_code=401, detail="Kripya login karein.")
    try:
        deleted = db.delete_product(product_id=product_id, shop_id=shop_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Samaan nahi mila ya pehle hi hata diya gaya hai.")
        return {"success": True, "message": "सामान दुकान से सफलतापूर्वक हटा दिया गया!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# 2. PURCHASE APIs (MODULE 1: STOCK IN)
# -------------------------------------------------------------
@app.post("/api/purchase/manual-stock-in")
async def manual_stock_in(request: Request, payload: ManualPurchasePayload):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Koi samaan nahi bheja gaya")

        bill_id = purchase.create_bill(shop_id=shop_id)
        for it in payload.items:
            purchase.add_item(
                purchase_bill_id=bill_id,
                raw_name=it.raw_name,
                quantity=it.quantity,
                cost_price=it.cost_price,
                unit=it.unit,
                selling_price=it.selling_price,
                shop_id=shop_id
            )

        purchase.confirm_purchase(bill_id, shop_id=shop_id)
        bill = purchase.get_bill(bill_id, shop_id=shop_id)

        for it in payload.items:
            if it.low_stock_limit is not None:
                matched = db.match_product_smart(it.raw_name, shop_id=shop_id)
                if matched:
                    db.update_product_limit(matched["id"], it.low_stock_limit, shop_id=shop_id)

        return {"success": True, "message": "Stock successfully add ho gaya!", "bill": bill}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# 3. CUSTOMER APIs
# -------------------------------------------------------------
@app.get("/api/customers")
async def get_customers(request: Request):
    shop_id = get_current_shop_id(request)
    return {"success": True, "customers": customers.get_all_customers(shop_id=shop_id)}

@app.get("/api/customers/search")
async def search_customer(request: Request, q: str = Query("")):
    shop_id = get_current_shop_id(request)
    found = customers.search_customers(q.strip(), shop_id=shop_id)
    return {"success": True, "customers": found}

@app.get("/api/customers/{customer_id}/statement")
async def get_customer_statement(request: Request, customer_id: int):
    shop_id = get_current_shop_id(request)
    try:
        stmt = customers.get_monthly_statement(customer_id, shop_id=shop_id)
        return {"success": True, "statement": stmt}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/customers/add")
@app.post("/api/customers")
async def add_customer(request: Request, payload: AddCustomerPayload):
    shop_id = get_current_shop_id(request)
    try:
        c_id = customers.add_customer(name=payload.name, mobile=payload.mobile, shop_id=shop_id)
        c = customers.get_customer(c_id, shop_id=shop_id)
        return {"success": True, "customer": c}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# 4. SALES & BILLING APIs (MODULE 2: STOCK OUT)
# -------------------------------------------------------------
@app.post("/api/sales/create-bill")
async def create_sales_bill(request: Request, payload: CreateSalePayload):
    shop_id = get_current_shop_id(request)
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Cart khali hai!")

        payment_mode = payload.payment_mode.upper()
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

        prev_due = 0.0
        if payload.customer_id:
            c_info = customers.get_customer(payload.customer_id, shop_id=shop_id)
            if c_info:
                prev_due = float(c_info["current_due"])

        staff_info = get_current_staff_info(request)
        bill_id = sales.create_bill(
            customer_id=payload.customer_id,
            payment_mode=payment_mode,
            amount_received=payload.amount_received,
            discount=0.0,
            shop_id=shop_id,
            created_by_staff_id=staff_info.get("staff_id"),
            created_by_name=staff_info.get("staff_name")
        )

        for it in payload.items:
            sales.add_item_to_cart(
                bill_id,
                product_id=it.product_id,
                quantity=it.quantity,
                selling_price=it.selling_price,
                shop_id=shop_id
            )

        sales.update_payment(
            bill_id,
            payment_mode=payment_mode,
            amount_received=payload.amount_received,
            discount=payload.discount
        )

        sales.confirm_sale(bill_id, shop_id=shop_id)
        bill = sales.get_bill(bill_id, shop_id=shop_id)

        bill["subtotal"] = float(bill["total_amount"])
        bill["previous_due"] = prev_due
        bill["customer_previous_due"] = prev_due
        bill["total_current_due"] = prev_due + float(bill["due_amount"])
        bill["current_balance_now"] = prev_due + float(bill["due_amount"])
        bill["monthly_summary"] = []

        if payload.customer_id:
            try:
                stmt = customers.get_monthly_statement(payload.customer_id, shop_id=shop_id)
                bill["monthly_summary"] = stmt.get("months_summary", [])
            except Exception:
                pass

        return {"success": True, "message": "Bill ban gaya aur Stock update ho gaya!", "bill": bill}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/sales/bills")
async def list_sales_bills(request: Request, query: Optional[str] = None, date: Optional[str] = None,
                           status: Optional[str] = None, limit: int = 100):
    shop_id = get_current_shop_id(request)
    try:
        bills = sales.get_bills(query=query, date=date, status=status, limit=limit, shop_id=shop_id)
        return {"success": True, "bills": bills}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/sales/bills/{bill_id}")
async def get_sales_bill_details(request: Request, bill_id: int):
    shop_id = get_current_shop_id(request)
    try:
        bill = sales.get_bill_details(bill_id, shop_id=shop_id)
        if not bill:
            raise HTTPException(status_code=404, detail="Bill nahi mila.")
        
        if bill.get("customer_id"):
            c_info = customers.get_customer(bill["customer_id"], shop_id=shop_id)
            current_live_due = float(c_info["current_due"]) if c_info else 0.0
            bill["current_balance_now"] = current_live_due
            bill["customer_current_due"] = current_live_due
            try:
                stmt = customers.get_monthly_statement(bill["customer_id"], shop_id=shop_id)
                bill["monthly_summary"] = stmt.get("months_summary", [])
            except Exception:
                bill["monthly_summary"] = []
        return {"success": True, "bill": bill}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# 5. POST-SALE APIs (MODULE 3)
# -------------------------------------------------------------
@app.post("/api/post-sale/recover-udhaar")
async def recover_udhaar(request: Request, payload: RecoverUdhaarPayload):
    shop_id = get_current_shop_id(request)
    try:
        res = post_sale.recover_udhaar(
            customer_id=payload.customer_id,
            amount=payload.amount,
            payment_mode=payload.payment_mode,
            notes=payload.notes,
            shop_id=shop_id
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/post-sale/return-product")
async def return_product(request: Request, payload: ReturnProductPayload):
    shop_id = get_current_shop_id(request)
    try:
        items_dict = [{"sales_item_id": i.sales_item_id, "quantity": i.quantity} for i in payload.return_items]
        res = post_sale.return_product(
            sales_bill_id=payload.sales_bill_id,
            return_items=items_dict,
            refund_mode=payload.refund_mode,
            reason=payload.reason,
            shop_id=shop_id
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/post-sale/cancel-bill")
async def cancel_bill(request: Request, payload: CancelBillPayload):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    try:
        res = post_sale.cancel_bill(sales_bill_id=payload.sales_bill_id, reason=payload.reason, shop_id=shop_id)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------
# 6. REPORTS API (MODULE 4)
# -------------------------------------------------------------
@app.get("/api/reports/daily")
@app.get("/api/reports/closing")
async def daily_report(request: Request, date: Optional[str] = None):
    require_owner(request)
    shop_id = get_current_shop_id(request)
    report_date = date if date else str(datetime.now().date())
    rep = reports.get_full_closing_report(report_date, shop_id=shop_id)
    return {"success": True, "report": rep}


# -------------------------------------------------------------
# 7. POSTGRESQL DATABASE & TABLE VIEWER
# -------------------------------------------------------------
@app.get("/tables", response_class=HTMLResponse)
async def view_tables(request: Request, table: Optional[str] = None):
    table_names = [
        "shops", "products", "customers", "sales_bills", "sales_items", 
        "purchase_bills", "purchase_items", "customer_payments", 
        "sales_returns", "sales_return_items"
    ]
    active_table = table if table in table_names else "shops"
    
    with db.connection() as conn:
        tables_info = []
        for t in table_names:
            cnt_row = conn.execute(f"SELECT COUNT(*) as cnt FROM {t}").fetchone()
            cnt = cnt_row["cnt"] if cnt_row else 0
            tables_info.append({"name": t, "count": cnt})
            
        cur = conn.execute(f"SELECT * FROM {active_table} ORDER BY id DESC LIMIT 200")
        rows = [dict(r) for r in cur.fetchall()]
        columns = list(rows[0].keys()) if rows else []
        if not columns:
            col_cur = conn.execute(f"SELECT * FROM {active_table} LIMIT 1")
            cursor_obj = getattr(col_cur, "cursor", col_cur)
            if hasattr(cursor_obj, "description") and cursor_obj.description:
                columns = [c[0] for c in cursor_obj.description]

    return templates.TemplateResponse("db_viewer.html", {
        "request": request,
        "tables": tables_info,
        "active_table": active_table,
        "columns": columns,
        "rows": rows
    })

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
