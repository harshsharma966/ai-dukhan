import React, { useState, useEffect } from 'react';

export default function UpdatePriceModal({ isOpen, onClose, product, onPriceSaved, t }) {
  const [cp, setCp] = useState('');
  const [sp, setSp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setCp(product.cost_price ?? '');
      setSp(product.selling_price ?? '');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const cost = parseFloat(cp) || 0;
  const sell = parseFloat(sp) || 0;
  const profit = sell - cost;
  const marginPct = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';

  const handleSave = async () => {
    if (isNaN(cost) || cost < 0 || isNaN(sell) || sell < 0) {
      alert(t.alert_valid_price);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/update-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_price: cost, selling_price: sell })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + (t.alert_price_saved || data.message));
        onPriceSaved();
        onClose();
      } else {
        alert(t.error_prefix + (data.detail || data.error));
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#E7E5E4]">
        <div className="flex justify-between items-start border-b border-[#E7E5E4] pb-3">
          <div>
            <h3 className="font-extrabold text-[#1C1917] text-base flex items-center gap-2">
              <span>🏷️</span> <span>{t.modal_price_title}</span>
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              {product.name} {product.hindi_name ? `(${product.hindi_name})` : ''} [{product.unit}]
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-lg transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_cost_price}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-stone-400 font-bold">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-[#FAFAF7] border border-[#E7E5E4] rounded-lg font-bold text-stone-800 focus:outline-none focus:border-[#15803D]"
              />
            </div>
            <span className="text-[10px] text-[#78716C]">{t.hint_cp}</span>
          </div>

          <div>
            <label className="block font-bold text-[#1C1917] mb-1">{t.lbl_selling_price}</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-emerald-600 font-bold">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                value={sp}
                onChange={(e) => setSp(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-[#FAFAF7] border border-[#E7E5E4] rounded-lg font-bold text-emerald-700 focus:outline-none focus:border-[#15803D]"
              />
            </div>
            <span className="text-[10px] text-[#78716C]">{t.hint_sp}</span>
          </div>

          {/* Live Margin Indicator */}
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex justify-between items-center font-bold">
            <span className="text-xs">{t.lbl_live_profit}</span>
            <span className={`font-extrabold text-sm ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {profit >= 0 ? `+₹${profit.toFixed(1)} (${marginPct}%)` : `-₹${Math.abs(profit).toFixed(1)} (${marginPct}%) [घाटा]`}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-[#E7E5E4]">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#FAFAF7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg font-bold transition text-xs border border-[#E7E5E4]"
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg font-bold transition shadow-sm text-xs flex items-center justify-center gap-1"
          >
            <i className="fa-solid fa-check"></i> <span>{t.btn_save_price}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

