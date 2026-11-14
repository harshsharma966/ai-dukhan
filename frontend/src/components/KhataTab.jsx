import React, { useState, useEffect } from 'react';
import { sendUdhaarWhatsAppReminder } from '../utils';

export default function KhataTab({
  onOpenNewCustomerModal,
  onOpenSettleModal,
  onOpenStatementModal,
  lang,
  t,
  currentShop
}) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <section className="tab-view block space-y-4">
      <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[#E7E5E4] pb-4 mb-4">
          <div>
            <h2 className="font-extrabold text-[#1C1917] text-base">{t.khata_title}</h2>
            <p className="text-xs text-[#78716C]">{t.khata_sub}</p>
          </div>
          <button
            onClick={onOpenNewCustomerModal}
            className="bg-[#15803D] hover:bg-[#166534] text-white text-xs px-3.5 py-2 rounded-lg font-bold transition shadow-sm"
          >
            {t.btn_new_customer}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] uppercase">
              <tr>
                <th className="py-2.5 px-3">{t.th_cust_name}</th>
                <th className="py-2.5 px-3">{t.th_mobile}</th>
                <th className="py-2.5 px-3">{t.th_current_due}</th>
                <th className="py-2.5 px-3 text-right">{t.th_action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-[#78716C]">
                    ⏳ Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-[#A8A29E]">
                    {t.no_customers}
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const due = parseFloat(c.current_due) || 0;
                  return (
                    <tr key={c.id} className="hover:bg-[#FAFAF7] transition">
                      <td className="py-2.5 px-3 font-bold text-[#1C1917]">{c.name}</td>
                      <td className="py-2.5 px-3 text-[#78716C] font-mono">{c.mobile || '-'}</td>
                      <td
                        className={`py-2.5 px-3 font-extrabold font-mono ${
                          due > 0 ? 'text-red-600' : 'text-[#15803D]'
                        }`}
                      >
                        ₹{due.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onOpenStatementModal(c.id)}
                          className="bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] px-2.5 py-1 rounded-lg text-xs font-bold mr-1.5 transition"
                        >
                          <i className="fa-solid fa-file-invoice"></i> {t.btn_monthly_stmt}
                        </button>
                        {due > 0 ? (
                          <>
                            <button
                              onClick={() =>
                                sendUdhaarWhatsAppReminder(
                                  c.name,
                                  c.mobile,
                                  due,
                                  lang,
                                  t.prompt_enter_mobile,
                                  currentShop
                                )
                              }
                              title="WhatsApp Udhaar Reminder"
                              className="bg-[#25D366] hover:bg-[#1EBE5D] text-white px-2.5 py-1 rounded-lg text-xs font-bold mr-1.5 transition inline-flex items-center gap-1 shadow-xs"
                            >
                              <i className="fa-brands fa-whatsapp text-sm"></i>{' '}
                              <span>{t.btn_udhaar_reminder}</span>
                            </button>
                            <button
                              onClick={() => onOpenSettleModal(c)}
                              className="bg-[#15803D] hover:bg-[#166534] text-white px-3 py-1 rounded-lg text-xs font-bold transition"
                            >
                              {t.btn_settle_due}
                            </button>
                          </>
                        ) : (
                          <span className="text-[#A8A29E] text-[11px] font-medium">
                            {t.no_due}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

