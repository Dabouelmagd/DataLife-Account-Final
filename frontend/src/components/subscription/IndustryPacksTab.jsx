/**
 * باقات القطاعات وفواتير الاشتراك — two tabs added to the subscription page.
 *
 * Activating a pack injects its accounts into the company's chart, so the
 * screen says how many were added and makes clear that deactivating keeps any
 * account that already has entries against it.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Layers, Check, Loader2, Receipt, Download, Send, AlertTriangle, Building2,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function IndustryPacksTab({ language = 'ar' }) {
  const ar = language === 'ar';
  const [packs, setPacks] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/subscriptions/industry-packs`, auth());
      setPacks(data.packs || []);
    } catch (e) {
      setPacks([]);
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر تحميل الباقات' : 'Could not load packs') });
    }
  }, [ar]);
  useEffect(() => { load(); }, [load]);

  const [months, setMonths] = useState(1);

  const toggle = async (pack) => {
    // a pack is a paid add-on: subscribing records a request, and the accounts
    // are injected only after the payment is confirmed
    const action = pack.active ? 'deactivate' : 'request';
    if (pack.active && !window.confirm(ar
      ? `إيقاف ${pack.name_ar}؟ ستختفي شاشاتها، وتبقى الحسابات التي تحرّكت عليها قيود.`
      : `Deactivate ${pack.name_en}? Accounts with entries against them stay.`)) return;
    setBusy(pack.key); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(
        `${API}/api/subscriptions/industry-packs/${pack.key}/${action}`,
        pack.active ? {} : { months }, auth());
      const detail = pack.active
        ? (ar ? `حُذف ${data.accounts_removed} حساب، وبقي ${data.accounts_kept} عليه قيود`
              : `${data.accounts_removed} removed, ${data.accounts_kept} kept`)
        : (ar ? `المستحق ${Number(data.amount_due || 0).toLocaleString()} ج.م — ${data.next_step || ''}`
              : `Due: ${data.amount_due}`);
      setMsg({ type: 'ok', text: `${data.message} — ${detail}` });
      load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر التنفيذ' : 'Failed') });
    } finally { setBusy(''); }
  };

  if (packs === null) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#1e3a8a]" aria-hidden />
          {ar ? 'باقات القطاعات' : 'Industry packs'}
        </h3>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          {ar ? 'اشتراكك الأساسي يشغّل الشركة بالكامل — والتخصص إضافة اختيارية فوقه، تضيف حسابات نشاطك وشاشاته. فعّل ما يخص نشاطك فقط، فالحسابات غير المستخدمة تُربك الشجرة والتقارير، ويمكنك الإضافة أو الإيقاف في أي وقت.'
              : 'Your base subscription runs the whole business; an add-on sits on top of it and brings your sector’s accounts and screens. Activate only what you do — unused accounts clutter the chart — and add or stop them at any time.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">{ar ? 'مدة الاشتراك:' : 'Duration:'}</span>
        {[[1, ar ? 'شهر' : '1 mo'], [3, ar ? '3 شهور' : '3 mo'],
          [6, ar ? '6 شهور' : '6 mo'], [12, ar ? 'سنة' : '1 yr']].map(([m, label]) => (
          <button key={m} onClick={() => setMonths(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${months === m
              ? 'bg-[#1e3a8a] text-white' : 'border border-slate-300 text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {msg.text && (
        <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {packs.map((p) => (
          <div key={p.key}
            className={`rounded-2xl border p-4 flex flex-col ${p.active ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-slate-900">{ar ? p.name_ar : p.name_en}</h4>
              {p.active && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden />{ar ? 'مفعّلة' : 'Active'}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 flex-1">{p.note_ar}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-xs text-slate-500">
                {ar ? `${p.accounts_count} حساب` : `${p.accounts_count} accounts`}
              </p>
              {p.price_egp != null && !p.active && (
                <p className="text-lg font-extrabold text-[#1e3a8a] tabular-nums">
                  {p.price_egp}
                  <span className="text-xs font-normal text-slate-500 ms-1">{ar ? 'ج.م/شهر' : 'EGP/mo'}</span>
                </p>
              )}
            </div>

            {p.pending_payment ? (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                {ar ? `طلب قائم — المستحق ${Number(p.amount_due || 0).toLocaleString()} ج.م. تُفعَّل بعد تأكيد السداد.`
                    : `Requested — ${p.amount_due} due. Activates once payment is confirmed.`}
              </div>
            ) : (
              <button onClick={() => toggle(p)} disabled={busy === p.key}
                className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                  p.active ? 'border border-red-300 text-red-700' : 'bg-[#1e3a8a] text-white'}`}>
                {busy === p.key ? '…' : p.active ? (ar ? 'إيقاف' : 'Deactivate')
                  : (ar ? `اشترك — ${p.price_egp} ج.م/شهر` : `Subscribe — ${p.price_egp}/mo`)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionInvoicesTab({ language = 'ar' }) {
  const ar = language === 'ar';
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/subscriptions/invoices`, auth());
      setData(res.data);
    } catch { setData({ invoices: [], total: 0, total_paid: 0 }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resend = async (number) => {
    setBusy(number); setMsg({ type: '', text: '' });
    try {
      const { data: d } = await axios.post(
        `${API}/api/subscriptions/invoices/${number}/resend`, {}, auth());
      setMsg({ type: 'ok', text: d.message });
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر الإرسال' : 'Could not send') });
    } finally { setBusy(''); }
  };

  const open = (number) => {
    // the printable invoice needs the token, so fetch and open the markup
    axios.get(`${API}/api/subscriptions/invoices/${number}`, { ...auth(), responseType: 'text' })
      .then((r) => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(r.data); w.document.close(); }
      })
      .catch(() => setMsg({ type: 'err', text: ar ? 'تعذّر فتح الفاتورة' : 'Could not open the invoice' }));
  };

  if (data === null) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1e3a8a]" aria-hidden />
            {ar ? 'الفواتير الضريبية' : 'Tax invoices'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {ar ? 'فاتورة لكل دفعة اشتراك، بالرقم الضريبي وقيمة الضريبة منفصلة.' : 'One per subscription payment.'}
          </p>
        </div>
        {data.total > 0 && (
          <p className="text-sm text-slate-600">
            {ar ? 'إجمالي المدفوع:' : 'Total paid:'} <b className="tabular-nums">{money(data.total_paid)}</b>
          </p>
        )}
      </div>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      {data.invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600">
          <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" aria-hidden />
          {ar ? 'لا توجد فواتير بعد — تصدر تلقائياً عند تسجيل أي دفعة اشتراك.'
              : 'No invoices yet — one is issued automatically with each payment.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">{ar ? 'رقم الفاتورة' : 'Number'}</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">{ar ? 'التاريخ' : 'Date'}</th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">{ar ? 'قبل الضريبة' : 'Net'}</th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">{ar ? 'الضريبة' : 'VAT'}</th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">{ar ? 'الإجمالي' : 'Total'}</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">إجراءات</span></th>
            </tr></thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.invoice_number} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-semibold" dir="ltr">{inv.invoice_number}</td>
                  <td className="px-4 py-2.5">{inv.issue_date}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{money(inv.net_amount)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-slate-500">{money(inv.vat_amount)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums font-bold">{money(inv.total_amount)}</td>
                  <td className="px-4 py-2.5 text-end whitespace-nowrap">
                    <button onClick={() => open(inv.invoice_number)}
                      className="inline-flex items-center gap-1 text-[#1e3a8a] text-xs font-semibold me-3">
                      <Download className="w-3.5 h-3.5" aria-hidden />{ar ? 'عرض/طباعة' : 'View'}
                    </button>
                    <button onClick={() => resend(inv.invoice_number)} disabled={busy === inv.invoice_number}
                      className="inline-flex items-center gap-1 text-slate-600 text-xs font-semibold disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" aria-hidden />{ar ? 'إعادة الإرسال' : 'Resend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
        {ar ? 'إعادة الإرسال لا تُصدر رقماً جديداً — الفاتورة الواحدة تحمل رقمها الأصلي دائماً.'
            : 'Resending never issues a new number.'}
      </p>
    </div>
  );
}
