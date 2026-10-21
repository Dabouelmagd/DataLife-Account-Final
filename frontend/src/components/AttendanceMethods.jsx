/**
 * طرق تسجيل الحضور — البصمة، اليدوي، والموقع (GPS)، ويمكن استخدامها معاً.
 *   MethodsCard    — تفعيل الطرق المستخدمة في الشركة (أي مجموعة منها)
 *   GpsPunchButton — «حضور بالموقع» بجوار البصمة واليدوي: يسجّل حضور/انصراف
 *                    المستخدم الحالي (المرتبط بملف موظف) من موقعه، في نفس سجل الحضور.
 * Backend: GET/PUT /api/attendance-pro/{settings,methods}, POST /api/ess/attendance/check-{in,out}
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapPin, Upload, Pencil, Loader2, X } from 'lucide-react';
import { getPosition } from '../utils/geo';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const errText = (e, f) => { const d = e?.response?.data?.detail; return typeof d === 'string' ? d : f; };

export function useAttendanceMethods() {
  const [methods, setMethods] = useState({ fingerprint: true, manual: true, gps: true });
  const reload = () => axios.get(`${API}/api/attendance-pro/settings`, auth())
    .then((r) => r.data?.methods && setMethods(r.data.methods)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return [methods, setMethods, reload];
}

const ITEMS = [
  ['fingerprint', 'البصمة', 'استيراد ملف جهاز البصمة (CSV) يومياً أو أسبوعياً.', Upload],
  ['gps', 'الموقع (GPS)', 'الموظف يسجّل من موبايله في بوابة الموظف، داخل نطاق موقع العمل فقط.', MapPin],
  ['manual', 'اليدوي', 'الموارد البشرية تضيف أو تصحّح سجلاً — متاح دائماً للتصحيح.', Pencil],
];

export function MethodsCard({ methods, onSaved }) {
  const [m, setM] = useState(methods);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => setM(methods), [methods]);
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const { data } = await axios.put(`${API}/api/attendance-pro/methods`, m, auth()); setMsg({ text: data.message }); onSaved?.(data.methods); }
    catch (e) { setMsg({ err: true, text: errText(e, 'تعذّر الحفظ') }); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3 text-sm" dir="rtl">
      <h3 className="text-lg font-bold">طرق تسجيل الحضور</h3>
      <p className="text-slate-500">فعّل طريقة أو أكثر — كلها تُسجَّل في نفس كشف الحضور وتُحسب في الرواتب بنفس الطريقة، ويظهر بجانب كل سجل الطريقة التي سُجّل بها.</p>
      <div className="space-y-2">
        {ITEMS.map(([k, label, hint, Icon]) => (
          <label key={k} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${m[k] ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="checkbox" className="mt-1" checked={!!m[k]} onChange={(e) => setM({ ...m, [k]: e.target.checked })} />
            <Icon className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" aria-hidden />
            <span><b>{label}</b><span className="block text-slate-500">{hint}</span></span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="px-5 py-2 rounded-lg bg-teal-600 text-white font-bold disabled:opacity-50">{busy ? '…' : 'حفظ'}</button>
        {msg && <p role={msg.err ? 'alert' : 'status'} className={msg.err ? 'text-red-700' : 'text-emerald-700'}>{msg.text}</p>}
      </div>
    </section>
  );
}

export function GpsPunchButton({ onDone, className = '' }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ busy: false, msg: null });

  const punch = (kind) => {
    setState({ busy: true, msg: null });
    getPosition().then(async (pos) => {
      try {
        const { data } = await axios.post(kind === "in" ? `${API}/api/ess/attendance/check-in` : `${API}/api/ess/attendance/check-out`,
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude, device_id: 'web' }, auth());
        const d = data.geofence?.distance_m;
        setState({ busy: false, msg: { text: `${data.message}${d != null ? ` — على بعد ${Math.round(d)} م من موقع العمل` : ''}` } });
        onDone?.();
      } catch (e) { setState({ busy: false, msg: { err: true, text: errText(e, 'تعذّر التسجيل') } }); }
    }, (err) => {
      setState({ busy: false, msg: { err: true, text: err.message } });
    });
  };

  return (
    <>
      <button onClick={() => { setOpen(true); setState({ busy: false, msg: null }); }} className={className}>
        <MapPin className="h-4 w-4" aria-hidden /> حضور بالموقع
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-xl text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><MapPin className="w-5 h-5 text-teal-600" aria-hidden />تسجيل بالموقع</h2>
              <button onClick={() => setOpen(false)} aria-label="إغلاق"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-slate-600 dark:text-slate-300">يسجّل حضورك أو انصرافك أنت من موقعك الحالي، بشرط أن تكون داخل نطاق موقع العمل.
                باقي الموظفين يسجّلون بنفس الطريقة من موبايلاتهم في «بوابة الموظف».</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => punch('in')} disabled={state.busy} className="py-3 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-50">تسجيل حضور</button>
                <button onClick={() => punch('out')} disabled={state.busy} className="py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50">تسجيل انصراف</button>
              </div>
              {state.busy && <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />جارٍ تحديد موقعك…</p>}
              {state.msg && <p role={state.msg.err ? 'alert' : 'status'} className={state.msg.err ? 'text-red-700' : 'text-emerald-700'}>{state.msg.text}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
