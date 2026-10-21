/**
 * التسوية البنكية — Bank reconciliation.
 *
 * 1. اختر حساب البنك (16x) واستورد كشف الحساب (CSV / XLSX / تصدير InstaPay).
 * 2. يطابق النظام كل سطر في الكشف مع قيد مُرحَّل على نفس الحساب (نفس المبلغ،
 *    ±3 أيام، والمرجع / رقم الشيك يرجّح). ما لم يُطابَق يظهر في العمودين.
 * 3. مطابقة يدوية: اختر سطراً من الكشف وسطراً من الدفاتر بنفس المبلغ.
 * 4. البنود التي لم تُسجَّل في الدفاتر (عمولات بنكية / فوائد دائنة) تُرحَّل بقيد.
 * 5. مذكرة التسوية: رصيد الكشف ± البنود المعلقة = رصيد الدفاتر.
 *
 * Backend: /api/bank-reconciliation
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Landmark, Upload, Link2, Unlink, FileText, Loader2, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const BASE = `${API_URL}/api/bank-reconciliation`;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const fmt = (n) => (Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const KIND_LABEL = { auto: 'تلقائي', cheque: 'شيك', manual: 'يدوي', posted: 'قيد تسوية' };

function Amount({ value }) {
  const v = Number(value) || 0;
  return (
    <span className={`tabular-nums whitespace-nowrap font-semibold ${v < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
      {v < 0 ? '−' : '+'}{fmt(Math.abs(v))}
    </span>
  );
}

function Stat({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900', red: 'text-red-700', green: 'text-emerald-700', amber: 'text-amber-700' };
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-extrabold tabular-nums ${tones[tone]}`}>{value}</dd>
    </div>
  );
}

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState([]);
  const [code, setCode] = useState('');
  const [statements, setStatements] = useState([]);
  const [statementId, setStatementId] = useState('');
  const [detail, setDetail] = useState(null);
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('match');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [file, setFile] = useState(null);
  const [closing, setClosing] = useState('');
  const [selLine, setSelLine] = useState('');
  const [selBook, setSelBook] = useState('');
  const [toPost, setToPost] = useState({});           // statement_line_id -> kind

  const say = (type, text) => setMsg({ type, text });

  const loadAccounts = useCallback(async () => {
    try {
      const d = (await axios.get(`${BASE}/bank-accounts`, auth())).data;
      setAccounts(d.accounts || []);
      setCode((c) => c || (d.accounts?.find((a) => a.account_code === '162') || d.accounts?.[0])?.account_code || '');
    } catch (e) { setMsg({ type: 'err', text: errText(e, 'تعذّر تحميل حسابات البنوك') }); }
  }, []);

  const loadStatements = useCallback(async () => {
    if (!code) return;
    try {
      const d = (await axios.get(`${BASE}/statements?bank_account_code=${encodeURIComponent(code)}`, auth())).data;
      setStatements(d.statements || []);
      setStatementId((cur) => (d.statements || []).some((s) => s.id === cur) ? cur : (d.statements?.[0]?.id || ''));
    } catch (e) { setMsg({ type: 'err', text: errText(e, 'تعذّر تحميل الكشوف') }); }
  }, [code]);

  const loadDetail = useCallback(async () => {
    if (!statementId) { setDetail(null); setReport(null); return; }
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        axios.get(`${BASE}/statements/${statementId}`, auth()),
        axios.get(`${BASE}/statements/${statementId}/report`, auth()),
      ]);
      setDetail(d.data); setReport(r.data);
      setSelLine(''); setSelBook(''); setToPost({});
    } catch (e) { setMsg({ type: 'err', text: errText(e, 'تعذّر تحميل الكشف') }); } finally { setLoading(false); }
  }, [statementId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadStatements(); }, [loadStatements]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const refresh = async () => { await loadStatements(); await loadDetail(); };

  const doImport = async () => {
    if (!file || !code) { say('err', 'اختر حساب البنك وملف الكشف'); return; }
    setBusy(true); say('', '');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bank_account_code', code);
    if (closing !== '') fd.append('closing_balance', closing);
    try {
      const d = (await axios.post(`${BASE}/import`, fd, auth())).data;
      say(d.warning ? 'warn' : 'ok', d.warning ? `${d.message} — ${d.warning}` : d.message);
      setFile(null); setClosing('');
      setStatementId(d.statement.id);
      await loadStatements();
    } catch (e) { say('err', errText(e, 'تعذّر استيراد الكشف')); } finally { setBusy(false); }
  };

  const lines = useMemo(() => detail?.lines || [], [detail]);
  const unmatchedLines = useMemo(() => lines.filter((l) => l.status !== 'matched'), [lines]);
  const matchedLines = useMemo(() => lines.filter((l) => l.status === 'matched'), [lines]);
  const books = useMemo(() => detail?.unmatched_book || [], [detail]);
  const line = unmatchedLines.find((l) => l.id === selLine);
  const book = books.find((b) => b.line_id === selBook);
  const canMatch = line && book && Math.abs(line.amount - book.amount) < 0.005;

  const doMatch = async () => {
    if (!canMatch) return;
    setBusy(true); say('', '');
    try {
      await axios.post(`${BASE}/statements/${statementId}/match`,
        { statement_line_id: line.id, entry_id: book.entry_id, line_id: book.line_id }, auth());
      say('ok', 'تمت المطابقة'); await refresh();
    } catch (e) { say('err', errText(e, 'تعذّرت المطابقة')); } finally { setBusy(false); }
  };

  const doUnmatch = async (id) => {
    setBusy(true); say('', '');
    try {
      await axios.post(`${BASE}/statements/${statementId}/unmatch`, { statement_line_id: id }, auth());
      say('ok', 'تم فك المطابقة'); await refresh();
    } catch (e) { say('err', errText(e, 'تعذّر فك المطابقة')); } finally { setBusy(false); }
  };

  const doAutoMatch = async () => {
    setBusy(true); say('', '');
    try {
      const d = (await axios.post(`${BASE}/statements/${statementId}/auto-match`, {}, auth())).data;
      say('ok', d.message); await refresh();
    } catch (e) { say('err', errText(e, 'تعذّرت المطابقة التلقائية')); } finally { setBusy(false); }
  };

  const togglePost = (l) => setToPost((p) => {
    const n = { ...p };
    if (n[l.id]) delete n[l.id]; else n[l.id] = l.amount < 0 ? 'bank_charges' : 'interest';
    return n;
  });

  const doPost = async () => {
    const items = Object.entries(toPost).map(([statement_line_id, kind]) => ({ statement_line_id, kind }));
    if (!items.length) return;
    setBusy(true); say('', '');
    try {
      const d = (await axios.post(`${BASE}/statements/${statementId}/post-unmatched`, { items }, auth())).data;
      say('ok', d.message); await refresh();
    } catch (e) { say('err', errText(e, 'تعذّر ترحيل القيود')); } finally { setBusy(false); }
  };

  const st = detail?.statement;
  const sm = detail?.summary;
  const input = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40';
  const msgTone = { ok: 'text-emerald-700 bg-emerald-50 border-emerald-200', err: 'text-red-700 bg-red-50 border-red-200', warn: 'text-amber-800 bg-amber-50 border-amber-200' };

  return (
    <div dir="rtl" className="min-h-full bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">التسوية البنكية</h1>
            <p className="text-xs text-slate-500">مطابقة كشف حساب البنك مع القيود المرحّلة وإعداد مذكرة التسوية</p>
          </div>
        </div>
        <button onClick={refresh} disabled={busy || loading} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold disabled:opacity-50">
          <RefreshCw className="w-4 h-4" aria-hidden />تحديث
        </button>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        {/* ── account + import ── */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <label className="block text-sm"><span className="text-slate-600">حساب البنك</span>
              <select value={code} onChange={(e) => { setCode(e.target.value); setStatementId(''); }} className={`${input} mt-1`}>
                {!accounts.length && <option value="">— لا توجد حسابات بنوك —</option>}
                {accounts.map((a) => <option key={a.account_code} value={a.account_code}>{a.account_code} — {a.account_name}</option>)}
              </select></label>
            <label className="block text-sm"><span className="text-slate-600">الكشوف المستوردة</span>
              <select value={statementId} onChange={(e) => setStatementId(e.target.value)} className={`${input} mt-1`}>
                {!statements.length && <option value="">— لم يُستورد كشف بعد —</option>}
                {statements.map((s) => (
                  <option key={s.id} value={s.id}>{s.period_from} ← {s.period_to} · {s.file_name} · غير مطابق {s.unmatched_count}</option>
                ))}
              </select></label>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Upload className="w-4 h-4" aria-hidden />استيراد كشف حساب</h2>
            <p className="text-xs text-slate-500">CSV أو Excel (xlsx) — الأعمدة: التاريخ، البيان، المرجع، مدين/دائن أو المبلغ، الرصيد. يُقبل تصدير InstaPay. الملف نفسه لا يُستورد مرتين.</p>
            <div className="grid gap-3 sm:grid-cols-3 items-end">
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">الملف</span>
                <input type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} className={`${input} mt-1`} /></label>
              <label className="block text-sm"><span className="text-slate-600">رصيد آخر المدة (اختياري)</span>
                <input type="number" step="0.01" dir="ltr" value={closing} onChange={(e) => setClosing(e.target.value)}
                  placeholder="من عمود الرصيد" className={`${input} mt-1 tabular-nums`} /></label>
            </div>
            <button onClick={doImport} disabled={busy || !file || !code}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}استيراد ومطابقة
            </button>
          </div>
        </section>

        {msg.text && (
          <div className={`flex items-start justify-between gap-3 text-sm border rounded-md px-3 py-2 ${msgTone[msg.type] || msgTone.ok}`} role="status">
            <span>{msg.text}</span>
            <button onClick={() => say('', '')} aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />جارِ التحميل…</p>}

        {st && sm && (
          <>
            <dl className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Stat label={`رصيد الدفاتر في ${st.period_to}`} value={fmt(sm.book_balance)} />
              <Stat label="رصيد كشف البنك" value={fmt(sm.statement_closing_balance)} />
              <Stat label="مطابق / غير مطابق (الكشف)" value={`${sm.matched} / ${sm.unmatched_statement}`} tone={sm.unmatched_statement ? 'amber' : 'green'} />
              <Stat label="فرق التسوية" value={fmt(report?.difference)} tone={report?.is_reconciled ? 'green' : Math.abs(report?.difference || 0) > 0.004 ? 'red' : 'amber'} />
            </dl>
            {st.warning && <p className="flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="w-4 h-4" aria-hidden />{st.warning}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5" role="tablist">
                {[['match', 'المطابقة'], ['matched', `المطابَق (${matchedLines.length})`], ['report', 'مذكرة التسوية']].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={`px-3.5 py-2 rounded-md text-sm font-semibold ${tab === k ? 'bg-[#1e3a8a] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l}</button>
                ))}
              </div>
              {tab === 'match' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={doAutoMatch} disabled={busy} className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold disabled:opacity-50">إعادة المطابقة التلقائية</button>
                  <button onClick={doMatch} disabled={busy || !canMatch}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-40">
                    <Link2 className="w-4 h-4" aria-hidden />مطابقة المحدد
                  </button>
                  <button onClick={doPost} disabled={busy || !Object.keys(toPost).length}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#1e3a8a] text-[#1e3a8a] bg-white text-sm font-semibold disabled:opacity-40">
                    <FileText className="w-4 h-4" aria-hidden />ترحيل البنود المحددة ({Object.keys(toPost).length})
                  </button>
                </div>
              )}
            </div>
            {tab === 'match' && line && book && !canMatch && (
              <p className="text-sm text-red-700">المبلغان مختلفان ({fmt(line.amount)} / {fmt(book.amount)}) — المطابقة لنفس المبلغ والاتجاه فقط.</p>
            )}

            {tab === 'match' && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* statement side */}
                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <h3 className="px-4 py-2.5 border-b border-slate-200 text-sm font-bold">في كشف البنك فقط ({unmatchedLines.length})</h3>
                  {!unmatchedLines.length ? <p className="p-4 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />كل سطور الكشف مطابَقة</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
                          <th className="px-3 py-2 text-start font-semibold">اختيار</th>
                          <th className="px-3 py-2 text-start font-semibold">التاريخ</th>
                          <th className="px-3 py-2 text-start font-semibold">البيان</th>
                          <th className="px-3 py-2 text-end font-semibold">المبلغ</th>
                          <th className="px-3 py-2 text-start font-semibold">ترحيل كـ</th>
                        </tr></thead>
                        <tbody>
                          {unmatchedLines.map((l) => (
                            <tr key={l.id} className={`border-t border-slate-100 ${selLine === l.id ? 'bg-blue-50' : ''}`}>
                              <td className="px-3 py-2"><input type="radio" name="stline" checked={selLine === l.id} onChange={() => setSelLine(l.id)} aria-label="اختيار للمطابقة" /></td>
                              <td className="px-3 py-2 tabular-nums whitespace-nowrap">{l.date}</td>
                              <td className="px-3 py-2"><div>{l.description || '—'}</div>{l.reference && <div className="text-xs text-slate-500" dir="ltr">{l.reference}</div>}</td>
                              <td className="px-3 py-2 text-end"><Amount value={l.amount} /></td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <label className="flex items-center gap-1.5 text-xs">
                                  <input type="checkbox" checked={!!toPost[l.id]} onChange={() => togglePost(l)} />
                                  {l.amount < 0 ? 'عمولة بنكية (334)' : 'فوائد دائنة (422)'}
                                </label>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                {/* book side */}
                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <h3 className="px-4 py-2.5 border-b border-slate-200 text-sm font-bold">في الدفاتر فقط ({books.length})</h3>
                  {!books.length ? <p className="p-4 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />لا توجد قيود معلقة</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
                          <th className="px-3 py-2 text-start font-semibold">اختيار</th>
                          <th className="px-3 py-2 text-start font-semibold">التاريخ</th>
                          <th className="px-3 py-2 text-start font-semibold">القيد / البيان</th>
                          <th className="px-3 py-2 text-end font-semibold">المبلغ</th>
                        </tr></thead>
                        <tbody>
                          {books.map((b) => {
                            const fits = line && Math.abs(line.amount - b.amount) < 0.005;
                            return (
                              <tr key={b.line_id} className={`border-t border-slate-100 ${selBook === b.line_id ? 'bg-blue-50' : fits ? 'bg-emerald-50/60' : ''}`}>
                                <td className="px-3 py-2"><input type="radio" name="bkline" checked={selBook === b.line_id} onChange={() => setSelBook(b.line_id)} aria-label="اختيار للمطابقة" /></td>
                                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.date}</td>
                                <td className="px-3 py-2"><div className="text-xs text-slate-500 tabular-nums" dir="ltr">{b.entry_number}{b.cheque_number ? ` · CHQ ${b.cheque_number}` : ''}</div><div>{b.description}</div></td>
                                <td className="px-3 py-2 text-end"><Amount value={b.amount} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'matched' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
                    <th className="px-3 py-2 text-start font-semibold">التاريخ</th>
                    <th className="px-3 py-2 text-start font-semibold">بيان الكشف</th>
                    <th className="px-3 py-2 text-end font-semibold">المبلغ</th>
                    <th className="px-3 py-2 text-start font-semibold">القيد المقابل</th>
                    <th className="px-3 py-2 text-start font-semibold">النوع</th>
                    <th className="px-3 py-2" />
                  </tr></thead>
                  <tbody>
                    {matchedLines.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">{l.date}</td>
                        <td className="px-3 py-2">{l.description || l.reference}</td>
                        <td className="px-3 py-2 text-end"><Amount value={l.amount} /></td>
                        <td className="px-3 py-2"><span className="tabular-nums" dir="ltr">{l.match?.entry_number}</span> <span className="text-xs text-slate-500">{l.match?.book_date}</span></td>
                        <td className="px-3 py-2 text-xs">{KIND_LABEL[l.match?.kind] || l.match?.kind}</td>
                        <td className="px-3 py-2 text-end">
                          {l.match?.kind !== 'posted' && (
                            <button onClick={() => doUnmatch(l.id)} disabled={busy} className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline disabled:opacity-50">
                              <Unlink className="w-3.5 h-3.5" aria-hidden />فك
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {tab === 'report' && report && (
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold mb-3">جانب البنك — حتى {report.as_of}</h3>
                  <table className="w-full text-sm"><tbody>
                    <tr><td className="py-1.5">رصيد كشف البنك</td><td className="py-1.5 text-end tabular-nums font-semibold">{fmt(report.bank_side.statement_balance)}</td></tr>
                    <tr><td className="py-1.5">+ إيداعات بالطريق ({report.bank_side.deposits_in_transit.length})</td><td className="py-1.5 text-end tabular-nums">{fmt(report.bank_side.add_deposits_in_transit)}</td></tr>
                    <tr><td className="py-1.5">− شيكات ومدفوعات لم تُصرف ({report.bank_side.outstanding_cheques.length})</td><td className="py-1.5 text-end tabular-nums">({fmt(report.bank_side.less_outstanding_cheques)})</td></tr>
                    <tr className="border-t border-slate-300"><td className="py-1.5 font-bold">الرصيد المعدَّل</td><td className="py-1.5 text-end tabular-nums font-extrabold">{fmt(report.bank_side.adjusted_balance)}</td></tr>
                  </tbody></table>
                  {[...report.bank_side.deposits_in_transit, ...report.bank_side.outstanding_cheques].length > 0 && (
                    <ul className="mt-3 text-xs text-slate-600 space-y-1">
                      {[...report.bank_side.deposits_in_transit, ...report.bank_side.outstanding_cheques].map((b) => (
                        <li key={b.line_id} className="flex justify-between gap-2"><span>{b.date} · {b.description}</span><Amount value={b.amount} /></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold mb-3">جانب الدفاتر</h3>
                  <table className="w-full text-sm"><tbody>
                    <tr><td className="py-1.5">رصيد الدفاتر</td><td className="py-1.5 text-end tabular-nums font-semibold">{fmt(report.book_side.book_balance)}</td></tr>
                    <tr><td className="py-1.5">+ إضافات بالكشف لم تُسجَّل ({report.book_side.unrecorded_credits.length})</td><td className="py-1.5 text-end tabular-nums">{fmt(report.book_side.add_unrecorded_credits)}</td></tr>
                    <tr><td className="py-1.5">− خصومات بالكشف لم تُسجَّل ({report.book_side.unrecorded_debits.length})</td><td className="py-1.5 text-end tabular-nums">({fmt(report.book_side.less_unrecorded_debits)})</td></tr>
                    <tr className="border-t border-slate-300"><td className="py-1.5 font-bold">الرصيد المعدَّل</td><td className="py-1.5 text-end tabular-nums font-extrabold">{fmt(report.book_side.adjusted_balance)}</td></tr>
                  </tbody></table>
                  <div className={`mt-4 rounded-md px-3 py-2 text-sm font-semibold flex items-center gap-2 ${report.is_reconciled ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {report.is_reconciled ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <AlertTriangle className="w-4 h-4" aria-hidden />}
                    الفرق: <span className="tabular-nums">{fmt(report.difference)}</span>
                    {report.is_reconciled ? ' — الحساب مُسوّى' : ' — رحّل بنود الكشف غير المسجلة أو طابقها لإتمام التسوية'}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {!loading && !st && code && (
          <p className="text-sm text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center">استورد كشف حساب البنك لبدء التسوية</p>
        )}
      </div>
    </div>
  );
}
