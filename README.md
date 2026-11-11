# 🏪 किराना दुकान AI (Dukan AI) - Smart Kirana ERP & POS

A smart, lightweight, and fast Point of Sale (POS), Inventory & Udhaar Khata management system specially crafted for Indian Kirana (Grocery) stores.

Built with **FastAPI**, **SQLite**, and **Tailwind CSS**.

---

## ✨ Features (मुख्य विशेषताएं)

1. **⚡ Fast POS Billing Counter (बिक्री काउंटर)**
   - Quick Walk-in Billing (no customer details mandatory for cash sales).
   - Loose & Weight item calculations (kg, gm, litre, packet).
   - Split & partial payment calculator (Cash, UPI, Udhaar).
   - Change calculation (छुट्टे पैसे का हिसाब).
   - Real-time stock warnings.
   - Printable Bill Receipts with Item Rates, Quantities, and Month-wise customer dues.

2. **📦 Stock IN & Inventory (खरीद व स्टॉक)**
   - Manual & smart stock addition.
   - Auto-suggests existing products using Hindi & English keywords.
   - **Customizable Low-Stock Alert Limits**: Shopkeeper can set custom minimum stock thresholds for each item (fast-moving vs slow-moving).
   - In-place alert limit editing right inside the Live Inventory table.

3. **📒 Udhaar Khata & Ledger (उधारी खाता)**
   - Customer-wise balance tracking.
   - **Month-wise Ledger Breakdown**: Track credit taken, payment made, and monthly net balance.
   - 1-Click Udhaar Settlement via Cash or UPI.

4. **📊 Daily Closing Report (दैनिक शाम की रिपोर्ट)**
   - Financial closing (Total Sales, Cash in Drawer, Bank UPI, New Udhaar given, Udhaar collected).
   - Items sold summary.
   - **Smart Re-Order List**: Automatically flags items running low or out of stock based on custom alert thresholds.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn
- **Database:** SQLite (with ACID transactions & foreign key integrity)
- **Frontend:** Single Page Application (SPA) with Tailwind CSS & Vanilla JavaScript
- **Templates:** Jinja2

---

## 🚀 Getting Started (शुरू कैसे करें)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/dukan-ai.git
cd dukan-ai
```

### 2. Create and activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the application
```bash
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 📂 Project Structure

```
dukan-ai/
├── app.py                 # FastAPI application routes & endpoints
├── database.py            # SQLite database manager & search algorithms
├── schema.sql             # SQL database schema
├── requirements.txt       # Python package dependencies
├── README.md              # Project documentation
├── modules/
│   ├── customers.py       # Customer khata & month-wise ledger logic
│   ├── purchase.py        # Stock in & purchase operations
│   ├── sales.py           # POS billing, cart & calculations
│   ├── post_sale.py       # Udhaar recovery, returns & cancellations
│   ├── reports.py         # Daily closing & re-order summaries
│   └── ocr.py             # OCR integration module
├── templates/
│   └── index.html         # Frontend Tailwind SPA
└── uploads/               # Uploaded bills/receipts
```

---

## 📄 License
MIT License

