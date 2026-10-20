/**
 * الرواتب ← كشف المرتبات: كل موظف بكل مشتملات راتبه في جدول واحد —
 * الأساسي، كل بدل في عمود، الاستحقاق، الأجر التأميني، كل نوع خصم في عمود،
 * الصافي، حصة الشركة في التأمينات والتكلفة الكلية — مع فلتر بالإدارة/القسم
 * والفرع وبحث، وإجماليات للمعروض، وتصدير Excel بنفس الفلتر.
 * Backend: GET /api/payroll/runs/{id}/sheet[?department&branch&format=xlsx]
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Download, Search } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS = { draft: 'مسودة', calculated: 'محسوب', approved: 'معتمد', paid: 'مصروف' };
const sel = 'px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';

function M({ v, strong }) {
  return <bdi dir="ltr" className={`tabular-nums ${strong ? 'font-bold' : ''} ${!Number(v) ? 'text-slate-300' : ''}`}>{money(v)}</bdi>;
}

export default function PayrollSheet() {
  const [runs, setRuns] = useState(null);
  const [runId, setRunId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/payroll/runs`, auth())
      .then((r) => {
        const list = (r.data.payroll_runs || r.data.runs || []).slice().sort((a, b) => String(b.month).localeCompare(String(a.month)));
        setRuns(list);
        if (list[0]) setRunId(list[0].id);
      })
      .catch(() => { setRuns([]); setErr('تعذّر تحميل مسيرات الرواتب'); });
  }, []);

  useEffect(() => {
    if (!runId) return;
    setLoading(true); setErr('');
    axios.get(`${API}/api/payroll/runs/${runId}/sheet`, { ...auth(), params: { department: department || undefined, branch: branch || undefined } })
      .then((r) => setSheet(r.data))
      .catch((e) => { setSheet(null); setErr(e?.response?.data?.detail || 'تعذّر تحميل الكشف'); })
      .finally(() => setLoading(false));
  }, [runId, department, branch]);

  // the search narrows what is shown; totals follow what is shown
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = sheet?.rows || [];
    if (!t) return all;
    return all.filter((r) => [r.employee_name, r.employee_code, r.position].some((v) => String(v || '').toLowerCase().includes(t)));
  }, [sheet, q]);

  const total = (f) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);

  const download = async () => {
    setBusy(true);
    try {
      const res = await axios.get(`${API}/api/payroll/runs/${runId}/sheet`, {
        ...auth(), responseType: 'blob', params: { department: department || undefined, branch: branch || undefined, format: 'xlsx' },
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `كشف-المرتبات-${sheet?.run?.month || ''}${department ? `-${department}` : ''}${branch ? `-${branch}` : ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setErr('تعذّر تنزيل الملف'); } finally { setBusy(false); }
  };

  if (runs === null) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!runs.length) return <p className="py-12 text-center text-slate-500 text-sm">لا توجد مسيرات رواتب بعد — أنشئ مسيراً واحسبه أولاً.</p>;

  const A = sheet?.allowance_columns || [];
  const D = sheet?.deduction_columns || [];
  const th = 'px-3 py-2 font-semibold text-start whitespace-nowrap';
  const td = 'px-3 py-2 whitespace-nowrap';
  const stick = 'sticky start-0 z-10 bg-white dark:bg-slate-900';

  return (
    <div className="space-y-4 text-sm" dir="rtl">
      <div className="flex flex-wrap items-end gap-2">
        <label><span className="block text-slate-600 mb-1">المسير</span>
          <select className={sel} value={runId} onChange={(e) => { setRunId(e.target.value); setDepartment(''); setBranch(''); }}>
            {runs.map((r) => <option key={r.id} value={r.id}>{r.month} — {r.run_number || ''} ({STATUS[r.status] || r.status})</option>)}
          </select></label>
        <label><span className="block text-slate-600 mb-1">الإدارة / القسم</span>
          <select className={sel} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">كل الإدارات</option>
            {(sheet?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select></label>
        {(sheet?.branches || []).length > 0 && (
          <label><span className="block text-slate-600 mb-1">الفرع</span>
            <select className={sel} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">كل الفروع</option>
              {sheet.branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select></label>
        )}
        <label className="relative flex-1 min-w-[200px]"><span className="block text-slate-600 mb-1">بحث</span>
          <Search className="w-4 h-4 absolute bottom-2.5 start-3 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم أو الكود أو الوظيفة" className={`${sel} w-full ps-9`} /></label>
        <button onClick={download} disabled={busy || !sheet?.rows?.length}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">
          <Download className="w-4 h-4" aria-hidden />{busy ? '…' : 'تصدير Excel'}</button>
      </div>

      {err && <p role="alert" className="text-red-700">{err}</p>}
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : sheet && (
        rows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">
            {sheet.rows.length ? 'لا نتائج لهذا البحث' : 'المسير لا يحتوي موظفين — أضف ملفات الموظفين من «الموارد البشرية ← الموظفون» ثم أعد حساب المسير.'}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[['عدد الموظفين', rows.length, true], ['إجمالي الاستحقاق', total((r) => r.gross_salary)], ['إجمالي الخصومات', total((r) => r.total_deductions)],
                ['صافي المرتبات', total((r) => r.net_salary)], ['التكلفة على الشركة', total((r) => r.total_cost)]].map(([l, v, count]) => (
                <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-lg font-extrabold">{count ? v : <M v={v} />}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[70vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className={`${th} ${stick} bg-slate-100 dark:bg-slate-800`} rowSpan={2}>الموظف</th>
                    <th className={th} rowSpan={2}>الإدارة / القسم</th>
                    <th className={th} rowSpan={2}>الأساسي</th>
                    {A.length > 0 && <th className={`${th} text-center border-s border-slate-200 bg-emerald-50 dark:bg-emerald-900/20`} colSpan={A.length}>البدلات والإضافي</th>}
                    <th className={`${th} bg-emerald-50 dark:bg-emerald-900/20`} rowSpan={2}>إجمالي الاستحقاق</th>
                    <th className={th} rowSpan={2}>الأجر التأميني</th>
                    <th className={`${th} text-center border-s border-slate-200 bg-red-50 dark:bg-red-900/20`} colSpan={D.length}>الخصومات</th>
                    <th className={`${th} bg-red-50 dark:bg-red-900/20`} rowSpan={2}>إجمالي الخصومات</th>
                    <th className={`${th} bg-blue-50 dark:bg-blue-900/20`} rowSpan={2}>صافي المرتب</th>
                    <th className={th} rowSpan={2}>تأمينات حصة الشركة</th>
                    <th className={th} rowSpan={2}>التكلفة على الشركة</th>
                    <th className={th} rowSpan={2}>أيام الحضور</th>
                  </tr>
                  <tr>
                    {A.map((c) => <th key={c} className={`${th} bg-emerald-50 dark:bg-emerald-900/20`}>{c}</th>)}
                    {D.map((d) => <th key={d.key} className={`${th} bg-red-50 dark:bg-red-900/20`}>{d.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className={`${td} ${stick}`}>
                        <span className="font-semibold">{r.employee_name}</span>
                        <span className="block text-slate-500">{[r.employee_code, r.position].filter(Boolean).join(' · ')}</span></td>
                      <td className={td}>{r.department || '—'}{r.branch && <span className="block text-slate-500">{r.branch}</span>}</td>
                      <td className={td}><M v={r.basic_salary} /></td>
                      {A.map((c) => <td key={c} className={td}><M v={r.allowances[c]} /></td>)}
                      <td className={td}><M v={r.gross_salary} strong /></td>
                      <td className={td}><M v={r.insured_salary} /></td>
                      {D.map((d) => <td key={d.key} className={td}><M v={r.deductions[d.key]} /></td>)}
                      <td className={td}><M v={r.total_deductions} strong /></td>
                      <td className={`${td} text-blue-800 dark:text-blue-300`}><M v={r.net_salary} strong /></td>
                      <td className={td}><M v={r.company_social_insurance} /></td>
                      <td className={td}><M v={r.total_cost} /></td>
                      <td className={`${td} tabular-nums`}>{r.present_days ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-blue-50 dark:bg-slate-800 font-bold">
                  <tr>
                    <td className={`${td} ${stick} bg-blue-50 dark:bg-slate-800`}>الإجمالي ({rows.length})</td>
                    <td className={td} />
                    <td className={td}><M v={total((r) => r.basic_salary)} /></td>
                    {A.map((c) => <td key={c} className={td}><M v={total((r) => r.allowances[c])} /></td>)}
                    <td className={td}><M v={total((r) => r.gross_salary)} /></td>
                    <td className={td} />
                    {D.map((d) => <td key={d.key} className={td}><M v={total((r) => r.deductions[d.key])} /></td>)}
                    <td className={td}><M v={total((r) => r.total_deductions)} /></td>
                    <td className={td}><M v={total((r) => r.net_salary)} /></td>
                    <td className={td}><M v={total((r) => r.company_social_insurance)} /></td>
                    <td className={td}><M v={total((r) => r.total_cost)} /></td>
                    <td className={td} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {!department && Object.keys(sheet.by_department || {}).length > 1 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <h3 className="px-4 py-2 font-bold bg-slate-50 dark:bg-slate-800">ملخص حسب الإدارة / القسم</h3>
                <table className="w-full">
                  <thead className="text-slate-500"><tr>
                    {['الإدارة / القسم', 'الموظفون', 'الاستحقاق', 'الصافي', 'التكلفة على الشركة'].map((h) => <th key={h} className="px-4 py-2 text-start font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(sheet.by_department).map(([d, g]) => (
                      <tr key={d} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50" onClick={() => d !== 'بدون قسم' && setDepartment(d)}>
                        <td className="px-4 py-2 font-semibold">{d}</td><td className="px-4 py-2 tabular-nums">{g.employees}</td>
                        <td className="px-4 py-2"><M v={g.gross_salary} /></td><td className="px-4 py-2"><M v={g.net_salary} /></td>
                        <td className="px-4 py-2"><M v={g.total_cost} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
