/**
 * إقفال الفترات المالية — once a month's VAT return is filed, close the month
 * so nothing can be posted into it and the filed return keeps matching the
 * ledger. Closing: management, CFO, chief accountant. Reopening needs a
 * written justification and is limited to management and the CFO; both are
 * recorded in the audit log.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Lock, Unlock, Loader2 } from 'lucide-react';

const API = `${(process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://')}/api/financial-engine/periods`;
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PeriodClosePanel({ language = 'ar' }) {
  const ar = language === 'ar';
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  const [periods, setPeriods] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const stored = (await axios.get(API, auth())).data.periods || [];
      const byKey = Object.fromEntries(stored.map((p) => [`${p.year}-${p.month}`, p]));
      const now = new Date();
      const list = [];
      for (let i = 1; i <= 12; i++) {                      // the last 12 finished months
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear(), m = d.getMonth() + 1;
        list.push({ year: y, month: m, ...(byKey[`${y}-${m}`] || { status: 'open' }) });
      }
      setPeriods(list);
    } catch { setMsg({ type: 'err', text: ar ? 'تعذّر التحميل' : 'Could not load' }); }
  }, [ar]);
  useEffect(() => { load(); }, [load]);

  const errText = (e) => {
    const d = e.response?.data?.detail;
    if (d && typeof d === 'object') {
      return `${d.message}${d.drafts?.length ? ` (${d.drafts.map((x) => x.entry_number || '—').join('، ')})` : ''}`;
    }
    return d || (ar ? 'تعذّر التنفيذ' : 'Failed');
  };

  const act = async (p, action) => {
    const label = `${ar ? MONTHS_AR[p.month - 1] : MONTHS_EN[p.month - 1]} ${p.year}`;
    let body = { year: p.year, month: p.month };
    if (action === 'close') {
      if (!window.confirm(ar ? `إقفال ${label}؟ لن يمكن الترحيل بتاريخ داخل هذا الشهر.` : `Close ${label}? Nothing can be posted into it.`)) return;
    } else {
      const j = window.prompt(ar ? `سبب إعادة فتح ${label} (إلزامي — يُسجَّل في سجل التدقيق):` : `Reason for reopening ${label} (required, audited):`);
      if (!j || !j.trim()) return;
      body = { ...body, justification: j.trim() };
    }
    setBusy(`${p.year}-${p.month}`); setMsg({ type: '', text: '' });
    try {
      await axios.post(`${API}/${action === 'close' ? 'close' : 'reopen'}`, body, auth());
      setMsg({ type: 'ok', text: ar ? `تم ${action === 'close' ? 'إقفال' : 'إعادة فتح'} ${label}` : `${label} ${action === 'close' ? 'closed' : 'reopened'}` });
      await load();
    } catch (e) { setMsg({ type: 'err', text: errText(e) }); } finally { setBusy(''); }
  };

  if (!periods) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-3">
      <p className="text-sm text-gray-600">
        {ar ? 'بعد تقديم إقرار الشهر، أقفله حتى لا يُرحَّل إليه أي قيد ويظل الإقرار مطابقاً للدفتر. تصحيح قيد في شهر مُقفل يُسجَّل بتاريخ اليوم.'
            : 'After filing a month’s return, close it so nothing can be posted into it. Corrections to a closed month are dated today.'}
      </p>
      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-gray-500 border-b">
            <th scope="col" className="px-4 py-2.5 text-start font-semibold">{ar ? 'الفترة' : 'Period'}</th>
            <th scope="col" className="px-4 py-2.5 text-start font-semibold">{ar ? 'الحالة' : 'Status'}</th>
            <th scope="col" className="px-4 py-2.5 text-start font-semibold">{ar ? 'التفاصيل' : 'Details'}</th>
            <th scope="col" className="px-4 py-2.5"><span className="sr-only">{ar ? 'إجراء' : 'Action'}</span></th>
          </tr></thead>
          <tbody>
            {periods.map((p) => {
              const closed = p.status === 'closed';
              const key = `${p.year}-${p.month}`;
              return (
                <tr key={key} className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-semibold">{ar ? MONTHS_AR[p.month - 1] : MONTHS_EN[p.month - 1]} <span className="tabular-nums">{p.year}</span></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${closed ? 'text-gray-700' : 'text-emerald-700'}`}>
                      {closed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {closed ? (ar ? 'مُقفلة' : 'Closed') : (ar ? 'مفتوحة' : 'Open')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">
                    {closed ? `${(p.closed_at || '').slice(0, 10)}${p.reason ? ` — ${p.reason}` : ''}`
                            : p.reopened_at ? `${ar ? 'أُعيد فتحها' : 'Reopened'} ${(p.reopened_at || '').slice(0, 10)} — ${p.reopen_justification || ''}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <button onClick={() => act(p, closed ? 'reopen' : 'close')} disabled={busy === key}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border disabled:opacity-40 ${closed ? 'border-amber-300 text-amber-800 hover:bg-amber-50' : 'border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50'}`}>
                      {busy === key ? '…' : closed ? (ar ? 'إعادة فتح' : 'Reopen') : (ar ? 'إقفال' : 'Close')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
