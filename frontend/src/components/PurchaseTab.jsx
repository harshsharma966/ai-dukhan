import React, { useState, useEffect } from 'react';

export default function PurchaseTab({ onOpenPriceModal, t }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('packet');
  const [cp, setCp] = useState('');
  const [sp, setSp] = useState('');
  const [alertLimit, setAlertLimit] = useState('5');
  const [matchHint, setMatchHint] = useState(null); // { matched: boolean, data: obj }
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load inventory
  const loadInventory = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setInventory(data.products || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // Delete product from store
  const handleDeleteProduct = async (product) => {
    const template = t.confirm_delete_product || "⚠️ क्या आप वाकई '{name}' को दुकान से हटाना चाहते हैं?";
    const confirmMsg = template.replace('{name}', product.name);
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/products/${product.id}/delete`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        loadInventory();
      } else {
        alert(t.error_prefix + (data.detail || data.error || 'Failed to delete'));
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    }
  };

  // Smart matching as user types product name
  useEffect(() => {
    if (!name.trim()) {
      setMatchHint(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/products/match?name=' + encodeURIComponent(name.trim()));
        const data = await res.json();
        if (data.success) {
          if (data.matched) {
            setMatchHint({ matched: true, data: data.matched });
            setUnit(data.matched.unit || 'packet');
            setCp(data.matched.cost_price || '');
            setSp(data.matched.selling_price || '');
          } else {
            setMatchHint({ matched: false });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [name]);

  // Submit stock in
  const handleSubmitStockIn = async () => {
    const parsedQty = parseFloat(qty);
    const parsedCp = parseFloat(cp);
    const parsedSp = parseFloat(sp);
    const parsedLimit = parseFloat(alertLimit) || 5;

    if (!name.trim() || isNaN(parsedQty) || isNaN(parsedCp) || parsedQty <= 0) {
      alert(t.alert_valid_stockin);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/purchase/manual-stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              raw_name: name.trim(),
              quantity: parsedQty,
              unit: unit,
              cost_price: parsedCp,
              selling_price: isNaN(parsedSp) ? null : parsedSp,
              low_stock_limit: parsedLimit
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + data.message);
        setName('');
        setQty('');
        setCp('');
        setSp('');
        setMatchHint(null);
        loadInventory();
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Change alert limit for product
  const handleEditAlertLimit = async (product) => {
    const promptMsg = `${t.prompt_alert_limit_part1}${product.name}${t.prompt_alert_limit_part2}`;
    const newLimitStr = prompt(promptMsg, product.low_stock_limit ?? 5);
    if (newLimitStr === null) return;
    const parsedLimit = parseFloat(newLimitStr);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      alert(t.alert_valid_number);
      return;
    }

    try {
      const res = await fetch(`/api/products/${product.id}/update-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ low_stock_limit: parsedLimit })
      });
      const data = await res.json();
      if (data.success) {
        loadInventory();
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    }
  };

  return (
    <section className="tab-view block space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Entry Form (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-sm space-y-4">
          <div className="border-b border-[#E7E5E4] pb-3">
            <h2 className="font-extrabold text-[#1C1917] text-base">{t.stockin_title}</h2>
            <p className="text-xs text-[#78716C]">{t.stockin_sub}</p>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t.lbl_prod_name}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.ph_purch_name}
                className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm focus:outline-none focus:border-[#15803D]"
              />
              {matchHint && (
                <div
                  className={`text-xs mt-1 font-semibold ${
                    matchHint.matched ? 'text-[#15803D] font-bold' : 'text-[#B45309]'
                  }`}
                >
                  {matchHint.matched
                    ? `${t.hint_already_exists} '${matchHint.data.name}' (${t.hint_stock_cur} ${matchHint.data.current_stock} ${matchHint.data.unit})`
                    : t.hint_new_product}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">{t.lbl_qty}</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="10"
                  className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold focus:outline-none focus:border-[#15803D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">{t.lbl_unit}</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm bg-white focus:outline-none focus:border-[#15803D]"
                >
                  <option value="packet">{t.opt_packet}</option>
                  <option value="kg">{t.opt_kg}</option>
                  <option value="liter">{t.opt_liter}</option>
                  <option value="piece">{t.opt_piece}</option>
                  <option value="box">{t.opt_box}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">{t.lbl_cp}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={cp}
                  onChange={(e) => setCp(e.target.value)}
                  placeholder="125.0"
                  className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold focus:outline-none focus:border-[#15803D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">{t.lbl_sp}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sp}
                  onChange={(e) => setSp(e.target.value)}
                  placeholder="145.0"
                  className="w-full p-2.5 rounded-lg border border-[#E7E5E4] text-sm font-bold focus:outline-none focus:border-[#15803D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#B45309] mb-1">
                {t.lbl_alert_limit}
              </label>
              <input
                type="number"
                min="0"
                value={alertLimit}
                onChange={(e) => setAlertLimit(e.target.value)}
                placeholder={t.ph_alert_limit}
                className="w-full p-2.5 rounded-lg border border-[#FDE68A] text-sm font-bold text-[#92400E] bg-[#FFFBEB] focus:outline-none"
              />
              <span className="text-[11px] text-[#78716C] block mt-0.5">
                {t.alert_limit_help}
              </span>
            </div>

            <button
              onClick={handleSubmitStockIn}
              disabled={loading}
              className="w-full bg-[#15803D] hover:bg-[#166534] text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 mt-2 shadow transition"
            >
              <i className="fa-solid fa-plus"></i> <span>{t.btn_stockin}</span>
            </button>
          </div>
        </div>

        {/* Inventory List (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-[#E7E5E4] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E7E5E4] pb-3">
            <div>
              <h2 className="font-extrabold text-[#1C1917] text-base">{t.inv_title}</h2>
              <p className="text-xs text-[#78716C]">{t.inv_sub}</p>
            </div>
            <button
              onClick={loadInventory}
              className="text-xs bg-[#FAFAF7] px-3 py-1.5 rounded-lg text-[#1C1917] hover:bg-[#E7E5E4] font-semibold border border-[#E7E5E4] transition"
            >
              <i className="fa-solid fa-rotate-right"></i> <span>{t.btn_refresh}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4] uppercase">
                <tr>
                  <th className="py-2.5 px-3">{t.th_product}</th>
                  <th className="py-2.5 px-3">{t.th_stock}</th>
                  <th className="py-2.5 px-3">{t.th_alert_limit}</th>
                  <th className="py-2.5 px-3">{t.th_cp}</th>
                  <th className="py-2.5 px-3">{t.th_sp}</th>
                  <th className="py-2.5 px-3 text-right">{t.th_action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {inventory.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  const isLow = p.current_stock > 0 && p.current_stock <= p.low_stock_limit;

                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF7] transition">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-[#1C1917]">{p.name}</span>
                        {p.hindi_name && (
                          <>
                            <br />
                            <span className="text-[#78716C] text-[10px]">{p.hindi_name}</span>
                          </>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isOutOfStock ? (
                          <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-bold">
                            {t.out_of_stock}
                          </span>
                        ) : isLow ? (
                          <span className="bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] px-2 py-0.5 rounded font-bold">
                            {t.low_stock_prefix}{p.current_stock} {p.unit}
                          </span>
                        ) : (
                          <span className="bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] px-2 py-0.5 rounded font-bold">
                            {p.current_stock} {p.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleEditAlertLimit(p)}
                          title="Click to edit alert threshold"
                          className="bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#FDE68A] transition flex items-center gap-1 shadow-sm"
                        >
                          ⚠️ {p.low_stock_limit} {p.unit}{' '}
                          <i className="fa-solid fa-pen-to-square text-[9px] text-[#B45309]"></i>
                        </button>
                      </td>
                      <td
                        className="py-2.5 px-3 text-[#78716C] font-mono cursor-pointer hover:text-emerald-700 transition"
                        onClick={() => onOpenPriceModal(p)}
                        title="Click to edit rate"
                      >
                        ₹{Number(p.cost_price).toFixed(1)}{' '}
                        <i className="fa-solid fa-pen text-[9px] text-stone-300 ml-1"></i>
                      </td>
                      <td
                        className="py-2.5 px-3 font-extrabold text-[#15803D] font-mono cursor-pointer hover:underline transition"
                        onClick={() => onOpenPriceModal(p)}
                        title="Click to edit rate"
                      >
                        ₹{Number(p.selling_price).toFixed(1)}{' '}
                        <i className="fa-solid fa-pen text-[9px] text-emerald-400 ml-1"></i>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => onOpenPriceModal(p)}
                          title={t.btn_edit_price}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-xs"
                        >
                          <i className="fa-solid fa-pen-to-square text-[10px]"></i>{' '}
                          <span>{t.btn_edit_price}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          title={t.btn_delete_product || "हटाएं"}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>{' '}
                          <span>{t.btn_delete_product || "हटाएं"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-xl text-stone-400 mb-1">
                          <i className="fa-solid fa-boxes-stacked"></i>
                        </div>
                        <span className="font-extrabold text-sm text-stone-700">{t.empty_inventory_title}</span>
                        <span className="text-xs text-stone-400 max-w-xs">{t.empty_inventory_sub}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

