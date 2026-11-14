import React, { useState } from 'react';

export default function AuthPage({ onLoginSuccess, lang, onToggleLang, t }) {
  // Tabs: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState('login');
  
  // Login flow: 'mobile' | 'otp' | 'password'
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' | 'password'
  const [loginStep, setLoginStep] = useState('mobile'); // 'mobile' | 'otp'

  // Input fields
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('975677');
  const [password, setPassword] = useState('');

  // Signup fields
  const [signupShopName, setSignupShopName] = useState('');
  const [signupOwnerName, setSignupOwnerName] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupAddress, setSignupAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [registeredShopInfo, setRegisteredShopInfo] = useState(null);

  const isHindi = lang === 'hi';

  // 1. Send OTP for Login
  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    const cleanMob = mobile.trim();
    if (!cleanMob || cleanMob.length < 10) {
      setError(isHindi ? 'कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMob })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP sending failed');

      if (!data.is_registered) {
        // Mobile is not registered yet!
        setInfoMsg(
          isHindi
            ? `⚠️ यह मोबाइल नंबर (${cleanMob}) अभी रजिस्टर नहीं है। कृपया 'नई दुकान रजिस्टर करें' पर क्लिक करें।`
            : `⚠️ This mobile (${cleanMob}) is not registered yet. Please sign up to create your store.`
        );
        setSignupMobile(cleanMob);
        setLoading(false);
        return;
      }

      setRegisteredShopInfo({
        shop_name: data.shop_name,
        owner_name: data.owner_name
      });
      setOtp('975677'); // Fixed testing OTP pre-filled for convenience
      setLoginStep('otp');
      setInfoMsg(
        isHindi
          ? `नमस्ते ${data.owner_name || 'दुकानदार'} जी! (${data.shop_name}) के लिए OTP भेजा गया है।`
          : `Hello ${data.owner_name || 'Store Owner'}! OTP sent for (${data.shop_name}).`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP for Login
  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    setError('');
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setError(isHindi ? 'कृपया 6 अंकों का OTP दर्ज करें।' : 'Please enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), otp: cleanOtp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');

      if (data.is_new_shop) {
        // Switch to signup with prefilled mobile
        setSignupMobile(mobile.trim());
        setActiveTab('signup');
        setInfoMsg(isHindi ? 'नया खाता है! कृपया अपनी दुकान का नाम दर्ज करें।' : 'New account! Please enter your store details.');
      } else {
        localStorage.setItem('kirana_token', data.token);
        localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
        onLoginSuccess(data.shop, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Password / PIN Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    const cleanMob = mobile.trim();
    if (!cleanMob || cleanMob.length < 10) {
      setError(isHindi ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।' : 'Please enter valid 10-digit mobile.');
      return;
    }
    if (!password) {
      setError(isHindi ? 'कृपया पासवर्ड / PIN दर्ज करें।' : 'Please enter password/PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMob, password: password.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      localStorage.setItem('kirana_token', data.token);
      localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
      localStorage.setItem('kirana_role', data.role || 'owner');
      localStorage.setItem('kirana_staff_name', data.staff_name || '');
      onLoginSuccess(data.shop, data.token, data.role || 'owner', data.staff_name || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Sign Up / Register New Shop
  const handleRegisterShop = async (e) => {
    e.preventDefault();
    setError('');
    if (!signupShopName.trim() || !signupOwnerName.trim() || !signupMobile.trim()) {
      setError(isHindi ? 'दुकान का नाम, आपका नाम और मोबाइल नंबर अनिवार्य हैं।' : 'Store name, owner name, and mobile are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: signupShopName.trim(),
          owner_name: signupOwnerName.trim(),
          mobile: signupMobile.trim(),
          address: signupAddress.trim(),
          password: signupPassword.trim() || '1234'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      localStorage.setItem('kirana_token', data.token);
      localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
      localStorage.setItem('kirana_role', data.role || 'owner');
      localStorage.setItem('kirana_staff_name', data.staff_name || '');
      onLoginSuccess(data.shop, data.token, data.role || 'owner', data.staff_name || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. 1-Click Demo Shop Login (For instant evaluation)
  const handleDemoShopLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Demo login failed');

      localStorage.setItem('kirana_token', data.token);
      localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
      localStorage.setItem('kirana_role', data.role || 'owner');
      localStorage.setItem('kirana_staff_name', data.staff_name || '');
      onLoginSuccess(data.shop, data.token, data.role || 'owner', data.staff_name || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C1917] flex flex-col justify-between selection:bg-emerald-100">
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto w-full px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[#15803D] text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md shadow-emerald-700/20">
            <i className="fa-solid fa-store"></i>
          </div>
          <div>
            <span className="font-black text-lg tracking-tight text-stone-900 block leading-none">
              {isHindi ? 'किराना दुकान AI' : 'Kirana Shop AI'}
            </span>
            <span className="text-[11px] font-medium text-stone-500">
              {isHindi ? 'स्मार्ट बिलिंग, इन्वेंट्री व उधारी खाता' : 'Smart Billing, Stock & Udhaar Khata'}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleLang}
          className="flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition active:scale-95"
        >
          <i className="fa-solid fa-globe text-amber-500"></i>
          <span>{isHindi ? 'English' : 'हिन्दी'}</span>
        </button>
      </header>

      {/* Main Login / Register Card Container */}
      <main className="max-w-md w-full mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200/80">
          
          {/* Header Branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl mb-3 text-2xl border border-emerald-100 shadow-inner">
              <i className="fa-solid fa-shop"></i>
            </div>
            <h1 className="text-2xl font-black text-stone-900">
              {activeTab === 'login'
                ? (isHindi ? 'दुकानदार लॉगिन' : 'Store Login')
                : (isHindi ? 'नई दुकान रजिस्टर करें' : 'Create New Store')}
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
              {activeTab === 'login'
                ? (isHindi ? 'अपने मोबाइल नंबर से लॉगिन करें और अपनी दुकान का हिसाब देखें' : 'Enter mobile number to manage your personal store')
                : (isHindi ? 'अपनी दुकान का नाम जोड़ें और 1 मिनट में बिलिंग शुरू करें' : 'Register your store name & start billing in 1 minute')}
            </p>
          </div>

          {/* Tab Selector: Login vs Sign Up */}
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
                setInfoMsg('');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <i className="fa-solid fa-right-to-bracket text-emerald-600"></i>
              <span>{isHindi ? 'लॉगिन (Login)' : 'Login'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError('');
                setInfoMsg('');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'signup'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <i className="fa-solid fa-plus text-amber-600"></i>
              <span>{isHindi ? 'नई दुकान (Sign Up)' : 'Sign Up'}</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <i className="fa-solid fa-circle-exclamation text-sm text-red-500 mt-0.5"></i>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Info / Success Message */}
          {infoMsg && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <i className="fa-solid fa-circle-info text-sm text-amber-600 mt-0.5"></i>
              <div className="flex-1 font-medium">{infoMsg}</div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: LOGIN FLOW */}
          {/* ======================================================== */}
          {activeTab === 'login' && (
            <div>
              {/* Method Toggle: OTP vs Password */}
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod(prev => (prev === 'otp' ? 'password' : 'otp'));
                    setLoginStep('mobile');
                    setError('');
                  }}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <i className={`fa-solid ${loginMethod === 'otp' ? 'fa-key' : 'fa-mobile-screen-button'}`}></i>
                  <span>
                    {loginMethod === 'otp'
                      ? (isHindi ? 'पासवर्ड / PIN से लॉगिन करें' : 'Login with PIN / Password')
                      : (isHindi ? 'OTP से लॉगिन करें' : 'Login with Mobile OTP')}
                  </span>
                </button>
              </div>

              {/* A. OTP METHOD */}
              {loginMethod === 'otp' && (
                <div>
                  {loginStep === 'mobile' ? (
                    <form onSubmit={handleSendLoginOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {isHindi ? 'मोबाइल नंबर (Mobile Number)' : 'Mobile Number'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-3 text-stone-400 font-bold text-sm">+91</span>
                          <input
                            type="tel"
                            maxLength={10}
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                            placeholder="9876543210"
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-base font-bold text-stone-800 bg-stone-50/50"
                            autoFocus
                            required
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5 text-[11px] text-stone-400">
                          <span>{isHindi ? '10 अंकों का मोबाइल दर्ज करें' : 'Enter 10-digit mobile'}</span>
                          <span className="text-emerald-600 font-medium">OTP: <strong>975677</strong></span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-paper-plane"></i>
                        )}
                        <span>{isHindi ? 'OTP भेजें और लॉगिन करें' : 'Get OTP & Login'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-extrabold text-emerald-950">
                            {registeredShopInfo?.shop_name || (isHindi ? 'किराना स्टोर' : 'Kirana Store')}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-mono">
                            +91 {mobile}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLoginStep('mobile')}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline"
                        >
                          {isHindi ? 'नंबर बदलें' : 'Change'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          {isHindi ? '6 अंकों का OTP दर्ज करें' : 'Enter 6-digit OTP'}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="975677"
                          className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-center tracking-[0.5em] text-2xl font-black text-emerald-700 bg-emerald-50/30"
                          autoFocus
                          required
                        />
                        <p className="text-[11px] text-stone-500 mt-1 text-center">
                          {isHindi ? 'टेस्टिंग OTP:' : 'Testing OTP:'}{' '}
                          <span className="font-mono font-bold text-emerald-600">975677</span>
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-shield-halved"></i>
                        )}
                        <span>{isHindi ? 'सत्यापित करें और दुकान खोलें' : 'Verify & Open Store'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* B. PASSWORD METHOD */}
              {loginMethod === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {isHindi ? 'मोबाइल नंबर' : 'Mobile Number'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-stone-400 font-bold text-sm">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-base font-bold text-stone-800 bg-stone-50/50"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {isHindi ? 'पासवर्ड / PIN' : 'Password / PIN'}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••"
                      className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-base text-stone-800 bg-stone-50/50"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-arrow-right-to-bracket"></i>
                    )}
                    <span>{isHindi ? 'लॉगिन करें (Login)' : 'Login'}</span>
                  </button>
                </form>
              )}

              {/* 1-Click Demo Shop Option */}
              <div className="mt-6 pt-5 border-t border-stone-100 text-center">
                <p className="text-[11px] text-stone-400 mb-2.5">
                  {isHindi ? 'क्या आप तुरंत डेमो देखकर टेस्ट करना चाहते हैं?' : 'Want to quickly test with a sample store?'}
                </p>
                <button
                  type="button"
                  onClick={handleDemoShopLogin}
                  disabled={loading}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 border border-stone-200"
                >
                  <i className="fa-solid fa-bolt text-amber-500"></i>
                  <span>{isHindi ? '⚡ टेस्ट डेमो दुकान खोलें (Demo Kirana Shop)' : '⚡ Open Sample Demo Shop'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: SIGN UP / REGISTER NEW SHOP */}
          {/* ======================================================== */}
          {activeTab === 'signup' && (
            <form onSubmit={handleRegisterShop} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isHindi ? 'दुकान का नाम (Shop Name) *' : 'Store Name *'}
                </label>
                <input
                  type="text"
                  value={signupShopName}
                  onChange={(e) => setSignupShopName(e.target.value)}
                  placeholder={isHindi ? 'उदा. राधे किराना एवं जनरल स्टोर' : 'e.g. Radhe Kirana & General Store'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-stone-800"
                  autoFocus
                  required
                />
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  {isHindi ? 'यह नाम ग्राहक के बिल और रसीद पर प्रिंट होगा' : 'This name prints on receipts & bills'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isHindi ? 'दुकानदार का नाम (Owner Name) *' : 'Owner Name *'}
                </label>
                <input
                  type="text"
                  value={signupOwnerName}
                  onChange={(e) => setSignupOwnerName(e.target.value)}
                  placeholder={isHindi ? 'उदा. राजेश कुमार' : 'e.g. Rajesh Kumar'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isHindi ? 'मोबाइल नंबर (Mobile) *' : 'Mobile Number *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-stone-400 font-bold text-xs">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={signupMobile}
                    onChange={(e) => setSignupMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm font-bold text-stone-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isHindi ? 'दुकान का पता (Address / Market)' : 'Store Address'}
                </label>
                <input
                  type="text"
                  value={signupAddress}
                  onChange={(e) => setSignupAddress(e.target.value)}
                  placeholder={isHindi ? 'उदा. मेन मार्केट, चौक बाज़ार, कानपुर' : 'e.g. Main Market, Kanpur'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isHindi ? 'पासवर्ड / 4-अंकों का PIN (Optional)' : 'Password / PIN'}
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="1234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono text-stone-800"
                />
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  {isHindi ? 'डिफ़ॉल्ट PIN: 1234 (बिना OTP के लॉगिन के लिए)' : 'Default: 1234 (for direct PIN login)'}
                </span>
              </div>

              {/* Automatic Features included */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 text-[11px] text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                  <span>{isHindi ? '5 आवश्यक किराना सामान तुरंत रेडी मिलेंगे' : '5 essential grocery items auto-seeded'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-stone-600">
                  <i className="fa-solid fa-lock text-stone-400"></i>
                  <span>{isHindi ? 'आपकी दुकान का डाटा 100% प्राइवेट और सुरक्षित रहेगा' : 'Your store data is 100% private and isolated'}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#15803D] hover:bg-[#166534] active:scale-95 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-circle-check"></i>
                )}
                <span>{isHindi ? 'दुकान रजिस्टर करें और शुरू करें' : 'Create Store & Start'}</span>
              </button>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-stone-400">
        <p>
          {isHindi ? 'किराना दुकान AI • मेड विथ ❤️ फ़ॉर इंडियन रिटेलर्स' : 'Kirana Shop AI • Made with ❤️ for Indian Retailers'}
        </p>
      </footer>
    </div>
  );
}

