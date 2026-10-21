/**
 * إعادة تقييم العملات الأجنبية — نهاية الشهر (معيار المحاسبة المصري 13)
 *
 * Revalues what is still OPEN at month end in a foreign currency — customer
 * and supplier invoices (net of payments and notes) and bank/cash accounts
 * held in a foreign currency — at the closing rate. Gains go to 432, losses
 * to 33611; the entry reverses itself on the 1st of the next month, and a
 * month can only be run once. The invoices keep their original rate.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const BASE = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const API = `${BASE}/api/financial-engine/fx`;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FxRevaluationPage({ language = 'ar' }) {
  const ar = language === 'ar';
  const [month, setMonth] = useState(lastMonth());
  const [runs, setRuns] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [open, setOpen] = useState(null);       // month whose detail is shown
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      setRuns((await axios.get(`${API}/revaluations`, auth())).data.runs || []);
    } catch {
      setRuns([]);
      setMsg({ type: 'err', text: ar ? 'تعذّر تحميل سجل إعادة التقييم' : 'Could not load revaluation runs' });
    }
  }, [ar]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!month) return;
    const ok = window.confirm(ar
      ? `إعادة تقييم أرصدة العملات الأجنبية لشهر ${month}؟ سيُرحَّل قيد بتاريخ آخر يوم في الشهر وقيد عكسي أول الشهر التالي، ولا يمكن التشغيل مرتين لنفس الشهر.`
      : `Revalue foreign-currency balances for ${month}? An entry is posted on the last day of the month and reversed on the 1st of the next; a month can only be run once.`);
    if (!ok) return;
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/revalue`, { month }, auth());
      const net = data.net;
      setMsg({ type: 'ok', text: net === undefined ? data.message
        : `${data.message} — ${ar ? 'صافي' : 'net'} ${net >= 0 ? (ar ? 'ربح' : 'gain') : (ar ? 'خسارة' : 'loss')} ${money(Math.abs(net))} ${ar ? 'ج.م' : 'EGP'}` });
      load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || (ar ? 'تعذّر تنفيذ إعادة التقييم' : 'Revaluation failed') });
    } finally { setBusy(false); }
  };

  const toggle = async (m) => {
    if (open === m) { setOpen(null); return; }
    setOpen(m); setDetail(null);
    try { setDetail((await axios.get(`${API}/revaluations/${m}`, auth())).data); }
    catch { setDetail({ items: [] }); }
  };

  const kindLabel = (k) => ({
    receivable: ar ? 'عميل' : 'Receivable',
    payable: ar ? 'مورد' : 'Payable',
    account: ar ? 'حساب نقدية/بنك' : 'Cash/bank',
  }[k] || k);

  return (
    <div className="p-4 md:p-6 space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{ar ? 'إعادة تقييم العملات الأجنبية' : 'Foreign currency revaluation'}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {ar
            ? 'تقييم الأرصدة المفتوحة بالعملات الأجنبية (العملاء، الموردون، البنوك والخزائن) بسعر إقفال الشهر. الربح ← 432، الخسارة ← 33611، ويُعكس القيد تلقائياً أول الشهر التالي.'
            : 'Revalues open foreign-currency balances (receivables, payables, cash and bank) at the month-end rate. Gain → 432, loss → 33611; reversed automatically on the 1st of the next month.'}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">{ar ? 'الشهر' : 'Month'}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-10 px-3 border border-gray-300 rounded-lg text-sm" />
        </label>
        <button onClick={run} disabled={busy || !month}
          className="h-10 px-4 rounded-lg bg-[#28376B] text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {ar ? 'تشغيل إعادة التقييم' : 'Run revaluation'}
        </button>
        <p className="text-xs text-gray-500 basis-full">
          {ar ? 'يجب إدخال سعر الصرف لآخر يوم في الشهر (أو قبله) من شاشة العملات.' : 'A rate effective on or before the last day of the month must exist in the currencies screen.'}
        </p>
      </div>

      {msg.text && (
        <div className={`rounded-lg p-3 text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3 text-start">{ar ? 'الشهر' : 'Month'}</th>
              <th className="p-3 text-start">{ar ? 'أسعار الإقفال' : 'Closing rates'}</th>
              <th className="p-3 text-start">{ar ? 'أرباح' : 'Gains'}</th>
              <th className="p-3 text-start">{ar ? 'خسائر' : 'Losses'}</th>
              <th className="p-3 text-start">{ar ? 'الصافي' : 'Net'}</th>
              <th className="p-3 text-start">{ar ? 'القيد العكسي' : 'Reversal'}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {runs === null && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            )}
            {runs && runs.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">{ar ? 'لم تُشغَّل إعادة تقييم بعد' : 'No revaluation runs yet'}</td></tr>
            )}
            {runs && runs.map((r) => (
              <React.Fragment key={r.month}>
                <tr className="border-t border-gray-100">
                  <td className="p-3 font-medium">{r.month}</td>
                  <td className="p-3">{Object.entries(r.rates || {}).map(([c, v]) => `${c} ${v}`).join('، ')}</td>
                  <td className="p-3 text-green-700">{money(r.total_gain)}</td>
                  <td className="p-3 text-red-600">{money(r.total_loss)}</td>
                  <td className={`p-3 font-bold ${r.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money(r.net)}</td>
                  <td className="p-3 text-gray-500">{r.reversal_date}</td>
                  <td className="p-3">
                    <button onClick={() => toggle(r.month)} className="text-[#28376B] flex items-center gap-1">
                      {open === r.month ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {ar ? 'التفاصيل' : 'Details'}
                    </button>
                  </td>
                </tr>
                {open === r.month && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="p-3">
                      {!detail ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="p-2 text-start">{ar ? 'النوع' : 'Kind'}</th>
                              <th className="p-2 text-start">{ar ? 'المستند / الحساب' : 'Document / account'}</th>
                              <th className="p-2 text-start">{ar ? 'الرصيد المفتوح' : 'Open balance'}</th>
                              <th className="p-2 text-start">{ar ? 'بالدفاتر (ج.م)' : 'Book EGP'}</th>
                              <th className="p-2 text-start">{ar ? 'بسعر الإقفال (ج.م)' : 'At closing (EGP)'}</th>
                              <th className="p-2 text-start">{ar ? 'الفرق' : 'Difference'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(detail.items || []).map((it, i) => (
                              <tr key={i} className="border-t border-gray-200">
                                <td className="p-2">{kindLabel(it.kind)}</td>
                                <td className="p-2">{it.document_number || `${it.account_code} ${it.account_name || ''}`}{it.party_name ? ` — ${it.party_name}` : ''}</td>
                                <td className="p-2">{money(it.open_foreign)} {it.currency}</td>
                                <td className="p-2">{money(it.book_egp)}</td>
                                <td className="p-2">{money(it.new_egp)}</td>
                                <td className={`p-2 font-medium ${it.nature === 'gain' ? 'text-green-700' : 'text-red-600'}`}>
                                  {it.nature === 'gain' ? (ar ? 'ربح ' : 'gain ') : (ar ? 'خسارة ' : 'loss ')}{money(Math.abs(it.adjustment))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
