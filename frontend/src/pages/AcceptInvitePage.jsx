/**
 * تفعيل حساب الموظف — opened from the invitation link HR sends.
 * Shows who the invitation is for, then the employee chooses a password.
 * The link works once and expires after 7 days.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!token) { setError('رابط التفعيل غير مكتمل'); return; }
    axios.get(`${API}/api/auth/portal-invite`, { params: { token } })
      .then((r) => setInfo(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'رابط التفعيل غير صالح أو منتهي'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('كلمة المرور يجب ألا تقل عن 8 أحرف'); return; }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }
    setBusy(true); setError('');
    try {
      const r = await axios.post(`${API}/api/auth/portal-invite/accept`, { token, password });
      setDone(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'تعذّر التفعيل');
    } finally { setBusy(false); }
  };

  const input = 'w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md p-7">
        <h1 className="text-2xl font-extrabold text-slate-900">تفعيل حساب الموظف</h1>

        {done ? (
          <div className="mt-5 space-y-4">
            <p className="text-emerald-700 font-semibold">{done.message}</p>
            <p className="text-sm text-slate-600">اسم الدخول: <span dir="ltr" className="font-mono">{done.email}</span></p>
            <Link to="/login" className="block text-center w-full py-3 rounded-lg bg-[#1e3a8a] text-white font-bold">تسجيل الدخول</Link>
          </div>
        ) : !info ? (
          <p className={`mt-5 text-sm ${error ? 'text-red-700' : 'text-slate-500'}`} role={error ? 'alert' : undefined}>
            {error || 'جارٍ التحقق من الرابط…'}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm space-y-1">
              <p><span className="text-slate-500">الاسم:</span> <b>{info.name}</b></p>
              <p><span className="text-slate-500">الشركة:</span> <b>{info.company}</b></p>
              <p><span className="text-slate-500">اسم الدخول:</span> <span dir="ltr" className="font-mono">{info.email}</span></p>
            </div>
            <label className="block text-sm"><span className="text-slate-700">كلمة المرور (8 أحرف على الأقل)</span>
              <input type="password" autoComplete="new-password" minLength={8} required value={password}
                onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${input}`} /></label>
            <label className="block text-sm"><span className="text-slate-700">تأكيد كلمة المرور</span>
              <input type="password" autoComplete="new-password" minLength={8} required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={`mt-1 ${input}`} /></label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-3 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">
              {busy ? 'جارٍ التفعيل…' : 'تفعيل الحساب'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
