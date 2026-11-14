import React, { useState, useEffect } from 'react';

export default function StaffModal({ isOpen, onClose, lang, t, currentShop }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('kirana_token');
      const res = await fetch('/api/staff', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff || []);
      } else {
        setErrorMsg(data.detail || data.error || 'Failed to load staff');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStaff();
      setName('');
      setMobile('');
      setPin('');
      setRole('cashier');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !pin.trim()) {
      alert(lang === 'hi' ? 'कृपया सभी जानकारी (नाम, मोबाइल, PIN) भरें।' : 'Please fill all fields (Name, Mobile, PIN).');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('kirana_token');
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          mobile: mobile.trim(),
          pin: pin.trim(),
          role: role
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(lang === 'hi' ? `✅ ${name} को जोड़ दिया गया! अब वे मोबाइल और PIN से लॉगिन कर सकते हैं।` : `✅ ${name} added successfully!`);
        setName('');
        setMobile('');
        setPin('');
        loadStaff();
      } else {
        setErrorMsg(data.detail || data.error || 'Failed to add staff');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (staffId, staffName) => {
    const confirmMsg = lang === 'hi'
      ? `क्या आप सच में '${staffName}' को हटाना चाहते हैं? वे फिर लॉगिन नहीं कर पाएंगे।`
      : `Are you sure you want to remove '${staffName}'?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('kirana_token');
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        loadStaff();
      } else {
        alert(data.detail || 'Failed to deactivate');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E7E5E4] max-h-[90vh] flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#E7E5E4] pb-3">
          <div>
            <h3 className="font-extrabold text-base text-[#1C1917] flex items-center gap-2">
              <i className="fa-solid fa-users-gear text-emerald-700"></i>
              <span>{lang === 'hi' ? 'कर्मचारी प्रबंधन (Staff Management)' : 'Staff Management'}</span>
            </h3>
            <p className="text-xs text-[#78716C]">
              {lang === 'hi'
                ? 'बिल बॉय (Cashier) जोड़ें — वे सिर्फ बिल काट सकते हैं, स्टॉक/रिपोर्ट नहीं देख सकते।'
                : 'Manage cashiers — they can only bill and cannot see stock or reports.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-500 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
              {successMsg}
            </div>
          )}

          {/* Add Staff Form Card */}
          <div className="bg-[#FAFAF7] p-4 rounded-xl border border-[#E7E5E4] space-y-3">
            <h4 className="text-xs font-extrabold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5">
              <i className="fa-solid fa-user-plus text-emerald-700"></i>
              <span>{lang === 'hi' ? 'नया कर्मचारी जोड़ें' : 'Add New Staff'}</span>
            </h4>
            <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#78716C] mb-1">
                  {lang === 'hi' ? 'कर्मचारी का नाम *' : 'Staff Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'hi' ? 'जैसे: रामू, श्याम' : 'e.g. Ramesh'}
                  className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white focus:outline-none focus:border-[#15803D]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#78716C] mb-1">
                  {lang === 'hi' ? 'मोबाइल नंबर (लॉगिन हेतु) *' : 'Mobile (For Login) *'}
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white font-mono focus:outline-none focus:border-[#15803D]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#78716C] mb-1">
                  {lang === 'hi' ? 'लॉगिन PIN (Password) *' : 'Login PIN (Password) *'}
                </label>
                <input
                  type="password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white font-mono focus:outline-none focus:border-[#15803D]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#78716C] mb-1">
                  {lang === 'hi' ? 'भूमिका (Role)' : 'Role'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[#E7E5E4] bg-white font-bold focus:outline-none focus:border-[#15803D]"
                >
                  <option value="cashier">{lang === 'hi' ? 'बिल बॉय (Cashier - सिर्फ बिलिंग)' : 'Cashier (Billing Only)'}</option>
                  <option value="owner">{lang === 'hi' ? 'मालिक (Owner - पूरा एक्सेस)' : 'Owner (Full Access)'}</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>{isSubmitting ? '...' : (lang === 'hi' ? 'कर्मचारी सेव करें' : 'Save Staff')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Current Staff List */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-[#78716C] uppercase tracking-wider flex items-center justify-between">
              <span>{lang === 'hi' ? 'मौजूदा कर्मचारी सूची' : 'Current Staff List'}</span>
              <span className="text-[10px] text-stone-500 font-normal">({staffList.length} staff)</span>
            </h4>

            {loading ? (
              <p className="text-center py-4 text-xs text-[#78716C]">⏳ Loading...</p>
            ) : staffList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[#E7E5E4] text-center text-xs text-[#A8A29E]">
                {lang === 'hi' ? 'अभी कोई कर्मचारी नहीं जोड़ा गया है। ऊपर से बिल बॉय जोड़ें।' : 'No staff added yet. Add a cashier above.'}
              </div>
            ) : (
              <div className="border border-[#E7E5E4] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF7] text-[#78716C] border-b border-[#E7E5E4]">
                    <tr>
                      <th className="py-2 px-3">कर्मचारी</th>
                      <th className="py-2 px-3">मोबाइल</th>
                      <th className="py-2 px-3 text-center">Role</th>
                      <th className="py-2 px-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E5E4]">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-[#FAFAF7] transition">
                        <td className="py-2.5 px-3">
                          <b className="text-[#1C1917] block">{st.name}</b>
                          {!st.is_active && (
                            <span className="text-[9px] text-red-600 font-bold">निष्क्रिय (Inactive)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#78716C]">{st.mobile}</td>
                        <td className="py-2.5 px-3 text-center">
                          {st.role === 'cashier' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              बिल बॉय
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              मालिक
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {st.is_active ? (
                            <button
                              onClick={() => handleDeactivate(st.id, st.name)}
                              title="Deactivate staff"
                              className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-200 transition"
                            >
                              हटाएं
                            </button>
                          ) : (
                            <span className="text-stone-400 text-[10px] font-bold">हटा दिया</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E7E5E4] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#1C1917] rounded-xl text-xs font-bold transition"
          >
            {t.btn_close || 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}

