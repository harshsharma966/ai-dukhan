import React, { useState, useEffect } from 'react';

export default function ReturnModal({ isOpen, onClose, bill, onReturnSubmitted, t }) {
  const [returnQtys, setReturnQtys] = useState({});
  const [refundMode, setRefundMode] = useState('CASH');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bill && bill.items) {
      const initial = {};
      bill.items.forEach(it => {
        initial[it.id] = 0;
      });
      setReturnQtys(initial);
      setReason('');

      if (bill.customer_id && (Number(bill.due_amount) > 0 || Number(bill.customer_current_due) > 0)) {
        setRefundMode('DUE_ADJUSTMENT');
      } else {
        setRefundMode('CASH');
      }
    }
  }, [bill]);

  if (!isOpen || !bill) return null;

  const handleQtyChange = (itemId, val, max) => {
    let parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > max) {
      parsed = max;
      alert(`अधिकतम ${max} ही वापस हो सकता है!`);
    }
    setReturnQtys(prev => ({ ...prev, [itemId]: parsed }));
  };

  let totalRefund = 0;
  if (bill.items) {
    bill.items.forEach(it => {
      const q = returnQtys[it.id] || 0;
      totalRefund += q * Number(it.selling_price || 0);
    });
  }

  const handleSubmit = async () => {
    const returnItems = [];
    Object.entries(returnQtys).forEach(([itemId, qty]) => {
      if (qty > 0) {
        returnItems.push({
          sales_item_id: parseInt(itemId),
          quantity: qty
        });
      }
    });

    if (!returnItems.length) {
      alert(t.alert_select_return_qty);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/post-sale/return-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_bill_id: bill.id,
          return_items: returnItems,
          refund_mode: refundMode,
          reason: reason.trim() || null
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + t.alert_return_success + ` (रिफंड: ₹${data.data.refund_amount.toFixed(2)})`);
        onReturnSubmitted();
        onClose();
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-[#E7E5E4] max-h-[90vh] flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start border-b border-[#E7E5E4] pb-3 mb-3">
            <div>
              <h3 className="font-extrabold text-[#1C1917] text-base flex items-center gap-2">
                <i className="fa-solid fa-rotate-left text-amber-600"></i>
                <span>{t.modal_return_title}</span>
              </h3>
              <p className="text-xs text-[#78716C]">
                <span className="font-mono font-bold text-[#1C1917]">{bill.bill_number}</span> | <span>{bill.customer_name || t.walkin_receipt}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-[#A8A29E] hover:text-[#1C1917] text-lg font-bold">✕</button>
          </div>

          <p className="text-xs text-[#78716C] mb-2">{t.modal_return_help}</p>

          {/* Items Table */}
          <div className="overflow-x-auto border border-[#E7E5E4] rounded-xl max-h-[260px] mb-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] sticky top-0">
                <tr>
                  <th className="py-2 px-3 font-bold">{t.th_ret_item}</th>
                  <th className="py-2 px-2 text-center font-bold">{t.th_ret_sold}</th>
                  <th className="py-2 px-2 text-center font-bold">{t.th_ret_already}</th>
                  <th className="py-2 px-2 text-center font-bold text-[#15803D]">{t.th_ret_avail}</th>
                  <th className="py-2 px-3 text-center font-bold text-amber-700">{t.th_ret_qty}</th>
                  <th className="py-2 px-2 text-right font-bold">{t.th_ret_price}</th>
                  <th className="py-2 px-3 text-right font-bold text-red-600">{t.th_ret_total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {bill.items && bill.items.map(it => {
                  const avail = it.available_return_qty !== undefined ? it.available_return_qty : it.quantity;
                  const currentQty = returnQtys[it.id] || 0;
                  const lineRefund = currentQty * (it.selling_price || 0);

                  return (
                    <tr key={it.id} className="hover:bg-[#FAFAF7] transition">
                      <td className="py-2 px-3 font-bold text-[#1C1917]">{it.product_name}</td>
                      <td className="py-2 px-2 text-center text-[#78716C]">{it.quantity} {it.unit}</td>
                      <td className="py-2 px-2 text-center text-[#78716C]">{it.returned_quantity || 0}</td>
                      <td className="py-2 px-2 text-center font-bold text-[#15803D]">{avail} {it.unit}</td>
                      <td className="py-2 px-3 text-center">
                        {avail > 0 ? (
                          <input
                            type="number"
                            min="0"
                            max={avail}
                            step="any"
                            value={currentQty}
                            onChange={(e) => handleQtyChange(it.id, e.target.value, avail)}
                            className="w-20 p-1.5 text-center font-bold rounded-lg border border-[#E7E5E4] focus:outline-none focus:border-amber-600 bg-white"
                          />
                        ) : (
                          <span className="text-[10px] text-[#A8A29E] font-semibold">पूर्ण वापसी</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#78716C]">₹{Number(it.selling_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-red-600">₹{lineRefund.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund Summary & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFAF7] p-3.5 rounded-xl border border-[#E7E5E4] text-xs">
            <div>
              <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_refund_mode}</label>
              <select
                value={refundMode}
                onChange={(e) => setRefundMode(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white text-xs font-semibold focus:outline-none focus:border-[#15803D]"
              >
                <option value="CASH">{t.opt_refund_cash}</option>
                <option value="UPI">{t.opt_refund_upi}</option>
                <option value="DUE_ADJUSTMENT" disabled={!bill.customer_id}>{t.opt_refund_due}</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_return_reason}</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.ph_return_reason}
                className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white text-xs focus:outline-none focus:border-[#15803D]"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#E7E5E4]">
            <span className="text-xs font-bold text-[#78716C]">{t.total_refund_lbl}</span>
            <span className="text-xl font-extrabold text-red-600">₹{totalRefund.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-[#E7E5E4]">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg text-xs font-bold border border-[#E7E5E4] transition"
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
          >
            <i className="fa-solid fa-rotate-left"></i> <span>{t.btn_confirm_return}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

