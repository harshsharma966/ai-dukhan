import React from 'react';
import { generateBillWhatsAppText, sendWhatsAppMessage } from '../../utils';

export default function ReceiptModal({ isOpen, onClose, bill, lang, t, currentShop }) {
  if (!isOpen || !bill) return null;

  const dateStr = new Date(bill.created_at || bill.bill_date).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN');
  const custName = bill.customer_name ? bill.customer_name : t.walkin_receipt;
  
  const subtotalVal = Number(bill.subtotal !== undefined ? bill.subtotal : bill.total_amount) || 0;
  const discountVal = Number(bill.discount) || 0;
  const finalVal = Number(bill.final_amount) || 0;
  const recvAmt = Number(bill.amount_received) || 0;
  const chgAmt = Number(bill.change_amount) || 0;
  const dueAmt = Number(bill.due_amount) || 0;

  let modeLabel = bill.payment_mode;
  if (bill.payment_mode === 'CASH') modeLabel = t.mode_cash_lbl;
  else if (bill.payment_mode === 'UPI') modeLabel = t.mode_upi_lbl;
  else if (bill.payment_mode === 'UDHAAR') modeLabel = t.mode_udhaar_lbl;
  else if (bill.payment_mode === 'PARTIAL') modeLabel = t.mode_partial_lbl;

  const prevDue = Number(bill.previous_due !== undefined ? bill.previous_due : 0) || 0;
  const liveDue = Number(bill.current_balance_now !== undefined ? bill.current_balance_now : (bill.customer_current_due !== undefined ? bill.customer_current_due : (prevDue + dueAmt))) || 0;

  const handleShareWhatsApp = () => {
    const text = generateBillWhatsAppText(bill, lang, currentShop);
    sendWhatsAppMessage(bill.customer_mobile, text, t.prompt_enter_mobile);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="modal-receipt" className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7E5E4]">
        <div className="text-center border-b border-[#E7E5E4] pb-3 space-y-1">
          <h3 className="font-extrabold text-base text-[#1C1917]">{bill.shop_name || currentShop?.shop_name || t.rcpt_shop_title}</h3>
          {(bill.shop_address || currentShop?.address) && <p className="text-[11px] text-[#78716C]">{bill.shop_address || currentShop?.address}</p>}
          {(bill.shop_mobile || currentShop?.mobile) && <p className="text-[11px] text-[#78716C]">📞 {bill.shop_mobile || currentShop?.mobile}</p>}
          <p className="text-[11px] text-[#78716C]">{t.rcpt_memo}</p>
          <p className="text-[11px] font-mono text-[#78716C]">{bill.bill_number}</p>
        </div>

        <div className="text-xs space-y-1">
          <div className="flex justify-between text-[#78716C]">
            <span>{t.rcpt_date} <span>{dateStr}</span></span>
            <span className="font-bold text-[#1C1917]">{custName}</span>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-xs border-y border-[#E7E5E4] py-2 my-2">
          <thead>
            <tr className="text-[#78716C] text-left border-b border-[#E7E5E4]">
              <th className="py-1">{t.rcpt_item}</th>
              <th className="py-1 text-center">{t.rcpt_rate}</th>
              <th className="py-1 text-center">{t.rcpt_qty}</th>
              <th className="py-1 text-right">{t.rcpt_amount}</th>
            </tr>
          </thead>
          <tbody>
            {bill.items && bill.items.map((it, idx) => (
              <tr key={idx}>
                <td className="py-1 font-bold text-[#1C1917]">{it.product_name}</td>
                <td className="py-1 text-center font-mono text-[#78716C]">₹{Number(it.selling_price).toFixed(1)}</td>
                <td className="py-1 text-center font-semibold">{it.quantity} {it.unit}</td>
                <td className="py-1 text-right font-extrabold font-mono text-[#1C1917]">₹{Number(it.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="text-xs space-y-1">
          <div className="flex justify-between text-[#78716C]">
            <span>{t.subtotal}</span>
            <span className="font-bold text-[#1C1917]">₹{subtotalVal.toFixed(2)}</span>
          </div>

          {discountVal > 0 && (
            <div className="flex justify-between text-[#15803D] font-bold bg-[#DCFCE7]/60 px-1.5 py-0.5 rounded">
              <span>{t.discount}</span>
              <span>-₹{discountVal.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between font-extrabold text-sm text-[#1C1917] border-t border-[#E7E5E4] pt-1">
            <span>{t.final_due}</span>
            <span className="text-[#15803D]">₹{finalVal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-[#15803D] font-bold">
            <span>{t.payment_mode_title}:</span>
            <span>{modeLabel}</span>
          </div>

          {bill.payment_mode === 'CASH' && chgAmt > 0 && (
            <>
              <div className="flex justify-between text-[#78716C]">
                <span>{t.lbl_tendered}</span>
                <span className="font-bold text-[#1C1917]">₹{recvAmt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#15803D] font-bold">
                <span>{t.lbl_change}</span>
                <span className="font-bold text-[#15803D]">₹{chgAmt.toFixed(2)}</span>
              </div>
            </>
          )}

          {dueAmt > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>{t.rcpt_bill_due}</span>
              <span>₹{dueAmt.toFixed(2)}</span>
            </div>
          )}

          {/* CUSTOMER UDHAAR LEDGER BREAKDOWN */}
          {bill.customer_id && (
            <div className="mt-3 pt-3 border-t-2 border-dashed border-[#E7E5E4] space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-[#B45309] uppercase">
                <span>{t.rcpt_ledger_status}</span>
                <span className="text-[#78716C] font-normal">{t.rcpt_cust_slip}</span>
              </div>

              <div className="bg-[#FFFBEB] p-2.5 rounded-lg border border-[#FDE68A] text-xs space-y-1">
                <div className="flex justify-between text-[#78716C]">
                  <span>{t.rcpt_prev_due}</span>
                  <span className="font-medium text-[#1C1917]">₹{prevDue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#B45309]">
                  <span>{t.rcpt_added_due}</span>
                  <span className="font-bold">₹{dueAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#1C1917] font-extrabold border-t border-[#FDE68A] pt-1 text-sm">
                  <span>{t.rcpt_current_balance}</span>
                  <span className={liveDue <= 0.001 ? 'text-[#15803D] font-extrabold' : 'text-red-700 font-extrabold'}>
                    ₹{liveDue.toFixed(2)} {liveDue <= 0.001 ? `(${t.no_due || 'चुकता ✓'})` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="py-2 px-3 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg text-xs font-bold border border-[#E7E5E4] transition"
          >
            {t.btn_close}
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <i className="fa-brands fa-whatsapp text-sm"></i> <span>{t.btn_send_whatsapp}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
          >
            <i className="fa-solid fa-print"></i> <span>{t.btn_print}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

