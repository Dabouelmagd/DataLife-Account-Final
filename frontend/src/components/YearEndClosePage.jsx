/**
 * الإقفال السنوي — close a fiscal year: every revenue and expense account
 * (returns, cost of sales included) is closed into 216 Income Summary, whose
 * balance goes to 213 Retained Earnings. The year and all its months are then
 * locked and the next fiscal year is opened. Closing and reopening are limited
 * to top management and the CFO; reopening needs a written justification,
 * reverses the closing entries and is recorded in the audit log.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Lock, Unlock, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';

const API = `${(process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://')}/api/financial-engine/year-end`;

const fmt = (v, ar) => Number(v || 0).toLocaleString(ar ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function yearLabel(fy) {
  const n = parseInt(fy.name, 10);
  if (String(n) === String(fy.name).trim()) return n;
  return parseInt((fy.end_date || '').slice(0, 4), 10);
}

function AmountTable({ title, rows, total, ar }) {
  const td = 'px-4 py-2';
  const num = 'tabular-nums text-end';
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <h3 className="px-4 py-2.5 text-sm font-bold text-gray-700 border-b bg-gray-50">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && <tr><td className={`${td} text-gray-400`} colSpan={2}>{ar ? 'لا توجد حركة' : 'No movement'}</td></tr>}
          {rows.map((r) => (
            <tr key={r.account_code} className="border-b border-gray-100">
              <td className={td}><span className="tabular-nums text-gray-500">{r.account_code}</span> {r.account_name}</td>
              <td className={`${td} ${num} ${r.amount < 0 ? 'text-red-700' : ''}`}>{fmt(r.amount, ar)}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold"><td className={td}>{ar ? 'الإجمالي' : 'Total'}</td><td className={`${td} ${num}`}>{fmt(total, ar)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function YearEndClosePage({ language = 'ar' }) {
  const ar = language === 'ar';
  const [status, setStatus] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const errText = useCallback((e) => {
    const d = e.response?.data?.detail;
    if (d && typeof d === 'object') return d.message || JSON.stringify(d);
    return d || (ar ? 'تعذّر التنفيذ' : 'Failed');
  }, [ar]);

  const loadStatus = useCallback(async () => {
    try {
      const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      setStatus((await axios.get(`${API}/status`, auth)).data);
    } catch (e) { setMsg({ type: 'err', text: errText(e) }); }
  }, [errText]);

  const loadPreview = useCallback(async (fy) => {
    setLoadingPreview(true); setPreview(null);
    try {
      const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      const r = await axios.post(`${API}/close`, { fiscal_year: fy, confirmed: false }, auth);
      setPreview(r.data.preview);
    } catch (e) { setMsg({ type: 'err', text: errText(e) }); } finally { setLoadingPreview(false); }
  }, [errText]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadPreview(year); }, [year, loadPreview]);

  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  // year choices: the defined fiscal years plus the last five calendar years
  const thisYear = new Date().getFullYear();
  const choices = new Map();
  (status?.fiscal_years || []).forEach((fy) => {
    const l = yearLabel(fy);
    if (l) choices.set(l, `${l} (${(fy.start_date || '').slice(0, 10)} → ${(fy.end_date || '').slice(0, 10)})`);
  });
  for (let y = thisYear; y >= thisYear - 5; y--) if (!choices.has(y)) choices.set(y, String(y));
  const options = [...choices.entries()].sort((a, b) => b[0] - a[0]);

  const closeYear = async () => {
    if (!preview) return;
    const net = preview.net_income;
    const text = ar
      ? `إقفال السنة المالية ${preview.fiscal_year} (${preview.start_date} → ${preview.end_date})؟\n`
        + `صافي ${net >= 0 ? 'الربح' : 'الخسارة'}: ${fmt(Math.abs(net), ar)} يُرحَّل إلى الأرباح المرحلة (213).\n`
        + `سيُقفل ${preview.accounts_to_close.length} حساب إيرادات/مصروفات، وتُقفل السنة وكل شهورها فلا يُرحَّل إليها أي قيد.`
      : `Close fiscal year ${preview.fiscal_year} (${preview.start_date} → ${preview.end_date})?\n`
        + `Net ${net >= 0 ? 'profit' : 'loss'} ${fmt(Math.abs(net), ar)} goes to retained earnings (213).\n`
        + `${preview.accounts_to_close.length} revenue/expense accounts will be closed and the year locked.`;
    if (!window.confirm(text)) return;
    setBusy('close'); setMsg({ type: '', text: '' });
    try {
      const r = await axios.post(`${API}/close`, { fiscal_year: preview.fiscal_year, confirmed: true }, auth());
      setMsg({ type: 'ok', text: r.data.message });
      await loadStatus(); await loadPreview(year);
    } catch (e) { setMsg({ type: 'err', text: errText(e) }); } finally { setBusy(''); }
  };

  const reopenYear = async (c) => {
    const j = window.prompt(ar
      ? `سبب إعادة فتح السنة ${c.fiscal_year} (إلزامي — يُسجَّل في سجل التدقيق وتُعكس قيود الإقفال):`
      : `Reason for reopening ${c.fiscal_year} (required, audited; closing entries are reversed):`);
    if (!j || !j.trim()) return;
    setBusy(`r${c.fiscal_year}`); setMsg({ type: '', text: '' });
    try {
      const r = await axios.post(`${API}/reopen`, { fiscal_year: c.fiscal_year, justification: j.trim() }, auth());
      const still = r.data.still_closed_months || [];
      setMsg({ type: 'ok', text: r.data.message + (still.length
        ? (ar ? ` — شهور ما زالت مقفلة يدوياً: ${still.join('، ')}` : ` — months still closed by hand: ${still.join(', ')}`) : '') });
      await loadStatus(); await loadPreview(year);
    } catch (e) { setMsg({ type: 'err', text: errText(e) }); } finally { setBusy(''); }
  };

  if (!status) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;

  const canClose = status.can_close;
  const closings = status.closings || [];
  const th = 'px-4 py-2.5 text-start font-semibold';
  const td = 'px-4 py-2';
  const num = 'tabular-nums text-end';

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4">
      <p className="text-sm text-gray-600">
        {ar ? 'يُقفل كل حسابات الإيرادات والمصروفات (بما فيها المردودات وتكلفة المبيعات) في حـ/216 ملخص الدخل، ثم يُرحَّل الصافي إلى حـ/213 الأرباح المرحلة. بعد الإقفال تُقفل السنة وشهورها وتُفتح السنة التالية.'
            : 'All revenue and expense accounts (returns and cost of sales included) are closed into 216 Income Summary, then the net goes to 213 Retained Earnings. The year and its months are locked and the next year opened.'}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="ye-year" className="text-sm font-semibold text-gray-700">{ar ? 'السنة المالية' : 'Fiscal year'}</label>
        <select id="ye-year" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm tabular-nums">
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {preview && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${preview.already_closed ? 'text-gray-700' : 'text-emerald-700'}`}>
            {preview.already_closed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {preview.already_closed ? (ar ? 'مُقفلة' : 'Closed') : (ar ? 'مفتوحة' : 'Open')}
            <span className="text-gray-500 font-normal tabular-nums">{preview.start_date} → {preview.end_date}</span>
          </span>
        )}
      </div>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      {loadingPreview && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {preview && !loadingPreview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[[ar ? 'صافي الإيرادات' : 'Net revenue', preview.total_revenue, ''],
              [ar ? 'المصروفات والتكاليف' : 'Expenses & costs', preview.total_expense, ''],
              [preview.net_income >= 0 ? (ar ? 'صافي الربح' : 'Net profit') : (ar ? 'صافي الخسارة' : 'Net loss'),
                Math.abs(preview.net_income), preview.net_income >= 0 ? 'text-emerald-700' : 'text-red-700']].map(([l, v, c]) => (
              <div key={l} className="bg-white rounded-xl shadow-sm px-4 py-3">
                <div className="text-xs text-gray-500">{l}</div>
                <div className={`text-xl font-bold tabular-nums ${c}`}>{fmt(v, ar)}</div>
              </div>
            ))}
          </div>

          {(preview.warnings || []).map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{w}
            </p>
          ))}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AmountTable title={ar ? 'الإيرادات (بعد المردودات والخصومات)' : 'Revenue (net of returns)'} rows={preview.revenues} total={preview.total_revenue} ar={ar} />
            <AmountTable title={ar ? 'المصروفات وتكلفة المبيعات' : 'Expenses & cost of sales'} rows={preview.expenses} total={preview.total_expense} ar={ar} />
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <h3 className="px-4 py-2.5 text-sm font-bold text-gray-700 border-b bg-gray-50">
              {ar ? `قيد الإقفال — ${preview.accounts_to_close.length} حساب` : `Closing entry — ${preview.accounts_to_close.length} accounts`}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 border-b">
                  <th scope="col" className={th}>{ar ? 'الحساب' : 'Account'}</th>
                  <th scope="col" className={`${th} text-end`}>{ar ? 'الرصيد' : 'Balance'}</th>
                  <th scope="col" className={`${th} text-end`}>{ar ? 'مدين' : 'Debit'}</th>
                  <th scope="col" className={`${th} text-end`}>{ar ? 'دائن' : 'Credit'}</th>
                </tr></thead>
                <tbody>
                  {preview.accounts_to_close.map((r) => (
                    <tr key={r.account_code} className="border-b border-gray-100">
                      <td className={td}><span className="tabular-nums text-gray-500">{r.account_code}</span> {r.account_name}</td>
                      <td className={`${td} ${num}`}>{fmt(r.balance, ar)} <span className="text-xs text-gray-400">{r.balance_side === 'debit' ? (ar ? 'مدين' : 'Dr') : (ar ? 'دائن' : 'Cr')}</span></td>
                      <td className={`${td} ${num}`}>{r.close_debit ? fmt(r.close_debit, ar) : ''}</td>
                      <td className={`${td} ${num}`}>{r.close_credit ? fmt(r.close_credit, ar) : ''}</td>
                    </tr>
                  ))}
                  {preview.net_income !== 0 && (
                    <tr className="bg-gray-50 font-semibold">
                      <td className={td} colSpan={2}>{ar ? `216 ملخص الدخل ← 213 الأرباح المرحلة` : '216 Income Summary → 213 Retained Earnings'}</td>
                      <td className={`${td} ${num}`}>{preview.net_income < 0 ? fmt(-preview.net_income, ar) : ''}</td>
                      <td className={`${td} ${num}`}>{preview.net_income > 0 ? fmt(preview.net_income, ar) : ''}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!preview.already_closed && (
            <div className="flex items-center gap-3">
              <button onClick={closeYear} disabled={!canClose || busy === 'close' || preview.drafts_count > 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#1e40af] disabled:opacity-40">
                {busy === 'close' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {ar ? `إقفال السنة ${preview.fiscal_year}` : `Close ${preview.fiscal_year}`}
              </button>
              {!canClose && <span className="text-xs text-gray-500">{ar ? 'الإقفال مقصور على الإدارة العليا والمدير المالي' : 'Only top management and the CFO can close'}</span>}
            </div>
          )}
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h3 className="px-4 py-2.5 text-sm font-bold text-gray-700 border-b bg-gray-50">{ar ? 'السنوات المقفلة' : 'Closed years'}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 border-b">
              <th scope="col" className={th}>{ar ? 'السنة' : 'Year'}</th>
              <th scope="col" className={th}>{ar ? 'الفترة' : 'Range'}</th>
              <th scope="col" className={`${th} text-end`}>{ar ? 'صافي النتيجة' : 'Net result'}</th>
              <th scope="col" className={th}>{ar ? 'أُقفلت في' : 'Closed on'}</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">{ar ? 'إجراء' : 'Action'}</span></th>
            </tr></thead>
            <tbody>
              {closings.length === 0 && <tr><td className={`${td} text-gray-400`} colSpan={5}>{ar ? 'لم تُقفل أي سنة بعد' : 'No year closed yet'}</td></tr>}
              {closings.map((c) => (
                <tr key={c.fiscal_year} className="border-b border-gray-100">
                  <td className={`${td} font-semibold tabular-nums`}>{c.fiscal_year}</td>
                  <td className={`${td} tabular-nums text-xs text-gray-500`}>{c.start_date || `${c.fiscal_year}-01-01`} → {c.end_date || c.close_date}</td>
                  <td className={`${td} ${num} ${(c.net_income || 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(c.net_income, ar)}</td>
                  <td className={`${td} tabular-nums text-xs text-gray-500`}>{(c.closed_at || c.started_at || '').slice(0, 10)}{c.status && c.status !== 'closed' ? ` (${c.status})` : ''}</td>
                  <td className={`${td} text-end`}>
                    {canClose && (
                      <button onClick={() => reopenYear(c)} disabled={busy === `r${c.fiscal_year}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-40">
                        <RotateCcw className="w-3.5 h-3.5" />{busy === `r${c.fiscal_year}` ? '…' : (ar ? 'إعادة فتح' : 'Reopen')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(status.reopenings || []).length > 0 && (
        <details className="bg-white rounded-xl shadow-sm px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-gray-700">{ar ? 'سجل إعادة الفتح' : 'Reopen history'}</summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {status.reopenings.map((r) => (
              <li key={`${r.fiscal_year}-${r.reopened_at}`} className="tabular-nums">
                {r.fiscal_year} — {(r.reopened_at || '').slice(0, 10)} — {r.reopen_justification}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
