/**
 * تبويب الأمان — two-step verification for the signed-in user, and (for
 * company managers) the inventory method.
 *
 * Enabling two-step asks for the password and then a code sent by email, so
 * nobody can switch on a second factor they would never receive and lock
 * themselves out.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShieldCheck, Loader2, KeyRound, AlertTriangle, Package } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function SecurityTab({ language = 'ar', canManageCompany = false }) {
  const ar = language === 'ar';
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState('idle');        // idle | password | code
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [method, setMethod] = useState(null);
  const [methodBusy, setMethodBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/auth/2fa/status`, auth());
      setStatus(data);
    } catch { setStatus({ two_factor_enabled: false }); }
    if (canManageCompany) {
      try {
        const { data } = await axios.get(`${API}/api/companies/current`, auth());
        setMethod(data?.inventory_method === 'perpetual' ? 'perpetual' : 'periodic');
      } catch { /* the setting simply stays hidden if the company cannot be read */ }
    }
  }, [canManageCompany]);
  useEffect(() => { load(); }, [load]);

  const startEnable = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/auth/2fa/enable`, { password }, auth());
      setChallengeId(data.challenge_id); setStep('code'); setCode('');
      setMsg({ type: 'ok', text: data.message });
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر البدء' : 'Could not start') });
    } finally { setBusy(false); }
  };

  const finishEnable = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/auth/2fa/enable`,
        { password, code: code.trim(), challenge_id: challengeId }, auth());
      setMsg({ type: 'ok', text: data.message });
      setStep('idle'); setPassword(''); setCode(''); load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'رمز غير صحيح' : 'Invalid code') });
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/auth/2fa/disable`, { password }, auth());
      setMsg({ type: 'ok', text: data.message });
      setStep('idle'); setPassword(''); load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر الإلغاء' : 'Could not disable') });
    } finally { setBusy(false); }
  };

  const saveMethod = async (value) => {
    setMethodBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.put(`${API}/api/companies/inventory-method`, { inventory_method: value }, auth());
      setMethod(value);
      setMsg({ type: 'ok', text: ar ? 'تم حفظ طريقة الجرد' : 'Inventory method saved' });
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر الحفظ' : 'Could not save') });
    } finally { setMethodBusy(false); }
  };

  const card = 'bg-white rounded-2xl border border-slate-200 p-5';
  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';
  const enabled = status?.two_factor_enabled;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4 text-slate-800">
      {/* two-step verification */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-extrabold flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${enabled ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden />
              {ar ? 'التحقق بخطوتين' : 'Two-step verification'}
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              {ar ? 'بعد كلمة المرور يُطلب رمز من 6 أرقام يصل إلى بريدك. لو عرف أحد كلمة مرورك، لن يستطيع الدخول بدونه.'
                  : 'After your password, a 6-digit code is sent to your email. A stolen password alone is not enough.'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {enabled ? (ar ? 'مفعّل' : 'On') : (ar ? 'غير مفعّل' : 'Off')}
          </span>
        </div>

        {status?.enforced && !enabled && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            {ar ? 'هذا الحساب يتحكم في كل الشركات، والتحقق بخطوتين مطلوب عليه — سيُطلب الرمز عند كل تسجيل دخول.'
                : 'This account controls every company; two-step is required and will be asked at each sign-in.'}
          </p>
        )}

        {step === 'idle' ? (
          <button onClick={() => { setStep('password'); setMsg({ type: '', text: '' }); }}
            className={`mt-4 px-4 py-2 rounded-lg font-semibold ${enabled ? 'border border-red-300 text-red-700' : 'bg-[#1e3a8a] text-white'}`}>
            {enabled ? (ar ? 'إلغاء التفعيل' : 'Turn off') : (ar ? 'تفعيل' : 'Turn on')}
          </button>
        ) : (
          <div className="mt-4 max-w-sm space-y-3 text-sm">
            <label className="block"><span className="text-slate-600">{ar ? 'كلمة المرور الحالية' : 'Current password'}</span>
              <input type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} className={input} /></label>

            {step === 'code' && (
              <label className="block"><span className="text-slate-600">{ar ? 'الرمز المُرسل إلى بريدك' : 'Code sent to your email'}</span>
                <input inputMode="numeric" maxLength={6} dir="ltr" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${input} text-center text-xl tracking-[0.4em] font-mono`} placeholder="••••••" /></label>
            )}

            <div className="flex gap-2">
              {enabled ? (
                <button onClick={disable} disabled={busy || !password}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white font-bold disabled:opacity-50">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}{ar ? 'تأكيد الإلغاء' : 'Confirm off'}
                </button>
              ) : step === 'password' ? (
                <button onClick={startEnable} disabled={busy || !password}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <KeyRound className="w-4 h-4" aria-hidden />}
                  {ar ? 'أرسل الرمز' : 'Send code'}
                </button>
              ) : (
                <button onClick={finishEnable} disabled={busy || code.length < 6}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}{ar ? 'تأكيد التفعيل' : 'Confirm on'}
                </button>
              )}
              <button onClick={() => { setStep('idle'); setPassword(''); setCode(''); setMsg({ type: '', text: '' }); }}
                className="px-4 py-2 rounded-lg border border-slate-300">{ar ? 'إلغاء' : 'Cancel'}</button>
            </div>
          </div>
        )}

        {msg.text && (
          <p className={`mt-3 text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>
        )}
      </section>

      {/* inventory method — company managers only */}
      {canManageCompany && method && (
        <section className={card}>
          <h3 className="font-extrabold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1e3a8a]" aria-hidden />{ar ? 'طريقة الجرد' : 'Inventory method'}
          </h3>
          <p className="mt-1 text-sm text-slate-600 max-w-xl">
            {ar ? 'الطريقتان مقبولتان محاسبياً، والفرق في توقيت تحميل التكلفة لا في مقدارها.'
                : 'Both are accepted; they differ in when cost is recognised, not how much.'}
          </p>
          <div className="mt-3 space-y-2">
            {[['periodic', ar ? 'الجرد الدوري' : 'Periodic',
               ar ? 'المشتريات مصروف، وتكلفة المبيعات تظهر عند إقفال الفترة بعد الجرد.'
                  : 'Purchases are an expense; cost of sales appears at the period-end count.'],
              ['perpetual', ar ? 'الجرد المستمر' : 'Perpetual',
               ar ? 'المشتريات تدخل المخزون كأصل، وكل فاتورة بيع تُرحّل تكلفتها بمتوسط التكلفة المتحرك.'
                  : 'Purchases capitalise into stock; each sale posts its cost at moving average.']].map(([v, title, desc]) => (
              <label key={v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${method === v ? 'border-[#1e3a8a] bg-[#1e3a8a]/5' : 'border-slate-200'}`}>
                <input type="radio" name="inv-method" checked={method === v} disabled={methodBusy}
                  onChange={() => saveMethod(v)} className="mt-1" />
                <span>
                  <span className="font-semibold block">{title}</span>
                  <span className="text-xs text-slate-600">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-800">
            {ar ? 'غيّر الطريقة في بداية فترة محاسبية فقط — تغييرها وسط الفترة يخلط أساسي تحميل التكلفة.'
                : 'Change only at the start of a period; switching mid-period mixes two cost bases.'}
          </p>
        </section>
      )}
    </div>
  );
}
