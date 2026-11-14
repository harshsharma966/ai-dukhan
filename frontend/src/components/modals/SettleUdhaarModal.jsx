import React, { useState, useEffect } from 'react';

export default function SettleUdhaarModal({ isOpen, onClose, customer, onSettled, t }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setAmount(customer.due || customer.current_due || '');
      setMode('CASH');
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert(t.alert_enter_valid_amount);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/post-sale/recover-udhaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          amount: parsedAmt,
          payment_mode: mode
        })
      });
      const data = await res.json();
      if (data.success) {
        onSettled(data.data);
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

  const dueVal = Number(customer.due !== undefined ? customer.due : customer.current_due) || 0;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#E7E5E4]">
        <h3 className="font-bold text-[#1C1917] text-base">{t.modal_settle_title}</h3>
        <div className="bg-[#FAFAF7] p-3 rounded-lg border border-[#E7E5E4] text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[#78716C]">{t.th_cust_name}:</span>
            <span className="font-bold text-[#1C1917]">{customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#78716C]">{t.th_current_due}:</span>
            <span className="font-bold text-red-600">₹{dueVal.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_amount_paying}</label>
            <input
              type="number"
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold focus:outline-none focus:border-[#15803D]"
            />
          </div>
          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.payment_mode_title}</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E7E5E4] bg-white text-xs focus:outline-none focus:border-[#15803D]"
            >
              <option value="CASH">{t.opt_settle_cash}</option>
              <option value="UPI">{t.opt_settle_upi}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-[#78716C] hover:bg-[#FAFAF7]"
            >
              {t.btn_cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs bg-[#15803D] hover:bg-[#166534] text-white font-bold transition"
            >
              {t.btn_submit_deposit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

