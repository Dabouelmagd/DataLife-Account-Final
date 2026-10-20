/**
 * شاشات كانت موجودة في الخلفية بلا واجهة:
 *   ProgressClaimsPage — مستخلصات المالك ومقاولي الباطن (/api/enterprise/…-claims)
 *   GuaranteesPage     — خطابات الضمان: إصدار واسترداد (/api/trade-finance/letters-of-guarantee)
 *   TaxFormsPage       — نموذج 10 (القيمة المضافة) ونموذج 41 (الخصم والتحصيل) (/api/tax-reports)
 * Every amount the server will post is previewed before saving; the server
 * recomputes it and refuses an unbalanced or out-of-law entry.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Printer } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

function Lines({ rows }) {
  const dr = r2(rows.reduce((s, r) => s + (r[1] || 0), 0));
  const cr = r2(rows.reduce((s, r) => s + (r[2] || 0), 0));
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs">
      <p className="font-bold mb-2">القيد الذي سيُرحَّل:</p>
      <table className="w-full">
        <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
        <tbody>
          {rows.filter((r) => r[1] || r[2]).map((r) => (
            <tr key={r[0]}><td className="py-0.5">{r[0]}</td>
              <td className="text-end">{r[1] ? <N v={r[1]} /> : ''}</td><td className="text-end">{r[2] ? <N v={r[2]} /> : ''}</td></tr>
          ))}
          <tr className="border-t border-slate-300 font-bold"><td className="pt-1">الإجمالي</td><td className="text-end pt-1"><N v={dr} /></td><td className="text-end pt-1"><N v={cr} /></td></tr>
        </tbody>
      </table>
      {Math.abs(dr - cr) > 0.01 && <p className="mt-2 text-red-700">غير متوازن — راجع الأرقام</p>}
    </div>
  );
}

/* ═════════════════════════ المستخلصات ═════════════════════════ */

const WHT = { contracts: ['مقاولات وتوريدات', 1], services: ['خدمات', 3], professional: ['مهن حرة', 5], none: ['لا يوجد', 0] };
const VAT = [[5, '5% مقاولات'], [14, '14% سعر عام'], [0, 'معفى / 0%']];

export function ProgressClaimsPage() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('owner');
  const [projects, setProjects] = useState([]);
  const [parties, setParties] = useState({ customer: [], supplier: [] });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/api/enterprise/progress-claims`, auth());
      setRows(data.claims || []);
    } catch (e) { setRows([]); setErr(errText(e, 'تعذّر تحميل المستخلصات')); }
  };
  useEffect(() => {
    load();
    axios.get(`${API}/api/tasks/projects`, auth()).then((r) => setProjects(Array.isArray(r.data) ? r.data : (r.data?.projects || []))).catch(() => {});
    Promise.all(['customer', 'supplier'].map((t) => axios.get(`${API}/api/invoice/parties`, { ...auth(), params: { party_type: t } })
      .then((r) => r.data?.parties || []).catch(() => [])))
      .then(([customer, supplier]) => setParties({ customer, supplier }));
  }, []);

  const open = () => {
    setErr('');
    setForm({ claim_number: (rows || []).filter((r) => r.claim_type === tab).length + 1, claim_date: today(), project_id: '',
      partner_id: '', partner_name: '', gross_amount: '', previous_claims: '', retention_percentage: tab === 'owner' ? 10 : 5,
      advance: '', vat_rate: 5, wht_type: 'contracts' });
  };

  const calc = useMemo(() => {
    if (!form) return null;
    const current = r2((+form.gross_amount || 0) - (+form.previous_claims || 0));
    const ret = r2(current * (+form.retention_percentage || 0) / 100);
    const adv = r2(+form.advance || 0);
    const vat = r2(current * (+form.vat_rate || 0) / 100);
    const wht = r2(current * WHT[form.wht_type][1] / 100);
    const net = r2(current - ret - adv - wht);
    return { current, ret, adv, vat, wht, net, total: r2(net + vat) };
  }, [form]);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { claim_number: form.claim_number, claim_date: form.claim_date, project_id: form.project_id || undefined,
        partner_id: form.partner_id || undefined, partner_name: form.partner_name, gross_amount: +form.gross_amount,
        previous_claims: +form.previous_claims || 0, retention_percentage: +form.retention_percentage || 0,
        vat_rate: +form.vat_rate, wht_type: form.wht_type };
      if (tab === 'owner') await axios.post(`${API}/api/enterprise/progress-claims`, { ...body, claim_type: 'owner', advance_payment_deducted: +form.advance || 0 }, auth());
      else await axios.post(`${API}/api/enterprise/subcontractor-claims`, { ...body, advance_recovery: +form.advance || 0 }, auth());
      setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ المستخلص')); } finally { setBusy(false); }
  };

  const list = (rows || []).filter((r) => (r.claim_type || 'owner') === tab);
  const partyList = tab === 'owner' ? parties.customer : parties.supplier;
  const projName = (id) => projects.find((p) => p.id === id)?.name || '';
  const owner = tab === 'owner';
  const preview = calc && (owner ? [
    ['131 العملاء — صافي المستخلص + الضريبة', calc.total, 0],
    ['141 ضمان محتجز لدى العميل', calc.ret, 0],
    ['138 خصم وتحصيل محتجز لدى العميل', calc.wht, 0],
    ['257 دفعات مقدمة مستلمة (استهلاك)', calc.adv, 0],
    ['414 إيرادات مقاولات', 0, calc.current],
    ['260 ضريبة القيمة المضافة', 0, calc.vat],
  ] : [
    ['315 تكلفة مقاولي الباطن', calc.current, 0],
    ['137 ضريبة المدخلات', calc.vat, 0],
    ['243/251 مستحق لمقاول الباطن', 0, calc.total],
    ['261 خصم وتحصيل مستحق للمصلحة', 0, calc.wht],
    ['263 ضمان محتجز لمقاول الباطن', 0, calc.ret],
    ['1351 استرداد دفعة مقدمة', 0, calc.adv],
  ]);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">المستخلصات</h1>
          <p className="text-sm text-slate-500">مستخلصات المالك ومقاولي الباطن — يُرحَّل قيد كل مستخلص فور حفظه (المعيار المصري 8).</p>
        </div>
        <button onClick={open} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">
          <Plus className="w-4 h-4" aria-hidden /> {owner ? 'مستخلص للمالك' : 'مستخلص مقاول باطن'}</button>
      </div>
      <div className="flex gap-2" role="tablist">
        {[['owner', 'مستخلصات المالك (إيراد)'], ['subcontractor', 'مقاولو الباطن (تكلفة)']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border ${tab === k ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300'}`}>{l}</button>
        ))}
      </div>

      {rows === null ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        : list.length === 0 ? <p className="text-center py-16 text-sm text-slate-500">لا توجد مستخلصات بعد.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><tr>
                <th className="text-start px-3 py-2">رقم</th><th className="text-start px-3 py-2">التاريخ</th>
                <th className="text-start px-3 py-2">{owner ? 'المالك' : 'مقاول الباطن'}</th><th className="text-start px-3 py-2 hidden md:table-cell">المشروع</th>
                <th className="text-end px-3 py-2">قيمة المستخلص</th><th className="text-end px-3 py-2 hidden md:table-cell">المحتجز</th>
                <th className="text-end px-3 py-2 hidden md:table-cell">الخصم والتحصيل</th><th className="text-end px-3 py-2">الصافي + الضريبة</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><bdi dir="ltr">{c.claim_number}</bdi></td>
                    <td className="px-3 py-2"><bdi dir="ltr">{c.claim_date || ''}</bdi></td>
                    <td className="px-3 py-2">{c.partner_name || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell">{projName(c.project_id) || '—'}</td>
                    <td className="px-3 py-2 text-end"><N v={c.current_claim} /></td>
                    <td className="px-3 py-2 text-end hidden md:table-cell"><N v={c.retention_amount} /></td>
                    <td className="px-3 py-2 text-end hidden md:table-cell"><N v={c.withholding_tax_amount} /></td>
                    <td className="px-3 py-2 text-end font-semibold"><N v={c.ar_amount ?? (c.net_payable + c.vat_amount)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {err && !form && <p className="text-sm text-red-700" role="alert">{err}</p>}

      {form && (
        <Modal title={owner ? 'مستخلص جديد للمالك' : 'مستخلص مقاول باطن'} onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={save} disabled={busy || !(calc?.current > 0) || calc?.net < 0 || !form.partner_name.trim()}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'حفظ وترحيل القيد'}</button>
          </>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label><span className="text-slate-600">رقم المستخلص</span>
              <input dir="ltr" value={form.claim_number} onChange={(e) => setForm({ ...form, claim_number: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">التاريخ</span>
              <input type="date" value={form.claim_date} onChange={(e) => setForm({ ...form, claim_date: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">المشروع</span>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={input}>
                <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="sm:col-span-3"><span className="text-slate-600">{owner ? 'المالك (العميل) *' : 'مقاول الباطن *'}</span>
              <select value={form.partner_id} onChange={(e) => {
                const p = partyList.find((x) => x.id === e.target.value);
                setForm({ ...form, partner_id: e.target.value, partner_name: p?.name || form.partner_name });
              }} className={input}>
                <option value="">— اختر من الدليل أو اكتب الاسم بالأسفل —</option>
                {partyList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="الاسم" className={input} /></label>
            <label><span className="text-slate-600">إجمالي الأعمال حتى تاريخه *</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">المستخلصات السابقة</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.previous_claims} onChange={(e) => setForm({ ...form, previous_claims: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">ضمان حسن التنفيذ %</span>
              <input type="number" min="0" max="100" step="0.5" dir="ltr" value={form.retention_percentage} onChange={(e) => setForm({ ...form, retention_percentage: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">{owner ? 'استهلاك دفعة مقدمة مستلمة' : 'استرداد دفعة مقدمة دفعناها'}</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">ضريبة القيمة المضافة</span>
              <select value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: +e.target.value })} className={input}>
                {VAT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label><span className="text-slate-600">الخصم والتحصيل</span>
              <select value={form.wht_type} onChange={(e) => setForm({ ...form, wht_type: e.target.value })} className={input}>
                {Object.entries(WHT).map(([k, [l, r]]) => <option key={k} value={k}>{l} {r}%</option>)}</select></label>
          </div>
          {calc && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[['قيمة المستخلص الحالي', calc.current], ['المحتجز', calc.ret], ['الخصم والتحصيل', calc.wht], ['الصافي + الضريبة', calc.total]].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2"><p className="text-slate-500">{l}</p><p className="font-bold text-sm"><N v={v} /></p></div>
              ))}
            </div>
          )}
          {calc?.current > 0 && <div className="mt-3"><Lines rows={preview} /></div>}
          {calc?.net < 0 && <p className="mt-2 text-red-700 text-sm">المحتجزات والدفعة المقدمة والخصم أكبر من قيمة المستخلص.</p>}
          {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ خطابات الضمان ═════════════════════════ */

const LG_TYPES = { preliminary: 'ابتدائي', performance: 'حسن التنفيذ (نهائي)', advance: 'ضمان دفعة مقدمة', warranty: 'ضمان صيانة', customs: 'ضمان جمركي' };
const LG_STATUS = { active: 'سارٍ', expired: 'منتهي', cancelled: 'مُسترد', claimed: 'مُسيَّل' };

export function GuaranteesPage() {
  const [data, setData] = useState(null);
  const [banks, setBanks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(null);
  const [release, setRelease] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data: d } = await axios.get(`${API}/api/trade-finance/letters-of-guarantee`, auth());
      setData(d);
    } catch (e) { setData({ letters: [], summary: {} }); setErr(errText(e, 'تعذّر تحميل خطابات الضمان')); }
  };
  useEffect(() => {
    load();
    axios.get(`${API}/api/payment-vouchers/sources`, auth())
      .then((r) => setBanks((r.data?.sources || []).filter((s) => s.kind === 'bank'))).catch(() => {});
    axios.get(`${API}/api/tasks/projects`, auth()).then((r) => setProjects(Array.isArray(r.data) ? r.data : (r.data?.projects || []))).catch(() => {});
  }, []);

  const bankCodes = [...new Map(banks.map((b) => [b.account_code, b])).values()];
  const commission = form ? r2((+form.amount || 0) * (+form.commission_rate || 0) / 100) : 0;
  const now = today();

  const issue = async () => {
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/api/trade-finance/letters-of-guarantee`, {
        lg_type: form.lg_type, beneficiary: form.beneficiary.trim(), project_id: form.project_id || null,
        amount: +form.amount, margin_amount: +form.margin_amount || 0, commission_rate: (+form.commission_rate || 0) / 100,
        issue_date: form.issue_date, expiry_date: form.expiry_date, bank_account: form.bank_account || '162',
        reference: form.reference || null, notes: form.notes || null }, auth());
      setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر إصدار الخطاب')); } finally { setBusy(false); }
  };
  const doRelease = async () => {
    setBusy(true); setErr('');
    try {
      await axios.put(`${API}/api/trade-finance/letters-of-guarantee/${release.lg.id}/release`, { date: release.date, reason: release.reason }, auth());
      setRelease(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر الاسترداد')); } finally { setBusy(false); }
  };

  const s = data?.summary || {};
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">خطابات الضمان</h1>
          <p className="text-sm text-slate-500">الغطاء النقدي يُقيَّد على 1651، وقيمة الخطاب قيد نظامي خارج الميزانية (9111/9112).</p>
        </div>
        <button onClick={() => { setErr(''); setForm({ lg_type: 'performance', beneficiary: '', project_id: '', amount: '', margin_amount: '', commission_rate: 0.5,
          issue_date: now, expiry_date: '', bank_account: bankCodes[0]?.account_code || '162', reference: '', notes: '' }); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">
          <Plus className="w-4 h-4" aria-hidden /> إصدار خطاب ضمان</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[['خطابات سارية', s.active_count ?? 0, false], ['إجمالي قيمة الخطابات السارية', s.total_exposure, true], ['الغطاء المحتجز لدى البنوك', s.total_margin_locked, true]].map(([l, v, m]) => (
          <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><p className="text-xs text-slate-500">{l}</p>
            <p className="text-lg font-extrabold">{m ? <N v={v} /> : <bdi dir="ltr">{v}</bdi>}</p></div>
        ))}
      </div>

      {data === null ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        : (data.letters || []).length === 0 ? <p className="text-center py-16 text-sm text-slate-500">لا توجد خطابات ضمان.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><tr>
                <th className="text-start px-3 py-2">المستفيد</th><th className="text-start px-3 py-2">النوع</th>
                <th className="text-end px-3 py-2">القيمة</th><th className="text-end px-3 py-2 hidden md:table-cell">الغطاء</th>
                <th className="text-start px-3 py-2">ينتهي</th><th className="text-start px-3 py-2">الحالة</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.letters.map((l) => {
                  const expired = l.status === 'active' && l.expiry_date && l.expiry_date < now;
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-semibold">{l.beneficiary}{l.reference && <span className="block text-xs text-slate-500"><bdi dir="ltr">{l.reference}</bdi></span>}</td>
                      <td className="px-3 py-2">{l.lg_type_ar || LG_TYPES[l.lg_type]}</td>
                      <td className="px-3 py-2 text-end"><N v={l.amount} /></td>
                      <td className="px-3 py-2 text-end hidden md:table-cell"><N v={l.margin_amount} /></td>
                      <td className="px-3 py-2"><bdi dir="ltr">{l.expiry_date}</bdi></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${expired ? 'bg-amber-100 text-amber-800' : l.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {expired ? 'انتهت مدته' : LG_STATUS[l.status] || l.status}</span></td>
                      <td className="px-3 py-2 text-end">
                        {['active', 'expired'].includes(l.status) && (
                          <button onClick={() => { setErr(''); setRelease({ lg: l, date: now, reason: 'انتهاء الغرض من الخطاب' }); }}
                            className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold">استرداد</button>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {err && !form && !release && <p className="text-sm text-red-700" role="alert">{err}</p>}

      {form && (
        <Modal title="إصدار خطاب ضمان" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
          <button onClick={issue} disabled={busy || !form.beneficiary.trim() || !(+form.amount > 0) || !form.expiry_date || +form.margin_amount > +form.amount}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'إصدار وترحيل القيود'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className="text-slate-600">نوع الخطاب</span>
              <select value={form.lg_type} onChange={(e) => setForm({ ...form, lg_type: e.target.value })} className={input}>
                {Object.entries(LG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label><span className="text-slate-600">المستفيد *</span>
              <input value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">قيمة الخطاب *</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">الغطاء النقدي المحتجز</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.margin_amount} onChange={(e) => setForm({ ...form, margin_amount: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">عمولة الإصدار %</span>
              <input type="number" min="0" max="5" step="0.05" dir="ltr" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">البنك</span>
              <select value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className={input}>
                {bankCodes.length === 0 && <option value="162">162 النقدية بالبنوك</option>}
                {bankCodes.map((b) => <option key={b.account_code} value={b.account_code}>{b.account_code} — {b.label}</option>)}</select></label>
            <label><span className="text-slate-600">تاريخ الإصدار</span>
              <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">تاريخ الانتهاء *</span>
              <input type="date" min={form.issue_date} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">المشروع</span>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={input}>
                <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label><span className="text-slate-600">رقم الخطاب لدى البنك</span>
              <input dir="ltr" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={input} /></label>
          </div>
          {+form.amount > 0 && <div className="mt-4 space-y-2">
            <Lines rows={[['1651 غطاء خطابات الضمان', r2(+form.margin_amount || 0), 0], ['3321 عمولة إصدار خطاب الضمان', commission, 0],
              [`${form.bank_account} البنك`, 0, r2((+form.margin_amount || 0) + commission)]]} />
            <p className="text-xs text-slate-500">وقيد نظامي: من 9111 إلى 9112 بقيمة <N v={form.amount} /> — خارج الميزانية.</p>
          </div>}
          {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
        </Modal>
      )}

      {release && (
        <Modal title={`استرداد خطاب ضمان — ${release.lg.beneficiary}`} onClose={() => setRelease(null)} footer={<>
          <button onClick={() => setRelease(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
          <button onClick={doRelease} disabled={busy} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'استرداد وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className="text-slate-600">تاريخ الاسترداد</span>
              <input type="date" value={release.date} onChange={(e) => setRelease({ ...release, date: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">السبب</span>
              <input value={release.reason} onChange={(e) => setRelease({ ...release, reason: e.target.value })} className={input} /></label>
          </div>
          <div className="mt-4"><Lines rows={[[`${release.lg.bank_account || '162'} البنك`, release.lg.margin_amount, 0], ['1651 غطاء خطابات الضمان', 0, release.lg.margin_amount]]} /></div>
          <p className="mt-2 text-xs text-slate-500">ويُعكس القيد النظامي (9112/9111) بقيمة <N v={release.lg.amount} />.</p>
          {err && <p className="mt-3 text-sm text-red-700" role="alert">{err}</p>}
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ نموذج 10 و41 ═════════════════════════ */

export function TaxFormsPage() {
  const d = new Date();
  const [kind, setKind] = useState('10');
  const [year, setYear] = useState(d.getFullYear());
  const [month, setMonth] = useState(d.getMonth() === 0 ? 12 : d.getMonth());       // the month just closed
  const [quarter, setQuarter] = useState(Math.max(1, Math.ceil((d.getMonth()) / 3)));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setBusy(true); setErr(''); setRes(null);
    try {
      const url = kind === '10' ? `${API}/api/tax-reports/form-10` : `${API}/api/tax-reports/form-41`;
      const params = kind === '10' ? { year, month } : { year, quarter };
      const { data } = await axios.get(url, { ...auth(), params });
      setRes(data);
    } catch (e) { setErr(errText(e, 'تعذّر إعداد النموذج')); } finally { setBusy(false); }
  };

  const Row = ({ l, v, b }) => (
    <div className={`flex justify-between py-1.5 ${b ? 'font-extrabold border-t border-slate-300 mt-1 pt-2' : ''}`}><span>{l}</span><N v={v} /></div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-extrabold">النماذج الضريبية</h1>
          <p className="text-sm text-slate-500">من دفتر الأستاذ مباشرة — راجع الأرقام مع المحاسب قبل التقديم على بوابة المصلحة.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-sm"><span className="text-slate-600">النموذج</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setRes(null); }} className={input}>
            <option value="10">نموذج 10 — القيمة المضافة (شهري)</option>
            <option value="41">نموذج 41 — الخصم والتحصيل (ربع سنوي)</option></select></label>
        <label className="text-sm"><span className="text-slate-600">السنة</span>
          <input type="number" dir="ltr" value={year} onChange={(e) => setYear(+e.target.value)} className={`${input} w-28`} /></label>
        {kind === '10' ? (
          <label className="text-sm"><span className="text-slate-600">الشهر</span>
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className={input}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
        ) : (
          <label className="text-sm"><span className="text-slate-600">الربع</span>
            <select value={quarter} onChange={(e) => setQuarter(+e.target.value)} className={input}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}</option>)}</select></label>
        )}
        <button onClick={run} disabled={busy} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'إعداد النموذج'}</button>
        {res && <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 text-sm"><Printer className="w-4 h-4" aria-hidden /> طباعة</button>}
      </div>
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}

      {res && kind === '10' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 max-w-2xl text-sm">
          <h2 className="font-extrabold text-lg">{res.form}</h2>
          <p className="text-slate-500">{res.company?.name} — رقم التسجيل <bdi dir="ltr">{res.company?.vat_registration || res.company?.tax_id || '—'}</bdi> — الفترة <bdi dir="ltr">{res.period}</bdi></p>
          <p className="text-slate-500 mb-3">آخر موعد للتقديم: <bdi dir="ltr">{res.due_date}</bdi></p>
          <p className="font-bold mt-2">{res.vat_output?.label}</p>
          <Row l="قيمة المبيعات الخاضعة" v={res.vat_output?.sales_base} /><Row l="ضريبة المخرجات" v={res.vat_output?.vat_amount} />
          <p className="font-bold mt-3">{res.vat_input?.label}</p>
          <Row l="قيمة المشتريات" v={res.vat_input?.purchase_base} /><Row l="ضريبة المدخلات" v={res.vat_input?.vat_amount} />
          <Row l={res.net_position?.status === 'رصيد دائن' ? 'رصيد دائن يُرحَّل' : 'صافي الضريبة المستحقة'} v={res.net_position?.net_vat_due || res.net_position?.vat_credit} b />
        </div>
      )}

      {res && kind === '41' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-sm">
          <h2 className="font-extrabold text-lg">{res.form}</h2>
          <p className="text-slate-500">{res.company?.name} — رقم التسجيل <bdi dir="ltr">{res.company?.tax_id || '—'}</bdi> — {res.period}</p>
          <p className="text-slate-500 mb-3">{res.due_date}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[['1% توريدات ومقاولات', res.summary?.wht_1pct_supplies], ['3% خدمات', res.summary?.wht_3pct_services],
              ['5% مهن حرة', res.summary?.wht_5pct_professions], ['الإجمالي المستحق', res.summary?.total_wht_due]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">{l}</p><p className="font-bold"><N v={v} /></p></div>
            ))}
          </div>
          {(res.entries || []).length === 0 ? <p className="text-slate-500">لا توجد مبالغ خصم وتحصيل في هذا الربع.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800"><tr>
                  <th className="text-start px-2 py-1.5">المستند</th><th className="text-start px-2 py-1.5">التاريخ</th><th className="text-start px-2 py-1.5">المورد</th>
                  <th className="text-start px-2 py-1.5">رقم التسجيل</th><th className="text-end px-2 py-1.5">القيمة</th><th className="text-end px-2 py-1.5">النسبة</th><th className="text-end px-2 py-1.5">المخصوم</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {res.entries.map((e) => (
                    <tr key={e.invoice_id}>
                      <td className="px-2 py-1.5"><bdi dir="ltr">{e.invoice_number}</bdi></td><td className="px-2 py-1.5"><bdi dir="ltr">{String(e.invoice_date || '').slice(0, 10)}</bdi></td>
                      <td className="px-2 py-1.5">{e.supplier_name}</td><td className="px-2 py-1.5"><bdi dir="ltr">{e.supplier_tax_id || '—'}</bdi></td>
                      <td className="px-2 py-1.5 text-end"><N v={e.gross_amount} /></td><td className="px-2 py-1.5 text-end"><bdi dir="ltr">{e.wht_rate_pct}%</bdi></td>
                      <td className="px-2 py-1.5 text-end font-semibold"><N v={e.wht_amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(res.entries || []).some((e) => !e.supplier_tax_id) && <p className="mt-3 text-xs text-amber-700">بعض الموردين بلا رقم تسجيل ضريبي — أكمله من العملاء والموردين قبل التقديم.</p>}
        </div>
      )}
    </div>
  );
}
