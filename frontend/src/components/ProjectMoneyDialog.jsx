/**
 * إضافة مصروف أو إيراد للمشروع — نموذج واحد بسيط.
 *
 * The person says what it was (a category, shown with the account it books
 * to), how much, when, and where the money came from / went: the cash box, a
 * specific bank, a partner or the chairman who paid personally, or on credit.
 * The entry the server will post is shown before saving.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, X, TrendingDown, TrendingUp } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export const EXPENSE_CATS = {
  salaries: 'رواتب وأجور', labor: 'أجور عمالة', materials: 'مواد ومستلزمات', software: 'برمجيات وسيرفرات واشتراكات',
  marketing: 'دعاية وإعلان', rent: 'إيجار', utilities: 'كهرباء ومياه وإنترنت', transport: 'نقل ومواصلات',
  equipment: 'معدات وأدوات', subcontractor: 'مقاول من الباطن', administrative: 'مصاريف إدارية', other: 'مصاريف أخرى',
};
export const REVENUE_CATS = {
  payment: 'دفعة من العميل', advance: 'دفعة مقدمة', milestone: 'دفعة مستخلص', final: 'دفعة ختامية',
  retention: 'إفراج عن ضمان', other: 'إيرادات أخرى',
};

export default function ProjectMoneyDialog({ projectId, kind, onClose, onSaved }) {
  const isExp = kind === 'expense';
  const cats = isExp ? EXPENSE_CATS : REVENUE_CATS;
  const [opts, setOpts] = useState(null);
  const [f, setF] = useState({ category: isExp ? 'other' : 'payment', amount: '', date: today(), description: '',
    paid_from: '', party: '', reference_number: '', account_id: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/projects/${projectId}/money-options`, { ...auth(), params: { kind } });
        setOpts(data);
        const firstFunded = (data.sources || []).find((s) => s.balance > 0) || (data.sources || [])[0];
        setF((x) => ({ ...x, paid_from: firstFunded?.id || '' }));
      } catch (e) { setOpts({ sources: [], categories: {}, accounts: [] }); setErr(e?.response?.data?.detail || 'تعذّر تحميل البيانات'); }
    })();
  }, [projectId, kind]);

  const src = (opts?.sources || []).find((s) => s.id === f.paid_from);
  const acc = f.account_id
    ? (opts?.accounts || []).find((a) => a.id === f.account_id)
    : opts?.categories?.[f.category];
  const amount = Number(f.amount);
  const cashShort = isExp && src?.account_code === '161' && amount > (src?.balance || 0);
  const ready = amount > 0 && f.description.trim().length >= 3 && src && acc && !cashShort;

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { category: f.category, amount, date: f.date, description: f.description.trim(), paid_from: f.paid_from,
        reference_number: f.reference_number, account_id: f.account_id || undefined,
        ...(isExp ? { vendor: f.party } : { customer: f.party }) };
      const { data } = await axios.post(`${API}/api/projects/${projectId}/${isExp ? 'expenses' : 'revenues'}`, body, auth());
      onSaved?.(data);
    } catch (e) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === 'string' ? d : 'تعذّر الحفظ');
    } finally { setBusy(false); }
  };

  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white';
  const groups = {};
  (opts?.sources || []).forEach((s) => { (groups[s.group] = groups[s.group] || []).push(s); });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            {isExp ? <TrendingDown className="w-5 h-5 text-rose-600" aria-hidden /> : <TrendingUp className="w-5 h-5 text-emerald-600" aria-hidden />}
            {isExp ? 'إضافة مصروف للمشروع' : 'إضافة إيراد للمشروع'}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {!opts ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="p-5 space-y-3 text-sm">
            <div>
              <span className="text-slate-600">{isExp ? 'نوع المصروف' : 'نوع الإيراد'}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(cats).filter(([k]) => opts.categories[k]).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setF({ ...f, category: k, account_id: '' })}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${f.category === k && !f.account_id
                      ? (isExp ? 'bg-rose-600 border-rose-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white')
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{label}</button>
                ))}
              </div>
              <label className="block mt-2 text-xs text-slate-500">أو اختر الحساب بنفسك:
                <select value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })} className={input}>
                  <option value="">— حسب النوع: {opts.categories[f.category]?.account_code} {opts.categories[f.category]?.account_name}</option>
                  {opts.accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
                </select></label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label><span className="text-slate-600">المبلغ *</span>
                <input type="number" min="0" step="0.01" dir="ltr" autoFocus value={f.amount}
                  onChange={(e) => setF({ ...f, amount: e.target.value })} className={`${input} tabular-nums`} /></label>
              <label><span className="text-slate-600">التاريخ</span>
                <input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
            </div>

            <label className="block"><span className="text-slate-600">البيان *</span>
              <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder={isExp ? 'مثال: رواتب فريق التطوير لشهر أكتوبر' : 'مثال: الدفعة الأولى من العميل'} className={input} /></label>

            <label className="block"><span className="text-slate-600">{isExp ? 'دُفع من *' : 'استُلم في *'}</span>
              <select value={f.paid_from} onChange={(e) => setF({ ...f, paid_from: e.target.value })} className={input}>
                {Object.entries(groups).map(([g, list]) => (
                  <optgroup key={g} label={g}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}{s.balance !== undefined ? ` — الرصيد ${money(s.balance)}` : ''}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {cashShort && <span className="block mt-1 text-xs text-red-700" role="alert">رصيد الخزينة لا يكفي — اختر بنكاً، أو «دفعها رئيس مجلس الإدارة» إن دفعها من ماله.</span>}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label><span className="text-slate-600">{isExp ? 'المورد / المستفيد' : 'العميل'}</span>
                <input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">رقم مرجعي</span>
                <input dir="ltr" value={f.reference_number} onChange={(e) => setF({ ...f, reference_number: e.target.value })} className={input} /></label>
            </div>

            {acc && src && amount > 0 && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs leading-6">
                <p className="font-bold text-slate-700 mb-1">القيد الذي سيُرحَّل:</p>
                {isExp ? (<>
                  <p>من ح/ {acc.account_code} {acc.account_name} — مدين <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
                  <p>إلى ح/ {src.account_code} {src.label} — دائن <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
                </>) : (<>
                  <p>من ح/ {src.account_code} {src.label} — مدين <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
                  <p>إلى ح/ {acc.account_code} {acc.account_name} — دائن <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
                </>)}
              </div>
            )}
          </div>
        )}

        {err && <p className="mx-5 mb-3 text-sm text-red-700" role="alert">{err}</p>}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
          <button onClick={save} disabled={busy || !ready}
            className={`px-5 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 ${isExp ? 'bg-rose-600' : 'bg-emerald-600'}`}>
            {busy ? '…' : 'حفظ وترحيل القيد'}</button>
        </div>
      </div>
    </div>
  );
}
