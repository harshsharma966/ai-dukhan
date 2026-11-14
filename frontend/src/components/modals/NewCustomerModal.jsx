import React, { useState } from 'react';

export default function NewCustomerModal({ isOpen, onClose, onCustomerCreated, t }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(t.alert_enter_name);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/customers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), mobile: mobile.trim() || null })
      });
      const data = await res.json();
      if (data.success) {
        setName('');
        setMobile('');
        onCustomerCreated(data.customer);
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
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#E7E5E4]">
        <h3 className="font-bold text-[#1C1917] text-base">{t.modal_new_cust_title}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_cust_name_req}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.ph_new_cust_name}
              autoFocus
              className="w-full p-2.5 rounded-lg border border-[#E7E5E4] focus:outline-none focus:border-[#15803D]"
            />
          </div>
          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_cust_mobile_opt}</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="9876543210"
              className="w-full p-2.5 rounded-lg border border-[#E7E5E4] focus:outline-none focus:border-[#15803D]"
            />
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
              {t.btn_save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

