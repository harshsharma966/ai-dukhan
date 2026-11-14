# 🏪 किराना दुकान AI (Dukan AI) - Multi-Tenant Cloud POS & ERP

एक आधुनिक, सुरक्षित और तेज़ **Point of Sale (POS), इन्वेंटरी और उधारी खाता प्रबंधन सिस्टम**, जो विशेष रूप से भारतीय किराना दुकानों, जनरल स्टोर्स और रिटेल शॉप्स के लिए तैयार किया गया है।

अब यह सिस्टम पूरी तरह से **React (Vite) + Tailwind CSS Frontend**, **FastAPI Backend**, और **100% PostgreSQL Database** पर चलता है, जिसमें **Multi-Tenant (अलग-अलग दुकानें)** और **Role-Based Access (मालिक vs बिल बॉय)** शामिल हैं।

---

## ✨ Features (मुख्य विशेषताएं)

### 1. 🔐 Multi-Tenant & Role-Based Access (मालिक व कर्मचारी सुरक्षा)
- **Multi-Shop SaaS:** एक ही सिस्टम में कई दुकानें अलग-अलग रजिस्टर हो सकती हैं। हर दुकान का डेटा (प्रोडक्ट्स, ग्राहक, बिल, कमाई) पूरी तरह अलग और सुरक्षित रहता है।
- **मालिक (Owner) vs बिल बॉय (Cashier):**
  - **मालिक:** पूरा नियंत्रण (स्टॉक खरीदना, सामान हटाना, उधारी खाता, दैनिक क्लोजिंग रिपोर्ट, बिल रद्द करना, और कर्मचारी जोड़ना)।
  - **बिल बॉय (Cashier):** सिर्फ बिलिंग काउंटर और बिल इतिहास देख सकता है। स्टॉक जोड़ना/हटाना, उधारी खाता और शाम की मुनाफे की रिपोर्ट छुप जाती है।
  - **कर्मचारी प्रबंधन:** मालिक 1-क्लिक में नए बिल बॉय जोड़ सकता है और उनका 4-अंकों का लॉगिन PIN तय कर सकता है।

### 2. ⚡ Fast POS Billing Counter (बिक्री काउंटर)
- **त्वरित बिलिंग:** वॉक-इन (नकद) या नामजद ग्राहक के साथ बिल बनाएं।
- **वज़न व यूनिट्स:** पैकेट, किलो (kg), ग्राम (gm), लीटर में सटीक कैलकुलेशन।
- **मल्टी-मोड भुगतान:** Cash, UPI, उधार (Credit), और Partial (आधा नकद, आधा उधार)।
- **छुट्टे पैसे का हिसाब:** गल्ले से ग्राहक को कितने पैसे वापस करने हैं, स्क्रीन पर दिखाता है।
- **व्हाट्सएप और प्रिंट रसीद:** 1-क्लिक में थर्मल प्रिंटर रसीद निकालें या सीधे ग्राहक के WhatsApp पर बिल भेजें।

### 3. 📦 Stock IN & Inventory (खरीद व लाइव इन्वेंटरी)
- **स्टॉक इन (Purchase):** सप्लायर से आया माल स्टॉक में जोड़ें।
- **अलर्ट लिमिट (Re-order Limit):** हर सामान की कम स्टॉक होने की लिमिट सेट करें।
- **सामान हटाएं (Delete Product):** दुकान की इन्वेंटरी से बेकार या पुराने सामान को सुरक्षित रूप से हटाएं (इतिहास सुरक्षित रहता है)।
- नई दुकानें रजिस्टर होने पर बिल्कुल 0 (Blank) स्टॉक से शुरू होती हैं।

### 4. 📒 Udhaar Khata & Payment Receipts (उधारी खाता व जमा पर्ची)
- **ग्राहक लेजर:** हर ग्राहक का बकाया (Current Due) और मासिक लेन-देन।
- **उधारी जमा (Settle Due):** Cash या UPI से उधारी वसूलें।
- **समर्पित भुगतान रसीद (Payment Slip):** उधारी जमा होते ही स्क्रीन पर पक्की **जमा पर्ची** खुलती है (दुकान का नाम, जमा रकम, पिछला बकाया, अब बचा बकाया: ₹0 चुकता ✓) जिसे Print या WhatsApp किया जा सकता है।
- **बिल इतिहास में स्टेटस:** बिल पर साफ़ दिखता है कि उधार **"चुका दिया ✓"** या **"बाकी ₹XX"** है।

### 5. 📊 Daily Closing Report (शाम की दैनिक क्लोजिंग)
- **गल्ले का हिसाब:** आज की कुल बिक्री, गल्ले में नकद (Cash in Drawer), बैंक में आया UPI, नया उधार और उधारी वसूली।
- **मुनाफा (Profit & Margin):** आज की शुद्ध कमाई और मार्जिन प्रतिशत।
- **सामान वापसी (Returns):** माल वापसी पर Cash/UPI/Due-Adjustment रिफंड।

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, psycopg2-binary, PyJWT, Python-Dotenv
- **Database:** PostgreSQL (100% pure PostgreSQL, ACID compliant, multi-tenant relational schema)
- **Frontend:** React 18 (Vite), Tailwind CSS, FontAwesome 6, KaTeX
- **Language Support:** द्विभाषी (पूर्ण हिन्दी व English स्विच)

---

## 🚀 Getting Started (शुरू कैसे करें)

### 1. रिपॉजिटरी क्लोन करें
```bash
git clone https://github.com/YOUR_USERNAME/dukan-ai.git
cd dukan-ai
```

### 2. बैकएंड सेटअप (Python Virtual Environment)
```bash
# Virtual environment बनाएं और एक्टिवेट करें
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux/Mac

# डिपेंडेंसीज़ इंस्टॉल करें
pip install -r requirements.txt
```

### 3. डेटाबेस कॉन्फ़िगरेशन (.env)
रूट डायरेक्टरी में `.env` फाइल बनाएं और अपनी PostgreSQL डिटेल्स डालें:
```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=kirana_shop
JWT_SECRET=your_jwt_secret_key
```

### 4. फ्रंटएंड सेटअप (React / Vite)
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. सर्वर शुरू करें
```bash
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```
ब्राउज़र में खोलें:
```
http://127.0.0.1:8000
```

---

## 📂 Project Structure

```
dukan-ai/
├── app.py                 # FastAPI मुख्य राउट्स व सुरक्षा logic (Auth, Staff, Sales, Stock)
├── database.py            # PostgreSQL कनेक्शन पूल, माइग्रेशन व क्वेरीज़
├── schema_postgres.sql    # PostgreSQL मल्टी-टेनेंट स्कीमा (shops, staff, products, bills, khata)
├── requirements.txt       # Python डिपेंडेंसीज़
├── README.md              # प्रोजेक्ट डॉक्यूमेंटेशन
├── modules/
│   ├── customers.py       # ग्राहक खाता व मासिक लेजर
│   ├── purchase.py        # स्टॉक इन व खरीद प्रबंधन
│   ├── sales.py           # POS बिलिंग, कार्ट व कैलकुलेशन
│   ├── post_sale.py       # उधारी वसूली व भुगतान रसीद logic
│   └── reports.py         # शाम की दैनिक क्लोजिंग रिपोर्ट व री-ऑर्डर लिस्ट
└── frontend/              # React (Vite) आधुनिक फ्रंटएंड
    ├── src/
    │   ├── components/    # BillingTab, PurchaseTab, KhataTab, HistoryTab, ReportTab, Header
    │   ├── components/modals/ # StaffModal, PaymentReceiptModal, SettleUdhaarModal, ReceiptModal
    │   ├── App.jsx        # मुख्य स्टेट व रोल-बेस्ड एक्सेस कंट्रोल
    │   ├── i18n.js        # हिन्दी व English अनुवाद
    │   └── utils.js       # WhatsApp बिल व पेमेंट रसीद जनरेटर
    └── dist/              # प्रोडक्शन बिल्ड
```

---

## 📄 License
MIT License
