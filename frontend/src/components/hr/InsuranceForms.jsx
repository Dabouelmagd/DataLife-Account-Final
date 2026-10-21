/**
 * استمارات التأمينات الاجتماعية — استمارة 1 (التحاق) واستمارة 6 (انتهاء خدمة)
 *   InsuranceFormsPage — اختيار الموظف، معاينة البيانات، تنزيل ورقة البيانات PDF
 *
 * ورقة بيانات لنقلها إلى الاستمارة الرسمية للهيئة أو إرفاقها بها — ليست الاستمارة الرسمية.
 * Backend: /api/insurance-forms/{form1,form6}/{employee_id}[/pdf], /api/insurance-forms/reasons
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Download, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errText = (e, f) => { const d = e?.response?.data?.detail; return typeof d === 'string' ? d : f; };

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btn = 'inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50';
const btn2 = 'inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-50';
const L = ({ children }) => <bdi dir="ltr" className="tabular-nums">{children}</bdi>;

function Section({ title, rows }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <p className="px-3 py-2 bg-slate-50 dark:bg-slate-800 font-bold text-sm">{title}</p>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-2 gap-2 px-3 py-1.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function InsuranceFormsPage() {
  const [emps, setEmps] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [kind, setKind] = useState('form1');
  const [empId, setEmpId] = useState('');
  const [termDate, setTermDate] = useState('');
  const [reason, setReason] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    axios.get(`${API}/api/employees`, auth()).then((r) => setEmps(r.data?.employees || [])).catch(() => setEmps([]));
    axios.get(`${API}/api/insurance-forms/reasons`, auth()).then((r) => setReasons(r.data?.reasons || [])).catch(() => setReasons([]));
  }, []);

  const params = () => {
    if (kind !== 'form6') return {};
    const p = {};
    if (termDate) p.termination_date = termDate;
    if (reason) p.termination_reason = reason;
    return p;
  };

  const preview = async () => {
    setBusy(true); setErr(''); setData(null);
    try {
      const { data: d } = await axios.get(`${API}/api/insurance-forms/${kind}/${empId}`, { ...auth(), params: params() });
      setData(d);
    } catch (e) { setErr(errText(e, 'تعذّر تحميل بيانات الاستمارة')); } finally { setBusy(false); }
  };

  const download = async () => {
    setBusy(true); setErr('');
    try {
      const r = await axios.get(`${API}/api/insurance-forms/${kind}/${empId}/pdf`, { ...auth(), params: params(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${kind === 'form1' ? 'استمارة-1' : 'استمارة-6'}-${empId.slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { setErr('تعذّر تنزيل ملف PDF'); } finally { setBusy(false); }
  };

  const er = data?.employer_data || {};
  const ee = data?.employee_data || {};
  const w = data?.insurance_wage || {};
  const st = data?.settlement || {};
  const list = kind === 'form6' ? emps : emps.filter((e) => e.is_active !== false && e.status !== 'terminated');

  return (
    <div className="p-4 sm:p-6 space-y-4" dir="rtl">
      <h1 className="text-2xl font-extrabold">استمارات التأمينات الاجتماعية</h1>
      <p className="text-sm text-amber-700">ورقة بيانات من النظام لنقلها إلى الاستمارة الرسمية للهيئة القومية للتأمين الاجتماعي أو إرفاقها بها — ليست الاستمارة الرسمية.</p>

      <div className="flex flex-wrap gap-2" role="tablist">
        {[['form1', 'استمارة 1 — التحاق'], ['form6', 'استمارة 6 — انتهاء خدمة']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setData(null); setErr(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${kind === k ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
        <label className="text-sm">الموظف
          <select value={empId} onChange={(e) => { setEmpId(e.target.value); setData(null); }} className={input}>
            <option value="">— اختر الموظف —</option>
            {list.map((e) => <option key={e.id} value={e.id}>{e.name}{e.employee_code ? ` (${e.employee_code})` : ''}</option>)}
          </select>
        </label>
        {kind === 'form6' && (
          <>
            <label className="text-sm">تاريخ انتهاء الخدمة (اختياري)
              <input type="date" value={termDate} onChange={(e) => setTermDate(e.target.value)} className={input} />
            </label>
            <label className="text-sm">السبب (اختياري)
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>
                <option value="">من التسوية / ملف الموظف</option>
                {reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={preview} disabled={busy || !empId} className={btn}><Eye className="w-4 h-4" aria-hidden /> معاينة</button>
        <button onClick={download} disabled={busy || !empId} className={btn2}><Download className="w-4 h-4" aria-hidden /> تنزيل PDF</button>
        {busy && <Loader2 className="w-5 h-5 animate-spin text-slate-400 self-center" aria-label="جارٍ التحميل" />}
      </div>
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}

      {data && (
        <div className="space-y-3 max-w-3xl">
          <p className="font-extrabold">{data.form_name}</p>
          {data.missing_fields?.length > 0 ? (
            <p className="text-sm text-amber-700 flex items-start gap-1"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> بيانات ناقصة: {data.missing_fields.join('، ')}</p>
          ) : (
            <p className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" aria-hidden /> البيانات المطلوبة مكتملة</p>
          )}
          {kind === 'form6' && (
            <p className={`text-sm ${data.form6_ready ? 'text-emerald-700' : 'text-slate-600'}`}>
              {data.form6_ready ? 'جاهزة للتقديم: الموظف منتهية خدمته والبيانات مكتملة' : data.employee_terminated ? 'الموظف منتهية خدمته — أكمل البيانات الناقصة' : 'لم تُعتمد تسوية أو إخلاء طرف لهذا الموظف بعد'}
            </p>
          )}
          <Section title="بيانات صاحب العمل" rows={[['اسم المنشأة', er.company_name], ['الرقم التأميني للمنشأة', <L key="i">{er.insurance_number}</L>],
            ['العنوان', er.address], ['الرقم الضريبي', <L key="t">{er.tax_number}</L>]]} />
          {kind === 'form1' ? (
            <>
              <Section title="بيانات العامل" rows={[['الاسم', ee.name], ['الرقم القومي', <L key="n">{ee.national_id}</L>],
                ['الرقم التأميني', <L key="s">{ee.insurance_number}</L>], ['تاريخ الميلاد', <L key="b">{ee.date_of_birth}</L>],
                ['تاريخ التعيين', <L key="h">{ee.hire_date}</L>], ['الوظيفة', ee.job_title], ['الإدارة', ee.department]]} />
              <Section title="أجر الاشتراك (نفس قاعدة كشف الرواتب)" rows={[['الأجر المعلن', <L key="d">{money(w.declared_wage)}</L>],
                ['أجر الاشتراك بعد الحدين', <L key="w">{money(w.insurable_wage)}</L>],
                ['حصة العامل / صاحب العمل', <L key="sh">{`${money(w.employee_share)} / ${money(w.employer_share)}`}</L>], ['المصدر', w.source]]} />
            </>
          ) : (
            <>
              <Section title="انتهاء الخدمة" rows={[['الاسم', ee.name], ['الرقم القومي', <L key="n">{ee.national_id}</L>],
                ['الرقم التأميني', <L key="s">{ee.insurance_number}</L>], ['تاريخ التعيين', <L key="h">{ee.hire_date}</L>],
                ['تاريخ انتهاء الخدمة', <L key="t">{ee.termination_date}</L>], ['السبب', ee.termination_reason],
                ['آخر أجر اشتراك', <L key="w">{money(ee.last_insurance_wage)}</L>], ['مصدره', w.last_wage_source]]} />
              <Section title="المستحقات" rows={[['مكافأة نهاية الخدمة', <L key="e">{money(st.end_of_service_amount)}</L>], ['مصدرها', st.end_of_service_source],
                ['رصيد الإجازات (يوم)', <L key="d">{st.leave_balance_days}</L>], ['مقابل الإجازات', <L key="l">{money(st.leave_encashment)}</L>], ['مصدره', st.leave_source]]} />
            </>
          )}
          <p className="text-xs text-slate-500">{data.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

export default InsuranceFormsPage;
