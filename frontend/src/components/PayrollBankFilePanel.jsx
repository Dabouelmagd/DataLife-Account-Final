import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api/payroll';
const getToken = () => localStorage.getItem('token');

const METHODS = [
  { id: 'bank_transfer', ar: 'تحويل بنكي', en: 'Bank transfer' },
  { id: 'instapay', ar: 'InstaPay', en: 'InstaPay' },
  { id: 'vodafone_cash', ar: 'فودافون كاش', en: 'Vodafone Cash' },
];

const FALLBACK_FORMATS = [
  { id: 'generic', label_ar: 'عام (CSV قابل للتحويل لأي بنك)', label_en: 'Generic',
    methods: ['bank_transfer', 'instapay', 'vodafone_cash'], requires_debit_account: false },
];

/**
 * Salary transfer files for one approved run: payment method, bank layout
 * (generic, CIB, NBE, Banque Misr, QNB, InstaPay bulk, Vodafone Cash bulk),
 * CSV or XLSX, plus the company's bank-file settings (debit account, bank
 * code, value date). The bank layouts follow common bulk-upload templates;
 * they are not any bank's official specification and must be checked
 * against the template the company's bank provides.
 */
export default function PayrollBankFilePanel({ runId, month, summary, language }) {
  const ar = language === 'ar';
  const [formats, setFormats] = useState(FALLBACK_FORMATS);
  const [disclaimer, setDisclaimer] = useState('');
  const [settings, setSettings] = useState({ debit_account_number: '', bank_code: '', value_date: '', default_format: 'generic' });
  const [canEdit, setCanEdit] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = METHODS.filter(m => (summary?.[m.id]?.count || 0) > 0);
  const [method, setMethod] = useState('');
  const [bank, setBank] = useState('generic');
  const [fileType, setFileType] = useState('csv');
  const [valueDate, setValueDate] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/bank-file-settings`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) { setCanEdit(false); return; }
      const d = await r.json();
      setFormats(d.formats?.length ? d.formats : FALLBACK_FORMATS);
      setDisclaimer(d.disclaimer || '');
      if (d.settings) {
        setSettings(s => ({ ...s, ...d.settings }));
        if (d.settings.default_format) setBank(d.settings.default_format);
      }
    } catch (e) {
      setCanEdit(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeMethod = method || available[0]?.id || 'bank_transfer';
  const methodFormats = formats.filter(f => (f.methods || []).includes(activeMethod));
  const activeBank = methodFormats.some(f => f.id === bank) ? bank : 'generic';
  const activeFormat = formats.find(f => f.id === activeBank);

  const download = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ method: activeMethod, bank: activeBank, file_type: fileType });
      if (valueDate) q.set('value_date', valueDate);
      const r = await fetch(`${API}/runs/${runId}/export/bank-file?${q.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        const d = data.detail;
        toast.error(d && typeof d === 'object' ? [d.message, ...(d.errors || []).slice(0, 5)].join('\n') : (d || 'Error'));
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = activeBank === 'generic' ? `salary_${activeMethod}_${month || ''}` : `salary_${activeBank}_${month || ''}`;
      a.href = url; a.download = `${name}.${fileType}`; a.click();
      URL.revokeObjectURL(url);
      const total = Number(r.headers.get('X-Transfer-Total') || 0);
      toast.success(`${r.headers.get('X-Transfer-Count') || ''} ${ar ? 'تحويل بإجمالي' : 'transfers, total'} ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP`);
    } catch (e) {
      toast.error(ar ? 'تعذّر تحميل الملف' : 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/bank-file-settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.detail || 'Error'); return; }
      setSettings(s => ({ ...s, ...(d.settings || {}) }));
      toast.success(d.message || (ar ? 'تم الحفظ' : 'Saved'));
      setShowSettings(false);
    } catch (e) {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  if (!available.length) return null;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bf-method" className="block text-xs text-gray-600 mb-1">{ar ? 'طريقة الصرف' : 'Payment method'}</label>
          <select id="bf-method" value={activeMethod} onChange={e => setMethod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {available.map(m => <option key={m.id} value={m.id}>{ar ? m.ar : m.en} ({summary?.[m.id]?.count || 0})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bf-bank" className="block text-xs text-gray-600 mb-1">{ar ? 'صيغة الملف' : 'File layout'}</label>
          <select id="bf-bank" value={activeBank} onChange={e => setBank(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            {methodFormats.map(f => <option key={f.id} value={f.id}>{ar ? f.label_ar : f.label_en}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bf-type" className="block text-xs text-gray-600 mb-1">{ar ? 'النوع' : 'Type'}</label>
          <select id="bf-type" value={fileType} onChange={e => setFileType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
        </div>
        <div>
          <label htmlFor="bf-vd" className="block text-xs text-gray-600 mb-1">{ar ? 'تاريخ القيمة (اختياري)' : 'Value date (optional)'}</label>
          <input id="bf-vd" type="date" value={valueDate} onChange={e => setValueDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
        </div>
        <button type="button" onClick={download} disabled={busy}
          className="text-sm bg-[#28376B] hover:bg-[#1f2b55] disabled:opacity-60 text-white px-4 py-1.5 rounded-lg font-medium">
          {busy ? (ar ? 'جاري التصدير…' : 'Exporting…') : (ar ? 'تنزيل ملف التحويل' : 'Download transfer file')}
        </button>
        {canEdit && (
          <button type="button" onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}
            className="text-sm border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-gray-700">
            {ar ? 'إعدادات ملف البنك' : 'Bank file settings'}
          </button>
        )}
      </div>

      {activeBank !== 'generic' && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          {disclaimer || (ar
            ? 'هذه الصيغة مبنية على النموذج الشائع لملفات الرواتب المجمّعة، وليست النموذج الرسمي للبنك — راجِعها مع النموذج الذي يسلّمه بنك الشركة قبل أول رفع.'
            : 'This layout follows a common bulk salary template, not the bank\'s official specification — check it against the template your bank provides before the first upload.')}
          {activeFormat?.requires_debit_account && !settings.debit_account_number && (
            <span className="block mt-1 font-medium">{ar ? 'سجّل رقم حساب الخصم في إعدادات ملف البنك أولاً.' : 'Set the company debit account in bank file settings first.'}</span>
          )}
        </p>
      )}

      {showSettings && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
          <div>
            <label htmlFor="bfs-acct" className="block text-xs text-gray-600 mb-1">{ar ? 'رقم حساب الخصم للشركة (أو IBAN)' : 'Company debit account (or IBAN)'}</label>
            <input id="bfs-acct" dir="ltr" value={settings.debit_account_number || ''}
              onChange={e => setSettings({ ...settings, debit_account_number: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
          </div>
          <div>
            <label htmlFor="bfs-code" className="block text-xs text-gray-600 mb-1">{ar ? 'كود البنك / الفرع / كود الشركة لدى البنك' : 'Bank / branch / corporate code'}</label>
            <input id="bfs-code" dir="ltr" value={settings.bank_code || ''}
              onChange={e => setSettings({ ...settings, bank_code: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
          </div>
          <div>
            <label htmlFor="bfs-vd" className="block text-xs text-gray-600 mb-1">{ar ? 'تاريخ القيمة الافتراضي (فارغ = اليوم)' : 'Default value date (empty = today)'}</label>
            <input id="bfs-vd" type="date" value={settings.value_date || ''}
              onChange={e => setSettings({ ...settings, value_date: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1" />
          </div>
          <div>
            <label htmlFor="bfs-fmt" className="block text-xs text-gray-600 mb-1">{ar ? 'الصيغة الافتراضية' : 'Default layout'}</label>
            <select id="bfs-fmt" value={settings.default_format || 'generic'}
              onChange={e => setSettings({ ...settings, default_format: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5">
              {formats.map(f => <option key={f.id} value={f.id}>{ar ? f.label_ar : f.label_en}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" onClick={save} disabled={saving}
              className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg font-medium">
              {saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ الإعدادات' : 'Save settings')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
