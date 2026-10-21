/**
 * تقييم الأداء
 *   AppraisalsPage     — الموارد البشرية ← تقييم الأداء: التقييمات + مقاييس الأداء
 *   EmployeeAppraisals — تبويب «تقييم الأداء» في صفحة الموظف
 *
 * مقاييس الأداء: مجموعات مؤشرات (قوالب) لكل إدارة، لكل مؤشر وزن ووصف لطريقة
 * القياس ومستهدف ووحدة واتجاه (الأعلى أفضل / الأقل أفضل). المكتبة الجاهزة
 * تُضاف بزر وتُعدَّل كما تشاء الشركة. عند اختيار الموظف في تقييم جديد تُحمَّل
 * مجموعة إدارته تلقائياً، وإدخال «الفعلي» يقترح الدرجة من المستهدف.
 * Backend: /api/performance/{kpi-templates,kpi-templates/defaults,appraisals,employee/{id}/appraisals}
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Check, Pencil, Trash2, Target, TrendingUp, ChevronDown } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const errText = (e, f) => { const d = e?.response?.data?.detail; return typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(' — ') : f; };

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btn = 'inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50';
const btn2 = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50';
const th = 'text-start px-2 py-2 whitespace-nowrap font-semibold';
const td = 'px-2 py-1.5';
const L = ({ children }) => <bdi dir="ltr" className="tabular-nums">{children}</bdi>;

const RECS = { none: 'لا توصية', salary_increment: 'زيادة راتب', promotion: 'ترقية', pip: 'خطة تحسين أداء (PIP)' };
const STATUS_AR = { draft: 'مسودة', approved: 'معتمد', rejected: 'مرفوض' };
const PERIOD_AR = { quarterly: 'ربع سنوي', annual: 'سنوي', probation: 'فترة اختبار' };
const SCALE = [
  [90, 'استثنائي', 'bg-emerald-600'], [80, 'يتجاوز التوقعات', 'bg-emerald-500'], [70, 'يحقق التوقعات', 'bg-blue-500'],
  [60, 'يحتاج تحسين', 'bg-amber-500'], [0, 'غير مقبول', 'bg-red-600'],
];
const ratingOf = (s) => SCALE.find(([m]) => Number(s) >= m) || SCALE[SCALE.length - 1];
const GENERAL = 'الكفاءات العامة';

// a score from target and actual: higher-is-better scales actual/target;
// lower-is-better gives full marks at or under target. Blank when either is not a number.
export function suggestScore(target, actual, direction) {
  const t = parseFloat(target), a = parseFloat(actual);
  if (Number.isNaN(t) || Number.isNaN(a)) return null;
  if (direction === 'lower') {
    if (a <= t) return 100;
    if (t <= 0) return Math.max(0, r1(100 - (a - t) * 10));
    return Math.max(0, r1((t / a) * 100));
  }
  if (t <= 0) return null;
  return Math.min(100, Math.max(0, r1((a / t) * 100)));
}

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[92vh] overflow-y-auto shadow-xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm space-y-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}
const Field = ({ label, children, className = '' }) => <label className={`block ${className}`}><span className="text-slate-600 dark:text-slate-300">{label}</span>{children}</label>;
const Msg = ({ m }) => (m ? <p role={m.err ? 'alert' : 'status'} className={`text-sm ${m.err ? 'text-red-700' : 'text-emerald-700'}`}>{m.text}</p> : null);
const Loading = () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" aria-label="جارٍ التحميل" /></div>;

function ScoreBadge({ score }) {
  const [, label, color] = ratingOf(score);
  return <span className="inline-flex items-center gap-2"><b className="text-base"><L>{r1(score)}</L></b><span className={`text-xs text-white px-2 py-0.5 rounded-full ${color}`}>{label}</span></span>;
}

function ScaleGuide() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {SCALE.map(([m, l, c], i) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${c}`} aria-hidden />{l} <L>{i === 0 ? '90–100' : `${m}–${SCALE[i - 1][0] - 0.1}`}</L></span>
      ))}
    </div>
  );
}

// ── appraisal breakdown (used on both pages) ───────────────────
export function AppraisalDetail({ a }) {
  const rows = a.kpi_scores || [];
  const w = rows.reduce((s, k) => s + (Number(k.weight) || 0), 0) || 100;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
        <span>الفترة: <L>{a.review_period}</L> ({PERIOD_AR[a.period_type] || a.period_type})</span>
        <span>تاريخ التقييم: <L>{a.review_date}</L></span>
        <span>الحالة: {STATUS_AR[a.status] || a.status}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800"><tr>
            <th className={th}>المؤشر</th><th className={th}>الوزن</th><th className={th}>المستهدف</th><th className={th}>الفعلي</th>
            <th className={th}>الدرجة</th><th className={th}>المساهمة</th><th className={th}>ملاحظة</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((k, i) => (
              <tr key={i}>
                <td className={td}>{k.kpi_name}{k.description && <span className="block text-xs text-slate-500">{k.description}</span>}</td>
                <td className={td}><L>{k.weight}%</L></td>
                <td className={td}><L>{k.target || '—'}</L> {k.unit}</td>
                <td className={td}><L>{k.actual || '—'}</L></td>
                <td className={td}>
                  <div className="flex items-center gap-2"><L>{r1(k.score)}</L>
                    <span className="w-16 h-1.5 rounded bg-slate-200 overflow-hidden" aria-hidden><span className={`block h-full ${ratingOf(k.score)[2]}`} style={{ width: `${Math.min(100, k.score)}%` }} /></span></div></td>
                <td className={td}><L>{r1((Number(k.score) || 0) * (Number(k.weight) || 0) / w)}</L></td>
                <td className={`${td} text-xs text-slate-600`}>{k.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span>الدرجة الإجمالية: <ScoreBadge score={a.kpi_score} /></span>
        <span>التوصية: <b>{a.recommendation_ar || RECS[a.manager_recommendation]}</b>
          {a.salary_increment_percentage > 0 && <> — زيادة <L>{a.salary_increment_percentage}%</L></>}
          {a.promotion_to_title && <> — إلى «{a.promotion_to_title}»</>}</span>
      </div>
      {a.manager_notes && <p className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3"><b>ملاحظات المدير: </b>{a.manager_notes}</p>}
      {a.approval_comment && <p className="text-slate-600"><b>تعليق الاعتماد: </b>{a.approval_comment}</p>}
    </div>
  );
}

// ── metrics (templates) ───────────────────────────────────────
function MetricsTab({ templates, reload, setMsg }) {
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadDefaults = async () => {
    setBusy(true);
    try { const { data } = await axios.post(`${API}/api/performance/kpi-templates/defaults`, {}, auth()); setMsg({ text: data.message }); reload(); }
    catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر الإضافة') }); } finally { setBusy(false); }
  };
  const remove = async (t) => {
    if (!window.confirm(`حذف مجموعة «${t.name}»؟ التقييمات السابقة لا تتأثر.`)) return;
    try { const { data } = await axios.delete(`${API}/api/performance/kpi-templates/${t.id}`, auth()); setMsg({ text: data.message }); reload(); }
    catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر الحذف') }); }
  };
  const total = edit ? edit.kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0) : 0;
  const setK = (i, f, v) => setEdit({ ...edit, kpis: edit.kpis.map((k, j) => (j === i ? { ...k, [f]: v } : k)) });
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { name: edit.name, department: edit.department, kpis: edit.kpis.map((k) => ({ ...k, weight: Number(k.weight) || 0 })) };
      const { data } = edit.id ? await axios.put(`${API}/api/performance/kpi-templates/${edit.id}`, body, auth())
        : await axios.post(`${API}/api/performance/kpi-templates`, body, auth());
      setMsg({ text: data.message || 'تم الحفظ' }); setEdit(null); reload();
    } catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/20 p-4 text-slate-700 dark:text-slate-200 space-y-2">
        <p className="font-bold">كيف تعمل المقاييس</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>كل مجموعة مقاييس لإدارة أو نوع وظيفة، ومجموع أوزان مؤشراتها 100%. مجموعة «{GENERAL}» تُستخدم لأي موظف ليس لإدارته مجموعة.</li>
          <li>لكل مؤشر مستهدف ووحدة واتجاه: «الأعلى أفضل» مثل المبيعات، و«الأقل أفضل» مثل الأخطاء وأيام التأخير.</li>
          <li>في التقييم يُدخَل الفعلي فيقترح البرنامج الدرجة من 100، ويمكن تعديلها. المؤشرات الوصفية بلا رقم تُقيَّم مباشرة.</li>
          <li>الدرجة الإجمالية = مجموع (درجة المؤشر × وزنه) ÷ 100.</li>
        </ul>
        <ScaleGuide />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={loadDefaults} disabled={busy} className={`${btn} bg-amber-600`}>إضافة المقاييس الجاهزة (7 مجموعات)</button>
        <button onClick={() => { setErr(''); setEdit({ name: '', department: '', kpis: [{ name: '', weight: 100, description: '', target: '', unit: '', direction: 'higher' }] }); }} className={btn2}>
          <Plus className="w-4 h-4" aria-hidden /> مجموعة جديدة</button>
      </div>
      {templates.length === 0 ? <p className="text-slate-500 py-6 text-center">لا توجد مقاييس بعد — ابدأ بـ «إضافة المقاييس الجاهزة» ثم عدّلها لشركتك.</p> : templates.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <button onClick={() => setOpen({ ...open, [t.id]: !open[t.id] })} className="flex items-center gap-2 font-bold text-start" aria-expanded={!!open[t.id]}>
              <ChevronDown className={`w-4 h-4 transition-transform ${open[t.id] ? 'rotate-180' : ''}`} aria-hidden />
              {t.name}<span className="text-xs font-normal text-slate-500">{t.department ? `— ${t.department}` : '— كل الإدارات'} · {t.kpi_count} مؤشر</span>
            </button>
            <div className="flex gap-1">
              <button onClick={() => { setErr(''); setEdit({ ...t, department: t.department || '', kpis: t.kpis.map((k) => ({ direction: 'higher', ...k, name: k.name_ar || k.name })) }); }} className={btn2}><Pencil className="w-4 h-4" aria-hidden /> تعديل</button>
              <button onClick={() => remove(t)} className={`${btn2} text-red-700`} aria-label={`حذف ${t.name}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          {open[t.id] && (
            <table className="w-full text-sm border-t border-slate-100 dark:border-slate-800">
              <thead className="text-slate-500"><tr><th className={th}>المؤشر</th><th className={th}>طريقة القياس</th><th className={th}>الوزن</th><th className={th}>المستهدف</th><th className={th}>الاتجاه</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {t.kpis.map((k, i) => (
                  <tr key={i}><td className={`${td} font-semibold`}>{k.name_ar || k.name}</td><td className={`${td} text-slate-600`}>{k.description}</td>
                    <td className={td}><L>{k.weight}%</L></td><td className={td}><L>{k.target || '—'}</L> {k.unit}</td>
                    <td className={td}>{k.direction === 'lower' ? 'الأقل أفضل' : 'الأعلى أفضل'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {edit && (
        <Modal wide title={edit.id ? `تعديل «${edit.name}»` : 'مجموعة مقاييس جديدة'} onClose={() => setEdit(null)}
          footer={<><button onClick={() => setEdit(null)} className={btn2}>إلغاء</button>
            <button onClick={save} disabled={busy || !edit.name.trim() || Math.abs(total - 100) > 0.01} className={btn}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="اسم المجموعة"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={input} /></Field>
            <Field label="الإدارة / القسم (فارغ = كل الإدارات)"><input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} className={input} placeholder="بنفس الاسم المكتوب في ملف الموظف" /></Field>
          </div>
          {edit.kpis.map((k, i) => (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
              <Field label="المؤشر" className="col-span-2 sm:col-span-4"><input value={k.name} onChange={(e) => setK(i, 'name', e.target.value)} className={input} /></Field>
              <Field label="الوزن %" className="sm:col-span-2"><input type="number" min="0" dir="ltr" value={k.weight} onChange={(e) => setK(i, 'weight', e.target.value)} className={input} /></Field>
              <Field label="المستهدف" className="sm:col-span-2"><input dir="ltr" value={k.target} onChange={(e) => setK(i, 'target', e.target.value)} className={input} /></Field>
              <Field label="الوحدة" className="sm:col-span-1"><input value={k.unit} onChange={(e) => setK(i, 'unit', e.target.value)} className={input} /></Field>
              <Field label="الاتجاه" className="sm:col-span-2"><select value={k.direction} onChange={(e) => setK(i, 'direction', e.target.value)} className={input}>
                <option value="higher">الأعلى أفضل</option><option value="lower">الأقل أفضل</option></select></Field>
              <button onClick={() => setEdit({ ...edit, kpis: edit.kpis.filter((_, j) => j !== i) })} className={`${btn2} sm:col-span-1 justify-center`} aria-label="حذف المؤشر"><X className="w-4 h-4" /></button>
              <Field label="طريقة القياس" className="col-span-2 sm:col-span-12"><input value={k.description} onChange={(e) => setK(i, 'description', e.target.value)} className={input} /></Field>
            </div>
          ))}
          <button onClick={() => setEdit({ ...edit, kpis: [...edit.kpis, { name: '', weight: 0, description: '', target: '', unit: '', direction: 'higher' }] })} className={btn2}><Plus className="w-4 h-4" aria-hidden /> مؤشر</button>
          <p className={Math.abs(total - 100) > 0.01 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>مجموع الأوزان: <L>{total}%</L> {Math.abs(total - 100) > 0.01 && '— يجب أن يكون 100%'}</p>
          {err && <p role="alert" className="text-red-700">{err}</p>}
        </Modal>
      )}
    </div>
  );
}

// ── appraisals page ───────────────────────────────────────────
export function AppraisalsPage() {
  const [tab, setTab] = useState('appraisals');
  const [emps, setEmps] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('');
  const [dept, setDept] = useState('');
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');

  const loadTemplates = () => axios.get(`${API}/api/performance/kpi-templates`, auth()).then((r) => setTemplates(r.data?.templates || [])).catch(() => {});
  const load = async () => {
    try {
      const params = {}; if (period) params.review_period = period; if (dept) params.department = dept;
      const { data: d } = await axios.get(`${API}/api/performance/appraisals`, { ...auth(), params });
      setData(d);
    } catch (e) { setData({ appraisals: [] }); setMsg({ err: true, text: errText(e, 'تعذّر تحميل التقييمات') }); }
  };
  useEffect(() => {
    axios.get(`${API}/api/employees`, auth()).then((r) => setEmps((r.data?.employees || []).filter((e) => e.is_active !== false))).catch(() => {});
    loadTemplates(); load();
  }, []);  // load once; the filter button reloads

  const depts = useMemo(() => [...new Set(emps.map((e) => e.department).filter(Boolean))].sort(), [emps]);

  const rowsFrom = (t) => t.kpis.map((k) => ({ kpi_name: k.name_ar || k.name, weight: k.weight, description: k.description || '', target: k.target || '',
    unit: k.unit || '', direction: k.direction || 'higher', actual: '', score: '', notes: '' }));
  const templateFor = (emp) => templates.find((t) => emp?.department && t.department === emp.department)
    || templates.find((t) => t.name === GENERAL) || templates.find((t) => !t.department);

  const newForm = () => {
    setErr(''); setMsg(null);
    setForm({ employee_id: '', template_id: '', review_period: period || `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      period_type: 'quarterly', review_date: today(), manager_recommendation: 'none', salary_increment_percentage: 0,
      promotion_to_title: '', manager_notes: '', kpi_scores: [] });
  };
  const pickEmp = (id) => {
    const emp = emps.find((e) => e.id === id);
    const t = templateFor(emp);
    setForm((f) => ({ ...f, employee_id: id, template_id: t?.id || '', kpi_scores: t ? rowsFrom(t) : f.kpi_scores }));
  };
  const pickTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    setForm((f) => ({ ...f, template_id: id, kpi_scores: t ? rowsFrom(t) : f.kpi_scores }));
  };
  const setKpi = (i, k, v) => setForm((f) => ({
    ...f, kpi_scores: f.kpi_scores.map((x, j) => {
      if (j !== i) return x;
      const next = { ...x, [k]: v };
      if (k === 'actual' || k === 'target') {           // suggest the score from target and actual
        const s = suggestScore(next.target, next.actual, next.direction);
        if (s !== null) next.score = String(s);
      }
      return next;
    }),
  }));
  const weightTotal = form ? form.kpi_scores.reduce((s, k) => s + (Number(k.weight) || 0), 0) : 0;
  const score = form && weightTotal ? r1(form.kpi_scores.reduce((s, k) => s + (Number(k.score) || 0) * (Number(k.weight) || 0), 0) / weightTotal) : 0;
  const emp = form && emps.find((e) => e.id === form.employee_id);
  const unscored = form ? form.kpi_scores.filter((k) => k.score === '' || k.score === null).length : 0;

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { ...form, salary_increment_percentage: Number(form.salary_increment_percentage) || 0,
        kpi_scores: form.kpi_scores.map((k) => ({ ...k, weight: Number(k.weight) || 0, score: Number(k.score) || 0 })),
        promotion_to_title: form.promotion_to_title || undefined };
      delete body.template_id;
      const { data: d } = await axios.post(`${API}/api/performance/appraisals`, body, auth());
      setMsg({ text: d.message }); setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ التقييم')); } finally { setBusy(false); }
  };
  const act = async (fn) => {
    setBusy(true); setMsg(null);
    try { const { data: d } = await fn(); setMsg({ text: d?.message || 'تم' }); setView(null); load(); }
    catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر تنفيذ العملية') }); } finally { setBusy(false); }
  };
  const openView = async (a) => {
    try { const { data: d } = await axios.get(`${API}/api/performance/appraisals/${a.appraisal_id}`, auth()); setView(d); }
    catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر فتح التقييم') }); }
  };

  const rows = data?.appraisals || [];
  const dist = data?.distribution || {};
  return (
    <div className="p-4 sm:p-6 space-y-4 text-sm" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-blue-700" aria-hidden />تقييم الأداء</h1>
        {tab === 'appraisals' && <button onClick={newForm} className={btn}><Plus className="w-4 h-4" aria-hidden /> تقييم جديد</button>}
      </div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[['appraisals', 'التقييمات'], ['metrics', `مقاييس الأداء (${templates.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2 -mb-px border-b-2 font-semibold ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{l}</button>
        ))}
      </div>
      <Msg m={msg} />

      {tab === 'metrics' && <MetricsTab templates={templates} reload={loadTemplates} setMsg={setMsg} />}

      {tab === 'appraisals' && (
        <>
          {templates.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              لم تُحدَّد مقاييس الأداء بعد. افتح تبويب «مقاييس الأداء» وأضف المقاييس الجاهزة، فتُحمَّل تلقائياً عند تقييم كل موظف حسب إدارته.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Field label="فترة التقييم"><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q3 أو 2026-Annual" dir="ltr" className={`${input} w-48`} /></Field>
            <Field label="الإدارة / القسم"><select value={dept} onChange={(e) => setDept(e.target.value)} className={`${input} w-48`}>
              <option value="">الكل</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
            <button onClick={load} className={btn2}>عرض</button>
            {data?.pending_payroll_apply > 0 && (
              <button disabled={busy} className={btn2}
                onClick={() => window.confirm(`ترحيل ${data.pending_payroll_apply} زيادة معتمدة لرواتب الموظفين؟`) &&
                  act(() => axios.post(`${API}/api/performance/appraisals/bulk-apply`, { apply_from_month: thisMonth(), review_period: period || undefined }, auth()))}>
                ترحيل كل الزيادات المعتمدة ({data.pending_payroll_apply})</button>
            )}
          </div>
          {data && rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[['عدد التقييمات', data.total], ['متوسط الدرجة', r1(data.avg_score)],
                ['يتجاوز التوقعات فأعلى', (dist.exceptional || 0) + (dist.exceeds || 0)], ['أقل من المطلوب', (dist.needs_improvement || 0) + (dist.unsatisfactory || 0)]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-lg font-extrabold"><L>{v}</L></p></div>
              ))}
            </div>
          )}
          {!data ? <Loading /> : rows.length === 0 ? <p className="text-slate-500 py-8 text-center">لا توجد تقييمات — ابدأ بـ «تقييم جديد».</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800"><tr>
                  <th className={th}>الموظف</th><th className={th}>الفترة</th><th className={th}>الدرجة والتقدير</th>
                  <th className={th}>التوصية</th><th className={th}>الحالة</th><th className={th} /></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((a) => (
                    <tr key={a.appraisal_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className={td}><button onClick={() => openView(a)} className="font-semibold hover:underline text-start">{a.employee_name}</button>
                        <div className="text-xs text-slate-500">{[a.job_title, a.department].filter(Boolean).join(' · ')}</div></td>
                      <td className={td}><L>{a.review_period}</L></td>
                      <td className={td}><ScoreBadge score={a.kpi_score} /></td>
                      <td className={td}>{a.recommendation_ar}{a.salary_increment_percentage > 0 && <> — <L>{a.salary_increment_percentage}%</L></>}</td>
                      <td className={td}>{STATUS_AR[a.status] || a.status}{a.is_applied_to_payroll && <span className="block text-xs text-emerald-700">رُحِّلت للراتب من <L>{a.applied_from_month}</L></span>}</td>
                      <td className={`${td} whitespace-nowrap`}><button onClick={() => openView(a)} className="text-blue-700 font-semibold">التفاصيل</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view && (
        <Modal wide title={`تقييم ${view.employee_name}`} onClose={() => setView(null)}
          footer={<>
            {view.status === 'draft' && <>
              <button disabled={busy} className={btn2} onClick={() => act(() => axios.post(`${API}/api/performance/appraisals/${view.appraisal_id}/approve`, { decision: 'rejected' }, auth()))}>رفض</button>
              <button disabled={busy} className={btn} onClick={() => act(() => axios.post(`${API}/api/performance/appraisals/${view.appraisal_id}/approve`, { decision: 'approved' }, auth()))}><Check className="w-4 h-4" aria-hidden /> اعتماد</button>
            </>}
            {view.status === 'approved' && !view.is_applied_to_payroll && view.salary_increment_percentage > 0 && (
              <button disabled={busy} className={btn}
                onClick={() => window.confirm(`رفع الراتب الأساسي لـ ${view.employee_name} بنسبة ${view.salary_increment_percentage}% (من ${money(view.current_salary)} إلى ${money(view.current_salary * (1 + view.salary_increment_percentage / 100))})؟`) &&
                  act(() => axios.post(`${API}/api/performance/appraisals/${view.appraisal_id}/apply-to-payroll`, { apply_from_month: thisMonth() }, auth()))}>
                ترحيل الزيادة للراتب</button>
            )}
            <button onClick={() => setView(null)} className={btn2}>إغلاق</button>
          </>}>
          <AppraisalDetail a={view} />
        </Modal>
      )}

      {form && (
        <Modal wide title="تقييم أداء جديد" onClose={() => setForm(null)}
          footer={<><button onClick={() => setForm(null)} className={btn2}>إلغاء</button>
            <button onClick={save} disabled={busy || !form.employee_id || !form.kpi_scores.length} className={btn}>{busy ? '…' : 'حفظ كمسودة'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="الموظف" className="sm:col-span-2"><select value={form.employee_id} onChange={(e) => pickEmp(e.target.value)} className={input}>
              <option value="">— اختر —</option>
              {emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.department ? ` — ${e.department}` : ''}</option>)}</select></Field>
            <Field label="فترة التقييم"><input dir="ltr" value={form.review_period} onChange={(e) => setForm({ ...form, review_period: e.target.value })} className={input} /></Field>
            <Field label="النوع"><select value={form.period_type} onChange={(e) => setForm({ ...form, period_type: e.target.value })} className={input}>
              {Object.entries(PERIOD_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="مقاييس الأداء" className="sm:col-span-2"><select value={form.template_id} onChange={(e) => pickTemplate(e.target.value)} className={input}>
              <option value="">— بدون مجموعة —</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="تاريخ التقييم"><input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} className={input} /></Field>
          </div>
          {emp && <p className="text-xs text-slate-500">{[emp.position, emp.department].filter(Boolean).join(' · ')} — الراتب الأساسي <L>{money(emp.basic_salary)}</L></p>}

          {form.kpi_scores.length === 0 ? (
            <p className="text-slate-500">اختر الموظف لتُحمَّل مقاييس إدارته، أو أضف المؤشرات يدوياً.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800"><tr>
                  <th className={th}>المؤشر</th><th className={th}>الوزن</th><th className={th}>المستهدف</th><th className={th}>الفعلي</th>
                  <th className={th}>الدرجة /100</th><th className={th}>ملاحظة</th><th className={th} /></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {form.kpi_scores.map((k, i) => (
                    <tr key={i} className="align-top">
                      <td className={`${td} min-w-[180px]`}>
                        <input value={k.kpi_name} onChange={(e) => setKpi(i, 'kpi_name', e.target.value)} className={input} aria-label="المؤشر" />
                        {k.description && <span className="block text-xs text-slate-500 mt-1">{k.description}{k.direction === 'lower' ? ' (الأقل أفضل)' : ''}</span>}</td>
                      <td className={`${td} w-20`}><input type="number" dir="ltr" value={k.weight} onChange={(e) => setKpi(i, 'weight', e.target.value)} className={input} aria-label="الوزن" /></td>
                      <td className={`${td} w-24`}><input dir="ltr" value={k.target} onChange={(e) => setKpi(i, 'target', e.target.value)} className={input} aria-label="المستهدف" />
                        {k.unit && <span className="text-xs text-slate-500">{k.unit}</span>}</td>
                      <td className={`${td} w-24`}><input dir="ltr" value={k.actual} onChange={(e) => setKpi(i, 'actual', e.target.value)} className={input} aria-label="الفعلي" /></td>
                      <td className={`${td} w-24`}><input type="number" min="0" max="100" dir="ltr" value={k.score} onChange={(e) => setKpi(i, 'score', e.target.value)}
                        className={`${input} ${k.score === '' ? 'border-amber-400' : ''}`} aria-label="الدرجة" /></td>
                      <td className={`${td} min-w-[140px]`}><input value={k.notes || ''} onChange={(e) => setKpi(i, 'notes', e.target.value)} className={input} aria-label="ملاحظة" /></td>
                      <td className={td}><button onClick={() => setForm({ ...form, kpi_scores: form.kpi_scores.filter((_, j) => j !== i) })} className="p-2 text-slate-400 hover:text-red-600" aria-label="حذف المؤشر"><X className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={() => setForm({ ...form, kpi_scores: [...form.kpi_scores, { kpi_name: '', weight: 0, target: '', actual: '', score: '', notes: '', direction: 'higher' }] })} className={btn2}><Plus className="w-4 h-4" aria-hidden /> مؤشر</button>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span>الدرجة الإجمالية: <ScoreBadge score={score} /></span>
            <span className={Math.abs(weightTotal - 100) > 0.01 ? 'text-amber-700' : 'text-slate-500'}>مجموع الأوزان <L>{weightTotal}%</L></span>
            {unscored > 0 && <span className="text-amber-700">{unscored} مؤشر بلا درجة (تُحسب صفراً)</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="توصية المدير"><select value={form.manager_recommendation} onChange={(e) => setForm({ ...form, manager_recommendation: e.target.value })} className={input}>
              {Object.entries(RECS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="نسبة الزيادة %"><input type="number" min="0" max="100" dir="ltr" value={form.salary_increment_percentage} onChange={(e) => setForm({ ...form, salary_increment_percentage: e.target.value })} className={input} /></Field>
            {form.manager_recommendation === 'promotion' && <Field label="المسمى الجديد"><input value={form.promotion_to_title} onChange={(e) => setForm({ ...form, promotion_to_title: e.target.value })} className={input} /></Field>}
          </div>
          {emp && Number(form.salary_increment_percentage) > 0 && (
            <p className="text-xs text-slate-600">الراتب الأساسي <L>{money(emp.basic_salary)}</L> ← بعد الزيادة <L>{money((emp.basic_salary || 0) * (1 + form.salary_increment_percentage / 100))}</L> (بعد الاعتماد والترحيل)</p>
          )}
          <p className="text-xs text-slate-500">الترقية تتطلب 80 فأكثر، وخطة تحسين الأداء لأقل من 70.</p>
          <Field label="ملاحظات المدير (نقاط القوة، ما يحتاج تطويراً، أهداف الفترة القادمة)"><textarea rows={3} value={form.manager_notes} onChange={(e) => setForm({ ...form, manager_notes: e.target.value })} className={input} /></Field>
          {err && <p role="alert" className="text-red-700">{err}</p>}
        </Modal>
      )}
    </div>
  );
}

// ── employee profile tab ──────────────────────────────────────
// the employee portal gets only approved appraisals; the summary is worked out here
function summarise(rows) {
  const ok = rows.filter((a) => a.status === 'approved');
  return {
    appraisals: rows,
    latest_score: ok[0]?.kpi_score ?? null,
    average_score: ok.length ? Math.round(ok.reduce((s, a) => s + (Number(a.kpi_score) || 0), 0) / ok.length * 100) / 100 : null,
    trend: ok.slice().reverse().map((a) => ({ period: a.review_period, score: a.kpi_score })),
  };
}

export function EmployeeAppraisals({ employeeId, self = false, token = null }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!self && !employeeId) return;
    const url = self ? `${API}/api/ess/my-appraisals` : `${API}/api/performance/employee/${employeeId}/appraisals`;
    // token: the portal's «معاينة» passes its read-only preview token
    axios.get(url, token ? { headers: { Authorization: `Bearer ${token}` } } : auth())
      .then((r) => { const d = self ? summarise(r.data.appraisals || []) : r.data; setData(d); setOpen(d.appraisals?.[0]?.appraisal_id || null); })
      .catch((e) => { setData({ appraisals: [] }); setErr(errText(e, 'تعذّر تحميل التقييمات')); });
  }, [employeeId, self, token]);

  if (!data) return <Loading />;
  const rows = data.appraisals || [];
  return (
    <div className="space-y-4 text-sm" dir="rtl">
      {err && <p role="alert" className="text-red-700">{err}</p>}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-slate-500">{self ? 'لا توجد تقييمات أداء معتمدة لك بعد.' : 'لا توجد تقييمات أداء لهذا الموظف بعد — تُضاف من «الموارد البشرية ← تقييم الأداء».'}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 flex items-center gap-1"><Target className="w-3.5 h-3.5" aria-hidden />آخر تقييم معتمد</p>
              <p className="mt-1">{data.latest_score != null ? <ScoreBadge score={data.latest_score} /> : <span className="text-slate-500">لا يوجد تقييم معتمد</span>}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500">متوسط التقييمات المعتمدة</p>
              <p className="mt-1">{data.average_score != null ? <ScoreBadge score={data.average_score} /> : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 mb-2">التطور عبر الفترات</p>
              {data.trend?.length ? (
                <div className="flex items-end gap-1.5 h-14" aria-label="تطور الدرجة">
                  {data.trend.map((t) => (
                    <div key={t.period} className="flex flex-col items-center gap-0.5 flex-1 min-w-0" title={`${t.period}: ${t.score}`}>
                      <div className={`w-full rounded-t ${ratingOf(t.score)[2]}`} style={{ height: `${Math.max(6, (t.score / 100) * 44)}px` }} />
                      <span className="text-[10px] text-slate-500 truncate w-full text-center" dir="ltr">{t.period}</span>
                    </div>
                  ))}
                </div>
              ) : <span className="text-slate-500">—</span>}
            </div>
          </div>
          {rows.map((a) => (
            <div key={a.appraisal_id} className="rounded-xl border border-slate-200 dark:border-slate-700">
              <button onClick={() => setOpen(open === a.appraisal_id ? null : a.appraisal_id)} aria-expanded={open === a.appraisal_id}
                className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-start">
                <span className="flex items-center gap-2 font-bold"><ChevronDown className={`w-4 h-4 transition-transform ${open === a.appraisal_id ? 'rotate-180' : ''}`} aria-hidden />
                  <L>{a.review_period}</L><span className="text-xs font-normal text-slate-500">{STATUS_AR[a.status] || a.status}</span></span>
                <ScoreBadge score={a.kpi_score} />
              </button>
              {open === a.appraisal_id && <div className="px-4 pb-4"><AppraisalDetail a={a} /></div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
