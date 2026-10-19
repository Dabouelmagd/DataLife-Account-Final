/**
 * سندات الصرف — صرف مبلغ من الخزينة أو من أي حساب بنكي.
 *
 * The form asks what an accountant needs on a payment voucher: paid from
 * (cash box or a specific bank), paid to, for what (the counter account,
 * searchable), amount, date. Saving posts the journal entry on the server;
 * the voucher only exists if its entry does.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowUpFromLine, Loader2, Search, X, Printer } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const errText = (e, f) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d[0]?.msg || f;
  return f;
};
const norm = (s) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export function PaymentVoucherForm({ onClose, onSaved, defaultSource }) {
  const [sources, setSources] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ source: defaultSource || '', amount: '', date: today(), counter: null,
    beneficiary: '', description: '', reference: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/payment-vouchers/sources`, auth());
        setSources(data.sources || []);
        setF((x) => ({ ...x, source: x.source || data.sources?.[0]?.id || '' }));
      } catch (e) { setSources([]); setErr(errText(e, 'تعذّر تحميل الخزينة والبنوك')); }
      try {
        const { data } = await axios.get(`${API}/api/accounting/accounts`, auth());
        setAccounts((data.accounts || data || [])
          .filter((a) => !a.is_header && a.account_category !== 'header')
          .sort((a, b) => String(a.account_code).localeCompare(String(b.account_code))));
      } catch { /* the search list stays empty and the error shows on save */ }
    })();
  }, []);

  const source = (sources || []).find((s) => s.id === f.source);
  const options = useMemo(() => {
    const k = norm(q.trim());
    return accounts.filter((a) => a.account_code !== source?.account_code &&
      (!k || String(a.account_code).startsWith(k) || norm(a.account_name).includes(k))).slice(0, 40);
  }, [accounts, q, source]);

  const amount = Number(f.amount);
  const short = source && amount > 0 && amount > source.balance;
  const ready = f.source && amount > 0 && f.counter && f.beneficiary.trim().length >= 2
    && f.description.trim().length >= 3 && !(short && source.kind === 'cash');

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/api/payment-vouchers`, {
        source: f.source, amount, date: f.date, counter_account_id: f.counter.id,
        beneficiary: f.beneficiary.trim(), description: f.description.trim(), reference: f.reference.trim() || undefined,
      }, auth());
      onSaved?.(data);
    } catch (e) { setErr(errText(e, 'تعذّر حفظ السند')); } finally { setBusy(false); }
  };

  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white';
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-rose-600" aria-hidden />سند صرف</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {sources === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
            <label className="sm:col-span-2"><span className="text-slate-600">الصرف من *</span>
              <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={input}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.kind === 'cash' ? '💵 ' : '🏦 '}{s.label}</option>
                ))}
              </select>
              {source && (
                <span className={`block mt-1 text-xs ${source.balance > 0 ? 'text-slate-500' : 'text-amber-700'}`}>
                  الرصيد في الدفتر: <bdi dir="ltr" className="tabular-nums font-semibold">{money(source.balance)}</bdi>
                  {source.kind === 'bank' && sources.filter((s) => s.account_code === source.account_code && s.kind === 'bank').length > 1
                    && ` (إجمالي البنوك على حساب ${source.account_code})`}
                </span>
              )}
            </label>

            <label><span className="text-slate-600">المبلغ *</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={f.amount} autoFocus
                onChange={(e) => setF({ ...f, amount: e.target.value })} className={`${input} tabular-nums`} /></label>
            <label><span className="text-slate-600">التاريخ</span>
              <input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
            {short && (
              <p className={`sm:col-span-2 text-xs ${source.kind === 'cash' ? 'text-red-700' : 'text-amber-700'}`} role="alert">
                {source.kind === 'cash' ? 'المبلغ أكبر من رصيد الخزينة — لا يمكن الصرف.' : 'المبلغ أكبر من رصيد البنك في الدفتر — سيصبح الحساب مكشوفاً.'}
              </p>
            )}

            <label className="sm:col-span-2"><span className="text-slate-600">صُرف إلى (المستفيد) *</span>
              <input value={f.beneficiary} onChange={(e) => setF({ ...f, beneficiary: e.target.value })}
                placeholder="مثال: شركة الكهرباء، أحمد محمد" className={input} /></label>

            <div className="sm:col-span-2">
              <span className="text-slate-600">الحساب المقابل (على أي حساب يُحمَّل) *</span>
              {f.counter ? (
                <div className="mt-1 flex items-center justify-between px-3 py-2 border border-[#1e3a8a] rounded-lg bg-blue-50">
                  <span><span className="tabular-nums text-slate-500 me-2">{f.counter.account_code}</span>{f.counter.account_name}</span>
                  <button onClick={() => setF({ ...f, counter: null })} aria-label="تغيير الحساب" className="p-0.5"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <label className="relative block mt-1">
                    <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
                    <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                      placeholder="ابحث بالاسم أو الكود: إيجار، 335، موردون…" className={`${input} ps-9 mt-0`} />
                  </label>
                  <ul className="mt-1 max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {options.length === 0 ? <li className="px-3 py-2 text-slate-500">لا توجد حسابات مطابقة</li> : options.map((a) => (
                      <li key={a.id}><button type="button" onClick={() => setF({ ...f, counter: a })}
                        className="w-full text-start px-3 py-1.5 hover:bg-slate-50">
                        <span className="tabular-nums text-slate-400 me-2">{a.account_code}</span>{a.account_name}</button></li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <label className="sm:col-span-2"><span className="text-slate-600">البيان *</span>
              <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder="مثال: إيجار مكتب شهر أكتوبر" className={input} /></label>
            <label className="sm:col-span-2"><span className="text-slate-600">رقم مرجعي (شيك / تحويل / فاتورة)</span>
              <input dir="ltr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={input} /></label>

            {f.counter && source && amount > 0 && (
              <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs leading-6">
                <p className="font-bold text-slate-700 mb-1">القيد الذي سيُرحَّل:</p>
                <p>من ح/ {f.counter.account_code} {f.counter.account_name} — مدين <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
                <p>إلى ح/ {source.account_code} {source.label} — دائن <bdi dir="ltr" className="tabular-nums">{money(amount)}</bdi></p>
              </div>
            )}
          </div>
        )}

        {err && <p className="mx-5 mb-3 text-sm text-red-700" role="alert">{err}</p>}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
          <button onClick={save} disabled={busy || !ready}
            className="px-5 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50">
            {busy ? '…' : 'صرف وترحيل القيد'}</button>
        </div>
      </div>
    </div>
  );
}

function printVoucher(v) {
  const w = window.open('', '_blank', 'width=720,height=640');
  if (!w) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(v.number)}</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;padding:32px;color:#0f172a}h1{font-size:22px;margin:0 0 4px}
  table{width:100%;border-collapse:collapse;margin-top:18px}td{border:1px solid #cbd5e1;padding:10px;font-size:14px}
  td:first-child{background:#f8fafc;width:32%;font-weight:bold}.sig{display:flex;justify-content:space-between;margin-top:60px;font-size:13px}
  .num{direction:ltr;unicode-bidi:isolate}</style></head><body>
  <h1>سند صرف</h1><div>رقم <span class="num">${esc(v.number)}</span> — التاريخ <span class="num">${esc(v.date)}</span></div>
  <table><tr><td>المبلغ</td><td class="num">${esc(money(v.amount))} ج.م</td></tr>
  <tr><td>صُرف إلى</td><td>${esc(v.beneficiary)}</td></tr><tr><td>البيان</td><td>${esc(v.description)}</td></tr>
  <tr><td>الصرف من</td><td>${esc(v.source_label)} (${esc(v.source_account_code)})</td></tr>
  <tr><td>الحساب المقابل</td><td>${esc(v.counter_account_code)} — ${esc(v.counter_account_name)}</td></tr>
  <tr><td>رقم القيد</td><td class="num">${esc(v.journal_entry_number)}</td></tr>
  ${v.reference ? `<tr><td>المرجع</td><td class="num">${esc(v.reference)}</td></tr>` : ''}</table>
  <div class="sig"><span>المحاسب: ..................</span><span>المدير المالي: ..................</span><span>المستلم: ..................</span></div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function PaymentVouchersList({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setRows((await axios.get(`${API}/api/payment-vouchers`, auth())).data.vouchers || []); }
    catch (e) { setRows([]); setErr(errText(e, 'تعذّر تحميل السندات')); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (rows === null) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (err) return <p className="text-sm text-red-700">{err}</p>;
  if (!rows.length) return <p className="py-10 text-center text-slate-500 text-sm">لا توجد سندات صرف بعد — اضغط «سند صرف» لتسجيل أول مبلغ مصروف.</p>;
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto" dir="rtl">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{['رقم السند', 'التاريخ', 'من', 'إلى', 'البيان', 'الحساب المقابل', 'المبلغ', 'القيد', ''].map((h) => (
            <th key={h} className="px-3 py-2 text-start font-semibold whitespace-nowrap">{h}</th>))}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 tabular-nums whitespace-nowrap" dir="ltr">{v.number}</td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">{v.date}</td>
              <td className="px-3 py-2 whitespace-nowrap">{v.source === 'cash' ? '💵 ' : '🏦 '}{v.source_label}</td>
              <td className="px-3 py-2">{v.beneficiary}</td>
              <td className="px-3 py-2 max-w-[220px] truncate" title={v.description}>{v.description}</td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="tabular-nums text-slate-400 me-1">{v.counter_account_code}</span>{v.counter_account_name}</td>
              <td className="px-3 py-2 font-bold text-rose-700 whitespace-nowrap"><bdi dir="ltr" className="tabular-nums">{money(v.amount)}</bdi></td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap" dir="ltr">{v.journal_entry_number}</td>
              <td className="px-3 py-2"><button onClick={() => printVoucher(v)} aria-label="طباعة السند" className="p-1.5 rounded hover:bg-slate-100">
                <Printer className="w-4 h-4 text-slate-500" /></button></td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-bold">
          <tr><td className="px-3 py-2" colSpan={6}>الإجمالي ({rows.length} سند)</td>
            <td className="px-3 py-2 text-rose-700"><bdi dir="ltr" className="tabular-nums">{money(total)}</bdi></td><td colSpan={2}></td></tr>
        </tfoot>
      </table>
    </div>
  );
}
