/**
 * صفحة المشروع — summary strip, ONE table of all money in and out, and the
 * two buttons that add to it. BOQ, claims, retention and the detailed form
 * live in the «متقدم» tab.
 * Data: GET /api/projects/{id}/movements (tenant-scoped, read-only).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowLeft, Pencil, Printer, TrendingUp, TrendingDown, Paperclip, Undo2, RefreshCw,
  Receipt, Settings2, User, CalendarDays,
} from 'lucide-react';
import {
  API_URL, authHeaders, money, errText, CATEGORY_LABELS, StatusPill, BudgetBar, Amount, Modal, inputCls, btnGhost,
} from './simpleShared';
import QuickMoneyDialog from './QuickMoneyDialog';
import ProjectAdvanced from './ProjectAdvanced';
import { escapeHtml } from '../../utils/escapeHtml';

const sourceLabel = (m, isRTL) => {
  if (m.paid_from === 'cash' || m.paid_from_code === '161') return isRTL ? 'الخزينة' : 'Cash';
  return m.paid_from_name || '—';
};

export default function ProjectWorkspace({ token, isRTL = true, projectId, onBack, onEdit, onChanged }) {
  const L = (ar, en) => (isRTL ? ar : en);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('movements');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(null);          // 'revenue' | 'expense'
  const [cancelling, setCancelling] = useState(null);  // movement
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const { data: d } = await axios.get(`${API_URL}/api/projects/${projectId}/movements`, authHeaders(token));
      setData(d);
    } catch (e) {
      setErr(errText(e, isRTL ? 'تعذّر تحميل المشروع' : 'Could not load project'));
    }
  }, [projectId, token, isRTL]);

  useEffect(() => { load(); }, [load]);

  const refresh = () => { load(); onChanged?.(); };

  const rows = useMemo(() => (data?.movements || []).filter((m) => filter === 'all' || m.kind === filter), [data, filter]);
  const counts = useMemo(() => {
    const c = { all: 0, revenue: 0, expense: 0 };
    (data?.movements || []).forEach((m) => { c.all += 1; c[m.kind] += 1; });
    return c;
  }, [data]);

  const openFile = async (att) => {
    try {
      const { data: f } = await axios.get(`${API_URL}/api/attachments/${att.id}/download`, authHeaders(token));
      const bytes = Uint8Array.from(atob(f.file_data || ''), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: f.content_type || 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = f.filename || att.filename || 'attachment';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      toast.error(errText(e, L('تعذّر فتح المرفق', 'Could not open attachment')));
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      const m = cancelling;
      const { data: r } = await axios.post(
        `${API_URL}/api/projects/${projectId}/${m.kind === 'expense' ? 'expenses' : 'revenues'}/${m.id}/cancel`,
        { reason: reason.trim() }, authHeaders(token));
      toast.success(r.message || L('تم الإلغاء', 'Cancelled'));
      setCancelling(null); setReason('');
      refresh();
    } catch (e) {
      toast.error(errText(e, L('تعذّر الإلغاء', 'Could not cancel')));
    } finally { setBusy(false); }
  };

  const print = () => {
    if (!data) return;
    const p = data.project, s = data.summary;
    const live = (data.movements || []).filter((m) => m.status !== 'cancelled');
    const tr = live.map((m) => `<tr><td>${escapeHtml(m.date || '')}</td><td>${m.kind === 'revenue' ? 'إيراد' : 'مصروف'}</td>
      <td>${escapeHtml(m.description)}</td><td>${escapeHtml(sourceLabel(m, true))}</td>
      <td class="n ${m.kind}">${escapeHtml(money(m.amount))}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast.error(L('اسمح بالنوافذ المنبثقة للطباعة', 'Allow pop-ups to print')); return; }
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${escapeHtml(p.name)}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;font-size:13px}h1{margin:0 0 4px;color:#28376B}
      .k{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}.k div{border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}
      .k b{display:block;font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:right}
      th{background:#f1f5f9}.n{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}.revenue{color:#047857}.expense{color:#be123c}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
      <h1>${escapeHtml(p.name)}</h1><div>${escapeHtml(p.client_name ? 'العميل: ' + p.client_name : '')} — ${escapeHtml(new Date().toISOString().slice(0, 10))}</div>
      <div class="k"><div>الميزانية<b>${escapeHtml(s.budget ? money(s.budget) : '—')}</b></div><div>الإيرادات<b>${escapeHtml(money(s.revenue))}</b></div>
      <div>المصروفات<b>${escapeHtml(money(s.expenses))}</b></div><div>${s.profit >= 0 ? 'الربح' : 'الخسارة'}<b>${escapeHtml(money(Math.abs(s.profit)))}</b></div>
      <div>المتبقي من الميزانية<b>${escapeHtml(s.remaining === null ? '—' : money(s.remaining))}</b></div></div>
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>من / إلى</th><th>المبلغ (ج.م)</th></tr></thead><tbody>${tr ||
      '<tr><td colspan="5">لا توجد حركات</td></tr>'}</tbody></table></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const Back = isRTL ? ArrowRight : ArrowLeft;

  if (err && !data) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[#28376B] font-semibold"><Back className="w-4 h-4" />{L('كل المشاريع', 'All projects')}</button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-rose-800 font-semibold">{err}</p>
          <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-white border border-rose-300 text-rose-700 text-sm">{L('حاول تاني', 'Retry')}</button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 animate-spin text-slate-400" /></div>;

  const p = data.project, s = data.summary;
  const tiles = [
    [L('الميزانية', 'Budget'), s.budget > 0 ? <Amount value={s.budget} /> : '—', 'text-slate-900', null],
    [L('الإيرادات', 'Revenue'), <Amount value={s.revenue} />, 'text-emerald-700', null],
    [L('المصروفات', 'Expenses'), <Amount value={s.expenses} />, 'text-rose-700', null],
    [s.profit >= 0 ? L('الربح', 'Profit') : L('الخسارة', 'Loss'), <Amount value={Math.abs(s.profit)} />, s.profit >= 0 ? 'text-emerald-700' : 'text-rose-700', null],
    [L('المتبقي من الميزانية', 'Budget left'), s.remaining === null ? '—' : <Amount value={s.remaining} />,
      s.remaining !== null && s.remaining < 0 ? 'text-rose-700' : 'text-slate-900',
      s.remaining !== null && s.remaining < 0 ? L('تخطيت الميزانية', 'Over budget') : null],
  ];
  const tabBtn = (id, label, Icon) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === id
        ? 'border-[#28376B] text-[#28376B]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[#28376B] font-semibold">
        <Back className="w-4 h-4" />{L('كل المشاريع', 'All projects')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 break-words">{p.name}</h1>
            <StatusPill status={p.status} isRTL={isRTL} />
          </div>
          <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><User className="w-4 h-4" />{p.client_name || L('بدون عميل', 'No client')}</span>
            {p.start_date && (
              <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />
                <bdi dir="ltr" className="tabular-nums">{p.start_date}{p.end_date ? ` → ${p.end_date}` : ''}</bdi></span>
            )}
          </p>
          {p.notes && <p className="mt-1 text-sm text-slate-600">{p.notes}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit?.(p)} className={`${btnGhost} flex items-center gap-1.5 py-2`}><Pencil className="w-4 h-4" />{L('تعديل', 'Edit')}</button>
          <button type="button" onClick={print} className={`${btnGhost} flex items-center gap-1.5 py-2`}><Printer className="w-4 h-4" />{L('طباعة', 'Print')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" data-testid="summary-strip">
        {tiles.map(([label, val, cls, hint], i) => (
          <div key={label} className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg sm:text-xl font-extrabold ${cls}`}>{val}</p>
            {hint && <p className="text-[11px] text-rose-600 font-semibold">{hint}</p>}
          </div>
        ))}
      </div>
      {s.spent_pct !== null && <BudgetBar pct={s.spent_pct} isRTL={isRTL} />}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setAdding('revenue')} data-testid="add-revenue"
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-sm">
          <TrendingUp className="w-5 h-5" />{L('إضافة إيراد', 'Add revenue')}
        </button>
        <button type="button" onClick={() => setAdding('expense')} data-testid="add-expense"
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base shadow-sm">
          <TrendingDown className="w-5 h-5" />{L('إضافة مصروف', 'Add expense')}
        </button>
      </div>

      <div role="tablist" className="flex border-b border-slate-200">
        {tabBtn('movements', L('الحركات', 'Movements'), Receipt)}
        {tabBtn('advanced', L('متقدم', 'Advanced'), Settings2)}
      </div>

      {tab === 'movements' ? (
        <section className="space-y-3" aria-label={L('حركات المشروع', 'Project movements')}>
          {counts.all > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[['all', L('الكل', 'All')], ['revenue', L('إيرادات', 'Revenue')], ['expense', L('مصروفات', 'Expenses')]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === k
                    ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>
                  {label} <bdi dir="ltr" className="tabular-nums opacity-70">{counts[k]}</bdi>
                </button>
              ))}
            </div>
          )}

          {counts.all === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <h2 className="mt-2 font-bold text-slate-800">{L('لسه مفيش حركات على المشروع ده', 'No movements yet')}</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                {L('لما العميل يدفع دوس «إضافة إيراد»، ولما تصرف على المشروع (خامات، عمالة، مقاول…) دوس «إضافة مصروف». كل حركة بتتسجل في الحسابات لوحدها.',
                  'Use «Add revenue» when the client pays and «Add expense» when you spend. Each one is posted to the books automatically.')}
              </p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">{L('مفيش حركات من النوع ده.', 'Nothing of this type.')}</p>
          ) : (
            <div className="relative rounded-2xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-semibold">{L('التاريخ', 'Date')}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{L('النوع', 'Type')}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{L('الوصف', 'Description')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{L('المبلغ', 'Amount')}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{L('من / إلى', 'Cash / bank')}</th>
                    <th className="px-3 py-2.5 text-center font-semibold">{L('مرفق', 'File')}</th>
                    <th className="px-2 py-2.5"><span className="sr-only">{L('إجراءات', 'Actions')}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((m) => {
                    const off = m.status === 'cancelled';
                    const rev = m.kind === 'revenue';
                    return (
                      <tr key={m.id} className={off ? 'bg-slate-50 text-slate-400' : ''}>
                        <td className="px-3 py-2.5 whitespace-nowrap"><bdi dir="ltr" className="tabular-nums">{m.date}</bdi></td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${off ? 'bg-slate-200 text-slate-500'
                            : rev ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {rev ? L('إيراد', 'Revenue') : L('مصروف', 'Expense')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className={off ? 'line-through' : 'text-slate-900'}>{m.description}</p>
                          <p className="text-xs text-slate-400">
                            {!rev && CATEGORY_LABELS[m.category] ? CATEGORY_LABELS[m.category] : ''}
                            {off && <span className="text-slate-500"> {L('ملغي', 'Cancelled')}{m.cancel_reason ? ` — ${m.cancel_reason}` : ''}</span>}
                          </p>
                        </td>
                        <td className={`px-3 py-2.5 text-end font-bold whitespace-nowrap ${off ? 'line-through' : rev ? 'text-emerald-700' : 'text-rose-700'}`}>
                          <Amount value={rev ? m.amount : -m.amount} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate" title={m.paid_from_name}>{sourceLabel(m, isRTL)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {m.attachments?.length ? (
                            <button type="button" onClick={() => openFile(m.attachments[0])} title={m.attachments[0].filename}
                              aria-label={L('فتح المرفق', 'Open attachment')} className="p-1.5 rounded-lg hover:bg-slate-100 text-[#28376B]">
                              <Paperclip className="w-4 h-4" />
                            </button>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-2.5 text-end">
                          {!off && (
                            <button type="button" onClick={() => { setCancelling(m); setReason(''); }}
                              title={L('إلغاء الحركة', 'Cancel')} aria-label={L('إلغاء الحركة', 'Cancel')}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Undo2 className="w-4 h-4" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <ProjectAdvanced token={token} isRTL={isRTL} projectId={projectId} onPosted={refresh} />
      )}

      {adding && (
        <QuickMoneyDialog token={token} isRTL={isRTL} projectId={projectId} kind={adding}
          onClose={() => setAdding(null)}
          onSaved={(_, msg, warn) => { setAdding(null); (warn ? toast.warning : toast.success)(msg); refresh(); }} />
      )}

      {cancelling && (
        <Modal isRTL={isRTL} onClose={() => setCancelling(null)} title={L('إلغاء الحركة', 'Cancel movement')}
          icon={<Undo2 className="w-5 h-5 text-rose-600" />}
          footer={<>
            <button type="button" onClick={() => setCancelling(null)} className={btnGhost}>{L('رجوع', 'Back')}</button>
            <button type="button" onClick={doCancel} disabled={busy || reason.trim().length < 3}
              className="px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50">
              {busy ? '…' : L('إلغاء الحركة', 'Cancel it')}
            </button>
          </>}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              <b>{cancelling.description}</b> — <Amount value={cancelling.amount} /> {L('ج.م', 'EGP')}
            </p>
            <p className="text-slate-500 text-xs leading-5">
              {L('الحركة هتفضل ظاهرة في الجدول بشطب، وهيتعمل قيد عكسي بنفس تاريخها عشان الحسابات تفضل مظبوطة.',
                'It stays listed (struck through) and a reversing entry is posted on its date.')}
            </p>
            <label className="block"><span className="text-slate-700 font-medium">{L('سبب الإلغاء *', 'Reason *')}</span>
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}
                placeholder={L('مثال: اتسجلت مرتين', 'e.g. entered twice')} /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
