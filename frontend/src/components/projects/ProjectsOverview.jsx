/**
 * قائمة المشاريع — one card per project: name, client, status, budget,
 * revenue, expenses, profit and how much of the budget is spent.
 * Data: GET /api/projects/all/overview (cancelled items excluded).
 */
import React, { useMemo, useState } from 'react';
import { Plus, Search, FolderKanban, RefreshCw, Download, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { STATUSES, StatusPill, BudgetBar, Amount, money } from './simpleShared';

export default function ProjectsOverview({ data, loading, error, isRTL = true, onRetry, onOpen, onNew }) {
  const L = (ar, en) => (isRTL ? ar : en);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const projects = useMemo(() => data?.projects || [], [data]);
  const totals = data?.totals;

  const counts = useMemo(() => {
    const c = { all: projects.length };
    projects.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [projects]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) => (status === 'all' || p.status === status) &&
      (!term || `${p.name || ''} ${p.client_name || ''}`.toLowerCase().includes(term)));
  }, [projects, q, status]);

  const exportCsv = () => {
    const head = [L('المشروع', 'Project'), L('العميل', 'Client'), L('الحالة', 'Status'), L('الميزانية', 'Budget'),
      L('الإيرادات', 'Revenue'), L('المصروفات', 'Expenses'), L('الربح', 'Profit'), L('% المصروف من الميزانية', '% budget spent')];
    const rows = shown.map((p) => [p.name, p.client_name, (STATUSES[p.status] || {})[isRTL ? 'ar' : 'en'] || p.status,
      p.budget, p.revenue, p.expenses, p.profit, p.spent_pct ?? '']);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `projects_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-[#28376B]" />{L('المشاريع', 'Projects')}
          </h1>
          <p className="text-sm text-slate-500">{L('كل مشروع: دخل كام، صرف كام، وكسب كام', 'What each project earned, spent and made')}</p>
        </div>
        <button type="button" onClick={onNew} data-testid="new-project"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#28376B] hover:bg-[#1f2b55] text-white font-bold text-sm shadow-sm">
          <Plus className="w-5 h-5" />{L('مشروع جديد', 'New project')}
        </button>
      </div>

      {totals && totals.count > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            [L('عدد المشاريع', 'Projects'), <bdi dir="ltr" className="tabular-nums">{totals.count}</bdi>, 'text-slate-900'],
            [L('إجمالي الإيرادات', 'Total revenue'), <Amount value={totals.revenue} />, 'text-emerald-700'],
            [L('إجمالي المصروفات', 'Total expenses'), <Amount value={totals.expenses} />, 'text-rose-700'],
            [totals.profit >= 0 ? L('إجمالي الربح', 'Total profit') : L('إجمالي الخسارة', 'Total loss'), <Amount value={Math.abs(totals.profit)} />, totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'],
          ].map(([label, val, cls]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-lg font-extrabold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">{L('بحث', 'Search')}</span>
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث باسم المشروع أو العميل', 'Search project or client')}
              className="w-full ps-9 pe-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white" />
          </label>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={L('الحالة', 'Status')}
              className="flex-1 sm:flex-none px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white">
              <option value="all">{L('كل الحالات', 'All statuses')} ({counts.all})</option>
              {Object.entries(STATUSES).map(([k, s]) => (
                <option key={k} value={k}>{isRTL ? s.ar : s.en} ({counts[k] || 0})</option>
              ))}
            </select>
            <button type="button" onClick={exportCsv} title={L('تنزيل Excel (CSV)', 'Download CSV')} aria-label={L('تنزيل Excel (CSV)', 'Download CSV')}
              className="px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-600 hover:bg-slate-50">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-rose-800 font-semibold">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 px-4 py-2 rounded-lg bg-white border border-rose-300 text-rose-700 text-sm">
            {L('حاول تاني', 'Retry')}
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">{L('مفيش مشاريع لسه', 'No projects yet')}</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {L('ابدأ بإضافة مشروع (الاسم، العميل، والميزانية)، وبعدها سجّل كل فلوس داخلة أو خارجة عليه — هتشوف الربح أول بأول.',
              'Add a project, then record money in and out to see its profit.')}
          </p>
          <button type="button" onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#28376B] text-white font-bold text-sm">
            <Plus className="w-5 h-5" />{L('أضف أول مشروع', 'Add first project')}
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {L('مفيش مشاريع بالبحث ده.', 'No projects match.')}{' '}
          <button type="button" className="text-[#28376B] font-semibold underline" onClick={() => { setQ(''); setStatus('all'); }}>
            {L('امسح البحث', 'Clear filters')}
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p)} data-testid={`project-${p.id}`}
                className="w-full text-start rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#28376B]/40 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-[#28376B]/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <User className="w-3.5 h-3.5 shrink-0" />{p.client_name || L('بدون عميل', 'No client')}
                    </p>
                  </div>
                  <StatusPill status={p.status} isRTL={isRTL} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-50 py-1.5">
                    <dt className="text-[11px] text-emerald-800">{L('إيرادات', 'Revenue')}</dt>
                    <dd className="text-sm font-bold text-emerald-700"><Amount value={p.revenue} /></dd>
                  </div>
                  <div className="rounded-lg bg-rose-50 py-1.5">
                    <dt className="text-[11px] text-rose-800">{L('مصروفات', 'Expenses')}</dt>
                    <dd className="text-sm font-bold text-rose-700"><Amount value={p.expenses} /></dd>
                  </div>
                  <div className={`rounded-lg py-1.5 ${p.profit >= 0 ? 'bg-slate-50' : 'bg-rose-100'}`}>
                    <dt className="text-[11px] text-slate-700">{p.profit >= 0 ? L('ربح', 'Profit') : L('خسارة', 'Loss')}</dt>
                    <dd className={`text-sm font-bold ${p.profit >= 0 ? 'text-slate-900' : 'text-rose-700'}`}><Amount value={Math.abs(p.profit)} /></dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <BudgetBar pct={p.spent_pct} isRTL={isRTL} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{L('الميزانية', 'Budget')}: <bdi dir="ltr" className="tabular-nums">{p.budget > 0 ? money(p.budget) : '—'}</bdi></span>
                  <span className="flex items-center text-[#28376B] font-semibold">{L('افتح', 'Open')}<Chevron className="w-4 h-4" /></span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
