/**
 * الجرد والإقفال — periodic inventory close.
 * Frequency per company (daily … annual). Closing a period posts only the
 * difference between the counted valuation and the inventory account in the
 * ledger, so cost of goods sold and the balance-sheet stock are right.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const API = `${(process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://')}/api/inventory/inventory-count`;

const T = {
  ar: {
    title: 'الجرد وإقفال المخزون', frequency: 'دورية الجرد', method: 'طريقة التقييم', average: 'المتوسط المرجّح',
    fifo: 'الوارد أولاً يصرف أولاً', invAcc: 'حساب المخزون', save: 'حفظ', next: 'الفترة التالية للإقفال',
    notDue: 'لم تنتهِ بعد — يمكن إقفالها بعد', due: 'جاهزة للإقفال', late: 'متأخرة', days: 'يوم',
    valuation: 'قيمة المخزون (من الجرد)', ledger: 'رصيد المخزون في الدفتر', adjustment: 'قيد التسوية',
    up: 'من ح/ المخزون ← إلى ح/ تكلفة البضاعة', down: 'من ح/ تكلفة البضاعة ← إلى ح/ المخزون', none: 'لا فرق — لن يُرحَّل قيد',
    close: 'إقفال الفترة وترحيل القيد', confirm: 'إقفال الفترة من {s} إلى {e}؟ لا يمكن إقفالها مرة أخرى.',
    lateWarn: 'القيمة المعروضة هي قيمة المخزون الحالية، وقد تختلف عن قيمته في نهاية الفترة. يُفضَّل الإقفال في موعده.',
    history: 'الإقفالات السابقة', period: 'الفترة', done: 'تم الإقفال والترحيل', hint: 'مقترح لنشاط',
    loadError: 'تعذّر التحميل', retry: 'إعادة المحاولة',
    acts: { restaurant: 'مطعم', cafe: 'كافيه', bakery: 'مخبز', retail: 'تجزئة', supermarket: 'سوبر ماركت', pharmacy: 'صيدلية',
            trading: 'تجارة', distribution: 'توزيع', manufacturing: 'تصنيع', construction: 'مقاولات', services: 'خدمات' },
  },
  en: {
    title: 'Inventory count & close', frequency: 'Count frequency', method: 'Valuation method', average: 'Weighted average',
    fifo: 'FIFO', invAcc: 'Inventory account', save: 'Save', next: 'Next period to close',
    notDue: 'Not finished — can be closed after', due: 'Ready to close', late: 'Late', days: 'days',
    valuation: 'Stock value (count)', ledger: 'Inventory in the ledger', adjustment: 'Adjusting entry',
    up: 'Dr Inventory / Cr Cost of goods', down: 'Dr Cost of goods / Cr Inventory', none: 'No difference — nothing to post',
    close: 'Close period and post', confirm: 'Close the period {s} to {e}? It cannot be closed again.',
    lateWarn: 'The value shown is today’s stock value and may differ from its value at period end. Close on time where possible.',
    history: 'Previous closes', period: 'Period', done: 'Closed and posted', hint: 'Suggested for',
    loadError: 'Could not load', retry: 'Retry',
    acts: { restaurant: 'Restaurant', cafe: 'Café', bakery: 'Bakery', retail: 'Retail', supermarket: 'Supermarket', pharmacy: 'Pharmacy',
            trading: 'Trading', distribution: 'Distribution', manufacturing: 'Manufacturing', construction: 'Construction', services: 'Services' },
  },
};

export default function InventoryCountPanel({ language = 'ar' }) {
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const loc = isRTL ? 'ar-EG' : 'en-US';
  const fmt = (n) => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const [status, setStatus] = useState(null);
  const [opts, setOpts] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setError(false);
    try {
      const [s, o] = await Promise.all([axios.get(`${API}/status`, auth()), axios.get(`${API}/settings`, auth())]);
      setStatus(s.data); setOpts(o.data); setCfg(o.data);
    } catch { setError(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveCfg = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.put(`${API}/settings`, { frequency: cfg.frequency, valuation_method: cfg.valuation_method, inventory_account: cfg.inventory_account }, auth());
      await load();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  const close = async () => {
    const np = status.next_period;
    if (!window.confirm(t.confirm.replace('{s}', np.start).replace('{e}', np.end))) return;
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.post(`${API}/close`, {}, auth());
      setMsg({ type: 'ok', text: t.done }); await load();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  if (error) return (
    <div className="p-8 text-center text-sm text-slate-600"><p>{t.loadError}</p>
      <button onClick={load} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button></div>
  );
  if (!status || !cfg) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  const pv = status.preview;
  const suggestions = Object.entries(opts.suggested_by_activity || {}).filter(([, f]) => f === cfg.frequency).map(([a]) => t.acts[a] || a);
  const select = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5 text-slate-800">
      <h2 className="text-lg font-extrabold text-slate-900">{t.title}</h2>

      <section className="grid sm:grid-cols-3 gap-3 p-4 rounded-lg border border-slate-200 bg-white text-sm">
        <label><span className="text-slate-600">{t.frequency}</span>
          <select value={cfg.frequency} onChange={(e) => setCfg({ ...cfg, frequency: e.target.value })} className={select}>
            {Object.entries(opts.frequencies).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : k.replace('_', ' ')}</option>)}
          </select>
          {suggestions.length > 0 && <span className="block mt-1 text-xs text-slate-500">{t.hint}: {suggestions.join('، ')}</span>}
        </label>
        <label><span className="text-slate-600">{t.method}</span>
          <select value={cfg.valuation_method} onChange={(e) => setCfg({ ...cfg, valuation_method: e.target.value })} className={select}>
            <option value="average">{t.average}</option><option value="fifo">{t.fifo}</option>
          </select></label>
        <label><span className="text-slate-600">{t.invAcc}</span>
          <select value={cfg.inventory_account} onChange={(e) => setCfg({ ...cfg, inventory_account: e.target.value })} className={select}>
            <option value="125">125 — {isRTL ? 'بضائع بغرض البيع' : 'Goods for resale'}</option>
            <option value="121">121 — {isRTL ? 'خامات ومواد أولية' : 'Raw materials'}</option>
            <option value="122">122 — {isRTL ? 'إنتاج تام' : 'Finished goods'}</option>
          </select></label>
        <div className="sm:col-span-3 flex justify-end">
          <button onClick={saveCfg} disabled={busy} className="px-4 py-2 rounded-md border border-[#1e3a8a] text-[#1e3a8a] font-semibold disabled:opacity-50">{t.save}</button>
        </div>
      </section>

      <section className="p-4 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">{t.next} — {status.frequency_label}</p>
            <p className="text-xl font-extrabold tabular-nums">{status.next_period.start} ← {status.next_period.end}</p>
          </div>
          {status.due ? (
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${status.late_days > 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {status.late_days > 3 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {status.late_days > 3 ? `${t.late} ${status.late_days} ${t.days}` : t.due}
            </span>
          ) : <span className="text-sm text-slate-500">{t.notDue} {status.next_period.end}</span>}
        </div>

        <dl className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-slate-500">{t.valuation}</dt><dd className="tabular-nums text-lg font-bold">{fmt(pv.valuation)}</dd></div>
          <div><dt className="text-slate-500">{t.ledger}</dt><dd className="tabular-nums text-lg font-bold">{fmt(pv.ledger_balance)}</dd></div>
          <div><dt className="text-slate-500">{t.adjustment}</dt>
            <dd className="tabular-nums text-lg font-extrabold">{fmt(Math.abs(pv.adjustment))}</dd>
            <dd className="text-xs text-slate-500">{pv.adjustment > 0 ? t.up : pv.adjustment < 0 ? t.down : t.none}</dd></div>
        </dl>

        {status.due && status.late_days > 3 && <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">{t.lateWarn}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>
          <button onClick={close} disabled={busy || !status.due}
            className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white font-semibold disabled:opacity-40">{busy ? '…' : t.close}</button>
        </div>
      </section>

      {status.history?.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2">{t.history}</h3>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                {[t.period, t.valuation, t.ledger, t.adjustment].map((h, i) => (
                  <th key={h} scope="col" className={`px-4 py-2 font-semibold ${i ? 'text-end' : 'text-start'}`}>{h}</th>))}
              </tr></thead>
              <tbody>
                {status.history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{h.period_start} ← {h.period_end}</td>
                    <td className="px-4 py-2 tabular-nums text-end">{fmt(h.valuation)}</td>
                    <td className="px-4 py-2 tabular-nums text-end">{fmt(h.ledger_before)}</td>
                    <td className={`px-4 py-2 tabular-nums text-end font-semibold ${h.adjustment < 0 ? 'text-slate-700' : ''}`}>
                      {h.adjustment < 0 ? '−' : h.adjustment > 0 ? '+' : ''}{fmt(Math.abs(h.adjustment))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
