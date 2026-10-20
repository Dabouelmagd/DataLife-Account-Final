/**
 * شاشات الموارد البشرية المتقدمة — كانت موجودة في الخلفية بلا واجهة:
 *   AppraisalsPage     — تقييم الأداء ومؤشرات KPI وترحيل الزيادة للراتب (/api/performance)
 *   HRToolsPage        — رصيد الإجازات وطلبها، الوقت الإضافي، الجزاءات، سياسة الموارد البشرية (/api/hr-engine)
 *   EndOfServicePage   — مكافأة نهاية الخدمة، تصفية وإخلاء الطرف، استمارات التأمينات 1/2/6 (/api/hr-engine, /api/hr-advanced)
 *   LoansCustodyPage   — سلف الموظفين والعهد العينية (/api/hr-advanced)
 *   CommissionsPage    — عمولات مندوبي المبيعات (/api/hr-advanced/commissions)
 *   GovPaymentsPage    — المدفوعات الحكومية ونموذج 4 وتصدير منظومة البيرول (/api/gov)
 * Every entry the server posts is previewed first; the server recomputes it
 * and refuses an unbalanced entry or an account that does not take postings.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Printer, Download, Check, RotateCcw } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btn = 'inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50';
const btn2 = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50';
const th = 'text-start px-2 py-2 whitespace-nowrap';
const td = 'px-2 py-1.5';
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;
const L = ({ children }) => <bdi dir="ltr">{children}</bdi>;

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm space-y-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

/** rows: [label, debit, credit] — or server lines {account_code, account_name, debit, credit} */
function Lines({ rows, title = 'القيد الذي سيُرحَّل:' }) {
  const list = (rows || []).map((r) => (Array.isArray(r) ? r : [`${r.account_code} ${r.account_name || ''}`, r.debit, r.credit]))
    .filter((r) => r[1] || r[2]);
  const dr = r2(list.reduce((s, r) => s + (Number(r[1]) || 0), 0));
  const cr = r2(list.reduce((s, r) => s + (Number(r[2]) || 0), 0));
  if (!list.length) return null;
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs">
      <p className="font-bold mb-2">{title}</p>
      <table className="w-full">
        <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={i}><td className="py-0.5">{r[0]}</td>
              <td className="text-end">{r[1] ? <N v={r[1]} /> : ''}</td><td className="text-end">{r[2] ? <N v={r[2]} /> : ''}</td></tr>
          ))}
          <tr className="border-t border-slate-300 font-bold"><td className="pt-1">الإجمالي</td><td className="text-end pt-1"><N v={dr} /></td><td className="text-end pt-1"><N v={cr} /></td></tr>
        </tbody>
      </table>
      {Math.abs(dr - cr) > 0.01 && <p className="mt-2 text-red-700">غير متوازن — راجع الأرقام</p>}
    </div>
  );
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${value === k ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500'}`}>{label}</button>
      ))}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return <label className={`text-sm block ${className}`}><span className="text-slate-600 dark:text-slate-300">{label}</span>{children}</label>;
}

function Stat({ label, value, money: isMoney = true }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-extrabold">{isMoney ? <N v={value} /> : <L>{value}</L>}</p>
    </div>
  );
}

const Err = ({ msg }) => (msg ? <p className="text-sm text-red-700" role="alert">{msg}</p> : null);
const Ok = ({ msg }) => (msg ? <p className="text-sm text-emerald-700" role="status">{msg}</p> : null);
const Loading = () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" aria-label="جارٍ التحميل" /></div>;

function useEmployees() {
  const [emps, setEmps] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/employees`, auth()).then((r) => setEmps(r.data?.employees || [])).catch(() => setEmps([]));
  }, []);
  return emps;
}

function EmpSelect({ emps, value, onChange, all = false }) {
  const list = all ? emps : emps.filter((e) => e.is_active !== false && e.status !== 'terminated');
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">— اختر الموظف —</option>
      {list.map((e) => <option key={e.id} value={e.id}>{e.name}{e.employee_code ? ` (${e.employee_code})` : ''}</option>)}
    </select>
  );
}

const PAY_SRC = [['bank', '162 البنك'], ['cash', '161 الخزينة']];
const payLabel = (s) => (s === 'cash' ? '161 الخزينة' : '162 البنك');

/* ═════════════════════════ تقييم الأداء ═════════════════════════ */

const RECS = { none: 'لا توصية', salary_increment: 'زيادة راتب', promotion: 'ترقية', pip: 'خطة تحسين أداء (PIP)' };
const STATUS_AR = { draft: 'مسودة', approved: 'معتمد', rejected: 'مرفوض' };

export function AppraisalsPage() {
  const emps = useEmployees();
  const [data, setData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [period, setPeriod] = useState('');
  const [form, setForm] = useState(null);
  const [tmplForm, setTmplForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const { data: d } = await axios.get(`${API}/api/performance/appraisals`, { ...auth(), params: period ? { review_period: period } : {} });
      setData(d);
    } catch (e) { setData({ appraisals: [] }); setErr(errText(e, 'تعذّر تحميل التقييمات')); }
  };
  const loadTemplates = () => axios.get(`${API}/api/performance/kpi-templates`, auth()).then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
  useEffect(() => { load(); loadTemplates(); }, []);

  const newForm = () => {
    setErr(''); setMsg('');
    setForm({ employee_id: '', review_period: period || `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      period_type: 'quarterly', review_date: today(), manager_recommendation: 'none', salary_increment_percentage: 0,
      promotion_to_title: '', manager_notes: '', kpi_scores: [{ kpi_name: '', weight: 100, score: '', target: '', actual: '' }] });
  };
  const setKpi = (i, k, v) => setForm((f) => ({ ...f, kpi_scores: f.kpi_scores.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (t) setForm((f) => ({ ...f, kpi_scores: t.kpis.map((k) => ({ kpi_name: k.name_ar || k.name, weight: k.weight, score: '', target: k.target || '', actual: '' })) }));
  };
  const score = useMemo(() => {
    if (!form) return 0;
    const w = form.kpi_scores.reduce((s, k) => s + (+k.weight || 0), 0);
    return w ? r2(form.kpi_scores.reduce((s, k) => s + (+k.score || 0) * (+k.weight || 0), 0) / w) : 0;
  }, [form]);
  const emp = form && emps.find((e) => e.id === form.employee_id);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { ...form, salary_increment_percentage: +form.salary_increment_percentage || 0,
        kpi_scores: form.kpi_scores.map((k) => ({ ...k, weight: +k.weight || 0, score: +k.score || 0 })),
        promotion_to_title: form.promotion_to_title || undefined };
      const { data: d } = await axios.post(`${API}/api/performance/appraisals`, body, auth());
      setMsg(d.message); setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ التقييم')); } finally { setBusy(false); }
  };
  const act = async (fn, okText) => {
    setBusy(true); setErr(''); setMsg('');
    try { const { data: d } = await fn(); setMsg(d?.message || okText); load(); } catch (e) { setErr(errText(e, 'تعذّر تنفيذ العملية')); } finally { setBusy(false); }
  };
  const saveTemplate = async () => {
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/api/performance/kpi-templates`, { name: tmplForm.name, department: tmplForm.department || undefined,
        kpis: tmplForm.kpis.map((k) => ({ name: k.name, name_ar: k.name, weight: +k.weight || 0, target: k.target })) }, auth());
      setTmplForm(null); loadTemplates();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ القالب')); } finally { setBusy(false); }
  };

  const rows = data?.appraisals || [];
  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">📈 تقييم الأداء</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTmplForm({ name: '', department: '', kpis: [{ name: '', weight: 100, target: '' }] })} className={btn2}>قوالب المؤشرات ({templates.length})</button>
          <button onClick={newForm} className={btn}><Plus className="w-4 h-4" aria-hidden /> تقييم جديد</button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="فترة التقييم"><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q1 أو 2026-Annual" dir="ltr" className={`${input} w-48`} /></Field>
        <button onClick={load} className={btn2}>عرض</button>
        {data?.pending_payroll_apply > 0 && (
          <button disabled={busy} className={btn2}
            onClick={() => window.confirm(`ترحيل ${data.pending_payroll_apply} زيادة معتمدة لرواتب الموظفين؟`) &&
              act(() => axios.post(`${API}/api/performance/appraisals/bulk-apply`, { apply_from_month: thisMonth(), review_period: period || undefined }, auth()))}>
            ترحيل كل الزيادات المعتمدة ({data.pending_payroll_apply})</button>
        )}
      </div>
      <Err msg={err} /><Ok msg={msg} />
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="عدد التقييمات" value={data.total || 0} money={false} />
          <Stat label="متوسط الدرجة" value={data.avg_score || 0} money={false} />
          <Stat label="يتجاوز التوقعات فأعلى" value={(data.distribution?.exceptional || 0) + (data.distribution?.exceeds || 0)} money={false} />
          <Stat label="أقل من المطلوب" value={(data.distribution?.needs_improvement || 0) + (data.distribution?.unsatisfactory || 0)} money={false} />
        </div>
      )}
      {!data ? <Loading /> : rows.length === 0 ? <p className="text-slate-500 py-8 text-center">لا توجد تقييمات بعد — ابدأ بـ «تقييم جديد».</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800"><tr>
              <th className={th}>الموظف</th><th className={th}>الفترة</th><th className={th}>الدرجة</th><th className={th}>التقدير</th>
              <th className={th}>التوصية</th><th className={th}>الحالة</th><th className={th}>إجراء</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((a) => (
                <tr key={a.appraisal_id}>
                  <td className={td}>{a.employee_name}<div className="text-xs text-slate-500">{a.department}</div></td>
                  <td className={td}><L>{a.review_period}</L></td>
                  <td className={`${td} font-bold`}><L>{Number(a.kpi_score).toFixed(1)}</L></td>
                  <td className={td}>{a.rating_ar}</td>
                  <td className={td}>{a.recommendation_ar}{a.salary_increment_percentage > 0 && <> — <L>{a.salary_increment_percentage}%</L></>}</td>
                  <td className={td}>{STATUS_AR[a.status] || a.status}{a.is_applied_to_payroll && <span className="block text-xs text-emerald-700">رُحِّلت للراتب من <L>{a.applied_from_month}</L></span>}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {a.status === 'draft' && <>
                      <button disabled={busy} className={btn2} onClick={() => act(() => axios.post(`${API}/api/performance/appraisals/${a.appraisal_id}/approve`, { decision: 'approved' }, auth()))}><Check className="w-4 h-4" aria-hidden /> اعتماد</button>{' '}
                      <button disabled={busy} className={btn2} onClick={() => act(() => axios.post(`${API}/api/performance/appraisals/${a.appraisal_id}/approve`, { decision: 'rejected' }, auth()))}>رفض</button>
                    </>}
                    {a.status === 'approved' && !a.is_applied_to_payroll && a.salary_increment_percentage > 0 && (
                      <button disabled={busy} className={btn2}
                        onClick={() => window.confirm(`رفع الراتب الأساسي لـ ${a.employee_name} بنسبة ${a.salary_increment_percentage}% (من ${money(a.current_salary)} إلى ${money(a.current_salary * (1 + a.salary_increment_percentage / 100))})؟`) &&
                          act(() => axios.post(`${API}/api/performance/appraisals/${a.appraisal_id}/apply-to-payroll`, { apply_from_month: thisMonth() }, auth()))}>
                        ترحيل الزيادة للراتب</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="تقييم أداء جديد" onClose={() => setForm(null)}
          footer={<><button onClick={() => setForm(null)} className={btn2}>إلغاء</button>
            <button onClick={save} disabled={busy || !form.employee_id} className={btn}>{busy ? '…' : 'حفظ كمسودة'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الموظف"><EmpSelect emps={emps} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} /></Field>
            <Field label="فترة التقييم"><input dir="ltr" value={form.review_period} onChange={(e) => setForm({ ...form, review_period: e.target.value })} className={input} /></Field>
            <Field label="النوع"><select value={form.period_type} onChange={(e) => setForm({ ...form, period_type: e.target.value })} className={input}>
              <option value="quarterly">ربع سنوي</option><option value="annual">سنوي</option><option value="probation">فترة اختبار</option></select></Field>
            <Field label="تاريخ التقييم"><input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} className={input} /></Field>
          </div>
          {templates.length > 0 && <Field label="تعبئة من قالب"><select onChange={(e) => applyTemplate(e.target.value)} className={input} defaultValue="">
            <option value="">—</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
          <div className="space-y-2">
            <p className="font-bold">المؤشرات (الدرجة من 100، ومجموع الأوزان أي رقم — يُحسب متوسطاً مرجحاً)</p>
            {form.kpi_scores.map((k, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                <Field label="المؤشر" className="col-span-2"><input value={k.kpi_name} onChange={(e) => setKpi(i, 'kpi_name', e.target.value)} className={input} /></Field>
                <Field label="الوزن %"><input type="number" dir="ltr" value={k.weight} onChange={(e) => setKpi(i, 'weight', e.target.value)} className={input} /></Field>
                <Field label="الدرجة"><input type="number" min="0" max="100" dir="ltr" value={k.score} onChange={(e) => setKpi(i, 'score', e.target.value)} className={input} /></Field>
                <button onClick={() => setForm({ ...form, kpi_scores: form.kpi_scores.filter((_, j) => j !== i) })} className={btn2} aria-label="حذف المؤشر"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, kpi_scores: [...form.kpi_scores, { kpi_name: '', weight: 0, score: '' }] })} className={btn2}><Plus className="w-4 h-4" aria-hidden /> مؤشر</button>
            <p className="font-bold">الدرجة الإجمالية: <L>{score.toFixed(2)}</L></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="توصية المدير"><select value={form.manager_recommendation} onChange={(e) => setForm({ ...form, manager_recommendation: e.target.value })} className={input}>
              {Object.entries(RECS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="نسبة الزيادة %"><input type="number" min="0" max="100" dir="ltr" value={form.salary_increment_percentage} onChange={(e) => setForm({ ...form, salary_increment_percentage: e.target.value })} className={input} /></Field>
            {form.manager_recommendation === 'promotion' && <Field label="المسمى الجديد"><input value={form.promotion_to_title} onChange={(e) => setForm({ ...form, promotion_to_title: e.target.value })} className={input} /></Field>}
          </div>
          {emp && +form.salary_increment_percentage > 0 && (
            <p className="text-xs text-slate-600">الراتب الأساسي الحالي <N v={emp.basic_salary} /> ← بعد الزيادة <N v={(emp.basic_salary || 0) * (1 + form.salary_increment_percentage / 100)} /> (يُطبَّق بعد الاعتماد والترحيل)</p>
          )}
          <p className="text-xs text-slate-500">الترقية تتطلب درجة 80 فأكثر، وخطة تحسين الأداء لأقل من 70.</p>
          <Field label="ملاحظات المدير"><textarea rows={2} value={form.manager_notes} onChange={(e) => setForm({ ...form, manager_notes: e.target.value })} className={input} /></Field>
          <Err msg={err} />
        </Modal>
      )}

      {tmplForm && (
        <Modal title="قوالب مؤشرات الأداء" onClose={() => setTmplForm(null)}
          footer={<><button onClick={() => setTmplForm(null)} className={btn2}>إغلاق</button>
            <button onClick={saveTemplate} disabled={busy || !tmplForm.name} className={btn}>حفظ القالب</button></>}>
          {templates.length > 0 && <ul className="list-disc pe-5 text-slate-600">{templates.map((t) => <li key={t.id}>{t.name} — {t.kpi_count} مؤشر{t.department ? ` — ${t.department}` : ''}</li>)}</ul>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="اسم القالب"><input value={tmplForm.name} onChange={(e) => setTmplForm({ ...tmplForm, name: e.target.value })} className={input} /></Field>
            <Field label="القسم (اختياري)"><input value={tmplForm.department} onChange={(e) => setTmplForm({ ...tmplForm, department: e.target.value })} className={input} /></Field>
          </div>
          {tmplForm.kpis.map((k, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <Field label="المؤشر" className="col-span-2"><input value={k.name} onChange={(e) => setTmplForm({ ...tmplForm, kpis: tmplForm.kpis.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={input} /></Field>
              <Field label="الوزن %"><input type="number" dir="ltr" value={k.weight} onChange={(e) => setTmplForm({ ...tmplForm, kpis: tmplForm.kpis.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} className={input} /></Field>
              <button onClick={() => setTmplForm({ ...tmplForm, kpis: tmplForm.kpis.filter((_, j) => j !== i) })} className={btn2} aria-label="حذف"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setTmplForm({ ...tmplForm, kpis: [...tmplForm.kpis, { name: '', weight: 0 }] })} className={btn2}><Plus className="w-4 h-4" aria-hidden /> مؤشر</button>
          <p className="text-xs">مجموع الأوزان: <L>{tmplForm.kpis.reduce((s, k) => s + (+k.weight || 0), 0)}%</L> (يجب أن يكون 100%)</p>
          <Err msg={err} />
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════ الإجازات والوقت الإضافي والجزاءات ═════════════════════ */

const POLICY_FIELDS = [
  ['annual_leave_days', 'أيام الإجازة السنوية'], ['annual_leave_days_senior', 'الإجازة السنوية للأقدمية / السن'],
  ['senior_service_years', 'سنوات الخدمة للأقدمية'], ['senior_age', 'السن المستحق للإجازة الأطول'],
  ['casual_leave_days_per_year', 'الإجازة العارضة في السنة'], ['casual_leave_max_per_request', 'أقصى عارضة في المرة'],
  ['max_carryover_days', 'أقصى رصيد يُرحَّل للسنة التالية'], ['penalty_monthly_cap_days', 'حد خصم الجزاءات في الشهر (أيام)'],
  ['gratuity_months_first_5', 'مكافأة: شهور عن كل سنة من الخمس الأولى'], ['gratuity_months_after_5', 'مكافأة: شهور عن كل سنة بعدها'],
  ['resignation_factor_under_3', 'معامل الاستقالة قبل 3 سنوات (0–1)'], ['resignation_factor_3_to_5', 'معامل الاستقالة 3–5 سنوات'],
  ['resignation_factor_5_to_10', 'معامل الاستقالة 5–10 سنوات'], ['resignation_factor_10_plus', 'معامل الاستقالة بعد 10 سنوات'],
];
const LEAVE_AR = { annual: 'سنوية', casual: 'عارضة', sick: 'مرضية', unpaid: 'بدون أجر' };
const OT_AR = { day: 'نهاري', night: 'ليلي', holiday: 'عطلة رسمية' };

export function HRToolsPage() {
  const emps = useEmployees();
  const [tab, setTab] = useState('leave');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // leave
  const [empId, setEmpId] = useState('');
  const [bal, setBal] = useState(null);
  const [leave, setLeave] = useState({ leave_type: 'annual', start_date: today(), end_date: today(), reason: '' });
  // overtime
  const [ot, setOt] = useState([{ date: today(), hours: '', type: 'day' }]);
  const [otRes, setOtRes] = useState(null);
  // penalties
  const [schedule, setSchedule] = useState(null);
  const [pens, setPens] = useState(null);
  const [pen, setPen] = useState({ violation: '', deduct_days: '', deduct_hours: '', date: today() });
  // policy
  const [policy, setPolicy] = useState(null);
  const [policyNote, setPolicyNote] = useState('');

  const clear = () => { setErr(''); setMsg(''); };
  const loadBal = async (id) => {
    setBal(null); if (!id) return;
    try { const { data } = await axios.get(`${API}/api/hr-engine/leave/balance/${id}`, auth()); setBal(data); } catch (e) { setErr(errText(e, 'تعذّر تحميل الرصيد')); }
  };
  const loadPens = () => axios.get(`${API}/api/hr-engine/penalties`, { ...auth(), params: { month: thisMonth() } }).then((r) => setPens(r.data)).catch(() => setPens({ penalties: [] }));
  useEffect(() => {
    axios.get(`${API}/api/hr-engine/penalties/schedule`, auth()).then((r) => setSchedule(r.data)).catch(() => {});
    axios.get(`${API}/api/hr-engine/policy`, auth()).then((r) => { setPolicy(r.data.policy); setPolicyNote(r.data.note); }).catch(() => {});
    loadPens();
  }, []);

  const pickEmp = (id) => { setEmpId(id); clear(); setOtRes(null); loadBal(id); };
  const requestLeave = async () => {
    setBusy(true); clear();
    try { const { data } = await axios.post(`${API}/api/hr-engine/leave/request`, { ...leave, employee_id: empId }, auth()); setMsg(data.message); loadBal(empId); }
    catch (e) { setErr(errText(e, 'تعذّر تقديم الطلب')); } finally { setBusy(false); }
  };
  const calcOt = async () => {
    setBusy(true); clear();
    try { const { data } = await axios.post(`${API}/api/hr-engine/overtime/calculate`, { employee_id: empId, entries: ot.map((x) => ({ ...x, hours: +x.hours })) }, auth()); setOtRes(data); }
    catch (e) { setErr(errText(e, 'تعذّر الحساب')); } finally { setBusy(false); }
  };
  const applyPen = async () => {
    setBusy(true); clear();
    try { const { data } = await axios.post(`${API}/api/hr-engine/penalties/apply`, { ...pen, employee_id: empId, deduct_days: +pen.deduct_days || 0, deduct_hours: +pen.deduct_hours || 0 }, auth()); setMsg(data.message); loadPens(); }
    catch (e) { setErr(errText(e, 'تعذّر تسجيل الجزاء')); } finally { setBusy(false); }
  };
  const savePolicy = async () => {
    setBusy(true); clear();
    try { const { data } = await axios.put(`${API}/api/hr-engine/policy`, policy, auth()); setPolicy(data.policy); setMsg(data.message); }
    catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const carryover = async () => {
    const y = new Date().getFullYear() - 1;
    if (!window.confirm(`ترحيل أرصدة الإجازات من ${y} إلى ${y + 1} لكل الموظفين؟`)) return;
    setBusy(true); clear();
    try { const { data } = await axios.post(`${API}/api/hr-engine/leave/carryover`, { year: y }, auth()); setMsg(`${data.message} — ${data.employees_processed} موظف`); }
    catch (e) { setErr(errText(e, 'تعذّر الترحيل')); } finally { setBusy(false); }
  };

  const empPicker = <Field label="الموظف" className="max-w-sm"><EmpSelect emps={emps} value={empId} onChange={pickEmp} /></Field>;
  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <h1 className="text-2xl font-extrabold">🗓️ الإجازات والوقت الإضافي والجزاءات</h1>
      <Tabs value={tab} onChange={(t) => { setTab(t); clear(); }} tabs={[['leave', 'رصيد الإجازات'], ['ot', 'الوقت الإضافي'], ['pen', 'الجزاءات'], ['policy', 'السياسة']]} />
      <Err msg={err} /><Ok msg={msg} />

      {tab === 'leave' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">{empPicker}
            <button onClick={carryover} disabled={busy} className={btn2}><RotateCcw className="w-4 h-4" aria-hidden /> ترحيل أرصدة نهاية السنة</button></div>
          {empId && !bal && <Loading />}
          {bal && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="الاستحقاق السنوي" value={bal.annual_leave.entitlement} money={false} />
                <Stat label="مُرحَّل من العام السابق" value={bal.annual_leave.carried_over} money={false} />
                <Stat label="المستهلك هذا العام" value={bal.annual_leave.taken} money={false} />
                <Stat label="الرصيد المتاح" value={bal.annual_leave.balance} money={false} />
              </div>
              <p className="text-sm text-slate-600">العارضة: استُهلك <L>{bal.casual_leave.taken}</L> من <L>{bal.casual_leave.max_per_year}</L> ({bal.casual_leave.note}) — المرضية: <L>{bal.sick_leave.taken}</L> يوم — سنوات الخدمة <L>{bal.service_years}</L></p>
              <p className="text-xs text-amber-700">{bal.policy_note}</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <p className="font-bold">طلب إجازة (يظهر في شاشة الإجازات للاعتماد)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="النوع"><select value={leave.leave_type} onChange={(e) => setLeave({ ...leave, leave_type: e.target.value })} className={input}>
                    {Object.entries(LEAVE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  <Field label="السبب"><input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} className={input} /></Field>
                  <Field label="من"><input type="date" value={leave.start_date} onChange={(e) => setLeave({ ...leave, start_date: e.target.value })} className={input} /></Field>
                  <Field label="إلى"><input type="date" value={leave.end_date} onChange={(e) => setLeave({ ...leave, end_date: e.target.value })} className={input} /></Field>
                </div>
                <button onClick={requestLeave} disabled={busy} className={btn}>تقديم الطلب</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'ot' && (
        <div className="space-y-3">
          {empPicker}
          {ot.map((x, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <Field label="التاريخ"><input type="date" value={x.date} onChange={(e) => setOt(ot.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} className={input} /></Field>
              <Field label="الساعات"><input type="number" dir="ltr" value={x.hours} onChange={(e) => setOt(ot.map((y, j) => (j === i ? { ...y, hours: e.target.value } : y)))} className={input} /></Field>
              <Field label="النوع"><select value={x.type} onChange={(e) => setOt(ot.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))} className={input}>
                {Object.entries(OT_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <button onClick={() => setOt(ot.filter((_, j) => j !== i))} className={btn2} aria-label="حذف"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => setOt([...ot, { date: today(), hours: '', type: 'day' }])} className={btn2}><Plus className="w-4 h-4" aria-hidden /> يوم</button>
            <button onClick={calcOt} disabled={busy || !empId} className={btn}>احسب</button>
          </div>
          {otRes && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-1">
              <p>أجر الساعة: <N v={otRes.hourly_rate} /> — المعاملات ({otRes.rates_source}): نهاري <L>×{otRes.rates.day}</L>، ليلي <L>×{otRes.rates.night}</L>، عطلة <L>×{otRes.rates.holiday}</L></p>
              {otRes.ot_breakdown.map((b, i) => <p key={i}><L>{b.date}</L> — <L>{b.hours}</L> ساعة {OT_AR[b.type]} = <N v={b.ot_pay} /></p>)}
              <p className="font-extrabold">الإجمالي: <N v={otRes.total_ot_pay} /> ج.م</p>
              <p className="text-xs text-slate-500">المعاملات تُضبط من إعدادات الموارد البشرية في الرواتب، وهي نفسها التي يصرف بها الكشف.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'pen' && (
        <div className="space-y-4">
          {empPicker}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            {schedule && <Field label="من جدول الجزاءات"><select className={input} defaultValue="" onChange={(e) => {
              const s = schedule.schedule[+e.target.value]; if (s) setPen({ ...pen, violation: s.violation, deduct_days: s.deduct_days || '', deduct_hours: s.deduct_hours || '' });
            }}><option value="">—</option>{schedule.schedule.map((s, i) => <option key={i} value={i}>{s.violation} — {s.deduct_days ? `${s.deduct_days} يوم` : `${s.deduct_hours} ساعة`}</option>)}</select></Field>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="المخالفة"><input value={pen.violation} onChange={(e) => setPen({ ...pen, violation: e.target.value })} className={input} /></Field>
              <Field label="التاريخ"><input type="date" value={pen.date} onChange={(e) => setPen({ ...pen, date: e.target.value })} className={input} /></Field>
              <Field label="خصم أيام"><input type="number" dir="ltr" value={pen.deduct_days} onChange={(e) => setPen({ ...pen, deduct_days: e.target.value })} className={input} /></Field>
              <Field label="خصم ساعات"><input type="number" dir="ltr" value={pen.deduct_hours} onChange={(e) => setPen({ ...pen, deduct_hours: e.target.value })} className={input} /></Field>
            </div>
            {schedule && <p className="text-xs text-slate-500">{schedule.max_deduction}</p>}
            <button onClick={applyPen} disabled={busy || !empId} className={btn}>تسجيل الجزاء</button>
          </div>
          <p className="font-bold">جزاءات هذا الشهر</p>
          {!pens ? <Loading /> : (pens.penalties || []).length === 0 ? <p className="text-slate-500">لا توجد جزاءات.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                <th className={th}>التاريخ</th><th className={th}>الموظف</th><th className={th}>المخالفة</th><th className={`${th} text-end`}>الخصم</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pens.penalties.map((p) => <tr key={p.id}><td className={td}><L>{p.date}</L></td><td className={td}>{p.employee_name}</td><td className={td}>{p.violation}</td><td className={`${td} text-end`}><N v={p.amount} /></td></tr>)}
                </tbody></table>
            </div>
          )}
        </div>
      )}

      {tab === 'policy' && (!policy ? <Loading /> : (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-amber-700">{policyNote}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POLICY_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}><input type="number" step="any" dir="ltr" value={policy[k] ?? ''} onChange={(e) => setPolicy({ ...policy, [k]: e.target.value })} className={input} /></Field>
            ))}
            <label className="text-sm flex items-center gap-2 mt-6"><input type="checkbox" checked={!!policy.gratuity_enabled} onChange={(e) => setPolicy({ ...policy, gratuity_enabled: e.target.checked })} /> صرف مكافأة نهاية خدمة</label>
          </div>
          <button onClick={savePolicy} disabled={busy} className={btn}>حفظ السياسة</button>
        </div>
      ))}
    </div>
  );
}

/* ═════════════════════ نهاية الخدمة والاستمارات ═════════════════════ */

const REASONS = { resignation: 'استقالة', retirement: 'تقاعد', dismissal: 'إنهاء من صاحب العمل', death: 'وفاة', disability: 'عجز كلي' };

export function EndOfServicePage() {
  const emps = useEmployees();
  const [tab, setTab] = useState('clearance');
  const [empId, setEmpId] = useState('');
  const [termDate, setTermDate] = useState(today());
  const [reason, setReason] = useState('resignation');
  const [gratAcc, setGratAcc] = useState('223');
  const [paySrc, setPaySrc] = useState('bank');
  const [res, setRes] = useState(null);
  const [grat, setGrat] = useState(null);
  const [gratAmount, setGratAmount] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const reset = () => { setRes(null); setGrat(null); setForm(null); setErr(''); setMsg(''); };
  const previewClearance = async () => {
    setBusy(true); reset();
    try {
      const { data } = await axios.post(`${API}/api/hr-advanced/offboarding/${empId}/clearance`,
        { termination_date: termDate, termination_reason: reason, gratuity_account: gratAcc, payment_source: paySrc, dry_run: true }, auth());
      setRes(data);
    } catch (e) { setErr(errText(e, 'تعذّر حساب التصفية')); } finally { setBusy(false); }
  };
  const postClearance = async (force) => {
    if (!window.confirm('ترحيل التصفية وإنهاء خدمة الموظف؟ لا يمكن التراجع من هنا.')) return;
    setBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/api/hr-advanced/offboarding/${empId}/clearance`,
        { termination_date: termDate, termination_reason: reason, gratuity_account: gratAcc, payment_source: paySrc, force_clear: !!force }, auth());
      if (data.clearance_blocked) setRes(data); else { setMsg(data.message + (data.warning ? ` — ${data.warning}` : '')); setRes(null); }
    } catch (e) { setErr(errText(e, 'تعذّر ترحيل التصفية')); } finally { setBusy(false); }
  };
  const calcGrat = async () => {
    setBusy(true); reset();
    try {
      const { data } = await axios.get(`${API}/api/hr-engine/gratuity/calculate/${empId}`, { ...auth(), params: { termination_date: termDate, termination_reason: reason } });
      setGrat(data); setGratAmount(data.gratuity || '');
    } catch (e) { setErr(errText(e, 'تعذّر الحساب')); } finally { setBusy(false); }
  };
  const postGrat = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/api/hr-engine/gratuity/post/${empId}`,
        { amount: +gratAmount, date: termDate, debit_account: gratAcc, payment_account: paySrc === 'cash' ? '161' : '162' }, auth());
      setMsg(data.message); setGrat(null);
    } catch (e) { setErr(errText(e, 'تعذّر الترحيل')); } finally { setBusy(false); }
  };
  const loadForm = async (kind) => {
    setBusy(true); reset();
    try {
      const url = kind === '2' ? `${API}/api/hr-engine/forms/form-2` : kind === '1' ? `${API}/api/hr-engine/forms/form-1/${empId}` : `${API}/api/hr-engine/forms/form-6/${empId}`;
      const params = kind === '6' ? { termination_date: termDate, termination_reason: reason } : kind === '2' ? { year: new Date().getFullYear() - 1 } : {};
      const { data } = await axios.get(url, { ...auth(), params });
      setForm({ kind, data });
    } catch (e) { setErr(errText(e, 'تعذّر إعداد الاستمارة')); } finally { setBusy(false); }
  };

  const s = res?.settlement;
  const gratLabel = gratAcc === '223' ? '223 مخصص مكافأة نهاية الخدمة' : '331 رواتب وأجور';
  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <h1 className="text-2xl font-extrabold print:hidden">🧾 نهاية الخدمة وإخلاء الطرف</h1>
      <div className="print:hidden"><Tabs value={tab} onChange={(t) => { setTab(t); reset(); }} tabs={[['clearance', 'تصفية وإخلاء طرف'], ['gratuity', 'مكافأة نهاية الخدمة فقط'], ['forms', 'استمارات التأمينات']]} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <Field label="الموظف"><EmpSelect emps={emps} value={empId} onChange={(v) => { setEmpId(v); reset(); }} all={tab === 'forms'} /></Field>
        <Field label="تاريخ انتهاء الخدمة"><input type="date" value={termDate} onChange={(e) => { setTermDate(e.target.value); reset(); }} className={input} /></Field>
        <Field label="السبب"><select value={reason} onChange={(e) => { setReason(e.target.value); reset(); }} className={input}>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {tab !== 'forms' && <Field label="المكافأة تُحمَّل على"><select value={gratAcc} onChange={(e) => { setGratAcc(e.target.value); setRes(null); }} className={input}>
          <option value="223">223 المخصص (إن كان مُكوَّناً)</option><option value="331">331 مصروف رواتب وأجور</option></select></Field>}
        {tab !== 'forms' && <Field label="الصرف من"><select value={paySrc} onChange={(e) => { setPaySrc(e.target.value); setRes(null); }} className={input}>
          {PAY_SRC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
      </div>
      <Err msg={err} /><Ok msg={msg} />

      {tab === 'clearance' && (
        <div className="space-y-3">
          <button onClick={previewClearance} disabled={busy || !empId} className={btn}>{busy ? '…' : 'احسب التصفية'}</button>
          {res?.clearance_blocked && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm space-y-2">
              <p className="font-bold">{res.reason}</p>
              <ul className="list-disc pe-5">{res.pending_custody.map((c) => <li key={c.id}>{c.asset} — منذ <L>{c.since}</L></li>)}</ul>
              <p>استرد العهد من شاشة «السلف والعهد»، أو تجاوز القيد إن كانت ستُسوَّى لاحقاً:</p>
              <button onClick={() => postClearance(true)} disabled={busy} className={btn2}>تجاوز وإخلاء الطرف</button>
            </div>
          )}
          {s && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label={`المكافأة (معامل ${s.gratuity_factor})`} value={s.gratuity} />
                <Stat label={`مقابل ${s.leave_days} يوم إجازة`} value={s.leave_encashment} />
                <Stat label="سلف مستردة" value={s.loan_deduction} />
                <Stat label="الصافي للموظف" value={s.net_payable} />
              </div>
              <p className="text-sm text-slate-600">سنوات الخدمة <L>{res.service_years}</L> — {res.note}{s.loan_remaining_after > 0 && <span className="text-red-700"> — يتبقى على الموظف <N v={s.loan_remaining_after} /> سلف لا تغطيها المستحقات</span>}</p>
              {res.pending_custody_count > 0 && <p className="text-sm text-amber-700">توجد {res.pending_custody_count} عهدة غير مستردة.</p>}
              <Lines rows={res.lines} />
              <p className="text-xs text-slate-500">المكافأة ومقابل الإجازات حسب سياسة الشركة (شاشة الإجازات ← السياسة). ضريبة كسب العمل على المستحقات لا تُحسب هنا — راجعها قبل الصرف.</p>
              <button onClick={() => postClearance(res.pending_custody_count > 0)} disabled={busy} className={btn}>ترحيل التصفية وإنهاء الخدمة</button>
            </div>
          )}
        </div>
      )}

      {tab === 'gratuity' && (
        <div className="space-y-3">
          <button onClick={calcGrat} disabled={busy || !empId} className={btn}>احسب المكافأة</button>
          {grat && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
              <p>آخر أجر شهري <N v={grat.last_monthly_salary} /> — سنوات الخدمة <L>{grat.service_years}</L></p>
              {grat.gratuity_calculation && <>
                <p>الخمس سنوات الأولى (<L>{grat.gratuity_calculation.first_5_years.years}</L> سنة × <L>{grat.gratuity_calculation.first_5_years.months_per_year}</L> شهر): <N v={grat.gratuity_calculation.first_5_years.amount} /></p>
                <p>بعدها (<L>{grat.gratuity_calculation.after_5_years.years}</L> سنة × <L>{grat.gratuity_calculation.after_5_years.months_per_year}</L> شهر): <N v={grat.gratuity_calculation.after_5_years.amount} /></p>
                <p>المعامل: <L>{grat.gratuity_calculation.factor}</L> — {grat.note}</p>
              </>}
              <p className="text-xs text-amber-700">{grat.policy_note}</p>
              <Field label="المبلغ المصروف" className="max-w-xs"><input type="number" dir="ltr" value={gratAmount} onChange={(e) => setGratAmount(e.target.value)} className={input} /></Field>
              <Lines rows={[[gratLabel, +gratAmount || 0, 0], [payLabel(paySrc), 0, +gratAmount || 0]]} />
              <button onClick={postGrat} disabled={busy || !(+gratAmount > 0)} className={btn}>ترحيل وصرف المكافأة</button>
            </div>
          )}
        </div>
      )}

      {tab === 'forms' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => loadForm('1')} disabled={busy || !empId} className={btn2}>استمارة 1 — التحاق</button>
            <button onClick={() => loadForm('6')} disabled={busy || !empId} className={btn2}>استمارة 6 — انتهاء خدمة</button>
            <button onClick={() => loadForm('2')} disabled={busy} className={btn2}>استمارة 2 — الأجور السنوية <L>{new Date().getFullYear() - 1}</L></button>
            {form && <button onClick={() => window.print()} className={btn2}><Printer className="w-4 h-4" aria-hidden /> طباعة</button>}
          </div>
          {form && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-sm space-y-2">
              <h2 className="font-extrabold text-lg">{form.data.form_name}</h2>
              <p className="text-slate-500">{form.data.law_reference} — {form.data.submission_note}</p>
              <p>صاحب العمل: {form.data.employer_data?.company_name} — رقم التأمين <L>{form.data.employer_data?.insurance_number || '—'}</L> — الرقم الضريبي <L>{form.data.employer_data?.tax_number || '—'}</L></p>
              {form.data.employee_data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {Object.entries({ name: 'الاسم', national_id: 'الرقم القومي', insurance_number: 'الرقم التأميني', hire_date: 'تاريخ الالتحاق',
                    termination_date: 'تاريخ الانتهاء', termination_reason: 'السبب', job_title: 'الوظيفة', insured_salary: 'الأجر التأميني',
                    last_insured_salary: 'آخر أجر تأميني', service_years: 'سنوات الخدمة' })
                    .filter(([k]) => form.data.employee_data[k] !== undefined)
                    .map(([k, l]) => <p key={k}><span className="text-slate-500">{l}: </span><L>{String(form.data.employee_data[k] || '—')}</L></p>)}
                </div>
              )}
              {form.data.entitlements && <p>المستحقات: مكافأة <N v={form.data.entitlements.gratuity_amount} /> + إجازات <N v={form.data.entitlements.leave_encashment} /> = <b><N v={form.data.entitlements.total_dues} /></b></p>}
              {form.data.employees && (
                <div className="overflow-x-auto">
                  <p className="text-xs text-slate-500">الأجر التأميني محصور بين <N v={form.data.insurable_limits?.min} /> و<N v={form.data.insurable_limits?.max} /></p>
                  <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                    <th className={th}>الاسم</th><th className={th}>الرقم القومي</th><th className={th}>الرقم التأميني</th><th className={`${th} text-end`}>الأجر التأميني الشهري</th><th className={`${th} text-end`}>السنوي</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {form.data.employees.map((e, i) => <tr key={i}><td className={td}>{e.name}</td><td className={td}><L>{e.national_id || '—'}</L></td><td className={td}><L>{e.insurance_number || '—'}</L></td>
                        <td className={`${td} text-end`}><N v={e.monthly_insurable} /></td><td className={`${td} text-end`}><N v={e.annual_total} /></td></tr>)}
                      <tr className="font-bold"><td className={td} colSpan={4}>الإجمالي ({form.data.totals.employee_count})</td><td className={`${td} text-end`}><N v={form.data.totals.total_annual_insured_wages} /></td></tr>
                    </tbody></table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════ السلف والعهد ═════════════════════════ */

const CUSTODY_SRC = [['124', '124 قطع غيار ومهمات'], ['116', '116 أجهزة كمبيوتر وبرمجيات'], ['115', '115 أثاث وتجهيزات'],
  ['113', '113 سيارات'], ['114', '114 آلات ومعدات'], ['122', '122 مخزون إنتاج تام'], ['121', '121 خامات']];
const LOAN_ST = { active: 'جارية', approved: 'معتمدة', paid: 'مسددة', settled: 'مسددة', pending: 'بانتظار الاعتماد', rejected: 'مرفوضة' };

export function LoansCustodyPage() {
  const emps = useEmployees();
  const [tab, setTab] = useState('loans');
  const [loans, setLoans] = useState(null);
  const [cust, setCust] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const loadLoans = () => axios.get(`${API}/api/hr-advanced/loans`, auth()).then((r) => setLoans(r.data)).catch((e) => { setLoans({ loans: [] }); setErr(errText(e, 'تعذّر تحميل السلف')); });
  const loadCust = () => axios.get(`${API}/api/hr-advanced/custody`, auth()).then((r) => setCust(r.data.custody || [])).catch(() => setCust([]));
  useEffect(() => { loadLoans(); loadCust(); }, []);

  const submit = async (fn) => {
    setBusy(true); setErr('');
    try { const { data } = await fn(); setMsg(data.message); setModal(null); loadLoans(); loadCust(); }
    catch (e) { setErr(errText(e, 'تعذّر تنفيذ العملية')); } finally { setBusy(false); }
  };
  const f = modal?.f || {};
  const setF = (k, v) => setModal((m) => ({ ...m, f: { ...m.f, [k]: v } }));

  let preview = null; let title = ''; let action = null; let valid = false;
  if (modal?.kind === 'grant') {
    title = 'صرف سلفة لموظف'; valid = f.employee_id && +f.loan_amount > 0 && +f.monthly_payment > 0;
    preview = [['134 سلف الموظفين', +f.loan_amount || 0, 0], [payLabel(f.payment_source), 0, +f.loan_amount || 0]];
    action = () => axios.post(`${API}/api/hr-advanced/loans/grant`, { ...f, loan_amount: +f.loan_amount, monthly_payment: +f.monthly_payment }, auth());
  } else if (modal?.kind === 'repay') {
    title = `سداد نقدي — ${modal.loan.employee_name}`; valid = +f.amount > 0;
    preview = [[payLabel(f.method), +f.amount || 0, 0], ['134 سلف الموظفين', 0, +f.amount || 0]];
    action = () => axios.post(`${API}/api/hr-advanced/loans/${modal.loan.id}/deduct`, { ...f, amount: +f.amount }, auth());
  } else if (modal?.kind === 'assign') {
    title = 'تسليم عهدة'; valid = f.employee_id && f.asset_name;
    preview = +f.value > 0 ? [['1342 عهد عينية لدى الموظفين', +f.value, 0], [CUSTODY_SRC.find((x) => x[0] === f.source_account)?.[1] || f.source_account, 0, +f.value]] : null;
    action = () => axios.post(`${API}/api/hr-advanced/custody/assign`, { ...f, value: +f.value || 0 }, auth());
  } else if (modal?.kind === 'return') {
    const c = modal.c; title = `استرداد عهدة — ${c.asset_name}`; valid = true;
    const dr = f.condition === 'lost' ? (f.charge_employee ? '134 سلف الموظفين (تُخصم من راتبه)' : '3365 خسائر عهد ومفقودات')
      : (CUSTODY_SRC.find((x) => x[0] === (c.source_account || '124'))?.[1] || c.source_account);
    preview = c.value > 0 ? [[dr, c.value, 0], ['1342 عهد عينية لدى الموظفين', 0, c.value]] : null;
    action = () => axios.put(`${API}/api/hr-advanced/custody/${c.id}/return`, f, auth());
  }

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">💳 سلف الموظفين والعهد</h1>
        {tab === 'loans'
          ? <button onClick={() => { setErr(''); setModal({ kind: 'grant', f: { employee_id: '', loan_amount: '', monthly_payment: '', start_month: thisMonth(), grant_date: today(), reason: 'سلفة موظف', payment_source: 'bank' } }); }} className={btn}><Plus className="w-4 h-4" aria-hidden /> صرف سلفة</button>
          : <button onClick={() => { setErr(''); setModal({ kind: 'assign', f: { employee_id: '', asset_type: 'laptop', asset_name: '', serial_number: '', value: '', hand_over_date: today(), source_account: '116' } }); }} className={btn}><Plus className="w-4 h-4" aria-hidden /> تسليم عهدة</button>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['loans', 'السلف'], ['custody', 'العهد العينية']]} />
      <Err msg={!modal && err} /><Ok msg={msg} />

      {tab === 'loans' && (!loans ? <Loading /> : (
        <>
          <p className="text-sm">إجمالي الرصيد القائم: <b><N v={loans.total_outstanding} /></b> — الأقساط تُخصم تلقائياً عند اعتماد كشف الرواتب.</p>
          {(loans.loans || []).length === 0 ? <p className="text-slate-500 py-6 text-center">لا توجد سلف.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                <th className={th}>الرقم</th><th className={th}>الموظف</th><th className={`${th} text-end`}>المبلغ</th><th className={`${th} text-end`}>القسط</th>
                <th className={th}>من شهر</th><th className={`${th} text-end`}>المتبقي</th><th className={th}>الحالة</th><th className={th}>إجراء</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loans.loans.map((l) => (
                    <tr key={l.id}>
                      <td className={td}><L>{l.loan_number || '—'}</L></td><td className={td}>{l.employee_name}</td>
                      <td className={`${td} text-end`}><N v={l.amount ?? l.loan_amount} /></td><td className={`${td} text-end`}><N v={l.installment_amount ?? l.monthly_payment} /></td>
                      <td className={td}><L>{l.start_month}</L></td><td className={`${td} text-end font-bold`}><N v={l.remaining_amount} /></td>
                      <td className={td}>{LOAN_ST[l.status] || l.status}</td>
                      <td className={td}>{['active', 'approved'].includes(l.status) && l.remaining_amount > 0 &&
                        <button className={btn2} onClick={() => { setErr(''); setModal({ kind: 'repay', loan: l, f: { amount: l.installment_amount || l.monthly_payment || '', method: 'cash', date: today() } }); }}>سداد نقدي</button>}</td>
                    </tr>
                  ))}
                </tbody></table>
            </div>
          )}
        </>
      ))}

      {tab === 'custody' && (!cust ? <Loading /> : cust.length === 0 ? <p className="text-slate-500 py-6 text-center">لا توجد عهد مسجلة.</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
            <th className={th}>العهدة</th><th className={th}>الموظف</th><th className={th}>السيريال</th><th className={`${th} text-end`}>القيمة</th>
            <th className={th}>التسليم</th><th className={th}>الحالة</th><th className={th}>إجراء</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cust.map((c) => (
                <tr key={c.id}>
                  <td className={td}>{c.asset_name}</td><td className={td}>{c.employee_name}</td><td className={td}><L>{c.serial_number || '—'}</L></td>
                  <td className={`${td} text-end`}><N v={c.value} /></td><td className={td}><L>{c.hand_over_date}</L></td>
                  <td className={td}>{c.status === 'assigned' ? 'مع الموظف' : c.status === 'lost' ? 'مفقودة' : 'مُستردة'}</td>
                  <td className={td}>{c.status === 'assigned' && <button className={btn2} onClick={() => { setErr(''); setModal({ kind: 'return', c, f: { condition: 'good', date: today(), charge_employee: false } }); }}>استرداد</button>}</td>
                </tr>
              ))}
            </tbody></table>
        </div>
      ))}

      {modal && (
        <Modal title={title} onClose={() => setModal(null)}
          footer={<><button onClick={() => setModal(null)} className={btn2}>إلغاء</button>
            <button onClick={() => submit(action)} disabled={busy || !valid} className={btn}>{busy ? '…' : 'تأكيد وترحيل'}</button></>}>
          {modal.kind === 'grant' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الموظف"><EmpSelect emps={emps} value={f.employee_id} onChange={(v) => setF('employee_id', v)} /></Field>
              <Field label="السبب"><input value={f.reason} onChange={(e) => setF('reason', e.target.value)} className={input} /></Field>
              <Field label="مبلغ السلفة"><input type="number" dir="ltr" value={f.loan_amount} onChange={(e) => setF('loan_amount', e.target.value)} className={input} /></Field>
              <Field label="القسط الشهري"><input type="number" dir="ltr" value={f.monthly_payment} onChange={(e) => setF('monthly_payment', e.target.value)} className={input} /></Field>
              <Field label="أول شهر خصم"><input type="month" value={f.start_month} onChange={(e) => setF('start_month', e.target.value)} className={input} /></Field>
              <Field label="تاريخ الصرف"><input type="date" value={f.grant_date} onChange={(e) => setF('grant_date', e.target.value)} className={input} /></Field>
              <Field label="الصرف من"><select value={f.payment_source} onChange={(e) => setF('payment_source', e.target.value)} className={input}>{PAY_SRC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              {+f.loan_amount > 0 && +f.monthly_payment > 0 && <p className="self-end text-slate-600">عدد الأقساط: <L>{Math.ceil(f.loan_amount / f.monthly_payment)}</L></p>}
            </div>
          )}
          {modal.kind === 'repay' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p className="sm:col-span-2 text-slate-600">المتبقي <N v={modal.loan.remaining_amount} />. هذا للسداد خارج كشف الرواتب فقط — القسط الشهري يُخصم من الكشف تلقائياً.</p>
              <Field label="المبلغ"><input type="number" dir="ltr" value={f.amount} onChange={(e) => setF('amount', e.target.value)} className={input} /></Field>
              <Field label="استُلم في"><select value={f.method} onChange={(e) => setF('method', e.target.value)} className={input}>{PAY_SRC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="التاريخ"><input type="date" value={f.date} onChange={(e) => setF('date', e.target.value)} className={input} /></Field>
            </div>
          )}
          {modal.kind === 'assign' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الموظف"><EmpSelect emps={emps} value={f.employee_id} onChange={(v) => setF('employee_id', v)} /></Field>
              <Field label="النوع"><select value={f.asset_type} onChange={(e) => setF('asset_type', e.target.value)} className={input}>
                {[['laptop', 'لابتوب'], ['phone_line', 'خط / موبايل'], ['car', 'سيارة'], ['sim_card', 'شريحة'], ['other', 'أخرى']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="اسم العهدة"><input value={f.asset_name} onChange={(e) => setF('asset_name', e.target.value)} className={input} /></Field>
              <Field label="السيريال"><input dir="ltr" value={f.serial_number} onChange={(e) => setF('serial_number', e.target.value)} className={input} /></Field>
              <Field label="القيمة الدفترية (0 = بدون قيد)"><input type="number" dir="ltr" value={f.value} onChange={(e) => setF('value', e.target.value)} className={input} /></Field>
              <Field label="خرجت من حساب"><select value={f.source_account} onChange={(e) => setF('source_account', e.target.value)} className={input}>{CUSTODY_SRC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="تاريخ التسليم"><input type="date" value={f.hand_over_date} onChange={(e) => setF('hand_over_date', e.target.value)} className={input} /></Field>
            </div>
          )}
          {modal.kind === 'return' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الحالة"><select value={f.condition} onChange={(e) => setF('condition', e.target.value)} className={input}>
                <option value="good">سليمة</option><option value="damaged">تالفة</option><option value="lost">مفقودة</option></select></Field>
              <Field label="التاريخ"><input type="date" value={f.date} onChange={(e) => setF('date', e.target.value)} className={input} /></Field>
              {f.condition === 'lost' && <label className="sm:col-span-2 flex items-center gap-2"><input type="checkbox" checked={!!f.charge_employee} onChange={(e) => setF('charge_employee', e.target.checked)} /> تحميل القيمة على الموظف (تُخصم من الراتب كسلفة)</label>}
            </div>
          )}
          {preview && <Lines rows={preview} />}
          <Err msg={err} />
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ العمولات ═════════════════════════ */

export function CommissionsPage() {
  const emps = useEmployees();
  const [data, setData] = useState(null);
  const [rule, setRule] = useState({ employee_id: '', rate: '', basis: 'invoiced', max_monthly: '' });
  const [period, setPeriod] = useState(thisMonth());
  const [bases, setBases] = useState({});
  const [pv, setPv] = useState(null);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => axios.get(`${API}/api/hr-advanced/commissions/rules`, auth()).then((r) => setData(r.data)).catch((e) => { setData({ rules: [], runs: [] }); setErr(errText(e, 'تعذّر التحميل')); });
  useEffect(() => { load(); }, []);

  const run = async (fn, after) => {
    setBusy(true); setErr(''); setMsg('');
    try { const { data: d } = await fn(); after(d); } catch (e) { setErr(errText(e, 'تعذّر تنفيذ العملية')); } finally { setBusy(false); }
  };
  const manual = () => Object.fromEntries(Object.entries(bases).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, +v]));

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <h1 className="text-2xl font-extrabold">🎯 عمولات المندوبين</h1>
      <Err msg={err} /><Ok msg={msg} />
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <p className="font-bold">قاعدة عمولة لمندوب (تحل محل قاعدته السابقة)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="المندوب"><EmpSelect emps={emps} value={rule.employee_id} onChange={(v) => setRule({ ...rule, employee_id: v })} /></Field>
          <Field label="النسبة %"><input type="number" dir="ltr" value={rule.rate} onChange={(e) => setRule({ ...rule, rate: e.target.value })} className={input} /></Field>
          <Field label="على أساس"><select value={rule.basis} onChange={(e) => setRule({ ...rule, basis: e.target.value })} className={input}>
            <option value="invoiced">المبيعات المفوترة (بدون الضريبة)</option><option value="collected">المحصَّل</option></select></Field>
          <Field label="حد أقصى شهري (اختياري)"><input type="number" dir="ltr" value={rule.max_monthly} onChange={(e) => setRule({ ...rule, max_monthly: e.target.value })} className={input} /></Field>
        </div>
        <button disabled={busy || !rule.employee_id || !(+rule.rate > 0)} className={btn}
          onClick={() => run(() => axios.post(`${API}/api/hr-advanced/commissions/rules`, { employee_id: rule.employee_id, commission_rate: +rule.rate / 100, basis: rule.basis, max_monthly: rule.max_monthly === '' ? null : +rule.max_monthly }, auth()),
            (d) => { setMsg(d.message); setRule({ employee_id: '', rate: '', basis: 'invoiced', max_monthly: '' }); load(); })}>حفظ القاعدة</button>
      </div>

      {!data ? <Loading /> : (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="الشهر"><input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setPv(null); }} className={input} /></Field>
            </div>
            {data.rules.length === 0 ? <p className="text-slate-500">لا توجد قواعد عمولات بعد.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                  <th className={th}>المندوب</th><th className={th}>النسبة</th><th className={th}>الأساس</th><th className={th}>وعاء يدوي (اختياري)</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.rules.map((r) => (
                      <tr key={r.id}><td className={td}>{r.employee_name}</td><td className={td}><L>{(r.commission_rate * 100).toFixed(2)}%</L></td>
                        <td className={td}>{r.basis === 'collected' ? 'المحصَّل' : 'المفوتر'}{r.max_monthly ? <> — حد <N v={r.max_monthly} /></> : null}</td>
                        <td className={td}><input type="number" dir="ltr" value={bases[r.employee_id] ?? ''} onChange={(e) => { setBases({ ...bases, [r.employee_id]: e.target.value }); setPv(null); }} className={`${input} max-w-[10rem]`} placeholder="من الفواتير" /></td></tr>
                    ))}
                  </tbody></table>
              </div>
            )}
            <p className="text-xs text-slate-500">الفواتير لا تحمل اسم المندوب بعد، فاكتب وعاء العمولة (صافي المبيعات أو المحصَّل) يدوياً لكل مندوب.</p>
            <button disabled={busy || data.rules.length === 0} className={btn2}
              onClick={() => run(() => axios.post(`${API}/api/hr-advanced/commissions/calculate`, { period, dry_run: true, manual_bases: manual() }, auth()), setPv)}>معاينة العمولات</button>
            {pv && (
              <div className="space-y-2">
                {pv.breakdown.length === 0 ? <p className="text-slate-500">لا عمولات مستحقة لهذا الشهر.</p> : pv.breakdown.map((b) => (
                  <p key={b.employee_id} className="text-sm">{b.employee_name}: <N v={b.base_amount} /> × <L>{b.rate}%</L> = <b><N v={b.commission} /></b></p>
                ))}
                <Lines rows={pv.lines} />
                {pv.total_commission > 0 && <button disabled={busy} className={btn}
                  onClick={() => run(() => axios.post(`${API}/api/hr-advanced/commissions/calculate`, { period, manual_bases: manual() }, auth()), (d) => { setMsg(d.message); setPv(null); load(); })}>ترحيل استحقاق العمولات</button>}
              </div>
            )}
          </div>

          <p className="font-bold">الشهور المحتسبة</p>
          {data.runs.length === 0 ? <p className="text-slate-500">لا يوجد.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                <th className={th}>الشهر</th><th className={`${th} text-end`}>المستحق</th><th className={`${th} text-end`}>المصروف</th><th className={th}>إجراء</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.runs.map((r) => (
                    <tr key={r.id}><td className={td}><L>{r.period}</L></td><td className={`${td} text-end`}><N v={r.total} /></td><td className={`${td} text-end`}><N v={r.paid} /></td>
                      <td className={td}>{r.total - r.paid > 0.005 && <button className={btn2} onClick={() => { setErr(''); setPay({ period: r.period, amount: r2(r.total - r.paid), date: today(), payment_source: 'bank' }); }}>صرف</button>}</td></tr>
                  ))}
                </tbody></table>
            </div>
          )}
        </>
      )}

      {pay && (
        <Modal title={`صرف عمولات ${pay.period}`} onClose={() => setPay(null)}
          footer={<><button onClick={() => setPay(null)} className={btn2}>إلغاء</button>
            <button disabled={busy || !(+pay.amount > 0)} className={btn}
              onClick={() => run(() => axios.post(`${API}/api/hr-advanced/commissions/${pay.period}/pay`, { amount: +pay.amount, date: pay.date, payment_source: pay.payment_source }, auth()), (d) => { setMsg(d.message); setPay(null); load(); })}>تأكيد وترحيل</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="المبلغ"><input type="number" dir="ltr" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={input} /></Field>
            <Field label="التاريخ"><input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} className={input} /></Field>
            <Field label="الصرف من"><select value={pay.payment_source} onChange={(e) => setPay({ ...pay, payment_source: e.target.value })} className={input}>{PAY_SRC.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <Lines rows={[['2201 عمولات مبيعات مستحقة', +pay.amount || 0, 0], [payLabel(pay.payment_source), 0, +pay.amount || 0]]} />
          <Err msg={err} />
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ المدفوعات الحكومية ═════════════════════════ */

export function GovPaymentsPage() {
  const [tab, setTab] = useState('payments');
  const [list, setList] = useState(null);
  const [types, setTypes] = useState({});
  const [form, setForm] = useState(null);
  const [pv, setPv] = useState(null);
  const [runs, setRuns] = useState([]);
  const [q, setQ] = useState({ year: new Date().getFullYear(), quarter: Math.floor(new Date().getMonth() / 3) + 1 });
  const [f4, setF4] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => axios.get(`${API}/api/gov/gps/payments`, auth()).then((r) => setList(r.data)).catch((e) => { setList({ payments: [] }); setErr(errText(e, 'تعذّر التحميل')); });
  useEffect(() => {
    load();
    axios.get(`${API}/api/gov/gps/gateways`, auth()).then((r) => setTypes(r.data.payment_types || {})).catch(() => {});
    axios.get(`${API}/api/payroll/runs`, auth()).then((r) => setRuns(r.data?.payroll_runs || [])).catch(() => {});
  }, []);

  const body = () => ({ ...form, amount: +form.amount, debit_account: form.debit_account || undefined, reference_number: form.reference_number || undefined });
  const preview = async () => {
    setBusy(true); setErr(''); setPv(null);
    try { const { data } = await axios.post(`${API}/api/gov/gps/payment`, body(), { ...auth(), params: { preview: true } }); setPv(data.lines); }
    catch (e) { setErr(errText(e, 'تعذّر المعاينة')); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setErr('');
    try { const { data } = await axios.post(`${API}/api/gov/gps/payment`, body(), auth()); setMsg(data.message); setForm(null); setPv(null); load(); }
    catch (e) { setErr(errText(e, 'تعذّر التسجيل')); } finally { setBusy(false); }
  };
  const download = async (runId, kind) => {
    setErr('');
    try {
      const url = kind === 'excel' ? `${API}/api/gov/payroll/unified-export/${runId}/excel` : `${API}/api/gov/payroll/unified-export/${runId}`;
      const res = await axios.get(url, { ...auth(), responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = `payroll_${runId}.${kind === 'excel' ? 'xlsx' : 'json'}`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { setErr('تعذّر تنزيل الملف'); }
  };
  const loadF4 = async () => {
    setBusy(true); setErr(''); setF4(null);
    try { const { data } = await axios.get(`${API}/api/gov/payroll/quarterly-form4/${q.year}/${q.quarter}`, auth()); setF4(data); }
    catch (e) { setErr(errText(e, 'تعذّر إعداد النموذج')); } finally { setBusy(false); }
  };
  const typeName = (k) => types[k]?.debit_name || k;

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-extrabold">🏛️ المدفوعات والنماذج الحكومية</h1>
        {tab === 'payments' && <button onClick={() => { setErr(''); setPv(null); setForm({ payment_type: 'payroll_tax', amount: '', period: thisMonth(), payment_date: today(), bank_account: '162', reference_number: '', debit_account: '', notes: '' }); }} className={btn}><Plus className="w-4 h-4" aria-hidden /> تسجيل دفعة</button>}
      </div>
      <div className="print:hidden"><Tabs value={tab} onChange={(t) => { setTab(t); setErr(''); setMsg(''); }} tabs={[['payments', 'الدفعات الحكومية'], ['form4', 'نموذج 4 الربع سنوي'], ['export', 'منظومة البيرول الموحدة']]} /></div>
      <Err msg={!form && err} /><Ok msg={msg} />

      {tab === 'payments' && (!list ? <Loading /> : (
        <>
          <p className="text-sm">إجمالي المسدد: <b><N v={list.total_paid} /></b></p>
          {(list.payments || []).length === 0 ? <p className="text-slate-500 py-6 text-center">لا توجد دفعات مسجلة.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                <th className={th}>التاريخ</th><th className={th}>النوع</th><th className={th}>الجهة</th><th className={th}>الفترة</th><th className={th}>المرجع</th><th className={`${th} text-end`}>المبلغ</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.payments.map((p) => (
                    <tr key={p.id}><td className={td}><L>{p.payment_date}</L></td><td className={td}>{p.payment_type_ar}<div className="text-xs text-slate-500"><L>{p.debit_account || ''}</L></div></td>
                      <td className={td}>{p.gateway}</td><td className={td}><L>{p.period}</L></td><td className={td}><L>{p.reference_number || '—'}</L></td><td className={`${td} text-end font-bold`}><N v={p.amount} /></td></tr>
                  ))}
                </tbody></table>
            </div>
          )}
        </>
      ))}

      {tab === 'form4' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <Field label="السنة"><input type="number" dir="ltr" value={q.year} onChange={(e) => setQ({ ...q, year: +e.target.value })} className={`${input} w-28`} /></Field>
            <Field label="الربع"><select value={q.quarter} onChange={(e) => setQ({ ...q, quarter: +e.target.value })} className={input}>{[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
            <button onClick={loadF4} disabled={busy} className={btn}>إعداد النموذج</button>
            {f4 && <button onClick={() => window.print()} className={btn2}><Printer className="w-4 h-4" aria-hidden /> طباعة</button>}
          </div>
          {f4 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-sm space-y-2">
              <h2 className="font-extrabold text-lg">نموذج 4 — ضريبة كسب العمل — الربع <L>{f4.period.quarter}</L> / <L>{f4.period.year}</L></h2>
              <p className="text-slate-500">{f4.employer.companyName} — الرقم الضريبي <L>{f4.employer.taxRegistrationNumber || '—'}</L> — {f4.submissionNote}</p>
              <p className="text-xs text-slate-500">من كشوف الرواتب المعتمدة أو المصروفة فقط.</p>
              {f4.employees.length === 0 ? <p className="text-slate-500">لا توجد كشوف رواتب معتمدة في هذا الربع.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
                  <th className={th}>الاسم</th><th className={th}>الرقم القومي</th><th className={`${th} text-end`}>إجمالي الأجر</th><th className={`${th} text-end`}>التأمينات</th><th className={`${th} text-end`}>الضريبة</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {f4.employees.map((e, i) => <tr key={i}><td className={td}>{e.employeeName}</td><td className={td}><L>{e.nationalId || '—'}</L></td>
                      <td className={`${td} text-end`}><N v={e.grossSalary} /></td><td className={`${td} text-end`}><N v={e.employeeSI} /></td><td className={`${td} text-end`}><N v={e.incomeTax} /></td></tr>)}
                    <tr className="font-bold"><td className={td} colSpan={2}>الإجمالي ({f4.totals.employeeCount})</td><td className={`${td} text-end`}><N v={f4.totals.totalGross} /></td><td className={td} /><td className={`${td} text-end`}><N v={f4.totals.totalIncomeTax} /></td></tr>
                  </tbody></table></div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'export' && (
        runs.length === 0 ? <p className="text-slate-500 py-6 text-center">لا توجد كشوف رواتب.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>
              <th className={th}>الكشف</th><th className={th}>الشهر</th><th className={th}>الحالة</th><th className={`${th} text-end`}>الصافي</th><th className={th}>تصدير</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {runs.map((r) => (
                  <tr key={r.id}><td className={td}><L>{r.payroll_number}</L></td><td className={td}><L>{r.month}</L></td><td className={td}>{r.status}</td>
                    <td className={`${td} text-end`}><N v={r.total_net_salary} /></td>
                    <td className={`${td} whitespace-nowrap`}><button onClick={() => download(r.id, 'excel')} className={btn2}><Download className="w-4 h-4" aria-hidden /> Excel</button>{' '}
                      <button onClick={() => download(r.id, 'json')} className={btn2}><Download className="w-4 h-4" aria-hidden /> JSON</button></td></tr>
                ))}
              </tbody></table>
          </div>
        )
      )}

      {form && (
        <Modal title="تسجيل دفعة لجهة حكومية" onClose={() => { setForm(null); setPv(null); }}
          footer={<><button onClick={() => { setForm(null); setPv(null); }} className={btn2}>إلغاء</button>
            {!pv ? <button onClick={preview} disabled={busy || !(+form.amount > 0)} className={btn}>{busy ? '…' : 'معاينة القيد'}</button>
              : <button onClick={save} disabled={busy} className={btn}>{busy ? '…' : 'تأكيد وترحيل'}</button>}</>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="نوع الدفعة"><select value={form.payment_type} onChange={(e) => { setForm({ ...form, payment_type: e.target.value }); setPv(null); }} className={input}>
              {Object.keys(types).map((k) => <option key={k} value={k}>{typeName(k)} ({types[k].form})</option>)}</select></Field>
            <Field label="المبلغ"><input type="number" dir="ltr" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setPv(null); }} className={input} /></Field>
            <Field label="الفترة"><input dir="ltr" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-03 أو 2026-Q1" className={input} /></Field>
            <Field label="تاريخ الدفع"><input type="date" value={form.payment_date} onChange={(e) => { setForm({ ...form, payment_date: e.target.value }); setPv(null); }} className={input} /></Field>
            <Field label="رقم المرجع من البوابة"><input dir="ltr" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} className={input} /></Field>
            <Field label="الدفع من"><select value={form.bank_account} onChange={(e) => { setForm({ ...form, bank_account: e.target.value }); setPv(null); }} className={input}>
              <option value="162">162 البنك</option><option value="161">161 الخزينة</option></select></Field>
            <Field label="حساب المدين (اتركه للافتراضي)"><input dir="ltr" value={form.debit_account} onChange={(e) => { setForm({ ...form, debit_account: e.target.value }); setPv(null); }}
              placeholder={types[form.payment_type]?.debit_account || ''} className={input} /></Field>
          </div>
          {form.payment_type === 'customs_duty' && <p className="text-xs text-slate-500">الرسوم الجمركية تُحمَّل افتراضياً على 3374 مصروف؛ لإضافتها لتكلفة البضاعة اكتب 123 في حساب المدين.</p>}
          {pv && <Lines rows={pv} />}
          <Err msg={err} />
        </Modal>
      )}
    </div>
  );
}
