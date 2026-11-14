import React, { useState, useEffect } from 'react';
import { generateBillWhatsAppText, sendWhatsAppMessage } from '../utils';

export default function HistoryTab({ onReprintBill, onOpenReturnModal, lang, t, currentRole = 'owner' }) {
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const loadBills = async () => {
    setLoading(true);
    let url = '/api/sales/bills?';
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (selectedDate) params.append('date', selectedDate);
    if (selectedStatus) params.append('status', selectedStatus);

    try {
      const res = await fetch(url + params.toString());
      const data = await res.json();
      if (data.success) {
        setBills(data.bills || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBills();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedDate, selectedStatus]);

  const totalAmount = bills
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((acc, b) => acc + (Number(b.final_amount) || 0), 0);

  const handleShareWhatsApp = async (billId) => {
    try {
      const res = await fetch(`/api/sales/bills/${billId}`);
      const data = await res.json();
      if (data.success && data.bill) {
        const text = generateBillWhatsAppText(data.bill, lang);
        sendWhatsAppMessage(data.bill.customer_mobile, text, t.prompt_enter_mobile);
      } else {
        alert(t.error_prefix + 'Bill not found');
      }
    } catch (e) {
      alert(t.error_prefix + e.message);
    }
  };

  const handleCancelBill = async (bill) => {
    const confirmMsg = t.confirm_cancel_bill_msg.replace('{bill}', bill.bill_number);
    if (!window.confirm(confirmMsg)) return;

    const reason = window.prompt(t.prompt_cancel_reason, '') || 'Cancelled by store owner';

    try {
      const res = await fetch('/api/post-sale/cancel-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_bill_id: bill.id,
          reason: reason
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + t.alert_cancel_success);
        loadBills();
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (e) {
      alert(t.error_prefix + e.message);
    }
  };

  return (
    <section className="tab-view block space-y-4">
      {/* Title & Filter Card */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E5E4] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[#E7E5E4] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1C1917] flex items-center gap-2">
              <span>{t.history_title}</span>
            </h2>
            <p className="text-xs text-[#78716C]">{t.history_sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#78716C] bg-[#FAFAF7] px-3 py-1.5 rounded-lg border border-[#E7E5E4]">
              {t.lbl_total_bills_found} <b className="text-[#1C1917]">{bills.length}</b> |{' '}
              {t.lbl_total_value}{' '}
              <b className="text-[#15803D]">₹{totalAmount.toFixed(2)}</b>
            </span>
            <button
              onClick={loadBills}
              className="px-3 py-1.5 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg text-xs font-bold border border-[#E7E5E4] transition flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate-right"></i> <span>{t.btn_refresh}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          {/* Live Search Input */}
          <div className="md:col-span-6 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-[#A8A29E]"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.ph_history_search}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#15803D] text-xs"
            />
          </div>

          {/* Date Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-2 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#15803D] text-xs bg-white"
            />
            <button
              onClick={() => setSelectedDate('')}
              title="Show All Dates"
              className="px-2.5 py-2 bg-[#FAFAF7] hover:bg-[#E7E5E4] border border-[#E7E5E4] rounded-xl text-[11px] font-bold text-[#78716C] whitespace-nowrap"
            >
              {t.btn_all_dates}
            </button>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded-xl border border-[#E7E5E4] focus:outline-none focus:border-[#15803D] text-xs bg-white font-medium"
            >
              <option value="ALL">{t.opt_all_status}</option>
              <option value="CONFIRMED">{t.opt_confirmed}</option>
              <option value="CANCELLED">{t.opt_cancelled}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills List Table */}
      <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] sticky top-0 z-10">
              <tr>
                <th className="p-3 font-bold">{t.th_bill_no_time}</th>
                <th className="p-3 font-bold">{t.th_cust}</th>
                <th className="p-3 font-bold text-center">{t.th_items_count}</th>
                <th className="p-3 font-bold text-right">{t.th_total_amt}</th>
                <th className="p-3 font-bold text-center">{t.th_pay_mode}</th>
                <th className="p-3 font-bold text-center">{t.th_status}</th>
                <th className="p-3 font-bold text-right">{t.th_bill_action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-[#78716C]">
                    ⏳ Loading...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-[#78716C] italic">
                    {t.no_bills_found}
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const isCancelled = bill.status === 'CANCELLED';
                  const dateStr = new Date(bill.created_at || bill.bill_date).toLocaleString(
                    lang === 'hi' ? 'hi-IN' : 'en-IN'
                  );

                  return (
                    <tr key={bill.id} className="hover:bg-[#FAFAF7] transition text-xs">
                      <td className="p-3">
                        <span className="font-mono font-bold text-[#1C1917] block">
                          {bill.bill_number}
                        </span>
                        <span className="text-[10px] text-[#78716C] block">{dateStr}</span>
                        {bill.created_by_name && (
                          <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block mt-0.5">
                            👤 {bill.created_by_name}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {bill.customer_name ? (
                          <>
                            <b>{bill.customer_name}</b>
                            <span className="block text-[10px] text-[#78716C] font-mono">
                              {bill.customer_mobile || ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-[#78716C] font-semibold">
                            {t.walkin_receipt}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-[#1C1917]">{bill.item_count}</td>
                      <td className="p-3 text-right font-extrabold font-mono text-[#15803D]">
                        ₹{Number(bill.final_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        {bill.payment_mode === 'CASH' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            {t.mode_cash_lbl}
                          </span>
                        )}
                        {bill.payment_mode === 'UPI' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {t.mode_upi_lbl}
                          </span>
                        )}
                        {bill.payment_mode === 'UDHAAR' && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {t.mode_udhaar_lbl}
                            </span>
                            {bill.customer_current_due !== undefined && Number(bill.customer_current_due) <= 0 ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ {lang === 'hi' ? 'चुका दिया' : 'Cleared'}
                              </span>
                            ) : bill.customer_current_due !== undefined && Number(bill.customer_current_due) > 0 ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {lang === 'hi' ? `बाकी: ₹${Number(bill.customer_current_due).toFixed(0)}` : `Due: ₹${Number(bill.customer_current_due).toFixed(0)}`}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {bill.payment_mode === 'PARTIAL' && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              {t.mode_partial_lbl}
                            </span>
                            {bill.customer_current_due !== undefined && Number(bill.customer_current_due) <= 0 ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ {lang === 'hi' ? 'चुका दिया' : 'Cleared'}
                              </span>
                            ) : bill.customer_current_due !== undefined && Number(bill.customer_current_due) > 0 ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {lang === 'hi' ? `बाकी: ₹${Number(bill.customer_current_due).toFixed(0)}` : `Due: ₹${Number(bill.customer_current_due).toFixed(0)}`}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {bill.status === 'CONFIRMED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ {t.status_confirmed}
                          </span>
                        )}
                        {bill.returns_count > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            🔄 Return
                          </span>
                        )}
                        {bill.status === 'CANCELLED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                            ✕ {t.status_cancelled}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleShareWhatsApp(bill.id)}
                            title="Send on WhatsApp"
                            className="px-2.5 py-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <i className="fa-brands fa-whatsapp text-sm text-[#25D366]"></i>{' '}
                            <span className="hidden sm:inline">{t.btn_whatsapp}</span>
                          </button>
                          <button
                            onClick={() => onReprintBill(bill.id)}
                            title="Re-print Receipt"
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-[#1C1917] rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <i className="fa-solid fa-print"></i> <span>{t.btn_reprint}</span>
                          </button>
                          {!isCancelled ? (
                            <>
                              {currentRole !== 'cashier' && (
                                <>
                                  <button
                                    onClick={() => onOpenReturnModal(bill.id)}
                                    title="Return Items"
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                  >
                                    <i className="fa-solid fa-rotate-left"></i>{' '}
                                    <span>{t.btn_return}</span>
                                  </button>
                                  <button
                                    onClick={() => handleCancelBill(bill)}
                                    title="Cancel Bill"
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                  >
                                    <i className="fa-solid fa-ban"></i>{' '}
                                    <span>{t.btn_cancel_bill}</span>
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-stone-400 italic">
                              {lang === 'hi' ? 'रद्द शुदा' : 'Cancelled'}
                            </span>
                          )}
                        </div>
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

