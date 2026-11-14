import React, { useState, useEffect } from 'react';

export default function ReportTab({ lang, t }) {
  const [reportDate, setReportDate] = useState('');
  const [report, setReport] = useState(null);
  const [earningsView, setEarningsView] = useState('daywise'); // 'daywise' | 'monthwise'
  const [loading, setLoading] = useState(false);

  const loadReport = async (dateStr = '') => {
    setLoading(true);
    try {
      const url = '/api/reports/daily' + (dateStr ? '?date=' + dateStr : '');
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
        if (data.report.financial && data.report.financial.date) {
          setReportDate(data.report.financial.date);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const fin = report?.financial;
  const earnings = report?.earnings;
  const itemsSold = report?.items_sold || [];
  const reorderList = report?.reorder_list || { out_of_stock: [], low_stock: [] };
  const daywise = report?.daywise_earnings || [];
  const monthwise = report?.monthwise_earnings || [];

  const totalMarketDue =
    fin?.sales_breakdown?.total_market_due !== undefined
      ? fin.sales_breakdown.total_market_due
      : fin?.sales_breakdown?.net_udhaar_today !== undefined
      ? fin.sales_breakdown.net_udhaar_today
      : fin?.sales_breakdown?.new_udhaar || 0;

  const givenToday = Number(fin?.sales_breakdown?.new_udhaar) || 0;
  const recoveredTotal = Number(fin?.udhaar_recovered?.total) || 0;

  const todayEarn = Number(earnings?.today?.net_profit) || 0;
  const todayMargin = Number(earnings?.today?.margin_pct) || 0;
  const monthEarn = Number(earnings?.month?.net_profit) || 0;

  return (
    <section className="tab-view block space-y-5">
      <div className="bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-sm">
        {/* Header & Date Picker */}
        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[#E7E5E4] pb-3 mb-4">
          <div>
            <h2 className="font-extrabold text-[#1C1917] text-base">{t.report_title}</h2>
            <p className="text-xs text-[#78716C]">{t.report_sub}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => {
                setReportDate(e.target.value);
                loadReport(e.target.value);
              }}
              className="text-xs p-2 rounded-lg border border-[#E7E5E4] bg-white focus:outline-none focus:border-[#15803D]"
            />
            <button
              onClick={() => {
                setReportDate('');
                loadReport('');
              }}
              className="text-xs bg-[#1C1917] hover:bg-black text-white px-3 py-2 rounded-lg font-bold transition"
            >
              {t.btn_today}
            </button>
          </div>
        </div>

        {/* 5 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
          <div className="bg-[#F0FDF4] p-4 rounded-xl border border-[#DCFCE7] shadow-xs">
            <span className="text-xs font-bold text-[#15803D] block">{t.stat_total_sales}</span>
            <span className="text-xl font-extrabold text-[#14532D]">
              ₹{Number(fin?.total_sales || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-[#16A34A] block mt-1 font-semibold">
              {fin?.total_bills || 0} {t.bills_suffix}
            </span>
          </div>

          <div className="bg-[#FFFBEB] p-4 rounded-xl border border-[#FDE68A] shadow-xs">
            <span className="text-xs font-bold text-[#B45309] block">{t.stat_cash_drawer}</span>
            <span className="text-xl font-extrabold text-[#92400E]">
              ₹{Number(fin?.total_money_in?.cash_in_drawer || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-[#D97706] block mt-1 font-semibold">
              {t.stat_cash_sub}
            </span>
          </div>

          <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 shadow-xs">
            <span className="text-xs font-bold text-teal-800 block">{t.stat_upi_bank}</span>
            <span className="text-xl font-extrabold text-teal-950">
              ₹{Number(fin?.total_money_in?.upi_in_bank || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-teal-700 block mt-1 font-semibold">
              {t.stat_upi_sub}
            </span>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs">
            <span className="text-xs font-bold text-amber-900 block">{t.stat_new_udhaar}</span>
            <span className="text-xl font-extrabold text-amber-950">
              ₹{Number(totalMarketDue).toFixed(2)}
            </span>
            <span className="text-[11px] text-amber-700 block mt-1 font-semibold">
              {lang === 'hi'
                ? `आज दिया: ₹${givenToday.toFixed(0)} | वसूली: ₹${recoveredTotal.toFixed(0)}`
                : `Given: ₹${givenToday.toFixed(0)} | Collected: ₹${recoveredTotal.toFixed(0)}`}
            </span>
          </div>

          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-300 shadow-xs col-span-2 md:col-span-1">
            <span className="text-xs font-bold text-emerald-800 block">{t.stat_earnings}</span>
            <span className="text-xl font-extrabold text-emerald-950">
              ₹{todayEarn.toFixed(2)}
            </span>
            <span className="text-[11px] text-emerald-700 block mt-1 font-semibold">
              {lang === 'hi' ? 'महीने की' : 'Month'}: ₹{monthEarn.toFixed(0)} ({todayMargin.toFixed(0)}% margin)
            </span>
          </div>
        </div>

        {/* Details Grid: Items Sold & Reorder List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Items Sold Table */}
          <div className="border border-[#E7E5E4] rounded-xl p-4 bg-white shadow-xs">
            <h3 className="font-bold text-xs uppercase text-[#78716C] mb-3">
              {t.title_items_sold}
            </h3>
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4]">
                  <tr>
                    <th className="p-2">{t.th_product}</th>
                    <th className="p-2">{t.lbl_qty}</th>
                    <th className="p-2 text-right">{t.rcpt_amount}</th>
                    <th className="p-2 text-right text-emerald-800">{t.th_profit}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {itemsSold.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-[#A8A29E]">
                        {t.today_no_sales}
                      </td>
                    </tr>
                  ) : (
                    itemsSold.map((it, idx) => {
                      const profitVal =
                        Number(
                          it.profit !== undefined
                            ? it.profit
                            : it.total_amount - (it.total_cost || 0)
                        ) || 0;
                      return (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-[#1C1917]">{it.product_name}</td>
                          <td className="p-2 font-semibold text-[#78716C]">
                            {it.total_qty_sold} {it.unit}
                          </td>
                          <td className="p-2 text-right font-extrabold text-[#1C1917]">
                            ₹{Number(it.total_amount).toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-extrabold">
                            {profitVal >= 0 ? (
                              <span className="text-[#15803D] font-bold">
                                +₹{profitVal.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-red-600 font-bold">
                                -₹{Math.abs(profitVal).toFixed(1)}
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

          {/* Reorder List (Out of Stock / Low Stock) */}
          <div className="border border-[#E7E5E4] rounded-xl p-4 bg-white shadow-xs">
            <h3 className="font-bold text-xs uppercase text-[#78716C] mb-3">
              {t.title_reorder}
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {reorderList.out_of_stock.length === 0 && reorderList.low_stock.length === 0 ? (
                <p className="text-xs text-[#15803D] font-bold text-center py-6">
                  {t.all_stock_ok}
                </p>
              ) : (
                <>
                  {reorderList.out_of_stock.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
                    >
                      <span>
                        <b>{p.name}</b>
                        {t.item_out_suffix}
                      </span>
                      <span className="font-bold bg-white px-2 py-0.5 rounded border border-red-200">
                        {t.stock_label}: 0
                      </span>
                    </div>
                  ))}
                  {reorderList.low_stock.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-xs text-[#92400E]"
                    >
                      <span>
                        <b>{p.name}</b>
                        {t.item_low_suffix}
                      </span>
                      <span className="font-bold bg-white px-2 py-0.5 rounded border border-[#FDE68A]">
                        {p.current_stock} / {p.low_stock_limit}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Day-wise & Month-wise Earnings Breakdown */}
        <div className="border border-[#E7E5E4] rounded-xl p-4 bg-white shadow-xs mb-6">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2 pb-2 border-b border-[#E7E5E4]">
            <div>
              <h3 className="font-bold text-sm text-[#1C1917] flex items-center gap-1.5">
                <span>📈</span> <span>{t.title_earnings_report}</span>
              </h3>
              <p className="text-[11px] text-[#78716C]">{t.sub_earnings_report}</p>
            </div>
            {/* Switch Pills */}
            <div className="flex bg-[#FAFAF7] p-0.5 rounded-lg border border-[#E7E5E4] text-xs font-bold">
              <button
                type="button"
                onClick={() => setEarningsView('daywise')}
                className={`px-3 py-1 rounded-md transition ${
                  earningsView === 'daywise'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                {t.btn_earn_daywise}
              </button>
              <button
                type="button"
                onClick={() => setEarningsView('monthwise')}
                className={`px-3 py-1 rounded-md transition ${
                  earningsView === 'monthwise'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                {t.btn_earn_monthwise}
              </button>
            </div>
          </div>

          {/* Day-wise Table */}
          {earningsView === 'daywise' && (
            <div className="overflow-x-auto max-h-[320px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold">{t.th_date}</th>
                    <th className="p-2.5 font-bold text-center">{t.th_bills}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_sales}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_cost}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_discount}</th>
                    <th className="p-2.5 font-bold text-right text-emerald-800">{t.th_net_profit}</th>
                    <th className="p-2.5 font-bold text-right text-emerald-700">{t.th_margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {daywise.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-[#A8A29E]">
                        {t.no_earnings_data}
                      </td>
                    </tr>
                  ) : (
                    daywise.map((d, idx) => {
                      const isProfit = Number(d.net_profit) >= 0;
                      return (
                        <tr key={idx} className="hover:bg-[#FAFAF7] transition">
                          <td className="p-2.5 font-bold text-[#1C1917]">{d.date}</td>
                          <td className="p-2.5 text-center font-medium">{d.bills_count}</td>
                          <td className="p-2.5 text-right font-semibold text-[#1C1917]">
                            ₹{Number(d.net_sales).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-[#78716C]">
                            ₹{Number(d.total_cost).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-700">
                            ₹{Number(d.total_discount).toFixed(2)}
                          </td>
                          <td
                            className={`p-2.5 text-right font-extrabold ${
                              isProfit ? 'text-[#15803D]' : 'text-red-600'
                            }`}
                          >
                            {isProfit ? '+' : ''}₹{Number(d.net_profit).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#15803D]">
                            {d.margin_pct}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Month-wise Table */}
          {earningsView === 'monthwise' && (
            <div className="overflow-x-auto max-h-[320px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold">{t.th_month}</th>
                    <th className="p-2.5 font-bold text-center">{t.th_bills}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_sales}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_cost}</th>
                    <th className="p-2.5 font-bold text-right">{t.th_discount}</th>
                    <th className="p-2.5 font-bold text-right text-emerald-800">{t.th_net_profit}</th>
                    <th className="p-2.5 font-bold text-right text-emerald-700">{t.th_margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {monthwise.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-[#A8A29E]">
                        {t.no_earnings_data}
                      </td>
                    </tr>
                  ) : (
                    monthwise.map((m, idx) => {
                      const isProfit = Number(m.net_profit) >= 0;
                      return (
                        <tr key={idx} className="hover:bg-[#FAFAF7] transition">
                          <td className="p-2.5 font-bold text-[#1C1917]">
                            {m.month_label || m.month_key}
                          </td>
                          <td className="p-2.5 text-center font-medium">{m.bills_count}</td>
                          <td className="p-2.5 text-right font-semibold text-[#1C1917]">
                            ₹{Number(m.net_sales).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-[#78716C]">
                            ₹{Number(m.total_cost).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-700">
                            ₹{Number(m.total_discount).toFixed(2)}
                          </td>
                          <td
                            className={`p-2.5 text-right font-extrabold ${
                              isProfit ? 'text-[#15803D]' : 'text-red-600'
                            }`}
                          >
                            {isProfit ? '+' : ''}₹{Number(m.net_profit).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#15803D]">
                            {m.margin_pct}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

