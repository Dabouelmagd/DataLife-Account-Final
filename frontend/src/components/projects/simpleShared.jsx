/**
 * Shared bits of the simple projects screens: number format (English digits),
 * status names, the five expense kinds, and a small modal that works on a
 * phone (full width, scrolls inside itself).
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const authHeaders = (token) => ({
  headers: { Authorization: `Bearer ${token || localStorage.getItem('token')}` },
});

export const money = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const today = () => new Date().toISOString().slice(0, 10);

export const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return fallback;
};

export const STATUSES = {
  planning:    { ar: 'لم يبدأ بعد',   en: 'Not started', cls: 'bg-slate-100 text-slate-700' },
  in_progress: { ar: 'جاري التنفيذ',  en: 'In progress', cls: 'bg-blue-100 text-blue-800' },
  on_hold:     { ar: 'متوقف مؤقتاً',  en: 'On hold',     cls: 'bg-amber-100 text-amber-800' },
  completed:   { ar: 'مكتمل',         en: 'Completed',   cls: 'bg-emerald-100 text-emerald-800' },
  cancelled:   { ar: 'ملغي',          en: 'Cancelled',   cls: 'bg-rose-100 text-rose-700' },
};

// The five kinds offered in the quick form. The server maps each to the
// company's chart (services/project_posting.EXPENSE_ACCOUNTS):
// materials 316→311, labor 317→312, subcontractor 315, equipment 313, other 313→332.
export const SIMPLE_EXPENSE_KINDS = [
  { id: 'materials',     ar: 'خامات ومواد',     en: 'Materials' },
  { id: 'labor',         ar: 'عمالة',           en: 'Labour' },
  { id: 'subcontractor', ar: 'مقاول باطن',      en: 'Subcontractor' },
  { id: 'equipment',     ar: 'معدات',           en: 'Equipment' },
  { id: 'other',         ar: 'أخرى',            en: 'Other' },
];

// labels for every category an older or detailed form may have stored
export const CATEGORY_LABELS = {
  materials: 'خامات ومواد', labor: 'عمالة', subcontractor: 'مقاول باطن', equipment: 'معدات', other: 'أخرى',
  salaries: 'رواتب', software: 'برمجيات واشتراكات', marketing: 'دعاية وإعلان', rent: 'إيجار',
  utilities: 'كهرباء ومياه', transport: 'نقل ومواصلات', administrative: 'مصاريف إدارية',
  payment: 'دفعة من العميل', advance: 'دفعة مقدمة', milestone: 'دفعة مستخلص', final: 'دفعة ختامية',
  retention: 'إفراج عن ضمان',
};

export function StatusPill({ status, isRTL }) {
  const s = STATUSES[status] || STATUSES.planning;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      {isRTL ? s.ar : s.en}
    </span>
  );
}

/** Budget bar: green under 80%, amber to 100%, red over budget. */
export function BudgetBar({ pct, isRTL }) {
  if (pct === null || pct === undefined) {
    return <p className="text-xs text-slate-400">{isRTL ? 'لم تُحدَّد ميزانية' : 'No budget set'}</p>;
  }
  const w = Math.min(100, Math.max(0, pct));
  const color = pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{isRTL ? 'المصروف من الميزانية' : 'Budget spent'}</span>
        <bdi dir="ltr" className={`tabular-nums font-semibold ${pct > 100 ? 'text-rose-600' : ''}`}>{pct}%</bdi>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar"
        aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export function Amount({ value, className = '' }) {
  return <bdi dir="ltr" className={`tabular-nums ${className}`}>{money(value)}</bdi>;
}

export function Modal({ title, icon, onClose, children, footer, isRTL = true, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label={title} dir={isRTL ? 'rtl' : 'ltr'}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl`}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-extrabold flex items-center gap-2 text-slate-900">{icon}{title}</h2>
          <button type="button" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200">{footer}</div>}
      </div>
    </div>
  );
}

export const inputCls = 'mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#28376B]/30 focus:border-[#28376B]';
export const btnPrimary = 'px-4 py-2.5 rounded-lg bg-[#28376B] hover:bg-[#1f2b55] text-white text-sm font-bold disabled:opacity-50';
export const btnGhost = 'px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50';
