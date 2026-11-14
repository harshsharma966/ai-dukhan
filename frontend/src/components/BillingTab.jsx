import React, { useState, useEffect, useRef } from 'react';

export default function BillingTab({
  lang,
  t,
  onOpenNewCustomerModal,
  onSaleCompleted,
  selectedCustomer,
  setSelectedCustomer
}) {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [isWalkin, setIsWalkin] = useState(true);

  // Customer dropdown search
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const [customerResults, setCustomerResults] = useState([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const custDropdownRef = useRef(null);

  // Load products
  const loadProducts = async (q = '') => {
    try {
      const url = '/api/products' + (q ? '?q=' + encodeURIComponent(q) : '');
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Customer search debounce
  useEffect(() => {
    if (!isWalkin && custDropdownOpen) {
      const timer = setTimeout(async () => {
        setLoadingCust(true);
        try {
          const url = custSearch.trim()
            ? `/api/customers/search?q=${encodeURIComponent(custSearch.trim())}`
            : '/api/customers';
          const res = await fetch(url);
          const data = await res.json();
          setCustomerResults(data.customers || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingCust(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [custSearch, custDropdownOpen, isWalkin]);

  // Click outside to close customer dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (custDropdownRef.current && !custDropdownRef.current.contains(event.target)) {
        setCustDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When customer is selected from outside (e.g. modal)
  useEffect(() => {
    if (selectedCustomer) {
      setIsWalkin(false);
      setCustDropdownOpen(false);
      setCustSearch('');
    }
  }, [selectedCustomer]);

  // Cart operations
  const addToCart = (p, qtyToAdd = 1) => {
    if (p.current_stock <= 0) {
      alert(`${p.name} ${t.alert_out_of_stock}`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product_id === p.id);
      if (existing) {
        const nextQty = Math.round((existing.quantity + qtyToAdd) * 1000) / 1000;
        if (nextQty > p.current_stock) {
          alert(`${t.alert_stock_limit_prefix} ${p.current_stock} ${p.unit} ${t.alert_stock_limit_suffix}`);
          return prev;
        }
        return prev.map(item =>
          item.product_id === p.id ? { ...item, quantity: nextQty } : item
        );
      } else {
        const initialQty = Math.min(qtyToAdd, p.current_stock);
        return [
          ...prev,
          {
            product_id: p.id,
            name: p.name,
            unit: p.unit,
            selling_price: p.selling_price,
            max_stock: p.current_stock,
            quantity: Math.round(initialQty * 1000) / 1000
          }
        ];
      }
    });
  };

  const updateCartQty = (idx, delta) => {
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const u = (item.unit || '').toLowerCase().trim();
      let step = 1;
      if (
        (u === 'kg' || u === 'kilo' || u === 'kilogram' || u === 'liter' || u === 'ltr' || u === 'l') &&
        item.quantity < 1
      ) {
        step = 0.25;
      }
      const newQty = item.quantity + delta * step;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      } else if (newQty > item.max_stock) {
        alert(`${t.alert_stock_limit_prefix} ${item.max_stock} ${item.unit} ${t.alert_stock_limit_suffix}`);
        return prev;
      } else {
        return prev.map((it, i) =>
          i === idx ? { ...it, quantity: Math.round(newQty * 1000) / 1000 } : it
        );
      }
    });
  };

  const setCartQty = (idx, qty) => {
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;
      if (isNaN(qty) || qty <= 0) {
        return prev.filter((_, i) => i !== idx);
      } else if (qty > item.max_stock) {
        alert(`${t.alert_stock_limit_prefix} ${item.max_stock} ${item.unit} ${t.alert_stock_limit_suffix}`);
        return prev;
      } else {
        return prev.map((it, i) =>
          i === idx ? { ...it, quantity: Math.round(qty * 1000) / 1000 } : it
        );
      }
    });
  };

  const incrementCartQty = (idx, delta) => {
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;
      const newQty = Math.round((item.quantity + delta) * 1000) / 1000;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      } else if (newQty > item.max_stock) {
        alert(`${t.alert_stock_limit_prefix} ${item.max_stock} ${item.unit} ${t.alert_stock_limit_suffix}`);
        return prev;
      } else {
        return prev.map((it, i) => (i === idx ? { ...it, quantity: newQty } : it));
      }
    });
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // Computations
  const subtotal = cart.reduce((acc, it) => acc + it.quantity * it.selling_price, 0);
  const discountVal = parseFloat(discount) || 0;
  const finalAmount = Math.max(0, subtotal - discountVal);
  const receivedNum = parseFloat(amountReceived) || 0;

  // Change / Due calculations
  let changeAmount = 0;
  let partialDue = 0;
  let partialWarn = false;

  if (paymentMode === 'CASH') {
    changeAmount = Math.max(0, receivedNum - finalAmount);
  } else if (paymentMode === 'PARTIAL') {
    if (receivedNum >= finalAmount && finalAmount > 0) {
      partialWarn = true;
    } else {
      partialDue = Math.max(0, finalAmount - receivedNum);
    }
  }

  // Quick chips for cart items
  const renderQuickQtyChips = (item, idx) => {
    const u = (item.unit || '').toLowerCase().trim();
    let options = [];
    let addOptions = [];

    if (u === 'kg' || u === 'kilo' || u === 'kilogram') {
      options = [
        { label: '100g', val: 0.1 },
        { label: lang === 'hi' ? '250g (पाव)' : '250g', val: 0.25 },
        { label: lang === 'hi' ? '500g (आधा)' : '500g', val: 0.5 },
        { label: '1 kg', val: 1 },
        { label: '2 kg', val: 2 },
        { label: '5 kg', val: 5 }
      ];
      addOptions = [
        { label: '+250g', val: 0.25 },
        { label: '+500g', val: 0.5 },
        { label: '+1 kg', val: 1 }
      ];
    } else if (u === 'liter' || u === 'litre' || u === 'ltr' || u === 'l') {
      options = [
        { label: '250ml', val: 0.25 },
        { label: lang === 'hi' ? '500ml (आधा)' : '500ml', val: 0.5 },
        { label: '1 L', val: 1 },
        { label: '2 L', val: 2 },
        { label: '5 L', val: 5 }
      ];
      addOptions = [
        { label: '+250ml', val: 0.25 },
        { label: '+500ml', val: 0.5 },
        { label: '+1 L', val: 1 }
      ];
    } else {
      options = [
        { label: '1', val: 1 },
        { label: '2', val: 2 },
        { label: '3', val: 3 },
        { label: '5', val: 5 },
        { label: '10', val: 10 }
      ];
      addOptions = [
        { label: '+1', val: 1 },
        { label: '+2', val: 2 },
        { label: '+5', val: 5 }
      ];
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-[#78716C] font-bold">
          {lang === 'hi' ? 'सेट:' : 'Set:'}
        </span>
        {options.map((opt, i) => {
          const isSelected = Math.abs(item.quantity - opt.val) < 0.001;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setCartQty(idx, opt.val)}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition ${
                isSelected
                  ? 'bg-[#15803D] text-white border-[#15803D] font-extrabold shadow-xs'
                  : 'bg-white hover:bg-[#FEF3C7] text-[#1C1917] border-[#E7E5E4] font-semibold'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <span className="text-stone-300 mx-0.5 font-light">|</span>
        <span className="text-[10px] text-amber-800 font-bold">
          {lang === 'hi' ? '+जोड़ें:' : '+Add:'}
        </span>
        {addOptions.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => incrementCartQty(idx, opt.val)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition shadow-xs"
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  // Submit sale bill
  const handleConfirmSale = async () => {
    if (!cart.length) {
      alert(t.alert_cart_empty);
      return;
    }

    if ((paymentMode === 'UDHAAR' || paymentMode === 'PARTIAL') && !selectedCustomer) {
      alert(t.alert_udhaar_walkin);
      return;
    }

    let sendReceived = 0;
    if (paymentMode === 'CASH') {
      sendReceived = receivedNum > 0 ? receivedNum : finalAmount;
    } else if (paymentMode === 'PARTIAL') {
      if (receivedNum <= 0) {
        alert(t.alert_partial_zero);
        return;
      }
      if (receivedNum >= finalAmount) {
        alert(
          t.alert_partial_too_high
            .replace('{amt}', receivedNum.toFixed(2))
            .replace('{final}', finalAmount.toFixed(2))
        );
        return;
      }
      sendReceived = receivedNum;
    } else if (paymentMode === 'UPI') {
      sendReceived = finalAmount;
    }

    const payload = {
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      items: cart,
      discount: discountVal,
      payment_mode: paymentMode,
      amount_received: sendReceived
    };

    try {
      const res = await fetch('/api/sales/create-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        onSaleCompleted(data.bill);
        setCart([]);
        setDiscount(0);
        setAmountReceived('');
        loadProducts(); // refresh live stock
      } else {
        alert(t.error_prefix + data.error);
      }
    } catch (err) {
      alert(t.error_prefix + err.message);
    }
  };

  return (
    <section className="tab-view block">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: PRODUCT SELECTION (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-[#E7E5E4] shadow-sm flex items-center gap-3">
            <i className="fa-solid fa-magnifying-glass text-[#78716C]"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadProducts(e.target.value);
              }}
              placeholder={t.search_placeholder}
              className="w-full text-sm outline-none bg-transparent text-[#1C1917] placeholder:text-[#A8A29E]"
            />
            <button
              onClick={() => {
                setSearchQuery('');
                loadProducts('');
              }}
              className="text-xs bg-[#FAFAF7] hover:bg-[#E7E5E4] px-3 py-1.5 rounded-lg font-semibold text-[#1C1917] border border-[#E7E5E4] transition"
            >
              {t.all_btn}
            </button>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
            {products.length === 0 ? (
              <p className="col-span-full text-center py-8 text-[#A8A29E] text-xs">
                {t.no_items_found}
              </p>
            ) : (
              products.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                const isLow = p.current_stock > 0 && p.current_stock <= p.low_stock_limit;
                const u = (p.unit || '').toLowerCase().trim();
                const isLoose =
                  !isOutOfStock &&
                  (u === 'kg' || u === 'kilo' || u === 'kilogram' || u === 'liter' || u === 'ltr' || u === 'l');

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isOutOfStock) addToCart(p);
                      else alert(`${p.name} ${t.alert_out_of_stock}`);
                    }}
                    className={`p-3 rounded-xl border transition shadow-sm cursor-pointer select-none ${
                      isOutOfStock
                        ? 'opacity-60 bg-[#FAFAF7] border-[#E7E5E4] cursor-not-allowed'
                        : 'bg-white border-[#E7E5E4] hover:border-[#15803D] hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-[#1C1917] text-xs line-clamp-1">{p.name}</h4>
                    </div>
                    {p.hindi_name ? (
                      <p className="text-[11px] text-[#78716C] mb-2 truncate">{p.hindi_name}</p>
                    ) : (
                      <div className="h-4"></div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#E7E5E4]">
                      <span className="font-extrabold text-[#15803D] text-sm font-mono">
                        ₹{p.selling_price}
                      </span>
                      {isOutOfStock ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          {t.out_of_stock}
                        </span>
                      ) : isLow ? (
                        <span className="bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-[10px] px-1.5 py-0.5 rounded font-bold">
                          {t.low_stock_prefix}{p.current_stock} {p.unit}
                        </span>
                      ) : (
                        <span className="bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {p.current_stock} {p.unit}
                        </span>
                      )}
                    </div>

                    {isLoose && (
                      <div
                        className="flex items-center gap-1 mt-2 pt-2 border-t border-dashed border-[#E7E5E4]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[9px] text-[#78716C] font-bold">Quick:</span>
                        {u === 'kg' || u === 'kilo' || u === 'kilogram' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 0.25);
                              }}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +250g
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 0.5);
                              }}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +500g
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 1);
                              }}
                              className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +1kg
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 0.25);
                              }}
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +250ml
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 0.5);
                              }}
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +500ml
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, 1);
                              }}
                              className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded text-[10px] font-bold transition shadow-xs"
                            >
                              +1L
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: CART & CHECKOUT (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-[#E7E5E4] shadow-sm flex flex-col justify-between">
          <div>
            {/* Customer Bar */}
            <div className="bg-[#FAFAF7] p-3 rounded-lg border border-[#E7E5E4] mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#78716C] uppercase tracking-wider">
                  {t.select_customer}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#1C1917] cursor-pointer flex items-center gap-1.5 bg-[#FEF3C7] text-[#B45309] px-2.5 py-1 rounded-full font-bold border border-[#FDE68A]">
                    <input
                      type="checkbox"
                      checked={isWalkin}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsWalkin(checked);
                        if (checked) {
                          setSelectedCustomer(null);
                          setCustDropdownOpen(false);
                        } else {
                          setCustDropdownOpen(true);
                        }
                      }}
                      className="rounded accent-[#15803D]"
                    />
                    <span>{t.walkin_label}</span>
                  </label>
                </div>
              </div>

              {/* Customer Selector (Hidden if Walk-in) */}
              {!isWalkin && (
                <div className="space-y-2 relative" ref={custDropdownRef}>
                  {!selectedCustomer ? (
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={custSearch}
                            placeholder={t.search_cust_ph}
                            onFocus={() => setCustDropdownOpen(true)}
                            onChange={(e) => setCustSearch(e.target.value)}
                            className="w-full text-xs p-2 pl-7 pr-6 rounded-lg border border-[#E7E5E4] bg-white focus:outline-none focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
                          />
                          <span className="absolute left-2.5 top-2.5 text-[11px] text-[#78716C] pointer-events-none">
                            🔍
                          </span>
                          {custSearch && (
                            <button
                              type="button"
                              onClick={() => setCustSearch('')}
                              className="absolute right-2 top-2 text-[#78716C] hover:text-black text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustDropdownOpen(true)}
                          className="bg-[#1C1917] text-white text-xs px-3 rounded-lg hover:bg-black font-semibold transition shrink-0"
                        >
                          {t.search_btn}
                        </button>
                        <button
                          type="button"
                          onClick={onOpenNewCustomerModal}
                          className="bg-[#15803D] hover:bg-[#166534] text-white text-xs px-3 rounded-lg font-bold transition shrink-0"
                        >
                          {t.new_btn}
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {custDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E7E5E4] rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                          <div className="p-2 border-b border-[#E7E5E4] bg-[#FAFAF7] flex justify-between items-center text-[11px] font-bold text-[#78716C]">
                            <span>{t.cust_dropdown_title}</span>
                            <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#E7E5E4] font-semibold text-[#15803D]">
                              {customerResults.length}
                            </span>
                          </div>
                          <div className="divide-y divide-[#F5F5F4]">
                            {loadingCust ? (
                              <div className="p-3 text-center text-xs text-[#78716C]">
                                ⏳ {lang === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}
                              </div>
                            ) : customerResults.length === 0 ? (
                              <div className="p-4 text-center">
                                <p className="text-xs text-[#78716C] mb-2 font-medium">
                                  {t.no_cust_found}
                                </p>
                                <button
                                  type="button"
                                  onClick={onOpenNewCustomerModal}
                                  className="text-xs bg-[#15803D] hover:bg-[#166534] text-white font-bold py-1.5 px-3 rounded-lg shadow-sm transition"
                                >
                                  {t.add_cust_prompt_btn}
                                </button>
                              </div>
                            ) : (
                              customerResults.map((c) => {
                                const due = parseFloat(c.current_due) || 0;
                                return (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      setSelectedCustomer(c);
                                      setCustDropdownOpen(false);
                                    }}
                                    className="p-2.5 hover:bg-[#F0FDF4] cursor-pointer flex justify-between items-center transition group"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-[#E2E8F0] text-[#334155] flex items-center justify-center font-bold text-xs uppercase group-hover:bg-[#15803D] group-hover:text-white transition shrink-0 shadow-xs">
                                        {(c.name || 'C').trim().charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-bold text-[#1C1917] group-hover:text-[#15803D] text-xs transition">
                                          {c.name}
                                        </div>
                                        <div className="text-[11px] text-[#78716C]">
                                          📞 {c.mobile || t.no_mobile_label}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2 shrink-0">
                                      <div>
                                        <div className="text-[10px] text-[#78716C]">{t.due_label}</div>
                                        <div className="text-xs">
                                          {due > 0 ? (
                                            <span className="text-red-600 font-extrabold">
                                              ₹{due.toFixed(2)}
                                            </span>
                                          ) : (
                                            <span className="text-[#15803D] font-bold">
                                              {t.no_due_badge}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="text-[11px] bg-[#15803D] text-white px-2 py-1 rounded font-bold transition shadow-sm hover:bg-[#166534]"
                                      >
                                        {t.btn_select_cust}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Selected Customer Badge */
                    <div className="bg-[#F0FDF4] border border-[#86EFAC] p-2.5 rounded-lg text-xs flex justify-between items-center transition shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#15803D] text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner shrink-0">
                          {(selectedCustomer.name || 'C').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#14532D] text-sm">
                              {selectedCustomer.name}
                            </span>
                            <span className="text-[10px] bg-[#DCFCE7] text-[#15803D] px-1.5 py-0.2 rounded font-semibold border border-[#BBF7D0]">
                              {t.selected_tag}
                            </span>
                          </div>
                          <span className="text-[#166534] text-[11px]">
                            {selectedCustomer.mobile ? `(${selectedCustomer.mobile})` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[#78716C] text-[10px] block">{t.due_label}</span>
                          <span
                            className={`font-extrabold text-sm ${
                              (selectedCustomer.current_due || 0) > 0 ? 'text-red-600' : 'text-[#15803D]'
                            }`}
                          >
                            ₹{Number(selectedCustomer.current_due || 0).toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="p-1 px-2 rounded-md text-[#78716C] hover:text-red-600 hover:bg-red-50 border border-[#E7E5E4] bg-white font-bold transition text-xs flex items-center gap-1"
                        >
                          <span>✕</span>
                          <span className="text-[10px]">{t.change_cust_btn}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2 text-xs font-bold text-[#78716C] uppercase tracking-wider">
                <span>{t.cart_items_title}</span>
                <span className="bg-[#FAFAF7] text-[#1C1917] px-2 py-0.5 rounded-full border border-[#E7E5E4]">
                  {cart.length} {t.cart_count_suffix}
                </span>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="text-[#A8A29E] text-xs text-center py-8">{t.cart_empty}</p>
                ) : (
                  cart.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FAFAF7] p-2.5 rounded-xl border border-[#E7E5E4] text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1 pr-2">
                          <p className="font-bold text-[#1C1917] line-clamp-1">{it.name}</p>
                          <p className="text-[11px] text-[#78716C] font-mono">
                            ₹{Number(it.selling_price).toFixed(1)} / {it.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 mr-2">
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, -1)}
                            className="w-6 h-6 rounded bg-white border border-[#E7E5E4] font-bold text-[#1C1917] hover:bg-[#FEF3C7] flex items-center justify-center transition shadow-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={it.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setCartQty(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 text-center text-xs py-1 px-1 rounded-lg border border-[#E7E5E4] bg-white font-extrabold text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#15803D] focus:border-[#15803D] shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, 1)}
                            className="w-6 h-6 rounded bg-white border border-[#E7E5E4] font-bold text-[#1C1917] hover:bg-[#FEF3C7] flex items-center justify-center transition shadow-xs"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right min-w-[55px]">
                          <p className="font-extrabold text-[#1C1917] font-mono">
                            ₹{(it.quantity * it.selling_price).toFixed(2)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-[#A8A29E] hover:text-red-600 ml-2 transition"
                          title="Remove"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                      <div className="pt-1.5 border-t border-[#E7E5E4]/80">
                        {renderQuickQtyChips(it, idx)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Totals & Payment Section */}
          <div className="border-t border-[#E7E5E4] pt-3 space-y-3">
            {/* Price Summary */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[#78716C]">
                <span>{t.subtotal}</span>
                <span className="font-semibold text-[#1C1917]">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[#78716C]">
                <span>{t.discount}</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 text-right text-xs p-1 rounded-lg border border-[#E7E5E4] bg-white focus:outline-none focus:border-[#15803D]"
                />
              </div>
              <div className="flex justify-between text-lg font-extrabold text-[#1C1917] pt-1 border-t border-[#E7E5E4]">
                <span>{t.final_due}</span>
                <span className="text-[#15803D]">₹{finalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div>
              <span className="text-xs font-bold text-[#78716C] block mb-1">
                {t.payment_mode_title}
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {['CASH', 'UPI', 'UDHAAR', 'PARTIAL'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`pm-btn py-2 rounded-lg border font-bold transition ${
                      paymentMode === mode
                        ? 'border-[#15803D] bg-[#DCFCE7] text-[#15803D] shadow-sm'
                        : 'border-[#E7E5E4] text-[#78716C] hover:bg-[#FAFAF7]'
                    }`}
                  >
                    {mode === 'CASH' && t.pm_cash}
                    {mode === 'UPI' && t.pm_upi}
                    {mode === 'UDHAAR' && t.pm_udhaar}
                    {mode === 'PARTIAL' && t.pm_partial}
                  </button>
                ))}
              </div>
            </div>

            {/* Change Calculator / Partial Input */}
            {(paymentMode === 'CASH' || paymentMode === 'PARTIAL') && (
              <div className="bg-[#FEF3C7]/60 p-2.5 rounded-lg border border-[#FDE68A] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#92400E]">
                    {paymentMode === 'CASH' ? t.lbl_tendered : t.lbl_paid_now}
                  </span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={paymentMode === 'CASH' ? t.ph_tendered : t.ph_partial}
                    className={`w-28 text-right p-1.5 rounded-lg border text-sm font-bold bg-white focus:outline-none ${
                      partialWarn ? 'border-red-500 bg-red-50' : 'border-[#F59E0B]'
                    }`}
                  />
                </div>

                {paymentMode === 'CASH' && (
                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#FDE68A]">
                    <span className="text-[#78716C]">{t.lbl_change}</span>
                    <span className="text-sm font-extrabold text-[#15803D]">
                      ₹{changeAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                {paymentMode === 'PARTIAL' && (
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-[#FDE68A]">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#78716C]">{t.lbl_due}</span>
                      <span className="text-sm font-bold text-red-600">
                        ₹{partialDue.toFixed(2)}
                      </span>
                    </div>
                    {partialWarn && (
                      <div className="text-[11px] font-bold text-red-600 bg-red-50 p-1.5 rounded border border-red-200">
                        {t.alert_partial_too_high_inline.replace('{final}', finalAmount.toFixed(2))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Confirm & Print Button */}
            <button
              onClick={handleConfirmSale}
              className="w-full bg-[#15803D] hover:bg-[#166534] text-white font-bold py-3 rounded-xl shadow-md text-sm flex items-center justify-center gap-2 transition"
            >
              <i className="fa-solid fa-check"></i> <span>{t.btn_confirm}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

