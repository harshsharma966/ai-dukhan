import React, { useState, useEffect } from 'react';

export default function CustomerStatementModal({ isOpen, onClose, customerId, t }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) {
      loadStatement(customerId);
    } else {
      setStatement(null);
    }
  }, [isOpen, customerId]);

  const loadStatement = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}/statement`);
      const data = await res.json();
      if (data.success) {
        setStatement(data.statement);
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E7E5E4] max-h-[90vh] flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start border-b border-[#E7E5E4] pb-3 mb-3">
            <div>
              <h3 className="font-extrabold text-[#1C1917] text-base">
                {statement ? statement.customer.name : '...'}
              </h3>
              <p className="text-xs text-[#78716C]">
                {statement?.customer.mobile ? `${t.mobile_label}: ${statement.customer.mobile}` : `${t.mobile_label}: ${t.mobile_not_avail}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#78716C] block">{t.th_current_due}:</span>
              <span className="font-extrabold text-lg text-red-600">
                ₹{statement ? Number(statement.total_current_due).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#78716C] uppercase tracking-wider">{t.modal_stmt_header}</h4>
            <div className="overflow-x-auto border border-[#E7E5E4] rounded-lg max-h-[300px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4]">
                  <tr>
                    <th className="py-2 px-3">{t.th_month}</th>
                    <th className="py-2 px-3 text-right">{t.th_credit_taken}</th>
                    <th className="py-2 px-3 text-right">{t.th_money_paid}</th>
                    <th className="py-2 px-3 text-right">{t.th_month_balance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {loading && (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-[#78716C]">⏳ Loading...</td>
                    </tr>
                  )}
                  {!loading && statement && (!statement.months_summary || statement.months_summary.length === 0) && (
                    <tr>
                      <td colSpan="4" className="text-center py-6 text-[#A8A29E] text-xs">
                        {t.no_credit_records}
                      </td>
                    </tr>
                  )}
                  {!loading && statement && statement.months_summary && statement.months_summary.map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-[#1C1917]">{m.month_label}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-700 font-bold">₹{Number(m.credit_taken).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#15803D] font-bold">₹{Number(m.paid_amount).toFixed(2)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-extrabold ${m.net_balance > 0 ? 'text-red-600' : 'text-[#78716C]'}`}>
                        ₹{Number(m.net_balance).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-[#E7E5E4]">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg text-xs font-bold border border-[#E7E5E4] transition"
          >
            {t.btn_close}
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition"
          >
            <i className="fa-solid fa-print"></i> <span>{t.btn_print_stmt}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

