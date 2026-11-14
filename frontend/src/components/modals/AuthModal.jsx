import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'register' | 'password'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields for new shops
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const cleanMob = mobile.trim();
    if (!cleanMob || cleanMob.length < 10) {
      setError('Kripya 10 ankon ka valid mobile number dalein.');
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
      if (!res.ok) throw new Error(data.detail || 'OTP bhejne me problem aayi');

      setSuccessMsg(`OTP safaltapoorvak bhej diya gaya! (Testing OTP: 975677)`);
      setOtp('975677'); // Pre-fill testing OTP for convenience
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), otp: otp.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP galat hai.');

      if (data.is_new_shop) {
        setStep('register');
        setSuccessMsg('Nayi dukaan hai! Kripya apni dukan aur apna naam darj karein.');
      } else {
        localStorage.setItem('kirana_token', data.token);
        localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
        onLoginSuccess(data.shop, data.token);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterShop = async (e) => {
    e.preventDefault();
    setError('');
    if (!shopName.trim() || !ownerName.trim()) {
      setError('Dukaan ka naam aur apna naam bharna zaroori hai.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          password: password.trim() || '1234'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration me problem aayi');

      localStorage.setItem('kirana_token', data.token);
      localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
      localStorage.setItem('kirana_role', data.role || 'owner');
      localStorage.setItem('kirana_staff_name', data.staff_name || '');
      onLoginSuccess(data.shop, data.token, data.role || 'owner', data.staff_name || '');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!mobile.trim() || !password.trim()) {
      setError('Mobile aur password dono bharein.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), password: password.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login fail ho gaya.');

      localStorage.setItem('kirana_token', data.token);
      localStorage.setItem('kirana_shop', JSON.stringify(data.shop));
      localStorage.setItem('kirana_role', data.role || 'owner');
      localStorage.setItem('kirana_staff_name', data.staff_name || '');
      onLoginSuccess(data.shop, data.token, data.role || 'owner', data.staff_name || '');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-lg shadow-emerald-600/30 mb-3">
            <i className="fa-solid fa-shop"></i>
          </div>
          <h2 className="text-xl font-black text-stone-900">
            {step === 'register' ? 'Nayi Dukaan Shuru Karein' : 'दुकानदार लॉगिन (Dukan Login)'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {step === 'register'
              ? 'Apni dukan ka naam dalein taaki bill par print ho sake'
              : 'Mobile number aur OTP se apni dukan ka hisab kholein'}
          </p>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-sm"></i>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-sm text-emerald-600"></i>
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: PHONE NUMBER INPUT */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Mobile Number (मोबाइल नंबर)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-stone-400 font-bold text-sm">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-base font-bold text-stone-800"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Testing OTP: <span className="font-mono font-bold text-emerald-600">975677</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              <span>OTP Bhejo (Get OTP)</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('password')}
                className="text-xs text-stone-500 hover:text-emerald-700 font-medium underline"
              >
                Password se login karna chahte hain?
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP INPUT */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-stone-700">Enter 6-Digit OTP</label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-[11px] text-emerald-700 font-bold hover:underline"
                >
                  Change Mobile
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="975677"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-center tracking-[0.5em] text-xl font-black text-emerald-700 bg-emerald-50/50"
                autoFocus
              />
              <p className="text-[11px] text-stone-500 mt-1 text-center">
                OTP set hai: <strong className="font-mono text-emerald-600">975677</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-shield-halved"></i>}
              <span>OTP Verify & Login</span>
            </button>
          </form>
        )}

        {/* STEP 3: NEW SHOP REGISTRATION */}
        {step === 'register' && (
          <form onSubmit={handleRegisterShop} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Dukaan Ka Naam (Shop Name) *
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Radhe Kirana & General Store"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                autoFocus
                required
              />
              <p className="text-[10px] text-stone-400 mt-0.5">Ye naam grahak ke bill par print hoga</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Dukandar Ka Naam (Owner Name) *
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Dukaan Ka Pata (Address)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Main Market, Near Bus Stand"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Password / PIN (Optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              <span>Dukaan Register Karein & Shuru Karein</span>
            </button>
          </form>
        )}

        {/* STEP 4: PASSWORD LOGIN */}
        {step === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold font-mono"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
              <span>Login</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-xs text-stone-500 hover:text-emerald-700 font-medium underline"
              >
                OTP se login karein (Use Mobile OTP)
              </button>
            </div>
          </form>
        )}

        {/* Close Button if already logged in */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel / Close
          </button>
        </div>
      </div>
    </div>
  );
}

