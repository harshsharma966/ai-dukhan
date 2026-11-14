import React from 'react';

export default function Header({
  activeTab,
  onTabChange,
  lang,
  onToggleLang,
  t,
  currentShop,
  currentRole = 'owner',
  staffName = '',
  onOpenStaffModal,
  onOpenAuth,
  onLogout
}) {
  const isCashier = currentRole === 'cashier';
  return (
    <header className="bg-white border-b border-[#E7E5E4] sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#15803D] text-white w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md">
            <i className="fa-solid fa-shop"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-[#1C1917] leading-tight">
                {currentShop ? currentShop.shop_name : t.app_title}
              </h1>
              <span className="bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#FDE68A] flex items-center gap-1">
                <i className="fa-solid fa-bolt text-[#F59E0B]"></i> <span>{t.app_badge}</span>
              </span>
            </div>
            <p className="text-xs text-[#78716C]">
              {currentShop
                ? `${currentShop.owner_name} • 📞 ${currentShop.mobile}${currentShop.address ? ` • 📍 ${currentShop.address}` : ''}`
                : t.app_subtitle}
            </p>
          </div>
        </div>

        {/* TABS NAVIGATION & ACTIONS */}
        <div className="flex items-center gap-3 flex-wrap">
          <nav className="flex gap-2 sm:gap-4 border-b sm:border-b-0 border-[#E7E5E4] overflow-x-auto text-sm font-medium">
            <button
              onClick={() => onTabChange('billing')}
              className={`px-3 py-2 flex items-center gap-1.5 transition ${
                activeTab === 'billing' ? 'tab-active' : 'text-[#78716C] hover:text-[#15803D]'
              }`}
            >
              <i className="fa-solid fa-cash-register"></i> <span>{t.tab_billing}</span>
            </button>

            {!isCashier && (
              <button
                onClick={() => onTabChange('purchase')}
                className={`px-3 py-2 flex items-center gap-1.5 transition ${
                  activeTab === 'purchase' ? 'tab-active' : 'text-[#78716C] hover:text-[#15803D]'
                }`}
              >
                <i className="fa-solid fa-boxes-stacked"></i> <span>{t.tab_purchase}</span>
              </button>
            )}

            {!isCashier && (
              <button
                onClick={() => onTabChange('khata')}
                className={`px-3 py-2 flex items-center gap-1.5 transition ${
                  activeTab === 'khata' ? 'tab-active' : 'text-[#78716C] hover:text-[#15803D]'
                }`}
              >
                <i className="fa-solid fa-book-bookmark"></i> <span>{t.tab_khata}</span>
              </button>
            )}

            <button
              onClick={() => onTabChange('history')}
              className={`px-3 py-2 flex items-center gap-1.5 transition ${
                activeTab === 'history' ? 'tab-active' : 'text-[#78716C] hover:text-[#15803D]'
              }`}
            >
              <i className="fa-solid fa-receipt"></i> <span>{t.tab_history}</span>
            </button>

            {!isCashier && (
              <button
                onClick={() => onTabChange('report')}
                className={`px-3 py-2 flex items-center gap-1.5 transition ${
                  activeTab === 'report' ? 'tab-active' : 'text-[#78716C] hover:text-[#15803D]'
                }`}
              >
                <i className="fa-solid fa-chart-line"></i> <span>{t.tab_report}</span>
              </button>
            )}
          </nav>

          {/* SHOP / MULTI-TENANT PROFILE BUTTON */}
          {currentShop ? (
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 shadow-sm">
              <div className={`w-7 h-7 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-inner ${
                isCashier ? 'bg-blue-600' : 'bg-emerald-700'
              }`}>
                <i className={`fa-solid ${isCashier ? 'fa-user' : 'fa-store'}`}></i>
              </div>
              <div className="text-left leading-tight hidden md:block">
                <div className="text-xs font-extrabold text-stone-800 truncate max-w-[130px] flex items-center gap-1" title={currentShop.shop_name}>
                  <span>{currentShop.shop_name}</span>
                  {isCashier && (
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-blue-200">
                      बिल बॉय
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-500 truncate max-w-[130px]">
                  {isCashier && staffName ? `कर्मचारी: ${staffName}` : currentShop.owner_name}
                </div>
              </div>

              {!isCashier && (
                <button
                  onClick={onOpenStaffModal}
                  title={lang === 'hi' ? 'कर्मचारी जोड़ें / देखें' : 'Manage Staff'}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-bold bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 transition flex items-center gap-1 shadow-2xs"
                >
                  <i className="fa-solid fa-users"></i>
                  <span>{lang === 'hi' ? 'कर्मचारी' : 'Staff'}</span>
                </button>
              )}

              <button
                onClick={onOpenAuth}
                title="Dukaan Badlein / Switch Shop"
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition"
              >
                <i className="fa-solid fa-arrows-rotate mr-1"></i>
                <span>{lang === 'hi' ? 'दुकान बदलें' : 'Switch'}</span>
              </button>
              <button
                onClick={onLogout}
                title={lang === 'hi' ? 'दुकान से लॉगआउट करें' : 'Logout from store'}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition text-xs font-bold"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>{lang === 'hi' ? 'लॉगआउट' : 'Logout'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 bg-[#15803D] hover:bg-[#166534] text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow transition active:scale-95"
            >
              <i className="fa-solid fa-store"></i>
              <span>{lang === 'hi' ? 'दुकान लॉगिन' : 'Shop Login'}</span>
            </button>
          )}

          {/* DB TABLES VIEWER LINK */}
          <a
            href="http://127.0.0.1:8000/tables"
            target="_blank"
            rel="noopener noreferrer"
            title="View PostgreSQL Tables & Raw Data"
            className="flex items-center gap-1.5 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
          >
            <i className="fa-solid fa-database text-[#15803D]"></i>
            <span>DB Tables</span>
          </a>

          {/* LANGUAGE SWITCH BUTTON */}
          <button
            onClick={onToggleLang}
            title="Click to change language"
            className="flex items-center gap-1.5 bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
          >
            <i className="fa-solid fa-globe text-[#F59E0B]"></i>
            <span>{lang === 'hi' ? 'English' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
