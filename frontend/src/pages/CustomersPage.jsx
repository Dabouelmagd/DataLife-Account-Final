/**
 * العملاء — replaces CustomersModule, which showed a stored `balance` that
 * nothing ever updated.
 *
 * Customers are the Sales module's (sales invoices carry these ids). A
 * customer's balance is what the ledger put on 131 for them: posted invoices,
 * minus posted payments, minus incoming cheques (plus any that bounced).
 * A receipt is applied to the oldest open invoices first; every part posts
 * its own entry and updates that invoice's payment status.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Users, Search, Plus, X, Loader2, Pencil, Wallet, AlertTriangle } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const normalize = (s = '') => String(s ?? '').toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: '', phone: '', email: '', tax_number: '', address: '', city: '', credit_limit: '', payment_terms: '', notes: '' };

const T = {
  ar: {
    title: 'العملاء', receivable: 'إجمالي المستحق من العملاء', overdueTotal: 'منها متأخرات', add: 'إضافة عميل',
    search: 'ابحث بالاسم أو الهاتف أو الرقم الضريبي', name: 'اسم العميل', phone: 'الهاتف', email: 'البريد الإلكتروني',
    taxId: 'الرقم الضريبي', address: 'العنوان', city: 'المدينة', limit: 'حد الائتمان', terms: 'شروط الدفع', notes: 'ملاحظات',
    invoices: 'فواتير', balance: 'المستحق', overdue: 'متأخر', overLimit: 'تجاوز حد الائتمان',
    save: 'حفظ العميل', cancel: 'إلغاء', edit: 'تعديل', newCustomer: 'عميل جديد', editCustomer: 'تعديل العميل',
    empty: 'لا يوجد عملاء بعد — أضف أول عميل، ثم أصدر فواتيره من المبيعات.', noMatch: 'لا يوجد عميل مطابق',
    statement: 'كشف حساب العميل', date: 'التاريخ', desc: 'البيان', debit: 'مدين', credit: 'دائن',
    noMoves: 'لا توجد فواتير أو تحصيلات لهذا العميل', openInvoices: 'الفواتير المفتوحة', due: 'الاستحقاق', remaining: 'المتبقي',
    receive: 'تحصيل من العميل', amount: 'المبلغ', method: 'طريقة التحصيل', cash: 'نقدي — الخزينة', bank: 'تحويل — البنك',
    reference: 'المرجع', confirm: 'تحصيل وترحيل', applied: 'تم التحصيل وتوزيعه على:', settled: 'لا يوجد مستحق على هذا العميل',
    fifo: 'يُوزَّع المبلغ على أقدم الفواتير المفتوحة أولاً', required: 'اسم العميل مطلوب',
    loadError: 'تعذّر التحميل — تحقق من الاتصال', retry: 'إعادة المحاولة', close: 'إغلاق',
  },
  en: {
    title: 'Customers', receivable: 'Total owed by customers', overdueTotal: 'of which overdue', add: 'Add customer',
    search: 'Search by name, phone or tax ID', name: 'Customer name', phone: 'Phone', email: 'Email',
    taxId: 'Tax ID', address: 'Address', city: 'City', limit: 'Credit limit', terms: 'Payment terms', notes: 'Notes',
    invoices: 'invoices', balance: 'Owed', overdue: 'Overdue', overLimit: 'Over credit limit',
    save: 'Save customer', cancel: 'Cancel', edit: 'Edit', newCustomer: 'New customer', editCustomer: 'Edit customer',
    empty: 'No customers yet — add your first customer, then issue their invoices from Sales.', noMatch: 'No matching customer',
    statement: 'Customer statement', date: 'Date', desc: 'Description', debit: 'Debit', credit: 'Credit',
    noMoves: 'No invoices or payments for this customer', openInvoices: 'Open invoices', due: 'Due', remaining: 'Remaining',
    receive: 'Receive payment', amount: 'Amount', method: 'Method', cash: 'Cash — treasury', bank: 'Transfer — bank',
    reference: 'Reference', confirm: 'Receive and post', applied: 'Received and applied to:', settled: 'Nothing is owed by this customer',
    fifo: 'Applied to the oldest open invoices first', required: 'Customer name is required',
    loadError: 'Could not load — check your connection', retry: 'Retry', close: 'Close',
  },
};

export default function CustomersPage() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const loc = isRTL ? 'ar-EG' : 'en-US';
  const fmt = (n) => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const [customers, setCustomers] = useState([]);
  const [totals, setTotals] = useState({ receivable: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statement, setStatement] = useState(null);
  const [rec, setRec] = useState({ amount: '', date: today(), method: 'bank', reference: '' });
  const [recMsg, setRecMsg] = useState({ type: '', text: '', applied: [] });

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const d = (await axios.get(`${API_URL}/api/sales/customers-balances`, auth())).data;
      setCustomers(d.customers || []);
      setTotals({ receivable: d.total_receivable || 0, overdue: d.total_overdue || 0 });
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  const loadStatement = useCallback(async (id) => {
    setStatement(null);
    try { setStatement((await axios.get(`${API_URL}/api/sales/customers/${id}/statement`, auth())).data); }
    catch { setStatement({ error: true }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    loadStatement(selected.id);
    setRec({ amount: '', date: today(), method: 'bank', reference: '' });
    setRecMsg({ type: '', text: '', applied: [] });
  }, [selected, loadStatement]);

  const visible = useMemo(() => {
    const q = normalize(query);
    return !q ? customers : customers.filter((c) =>
      [c.name, c.phone, c.email, c.tax_number, c.code].some((v) => normalize(v).includes(q)));
  }, [customers, query]);

  const saveCustomer = async () => {
    if (!form.name?.trim()) { setFormError(t.required); return; }
    setBusy(true); setFormError('');
    try {
      const body = { ...form, name: form.name.trim(), credit_limit: Number(form.credit_limit) || 0 };
      if (form.id) await axios.put(`${API_URL}/api/sales/customers/${form.id}`, body, auth());
      else await axios.post(`${API_URL}/api/sales/customers`, body, auth());
      setForm(null); await load();
    } catch (e) { setFormError(e.response?.data?.detail || t.loadError); } finally { setBusy(false); }
  };

  const receive = async () => {
    setBusy(true); setRecMsg({ type: '', text: '', applied: [] });
    try {
      const d = (await axios.post(`${API_URL}/api/sales/customers/${selected.id}/receipts`,
        { ...rec, amount: Number(rec.amount) }, auth())).data;
      setRecMsg({ type: 'ok', text: t.applied, applied: d.applied || [] });
      setRec({ amount: '', date: today(), method: rec.method, reference: '' });
      await Promise.all([loadStatement(selected.id), load()]);
    } catch (e) { setRecMsg({ type: 'err', text: e.response?.data?.detail || t.loadError, applied: [] }); }
    finally { setBusy(false); }
  };

  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40';
  const field = (key, label, props = {}) => (
    <label className="block text-sm"><span className="text-slate-600">{label}</span>
      <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={input} {...props} /></label>
  );
  const num = 'tabular-nums whitespace-nowrap text-end';
  const owed = statement && !statement.error ? statement.balance : 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <h1 className="text-xl font-extrabold text-slate-900">{t.title}</h1>
        </div>
        <div className="flex items-center gap-6">
          <dl className="flex gap-6 text-end">
            <div><dt className="text-xs text-slate-500">{t.receivable}</dt><dd className="tabular-nums text-lg font-extrabold">{fmt(totals.receivable)}</dd></div>
            {totals.overdue > 0 && (
              <div><dt className="text-xs text-slate-500">{t.overdueTotal}</dt><dd className="tabular-nums text-lg font-extrabold text-amber-700">{fmt(totals.overdue)}</dd></div>
            )}
          </dl>
          <button onClick={() => { setForm({ ...EMPTY }); setFormError(''); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172f70]">
            <Plus className="w-4 h-4" />{t.add}
          </button>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        <label className="relative block max-w-md">
          <span className="sr-only">{t.search}</span>
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search}
            className="w-full ps-9 pe-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
        </label>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : loadError ? (
            <div className="p-10 text-center text-sm text-slate-600"><p>{t.loadError}</p>
              <button onClick={load} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button></div>
          ) : customers.length === 0 ? (
            <p className="p-12 text-center text-slate-600 max-w-sm mx-auto">{t.empty}</p>
          ) : visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">{t.noMatch}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.name}</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.phone}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.limit}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.overdue}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.balance}</th>
                  <th scope="col" className="px-2 py-2.5"><span className="sr-only">{t.edit}</span></th>
                </tr></thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setSelected(c)} className="font-semibold text-slate-900 hover:text-[#1e3a8a] hover:underline text-start">{c.name}</button>
                        <p className="text-xs text-slate-500 tabular-nums">{c.code}{c.invoice_count ? ` · ${c.invoice_count} ${t.invoices}` : ''}</p>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" dir="ltr">{c.phone || '—'}</td>
                      <td className={`px-4 py-2.5 ${num} text-slate-500`}>{c.credit_limit ? fmt(c.credit_limit) : '—'}</td>
                      <td className={`px-4 py-2.5 ${num} ${c.overdue > 0 ? 'text-amber-700 font-semibold' : 'text-slate-300'}`}>{c.overdue > 0 ? fmt(c.overdue) : '—'}</td>
                      <td className={`px-4 py-2.5 ${num} font-bold ${c.balance > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {c.over_limit && <AlertTriangle className="inline w-4 h-4 text-red-600 me-1 align-[-2px]" aria-label={t.overLimit} />}
                        {fmt(c.balance)}
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <button onClick={() => { setForm({ ...EMPTY, ...c, credit_limit: c.credit_limit ?? '' }); setFormError(''); }} aria-label={t.edit}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100"><Pencil className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{form.id ? t.editCustomer : t.newCustomer}</h2>
              <button onClick={() => setForm(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">{field('name', `${t.name} *`, { autoFocus: true })}</div>
              {field('phone', t.phone, { dir: 'ltr', inputMode: 'tel' })}
              {field('email', t.email, { dir: 'ltr', type: 'email' })}
              {field('tax_number', t.taxId, { dir: 'ltr' })}
              {field('credit_limit', t.limit, { dir: 'ltr', type: 'number', min: 0, step: '0.01' })}
              {field('city', t.city)}
              {field('payment_terms', t.terms)}
              <div className="sm:col-span-2">{field('address', t.address)}</div>
              <div className="sm:col-span-2">{field('notes', t.notes)}</div>
            </div>
            {formError && <p className="mx-5 mb-3 text-sm text-red-700">{formError}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={saveCustomer} disabled={busy} className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{selected.name}</h2>
                <p className="text-sm text-slate-500">{t.statement}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-end"><p className="text-xs text-slate-500">{t.balance}</p>
                  <p className="tabular-nums text-xl font-extrabold">{fmt(owed)}</p>
                  {statement?.overdue > 0 && <p className="text-xs text-amber-700 tabular-nums">{t.overdue}: {fmt(statement.overdue)}</p>}</div>
                <button onClick={() => setSelected(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {!statement ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
            ) : statement.error ? (
              <p className="p-8 text-center text-sm text-slate-600">{t.loadError}</p>
            ) : (
              <>
                {statement.entries.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{t.noMoves}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                        {[t.date, t.desc, t.debit, t.credit, t.balance].map((h, i) => (
                          <th key={h} scope="col" className={`px-4 py-2 font-semibold ${i >= 2 ? 'text-end' : 'text-start'}`}>{h}</th>))}
                      </tr></thead>
                      <tbody>
                        {statement.entries.map((e, i) => (
                          <tr key={i} className={`border-b border-slate-100 ${e.type === 'bounce' ? 'bg-red-50/60' : ''}`}>
                            <td className="px-4 py-2 tabular-nums whitespace-nowrap">{e.date?.slice(0, 10)}</td>
                            <td className="px-4 py-2">{e.description}<span className="block text-xs text-slate-400 tabular-nums">{e.reference}</span></td>
                            <td className={`px-4 py-2 ${num}`}>{e.debit ? fmt(e.debit) : ''}</td>
                            <td className={`px-4 py-2 ${num}`}>{e.credit ? fmt(e.credit) : ''}</td>
                            <td className={`px-4 py-2 ${num} font-semibold`}>{fmt(e.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {statement.open_invoices?.length > 0 && (
                  <section className="mx-5 mt-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-2">{t.openInvoices}</h3>
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm">
                      {statement.open_invoices.map((inv) => {
                        const late = inv.due_date && inv.due_date < today();
                        return (
                          <li key={inv.id} className="flex justify-between gap-3 px-3 py-2">
                            <span className="tabular-nums">{inv.invoice_number}
                              <span className={`ms-2 text-xs ${late ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>{t.due} {inv.due_date || '—'}</span></span>
                            <span className="tabular-nums font-semibold">{fmt(inv.balance)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <section className="m-5 p-4 rounded-lg border border-slate-200">
                  <h3 className="flex items-center gap-2 font-bold text-slate-900"><Wallet className="w-4 h-4" />{t.receive}</h3>
                  {owed <= 0 ? <p className="mt-2 text-sm text-slate-500">{t.settled}</p> : (
                    <>
                      <p className="mt-1 text-xs text-slate-500">{t.fifo}</p>
                      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                        <label><span className="text-slate-600">{t.amount}</span>
                          <input type="number" min="0" step="0.01" dir="ltr" placeholder={fmt(owed)} value={rec.amount}
                            onChange={(e) => setRec({ ...rec, amount: e.target.value })} className={`${input} tabular-nums`} /></label>
                        <label><span className="text-slate-600">{t.date}</span>
                          <input type="date" value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} className={input} /></label>
                        <label><span className="text-slate-600">{t.method}</span>
                          <select value={rec.method} onChange={(e) => setRec({ ...rec, method: e.target.value })} className={`${input} bg-white`}>
                            <option value="bank">{t.bank}</option><option value="cash">{t.cash}</option></select></label>
                        <label><span className="text-slate-600">{t.reference}</span>
                          <input dir="ltr" value={rec.reference} onChange={(e) => setRec({ ...rec, reference: e.target.value })} className={input} /></label>
                        <div className="sm:col-span-2 flex justify-end">
                          <button onClick={receive} disabled={busy || !(Number(rec.amount) > 0)}
                            className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white font-semibold disabled:opacity-40">{busy ? '…' : t.confirm}</button>
                        </div>
                      </div>
                    </>
                  )}
                  {recMsg.text && (
                    <div className={`mt-3 text-sm ${recMsg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">
                      <p>{recMsg.text}</p>
                      {recMsg.applied.map((a) => <p key={a.invoice_number} className="tabular-nums">{a.invoice_number} — {fmt(a.amount)}</p>)}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
