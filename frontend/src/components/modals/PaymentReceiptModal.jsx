import React from 'react';
import { generatePaymentReceiptWhatsAppText, sendWhatsAppMessage } from '../../utils';

export default function PaymentReceiptModal({ isOpen, onClose, receipt, lang, t, currentShop }) {
  if (!isOpen || !receipt) return null;

  const dateStr = receipt.payment_date 
    ? new Date(receipt.payment_date).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')
    : new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN');
  
  const shopName = receipt.shop_name || currentShop?.shop_name || (lang === 'hi' ? 'किराना स्टोर' : 'Kirana Store');
  const shopAddress = receipt.shop_address || currentShop?.address || '';
  const shopMobile = receipt.shop_mobile || currentShop?.mobile || '';

  const amountPaid = Number(receipt.amount_paid) || 0;
  const prevDue = Number(receipt.previous_due) || 0;
  const newDue = Number(receipt.new_due) || 0;
  const receiptNo = receipt.receipt_number || `PAY-${receipt.payment_id || '001'}`;

  const handleShareWhatsApp = () => {
    const text = generatePaymentReceiptWhatsAppText(receipt, lang, currentShop);
    sendWhatsAppMessage(receipt.customer_mobile, text, t.prompt_enter_mobile);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-[#E7E5E4] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Shop Header */}
        <div className="text-center border-b border-[#E7E5E4] pb-3 space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider mb-1">
            ✓ {lang === 'hi' ? 'भुगतान सफल (Payment Received)' : 'Payment Received'}
          </span>
          <h3 className="font-extrabold text-base text-[#1C1917]">{shopName}</h3>
          {shopAddress && <p className="text-[11px] text-[#78716C]">{shopAddress}</p>}
          {shopMobile && <p className="text-[11px] text-[#78716C]">📞 {shopMobile}</p>}
          <p className="text-xs font-bold text-[#15803D] pt-1">
            {lang === 'hi' ? '🧾 उधारी भुगतान रसीद' : '🧾 Udhaar Payment Slip'}
          </p>
          <p className="text-[10px] font-mono text-[#78716C]">{receiptNo}</p>
        </div>

        {/* Customer & Date */}
        <div className="text-xs space-y-1 bg-[#FAFAF7] p-3 rounded-xl border border-[#E7E5E4]">
          <div className="flex justify-between items-center">
            <span className="text-[#78716C]">{t.rcpt_date}:</span>
            <span className="font-medium text-[#1C1917]">{dateStr}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#78716C]">{t.th_cust_name}:</span>
            <span className="font-bold text-[#1C1917]">{receipt.customer_name}</span>
          </div>
          {receipt.customer_mobile && (
            <div className="flex justify-between items-center">
              <span className="text-[#78716C]">{t.th_mobile}:</span>
              <span className="font-mono text-[#1C1917]">{receipt.customer_mobile}</span>
            </div>
          )}
        </div>

        {/* Amount Paid Callout */}
        <div className="bg-[#F0FDF4] border-2 border-[#86EFAC] rounded-xl p-3.5 text-center space-y-1">
          <span className="text-[11px] font-bold text-[#15803D] block uppercase tracking-wider">
            {lang === 'hi' ? 'जमा की गई राशि (Amount Paid)' : 'Amount Paid'}
          </span>
          <div className="text-2xl font-black text-[#14532D] font-mono">
            ₹{amountPaid.toFixed(2)}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-[#15803D] border border-[#86EFAC]">
            <span>{t.payment_mode_title}:</span>
            <b>{receipt.payment_mode}</b>
          </div>
        </div>

        {/* Ledger Breakdown */}
        <div className="space-y-1.5 text-xs border-t border-[#E7E5E4] pt-3">
          <div className="flex justify-between text-[#78716C]">
            <span>{lang === 'hi' ? 'पिछला बकाया (Previous Due):' : 'Previous Due:'}</span>
            <span className="font-mono font-bold text-[#1C1917]">₹{prevDue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[#15803D] font-medium">
            <span>{lang === 'hi' ? 'जमा राशि (Deposit):' : 'Deposit:'}</span>
            <span className="font-mono font-bold">-₹{amountPaid.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between items-center p-2 rounded-lg font-bold border mt-2 ${
            newDue <= 0 
              ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]' 
              : 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
          }`}>
            <span>{lang === 'hi' ? 'अब शेष बकाया (Balance):' : 'Current Balance:'}</span>
            <span className="font-mono font-black text-sm">
              ₹{newDue.toFixed(2)} {newDue <= 0 ? (lang === 'hi' ? '(चुकता ✓)' : '(No Due ✓)') : ''}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-[#E7E5E4]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#78716C] hover:text-[#1C1917] rounded-xl text-xs font-bold border border-[#E7E5E4] transition"
          >
            {t.btn_cancel || 'Close'}
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <i className="fa-brands fa-whatsapp text-sm"></i>
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <i className="fa-solid fa-print"></i>
            <span>{lang === 'hi' ? 'प्रिंट' : 'Print'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

