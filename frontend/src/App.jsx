import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BillingTab from './components/BillingTab';
import PurchaseTab from './components/PurchaseTab';
import KhataTab from './components/KhataTab';
import ReportTab from './components/ReportTab';
import HistoryTab from './components/HistoryTab';
import AuthPage from './components/AuthPage';

import NewCustomerModal from './components/modals/NewCustomerModal';
import SettleUdhaarModal from './components/modals/SettleUdhaarModal';
import ReturnModal from './components/modals/ReturnModal';
import UpdatePriceModal from './components/modals/UpdatePriceModal';
import ReceiptModal from './components/modals/ReceiptModal';
import CustomerStatementModal from './components/modals/CustomerStatementModal';
import PaymentReceiptModal from './components/modals/PaymentReceiptModal';
import StaffModal from './components/modals/StaffModal';
import AuthModal from './components/modals/AuthModal';

import { i18n } from './i18n';

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('dukan_lang') || 'hi');
  const [activeTab, setActiveTab] = useState('billing');

  // Multi-Shop SaaS state
  const [currentShop, setCurrentShop] = useState(() => {
    try {
      const token = localStorage.getItem('kirana_token');
      if (!token) return null;
      const saved = localStorage.getItem('kirana_shop');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [shopVersion, setShopVersion] = useState(1);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('kirana_role') || 'owner');
  const [staffName, setStaffName] = useState(() => localStorage.getItem('kirana_staff_name') || '');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Customer state for Billing
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Modals state
  const [isNewCustOpen, setIsNewCustOpen] = useState(false);
  const [settleModalData, setSettleModalData] = useState(null);
  const [statementCustId, setStatementCustId] = useState(null);
  const [priceModalProd, setPriceModalProd] = useState(null);
  const [receiptBill, setReceiptBill] = useState(null);
  const [returnBill, setReturnBill] = useState(null);
  const [paymentReceiptData, setPaymentReceiptData] = useState(null);

  // Sync lang changes to document and localStorage
  useEffect(() => {
    localStorage.setItem('dukan_lang', lang);
    document.title = i18n[lang]?.page_title || 'किराना दुकान AI';
    document.documentElement.lang = lang;
  }, [lang]);

  // Load active shop profile on initial mount
  useEffect(() => {
    const fetchActiveShop = async () => {
      const token = localStorage.getItem('kirana_token');
      if (!token) {
        setCurrentShop(null);
        setIsCheckingAuth(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.authenticated && data.shop) {
            setCurrentShop(data.shop);
            const r = data.role || 'owner';
            const sName = data.staff_name || '';
            setCurrentRole(r);
            setStaffName(sName);
            localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
            localStorage.setItem('kirana_role', r);
            localStorage.setItem('kirana_staff_name', sName);
          } else {
            // Token expired or invalid
            localStorage.removeItem('kirana_token');
            localStorage.removeItem('kirana_shop');
            localStorage.removeItem('kirana_role');
            localStorage.removeItem('kirana_staff_name');
            setCurrentShop(null);
            setCurrentRole('owner');
            setStaffName('');
          }
        } else {
          localStorage.removeItem('kirana_token');
          localStorage.removeItem('kirana_shop');
          localStorage.removeItem('kirana_role');
          localStorage.removeItem('kirana_staff_name');
          setCurrentShop(null);
          setCurrentRole('owner');
          setStaffName('');
        }
      } catch (e) {
        console.error('Failed to fetch active shop', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    fetchActiveShop();
  }, []);

  const toggleLang = () => {
    setLang(prev => (prev === 'hi' ? 'en' : 'hi'));
  };

  const handleLoginSuccess = (shop, token, role = 'owner', sName = '') => {
    setCurrentShop(shop);
    setCurrentRole(role);
    setStaffName(sName);
    localStorage.setItem('kirana_shop', JSON.stringify(shop));
    localStorage.setItem('kirana_token', token);
    localStorage.setItem('kirana_role', role);
    localStorage.setItem('kirana_staff_name', sName);
    setSelectedCustomer(null);
    if (role === 'cashier') {
      setActiveTab('billing');
    }
    setShopVersion(v => v + 1); // Triggers re-fetch across tabs
  };

  const handleLogout = () => {
    localStorage.removeItem('kirana_token');
    localStorage.removeItem('kirana_shop');
    localStorage.removeItem('kirana_role');
    localStorage.removeItem('kirana_staff_name');
    setCurrentShop(null);
    setCurrentRole('owner');
    setStaffName('');
    setSelectedCustomer(null);
    setActiveTab('billing');
    setShopVersion(v => v + 1);
  };

  const t = i18n[lang] || i18n.hi;

  // Reprint bill
  const handleReprintBill = async (billId) => {
    try {
      const res = await fetch(`/api/sales/bills/${billId}`);
      const data = await res.json();
      if (data.success && data.bill) {
        setReceiptBill(data.bill);
      } else {
        alert(t.error_prefix + (data.error || 'Bill not found'));
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    }
  };

  // Open return modal
  const handleOpenReturn = async (billId) => {
    try {
      const res = await fetch(`/api/sales/bills/${billId}`);
      const data = await res.json();
      if (data.success && data.bill) {
        setReturnBill(data.bill);
      } else {
        alert(t.error_prefix + (data.error || 'Bill not found'));
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    }
  };

  // If user is not logged into any shop, show dedicated Login / Signup Page
  if (!currentShop && !isCheckingAuth) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
        lang={lang}
        onToggleLang={toggleLang}
        t={t}
      />
    );
  }

  // Brief spinner while checking token on refresh
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg animate-pulse mb-3">
          <i className="fa-solid fa-store"></i>
        </div>
        <p className="text-xs font-bold text-stone-500 flex items-center gap-2">
          <i className="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
          <span>दुकान लोड हो रही है...</span>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF7] text-[#1C1917] antialiased min-h-screen flex flex-col">
      {/* Top App Bar & Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lang={lang}
        onToggleLang={toggleLang}
        t={t}
        currentShop={currentShop}
        currentRole={currentRole}
        staffName={staffName}
        onOpenStaffModal={() => setIsStaffModalOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main View Container */}
      <main className="max-w-7xl mx-auto w-full p-4 flex-1">
        {activeTab === 'billing' && (
          <BillingTab
            key={`billing-${shopVersion}`}
            lang={lang}
            t={t}
            currentShop={currentShop}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            onOpenNewCustomerModal={() => setIsNewCustOpen(true)}
            onSaleCompleted={(bill) => setReceiptBill(bill)}
          />
        )}

        {activeTab === 'purchase' && (
          <PurchaseTab
            key={`purchase-${shopVersion}`}
            t={t}
            onOpenPriceModal={(product) => setPriceModalProd(product)}
          />
        )}

        {activeTab === 'khata' && (
          <KhataTab
            key={`khata-${shopVersion}`}
            lang={lang}
            t={t}
            currentShop={currentShop}
            onOpenNewCustomerModal={() => setIsNewCustOpen(true)}
            onOpenSettleModal={(customer) => setSettleModalData(customer)}
            onOpenStatementModal={(custId) => setStatementCustId(custId)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            key={`history-${shopVersion}`}
            lang={lang}
            t={t}
            currentRole={currentRole}
            onReprintBill={handleReprintBill}
            onOpenReturnModal={handleOpenReturn}
          />
        )}

        {activeTab === 'report' && (
          <ReportTab
            key={`report-${shopVersion}`}
            lang={lang}
            t={t}
          />
        )}
      </main>

      {/* MODALS */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <StaffModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        lang={lang}
        t={t}
        currentShop={currentShop}
      />

      <NewCustomerModal
        isOpen={isNewCustOpen}
        onClose={() => setIsNewCustOpen(false)}
        onCustomerCreated={(cust) => {
          setSelectedCustomer(cust);
        }}
        t={t}
      />

      <SettleUdhaarModal
        isOpen={!!settleModalData}
        onClose={() => setSettleModalData(null)}
        customer={settleModalData}
        onSettled={(receiptData) => {
          if (receiptData) {
            setPaymentReceiptData(receiptData);
          }
          setShopVersion(v => v + 1);
        }}
        t={t}
      />

      <PaymentReceiptModal
        isOpen={!!paymentReceiptData}
        onClose={() => setPaymentReceiptData(null)}
        receipt={paymentReceiptData}
        lang={lang}
        t={t}
        currentShop={currentShop}
      />

      <CustomerStatementModal
        isOpen={!!statementCustId}
        onClose={() => setStatementCustId(null)}
        customerId={statementCustId}
        t={t}
      />

      <UpdatePriceModal
        isOpen={!!priceModalProd}
        onClose={() => setPriceModalProd(null)}
        product={priceModalProd}
        onPriceSaved={() => {
          // Handled inside PurchaseTab
        }}
        t={t}
      />

      <ReturnModal
        isOpen={!!returnBill}
        onClose={() => setReturnBill(null)}
        bill={returnBill}
        onReturnSubmitted={() => {
          // Handled
        }}
        t={t}
      />

      <ReceiptModal
        isOpen={!!receiptBill}
        onClose={() => setReceiptBill(null)}
        bill={receiptBill}
        lang={lang}
        t={t}
        currentShop={currentShop}
      />
    </div>
  );
}
