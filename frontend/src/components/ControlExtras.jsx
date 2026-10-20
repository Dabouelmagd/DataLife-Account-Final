/**
 * الرقابة والالتزام — شاشات لموديولات كانت في الخلفية بلا واجهة:
 *   FraudControlPage    — كشف المخاطر والاحتيال (/api/fraud) + سلامة سجل التدقيق (/api/erp-core/audit)
 *   DataProtectionPage  — أدوات طلبات حماية البيانات الشخصية (/api/data-protection)
 *                          (أدوات مساعدة — ليست شهادة امتثال لقانون 151/2020)
 *   ConsolidationPage   — القوائم المجمعة لمجموعة شركات (/api/consolidation)
 * The fraud checks only read; consolidation adjustments are working papers and
 * are never posted to any company's ledger — previews say so.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Loader2, Plus, X, ShieldAlert, ShieldCheck, Search, CheckCircle2, AlertTriangle,
  Trash2, Printer, Copy, Building2, FileLock2, Link2,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = (n) => (Number(n) || 0).toLocaleString('en-US');
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50';
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm';
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;
const I = ({ v }) => <bdi dir="ltr" className="tabular-nums">{intf(v)}</bdi>;
const D = ({ v }) => <bdi dir="ltr">{String(v || '').slice(0, 10) || '—'}</bdi>;

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

function Lines({ rows, title }) {
  const dr = r2(rows.reduce((s, r) => s + (r[1] || 0), 0));
  const cr = r2(rows.reduce((s, r) => s + (r[2] || 0), 0));
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs">
      <p className="font-bold mb-2">{title}</p>
      <table className="w-full">
        <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
        <tbody>
          {rows.filter((r) => r[1] || r[2]).map((r, i) => (
            <tr key={`${r[0]}-${i}`}><td className="py-0.5">{r[0]}</td>
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
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`px-4 py-2 rounded-full text-sm font-semibold border ${value === k ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600'}`}>{l}</button>
      ))}
    </div>
  );
}

const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
const Empty = ({ text }) => <p className="text-center py-12 text-sm text-slate-500">{text}</p>;
const ErrorLine = ({ text }) => (text ? <p className="text-sm text-red-700" role="alert">{text}</p> : null);

function Table({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <tr>{head.map(([l, cls]) => <th key={l} className={`px-3 py-2 whitespace-nowrap ${cls || 'text-start'}`}>{l}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

/* ═════════════════════════ كشف المخاطر والاحتيال ═════════════════════════ */

const RISK = {
  CRITICAL: ['حرج', 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'],
  HIGH: ['مرتفع', 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'],
  MEDIUM: ['متوسط', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'],
  LOW: ['منخفض', 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'],
  CLEAN: ['سليم', 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'],
};
const Risk = ({ level }) => {
  const [l, c] = RISK[level] || [level || '—', 'bg-slate-100 text-slate-700'];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${c}`}>{l}</span>;
};

const ALERT_TYPES = {
  duplicate_payment: 'دفعة / فاتورة مكررة',
  EXACT_DUPLICATE: 'فاتورتان متطابقتان لنفس المورد',
  NEAR_DUPLICATE: 'فاتورتان متقاربتان لنفس المورد',
  SAME_SUPPLIER_INVOICE_NUMBER: 'رقم فاتورة المورد مسجل مرتين',
  DUPLICATE_PAYMENT_VOUCHER: 'سندا صرف لنفس المستفيد بنفس المبلغ',
  SAME_AMOUNT_MULTIPLE_VENDORS: 'نفس المبلغ لعدة موردين في يوم واحد',
  benford_anomaly: 'انحراف عن توزيع بنفورد',
  NO_ATTENDANCE_IN_PAYROLL: 'راتب بدون أي حضور',
  ANOMALY_WORK_HOURS: 'ساعات عمل غير معتادة',
  REMOTE_LOCATION_CHECKIN: 'تسجيل حضور من مكان بعيد',
  DUPLICATE_NATIONAL_ID: 'رقم قومي مكرر لأكثر من موظف',
  UNAPPROVED_OVERTIME: 'وقت إضافي بدون اعتماد',
  SELF_APPROVED_ENTRY: 'قيد يدوي أنشأه ورحَّله نفس المستخدم',
  WEEKEND_ENTRY: 'قيد يدوي بتاريخ يوم عطلة',
  ROUND_AMOUNT_ENTRY: 'قيد يدوي بمبلغ مدوَّر',
};
const typeLabel = (t) => ALERT_TYPES[t] || t;

const alertSummary = (a) => {
  const d = a.details || {};
  if (d.detail) return d.detail;
  if (d.invoice_a) return `${d.invoice_a} / ${d.invoice_b}${d.vendor ? ` — ${d.vendor}` : ''}`;
  if (d.suspicious_digits) return `${d.n || ''} مبلغ — ${d.suspicious_digits.length} رقم أول غير طبيعي`;
  return '';
};

function FindingsTable({ rows, kind }) {
  if (!rows || rows.length === 0) return <Empty text="لا ملاحظات." />;
  if (kind === 'journal') {
    return (
      <Table head={[['القيد'], ['التاريخ'], ['الملاحظة'], ['المستخدم', 'text-start hidden md:table-cell'], ['المبلغ', 'text-end'], ['الدرجة']]}>
        {rows.map((f, i) => (
          <tr key={`${f.entry_id}-${f.type}-${i}`}>
            <td className="px-3 py-2"><bdi dir="ltr">{f.entry_number ?? '—'}</bdi></td>
            <td className="px-3 py-2"><D v={f.entry_date} /></td>
            <td className="px-3 py-2">{typeLabel(f.type)}<div className="text-xs text-slate-500">{f.description}</div></td>
            <td className="px-3 py-2 hidden md:table-cell">{f.created_by || '—'}</td>
            <td className="px-3 py-2 text-end"><N v={f.amount} /></td>
            <td className="px-3 py-2"><Risk level={f.risk} /></td>
          </tr>
        ))}
      </Table>
    );
  }
  if (kind === 'dups') {
    return (
      <Table head={[['النوع'], ['المستند الأول'], ['المستند الثاني'], ['المورد / المستفيد'], ['المبلغ', 'text-end'], ['الفارق بالأيام', 'text-end hidden md:table-cell'], ['الدرجة']]}>
        {rows.map((d, i) => (
          <tr key={`${d.fingerprint || i}`}>
            <td className="px-3 py-2">{typeLabel(d.type)}</td>
            <td className="px-3 py-2"><bdi dir="ltr">{d.invoice_a}</bdi> <span className="text-xs text-slate-500"><D v={d.date_a} /></span></td>
            <td className="px-3 py-2"><bdi dir="ltr">{d.invoice_b}</bdi> <span className="text-xs text-slate-500"><D v={d.date_b} /></span></td>
            <td className="px-3 py-2">{d.vendor || '—'}{d.supplier_ref && <div className="text-xs text-slate-500">رقم المورد: <bdi dir="ltr">{d.supplier_ref}</bdi></div>}</td>
            <td className="px-3 py-2 text-end"><N v={d.amount} /></td>
            <td className="px-3 py-2 text-end hidden md:table-cell">{d.days_apart != null && d.days_apart !== 999 ? <I v={d.days_apart} /> : '—'}</td>
            <td className="px-3 py-2"><Risk level={d.risk} /></td>
          </tr>
        ))}
      </Table>
    );
  }
  // ghost employees
  return (
    <Table head={[['الملاحظة'], ['الموظف'], ['التفاصيل'], ['الدرجة']]}>
      {rows.map((a, i) => (
        <tr key={`${a.type}-${a.employee_id || a.national_id || i}-${a.date || ''}`}>
          <td className="px-3 py-2">{typeLabel(a.type)}</td>
          <td className="px-3 py-2">{a.employee_name || (a.employees || []).map((e) => e.name).join('، ') || a.employee_id || '—'}</td>
          <td className="px-3 py-2">{a.detail}<div className="text-xs text-slate-500">{a.action}</div></td>
          <td className="px-3 py-2"><Risk level={a.risk} /></td>
        </tr>
      ))}
    </Table>
  );
}

function AlertsTab() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('open');
  const [err, setErr] = useState('');
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (s = status) => {
    setRows(null); setErr('');
    try {
      const params = { limit: 200 };
      if (s !== 'all') params.status = s;
      const { data } = await axios.get(`${API}/api/fraud/alerts`, { ...auth(), params });
      setRows(data.alerts || []);
    } catch (e) { setRows([]); setErr(errText(e, 'تعذّر تحميل التنبيهات')); }
  };
  useEffect(() => { load(status); }, [status]);

  const close = async () => {
    setBusy(true); setErr('');
    try {
      await axios.patch(`${API}/api/fraud/alerts/${closing.id}/resolve`, { status: closing.status, resolution: closing.resolution }, auth());
      setClosing(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر إغلاق التنبيه')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="text-slate-600">الحالة</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            <option value="open">مفتوحة</option><option value="resolved">تمت المعالجة</option>
            <option value="false_positive">إنذار غير صحيح</option><option value="all">الكل</option>
          </select></label>
        <p className="text-xs text-slate-500 pb-2">التنبيهات تُنشأ عند تشغيل الفحوص ولا يتكرر التنبيه نفسه عند إعادة الفحص.</p>
      </div>
      <ErrorLine text={!closing && err} />
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty text="لا توجد تنبيهات بهذه الحالة. شغِّل «الفحص الشامل» لمراجعة الشهر." /> : (
        <Table head={[['التاريخ'], ['النوع'], ['التفاصيل'], ['الدرجة'], ['', 'text-end']]}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2"><D v={a.last_seen_at || a.detected_at} /></td>
              <td className="px-3 py-2">{typeLabel(a.details?.type || a.alert_type)}</td>
              <td className="px-3 py-2 max-w-md">{alertSummary(a)}{a.resolution && <div className="text-xs text-slate-500">الإجراء: {a.resolution}</div>}</td>
              <td className="px-3 py-2"><Risk level={a.risk_level} /></td>
              <td className="px-3 py-2 text-end">
                {a.status === 'open' && <button onClick={() => setClosing({ id: a.id, status: 'resolved', resolution: '' })} className={btnGhost}>إغلاق</button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {closing && (
        <Modal title="إغلاق التنبيه" onClose={() => setClosing(null)}
          footer={<>
            <button onClick={() => setClosing(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={close} disabled={busy || !closing.resolution.trim()} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button>
          </>}>
          <div className="space-y-3">
            <fieldset className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={closing.status === 'resolved'} onChange={() => setClosing({ ...closing, status: 'resolved' })} /> تمت المراجعة والمعالجة</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={closing.status === 'false_positive'} onChange={() => setClosing({ ...closing, status: 'false_positive' })} /> إنذار غير صحيح</label>
            </fieldset>
            <label className="block"><span className="text-slate-600">ما الذي تم؟ (مطلوب)</span>
              <textarea rows={3} value={closing.resolution} onChange={(e) => setClosing({ ...closing, resolution: e.target.value })} className={input} placeholder="مثال: الفاتورتان لشحنتين مختلفتين — مرفق إذنا الاستلام" /></label>
            <ErrorLine text={err} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function ScanTab() {
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/api/fraud/full-scan`, { year: +period.year, month: +period.month }, auth());
      setRes(data);
    } catch (e) { setErr(errText(e, 'تعذّر تشغيل الفحص')); } finally { setBusy(false); }
  };

  const r = res?.results || {};
  const cards = res ? [
    ['فواتير/دفعات مكررة', res.summary.duplicate_payments],
    ['ملاحظات الرواتب والحضور', res.summary.ghost_employees],
    ['قيود رحَّلها منشئها', res.summary.self_approved_entries],
    ['مصروفات شاذة إحصائياً', res.summary.statistical_outliers],
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="text-slate-600">السنة</span>
          <input type="number" dir="ltr" value={period.year} onChange={(e) => setPeriod({ ...period, year: e.target.value })} className={`${input} w-28`} /></label>
        <label className="text-sm"><span className="text-slate-600">الشهر</span>
          <select value={period.month} onChange={(e) => setPeriod({ ...period, month: e.target.value })} className={`${input} w-28`}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select></label>
        <button onClick={run} disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" aria-hidden />} تشغيل الفحص الشامل</button>
      </div>
      <p className="text-xs text-slate-500">الفحص يقرأ البيانات فقط ولا يعدِّل أي قيد أو فاتورة. أي ملاحظة هي مؤشر للمراجعة وليست دليلاً على خطأ.</p>
      <ErrorLine text={err} />
      {res && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500">التقييم العام — <bdi dir="ltr">{res.period}</bdi></p>
              <div className="mt-1 flex items-center gap-2"><Risk level={res.overall_risk?.level} /><span className="text-xs">{res.recommendation}</span></div>
            </div>
            {cards.map(([l, v]) => (
              <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-extrabold mt-1"><I v={v} /></p>
              </div>
            ))}
          </div>
          <section className="space-y-2"><h3 className="font-bold">ضوابط القيود اليدوية</h3>
            {r.journal_controls?.error ? <ErrorLine text={r.journal_controls.error} /> : <FindingsTable rows={r.journal_controls?.findings} kind="journal" />}</section>
          <section className="space-y-2"><h3 className="font-bold">الفواتير والدفعات المكررة</h3>
            {r.duplicates?.error ? <ErrorLine text={r.duplicates.error} /> : <FindingsTable rows={r.duplicates?.duplicates} kind="dups" />}</section>
          <section className="space-y-2"><h3 className="font-bold">الرواتب والحضور</h3>
            {r.ghost?.error ? <ErrorLine text={r.ghost.error} /> : <FindingsTable rows={r.ghost?.alerts} kind="ghost" />}</section>
          <section className="space-y-2"><h3 className="font-bold">مصروفات شاذة إحصائياً</h3>
            {r.outliers?.message ? <p className="text-sm text-slate-500">{r.outliers.message}</p> : (r.outliers?.outliers || []).length === 0 ? <Empty text="لا مبالغ شاذة." /> : (
              <Table head={[['التاريخ'], ['الحساب'], ['البيان'], ['المبلغ', 'text-end']]}>
                {r.outliers.outliers.map((o, i) => (
                  <tr key={`${o.entry_number}-${i}`}><td className="px-3 py-2"><D v={o.entry_date} /></td>
                    <td className="px-3 py-2"><bdi dir="ltr">{o.account_code}</bdi> {o.account_name}</td>
                    <td className="px-3 py-2">{o.description}</td><td className="px-3 py-2 text-end"><N v={o.amount} /></td></tr>
                ))}
              </Table>
            )}</section>
          <section className="space-y-1"><h3 className="font-bold">توزيع بنفورد</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{r.benford?.message || r.benford?.interpretation || r.benford?.error}</p></section>
        </>
      )}
    </div>
  );
}

function JournalTab() {
  const [f, setF] = useState({ date_from: yearStart(), date_to: today(), weekend_days: '4,5', round_unit: 1000, min_round: 10000 });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.get(`${API}/api/fraud/journal-controls`, { ...auth(), params: f });
      setRes(data);
    } catch (e) { setErr(errText(e, 'تعذّر تشغيل الفحص')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <label className="text-sm"><span className="text-slate-600">من</span><input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className={input} /></label>
        <label className="text-sm"><span className="text-slate-600">إلى</span><input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className={input} /></label>
        <label className="text-sm"><span className="text-slate-600">أيام العطلة</span>
          <select value={f.weekend_days} onChange={(e) => setF({ ...f, weekend_days: e.target.value })} className={input}>
            <option value="4,5">الجمعة والسبت</option><option value="4">الجمعة فقط</option></select></label>
        <label className="text-sm"><span className="text-slate-600">مبلغ مدوَّر من مضاعفات</span>
          <input type="number" dir="ltr" value={f.round_unit} onChange={(e) => setF({ ...f, round_unit: e.target.value })} className={input} /></label>
        <button onClick={run} disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" aria-hidden />} فحص</button>
      </div>
      <p className="text-xs text-slate-500">يفحص القيود اليدوية المُرحَّلة فقط: قيد أنشأه ورحَّله نفس الشخص، قيد بتاريخ عطلة، قيد بمبلغ مدوَّر كبير (من <bdi dir="ltr">{intf(f.min_round)}</bdi>). القيود الآلية للفواتير والرواتب مستبعدة.</p>
      <ErrorLine text={err} />
      {res && (
        <>
          <p className="text-sm">تم فحص <I v={res.manual_entries} /> قيد يدوي من <I v={res.entries_analyzed} /> — {res.recommendation}</p>
          <FindingsTable rows={res.findings} kind="journal" />
        </>
      )}
    </div>
  );
}

function DuplicatesTab() {
  const [f, setF] = useState({ date_from: yearStart(), date_to: today(), days_window: 30, tolerance_pct: 0 });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.get(`${API}/api/fraud/duplicate-payments`, { ...auth(), params: f });
      setRes(data);
    } catch (e) { setErr(errText(e, 'تعذّر تشغيل الفحص')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <label className="text-sm"><span className="text-slate-600">من</span><input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className={input} /></label>
        <label className="text-sm"><span className="text-slate-600">إلى</span><input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className={input} /></label>
        <label className="text-sm"><span className="text-slate-600">خلال عدد أيام</span><input type="number" dir="ltr" value={f.days_window} onChange={(e) => setF({ ...f, days_window: e.target.value })} className={input} /></label>
        <label className="text-sm"><span className="text-slate-600">فرق مسموح %</span><input type="number" dir="ltr" value={f.tolerance_pct} onChange={(e) => setF({ ...f, tolerance_pct: e.target.value })} className={input} /></label>
        <button onClick={run} disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" aria-hidden />} فحص</button>
      </div>
      <ErrorLine text={err} />
      {res && (
        <>
          <p className="text-sm">فواتير شراء: <I v={res.invoices_analyzed} /> — سندات صرف: <I v={res.vouchers_analyzed} /> — مبالغ تحت المراجعة: <N v={res.total_at_risk} /> ج.م</p>
          <FindingsTable rows={res.duplicates} kind="dups" />
          {(res.suspicious_groups || []).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
              <p className="font-bold mb-1">نفس المبلغ لعدة موردين في نفس اليوم (احتمال تقسيم دفعة)</p>
              {res.suspicious_groups.map((g) => <p key={`${g.date}-${g.amount}`}><D v={g.date} /> — <N v={g.amount} /> × <I v={g.count} />: {g.vendors.join('، ')}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AuditChainTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setRows(null);
    axios.get(`${API}/api/erp-core/audit/trail`, { ...auth(), params: { page, limit: 50 } })
      .then(({ data }) => { setRows(data.entries || []); setTotal(data.total || 0); })
      .catch((e) => { setRows([]); setErr(errText(e, 'تعذّر تحميل سجل التدقيق')); });
  }, [page]);
  const verify = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await axios.post(`${API}/api/erp-core/audit/verify-chain`, { limit: 20000 }, auth());
      setCheck(data);
    } catch (e) { setErr(errText(e, 'تعذّر التحقق')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={verify} disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" aria-hidden />} التحقق من سلامة السجل</button>
        <p className="text-xs text-slate-500">كل حدث مربوط بالحدث السابق ببصمة رقمية؛ أي تعديل أو حذف لاحق يظهر هنا.</p>
      </div>
      {check && (
        <div className={`rounded-lg p-3 text-sm border ${check.chain_intact ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-red-200 bg-red-50 dark:bg-red-900/20'}`}>
          <p className="font-bold">{check.chain_intact ? 'السجل سليم' : `يوجد ${check.tampered_entries.length} سجل به ملاحظة`} — تم فحص <I v={check.entries_checked} /> حدث</p>
          {(check.tampered_entries || []).slice(0, 20).map((t) => <p key={t.entry_id} className="text-xs"><D v={t.timestamp} /> — {t.action}: {t.problem}</p>)}
        </div>
      )}
      <ErrorLine text={err} />
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty text="لا توجد أحداث مسجلة بعد." /> : (
        <>
          <Table head={[['الوقت'], ['الحدث'], ['الوصف'], ['IP', 'text-start hidden md:table-cell']]}>
            {rows.map((e) => (
              <tr key={e.id}><td className="px-3 py-2 whitespace-nowrap"><bdi dir="ltr">{String(e.timestamp || '').slice(0, 16).replace('T', ' ')}</bdi></td>
                <td className="px-3 py-2"><bdi dir="ltr">{e.action}</bdi></td><td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2 hidden md:table-cell"><bdi dir="ltr">{e.ip_address}</bdi></td></tr>
            ))}
          </Table>
          <div className="flex items-center gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={btnGhost}>السابق</button>
            <span>صفحة <I v={page} /> من <I v={Math.max(1, Math.ceil(total / 50))} /></span>
            <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)} className={btnGhost}>التالي</button>
          </div>
        </>
      )}
    </div>
  );
}

export function FraudControlPage() {
  const [tab, setTab] = useState('alerts');
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-7 h-7 text-red-600 shrink-0" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">الرقابة وكشف المخاطر</h1>
          <p className="text-sm text-slate-500">فحوص آلية على الفواتير والدفعات والقيود والرواتب لشركتك فقط — للمراجعة، ولا تعدِّل أي بيانات مالية.</p>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['alerts', 'التنبيهات'], ['scan', 'الفحص الشامل'], ['journal', 'ضوابط القيود'], ['dups', 'المدفوعات المكررة'], ['audit', 'سلامة سجل التدقيق']]} />
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'scan' && <ScanTab />}
      {tab === 'journal' && <JournalTab />}
      {tab === 'dups' && <DuplicatesTab />}
      {tab === 'audit' && <AuditChainTab />}
    </div>
  );
}

/* ═════════════════════════ حماية البيانات الشخصية ═════════════════════════ */

const DP_DISCLAIMER = 'هذه أدوات مساعدة لتسجيل طلبات أصحاب البيانات ومتابعتها وإعداد ردودها، وليست شهادة امتثال لقانون حماية البيانات الشخصية رقم 151 لسنة 2020. الامتثال يحدده مستشار قانوني.';
const REQ_TYPES = { access: 'طلب اطلاع على البيانات', rectification: 'طلب تصحيح', erasure: 'طلب محو / حذف', objection: 'اعتراض على المعالجة', restriction: 'طلب تقييد المعالجة' };
const REQ_STATUS = { received: 'مستلم', in_review: 'قيد المراجعة', completed: 'تم', rejected: 'مرفوض' };
const SUBJECT_TYPES = { employee: 'موظف', customer: 'عميل', supplier: 'مورد', other: 'أخرى' };

function useEmployees() {
  const [emps, setEmps] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/employees`, auth()).then(({ data }) => setEmps(data.employees || [])).catch(() => setEmps([]));
  }, []);
  return emps;
}

function RequestsTab() {
  const emps = useEmployees();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(null);
  const [upd, setUpd] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/api/data-protection/requests`, auth());
      setRows(data.requests || []);
    } catch (e) { setRows([]); setErr(errText(e, 'تعذّر تحميل الطلبات')); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/api/data-protection/requests`, { ...form, response_days: +form.response_days || 30, employee_id: form.employee_id || undefined }, auth());
      setForm(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ الطلب')); } finally { setBusy(false); }
  };
  const saveUpd = async () => {
    setBusy(true); setErr('');
    try {
      await axios.patch(`${API}/api/data-protection/requests/${upd.id}`, { status: upd.status, decision_note: upd.decision_note }, auth());
      setUpd(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر تحديث الطلب')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setErr(''); setForm({ request_type: 'access', subject_name: '', subject_type: 'employee', employee_id: '', channel: '', received_date: today(), response_days: 30, details: '' }); }} className={btnPrimary}>
          <Plus className="w-4 h-4" aria-hidden /> تسجيل طلب وارد</button>
      </div>
      <ErrorLine text={!form && !upd && err} />
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty text="لا توجد طلبات مسجلة." /> : (
        <Table head={[['تاريخ الاستلام'], ['النوع'], ['صاحب البيانات'], ['موعد الرد'], ['الحالة'], ['', 'text-end']]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2"><D v={r.received_date} /></td>
              <td className="px-3 py-2">{REQ_TYPES[r.request_type] || r.request_type}</td>
              <td className="px-3 py-2">{r.subject_name}<div className="text-xs text-slate-500">{SUBJECT_TYPES[r.subject_type] || ''}</div></td>
              <td className="px-3 py-2"><D v={r.due_date} />{r.overdue && <span className="ms-2 text-xs font-bold text-red-700">متأخر</span>}</td>
              <td className="px-3 py-2">{REQ_STATUS[r.status] || r.status}{r.decision_note && <div className="text-xs text-slate-500">{r.decision_note}</div>}</td>
              <td className="px-3 py-2 text-end">
                {['received', 'in_review'].includes(r.status) && <button onClick={() => { setErr(''); setUpd({ id: r.id, type: r.request_type, status: 'in_review', decision_note: r.decision_note || '' }); }} className={btnGhost}>تحديث</button>}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {form && (
        <Modal title="تسجيل طلب من صاحب بيانات" onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={save} disabled={busy || !form.subject_name.trim()} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button>
          </>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className="text-slate-600">نوع الطلب</span>
              <select value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })} className={input}>
                {Object.entries(REQ_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label><span className="text-slate-600">صفة صاحب البيانات</span>
              <select value={form.subject_type} onChange={(e) => setForm({ ...form, subject_type: e.target.value, employee_id: '' })} className={input}>
                {Object.entries(SUBJECT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            {form.subject_type === 'employee' && emps.length > 0 && (
              <label className="sm:col-span-2"><span className="text-slate-600">الموظف</span>
                <select value={form.employee_id} onChange={(e) => { const em = emps.find((x) => x.id === e.target.value); setForm({ ...form, employee_id: e.target.value, subject_name: em?.name || form.subject_name }); }} className={input}>
                  <option value="">— اختر —</option>{emps.map((em) => <option key={em.id} value={em.id}>{em.name}</option>)}</select></label>
            )}
            <label className="sm:col-span-2"><span className="text-slate-600">الاسم</span>
              <input value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">تاريخ الاستلام</span>
              <input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">مدة الرد (أيام)</span>
              <input type="number" dir="ltr" value={form.response_days} onChange={(e) => setForm({ ...form, response_days: e.target.value })} className={input} />
              <span className="text-xs text-slate-500">حدِّد المدة المعتمدة مع المستشار القانوني</span></label>
            <label className="sm:col-span-2"><span className="text-slate-600">وسيلة الاستلام</span>
              <input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={input} placeholder="بريد إلكتروني / خطاب / حضور شخصي" /></label>
            <label className="sm:col-span-2"><span className="text-slate-600">تفاصيل الطلب</span>
              <textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className={input} /></label>
          </div>
          {form.request_type === 'erasure' && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs">
              لا يحذف النظام شيئاً تلقائياً. القيود المحاسبية والفواتير ومسيرات الرواتب وسجلات التأمينات والضرائب تبقى طوال مدة الاحتفاظ القانونية حتى لو طلب صاحب البيانات حذفها، ويُنفَّذ المحو يدوياً على البيانات غير المطلوبة قانوناً فقط بعد رأي المستشار القانوني.
            </p>
          )}
          <div className="mt-3"><ErrorLine text={err} /></div>
        </Modal>
      )}

      {upd && (
        <Modal title="تحديث حالة الطلب" onClose={() => setUpd(null)}
          footer={<>
            <button onClick={() => setUpd(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={saveUpd} disabled={busy || (['completed', 'rejected'].includes(upd.status) && !upd.decision_note.trim())} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button>
          </>}>
          <div className="space-y-3">
            <label className="block"><span className="text-slate-600">الحالة</span>
              <select value={upd.status} onChange={(e) => setUpd({ ...upd, status: e.target.value })} className={input}>
                {Object.entries(REQ_STATUS).filter(([k]) => k !== 'received').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="block"><span className="text-slate-600">ما الذي تم / سبب الرفض</span>
              <textarea rows={3} value={upd.decision_note} onChange={(e) => setUpd({ ...upd, decision_note: e.target.value })} className={input} /></label>
            {upd.type === 'erasure' && <p className="text-xs text-slate-500">إغلاق طلب المحو لرئيس مجلس الإدارة أو المدير العام / التنفيذي.</p>}
            <ErrorLine text={err} />
          </div>
        </Modal>
      )}
    </div>
  );
}

const RECTIFY_FIELDS = [['mobile', 'الموبايل'], ['phone', 'التليفون'], ['email', 'البريد الإلكتروني'], ['address', 'العنوان'], ['emergency_contact', 'جهة الطوارئ'], ['emergency_phone', 'تليفون الطوارئ']];

function SubjectTab() {
  const emps = useEmployees();
  const [empId, setEmpId] = useState('');
  const [rep, setRep] = useState(null);
  const [fix, setFix] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async (id) => {
    setEmpId(id); setRep(null); setErr(''); setMsg(''); setFix({});
    if (!id) return;
    try {
      const { data } = await axios.get(`${API}/api/data-protection/subject-data/${id}`, auth());
      setRep(data);
    } catch (e) { setErr(errText(e, 'تعذّر إعداد التقرير')); }
  };
  const rectify = async () => {
    setBusy(true); setErr(''); setMsg('');
    const body = Object.fromEntries(Object.entries(fix).filter(([, v]) => String(v || '').trim()));
    try {
      const { data } = await axios.post(`${API}/api/data-protection/subject-data/${empId}/rectify`, body, auth());
      setMsg(data.message); load(empId);
    } catch (e) { setErr(errText(e, 'تعذّر التصحيح')); } finally { setBusy(false); }
  };
  const pd = rep?.personal_data || {};
  const PD = [['name', 'الاسم'], ['national_id', 'الرقم القومي'], ['mobile', 'الموبايل'], ['email', 'البريد'], ['address', 'العنوان'], ['bank_iban', 'الحساب البنكي (IBAN)'], ['hire_date', 'تاريخ التعيين'], ['department', 'الإدارة'], ['job_title', 'الوظيفة']];

  return (
    <div className="space-y-4">
      <label className="block max-w-md text-sm"><span className="text-slate-600">الموظف</span>
        <select value={empId} onChange={(e) => load(e.target.value)} className={input}>
          <option value="">— اختر —</option>{emps.map((em) => <option key={em.id} value={em.id}>{em.name}</option>)}</select></label>
      {emps.length === 0 && <p className="text-xs text-slate-500">لا تظهر قائمة الموظفين إلا لمن لديه صلاحية الموارد البشرية.</p>}
      <ErrorLine text={err} />
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {rep && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-bold">{rep.title}</h3>
              <button onClick={() => window.print()} className={btnGhost}><Printer className="w-4 h-4" aria-hidden /> طباعة</button></div>
            <dl className="grid grid-cols-3 gap-y-1 text-sm">
              {PD.map(([k, l]) => <React.Fragment key={k}><dt className="text-slate-500">{l}</dt><dd className="col-span-2">{['national_id', 'bank_iban', 'mobile', 'email', 'hire_date'].includes(k) ? <bdi dir="ltr">{pd[k] || '—'}</bdi> : (pd[k] || '—')}</dd></React.Fragment>)}
            </dl>
            <p className="text-sm pt-2 border-t border-slate-200 dark:border-slate-700">سجلات مرتبطة: مسيرات رواتب <I v={rep.data_holdings?.payroll_records} /> — حضور <I v={rep.data_holdings?.attendance_records} /> — تقييمات <I v={rep.data_holdings?.appraisals} /></p>
            <p className="text-xs text-slate-500">{rep.note}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="font-bold">تصحيح بيانات الاتصال بناءً على طلب الموظف</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RECTIFY_FIELDS.map(([k, l]) => (
                <label key={k} className="text-sm"><span className="text-slate-600">{l}</span>
                  <input value={fix[k] || ''} onChange={(e) => setFix({ ...fix, [k]: e.target.value })} className={input} dir={['mobile', 'phone', 'email', 'emergency_phone'].includes(k) ? 'ltr' : undefined} /></label>
              ))}
            </div>
            <p className="text-xs text-slate-500">الاسم والرقم القومي والبيانات البنكية تُعدَّل من ملف الموظف بمستند مؤيد، لا من هنا.</p>
            <button onClick={rectify} disabled={busy || !Object.values(fix).some((v) => String(v || '').trim())} className={btnPrimary}>{busy ? '…' : 'حفظ التصحيح'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RetentionTab() {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [flag, setFlag] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/api/data-protection/retention/status`, auth());
      setRes(data);
    } catch (e) { setRes({ collections: [] }); setErr(errText(e, 'تعذّر التحميل')); }
  };
  useEffect(() => { load(); }, []);
  const preview = async (collection) => {
    setErr('');
    try {
      const { data } = await axios.post(`${API}/api/data-protection/retention/flag-for-archive`, { collection, dry_run: true }, auth());
      setFlag(data);
    } catch (e) { setErr(errText(e, 'تعذّر المعاينة')); }
  };
  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/api/data-protection/retention/flag-for-archive`, { collection: flag.collection, before_date: flag.before_date, dry_run: false }, auth());
      setFlag(null); load();
    } catch (e) { setErr(errText(e, 'تعذّر التعليم')); } finally { setBusy(false); }
  };
  const LABEL = { journal_entries: 'القيود اليومية', invoices: 'الفواتير', payroll_runs: 'مسيرات الرواتب', tax_forms: 'النماذج الضريبية', eta_signing_records: 'سجلات الفاتورة الإلكترونية', letters_of_credit: 'الاعتمادات المستندية', audit_trail: 'سجل التدقيق', employees: 'ملفات العاملين', contracts: 'العقود' };
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{res?.note || 'المدد افتراضية للمراجعة مع المستشار الضريبي والقانوني.'} النظام لا يحذف أي سجل — أقصى ما يفعله هو تعليم السجلات القديمة للأرشفة.</p>
      <ErrorLine text={!flag && err} />
      {res === null ? <Spinner /> : (
        <Table head={[['نوع السجل'], ['مدة الاحتفاظ (سنوات)', 'text-end'], ['الأساس'], ['الإجمالي', 'text-end'], ['تجاوز المدة', 'text-end'], ['', 'text-end']]}>
          {(res.collections || []).map((c) => (
            <tr key={c.collection}>
              <td className="px-3 py-2">{LABEL[c.collection] || c.collection}</td>
              <td className="px-3 py-2 text-end"><I v={c.retention_years} /></td>
              <td className="px-3 py-2 text-xs">{c.law_reference}</td>
              <td className="px-3 py-2 text-end"><I v={c.total_records} /></td>
              <td className="px-3 py-2 text-end"><I v={c.beyond_retention} /></td>
              <td className="px-3 py-2 text-end">{c.beyond_retention > 0 && <button onClick={() => preview(c.collection)} className={btnGhost}>تعليم للأرشفة</button>}</td>
            </tr>
          ))}
        </Table>
      )}
      {flag && (
        <Modal title="تعليم سجلات للأرشفة" onClose={() => setFlag(null)}
          footer={<>
            <button onClick={() => setFlag(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={confirm} disabled={busy || !flag.count} className={btnPrimary}>{busy ? '…' : 'تأكيد التعليم'}</button>
          </>}>
          <p>سيُعلَّم <I v={flag.count} /> سجل أقدم من <D v={flag.before_date} /> بعلامة «للأرشفة». لن يُحذف أي سجل ولن تتغير أي أرقام.</p>
          <p className="mt-2 text-xs text-slate-500">التأكيد لرئيس مجلس الإدارة أو المدير العام / التنفيذي، وبعد موافقة المستشار القانوني.</p>
          <div className="mt-2"><ErrorLine text={err} /></div>
        </Modal>
      )}
    </div>
  );
}

function StatusTab() {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    axios.get(`${API}/api/data-protection/compliance-report`, auth()).then(({ data }) => setRes(data))
      .catch((e) => { setRes({ checks: [] }); setErr(errText(e, 'تعذّر التحميل')); });
  }, []);
  if (res === null) return <Spinner />;
  return (
    <div className="space-y-3">
      <ErrorLine text={err} />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {(res.checks || []).map((c) => (
          <li key={c.check} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-2">
              {c.passed === true ? <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden /> : c.passed === false ? <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden /> : <FileLock2 className="w-4 h-4 text-slate-400" aria-hidden />}
              {c.check}</span>
            <span className="text-slate-600 dark:text-slate-300">{c.status}</span>
          </li>
        ))}
      </ul>
      {(res.recommendations || []).length > 0 && (
        <ul className="list-disc ps-5 text-sm text-slate-600 dark:text-slate-300">{res.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
      )}
    </div>
  );
}

export function DataProtectionPage() {
  const [tab, setTab] = useState('requests');
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-start gap-3">
        <FileLock2 className="w-7 h-7 text-blue-600 shrink-0" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">أدوات حماية البيانات الشخصية</h1>
          <p className="text-sm text-slate-500">تسجيل طلبات الاطلاع والتصحيح والمحو، وتقرير ما يحفظه النظام عن الموظف، ومدد الاحتفاظ.</p>
        </div>
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm" role="note">{DP_DISCLAIMER}</p>
      <Tabs value={tab} onChange={setTab} tabs={[['requests', 'سجل الطلبات'], ['subject', 'تقرير موظف'], ['retention', 'مدد الاحتفاظ'], ['status', 'حالة الأدوات']]} />
      {tab === 'requests' && <RequestsTab />}
      {tab === 'subject' && <SubjectTab />}
      {tab === 'retention' && <RetentionTab />}
      {tab === 'status' && <StatusTab />}
    </div>
  );
}

/* ═════════════════════════ القوائم المجمعة ═════════════════════════ */

const LINK = { pending: ['بانتظار موافقتها', 'text-amber-700'], accepted: ['وافقت', 'text-green-700'], declined: ['رفضت / انسحبت', 'text-red-700'] };
const ELIM_TYPES = { intercompany_sales: 'مبيعات بينية', intercompany_balances: 'أرصدة جارية بينية', nci: 'حقوق الأقلية' };

function members(group) {
  const subs = (group.subsidiaries || []).filter((s) => s.link_status === 'accepted' && s.consolidated);
  return [{ id: group.holding_company_id, name: 'الشركة القابضة (شركتك)', nci: 0 },
    ...subs.map((s) => ({ id: s.company_id, name: s.company_name || s.company_id, nci: s.nci_pct || 0 }))];
}

function NewGroupModal({ onClose, onSaved }) {
  const [f, setF] = useState({ group_name: '', fiscal_year: new Date().getFullYear(), notes: '', subs: [{ company_id: '', ownership_pct: 100, acquisition_date: '' }] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setSub = (i, k, v) => setF({ ...f, subs: f.subs.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await axios.post(`${API}/api/consolidation/groups`, {
        group_name: f.group_name, fiscal_year: +f.fiscal_year, notes: f.notes,
        subsidiaries: f.subs.filter((s) => s.company_id.trim()).map((s) => ({ company_id: s.company_id.trim(), ownership_pct: +s.ownership_pct, acquisition_date: s.acquisition_date || undefined })),
      }, auth());
      onSaved();
    } catch (e) { setErr(errText(e, 'تعذّر حفظ المجموعة')); } finally { setBusy(false); }
  };
  return (
    <Modal title="مجموعة شركات جديدة (شركتك هي القابضة)" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
        <button onClick={save} disabled={busy || !f.group_name.trim() || !f.subs.some((s) => s.company_id.trim())} className={btnPrimary}>{busy ? '…' : 'حفظ وإرسال الدعوات'}</button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label><span className="text-slate-600">اسم المجموعة</span><input value={f.group_name} onChange={(e) => setF({ ...f, group_name: e.target.value })} className={input} /></label>
        <label><span className="text-slate-600">السنة المالية</span><input type="number" dir="ltr" value={f.fiscal_year} onChange={(e) => setF({ ...f, fiscal_year: e.target.value })} className={input} /></label>
      </div>
      <h3 className="font-bold mt-4 mb-2">الشركات التابعة</h3>
      <p className="text-xs text-slate-500 mb-2">اطلب من المدير العام لكل شركة تابعة «معرِّف الشركة» الظاهر في هذه الشاشة عنده. لن تدخل أرقام أي شركة في التجميع إلا بعد أن يوافق مديرها الأعلى.</p>
      <div className="space-y-2">
        {f.subs.map((s, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_9rem_auto] gap-2 items-end">
            <label><span className="text-slate-600 text-xs">معرِّف الشركة</span><input dir="ltr" value={s.company_id} onChange={(e) => setSub(i, 'company_id', e.target.value)} className={input} /></label>
            <label><span className="text-slate-600 text-xs">نسبة الملكية %</span><input type="number" dir="ltr" value={s.ownership_pct} onChange={(e) => setSub(i, 'ownership_pct', e.target.value)} className={input} /></label>
            <label><span className="text-slate-600 text-xs">تاريخ الاستحواذ</span><input type="date" value={s.acquisition_date} onChange={(e) => setSub(i, 'acquisition_date', e.target.value)} className={input} /></label>
            <button onClick={() => setF({ ...f, subs: f.subs.filter((_, j) => j !== i) })} disabled={f.subs.length === 1} aria-label="حذف" className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => setF({ ...f, subs: [...f.subs, { company_id: '', ownership_pct: 100, acquisition_date: '' }] })} className={`${btnGhost} mt-2`}><Plus className="w-4 h-4" aria-hidden /> شركة أخرى</button>
      <p className="text-xs text-slate-500 mt-2">ملكية أكثر من 50% = تجميع كامل؛ 20–50% = حقوق ملكية (لا تُجمَّع هنا).</p>
      <div className="mt-3"><ErrorLine text={err} /></div>
    </Modal>
  );
}

function NewEliminationModal({ group, year, onClose, onSaved }) {
  const mem = members(group);
  const withNci = mem.filter((m) => m.nci > 0);
  const [type, setType] = useState('intercompany_balances');
  const [f, setF] = useState({ a: mem[0]?.id || '', b: mem[1]?.id || '', amount: '', sale: '', cost: '', inv_pct: 0, sub: withNci[0]?.id || '', net_assets: '', date: `${year}-12-31` });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');

  const calc = useMemo(() => {
    const sale = r2(f.sale); const cost = r2(f.cost);
    const unreal = r2((sale - cost) * (+f.inv_pct || 0) / 100);
    const nciRow = withNci.find((m) => m.id === f.sub);
    const nci = nciRow && f.net_assets !== '' ? r2(+f.net_assets * nciRow.nci / 100) : 0;
    return { sale, cost, unreal: unreal > 0 ? unreal : 0, nci, nciPct: nciRow?.nci || 0 };
  }, [f, withNci]);

  const rows = type === 'intercompany_sales' ? [
    ['411 إيراد مبيعات بضائع', calc.sale, 0], ['314 تكلفة البضاعة المباعة', 0, calc.sale],
    ['314 تكلفة البضاعة المباعة (أرباح غير محققة)', calc.unreal, 0], ['125 مخزون بضائع', 0, calc.unreal],
  ] : type === 'intercompany_balances' ? [
    ['2301 جاري الشركات التابعة — دائن', r2(f.amount), 0], ['1361 جاري الشركات التابعة — مدين', 0, r2(f.amount)],
  ] : [
    ['213 الأرباح المرحلة (إعادة تبويب)', calc.nci, 0], ['2141 حقوق الأقلية', 0, calc.nci],
  ];

  const save = async () => {
    setBusy(true); setErr(''); setWarn('');
    try {
      let data;
      if (type === 'intercompany_sales') {
        ({ data } = await axios.post(`${API}/api/consolidation/eliminations/intercompany-sales`, {
          group_id: group.id, seller_company_id: f.a, buyer_company_id: f.b, fiscal_year: +year,
          sale_amount: calc.sale, cost_amount: calc.cost, ending_inventory_pct: +f.inv_pct || 0, elimination_date: f.date }, auth()));
      } else if (type === 'intercompany_balances') {
        ({ data } = await axios.post(`${API}/api/consolidation/eliminations/intercompany-balances`, {
          group_id: group.id, company_a_id: f.a, company_b_id: f.b, fiscal_year: +year, date: f.date,
          amount: f.amount === '' ? undefined : r2(f.amount) }, auth()));
      } else {
        ({ data } = await axios.post(`${API}/api/consolidation/eliminations/nci`, {
          group_id: group.id, subsidiary_company_id: f.sub, fiscal_year: +year, date: f.date,
          net_assets: f.net_assets === '' ? undefined : r2(f.net_assets) }, auth()));
      }
      if (data?.warning) { setWarn(data.warning); setTimeout(onSaved, 2500); } else onSaved();
    } catch (e) { setErr(errText(e, 'تعذّر تسجيل الاستبعاد')); } finally { setBusy(false); }
  };

  const pick = (k, label) => (
    <label><span className="text-slate-600">{label}</span>
      <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input}>
        {mem.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
  );
  const valid = type === 'intercompany_sales' ? (calc.sale > 0 && calc.cost >= 0 && f.a !== f.b)
    : type === 'intercompany_balances' ? (f.a !== f.b && (f.amount === '' || +f.amount > 0)) : !!f.sub;

  return (
    <Modal title={`استبعاد جديد — سنة ${year}`} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
        <button onClick={save} disabled={busy || !valid} className={btnPrimary}>{busy ? '…' : 'تسجيل في ورقة العمل'}</button>
      </>}>
      <div className="space-y-3">
        <Tabs value={type} onChange={(t) => { setType(t); setErr(''); }} tabs={Object.entries(ELIM_TYPES).filter(([k]) => k !== 'nci' || withNci.length > 0)} />
        {mem.length < 2 && <p className="text-amber-700">لا توجد شركة تابعة وافقت على الانضمام بعد.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {type === 'intercompany_sales' && <>
            {pick('a', 'الشركة البائعة')}{pick('b', 'الشركة المشترية')}
            <label><span className="text-slate-600">قيمة المبيعات البينية</span><input type="number" dir="ltr" value={f.sale} onChange={(e) => setF({ ...f, sale: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">تكلفتها عند البائع</span><input type="number" dir="ltr" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} className={input} /></label>
            <label><span className="text-slate-600">% من البضاعة ما زال في مخزن المشتري</span><input type="number" dir="ltr" value={f.inv_pct} onChange={(e) => setF({ ...f, inv_pct: e.target.value })} className={input} /></label>
          </>}
          {type === 'intercompany_balances' && <>
            {pick('a', 'الشركة الدائنة (لها رصيد 1361)')}{pick('b', 'الشركة المدينة (عليها رصيد 2301)')}
            <label className="sm:col-span-2"><span className="text-slate-600">المبلغ</span>
              <input type="number" dir="ltr" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={input} placeholder="اتركه فارغاً لاستبعاد الرصيد المتطابق المسجل" />
              <span className="text-xs text-slate-500">لا يُقبل مبلغ أكبر من الأقل بين الرصيدين المسجلين فعلاً في الدفترين.</span></label>
          </>}
          {type === 'nci' && <>
            <label><span className="text-slate-600">الشركة التابعة</span>
              <select value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} className={input}>
                {withNci.map((m) => <option key={m.id} value={m.id}>{m.name} — أقلية {m.nci}%</option>)}</select></label>
            <label><span className="text-slate-600">صافي الأصول</span>
              <input type="number" dir="ltr" value={f.net_assets} onChange={(e) => setF({ ...f, net_assets: e.target.value })} className={input} placeholder="فارغ = يُحسب من دفاتر الشركة" /></label>
          </>}
          <label><span className="text-slate-600">التاريخ</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
        </div>
        {(type !== 'intercompany_balances' || f.amount !== '') && (type !== 'nci' || f.net_assets !== '')
          ? <Lines rows={rows} title="قيد الاستبعاد (ورقة عمل التجميع — لا يُرحَّل لدفاتر أي شركة):" />
          : <p className="text-xs text-slate-500">سيُحسب المبلغ من دفاتر الشركات ويظهر في ورقة العمل بعد التسجيل.</p>}
        {warn && <p className="text-sm text-amber-700">{warn}</p>}
        <ErrorLine text={err} />
      </div>
    </Modal>
  );
}

function GroupDetail({ group, onBack }) {
  const [year, setYear] = useState(group.fiscal_year || new Date().getFullYear());
  const [tab, setTab] = useState('worksheet');
  const [ws, setWs] = useState(null);
  const [elims, setElims] = useState(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr(''); setWs(null); setElims(null);
    try {
      const [w, e] = await Promise.all([
        axios.get(`${API}/api/consolidation/worksheet/${group.id}`, { ...auth(), params: { year } }),
        axios.get(`${API}/api/consolidation/eliminations/${group.id}`, { ...auth(), params: { fiscal_year: year } }),
      ]);
      setWs(w.data); setElims(e.data.eliminations || []);
    } catch (e) { setWs({ worksheet: [], totals: {} }); setElims([]); setErr(errText(e, 'تعذّر تحميل ورقة العمل')); }
  };
  useEffect(() => { load(); }, [year, group.id]);

  const remove = async (id) => {
    if (!window.confirm('حذف هذا الاستبعاد من ورقة العمل؟ (لا يمس دفاتر أي شركة)')) return;
    try { await axios.delete(`${API}/api/consolidation/eliminations/${id}`, auth()); load(); } catch (e) { setErr(errText(e, 'تعذّر الحذف')); }
  };

  const t = ws?.totals || {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-sm text-blue-700 hover:underline">← كل المجموعات</button>
          <h2 className="text-lg font-extrabold">{group.group_name}</h2>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm"><span className="text-slate-600">السنة</span>
            <input type="number" dir="ltr" value={year} onChange={(e) => setYear(+e.target.value)} className={`${input} w-28`} /></label>
          <button onClick={() => setAdding(true)} className={btnPrimary}><Plus className="w-4 h-4" aria-hidden /> استبعاد</button>
        </div>
      </div>
      {(ws?.pending_subsidiaries || []).length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">شركات لم توافق بعد ولا تدخل في التجميع: {ws.pending_subsidiaries.join('، ')}</p>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[['worksheet', 'ورقة عمل التجميع'], ['elims', `الاستبعادات (${(elims || []).length})`]]} />
      <ErrorLine text={err} />
      {tab === 'worksheet' && (ws === null ? <Spinner /> : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`inline-flex items-center gap-1 ${t.balanced ? 'text-green-700' : 'text-red-700'}`}>{t.balanced ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <AlertTriangle className="w-4 h-4" aria-hidden />} المجمَّع: مدين <N v={t.consolidated_debit} /> / دائن <N v={t.consolidated_credit} /></span>
            <span className={t.eliminations_balanced ? 'text-slate-600' : 'text-red-700'}>الاستبعادات: مدين <N v={t.eliminations_debit} /> / دائن <N v={t.eliminations_credit} /></span>
          </div>
          {(ws.worksheet || []).length === 0 ? <Empty text="لا توجد قيود مرحَّلة لهذه السنة." /> : (
            <Table head={[['الحساب'], ['مجموع الشركات مدين', 'text-end'], ['مجموع الشركات دائن', 'text-end'], ['استبعاد مدين', 'text-end'], ['استبعاد دائن', 'text-end'], ['المجمَّع مدين', 'text-end'], ['المجمَّع دائن', 'text-end']]}>
              {ws.worksheet.map((r) => (
                <tr key={r.account_code} className={r.eliminations.debit || r.eliminations.credit ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap"><bdi dir="ltr">{r.account_code}</bdi> {r.account_name}</td>
                  <td className="px-3 py-2 text-end"><N v={r.combined.debit} /></td><td className="px-3 py-2 text-end"><N v={r.combined.credit} /></td>
                  <td className="px-3 py-2 text-end">{r.eliminations.debit ? <N v={r.eliminations.debit} /> : ''}</td>
                  <td className="px-3 py-2 text-end">{r.eliminations.credit ? <N v={r.eliminations.credit} /> : ''}</td>
                  <td className="px-3 py-2 text-end font-semibold">{r.consolidated.debit ? <N v={r.consolidated.debit} /> : ''}</td>
                  <td className="px-3 py-2 text-end font-semibold">{r.consolidated.credit ? <N v={r.consolidated.credit} /> : ''}</td>
                </tr>
              ))}
            </Table>
          )}
        </>
      ))}
      {tab === 'elims' && (elims === null ? <Spinner /> : elims.length === 0 ? <Empty text="لا توجد استبعادات لهذه السنة." /> : (
        <Table head={[['التاريخ'], ['النوع'], ['البيان'], ['المبلغ', 'text-end'], ['', 'text-end']]}>
          {elims.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2"><D v={e.date} /></td>
              <td className="px-3 py-2">{ELIM_TYPES[e.elimination_type] || e.elimination_type}</td>
              <td className="px-3 py-2">{e.description || ''}
                {e.reconciliation && Math.abs(e.reconciliation.difference) > 0.01 && <div className="text-xs text-amber-700">فرق بين الدفترين: <N v={e.reconciliation.difference} /></div>}
                {e.amounts?.unrealized_profit > 0 && <div className="text-xs text-slate-500">أرباح غير محققة: <N v={e.amounts.unrealized_profit} /></div>}</td>
              <td className="px-3 py-2 text-end"><N v={e.amount ?? e.amounts?.sale_amount} /></td>
              <td className="px-3 py-2 text-end"><button onClick={() => remove(e.id)} aria-label="حذف" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button></td>
            </tr>
          ))}
        </Table>
      ))}
      {adding && <NewEliminationModal group={group} year={year} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

export function ConsolidationPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const { data: d } = await axios.get(`${API}/api/consolidation/groups`, auth());
      setData(d);
    } catch (e) { setData({ groups: [], invitations: [] }); setErr(errText(e, 'تعذّر تحميل المجموعات')); }
  };
  useEffect(() => { load(); }, []);

  const respond = async (gid, accept) => {
    if (!accept && !window.confirm('رفض/سحب الانضمام يعني أن أرقام شركتك لن تظهر للشركة القابضة. متابعة؟')) return;
    setErr('');
    try { await axios.post(`${API}/api/consolidation/groups/${gid}/respond`, { accept }, auth()); load(); }
    catch (e) { setErr(errText(e, 'تعذّر تسجيل الرد')); }
  };
  const copyId = () => {
    try { navigator.clipboard.writeText(data.my_company_id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { setCopied(false); }
  };

  const open = (data?.groups || []).find((g) => g.id === openId);
  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Building2 className="w-7 h-7 text-indigo-600 shrink-0" aria-hidden />
          <div>
            <h1 className="text-xl font-extrabold">القوائم المالية المجمعة</h1>
            <p className="text-sm text-slate-500">تجميع الشركة القابضة وتابعاتها (المعيار المصري 42). قيود الاستبعاد أوراق عمل للتجميع فقط ولا تُرحَّل لدفاتر أي شركة.</p>
          </div>
        </div>
        {!open && <button onClick={() => setCreating(true)} className={btnPrimary}><Plus className="w-4 h-4" aria-hidden /> مجموعة جديدة</button>}
      </div>
      <ErrorLine text={err} />
      {data === null ? <Spinner /> : open ? <GroupDetail group={open} onBack={() => { setOpenId(null); load(); }} /> : (
        <>
          {data.my_company_id && (
            <div className="flex flex-wrap items-center gap-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <Link2 className="w-4 h-4 text-slate-500" aria-hidden />
              <span>معرِّف شركتك (تعطيه للشركة القابضة لتضيفك):</span>
              <bdi dir="ltr" className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{data.my_company_id}</bdi>
              <button onClick={copyId} className={btnGhost}><Copy className="w-4 h-4" aria-hidden /> {copied ? 'تم النسخ' : 'نسخ'}</button>
            </div>
          )}
          {(data.invitations || []).length > 0 && (
            <section className="space-y-2">
              <h2 className="font-bold">دعوات الانضمام لمجموعات</h2>
              <Table head={[['المجموعة'], ['الشركة القابضة'], ['نسبة ملكيتها فيكم', 'text-end'], ['الحالة'], ['', 'text-end']]}>
                {data.invitations.map((inv) => (
                  <tr key={inv.group_id}>
                    <td className="px-3 py-2">{inv.group_name}</td><td className="px-3 py-2">{inv.holding_name}</td>
                    <td className="px-3 py-2 text-end"><bdi dir="ltr">{inv.ownership_pct}%</bdi></td>
                    <td className={`px-3 py-2 ${(LINK[inv.link_status] || [])[1] || ''}`}>{(LINK[inv.link_status] || [inv.link_status])[0]}</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap space-x-2 space-x-reverse">
                      {inv.link_status !== 'accepted' && <button onClick={() => respond(inv.group_id, true)} className={btnGhost}>موافقة</button>}
                      {inv.link_status !== 'declined' && <button onClick={() => respond(inv.group_id, false)} className={btnGhost}>{inv.link_status === 'accepted' ? 'انسحاب' : 'رفض'}</button>}
                    </td>
                  </tr>
                ))}
              </Table>
              <p className="text-xs text-slate-500">الموافقة تسمح للشركة القابضة بقراءة أرصدة شركتك لأغراض التجميع فقط. القرار للمدير العام أو رئيس مجلس الإدارة.</p>
            </section>
          )}
          <section className="space-y-2">
            <h2 className="font-bold">مجموعاتك (شركتك قابضة)</h2>
            {(data.groups || []).length === 0 ? <Empty text="لا توجد مجموعات بعد." /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.groups.map((g) => (
                  <button key={g.id} onClick={() => setOpenId(g.id)} className="text-start rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-400">
                    <p className="font-bold">{g.group_name} <span className="text-xs text-slate-500">— سنة <bdi dir="ltr">{g.fiscal_year}</bdi></span></p>
                    <ul className="mt-2 text-sm space-y-0.5">
                      {(g.subsidiaries || []).map((s) => (
                        <li key={s.company_id} className="flex justify-between gap-2">
                          <span>{s.company_name || s.company_id} <bdi dir="ltr" className="text-xs text-slate-500">{s.ownership_pct}%</bdi></span>
                          <span className={`text-xs ${(LINK[s.link_status] || [])[1] || ''}`}>{(LINK[s.link_status] || [s.link_status])[0]}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {creating && <NewGroupModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}
