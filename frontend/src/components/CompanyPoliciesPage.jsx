/**
 * الإعدادات ← سياسات الشركة
 * Choices each company makes with its own accountant and lawyer: the real-estate
 * disposal tax, record retention years, and a record of who reviewed which
 * policy (HR under Labour Law 14/2025, data protection under Law 151/2020).
 * The program records the company's statement; it never declares compliance.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Scale, Save } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';

const RECORDS = {
  journal_entries: 'القيود المحاسبية', invoices: 'الفواتير', payroll_runs: 'مسيرات الرواتب', tax_forms: 'الإقرارات والنماذج الضريبية',
  eta_signing_records: 'سجلات الفاتورة الإلكترونية', letters_of_credit: 'الاعتمادات المستندية', audit_trail: 'سجل المراجعة',
  employees: 'ملفات العاملين', contracts: 'العقود',
};
const REVIEWS = {
  hr_policy: ['سياسة الموارد البشرية', 'الإضافي والجزاءات ومكافأة نهاية الخدمة — على قانون العمل 14/2025. تُضبط القيم من: الموارد البشرية ← الإجازات والإضافي والجزاءات ← السياسة.'],
  real_estate_tax: ['ضريبة التصرفات العقارية', 'هل تنطبق على مبيعات شركتك ونسبتها.'],
  retention: ['مدد الاحتفاظ بالسجلات', 'المدد المحددة أعلاه.'],
  penalties: ['معالجة حصيلة الجزاءات', 'تخفيض مصروف الأجور أو حساب الخدمات الاجتماعية للعاملين.'],
  data_protection: ['حماية البيانات الشخصية', 'طريقة تعامل الشركة مع بيانات العاملين والعملاء — قانون 151/2020.'],
};

export default function CompanyPoliciesPage() {
  const [p, setP] = useState(null);
  const [meta, setMeta] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/company-policies`, auth())
      .then((r) => { setP(r.data.policies); setMeta(r.data); })
      .catch((e) => setMsg({ err: true, text: e?.response?.data?.detail || 'تعذّر تحميل السياسات' }));
  }, []);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const { data } = await axios.put(`${API}/api/company-policies`, p, auth());
      setP(data.policies); setMsg({ text: data.message });
    } catch (e) {
      const d = e?.response?.data?.detail;
      setMsg({ err: true, text: typeof d === 'string' ? d : 'تعذّر الحفظ' });
    } finally { setBusy(false); }
  };

  if (!p) return <div className="flex justify-center py-16">{msg ? <p className="text-sm text-red-700">{msg.text}</p> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}</div>;

  const setRe = (k, v) => setP({ ...p, real_estate: { ...p.real_estate, [k]: v } });
  const setRet = (k, v) => setP({ ...p, retention_years: { ...p.retention_years, [k]: v } });
  const setRev = (k, f, v) => setP({ ...p, legal_review: { ...p.legal_review, [k]: { ...p.legal_review[k], [f]: v } } });
  const hold = new Set(meta.legal_hold || []);

  return (
    <div className="space-y-5 text-sm" dir="rtl">
      <div className="flex items-start gap-3">
        <Scale className="w-6 h-6 text-slate-600 mt-1" aria-hidden />
        <div>
          <h2 className="text-lg font-extrabold">سياسات الشركة</h2>
          <p className="text-slate-500">{meta.note}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-bold">ضريبة التصرفات العقارية</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!p.real_estate.disposal_tax_enabled} onChange={(e) => setRe('disposal_tax_enabled', e.target.checked)} />
          تُطبَّق افتراضياً عند تسليم الوحدات العقارية
        </label>
        <label className="block max-w-xs"><span className="text-slate-600">النسبة %</span>
          <input type="number" min="0" max="10" step="0.1" dir="ltr" className={input}
            value={Math.round((p.real_estate.disposal_tax_rate || 0) * 1000) / 10}
            onChange={(e) => setRe('disposal_tax_rate', (Number(e.target.value) || 0) / 100)} /></label>
        <p className="text-xs text-slate-500">يمكن تغيير الاختيار لكل وحدة عند تسليمها.</p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
        <h3 className="font-bold">الجزاءات المخصومة من الرواتب</h3>
        {[['reduce_expense', 'تخفّض مصروف الأجور (331)'], ['welfare_fund', 'تُحفظ في حساب الخدمات الاجتماعية للعاملين (250)']].map(([v, l]) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="pen" checked={(p.payroll?.penalties_treatment || 'reduce_expense') === v}
              onChange={() => setP({ ...p, payroll: { ...(p.payroll || {}), penalties_treatment: v } })} /> {l}
          </label>
        ))}
        <p className="text-xs text-slate-500">يُطبَّق على مسيرات الرواتب التي تُعتمد بعد الحفظ.</p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-bold mb-1">مدد الاحتفاظ بالسجلات (بالسنوات)</h3>
        <p className="text-xs text-slate-500 mb-3">السجلات المحاسبية والضريبية لا تقل عن {meta.legal_min_years || 5} سنوات. البرنامج لا يحذف أي سجل — يُعلَّم للأرشفة فقط.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(RECORDS).map(([k, l]) => (
            <label key={k}><span className="text-slate-600">{l}{hold.has(k) ? ' *' : ''}</span>
              <input type="number" dir="ltr" min={hold.has(k) ? meta.legal_min_years || 5 : 1} max="50" className={input}
                value={p.retention_years[k] ?? ''} onChange={(e) => setRet(k, e.target.value)} /></label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div>
          <h3 className="font-bold">المراجعة القانونية</h3>
          <p className="text-xs text-slate-500">سجّل من راجع كل سياسة لشركتك ومتى. هذا بيان من الشركة، وليس شهادة امتثال من البرنامج.</p>
        </div>
        {Object.entries(REVIEWS).map(([k, [title, hint]]) => {
          const r = p.legal_review[k] || {};
          return (
            <div key={k} className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={!!r.reviewed} onChange={(e) => setRev(k, 'reviewed', e.target.checked)} />
                {title} — تمت مراجعتها
              </label>
              <p className="text-xs text-slate-500 mt-1">{hint}</p>
              {r.reviewed && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <label><span className="text-slate-600">بواسطة *</span>
                    <input className={input} value={r.reviewer || ''} onChange={(e) => setRev(k, 'reviewer', e.target.value)} placeholder="اسم المحامي / المحاسب" /></label>
                  <label><span className="text-slate-600">التاريخ</span>
                    <input type="date" className={input} value={r.date || ''} onChange={(e) => setRev(k, 'date', e.target.value)} /></label>
                  <label><span className="text-slate-600">ملاحظات</span>
                    <input className={input} value={r.note || ''} onChange={(e) => setRev(k, 'note', e.target.value)} /></label>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50">
          <Save className="w-4 h-4" aria-hidden /> {busy ? '…' : 'حفظ السياسات'}</button>
        {msg && <p className={msg.err ? 'text-red-700' : 'text-emerald-700'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>}
      </div>
    </div>
  );
}
