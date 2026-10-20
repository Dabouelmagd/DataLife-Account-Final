/**
 * الإدارة المالية ← القطاع الطبي
 *   الخدمات         — تسجيل خدمة (دفعة المريض + حصة التأمين) وتقسيمها بين المنشأة والأطباء
 *   أتعاب الأطباء   — المستحق لكل طبيب وسداده مع خصم ضريبة المهن الحرة
 *   مطالبات التأمين — ما زال مستحقاً على كل شركة تأمين، وتحصيله أو تسجيل المرفوض
 *   سجل السداد      — كل ما سُدد للأطباء
 * Backend: /api/enterprise/medical-services, /doctor-payment, /doctor-payments.
 * Every amount is previewed as the entry the server will post; the server
 * recomputes it and refuses anything that does not reconcile.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Trash2 } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const BASE = `${API}/api/enterprise`;
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};
const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btn = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50';
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;
// a stable id from a name, so the same doctor or insurer groups together across services
const idFor = (prefix, name) => `${prefix}:${String(name || '').trim().replace(/\s+/g, ' ')}`;

const SERVICE_TYPES = {
  outpatient: 'كشف / عيادات خارجية (415)', inpatient: 'إقامة داخلية (415)', surgery: 'عمليات وجراحة (417)',
  lab: 'معمل وتحاليل (418)', radiology: 'أشعة وتصوير (419)', pharmacy: 'صيدلية (420)', other: 'خدمات أخرى (415)',
};
const REVENUE_CODE = { outpatient: '415', inpatient: '415', surgery: '417', lab: '418', radiology: '419', pharmacy: '420', other: '415' };
const WHT = [[5, '5% مهن حرة'], [3, '3% خدمات'], [1, '1% مقاولات'], [0, 'بدون خصم']];
const STATUS = { pending: 'مسجلة', billed: 'أُرسلت للتأمين', paid: 'مسددة', cancelled: 'ملغاة' };

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
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

function Lines({ rows }) {
  const shown = rows.filter((r) => r[1] || r[2]);
  const dr = r2(shown.reduce((s, r) => s + (r[1] || 0), 0));
  const cr = r2(shown.reduce((s, r) => s + (r[2] || 0), 0));
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs">
      <p className="font-bold mb-2">القيد الذي سيُرحَّل:</p>
      <table className="w-full">
        <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
        <tbody>
          {shown.map((r, i) => (
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

function Msg({ m }) {
  if (!m) return null;
  return <p role={m.err ? 'alert' : 'status'} className={`text-sm ${m.err ? 'text-red-700' : 'text-emerald-700'}`}>{m.text}</p>;
}

function Card({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900 dark:text-white', blue: 'text-blue-700', amber: 'text-amber-700', emerald: 'text-emerald-700' };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tones[tone]}`}><N v={value} /></p>
    </div>
  );
}

// ── new service ─────────────────────────────────────────────
function NewServiceModal({ known, onClose, onSaved }) {
  const [f, setF] = useState({
    service_date: today(), service_type: 'outpatient', service_description: '', patient_name: '',
    patient_copay: '', payment_method: 'cash', insurance_company_name: '', insurance_claim_amount: '',
  });
  const [docs, setDocs] = useState([{ name: '', share: '', wht: 5 }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const copay = r2(f.patient_copay), ins = r2(f.insurance_claim_amount);
  const total = r2(copay + ins);
  const docRows = docs.filter((d) => d.name.trim() && r2(d.share) > 0);
  const docTotal = r2(docRows.reduce((s, d) => s + r2(d.share), 0));
  const hosp = r2(total - docTotal);

  const save = async () => {
    setMsg(null);
    if (!f.patient_name.trim()) return setMsg({ err: true, text: 'اكتب اسم المريض' });
    if (total <= 0) return setMsg({ err: true, text: 'أدخل دفعة المريض و/أو حصة التأمين' });
    if (ins > 0 && !f.insurance_company_name.trim()) return setMsg({ err: true, text: 'اكتب اسم شركة التأمين' });
    if (hosp < 0) return setMsg({ err: true, text: 'حصص الأطباء أكبر من قيمة الخدمة' });
    setBusy(true);
    try {
      const doctors = docRows.map((d) => {
        const k = known.doctors.find((x) => x.doctor_name === d.name.trim());
        return { doctor_id: k?.doctor_id || idFor('dr', d.name), doctor_name: d.name.trim(), share: r2(d.share), wht_rate: Number(d.wht) };
      });
      const insurer = f.insurance_company_name.trim();
      const kIns = known.insurers.find((x) => x.name === insurer);
      const { data } = await axios.post(`${BASE}/medical-services`, {
        ...f, patient_name: f.patient_name.trim(), patient_id: idFor('pt', f.patient_name),
        patient_copay: copay, insurance_claim_amount: ins, total_amount: total,
        insurance_company_name: ins > 0 ? insurer : '', insurance_company_id: ins > 0 ? (kIns?.id || idFor('ins', insurer)) : null,
        doctors,
      }, auth());
      onSaved(data.message);
    } catch (e) {
      setMsg({ err: true, text: errText(e, 'تعذّر الحفظ') });
    } finally { setBusy(false); }
  };

  const cashAcc = f.payment_method === 'bank' ? 'البنك 162' : 'الخزينة 161';
  return (
    <Modal title="تسجيل خدمة طبية" onClose={onClose}
      footer={<><button onClick={onClose} className={`${btn} border border-slate-300`}>إلغاء</button>
        <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 text-white`}>{busy ? '…' : 'حفظ وترحيل القيد'}</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label><span className="text-slate-600">التاريخ</span><input type="date" className={input} value={f.service_date} onChange={set('service_date')} /></label>
        <label><span className="text-slate-600">نوع الخدمة</span>
          <select className={input} value={f.service_type} onChange={set('service_type')}>
            {Object.entries(SERVICE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label><span className="text-slate-600">اسم المريض *</span><input className={input} value={f.patient_name} onChange={set('patient_name')} /></label>
        <label><span className="text-slate-600">وصف الخدمة</span><input className={input} value={f.service_description} onChange={set('service_description')} placeholder="كشف باطنة، صورة دم…" /></label>
      </div>

      <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <legend className="px-1 font-bold">من دفع</legend>
        <label><span className="text-slate-600">دفعة المريض</span><input type="number" min="0" dir="ltr" className={input} value={f.patient_copay} onChange={set('patient_copay')} /></label>
        <label><span className="text-slate-600">استلمها في</span>
          <select className={input} value={f.payment_method} onChange={set('payment_method')}>
            <option value="cash">الخزينة</option><option value="bank">البنك / فيزا</option>
          </select></label>
        <label><span className="text-slate-600">شركة التأمين</span>
          <input className={input} list="med-insurers" value={f.insurance_company_name} onChange={set('insurance_company_name')} />
          <datalist id="med-insurers">{known.insurers.map((x) => <option key={x.id} value={x.name} />)}</datalist></label>
        <label><span className="text-slate-600">حصة التأمين (تُطالَب بها الشركة)</span><input type="number" min="0" dir="ltr" className={input} value={f.insurance_claim_amount} onChange={set('insurance_claim_amount')} /></label>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <legend className="px-1 font-bold">حصص الأطباء</legend>
        <p className="text-xs text-slate-500">حصة الطبيب أمانة عليكم له وليست إيراداً للمنشأة. ضريبة الخصم تُستقطع عند سداد الأتعاب.</p>
        <datalist id="med-doctors">{known.doctors.map((x) => <option key={x.doctor_id} value={x.doctor_name} />)}</datalist>
        {docs.map((d, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <label className="col-span-5"><span className="text-slate-600 text-xs">الطبيب</span>
              <input className={input} list="med-doctors" value={d.name} onChange={(e) => setDocs(docs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></label>
            <label className="col-span-3"><span className="text-slate-600 text-xs">الحصة</span>
              <input type="number" min="0" dir="ltr" className={input} value={d.share} onChange={(e) => setDocs(docs.map((x, j) => j === i ? { ...x, share: e.target.value } : x))} /></label>
            <label className="col-span-3"><span className="text-slate-600 text-xs">الخصم</span>
              <select className={input} value={d.wht} onChange={(e) => setDocs(docs.map((x, j) => j === i ? { ...x, wht: e.target.value } : x))}>
                {WHT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <button type="button" aria-label="حذف الطبيب" onClick={() => setDocs(docs.filter((_, j) => j !== i))}
              className="col-span-1 p-2 rounded hover:bg-red-50 text-red-600 justify-self-center"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setDocs([...docs, { name: '', share: '', wht: 5 }])} className="text-blue-700 text-sm font-semibold">+ طبيب آخر</button>
      </fieldset>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">قيمة الخدمة<br /><b className="text-base"><N v={total} /></b></div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">حصة الأطباء<br /><b className="text-base"><N v={docTotal} /></b></div>
        <div className={`rounded-lg p-2 ${hosp < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>إيراد المنشأة<br /><b className="text-base"><N v={hosp} /></b></div>
      </div>

      <Lines rows={[
        [cashAcc, copay, 0], ['شركات التأمين الطبي 148', ins, 0],
        [`إيرادات ${SERVICE_TYPES[f.service_type].replace(/ \(\d+\)/, '')} ${REVENUE_CODE[f.service_type]}`, 0, Math.max(hosp, 0)],
        ...docRows.map((d) => [`أمانات أطباء 264 — د. ${d.name.trim()}`, 0, r2(d.share)]),
      ]} />
      <Msg m={msg} />
    </Modal>
  );
}

// ── insurer settlement ─────────────────────────────────────
function SettleModal({ claim, insurer, onClose, onSaved }) {
  const [f, setF] = useState({ received_amount: String(claim.outstanding), rejected_amount: '', rejection_treatment: 'patient',
    rejection_reason: '', payment_method: 'bank', date: today() });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rec = r2(f.received_amount), rej = r2(f.rejected_amount);

  const save = async () => {
    setMsg(null);
    if (rec + rej <= 0) return setMsg({ err: true, text: 'أدخل المحصل و/أو المرفوض' });
    if (rec + rej > claim.outstanding + 0.01) return setMsg({ err: true, text: `المجموع أكبر من المتبقي (${money(claim.outstanding)})` });
    if (rej > 0 && !f.rejection_reason.trim()) return setMsg({ err: true, text: 'اكتب سبب الرفض' });
    setBusy(true);
    try {
      const { data } = await axios.post(`${BASE}/medical-services/${claim.service_id}/insurance-settlement`,
        { ...f, received_amount: rec, rejected_amount: rej }, auth());
      onSaved(data.message);
    } catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر الحفظ') }); } finally { setBusy(false); }
  };

  return (
    <Modal title={`تسوية مطالبة ${insurer} — ${claim.patient_name || ''}`} onClose={onClose}
      footer={<><button onClick={onClose} className={`${btn} border border-slate-300`}>إلغاء</button>
        <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 text-white`}>{busy ? '…' : 'حفظ وترحيل القيد'}</button></>}>
      <p className="text-slate-600">المتبقي على شركة التأمين: <b><N v={claim.outstanding} /></b> من <N v={claim.claimed} /></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label><span className="text-slate-600">التاريخ</span><input type="date" className={input} value={f.date} onChange={set('date')} /></label>
        <label><span className="text-slate-600">استلمناه في</span>
          <select className={input} value={f.payment_method} onChange={set('payment_method')}><option value="bank">البنك</option><option value="cash">الخزينة</option></select></label>
        <label><span className="text-slate-600">المبلغ المحصل</span><input type="number" min="0" dir="ltr" className={input} value={f.received_amount} onChange={set('received_amount')} /></label>
        <label><span className="text-slate-600">المبلغ المرفوض</span><input type="number" min="0" dir="ltr" className={input} value={f.rejected_amount} onChange={set('rejected_amount')} /></label>
      </div>
      {rej > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
          <label className="block"><span className="text-slate-700">سبب الرفض *</span><input className={input} value={f.rejection_reason} onChange={set('rejection_reason')} placeholder="خارج التغطية، تأخر التقديم، نقص مستندات…" /></label>
          {[['patient', 'يُطالَب به المريض (العملاء 131)'], ['write_off', 'يُعدم — مردودات ومسموحات 413']].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2"><input type="radio" name="rej" checked={f.rejection_treatment === v} onChange={() => setF({ ...f, rejection_treatment: v })} /> {l}</label>
          ))}
          <p className="text-xs text-slate-600">حصص الأطباء لا تتغير تلقائياً بالرفض — إن اتفقتم على تخفيضها سجّل ذلك بقيد يدوي.</p>
        </div>
      )}
      <Lines rows={[
        [f.payment_method === 'cash' ? 'الخزينة 161' : 'البنك 162', rec, 0],
        [f.rejection_treatment === 'patient' ? `العملاء 131 — ${claim.patient_name || 'المريض'}` : 'مردودات ومسموحات المبيعات 413', rej, 0],
        [`شركات التأمين الطبي 148 — ${insurer}`, 0, r2(rec + rej)],
      ]} />
      <Msg m={msg} />
    </Modal>
  );
}

// ── doctor payment ─────────────────────────────────────────
function PayDoctorModal({ doctor, svc, onClose, onSaved }) {
  const [f, setF] = useState({ gross_amount: String(svc.gross), payment_method: 'bank', payment_date: today() });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const rate = svc.gross ? svc.wht / svc.gross : 0.05;
  const gross = r2(f.gross_amount), wht = r2(gross * rate), net = r2(gross - wht);

  const save = async () => {
    setMsg(null);
    if (gross <= 0 || gross > svc.gross + 0.01) return setMsg({ err: true, text: `المبلغ بين 0 و${money(svc.gross)}` });
    setBusy(true);
    try {
      const { data } = await axios.post(`${BASE}/doctor-payment`, { service_id: svc.service_id, doctor_id: doctor.doctor_id, ...f, gross_amount: gross }, auth());
      onSaved(data.message);
    } catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر السداد') }); } finally { setBusy(false); }
  };

  return (
    <Modal title={`سداد أتعاب د. ${doctor.doctor_name}`} onClose={onClose}
      footer={<><button onClick={onClose} className={`${btn} border border-slate-300`}>إلغاء</button>
        <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 text-white`}>{busy ? '…' : 'سداد وترحيل القيد'}</button></>}>
      <p className="text-slate-600">خدمة {svc.service_date} — المتبقي للطبيب قبل الضريبة: <b><N v={svc.gross} /></b></p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label><span className="text-slate-600">المبلغ قبل الضريبة</span><input type="number" min="0" dir="ltr" className={input} value={f.gross_amount} onChange={(e) => setF({ ...f, gross_amount: e.target.value })} /></label>
        <label><span className="text-slate-600">من</span>
          <select className={input} value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}><option value="bank">البنك</option><option value="cash">الخزينة</option></select></label>
        <label><span className="text-slate-600">التاريخ</span><input type="date" className={input} value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })} /></label>
      </div>
      <Lines rows={[
        [`أمانات أطباء 264 — د. ${doctor.doctor_name}`, gross, 0],
        [`ضريبة الخصم والتحصيل 261 (${r2(rate * 100)}%)`, 0, wht],
        [f.payment_method === 'cash' ? 'الخزينة 161' : 'البنك 162', 0, net],
      ]} />
      <Msg m={msg} />
    </Modal>
  );
}

// ── page ───────────────────────────────────────────────────
export default function MedicalPage() {
  const [tab, setTab] = useState('services');
  const [services, setServices] = useState([]);
  const [pending, setPending] = useState({ pending_doctors: [], total_amount: 0 });
  const [ins, setIns] = useState({ insurers: [], total_outstanding: 0, total_rejected: 0 });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [month, setMonth] = useState(today().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, i, d] = await Promise.all([
        axios.get(`${BASE}/medical-services`, { ...auth(), params: { date_from: `${month}-01`, date_to: `${month}-31`, limit: 500 } }),
        axios.get(`${BASE}/medical-services/pending-doctors`, auth()),
        axios.get(`${BASE}/medical-services/insurance-outstanding`, auth()),
        axios.get(`${BASE}/doctor-payments`, { ...auth(), params: { limit: 100 } }),
      ]);
      setServices(s.data.services || []); setPending(p.data); setIns(i.data); setPayments(d.data.payments || []);
    } catch (e) {
      setMsg({ err: true, text: errText(e, 'تعذّر تحميل بيانات القطاع الطبي') });
    } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  // names already used, so the same doctor / insurer is picked again rather than retyped
  const known = useMemo(() => {
    const doctors = {}, insurers = {};
    services.forEach((s) => {
      (s.doctors || []).forEach((d) => { if (d.doctor_name) doctors[d.doctor_name] = d; });
      if (s.insurance_company_name) insurers[s.insurance_company_name] = { id: s.insurance_company_id, name: s.insurance_company_name };
    });
    pending.pending_doctors.forEach((d) => { if (d.doctor_name) doctors[d.doctor_name] = d; });
    ins.insurers.forEach((x) => { if (x.insurance_company_name !== '—') insurers[x.insurance_company_name] = { id: x.insurance_company_id, name: x.insurance_company_name }; });
    return { doctors: Object.values(doctors), insurers: Object.values(insurers) };
  }, [services, pending, ins]);

  const live = services.filter((s) => s.status !== 'cancelled');
  const sum = (k) => r2(live.reduce((t, s) => t + (Number(s[k]) || 0), 0));

  const done = (text) => { setModal(null); setMsg({ text }); load(); };
  const cancel = async (s) => {
    if (!window.confirm(`إلغاء خدمة ${s.patient_name} بتاريخ ${s.service_date}؟ سيُعكس قيدها.`)) return;
    try {
      await axios.put(`${BASE}/medical-services/${s.id}/status`, { status: 'cancelled' }, auth());
      done('تم إلغاء الخدمة وعكس قيدها');
    } catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر الإلغاء') }); }
  };

  const TABS = [['services', 'الخدمات'], ['doctors', `أتعاب الأطباء (${pending.pending_doctors.length})`],
    ['insurance', 'مطالبات التأمين'], ['payments', 'سجل سداد الأتعاب']];

  return (
    <div className="space-y-5 text-sm" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">القطاع الطبي</h2>
          <p className="text-slate-500">تقسيم إيراد الخدمة بين المنشأة والأطباء، مطالبات التأمين، وسداد الأتعاب.</p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className={`${btn} bg-blue-600 text-white`}><Plus className="w-4 h-4" aria-hidden /> خدمة جديدة</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label={`قيمة الخدمات — ${month}`} value={sum('total_amount')} />
        <Card label="إيراد المنشأة" value={sum('hospital_share')} tone="emerald" />
        <Card label="أتعاب أطباء لم تُسدد (صافي)" value={pending.total_amount} tone="amber" />
        <Card label="مستحق على شركات التأمين" value={ins.total_outstanding} tone="blue" />
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2 -mb-px border-b-2 font-semibold ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
        ))}
      </div>

      <Msg m={msg} />
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <>
          {tab === 'services' && (
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2"><span className="text-slate-600">الشهر</span>
                <input type="month" className="px-3 py-1.5 border border-slate-300 rounded-lg" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
              {services.length === 0 ? <p className="text-slate-500 py-8 text-center">لا توجد خدمات في هذا الشهر. سجّل أول خدمة من «خدمة جديدة».</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600"><tr>
                      {['التاريخ', 'المريض', 'الخدمة', 'المريض دفع', 'التأمين', 'الأطباء', 'المنشأة', 'الحالة', ''].map((h) => <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.id} className={`border-t border-slate-100 dark:border-slate-800 ${s.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}>
                          <td className="px-3 py-2 whitespace-nowrap">{s.service_date}</td>
                          <td className="px-3 py-2">{s.patient_name}</td>
                          <td className="px-3 py-2">{s.service_description || SERVICE_TYPES[s.service_type]?.replace(/ \(\d+\)/, '')}</td>
                          <td className="px-3 py-2"><N v={s.patient_copay} /></td>
                          <td className="px-3 py-2">{s.insurance_claim_amount > 0 ? <><N v={s.insurance_claim_amount} /><span className="block text-xs text-slate-500">{s.insurance_company_name}</span></> : '—'}</td>
                          <td className="px-3 py-2"><N v={s.total_doctor_share} /><span className="block text-xs text-slate-500">{(s.doctors || []).map((d) => d.doctor_name).join('، ')}</span></td>
                          <td className="px-3 py-2 font-semibold"><N v={s.hospital_share} /></td>
                          <td className="px-3 py-2 whitespace-nowrap">{STATUS[s.status] || s.status}
                            {s.insurance_status && <span className="block text-xs text-slate-500">{s.insurance_status === 'settled' ? 'التأمين مُسوّى' : 'تأمين مُسوّى جزئياً'}</span>}</td>
                          <td className="px-3 py-2">{s.status !== 'cancelled' && !s.insurance_settlements?.length && !(s.doctors || []).some((d) => d.paid_amount > 0) && (
                            <button onClick={() => cancel(s)} className="text-red-700 text-xs font-semibold">إلغاء</button>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'doctors' && (pending.pending_doctors.length === 0
            ? <p className="text-slate-500 py-8 text-center">لا توجد أتعاب مستحقة لأي طبيب.</p>
            : <div className="space-y-3">{pending.pending_doctors.map((d) => (
              <div key={d.doctor_id} className="rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-t-xl">
                  <b>د. {d.doctor_name}</b><span>الصافي المستحق: <b><N v={d.total_pending} /></b></span>
                </div>
                <table className="w-full"><tbody>
                  {d.services.map((x) => (
                    <tr key={x.service_id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">{x.service_date}</td>
                      <td className="px-4 py-2">قبل الضريبة <N v={x.gross} /></td>
                      <td className="px-4 py-2 text-slate-500">خصم <N v={x.wht} /></td>
                      <td className="px-4 py-2">صافي <b><N v={x.net} /></b></td>
                      <td className="px-4 py-2 text-end"><button onClick={() => setModal({ type: 'pay', doctor: d, svc: x })} className="text-blue-700 font-semibold">سداد</button></td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            ))}</div>
          )}

          {tab === 'insurance' && (
            <div className="space-y-3">
              <p className="text-slate-600">إجمالي المستحق: <b><N v={ins.total_outstanding} /></b> — إجمالي ما رُفض حتى الآن: <b className="text-red-700"><N v={ins.total_rejected} /></b></p>
              {ins.insurers.length === 0 ? <p className="text-slate-500 py-8 text-center">لا توجد مطالبات تأمين.</p> : ins.insurers.map((g) => (
                <div key={g.insurance_company_id || g.insurance_company_name} className="rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-t-xl">
                    <b>{g.insurance_company_name}</b>
                    <span>طُلب <N v={g.claimed} /></span><span className="text-emerald-700">حُصّل <N v={g.received} /></span>
                    <span className="text-red-700">رُفض <N v={g.rejected} /></span><span>المتبقي <b><N v={g.outstanding} /></b></span>
                    {g.oldest_open_date && <span className="text-slate-500">أقدم مطالبة مفتوحة: {g.oldest_open_date}</span>}
                  </div>
                  {g.claims.length > 0 && <table className="w-full"><tbody>
                    {g.claims.map((c) => (
                      <tr key={c.service_id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2 whitespace-nowrap">{c.service_date}</td>
                        <td className="px-4 py-2">{c.patient_name}</td>
                        <td className="px-4 py-2">متبقي <b><N v={c.outstanding} /></b></td>
                        <td className={`px-4 py-2 text-xs ${c.age_days > 90 ? 'text-red-700 font-bold' : c.age_days > 60 ? 'text-amber-700' : 'text-slate-500'}`}>{c.age_days != null ? `منذ ${c.age_days} يوم` : ''}</td>
                        <td className="px-4 py-2 text-end"><button onClick={() => setModal({ type: 'settle', claim: c, insurer: g.insurance_company_name })} className="text-blue-700 font-semibold">تحصيل / رفض</button></td>
                      </tr>
                    ))}
                  </tbody></table>}
                </div>
              ))}
            </div>
          )}

          {tab === 'payments' && (payments.length === 0
            ? <p className="text-slate-500 py-8 text-center">لم تُسدد أتعاب بعد.</p>
            : <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600"><tr>
                {['التاريخ', 'الطبيب', 'قبل الضريبة', 'الخصم', 'الصافي', 'من'].map((h) => <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>{payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{p.payment_date}</td><td className="px-3 py-2">د. {p.doctor_name}</td>
                  <td className="px-3 py-2"><N v={p.gross_amount} /></td><td className="px-3 py-2"><N v={p.wht_amount} /> <span className="text-xs text-slate-500">({r2(p.wht_rate * 100)}%)</span></td>
                  <td className="px-3 py-2 font-semibold"><N v={p.net_payment} /></td><td className="px-3 py-2">{p.payment_method === 'cash' ? 'الخزينة' : 'البنك'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}

      {modal?.type === 'new' && <NewServiceModal known={known} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'settle' && <SettleModal claim={modal.claim} insurer={modal.insurer} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'pay' && <PayDoctorModal doctor={modal.doctor} svc={modal.svc} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}
