/**
 * العُهد النقدية — replaces the sample-data CustodyModule.
 *
 * Backed by /api/petty-cash. Every action posts a journal entry:
 *   open      من ح/ العُهد (133)            ← إلى ح/ الخزينة (161) أو البنك (162)
 *   expenses  من ح/ المصروفات حسب البند     ← إلى ح/ الخزينة أو البنك   (استعاضة)
 *   settle    من ح/ المصروفات + المُرتجع     ← إلى ح/ العُهد               (إقفال)
 * Settling is refused unless expenses + cash returned equal the balance.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Briefcase, Search, Plus, X, Loader2, Trash2 } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');

const normalize = (s = '') => String(s ?? '').toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
const today = () => new Date().toISOString().slice(0, 10);
const newItem = () => ({ category: 'misc', description: '', amount: '', receipt_ref: '' });

const CATEGORIES = {
  ar: { fuel: 'وقود ومواصلات', transport: 'نقل وتوصيل', buffet: 'بوفيه وضيافة', stationery: 'قرطاسية ومطبوعات',
        cleaning: 'نظافة', maintenance: 'صيانة طارئة', repairs: 'إصلاح طارئ', misc: 'نثرية متنوعة' },
  en: { fuel: 'Fuel & transport', transport: 'Delivery', buffet: 'Hospitality', stationery: 'Stationery',
        cleaning: 'Cleaning', maintenance: 'Emergency maintenance', repairs: 'Emergency repairs', misc: 'Sundry' },
};

const T = {
  ar: {
    title: 'العُهد النقدية', open: 'العُهد المفتوحة', add: 'صرف عهدة', search: 'ابحث باسم الموظف أو الغرض',
    all: 'الكل', statusOpen: 'مفتوحة', statusClosed: 'مُقفلة', custodian: 'الموظف المستلم', type: 'نوع العهدة',
    imprest: 'مستديمة', temporary: 'مؤقتة', amount: 'المبلغ', purpose: 'الغرض', date: 'التاريخ', source: 'تُصرف من',
    cash: 'الخزينة', bank: 'البنك', notes: 'ملاحظات', original: 'مبلغ الصرف', balance: 'الرصيد الحالي', spent: 'المصروف',
    status: 'الحالة', empty: 'لا توجد عُهد — اصرف أول عهدة لموظف لتبدأ متابعة مصروفاته.', noMatch: 'لا توجد عهدة مطابقة',
    openFund: 'صرف عهدة جديدة', save: 'صرف العهدة وترحيل القيد', cancel: 'إلغاء', close: 'إغلاق',
    expenses: 'تسجيل مصروفات (استعاضة)', settle: 'تسوية وإقفال العهدة', category: 'البند', desc: 'البيان',
    receipt: 'رقم الإيصال', addLine: 'إضافة بند', returned: 'المبلغ المُرتجع نقداً', postExpenses: 'تسجيل وترحيل',
    postSettle: 'إقفال العهدة وترحيل القيد', total: 'الإجمالي', mustEqual: 'المصروفات + المُرتجع يجب أن تساوي رصيد العهدة',
    breakdown: 'المصروفات حسب البند', history: 'الاستعاضات السابقة', done: 'تم الترحيل إلى دفتر الأستاذ',
    required: 'أكمل الحقول المطلوبة', loadError: 'تعذّر تحميل العُهد — تحقق من الاتصال', retry: 'إعادة المحاولة',
    difference: 'الفرق',
  },
  en: {
    title: 'Cash custody', open: 'Open custody', add: 'Issue custody', search: 'Search by employee or purpose',
    all: 'All', statusOpen: 'Open', statusClosed: 'Closed', custodian: 'Employee', type: 'Type',
    imprest: 'Imprest', temporary: 'Temporary', amount: 'Amount', purpose: 'Purpose', date: 'Date', source: 'Paid from',
    cash: 'Treasury', bank: 'Bank', notes: 'Notes', original: 'Issued', balance: 'Balance', spent: 'Spent',
    status: 'Status', empty: 'No custody yet — issue the first one to an employee to start tracking their expenses.', noMatch: 'No matching custody',
    openFund: 'Issue new custody', save: 'Issue and post entry', cancel: 'Cancel', close: 'Close',
    expenses: 'Record expenses (replenish)', settle: 'Settle and close', category: 'Category', desc: 'Description',
    receipt: 'Receipt no.', addLine: 'Add line', returned: 'Cash returned', postExpenses: 'Record and post',
    postSettle: 'Close custody and post entry', total: 'Total', mustEqual: 'Expenses + cash returned must equal the custody balance',
    breakdown: 'Spending by category', history: 'Previous replenishments', done: 'Posted to the general ledger',
    required: 'Fill in the required fields', loadError: 'Could not load custody — check your connection', retry: 'Retry',
    difference: 'Difference',
  },
};

export default function CustodyPage() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const cats = CATEGORIES[isRTL ? 'ar' : 'en'];
  const loc = isRTL ? 'ar-EG' : 'en-US';
  const fmt = (n) => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const [funds, setFunds] = useState([]);
  const [openBalance, setOpenBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [mode, setMode] = useState('expenses');          // expenses | settle
  const [items, setItems] = useState([newItem()]);
  const [returned, setReturned] = useState('');
  const [actDate, setActDate] = useState(today());
  const [actSource, setActSource] = useState('main_cash');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await axios.get(`${API_URL}/api/petty-cash/funds`, auth());
      setFunds(res.data.funds || []);
      setOpenBalance(res.data.open_balance || 0);
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    try { setDetail((await axios.get(`${API_URL}/api/petty-cash/funds/${id}/statement`, auth())).data); }
    catch { setDetail({ error: true }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    loadDetail(selected.id); setItems([newItem()]); setReturned(''); setActDate(today());
    setMsg({ type: '', text: '' }); setMode(selected.status === 'open' ? 'expenses' : 'expenses');
  }, [selected, loadDetail]);

  const visible = useMemo(() => {
    const q = normalize(query);
    return funds.filter((f) => (statusFilter === 'all' || f.status === statusFilter) &&
      (!q || [f.custodian_name, f.purpose, f.notes].some((v) => normalize(v).includes(q))));
  }, [funds, query, statusFilter]);

  const openFund = async () => {
    if (!form.custodian_name?.trim() || !(Number(form.amount) > 0) || !form.purpose?.trim()) { setFormError(t.required); return; }
    setBusy(true); setFormError('');
    try {
      await axios.post(`${API_URL}/api/petty-cash/funds`, { ...form, amount: Number(form.amount) }, auth());
      setForm(null); await load();
    } catch (e) { setFormError(e.response?.data?.detail || t.loadError); } finally { setBusy(false); }
  };

  const cleanItems = items.filter((i) => Number(i.amount) > 0)
    .map((i) => ({ ...i, amount: Number(i.amount), description: i.description || cats[i.category] }));
  const itemsTotal = cleanItems.reduce((s, i) => s + i.amount, 0);
  const balance = Number(detail?.current_balance ?? selected?.current_balance ?? 0);
  const settleDiff = Math.round((itemsTotal + (Number(returned) || 0) - balance) * 100) / 100;

  const submit = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      if (mode === 'expenses') {
        await axios.post(`${API_URL}/api/petty-cash/funds/${selected.id}/replenish`,
          { fund_id: selected.id, date_str: actDate, items: cleanItems, source: actSource }, auth());
      } else {
        await axios.post(`${API_URL}/api/petty-cash/funds/${selected.id}/settle`,
          { fund_id: selected.id, date_str: actDate, expense_items: cleanItems, cash_returned: Number(returned) || 0 }, auth());
      }
      setMsg({ type: 'ok', text: t.done }); setItems([newItem()]); setReturned('');
      await load(); await loadDetail(selected.id);
      if (mode === 'settle') setSelected((s) => ({ ...s, status: 'closed' }));
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40';
  const num = 'tabular-nums whitespace-nowrap text-end';
  const canSubmit = mode === 'expenses' ? cleanItems.length > 0 : settleDiff === 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <h1 className="text-xl font-extrabold text-slate-900">{t.title}</h1>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-end">
            <p className="text-xs text-slate-500">{t.open}</p>
            <p className="tabular-nums text-lg font-extrabold text-slate-900">{fmt(openBalance)}</p>
          </div>
          <button onClick={() => { setForm({ custodian_name: '', fund_type: 'temporary', amount: '', purpose: '', date_str: today(), source: 'main_cash', notes: '' }); setFormError(''); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172f70]">
            <Plus className="w-4 h-4" />{t.add}
          </button>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block flex-1 min-w-[16rem] max-w-md">
            <span className="sr-only">{t.search}</span>
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search}
              className="w-full ps-9 pe-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
          </label>
          <div className="flex gap-1.5" role="radiogroup">
            {[['open', t.statusOpen], ['closed', t.statusClosed], ['all', t.all]].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={statusFilter === k} onClick={() => setStatusFilter(k)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${statusFilter === k ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : 'bg-white text-slate-600 border-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm text-slate-600"><p>{t.loadError}</p>
              <button onClick={load} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button></div>
          ) : funds.length === 0 ? (
            <p className="p-12 text-center text-slate-600 max-w-sm mx-auto">{t.empty}</p>
          ) : visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">{t.noMatch}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.custodian}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.purpose}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.date}</th>
                    <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.original}</th>
                    <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.balance}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((f) => (
                    <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setSelected(f)} className="font-semibold text-slate-900 hover:text-[#1e3a8a] hover:underline text-start">{f.custodian_name}</button>
                        <p className="text-xs text-slate-500">{f.fund_type === 'imprest' ? t.imprest : t.temporary}</p>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate">{f.purpose}</td>
                      <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{(f.open_date || '').slice(0, 10)}</td>
                      <td className={`px-4 py-2.5 ${num}`}>{fmt(f.original_amount)}</td>
                      <td className={`px-4 py-2.5 ${num} font-bold`}>{fmt(f.current_balance)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold ${f.status === 'open' ? 'text-[#1e3a8a]' : 'text-slate-400'}`}>
                          {f.status === 'open' ? t.statusOpen : t.statusClosed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Issue custody ── */}
      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{t.openFund}</h2>
              <button onClick={() => setForm(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-slate-600">{t.custodian} *</span>
                <input autoFocus value={form.custodian_name} onChange={(e) => setForm({ ...form, custodian_name: e.target.value })} className={`${input} mt-1`} /></label>
              <label><span className="text-slate-600">{t.amount} *</span>
                <input type="number" min="0" step="0.01" dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} mt-1 tabular-nums`} /></label>
              <label><span className="text-slate-600">{t.date}</span>
                <input type="date" value={form.date_str} onChange={(e) => setForm({ ...form, date_str: e.target.value })} className={`${input} mt-1`} /></label>
              <label><span className="text-slate-600">{t.type}</span>
                <select value={form.fund_type} onChange={(e) => setForm({ ...form, fund_type: e.target.value })} className={`${input} mt-1 bg-white`}>
                  <option value="temporary">{t.temporary}</option><option value="imprest">{t.imprest}</option></select></label>
              <label><span className="text-slate-600">{t.source}</span>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={`${input} mt-1 bg-white`}>
                  <option value="main_cash">{t.cash}</option><option value="bank">{t.bank}</option></select></label>
              <label className="sm:col-span-2"><span className="text-slate-600">{t.purpose} *</span>
                <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="sm:col-span-2"><span className="text-slate-600">{t.notes}</span>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} mt-1`} /></label>
            </div>
            {formError && <p className="mx-5 mb-3 text-sm text-red-700">{formError}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={openFund} disabled={busy} className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custody detail ── */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{selected.custodian_name}</h2>
                <p className="text-sm text-slate-500">{selected.purpose}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-end"><p className="text-xs text-slate-500">{t.balance}</p>
                  <p className="tabular-nums text-xl font-extrabold">{fmt(balance)}</p></div>
                <button onClick={() => setSelected(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {!detail ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
            ) : detail.error ? (
              <p className="p-8 text-center text-sm text-slate-600">{t.loadError}</p>
            ) : (
              <div className="p-5 space-y-5">
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  {[[t.original, detail.original_amount], [t.spent, detail.total_spent], [t.balance, detail.current_balance]].map(([l, v]) => (
                    <div key={l}><dt className="text-slate-500">{l}</dt><dd className="tabular-nums font-bold">{fmt(v)}</dd></div>
                  ))}
                </dl>

                {detail.category_breakdown?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-2">{t.breakdown}</h3>
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm">
                      {detail.category_breakdown.map((c) => (
                        <li key={c.category} className="flex justify-between px-3 py-2">
                          <span>{cats[c.category] || c.category}</span><span className="tabular-nums font-semibold">{fmt(c.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.status === 'open' && (
                  <section className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex gap-1.5" role="tablist">
                      {[['expenses', t.expenses], ['settle', t.settle]].map(([k, label]) => (
                        <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setMsg({ type: '', text: '' }); }}
                          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${mode === k ? 'bg-[#1e3a8a] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <label><span className="text-slate-600">{t.date}</span>
                        <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className={`${input} mt-1`} /></label>
                      {mode === 'expenses' && (
                        <label><span className="text-slate-600">{t.source}</span>
                          <select value={actSource} onChange={(e) => setActSource(e.target.value)} className={`${input} mt-1 bg-white`}>
                            <option value="main_cash">{t.cash}</option><option value="bank">{t.bank}</option></select></label>
                      )}
                    </div>

                    <div className="space-y-2">
                      {items.map((it, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1.4fr_7rem_auto] gap-2 items-end">
                          <select aria-label={t.category} value={it.category} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} className={`${input} bg-white`}>
                            {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <input aria-label={t.desc} placeholder={t.desc} value={it.description} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className={input} />
                          <input aria-label={t.amount} type="number" min="0" step="0.01" dir="ltr" placeholder="0.00" value={it.amount} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className={`${input} tabular-nums`} />
                          <button onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [newItem()])} aria-label="remove"
                            className="p-2 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setItems([...items, newItem()])} className="text-sm font-semibold text-[#1e3a8a] hover:underline">+ {t.addLine}</button>
                    </div>

                    {mode === 'settle' && (
                      <label className="block text-sm max-w-xs"><span className="text-slate-600">{t.returned}</span>
                        <input type="number" min="0" step="0.01" dir="ltr" value={returned} onChange={(e) => setReturned(e.target.value)} className={`${input} mt-1 tabular-nums`} /></label>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-sm">
                      <div className="tabular-nums">
                        <span className="text-slate-500">{t.total}: </span><strong>{fmt(itemsTotal + (mode === 'settle' ? Number(returned) || 0 : 0))}</strong>
                        {mode === 'settle' && settleDiff !== 0 && (
                          <p className="text-amber-700 text-xs mt-0.5">{t.mustEqual} — {t.difference}: {fmt(settleDiff)}</p>
                        )}
                      </div>
                      <button onClick={submit} disabled={busy || !canSubmit}
                        className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white font-semibold disabled:opacity-40">
                        {busy ? '…' : mode === 'expenses' ? t.postExpenses : t.postSettle}
                      </button>
                    </div>
                  </section>
                )}
                {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
