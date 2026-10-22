import React from 'react';
import { AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/payroll';

/** تنبيه يظهر فوق رواتب الشهور لحد ما الشركة تراجع إعدادات الصناديق. */
export function FundsReviewBanner({ settings, onOpen }) {
  if (!settings || settings.funds_reviewed) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900" dir="rtl" role="note">
      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-bold">راجع الصناديق والمساهمات قبل اعتماد رواتب أول شهر</p>
        <p className="mt-1">صندوق الطوارئ والشهداء وذوي الإعاقة والتأمين الصحي الشامل محسوبين حالياً بالنسب الافتراضية على كل رواتب الشهور. تطبيقها ونسبها ومين يتحملها بيختلف من شركة للتانية — حدّدها مع محاسبك.</p>
      </div>
      {onOpen && <button type="button" onClick={onOpen} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold whitespace-nowrap">مراجعة الإعدادات</button>}
    </div>
  );
}

/** الصناديق والمساهمات على الأجور — اختيارية لكل شركة، ومع كل واحد ملاحظة. */
export default function PayrollFunds({ settings, onSaved }) {
  const [funds, setFunds] = React.useState(() => (settings.funds || []).map((f) => ({ ...f, rate: String(f.rate) })));
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = (key, patch) => setFunds((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { funds: Object.fromEntries(funds.map((f) => [f.key, { enabled: f.enabled, rate: Number(f.rate), payer: f.payer }])) };
      const res = await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'تعذّر الحفظ');
      setMsg({ ok: true, text: 'تم الحفظ — يُطبَّق على رواتب الشهور اللي هتتحسب وتتعتمد من دلوقتي' });
      onSaved && onSaved();
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4" dir="rtl" id="payroll-funds">
      <div>
        <h3 className="font-bold">الصناديق والمساهمات على الأجور</h3>
        <p className="text-sm text-slate-600 mt-1">
          كل صندوق هنا اختياري للشركة. قبل ما تحدد النسب راجع محاسبك أو مستشارك القانوني: هل الصندوق ينطبق على شركتك،
          ونسبته كام، ومين يتحمله. البرنامج بيطبّق اختيارك على رواتب الشهر وعلى القيد وعلى قيد السداد.
        </p>
      </div>
      <div className="grid gap-3">
        {funds.map((f) => (
          <div key={f.key} className={`rounded-lg border p-4 grid gap-3 ${f.enabled ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={f.enabled} onChange={(e) => set(f.key, { enabled: e.target.checked })} className="w-4 h-4" />
                {f.name}
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">النسبة
                  <input type="number" dir="ltr" step="0.01" min="0" max="5" value={f.rate} disabled={!f.enabled}
                    onChange={(e) => set(f.key, { rate: e.target.value })}
                    className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg tabular-nums disabled:opacity-50" />%
                </label>
                <span className="text-slate-500">من {f.base_label}</span>
                {f.payers.length > 1 && (
                  <label className="flex items-center gap-2">يتحمله
                    <select value={f.payer} disabled={!f.enabled} onChange={(e) => set(f.key, { payer: e.target.value })}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50">
                      <option value="company">الشركة (مصروف)</option>
                      <option value="employee">الموظف (يُخصم من الراتب)</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
            <p className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">{f.note} <span className="text-slate-500">(النسبة الافتراضية <bdi dir="ltr">{f.default_rate}%</bdi>)</span></p>
          </div>
        ))}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
      <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">{busy ? '…' : 'حفظ الصناديق'}</button>
    </section>
  );
}
