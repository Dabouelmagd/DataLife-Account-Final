/**
 * شاشات مالية كانت موجودة في الخلفية بلا واجهة:
 *   BudgetPage      — الموازنات التقديرية والرقابة (/api/budget)
 *   DeferredTaxPage — ضريبة الدخل الجارية والمؤجلة EAS 24 (/api/deferred-tax)
 *   EquityPage      — رأس المال والاحتياطيات وتوزيع الأرباح (/api/equity)
 * كل قيد يُعرض كما سيرحِّله الخادم (?preview=true) قبل الحفظ — الأرقام
 * المعروضة هي حساب الخادم نفسه وليست تقديراً في المتصفح.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Eye, Trash2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const thisYear = () => new Date().getFullYear();
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50';
const btnPrimary = `${btn} bg-[#28376B] text-white hover:bg-[#1f2b54]`;
const btnGhost = `${btn} border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800`;
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[92vh] overflow-y-auto shadow-xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

/** القيد كما أعاده الخادم: [{account_code, account_name, debit, credit, description}] */
export function JournalPreview({ lines, title = 'القيد الذي سيُرحَّل:' }) {
  if (!lines) return null;
  if (!lines.length) return <p className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs">لا يوجد قيد — لا فرق عن الرصيد المسجَّل.</p>;
  const dr = r2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const cr = r2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs overflow-x-auto">
      <p className="font-bold mb-2">{title}</p>
      <table className="w-full min-w-[420px]">
        <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-start">البيان</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-0.5 whitespace-nowrap"><bdi dir="ltr">{l.account_code}</bdi> {l.account_name}</td>
              <td className="py-0.5 text-slate-500">{l.description}</td>
              <td className="text-end">{l.debit ? <N v={l.debit} /> : ''}</td>
              <td className="text-end">{l.credit ? <N v={l.credit} /> : ''}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-300 font-bold"><td className="pt-1" colSpan={2}>الإجمالي</td><td className="text-end pt-1"><N v={dr} /></td><td className="text-end pt-1"><N v={cr} /></td></tr>
        </tbody>
      </table>
      {Math.abs(dr - cr) > 0.01 && <p className="mt-2 text-red-700">غير متوازن — راجع الأرقام</p>}
    </div>
  );
}

const Err = ({ msg }) => (msg ? <p className="rounded-lg bg-red-50 text-red-800 border border-red-200 p-2 text-sm">{msg}</p> : null);
const Ok = ({ msg }) => (msg ? <p className="rounded-lg bg-green-50 text-green-800 border border-green-200 p-2 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{msg}</p> : null);
const Warns = ({ list }) => (list && list.length ? (
  <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs space-y-1">
    {list.map((w, i) => <p key={i} className="flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" />{w}</p>)}
  </div>) : null);

function Field({ label, children, hint }) {
  return (
    <label className="block text-xs text-slate-600 dark:text-slate-300">
      {label}
      {children}
      {hint && <span className="block mt-0.5 text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${value === id ? 'border-[#28376B] text-[#28376B] dark:text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function YearPicker({ year, setYear }) {
  return (
    <label className="text-xs text-slate-600 flex items-center gap-2">السنة المالية
      <input type="number" className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-900" dir="ltr"
        value={year} onChange={(e) => setYear(Number(e.target.value) || thisYear())} />
    </label>
  );
}

/**
 * نموذج «معاينة ثم ترحيل»: يرسل الطلب نفسه مرتين — أولاً ?preview=true
 * ليعرض قيد الخادم، ثم بدونها للترحيل. أي تعديل في الحقول يُسقط المعاينة.
 */
function usePreviewPost() {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const reset = () => { setPreview(null); setErr(''); setDone(''); };
  const run = async (url, body, isPreview) => {
    setBusy(true); setErr(''); setDone('');
    try {
      const { data } = await axios.post(url, body, { ...auth(), params: isPreview ? { preview: true } : {} });
      if (isPreview) setPreview(data); else { setPreview(null); setDone(data.message || 'تم الترحيل'); }
      return data;
    } catch (e) { setErr(errText(e, 'تعذّر تنفيذ العملية')); return null; } finally { setBusy(false); }
  };
  return { preview, busy, err, done, reset, run };
}

function PreviewPostButtons({ pp, url, body, valid = true, onPosted }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className={btnGhost} disabled={pp.busy || !valid} onClick={() => pp.run(url, body, true)}>
        {pp.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} معاينة القيد
      </button>
      <button className={btnPrimary} disabled={pp.busy || !pp.preview || !valid}
        onClick={async () => { const d = await pp.run(url, body, false); if (d && onPosted) onPosted(d); }}>
        ترحيل القيد
      </button>
    </div>
  );
}

/* ═════════════════════════ الموازنات ═════════════════════════ */

const BUDGET_STATUS = {
  on_track: ['ضمن الحدود', 'bg-green-100 text-green-800'],
  warning: ['تحذير (75%+)', 'bg-amber-100 text-amber-800'],
  critical: ['حرج (90%+)', 'bg-orange-100 text-orange-800'],
  over_budget: ['تجاوز', 'bg-red-100 text-red-800'],
};
const StatusPill = ({ s }) => {
  const [label, cls] = BUDGET_STATUS[s] || [s, 'bg-slate-100 text-slate-700'];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
};

export function BudgetPage() {
  const [year, setYear] = useState(thisYear());
  const [tab, setTab] = useState('lines');
  const [data, setData] = useState(null);
  const [variance, setVariance] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(null);
  const [check, setCheck] = useState({ account_code: '', transaction_amount: '' });
  const [checkRes, setCheckRes] = useState(null);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [l, v, o] = await Promise.all([
        axios.get(`${API}/api/budget/lines`, { ...auth(), params: { fiscal_year: year } }),
        axios.get(`${API}/api/budget/variance-report`, { ...auth(), params: { fiscal_year: year } }),
        axios.get(`${API}/api/budget/override/pending`, auth()),
      ]);
      setData(l.data); setVariance(v.data); setOverrides(o.data.overrides || []);
    } catch (e) { setData({ lines: [], totals: {} }); setErr(errText(e, 'تعذّر تحميل الموازنة')); }
  }, [year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(`${API}/api/accounting/accounts`, auth())
      .then((r) => setAccounts((r.data?.accounts || []).filter((a) => ['expense', 'revenue'].includes(a.account_type))
        .sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)))))
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const { data: d } = await axios.post(`${API}/api/budget/lines`, {
        fiscal_year: year, account_code: form.account_code, allocated_amount: num(form.allocated_amount),
        control_action: form.control_action, notes: form.notes || undefined,
      }, auth());
      setMsg(d.message); setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ سطر الموازنة')); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('حذف سطر الموازنة؟')) return;
    try { await axios.delete(`${API}/api/budget/lines/${id}`, auth()); load(); } catch (e) { setErr(errText(e, 'تعذّر الحذف')); }
  };
  const runCheck = async () => {
    setBusy(true); setErr(''); setCheckRes(null);
    try {
      const { data: d } = await axios.post(`${API}/api/budget/check`, {
        fiscal_year: year, account_code: check.account_code, transaction_amount: num(check.transaction_amount),
        source_document_type: 'manual',
      }, auth());
      setCheckRes(d);
    } catch (e) { setErr(errText(e, 'تعذّر فحص الموازنة')); } finally { setBusy(false); }
  };
  const requestOverride = async () => {
    setBusy(true); setErr('');
    try {
      const { data: d } = await axios.post(`${API}/api/budget/override`, { budget_check_id: checkRes.check_id, justification }, auth());
      setMsg(d.message); setCheckRes(null); setJustification(''); load();
    } catch (e) { setErr(errText(e, 'تعذّر تقديم الطلب')); } finally { setBusy(false); }
  };
  const decide = async (id, decision) => {
    const comment = window.prompt(decision === 'approved' ? 'ملاحظة الاعتماد (اختياري)' : 'سبب الرفض') ?? null;
    if (comment === null) return;
    try {
      const { data: d } = await axios.post(`${API}/api/budget/override/${id}/approve`, { decision, comment }, auth());
      setMsg(d.message); load();
    } catch (e) { setErr(errText(e, 'تعذّر تسجيل القرار')); }
  };

  const t = data?.totals || {};
  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">📊 الموازنات التقديرية</h1>
          <p className="text-sm text-slate-500">الفعلي من دفتر الأستاذ (القيود المرحَّلة فقط) بإشارة طبيعة الحساب — الحساب التجميعي يجمع حساباته الفرعية</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearPicker year={year} setYear={setYear} />
          <button className={btnGhost} onClick={load}><RefreshCw className="w-4 h-4" /> تحديث</button>
          <button className={btnPrimary} onClick={() => { setErr(''); setForm({ account_code: '', allocated_amount: '', control_action: 'warning_only', notes: '' }); }}>
            <Plus className="w-4 h-4" /> سطر موازنة
          </button>
        </div>
      </div>
      <Err msg={err} /><Ok msg={msg} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['المعتمد', t.allocated], ['الفعلي', t.spent], ['المرتبط', t.committed], ['المتاح', t.available]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs text-slate-500">{l}</p><p className="text-lg font-extrabold"><N v={v} /></p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs text-slate-500">نسبة الاستخدام</p><p className="text-lg font-extrabold"><bdi dir="ltr">{(t.utilization || 0).toLocaleString('en-US')}%</bdi></p>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[['lines', 'أسطر الموازنة'], ['variance', 'الموازنة مقابل الفعلي'],
        ['check', 'فحص مصروف قبل تنفيذه'], ['overrides', `طلبات التجاوز (${overrides.length})`]]} />

      {tab === 'lines' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>
              {['الحساب', 'المعتمد', 'الفعلي', 'المرتبط', 'المتاح', '%', 'الرقابة', 'الحالة', ''].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!data ? <tr><td colSpan={9} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                : !data.lines.length ? <tr><td colSpan={9} className="p-6 text-center text-slate-400">لا توجد موازنة لهذه السنة — أضف سطراً</td></tr>
                  : data.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2"><bdi dir="ltr">{l.account_code}</bdi> {l.account_name}{l.is_header && <span className="text-[11px] text-slate-400"> (تجميعي)</span>}</td>
                      <td className="p-2"><N v={l.allocated_amount} /></td>
                      <td className="p-2"><N v={l.actual_spent} /></td>
                      <td className="p-2"><N v={l.committed} /></td>
                      <td className={`p-2 font-bold ${l.available < 0 ? 'text-red-700' : ''}`}><N v={l.available} /></td>
                      <td className="p-2"><bdi dir="ltr">{l.utilization_pct}%</bdi></td>
                      <td className="p-2 text-xs">{l.control_action === 'hard_stop_prevent_entry' ? 'منع' : 'تحذير'}</td>
                      <td className="p-2"><StatusPill s={l.status} /></td>
                      <td className="p-2 whitespace-nowrap">
                        <button className="text-xs text-blue-700 me-2" onClick={() => setForm({ account_code: l.account_code, allocated_amount: l.allocated_amount, control_action: l.control_action, notes: l.notes || '' })}>تعديل</button>
                        <button aria-label="حذف" className="text-red-600" onClick={() => remove(l.id)}><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'variance' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>
              {['الحساب', 'المعتمد', 'المستخدم (فعلي + مرتبط)', 'الانحراف', '%', 'الحالة'].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(variance?.report || []).map((r, i) => (
                <tr key={i}>
                  <td className="p-2"><bdi dir="ltr">{r.account_code}</bdi> {r.account_name}</td>
                  <td className="p-2"><N v={r.allocated} /></td>
                  <td className="p-2"><N v={r.total_utilized} /></td>
                  <td className={`p-2 font-bold ${r.variance < 0 ? 'text-red-700' : 'text-green-700'}`}><N v={r.variance} /></td>
                  <td className="p-2"><bdi dir="ltr">{r.variance_pct}%</bdi></td>
                  <td className="p-2"><StatusPill s={r.status} /></td>
                </tr>
              ))}
              {variance && <tr className="font-bold bg-slate-50 dark:bg-slate-800"><td className="p-2">الإجمالي</td>
                <td className="p-2"><N v={variance.grand_total?.allocated} /></td><td className="p-2"><N v={variance.grand_total?.total_utilized} /></td>
                <td className="p-2"><N v={variance.grand_total?.variance} /></td><td className="p-2"><bdi dir="ltr">{variance.grand_total?.variance_pct}%</bdi></td><td /></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'check' && (
        <div className="max-w-xl space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500">قبل اعتماد مصروف أو أمر شراء: الفعلي + المرتبط + المبلغ الجديد مقابل المعتمد.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الحساب">
              <select className={input} value={check.account_code} onChange={(e) => { setCheck({ ...check, account_code: e.target.value }); setCheckRes(null); }}>
                <option value="">— اختر —</option>
                {accounts.map((a) => <option key={a.id} value={a.account_code}>{a.account_code} — {a.account_name}</option>)}
              </select>
            </Field>
            <Field label="مبلغ العملية"><input type="number" min="0" dir="ltr" className={input} value={check.transaction_amount}
              onChange={(e) => { setCheck({ ...check, transaction_amount: e.target.value }); setCheckRes(null); }} /></Field>
          </div>
          <button className={btnPrimary} disabled={busy || !check.account_code || !num(check.transaction_amount)} onClick={runCheck}>فحص</button>
          {checkRes && (
            <div className={`rounded-lg p-3 text-sm ${checkRes.passed ? 'bg-green-50 text-green-900' : checkRes.allow_proceed ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'}`}>
              <p className="font-bold">{checkRes.message}</p>
              {checkRes.budget_amounts && <p className="text-xs mt-1">المعتمد <N v={checkRes.budget_amounts.allocated} /> · الفعلي <N v={checkRes.budget_amounts.actual_spent} /> · المرتبط <N v={checkRes.budget_amounts.committed} /></p>}
              {checkRes.requires_override && (
                <div className="mt-3 space-y-2">
                  <Field label="مبرر طلب التجاوز (يعتمده مسؤول آخر)"><textarea className={input} rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} /></Field>
                  <button className={btnPrimary} disabled={busy || !justification.trim()} onClick={requestOverride}>تقديم طلب تجاوز</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'overrides' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>
              {['الحساب', 'التجاوز', 'المبرر', 'التاريخ', ''].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!overrides.length ? <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا توجد طلبات معلقة</td></tr>
                : overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="p-2"><bdi dir="ltr">{o.account_code}</bdi></td>
                    <td className="p-2 font-bold text-red-700"><N v={o.excess_amount} /></td>
                    <td className="p-2">{o.justification}</td>
                    <td className="p-2 text-xs"><bdi dir="ltr">{(o.requested_at || '').slice(0, 10)}</bdi></td>
                    <td className="p-2 whitespace-nowrap">
                      <button className="text-xs font-bold text-green-700 me-3" onClick={() => decide(o.id, 'approved')}>اعتماد</button>
                      <button className="text-xs font-bold text-red-700" onClick={() => decide(o.id, 'rejected')}>رفض</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={`سطر موازنة ${year}`} onClose={() => setForm(null)}
          footer={<><button className={btnGhost} onClick={() => setForm(null)}>إلغاء</button>
            <button className={btnPrimary} disabled={busy || !form.account_code || form.allocated_amount === ''} onClick={save}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} حفظ</button></>}>
          <div className="space-y-3">
            <Err msg={err} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الحساب (مصروف أو إيراد)" hint="الحساب التجميعي (مثل 33) يُقارَن بمجموع حساباته الفرعية">
                <select className={input} value={form.account_code} onChange={(e) => setForm({ ...form, account_code: e.target.value })}>
                  <option value="">— اختر —</option>
                  {accounts.map((a) => <option key={a.id} value={a.account_code}>{a.account_code} — {a.account_name}{a.allow_posting === false ? ' (تجميعي)' : ''}</option>)}
                </select>
              </Field>
              <Field label="المبلغ المعتمد للسنة"><input type="number" min="0" dir="ltr" className={input} value={form.allocated_amount} onChange={(e) => setForm({ ...form, allocated_amount: e.target.value })} /></Field>
              <Field label="عند التجاوز">
                <select className={input} value={form.control_action} onChange={(e) => setForm({ ...form, control_action: e.target.value })}>
                  <option value="warning_only">تحذير فقط</option>
                  <option value="hard_stop_prevent_entry">منع — يحتاج اعتماد تجاوز</option>
                </select>
              </Field>
              <Field label="ملاحظات"><input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ الضريبة الجارية والمؤجلة ═════════════════════════ */

const TAX_RATE = 0.225;
const PROVISIONS = [['223', 'مخصص مكافأة نهاية الخدمة'], ['224', 'مخصص خسائر ائتمانية متوقعة'], ['226', 'مخصص هبوط قيمة المخزون'], ['227', 'مخصص قضايا والتزامات محتملة']];
const ASSET_TYPES = { buildings: 'مباني', machinery: 'آلات ومعدات', computers: 'حاسبات', vehicles: 'سيارات', furniture: 'أثاث', intangible: 'أصول معنوية', other: 'أخرى' };

export function DeferredTaxPage() {
  const [year, setYear] = useState(thisYear() - 1);
  const [tab, setTab] = useState('current');
  const pp = usePreviewPost();
  const [cur, setCur] = useState({ accounting_profit: '', add_back_provisions: '', add_back_depreciation: '', tax_depreciation: '',
    add_back_penalties: '', other_add_backs: '', other_deductions: '', prior_year_losses: '', date_str: `${thisYear() - 1}-12-31` });
  const [prov, setProv] = useState(Object.fromEntries(PROVISIONS.map(([c]) => [c, ''])));
  const [dtl, setDtl] = useState({ from_register: true, rows: [] });
  const [pay, setPay] = useState({ amount: '', date: today() });
  const [disc, setDisc] = useState(null);
  const [records, setRecords] = useState([]);
  const yearEnd = `${year}-12-31`;

  const loadDisclosure = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        axios.get(`${API}/api/deferred-tax/disclosure/${year}`, auth()),
        axios.get(`${API}/api/deferred-tax/records/${year}`, auth()),
      ]);
      setDisc(d.data); setRecords(r.data.records || []);
    } catch (e) { setDisc(null); }
  }, [year]);
  useEffect(() => { loadDisclosure(); }, [loadDisclosure]);

  const switchTab = (id) => { setTab(id); pp.reset(); };
  const setC = (k, v) => { setCur({ ...cur, [k]: v }); pp.reset(); };
  const curBody = { fiscal_year: year, ...Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, k === 'date_str' ? v : num(v)])) };
  const dtaBody = { fiscal_year: year, date_str: yearEnd,
    provisions: PROVISIONS.map(([c, n]) => ({ account_code: c, name: n, amount: num(prov[c]) })) };
  const dtlBody = { fiscal_year: year, date_str: yearEnd, from_register: dtl.from_register,
    assets: dtl.from_register ? [] : dtl.rows.map((r) => ({ asset_name: r.asset_name, asset_type: r.asset_type, cost: num(r.cost),
      accumulated_accounting_dep: num(r.acc), accumulated_tax_dep: num(r.tax) })) };
  const p = pp.preview;

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🧾 ضريبة الدخل والضريبة المؤجلة</h1>
          <p className="text-sm text-slate-500">سعر الضريبة على أرباح الشركات <bdi dir="ltr">22.5%</bdi> — المعيار المحاسبي المصري 24</p>
        </div>
        <YearPicker year={year} setYear={(y) => { setYear(y); pp.reset(); setCur((c) => ({ ...c, date_str: `${y}-12-31` })); }} />
      </div>

      <Tabs value={tab} onChange={switchTab} tabs={[['current', 'الضريبة الجارية'], ['dta', 'أصل ضريبي مؤجل (مخصصات)'],
        ['dtl', 'فروق الإهلاك (DTL)'], ['pay', 'سداد الضريبة'], ['disclosure', 'الإفصاح']]} />
      <Err msg={pp.err} /><Ok msg={pp.done} />

      {tab === 'current' && (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500">الوعاء = الربح المحاسبي + الإضافات − الخصومات − خسائر مرحلة. تُسجَّل مرة واحدة للسنة: مدين 3351 مصروف ضريبة الدخل — دائن 265 ضريبة الدخل المستحقة.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[['accounting_profit', 'الربح المحاسبي قبل الضريبة'], ['add_back_provisions', '(+) مخصصات غير معترف بها ضريبياً'],
              ['add_back_depreciation', '(+) الإهلاك المحاسبي'], ['tax_depreciation', '(−) الإهلاك الضريبي'],
              ['add_back_penalties', '(+) غرامات وتبرعات غير مقبولة'], ['other_add_backs', '(+) إضافات أخرى'],
              ['other_deductions', '(−) خصومات أخرى'], ['prior_year_losses', '(−) خسائر سنوات سابقة مرحلة']].map(([k, l]) => (
              <Field key={k} label={l}><input type="number" dir="ltr" className={input} value={cur[k]} onChange={(e) => setC(k, e.target.value)} /></Field>
            ))}
            <Field label="تاريخ القيد"><input type="date" className={input} value={cur.date_str} onChange={(e) => setC('date_str', e.target.value)} /></Field>
          </div>
          {p && <p className="text-sm">الوعاء الضريبي <b><N v={p.taxable_income} /></b> — الضريبة <b><N v={p.current_tax} /></b></p>}
          <JournalPreview lines={p?.lines} />
          <PreviewPostButtons pp={pp} url={`${API}/api/deferred-tax/current-tax`} body={curBody} valid={cur.accounting_profit !== ''} onPosted={loadDisclosure} />
        </div>
      )}

      {tab === 'dta' && (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500">أدخل <b>رصيد</b> كل مخصص في نهاية السنة (وليس تحميل السنة). الأصل الضريبي = الرصيد × <bdi dir="ltr">22.5%</bdi>، ويُرحَّل الفرق فقط عن الرصيد المسجَّل من السنة السابقة.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVISIONS.map(([c, n]) => (
              <Field key={c} label={`${c} — ${n}`} hint={prov[c] ? `أصل ضريبي ${money(num(prov[c]) * TAX_RATE)}` : ''}>
                <input type="number" min="0" dir="ltr" className={input} value={prov[c]} onChange={(e) => { setProv({ ...prov, [c]: e.target.value }); pp.reset(); }} />
              </Field>
            ))}
          </div>
          {p && <p className="text-sm">الرصيد المطلوب <b><N v={p.total_dta} /></b> — المسجَّل <b><N v={p.prior_dta} /></b> — التسوية <b><N v={p.adjustment} /></b></p>}
          <JournalPreview lines={p?.lines} />
          <PreviewPostButtons pp={pp} url={`${API}/api/deferred-tax/deferred-tax-asset`} body={dtaBody} onPosted={loadDisclosure} />
        </div>
      )}

      {tab === 'dtl' && (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500">الفرق المؤقت = مجمع الإهلاك الضريبي − مجمع الإهلاك المحاسبي. موجب ← التزام 2602، سالب ← أصل 139.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dtl.from_register} onChange={(e) => { setDtl({ ...dtl, from_register: e.target.checked }); pp.reset(); }} />
            احسب من سجل الأصول الثابتة (موصى به)
          </label>
          {!dtl.from_register && (
            <div className="space-y-2">
              {dtl.rows.map((r, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                  <Field label="الأصل"><input className={input} value={r.asset_name} onChange={(e) => { const rows = [...dtl.rows]; rows[i] = { ...r, asset_name: e.target.value }; setDtl({ ...dtl, rows }); pp.reset(); }} /></Field>
                  <Field label="النوع"><select className={input} value={r.asset_type} onChange={(e) => { const rows = [...dtl.rows]; rows[i] = { ...r, asset_type: e.target.value }; setDtl({ ...dtl, rows }); pp.reset(); }}>
                    {Object.entries(ASSET_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  {[['cost', 'التكلفة'], ['acc', 'مجمع إهلاك محاسبي'], ['tax', 'مجمع إهلاك ضريبي']].map(([k, l]) => (
                    <Field key={k} label={l}><input type="number" min="0" dir="ltr" className={input} value={r[k]} onChange={(e) => { const rows = [...dtl.rows]; rows[i] = { ...r, [k]: e.target.value }; setDtl({ ...dtl, rows }); pp.reset(); }} /></Field>
                  ))}
                  <button aria-label="حذف" className="text-red-600 mb-2" onClick={() => { setDtl({ ...dtl, rows: dtl.rows.filter((_, j) => j !== i) }); pp.reset(); }}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button className={btnGhost} onClick={() => setDtl({ ...dtl, rows: [...dtl.rows, { asset_name: '', asset_type: 'machinery', cost: '', acc: '', tax: '' }] })}><Plus className="w-4 h-4" /> أصل</button>
            </div>
          )}
          {p?.assets_detail && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="text-slate-500"><tr>{['الأصل', 'إهلاك محاسبي', 'إهلاك ضريبي', 'الفرق المؤقت'].map((h) => <th key={h} className="text-start p-1">{h}</th>)}</tr></thead>
                <tbody>{p.assets_detail.map((a, i) => (<tr key={i}><td className="p-1">{a.asset_name}</td><td className="p-1"><N v={a.accounting_dep} /></td><td className="p-1"><N v={a.tax_dep} /></td><td className="p-1 font-bold"><N v={a.temp_difference} /></td></tr>))}</tbody>
              </table>
              <p className="text-sm mt-2">التزام مؤجل <b><N v={p.dtl} /></b> — أصل مؤجل <b><N v={p.dta} /></b> — المسجَّل سابقاً <N v={p.prior_dtl} /> / <N v={p.prior_dta} /></p>
            </div>
          )}
          <JournalPreview lines={p?.lines} />
          <PreviewPostButtons pp={pp} url={`${API}/api/deferred-tax/deferred-tax-liability`} body={dtlBody}
            valid={dtl.from_register || dtl.rows.length > 0} onPosted={loadDisclosure} />
        </div>
      )}

      {tab === 'pay' && (
        <div className="max-w-xl space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="المبلغ المسدَّد"><input type="number" min="0" dir="ltr" className={input} value={pay.amount} onChange={(e) => { setPay({ ...pay, amount: e.target.value }); pp.reset(); }} /></Field>
            <Field label="تاريخ السداد"><input type="date" className={input} value={pay.date} onChange={(e) => { setPay({ ...pay, date: e.target.value }); pp.reset(); }} /></Field>
          </div>
          <JournalPreview lines={p?.lines} />
          <PreviewPostButtons pp={pp} url={`${API}/api/deferred-tax/pay-tax`} body={{ amount: num(pay.amount), date: pay.date, fiscal_year: year }} valid={num(pay.amount) > 0} />
        </div>
      )}

      {tab === 'disclosure' && (
        <div className="space-y-3">
          {!disc ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-1">
                <p className="font-bold mb-2">مكونات مصروف الضريبة {year}</p>
                <p>الضريبة الجارية: <N v={disc.tax_expense_components.current_tax} /></p>
                <p>حركة الأصل المؤجل (مخصصات): <N v={disc.tax_expense_components.deferred_tax_dta} /></p>
                <p>حركة فروق الإهلاك: <N v={disc.tax_expense_components.deferred_tax_dtl} /></p>
                <p className="font-bold border-t pt-1">الإجمالي: <N v={disc.tax_expense_components.total_tax_expense} /></p>
                <p className="text-xs text-slate-500">السعر الفعلي <bdi dir="ltr">{disc.rate_reconciliation.effective_rate}</bdi> مقابل <bdi dir="ltr">{disc.statutory_rate}</bdi></p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-1">
                <p className="font-bold mb-2">في الميزانية</p>
                <p>أصول ضريبية مؤجلة (139): <N v={disc.balance_sheet.deferred_tax_asset} /></p>
                <p>التزامات ضريبية مؤجلة (2602): <N v={disc.balance_sheet.deferred_tax_liability} /></p>
                <p className="font-bold border-t pt-1">صافي المركز: <N v={disc.balance_sheet.net_deferred_position} /></p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>{['النوع', 'التاريخ', 'المبلغ', 'التسوية المرحَّلة'].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((r) => (
                  <tr key={r.id}><td className="p-2">{{ current_tax: 'ضريبة جارية', dta: 'أصل مؤجل', dtl: 'فروق إهلاك' }[r.type] || r.type}</td>
                    <td className="p-2"><bdi dir="ltr">{r.date}</bdi></td>
                    <td className="p-2"><N v={r.current_tax ?? r.dta_amount ?? r.net_deferred} /></td>
                    <td className="p-2">{r.adjustment !== undefined ? <N v={r.adjustment} /> : '—'}</td></tr>
                ))}
                {!records.length && <tr><td colSpan={4} className="p-4 text-center text-slate-400">لا توجد سجلات لهذه السنة</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════ حقوق الملكية والتوزيعات ═════════════════════════ */

const DIV_STATUS = { declared: 'مُقرَّة', partially_paid: 'مصروفة جزئياً', paid: 'مصروفة' };

export function EquityPage() {
  const [year, setYear] = useState(thisYear() - 1);
  const [tab, setTab] = useState('statement');
  const pp = usePreviewPost();
  const [stmt, setStmt] = useState(null);
  const [divs, setDivs] = useState([]);
  const [cap, setCap] = useState({ amount: '', method: 'bank', date_str: today() });
  const [legal, setLegal] = useState({ net_profit: '', issued_capital: '', rate: 5, cap: 50, date_str: `${thisYear() - 1}-12-31` });
  const [gen, setGen] = useState({ amount: '', date_str: `${thisYear() - 1}-12-31` });
  const [dv, setDv] = useState({ gross_dividend: '', employees_share: '', board_remuneration: '', is_listed: false, declaration_date: today(), payment_method: 'bank' });
  const [payFor, setPayFor] = useState(null);
  const [payOpts, setPayOpts] = useState({ date: today(), pay_shareholders: true, pay_tax: true, pay_employees: true, pay_board: true });
  const payPP = usePreviewPost();
  // each form has its own preview: one shared preview let "post" on one form
  // send the other form's previewed entry
  const legalPP = usePreviewPost();
  const genPP = usePreviewPost();

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        axios.get(`${API}/api/equity/statement/${year}`, auth()),
        axios.get(`${API}/api/equity/history`, { ...auth(), params: { tx_type: 'dividend_declaration' } }),
      ]);
      setStmt(s.data); setDivs(h.data.transactions || []);
    } catch (e) { setStmt(null); }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const switchTab = (id) => { setTab(id); pp.reset(); legalPP.reset(); genPP.reset(); };
  const p = pp.preview;
  const upd = (setter, obj, hook) => (k, v) => { setter({ ...obj, [k]: v }); hook.reset(); };
  const setCapF = upd(setCap, cap, pp); const setLegalF = upd(setLegal, legal, legalPP);
  const setGenF = upd(setGen, gen, genPP); const setDvF = upd(setDv, dv, pp);
  const lp = legalPP.preview;

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">🏛️ حقوق الملكية وتوزيع الأرباح</h1>
          <p className="text-sm text-slate-500">قانون الشركات 159/1981 — الاحتياطي القانوني وحصة العاملين ومكافآت المجلس وضريبة التوزيعات</p>
        </div>
        <YearPicker year={year} setYear={setYear} />
      </div>
      <Tabs value={tab} onChange={switchTab} tabs={[['statement', 'قائمة التغيرات'], ['capital', 'رأس المال'],
        ['reserves', 'الاحتياطيات'], ['dividends', 'توزيع الأرباح']]} />
      <Err msg={pp.err} /><Ok msg={pp.done} />

      {tab === 'statement' && (
        !stmt ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>{['البند', 'أول المدة', 'الحركة', 'آخر المدة'].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stmt.rows.map((r) => (
                    <tr key={r.component} className={r.is_total ? 'font-extrabold bg-slate-50 dark:bg-slate-800' : ''}>
                      <td className="p-2">{r.component}</td><td className="p-2"><N v={r.opening} /></td><td className="p-2"><N v={r.movement} /></td><td className="p-2"><N v={r.closing} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`rounded-lg p-3 text-sm ${stmt.legal_reserve_status.reached_cap ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
              {stmt.legal_reserve_status.note} — الحد الأقصى <N v={stmt.legal_reserve_status.cap_amount} />، المتبقي <N v={stmt.legal_reserve_status.remaining_to_cap} />
            </div>
          </div>
        )
      )}

      {tab === 'capital' && (
        <div className="max-w-xl space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500">سداد أو زيادة رأس المال المدفوع: مدين البنك/الخزينة/جاري الشركاء — دائن 211.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="المبلغ"><input type="number" min="0" dir="ltr" className={input} value={cap.amount} onChange={(e) => setCapF('amount', e.target.value)} /></Field>
            <Field label="طريقة السداد"><select className={input} value={cap.method} onChange={(e) => setCapF('method', e.target.value)}>
              <option value="bank">تحويل بنكي</option><option value="cash">نقداً</option><option value="partners_account">من جاري الشركاء</option></select></Field>
            <Field label="التاريخ"><input type="date" className={input} value={cap.date_str} onChange={(e) => setCapF('date_str', e.target.value)} /></Field>
          </div>
          <JournalPreview lines={p?.lines} />
          <PreviewPostButtons pp={pp} url={`${API}/api/equity/capital`} body={{ amount: num(cap.amount), method: cap.method, date_str: cap.date_str }} valid={num(cap.amount) > 0} onPosted={load} />
        </div>
      )}

      {tab === 'reserves' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold">الاحتياطي القانوني — سنة {year}</h3>
            <p className="text-xs text-slate-500">نسبة من صافي الربح حتى يبلغ الاحتياطي نسبة من رأس المال المصدر (القانون: 5% حتى 50%؛ النظام الأساسي قد يحدد أكثر).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="صافي ربح السنة"><input type="number" min="0" dir="ltr" className={input} value={legal.net_profit} onChange={(e) => setLegalF('net_profit', e.target.value)} /></Field>
              <Field label="رأس المال المصدر" hint="اتركه فارغاً لاستخدام رصيد 211"><input type="number" min="0" dir="ltr" className={input} value={legal.issued_capital} onChange={(e) => setLegalF('issued_capital', e.target.value)} /></Field>
              <Field label="نسبة التجنيب %"><input type="number" min="0" max="100" dir="ltr" className={input} value={legal.rate} onChange={(e) => setLegalF('rate', e.target.value)} /></Field>
              <Field label="الحد الأقصى % من رأس المال"><input type="number" min="0" max="100" dir="ltr" className={input} value={legal.cap} onChange={(e) => setLegalF('cap', e.target.value)} /></Field>
              <Field label="التاريخ"><input type="date" className={input} value={legal.date_str} onChange={(e) => setLegalF('date_str', e.target.value)} /></Field>
            </div>
            {lp?.reserve_cap !== undefined && <p className="text-sm">المطلوب <N v={lp.required} /> — يُجنَّب <b><N v={lp.actual} /></b> (الرصيد الحالي <N v={lp.reserve_before} /> من حد <N v={lp.reserve_cap} />)</p>}
            {lp && <JournalPreview lines={lp.lines || []} />}
            <Err msg={legalPP.err} /><Ok msg={legalPP.done} />
            <PreviewPostButtons pp={legalPP} url={`${API}/api/equity/legal-reserve`} valid={num(legal.net_profit) > 0}
              body={{ fiscal_year: year, net_profit: num(legal.net_profit), issued_capital: legal.issued_capital === '' ? undefined : num(legal.issued_capital),
                reserve_rate: num(legal.rate) / 100, reserve_cap_rate: num(legal.cap) / 100, date_str: legal.date_str }} onPosted={load} />
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold">الاحتياطي العام (بقرار الجمعية/المجلس)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="المبلغ"><input type="number" min="0" dir="ltr" className={input} value={gen.amount} onChange={(e) => setGenF('amount', e.target.value)} /></Field>
              <Field label="التاريخ"><input type="date" className={input} value={gen.date_str} onChange={(e) => setGenF('date_str', e.target.value)} /></Field>
            </div>
            <JournalPreview lines={genPP.preview?.lines} />
            <Err msg={genPP.err} /><Ok msg={genPP.done} />
            <PreviewPostButtons pp={genPP} url={`${API}/api/equity/general-reserve`} valid={num(gen.amount) > 0}
              body={{ fiscal_year: year, amount: num(gen.amount), date_str: gen.date_str }} onPosted={load} />
          </div>
        </div>
      )}

      {tab === 'dividends' && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold">إقرار توزيع أرباح سنة {year}</h3>
            <p className="text-xs text-slate-500">من الأرباح المرحلة (213): حصة العاملين (267) ومكافآت المجلس (268) تُخصم أولاً، والباقي للمساهمين تُستقطع منه ضريبة التوزيعات (10% أو 5% للمقيدة بالبورصة).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="إجمالي المبلغ المقرر توزيعه"><input type="number" min="0" dir="ltr" className={input} value={dv.gross_dividend} onChange={(e) => setDvF('gross_dividend', e.target.value)} /></Field>
              <Field label="حصة العاملين في الأرباح" hint="القانون: 10% على الأقل من الموزَّع، بحد أقصى مجموع الأجور السنوية"><input type="number" min="0" dir="ltr" className={input} value={dv.employees_share} onChange={(e) => setDvF('employees_share', e.target.value)} /></Field>
              <Field label="مكافآت أعضاء مجلس الإدارة"><input type="number" min="0" dir="ltr" className={input} value={dv.board_remuneration} onChange={(e) => setDvF('board_remuneration', e.target.value)} /></Field>
              <Field label="تاريخ قرار الجمعية"><input type="date" className={input} value={dv.declaration_date} onChange={(e) => setDvF('declaration_date', e.target.value)} /></Field>
              <Field label="طريقة الصرف للمساهمين"><select className={input} value={dv.payment_method} onChange={(e) => setDvF('payment_method', e.target.value)}>
                <option value="bank">تحويل بنكي</option><option value="partners_account">إلى جاري الشركاء</option></select></Field>
              <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={dv.is_listed} onChange={(e) => setDvF('is_listed', e.target.checked)} /> شركة مقيدة بالبورصة (ضريبة 5%)</label>
            </div>
            {p?.calculation && (
              <p className="text-sm">للمساهمين <N v={p.calculation.shareholders_share} /> — ضريبة <N v={p.calculation.tax_amount} /> — صافي يُصرف <b><N v={p.calculation.net_to_shareholders} /></b></p>
            )}
            <Warns list={p?.warnings} />
            {p?.calculation && <JournalPreview lines={p.lines} />}
            <PreviewPostButtons pp={pp} url={`${API}/api/equity/dividends/declare`} valid={num(dv.gross_dividend) > 0}
              body={{ fiscal_year: year, gross_dividend: num(dv.gross_dividend), employees_share: num(dv.employees_share),
                board_remuneration: num(dv.board_remuneration), is_listed: dv.is_listed, declaration_date: dv.declaration_date, payment_method: dv.payment_method }}
              onPosted={load} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500"><tr>
                {['السنة', 'الإجمالي', 'العاملون', 'المجلس', 'الضريبة', 'صافي المساهمين', 'الحالة', ''].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {!divs.length ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">لا توجد توزيعات مسجلة</td></tr>
                  : divs.map((d) => (
                    <tr key={d.id}>
                      <td className="p-2"><bdi dir="ltr">{d.fiscal_year}</bdi></td>
                      <td className="p-2"><N v={d.gross_dividend} /></td><td className="p-2"><N v={d.employees_share} /></td>
                      <td className="p-2"><N v={d.board_remuneration} /></td><td className="p-2"><N v={d.tax_amount} /></td>
                      <td className="p-2 font-bold"><N v={d.net_dividend} /></td>
                      <td className="p-2 text-xs">{DIV_STATUS[d.status] || d.status}</td>
                      <td className="p-2">{d.status !== 'paid' && <button className="text-xs font-bold text-blue-700" onClick={() => { setPayFor(d); payPP.reset(); }}>صرف</button>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payFor && (
        <Modal title={`صرف توزيعات ${payFor.fiscal_year}`} onClose={() => setPayFor(null)}
          footer={<><button className={btnGhost} onClick={() => setPayFor(null)}>إغلاق</button>
            <PreviewPostButtons pp={payPP} url={`${API}/api/equity/dividends/${payFor.id}/pay`} body={payOpts}
              onPosted={() => { setPayFor(null); load(); }} /></>}>
          <div className="space-y-3">
            <Err msg={payPP.err} />
            {[['pay_shareholders', 'shareholders', 'صافي المساهمين', payFor.net_dividend], ['pay_tax', 'tax', 'ضريبة التوزيعات لمصلحة الضرائب', payFor.tax_amount],
              ['pay_employees', 'employees', 'حصة العاملين', payFor.employees_share], ['pay_board', 'board', 'مكافآت المجلس', payFor.board_remuneration]].map(([k, part, l, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!v || payFor.paid_parts?.[part]} checked={!!payOpts[k] && !!v && !payFor.paid_parts?.[part]}
                  onChange={(e) => { setPayOpts({ ...payOpts, [k]: e.target.checked }); payPP.reset(); }} />
                {l} — <N v={v} /> {payFor.paid_parts?.[part] && <span className="text-xs text-green-700">(مصروف)</span>}
              </label>
            ))}
            <Field label="تاريخ الصرف"><input type="date" className={input} value={payOpts.date} onChange={(e) => { setPayOpts({ ...payOpts, date: e.target.value }); payPP.reset(); }} /></Field>
            <JournalPreview lines={payPP.preview?.lines} />
          </div>
        </Modal>
      )}
    </div>
  );
}
