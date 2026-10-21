/**
 * إضافة إيراد / إضافة مصروف — the small form.
 *
 * Date (today), amount, what it was for, cash or bank, and for an expense an
 * optional kind (materials / labour / subcontractor / equipment / other) and
 * an optional receipt. It posts to the same routes as the detailed form
 * (POST /api/projects/{id}/expenses|revenues), so the server posts the same
 * journal entry; nothing is saved without it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, TrendingDown, TrendingUp, Paperclip, Wallet, Landmark, ChevronDown } from 'lucide-react';
import {
  API_URL, authHeaders, today, money, errText, SIMPLE_EXPENSE_KINDS, Modal, inputCls, btnGhost,
} from './simpleShared';

const MAX_FILE = 10 * 1024 * 1024;

export default function QuickMoneyDialog({ token, isRTL = true, projectId, kind, onClose, onSaved }) {
  const isExp = kind === 'expense';
  const L = (ar, en) => (isRTL ? ar : en);
  const [opts, setOpts] = useState(null);
  const [f, setF] = useState({ date: today(), amount: '', description: '', category: 'other' });
  const [picked, setPicked] = useState('');          // source chosen by the person; '' = automatic
  const [showOther, setShowOther] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    axios.get(`${API_URL}/api/projects/${projectId}/money-options`, { ...authHeaders(token), params: { kind } })
      .then(({ data }) => { if (live) setOpts(data); })
      .catch((e) => { if (live) { setOpts({ sources: [], categories: {} }); setErr(errText(e, L('تعذّر تحميل الخزينة والبنوك', 'Could not load cash/bank'))); } });
    return () => { live = false; };
  }, [projectId, kind, token]);

  const sources = opts?.sources || [];
  const main = sources.filter((s) => s.group === 'نقدية' || s.group === 'بنوك');
  const other = sources.filter((s) => s.group !== 'نقدية' && s.group !== 'بنوك');
  const amount = Number(f.amount) || 0;

  // the company's main cash box unless it can't cover an expense; then the first bank that can
  const auto = useMemo(() => {
    const cash = main.find((s) => s.id === 'cash');
    if (!isExp) return cash || main[0];
    if (cash && (amount <= (cash.balance || 0) || amount === 0)) return cash;
    return main.find((s) => s.id !== 'cash' && (s.balance || 0) >= amount) || cash || main[0];
  }, [main, isExp, amount]);
  const src = sources.find((s) => s.id === picked) || auto;
  const cashShort = isExp && src?.account_code === '161' && amount > (src?.balance || 0);
  const account = opts?.categories?.[isExp ? f.category : 'payment'];
  const fileTooBig = file && file.size > MAX_FILE;
  const ready = amount > 0 && f.description.trim().length >= 3 && src && !cashShort && !fileTooBig && f.date <= today();

  const save = async () => {
    setBusy(true); setErr('');
    let saved;
    try {
      const body = { amount, date: f.date, description: f.description.trim(), paid_from: src.id,
        category: isExp ? f.category : 'payment' };
      ({ data: saved } = await axios.post(`${API_URL}/api/projects/${projectId}/${isExp ? 'expenses' : 'revenues'}`,
        body, authHeaders(token)));
    } catch (e) {
      setErr(errText(e, L('تعذّر الحفظ', 'Could not save'))); setBusy(false);
      return;
    }
    let note = '';
    if (file) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('entity_type', isExp ? 'project_expense' : 'project_revenue');
        fd.append('entity_id', saved.id);
        fd.append('description', f.description.trim());
        await axios.post(`${API_URL}/api/attachments/upload`, fd, authHeaders(token));
      } catch (e) {
        note = L(' — لكن المرفق لم يُرفع، أضفه مرة أخرى', ' — but the attachment did not upload');
      }
    }
    setBusy(false);
    onSaved?.(saved, (isExp ? L('تم تسجيل المصروف', 'Expense saved') : L('تم تسجيل الإيراد', 'Revenue saved')) + note, !!note);
  };

  const chip = (active) => `flex items-center gap-2 px-3 py-2 rounded-xl border text-start text-sm ${active
    ? (isExp ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500' : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500')
    : 'border-slate-200 hover:bg-slate-50'}`;
  const accent = isExp ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <Modal isRTL={isRTL} onClose={onClose}
      title={isExp ? L('إضافة مصروف', 'Add expense') : L('إضافة إيراد', 'Add revenue')}
      icon={isExp ? <TrendingDown className="w-5 h-5 text-rose-600" /> : <TrendingUp className="w-5 h-5 text-emerald-600" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnGhost}>{L('إلغاء', 'Cancel')}</button>
        <button type="button" onClick={save} disabled={!ready || busy}
          className={`px-5 py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-50 ${accent}`}>
          {busy ? '…' : L('حفظ', 'Save')}
        </button>
      </>}>
      {!opts ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-slate-700 font-medium">{L('المبلغ (ج.م) *', 'Amount (EGP) *')}</span>
              <input autoFocus type="number" inputMode="decimal" min="0" step="0.01" dir="ltr" value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
                className={`${inputCls} tabular-nums text-lg font-bold`} placeholder="0" /></label>
            <label className="block"><span className="text-slate-700 font-medium">{L('التاريخ', 'Date')}</span>
              <input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></label>
          </div>

          <label className="block"><span className="text-slate-700 font-medium">{L('الوصف *', 'Description *')}</span>
            <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls}
              placeholder={isExp ? L('مثال: أسمنت وحديد للدور الأول', 'e.g. cement for 1st floor')
                : L('مثال: الدفعة الأولى من العميل', 'e.g. first client payment')} /></label>

          {isExp && (
            <div>
              <span className="text-slate-700 font-medium">{L('نوع المصروف', 'Kind')}</span>
              <span className="text-slate-400 text-xs ms-1">{L('(اختياري)', '(optional)')}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SIMPLE_EXPENSE_KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => setF({ ...f, category: k.id })} aria-pressed={f.category === k.id}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${f.category === k.id
                      ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                    {isRTL ? k.ar : k.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-slate-700 font-medium">{isExp ? L('اتدفع من', 'Paid from') : L('اتحصّل في', 'Received into')}</span>
            {main.length === 0 && other.length === 0 ? (
              <p className="mt-1 text-xs text-rose-700" role="alert">{L('لا توجد خزينة أو حساب بنك في شجرة الحسابات', 'No cash or bank account set up')}</p>
            ) : (
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {main.map((s) => (
                  <button key={s.id} type="button" onClick={() => setPicked(s.id)} aria-pressed={src?.id === s.id} className={chip(src?.id === s.id)}>
                    {s.id === 'cash' ? <Wallet className="w-4 h-4 shrink-0 text-slate-500" /> : <Landmark className="w-4 h-4 shrink-0 text-slate-500" />}
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{s.id === 'cash' ? L('الخزينة (كاش)', 'Cash box') : s.label}</span>
                      {s.balance !== undefined && (
                        <span className="block text-xs text-slate-500">{L('الرصيد', 'Balance')} <bdi dir="ltr" className="tabular-nums">{money(s.balance)}</bdi></span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {other.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowOther(!showOther)} aria-expanded={showOther}
                  className="flex items-center gap-1 text-xs text-[#28376B] font-semibold">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOther ? 'rotate-180' : ''}`} />
                  {isExp ? L('دفعها شخص تاني أو آجل؟', 'Paid by someone else / on credit?') : L('استلمها شخص تاني أو آجل؟', 'Received by someone else / on credit?')}
                </button>
                {showOther && (
                  <select value={other.some((s) => s.id === picked) ? picked : ''} onChange={(e) => setPicked(e.target.value)} className={inputCls}>
                    <option value="">{L('— اختر —', '— choose —')}</option>
                    {other.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                )}
              </div>
            )}
            {cashShort && (
              <p className="mt-2 text-xs text-rose-700" role="alert">
                {L('رصيد الخزينة مش كفاية للمبلغ ده — اختار بنك، أو «دفعها شخص تاني» لو حد دفع من جيبه.',
                  'Not enough cash — pick a bank or another payer.')}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 cursor-pointer hover:bg-slate-50">
            <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="min-w-0 truncate text-slate-600">
              {file ? file.name : L('إرفاق فاتورة أو إيصال (اختياري)', 'Attach receipt (optional)')}
            </span>
            <input type="file" accept="image/*,application/pdf" className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {fileTooBig && <p className="text-xs text-rose-700" role="alert">{L('الملف أكبر من 10 ميجا', 'File is over 10 MB')}</p>}

          {account && src && (
            <p className="text-xs text-slate-400 leading-5">
              {L('يتسجل في الحسابات تلقائياً:', 'Posted automatically:')}{' '}
              {isExp
                ? `${L('حساب', 'account')} «${account.account_name}» — ${L('من', 'from')} «${src.label}»`
                : `${L('حساب', 'account')} «${account.account_name}» — ${L('في', 'into')} «${src.label}»`}
            </p>
          )}
          {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
