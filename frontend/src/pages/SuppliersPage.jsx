/**
 * الموردون — replaces the sample-data SuppliersModule.
 *
 * Balances come from the ledger side of each document (what an approved
 * purchase invoice credited to 251, net of withholding, minus payments), so
 * the amount shown here always equals account 251 in the general ledger.
 * A payment is posted to the ledger before it is recorded.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Truck, Search, Plus, X, Loader2, Pencil, Wallet } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');

const normalize = (s = '') => String(s ?? '').toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: '', contact_person: '', phone: '', email: '', tax_id: '', address: '', payment_terms: 'Net 30', category: '', notes: '' };

const T = {
  ar: {
    title: 'الموردون', owed: 'إجمالي المستحق للموردين', add: 'إضافة مورد', search: 'ابحث بالاسم أو الهاتف أو الرقم الضريبي',
    name: 'اسم المورد', contact: 'مسؤول التواصل', phone: 'الهاتف', email: 'البريد الإلكتروني', taxId: 'الرقم الضريبي',
    address: 'العنوان', terms: 'شروط الدفع', category: 'التصنيف', notes: 'ملاحظات', invoices: 'فواتير',
    balance: 'المستحق', save: 'حفظ المورد', cancel: 'إلغاء', edit: 'تعديل', newSupplier: 'مورد جديد', editSupplier: 'تعديل المورد',
    empty: 'لا يوجد موردون بعد — أضف أول مورد لتبدأ تسجيل فواتير الشراء والسداد.', noMatch: 'لا يوجد مورد مطابق',
    statement: 'كشف حساب المورد', date: 'التاريخ', ref: 'المرجع', desc: 'البيان', credit: 'دائن', debit: 'مدين',
    noMoves: 'لا توجد فواتير شراء معتمدة أو مدفوعات لهذا المورد', pay: 'تسجيل سداد', amount: 'المبلغ',
    method: 'طريقة السداد', cash: 'نقدي — الخزينة', bank: 'تحويل / شيك — البنك', reference: 'رقم الشيك أو التحويل',
    confirmPay: 'سداد وترحيل القيد', paid: 'تم تسجيل السداد وترحيله إلى دفتر الأستاذ', settled: 'لا يوجد مستحق لهذا المورد',
    required: 'اسم المورد مطلوب', loadError: 'تعذّر تحميل الموردين — تحقق من الاتصال', retry: 'إعادة المحاولة',
    close: 'إغلاق', inactive: 'غير نشط',
  },
  en: {
    title: 'Suppliers', owed: 'Total owed to suppliers', add: 'Add supplier', search: 'Search by name, phone or tax ID',
    name: 'Supplier name', contact: 'Contact person', phone: 'Phone', email: 'Email', taxId: 'Tax ID',
    address: 'Address', terms: 'Payment terms', category: 'Category', notes: 'Notes', invoices: 'invoices',
    balance: 'Owed', save: 'Save supplier', cancel: 'Cancel', edit: 'Edit', newSupplier: 'New supplier', editSupplier: 'Edit supplier',
    empty: 'No suppliers yet — add your first supplier to start recording purchase invoices and payments.', noMatch: 'No matching supplier',
    statement: 'Supplier statement', date: 'Date', ref: 'Reference', desc: 'Description', credit: 'Credit', debit: 'Debit',
    noMoves: 'No approved purchase invoices or payments for this supplier', pay: 'Record payment', amount: 'Amount',
    method: 'Payment method', cash: 'Cash — treasury', bank: 'Transfer / cheque — bank', reference: 'Cheque or transfer number',
    confirmPay: 'Pay and post entry', paid: 'Payment recorded and posted to the general ledger', settled: 'Nothing is owed to this supplier',
    required: 'Supplier name is required', loadError: 'Could not load suppliers — check your connection', retry: 'Retry',
    close: 'Close', inactive: 'Inactive',
  },
};

export default function SuppliersPage() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const loc = isRTL ? 'ar-EG' : 'en-US';
  const fmt = (n) => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const [suppliers, setSuppliers] = useState([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null);           // null | { ...EMPTY } | { id, ... }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statement, setStatement] = useState(null);
  const [pay, setPay] = useState({ amount: '', date: today(), method: 'bank', reference: '', notes: '' });
  const [payMsg, setPayMsg] = useState({ type: '', text: '' });
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await axios.get(`${API_URL}/api/purchases/suppliers-balances`, auth());
      setSuppliers(res.data.suppliers || []);
      setTotalOwed(res.data.total_payable || 0);
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  const loadStatement = useCallback(async (id) => {
    setStatement(null);
    try {
      const res = await axios.get(`${API_URL}/api/purchases/suppliers/${id}/statement`, auth());
      setStatement(res.data);
    } catch { setStatement({ error: true }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (selected) { loadStatement(selected.id); setPayMsg({ type: '', text: '' }); setPay((p) => ({ ...p, amount: '' })); }
  }, [selected, loadStatement]);

  const visible = useMemo(() => {
    const q = normalize(query);
    if (!q) return suppliers;
    return suppliers.filter((s) => [s.name, s.phone, s.tax_id, s.contact_person, s.email, s.category]
      .some((v) => normalize(v).includes(q)));
  }, [suppliers, query]);

  const saveSupplier = async () => {
    if (!form.name?.trim()) { setFormError(t.required); return; }
    setSaving(true); setFormError('');
    try {
      const body = { ...form, name: form.name.trim() };
      if (form.id) await axios.put(`${API_URL}/api/purchases/suppliers/${form.id}`, body, auth());
      else await axios.post(`${API_URL}/api/purchases/suppliers`, body, auth());
      setForm(null);
      await load();
    } catch (e) {
      setFormError(e.response?.data?.detail || t.loadError);
    } finally { setSaving(false); }
  };

  const submitPayment = async () => {
    setPaying(true); setPayMsg({ type: '', text: '' });
    try {
      await axios.post(`${API_URL}/api/purchases/suppliers/${selected.id}/payments`,
        { ...pay, amount: Number(pay.amount) }, auth());
      setPayMsg({ type: 'ok', text: t.paid });
      setPay({ amount: '', date: today(), method: pay.method, reference: '', notes: '' });
      await Promise.all([loadStatement(selected.id), load()]);
    } catch (e) {
      setPayMsg({ type: 'err', text: e.response?.data?.detail || t.loadError });
    } finally { setPaying(false); }
  };

  const field = (key, label, props = {}) => (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" {...props} />
    </label>
  );

  const num = 'tabular-nums whitespace-nowrap text-end';
  const owed = statement && !statement.error ? statement.balance : 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <h1 className="text-xl font-extrabold text-slate-900">{t.title}</h1>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-end">
            <p className="text-xs text-slate-500">{t.owed}</p>
            <p className="tabular-nums text-lg font-extrabold text-slate-900">{fmt(totalOwed)}</p>
          </div>
          <button onClick={() => { setForm({ ...EMPTY }); setFormError(''); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold hover:bg-[#172f70] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1e3a8a]">
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
            <div className="p-10 text-center text-sm text-slate-600">
              <p>{t.loadError}</p>
              <button onClick={load} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 max-w-sm mx-auto">{t.empty}</p>
              <button onClick={() => setForm({ ...EMPTY })} className="mt-4 px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold">{t.add}</button>
            </div>
          ) : visible.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">{t.noMatch}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.name}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.phone}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.taxId}</th>
                    <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.invoices}</th>
                    <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.balance}</th>
                    <th scope="col" className="px-2 py-2.5"><span className="sr-only">{t.edit}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setSelected(s)} className="font-semibold text-slate-900 hover:text-[#1e3a8a] hover:underline text-start">
                          {s.name}
                        </button>
                        {s.is_active === false && <span className="ms-2 text-xs text-slate-400">{t.inactive}</span>}
                        {s.contact_person && <p className="text-xs text-slate-500">{s.contact_person}</p>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" dir="ltr">{s.phone || '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{s.tax_id || '—'}</td>
                      <td className={`px-4 py-2.5 ${num} text-slate-500`}>{s.invoice_count || 0}</td>
                      <td className={`px-4 py-2.5 ${num} font-bold ${s.balance > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{fmt(s.balance)}</td>
                      <td className="px-2 py-2.5 text-end">
                        <button onClick={() => { setForm({ ...EMPTY, ...s }); setFormError(''); }} aria-label={t.edit}
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

      {/* ── Add / edit ── */}
      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{form.id ? t.editSupplier : t.newSupplier}</h2>
              <button onClick={() => setForm(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">{field('name', `${t.name} *`, { autoFocus: true })}</div>
              {field('contact_person', t.contact)}
              {field('phone', t.phone, { dir: 'ltr', inputMode: 'tel' })}
              {field('email', t.email, { dir: 'ltr', type: 'email' })}
              {field('tax_id', t.taxId, { dir: 'ltr' })}
              {field('payment_terms', t.terms)}
              {field('category', t.category)}
              <div className="sm:col-span-2">{field('address', t.address)}</div>
              <div className="sm:col-span-2">{field('notes', t.notes)}</div>
            </div>
            {formError && <p className="mx-5 mb-3 text-sm text-red-700">{formError}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={saveSupplier} disabled={saving}
                className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">
                {saving ? '…' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Statement + payment ── */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{selected.name}</h2>
                <p className="text-sm text-slate-500">{t.statement}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-end">
                  <p className="text-xs text-slate-500">{t.balance}</p>
                  <p className="tabular-nums text-xl font-extrabold">{fmt(owed)}</p>
                </div>
                <button onClick={() => setSelected(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {!statement ? (
              <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
            ) : statement.error ? (
              <p className="p-8 text-center text-sm text-slate-600">{t.loadError}</p>
            ) : (
              <>
                {statement.entries.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">{t.noMoves}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                          <th scope="col" className="px-4 py-2 text-start font-semibold">{t.date}</th>
                          <th scope="col" className="px-4 py-2 text-start font-semibold">{t.desc}</th>
                          <th scope="col" className="px-4 py-2 text-end font-semibold">{t.credit}</th>
                          <th scope="col" className="px-4 py-2 text-end font-semibold">{t.debit}</th>
                          <th scope="col" className="px-4 py-2 text-end font-semibold">{t.balance}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.entries.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-4 py-2 tabular-nums whitespace-nowrap">{e.date?.slice(0, 10)}</td>
                            <td className="px-4 py-2">{e.description}<span className="block text-xs text-slate-400 tabular-nums">{e.reference}</span></td>
                            <td className={`px-4 py-2 ${num}`}>{e.credit ? fmt(e.credit) : ''}</td>
                            <td className={`px-4 py-2 ${num}`}>{e.debit ? fmt(e.debit) : ''}</td>
                            <td className={`px-4 py-2 ${num} font-semibold`}>{fmt(e.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <section className="m-5 p-4 rounded-lg border border-slate-200">
                  <h3 className="flex items-center gap-2 font-bold text-slate-900"><Wallet className="w-4 h-4" />{t.pay}</h3>
                  {owed <= 0 ? (
                    <p className="mt-2 text-sm text-slate-500">{t.settled}</p>
                  ) : (
                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                      <label className="block text-sm"><span className="text-slate-600">{t.amount}</span>
                        <input type="number" min="0" step="0.01" max={owed} value={pay.amount}
                          onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={fmt(owed)}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md tabular-nums" dir="ltr" />
                      </label>
                      <label className="block text-sm"><span className="text-slate-600">{t.date}</span>
                        <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md" />
                      </label>
                      <label className="block text-sm"><span className="text-slate-600">{t.method}</span>
                        <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
                          <option value="bank">{t.bank}</option>
                          <option value="cash">{t.cash}</option>
                        </select>
                      </label>
                      <label className="block text-sm"><span className="text-slate-600">{t.reference}</span>
                        <input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md" dir="ltr" />
                      </label>
                      <div className="sm:col-span-2 flex items-center justify-between gap-3">
                        <p className={`text-sm ${payMsg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{payMsg.text}</p>
                        <button onClick={submitPayment} disabled={paying || !(Number(pay.amount) > 0)}
                          className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-40">
                          {paying ? '…' : t.confirmPay}
                        </button>
                      </div>
                    </div>
                  )}
                  {owed <= 0 && payMsg.text && <p className="mt-2 text-sm text-emerald-700" role="status">{payMsg.text}</p>}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
