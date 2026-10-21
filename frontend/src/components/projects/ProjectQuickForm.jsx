/**
 * مشروع جديد / تعديل مشروع — the short form: name, client, start date,
 * budget; end date and notes are optional and folded away.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { FolderPlus, Pencil, ChevronDown } from 'lucide-react';
import { API_URL, authHeaders, today, errText, STATUSES, Modal, inputCls, btnPrimary, btnGhost } from './simpleShared';

export default function ProjectQuickForm({ token, isRTL = true, project = null, onClose, onSaved, onDelete }) {
  const editing = !!project;
  const [f, setF] = useState({
    name: project?.name || '',
    client_name: project?.client_name || '',
    start_date: project?.start_date || today(),
    budget: project?.budget ? String(project.budget) : '',
    end_date: project?.end_date || '',
    notes: project?.notes || '',
    status: project?.status || 'in_progress',
  });
  const [more, setMore] = useState(!!(project?.end_date || project?.notes));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const L = (ar, en) => (isRTL ? ar : en);

  const budget = f.budget === '' ? 0 : Number(f.budget);
  const badDates = f.end_date && f.start_date && f.end_date < f.start_date;
  const ready = f.name.trim().length >= 2 && !(budget < 0) && !Number.isNaN(budget) && !badDates;

  const save = async () => {
    setBusy(true); setErr('');
    const body = {
      name: f.name.trim(), client_name: f.client_name.trim(), start_date: f.start_date || null,
      budget, end_date: f.end_date || null, notes: f.notes.trim(), status: f.status,
    };
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/tasks/projects/${project.id}`, body, authHeaders(token));
        onSaved?.({ ...project, ...body }, L('تم حفظ التعديلات', 'Saved'));
      } else {
        const { data } = await axios.post(`${API_URL}/api/tasks/projects`, body, authHeaders(token));
        onSaved?.(data, L('تم إنشاء المشروع — سجّل أول إيراد أو مصروف', 'Project created'));
      }
    } catch (e) {
      setErr(errText(e, L('تعذّر الحفظ', 'Could not save')));
    } finally { setBusy(false); }
  };

  return (
    <Modal isRTL={isRTL} onClose={onClose}
      title={editing ? L('تعديل المشروع', 'Edit project') : L('مشروع جديد', 'New project')}
      icon={editing ? <Pencil className="w-5 h-5 text-[#28376B]" /> : <FolderPlus className="w-5 h-5 text-[#28376B]" />}
      footer={<>
        {onDelete && (
          <button type="button" onClick={onDelete} className="me-auto px-2 py-2.5 text-sm text-rose-600 hover:underline">
            {L('حذف المشروع', 'Delete project')}
          </button>
        )}
        <button type="button" onClick={onClose} className={btnGhost}>{L('إلغاء', 'Cancel')}</button>
        <button type="button" onClick={save} disabled={!ready || busy} className={btnPrimary}>
          {busy ? '…' : editing ? L('حفظ', 'Save') : L('إنشاء المشروع', 'Create project')}
        </button>
      </>}>
      <div className="space-y-3 text-sm">
        <label className="block"><span className="text-slate-700 font-medium">{L('اسم المشروع *', 'Project name *')}</span>
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder={L('مثال: تشطيب فيلا التجمع', 'e.g. Villa finishing')} className={inputCls} /></label>

        <label className="block"><span className="text-slate-700 font-medium">{L('العميل', 'Client')}</span>
          <input value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })}
            placeholder={L('اسم العميل أو الشركة', 'Client or company name')} className={inputCls} /></label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-slate-700 font-medium">{L('تاريخ البدء', 'Start date')}</span>
            <input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className="text-slate-700 font-medium">{L('الميزانية (ج.م)', 'Budget (EGP)')}</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" dir="ltr" value={f.budget}
              onChange={(e) => setF({ ...f, budget: e.target.value })} placeholder="0" className={`${inputCls} tabular-nums`} /></label>
        </div>

        {editing && (
          <label className="block"><span className="text-slate-700 font-medium">{L('الحالة', 'Status')}</span>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>
              {Object.entries(STATUSES).map(([k, s]) => <option key={k} value={k}>{isRTL ? s.ar : s.en}</option>)}
            </select></label>
        )}

        <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
          className="flex items-center gap-1 text-[#28376B] text-sm font-semibold">
          <ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} />
          {L('تاريخ الانتهاء وملاحظات (اختياري)', 'End date & notes (optional)')}
        </button>
        {more && (
          <div className="space-y-3">
            <label className="block"><span className="text-slate-700 font-medium">{L('تاريخ الانتهاء المتوقع', 'Expected end date')}</span>
              <input type="date" value={f.end_date} min={f.start_date || undefined}
                onChange={(e) => setF({ ...f, end_date: e.target.value })} className={inputCls} />
              {badDates && <span className="block mt-1 text-xs text-rose-700" role="alert">{L('تاريخ الانتهاء قبل تاريخ البدء', 'End is before start')}</span>}
            </label>
            <label className="block"><span className="text-slate-700 font-medium">{L('ملاحظات', 'Notes')}</span>
              <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={inputCls} /></label>
          </div>
        )}
        {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
