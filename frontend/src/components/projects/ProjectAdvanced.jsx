/**
 * «متقدم» — everything that is not day-to-day money in / out:
 *   - the detailed add form (pick the exact account, supplier/customer, reference)
 *   - BOQ / بنود المقايسة       GET/POST /api/enterprise/boq, PUT …/executed-qty
 *   - progress claims, subcontractor claims and retention held
 *                               GET /api/enterprise/progress-claims/{project_id}
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ClipboardList, FileSpreadsheet, ShieldCheck, SlidersHorizontal, Plus, RefreshCw, Check } from 'lucide-react';
import ProjectMoneyDialog from '../ProjectMoneyDialog';
import UnbilledWorkPanel from './UnbilledWorkPanel';
import { API_URL, authHeaders, errText, Amount, inputCls, btnPrimary, btnGhost } from './simpleShared';

function Section({ icon: Icon, title, hint, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Icon className="w-4 h-4 text-[#28376B]" />{title}</h3>
          {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const th = 'px-3 py-2 text-start font-semibold whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';

export default function ProjectAdvanced({ token, isRTL = true, projectId, onPosted }) {
  const L = (ar, en) => (isRTL ? ar : en);
  const [detailed, setDetailed] = useState(null);
  const [boq, setBoq] = useState(null);
  const [claims, setClaims] = useState(null);
  const [boqForm, setBoqForm] = useState(null);
  const [execEdit, setExecEdit] = useState({});
  const [busy, setBusy] = useState(false);

  const loadBoq = useCallback(() => {
    axios.get(`${API_URL}/api/enterprise/boq/${projectId}`, { ...authHeaders(token), params: { limit: 200 } })
      .then(({ data }) => setBoq(data)).catch(() => setBoq({ items: [], summary: {}, failed: true }));
  }, [projectId, token]);
  const loadClaims = useCallback(() => {
    axios.get(`${API_URL}/api/enterprise/progress-claims/${projectId}`, authHeaders(token))
      .then(({ data }) => setClaims(data.claims || [])).catch(() => setClaims([]));
  }, [projectId, token]);
  useEffect(() => { loadBoq(); loadClaims(); }, [loadBoq, loadClaims]);

  const addBoq = async () => {
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/enterprise/boq`, {
        project_id: projectId, item_number: boqForm.item_number.trim(), description_ar: boqForm.description_ar.trim(),
        unit: boqForm.unit.trim(), unit_price: Number(boqForm.unit_price) || 0, planned_qty: Number(boqForm.planned_qty) || 0,
      }, authHeaders(token));
      toast.success(L('تمت إضافة البند', 'Item added'));
      setBoqForm(null); loadBoq();
    } catch (e) { toast.error(errText(e, L('تعذّر الإضافة', 'Could not add'))); } finally { setBusy(false); }
  };

  const saveExec = async (item) => {
    try {
      await axios.put(`${API_URL}/api/enterprise/boq/${item.id}/executed-qty`,
        { executed_qty: Number(execEdit[item.id]) || 0 }, authHeaders(token));
      setExecEdit((x) => { const n = { ...x }; delete n[item.id]; return n; });
      loadBoq();
    } catch (e) { toast.error(errText(e, L('تعذّر الحفظ', 'Could not save'))); }
  };

  const owner = (claims || []).filter((c) => c.claim_type !== 'subcontractor');
  const subs = (claims || []).filter((c) => c.claim_type === 'subcontractor');
  const sum = (list, k) => list.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const boqReady = boqForm && boqForm.item_number.trim() && boqForm.description_ar.trim().length >= 2 && boqForm.unit.trim()
    && Number(boqForm.planned_qty) > 0 && Number(boqForm.unit_price) >= 0;

  const claimTable = (list, partyLabel) => (
    <div className="relative overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>
          <th className={th}>{L('رقم', 'No.')}</th><th className={th}>{partyLabel}</th><th className={th}>{L('التاريخ', 'Date')}</th>
          <th className={`${th} text-end`}>{L('قيمة المستخلص', 'Claim')}</th><th className={`${th} text-end`}>{L('ضمان محتجز', 'Retention')}</th>
          <th className={`${th} text-end`}>{L('الصافي', 'Net')}</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((c) => (
            <tr key={c.id}>
              <td className={td}><bdi dir="ltr">{c.claim_number}</bdi></td>
              <td className="px-3 py-2">{c.partner_name || '—'}</td>
              <td className={td}><bdi dir="ltr" className="tabular-nums">{c.claim_date}</bdi></td>
              <td className={`${td} text-end`}><Amount value={c.current_claim} /></td>
              <td className={`${td} text-end text-amber-700`}><Amount value={c.retention_amount} /></td>
              <td className={`${td} text-end font-semibold`}><Amount value={c.net_payable} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {L('الحاجات دي للمحاسب أو لمشاريع المقاولات. الشغل اليومي (إيراد/مصروف) من الزرارين فوق.',
          'For the accountant or contracting projects. Day-to-day money is the two buttons above.')}
      </p>

      <Section icon={SlidersHorizontal} title={L('تسجيل بتفاصيل كاملة', 'Detailed entry')}
        hint={L('اختيار حساب بعينه من شجرة الحسابات، اسم المورد أو العميل، ورقم مرجعي — نفس القيد المحاسبي.',
          'Pick an exact account, supplier/customer and reference — same journal entry.')}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDetailed('revenue')} className={btnGhost}>{L('إيراد بالتفصيل', 'Detailed revenue')}</button>
          <button type="button" onClick={() => setDetailed('expense')} className={btnGhost}>{L('مصروف بالتفصيل', 'Detailed expense')}</button>
        </div>
      </Section>

      <UnbilledWorkPanel token={token} isRTL={isRTL} projectId={projectId} onPosted={onPosted} />

      <Section icon={FileSpreadsheet} title={L('بنود المقايسة', 'Bill of quantities')}
        hint={L('الكميات المتفق عليها وسعر الوحدة، وكام اتنفذ منها.', 'Agreed quantities, unit prices and what was executed.')}
        action={!boqForm && (
          <button type="button" onClick={() => setBoqForm({ item_number: String((boq?.items?.length || 0) + 1), description_ar: '', unit: 'م²', planned_qty: '', unit_price: '' })}
            className="flex items-center gap-1 text-sm font-semibold text-[#28376B]"><Plus className="w-4 h-4" />{L('بند جديد', 'New item')}</button>
        )}>
        {boqForm && (
          <div className="mb-4 rounded-xl bg-slate-50 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 text-sm">
            <label className="col-span-1"><span className="text-xs text-slate-600">{L('رقم البند', 'No.')}</span>
              <input dir="ltr" value={boqForm.item_number} onChange={(e) => setBoqForm({ ...boqForm, item_number: e.target.value })} className={inputCls} /></label>
            <label className="col-span-1 sm:col-span-2"><span className="text-xs text-slate-600">{L('الوصف', 'Description')}</span>
              <input value={boqForm.description_ar} onChange={(e) => setBoqForm({ ...boqForm, description_ar: e.target.value })} className={inputCls} /></label>
            <label><span className="text-xs text-slate-600">{L('الوحدة', 'Unit')}</span>
              <input value={boqForm.unit} onChange={(e) => setBoqForm({ ...boqForm, unit: e.target.value })} className={inputCls} /></label>
            <label><span className="text-xs text-slate-600">{L('الكمية', 'Qty')}</span>
              <input type="number" min="0" dir="ltr" value={boqForm.planned_qty} onChange={(e) => setBoqForm({ ...boqForm, planned_qty: e.target.value })} className={inputCls} /></label>
            <label><span className="text-xs text-slate-600">{L('سعر الوحدة', 'Unit price')}</span>
              <input type="number" min="0" dir="ltr" value={boqForm.unit_price} onChange={(e) => setBoqForm({ ...boqForm, unit_price: e.target.value })} className={inputCls} /></label>
            <div className="col-span-2 sm:col-span-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBoqForm(null)} className={btnGhost}>{L('إلغاء', 'Cancel')}</button>
              <button type="button" onClick={addBoq} disabled={!boqReady || busy} className={btnPrimary}>{L('إضافة', 'Add')}</button>
            </div>
          </div>
        )}
        {!boq ? <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mx-auto" /> : boq.items.length === 0 ? (
          <p className="text-sm text-slate-500">{boq.failed ? L('تعذّر التحميل.', 'Could not load.') : L('مفيش بنود. أضف بنود المقايسة لو المشروع مقاولات وعايز تتابع نسبة التنفيذ.', 'No items yet.')}</p>
        ) : (
          <>
            <div className="relative overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600"><tr>
                  <th className={th}>#</th><th className={th}>{L('البند', 'Item')}</th><th className={th}>{L('الوحدة', 'Unit')}</th>
                  <th className={`${th} text-end`}>{L('الكمية', 'Qty')}</th><th className={`${th} text-end`}>{L('السعر', 'Price')}</th>
                  <th className={`${th} text-end`}>{L('القيمة', 'Value')}</th><th className={`${th} text-end`}>{L('المنفذ', 'Executed')}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {boq.items.map((it) => (
                    <tr key={it.id}>
                      <td className={td}><bdi dir="ltr">{it.item_number}</bdi></td>
                      <td className="px-3 py-2">{it.description_ar}</td>
                      <td className={td}>{it.unit}</td>
                      <td className={`${td} text-end`}><Amount value={it.planned_qty} /></td>
                      <td className={`${td} text-end`}><Amount value={it.unit_price} /></td>
                      <td className={`${td} text-end font-semibold`}><Amount value={it.planned_amount} /></td>
                      <td className={`${td} text-end`}>
                        <span className="inline-flex items-center gap-1">
                          <input type="number" min="0" dir="ltr" aria-label={L('الكمية المنفذة', 'Executed qty')}
                            value={execEdit[it.id] ?? it.executed_qty ?? 0}
                            onChange={(e) => setExecEdit({ ...execEdit, [it.id]: e.target.value })}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm tabular-nums" />
                          {execEdit[it.id] !== undefined && (
                            <button type="button" onClick={() => saveExec(it)} aria-label={L('حفظ', 'Save')}
                              className="p-1 rounded bg-[#28376B] text-white"><Check className="w-3.5 h-3.5" /></button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {L('إجمالي المقايسة', 'Total')} <Amount value={boq.summary?.total_planned_amount} /> · {L('المنفذ', 'Executed')}{' '}
              <Amount value={boq.summary?.total_executed_amount} /> (<bdi dir="ltr">{boq.summary?.completion_percentage || 0}%</bdi>)
            </p>
          </>
        )}
      </Section>

      <Section icon={ClipboardList} title={L('المستخلصات', 'Progress claims')}
        hint={L('لإصدار مستخلص جديد: قائمة المالية ← المستخلصات، واختر المشروع ده.', 'Issue new claims from Finance → Progress claims.')}>
        {!claims ? <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mx-auto" /> : claims.length === 0 ? (
          <p className="text-sm text-slate-500">{L('مفيش مستخلصات على المشروع ده.', 'No claims for this project.')}</p>
        ) : (
          <div className="space-y-4">
            {owner.length > 0 && (<div><p className="text-sm font-semibold mb-2">{L('مستخلصات للعميل', 'Client claims')}</p>{claimTable(owner, L('العميل', 'Client'))}</div>)}
            {subs.length > 0 && (<div><p className="text-sm font-semibold mb-2">{L('مستخلصات مقاولي الباطن', 'Subcontractor claims')}</p>{claimTable(subs, L('المقاول', 'Subcontractor'))}</div>)}
          </div>
        )}
      </Section>

      <Section icon={ShieldCheck} title={L('الضمانات المحتجزة', 'Retention')}
        hint={L('ضمان حسن التنفيذ اللي بيتخصم من المستخلصات لحد التسليم.', 'Performance retention withheld until handover.')}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-amber-50 p-3">
            <dt className="text-amber-900 text-xs">{L('محتجز لنا عند العميل', 'Held by the client (ours)')}</dt>
            <dd className="text-lg font-extrabold text-amber-800"><Amount value={sum(owner, 'retention_amount')} /></dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-slate-700 text-xs">{L('محتجز عندنا لمقاولي الباطن', 'Held by us for subcontractors')}</dt>
            <dd className="text-lg font-extrabold text-slate-900"><Amount value={sum(subs, 'retention_amount')} /></dd>
          </div>
        </dl>
      </Section>

      {detailed && (
        <ProjectMoneyDialog projectId={projectId} kind={detailed} onClose={() => setDetailed(null)}
          onSaved={(data) => { setDetailed(null); toast.success(data.message); onPosted?.(); }} />
      )}
    </div>
  );
}
