/**
 * «أعمال منجزة لم تُفوتر» — work done on the project, not billed yet.
 * Industry packs only: 143 (construction), 150 (professional), 149 (ads).
 *   record:  Dr 143|150|149 / Cr the revenue account
 *   billing: the next progress claim / project revenue / sales invoice of this
 *            project releases it automatically (Dr revenue / Cr 143|150|149)
 * Data: GET/POST /api/projects/{id}/unbilled, POST …/unbilled/{accrual}/reverse
 * Renders nothing for a company without any of the three accounts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Hourglass, Plus } from 'lucide-react';
import { API_URL, authHeaders, errText, Amount, Modal, inputCls, btnPrimary, btnGhost, today } from './simpleShared';

const STATUS = { open: ['مفتوح', 'bg-amber-100 text-amber-800'], partial: ['فُوتر جزئياً', 'bg-blue-100 text-blue-800'],
  billed: ['فُوتر', 'bg-emerald-100 text-emerald-800'] };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function EntryPreview({ rows }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
      <p className="font-bold mb-1">القيد الذي سيُرحَّل:</p>
      <table className="w-full"><tbody>
        {rows.filter((r) => r[1] || r[2]).map((r) => (
          <tr key={r[0]}><td className="py-0.5">{r[0]}</td>
            <td className="text-end">{r[1] ? <Amount value={r[1]} /> : ''}</td><td className="text-end">{r[2] ? <Amount value={r[2]} /> : ''}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

export default function UnbilledWorkPanel({ token, isRTL = true, projectId, onPosted }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    axios.get(`${API_URL}/api/projects/${projectId}/unbilled`, authHeaders(token))
      .then(({ data: d }) => setData(d)).catch(() => setData({ available: false, items: [] }));
  }, [projectId, token]);
  useEffect(() => { load(); }, [load]);

  if (!data?.available) return null;
  const wips = data.wip_accounts || [];
  const nameOf = (code) => (data.revenue_accounts || []).find((a) => a.account_code === code)?.account_name || '';
  const wipName = (code) => wips.find((a) => a.account_code === code)?.account_name || '';

  const openForm = () => {
    setErr('');
    const w = wips[0];
    setForm({ amount: '', date: today(), description: '', wip_account: w.account_code, revenue_account: w.default_revenue });
  };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const { data: r } = await axios.post(`${API_URL}/api/projects/${projectId}/unbilled`, {
        amount: Number(form.amount), date: form.date, description: form.description.trim(),
        wip_account: form.wip_account, revenue_account: form.revenue_account }, authHeaders(token));
      toast.success(r.message); setForm(null); load(); onPosted?.();
    } catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const closeIt = async () => {
    setBusy(true); setErr('');
    try {
      const { data: r } = await axios.post(`${API_URL}/api/projects/${projectId}/unbilled/${closing.item.id}/reverse`,
        { reason: closing.reason.trim(), date: closing.date }, authHeaders(token));
      toast.success(r.message); setClosing(null); load(); onPosted?.();
    } catch (e) { setErr(errText(e, 'تعذّر الإقفال')); } finally { setBusy(false); }
  };

  const amt = r2(form?.amount);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Hourglass className="w-4 h-4 text-[#28376B]" />أعمال منجزة لم تُفوتر</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            شغل اتعمل في الفترة ولسه مطلعش بيه مستخلص أو فاتورة: يتسجل إيراد الفترة دلوقتي على {wips.map((w) => w.account_code).join(' / ')}،
            ولما تطلع المستخلص أو الفاتورة أو تسجل إيراد للمشروع ده بيتسوّى تلقائياً — فالإيراد ما يتحسبش مرتين.
          </p>
        </div>
        <button type="button" onClick={openForm} className={`${btnPrimary} flex items-center gap-1.5 py-2`}><Plus className="w-4 h-4" />إثبات أعمال منجزة لم تُفوتر</button>
      </div>
      <div className="p-4">
        <p className="text-sm mb-2">المفتوح غير المفوتر: <b><Amount value={data.open_total} /></b> ج.م</p>
        {(data.items || []).length === 0 ? <p className="text-sm text-slate-500">لا توجد أعمال مسجلة.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-600 text-xs"><tr>
              {['التاريخ', 'البيان', 'الحساب', 'القيمة', 'المتبقي', 'الحالة', ''].map((h) => <th key={h} className="px-3 py-2 text-start font-semibold">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2 whitespace-nowrap"><bdi dir="ltr" className="tabular-nums">{it.date}</bdi></td>
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><bdi dir="ltr">{it.wip_account}</bdi> ← <bdi dir="ltr">{it.revenue_account}</bdi></td>
                  <td className="px-3 py-2 text-end"><Amount value={it.amount} /></td>
                  <td className="px-3 py-2 text-end font-semibold"><Amount value={it.remaining} /></td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${(STATUS[it.status] || [])[1] || ''}`}>{(STATUS[it.status] || [it.status])[0]}</span></td>
                  <td className="px-3 py-2 text-end">{it.status !== 'billed' && (
                    <button type="button" onClick={() => { setErr(''); setClosing({ item: it, reason: '', date: today() }); }} className="text-xs text-rose-700 font-semibold">إقفال يدوي</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {form && (
        <Modal isRTL={isRTL} onClose={() => setForm(null)} title="إثبات أعمال منجزة لم تُفوتر" icon={<Hourglass className="w-5 h-5 text-[#28376B]" />}
          footer={<>
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>رجوع</button>
            <button type="button" onClick={save} disabled={busy || !(amt > 0) || form.description.trim().length < 3} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button>
          </>}>
          <div className="space-y-3 text-sm">
            <label className="block"><span className="text-slate-700 font-medium">قيمة الأعمال المنجزة *</span>
              <input type="number" min="0" step="0.01" dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-slate-700 font-medium">تاريخ التنفيذ</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-slate-700 font-medium">البيان *</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls}
                placeholder="خرسانة الدور التالت، ساعات استشارات أكتوبر، حملة منفذة…" /></label>
            {wips.length > 1 && (
              <label className="block"><span className="text-slate-700 font-medium">نوع الأعمال</span>
                <select value={form.wip_account} onChange={(e) => { const w = wips.find((x) => x.account_code === e.target.value); setForm({ ...form, wip_account: w.account_code, revenue_account: w.default_revenue }); }} className={inputCls}>
                  {wips.map((w) => <option key={w.account_code} value={w.account_code}>{w.account_code} — {w.account_name}</option>)}</select></label>
            )}
            <label className="block"><span className="text-slate-700 font-medium">حساب الإيراد (نفس اللي هيتقيد عليه المستخلص أو الفاتورة)</span>
              <select value={form.revenue_account} onChange={(e) => setForm({ ...form, revenue_account: e.target.value })} className={inputCls}>
                {(data.revenue_accounts || []).map((a) => <option key={a.account_code} value={a.account_code}>{a.account_code} — {a.account_name}</option>)}</select></label>
            {amt > 0 && <EntryPreview rows={[[`${form.wip_account} ${wipName(form.wip_account)}`, amt, 0], [`${form.revenue_account} ${nameOf(form.revenue_account)}`, 0, amt]]} />}
            {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
          </div>
        </Modal>
      )}

      {closing && (
        <Modal isRTL={isRTL} onClose={() => setClosing(null)} title="إقفال أعمال غير مفوترة يدوياً"
          footer={<>
            <button type="button" onClick={() => setClosing(null)} className={btnGhost}>رجوع</button>
            <button type="button" onClick={closeIt} disabled={busy || closing.reason.trim().length < 3}
              className="px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'إقفال وترحيل'}</button>
          </>}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">لو الأعمال دي مش هتتفوتر، أو اتفوترت برة النظام — يتعكس المتبقي من الإيراد.</p>
            <label className="block"><span className="text-slate-700 font-medium">التاريخ</span>
              <input type="date" value={closing.date} onChange={(e) => setClosing({ ...closing, date: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-slate-700 font-medium">السبب *</span>
              <input autoFocus value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} className={inputCls} /></label>
            <EntryPreview rows={[[`${closing.item.revenue_account} ${nameOf(closing.item.revenue_account)}`, closing.item.remaining, 0],
              [`${closing.item.wip_account} ${wipName(closing.item.wip_account)}`, 0, closing.item.remaining]]} />
            {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
          </div>
        </Modal>
      )}
    </section>
  );
}
