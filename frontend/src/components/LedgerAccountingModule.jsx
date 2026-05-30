import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Plus, Trash2, Printer, Download, FileSpreadsheet, BookOpen, Scale,
  X, Save, Loader2, AlertCircle, ChevronDown, ChevronRight, Eye, Mail, FileText,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const SUGGESTED_ACCOUNTS = [
  'النقدية', 'البنك', 'المخزون', 'العملاء', 'الموردون',
  'المبيعات', 'المشتريات', 'الإيرادات', 'المصروفات', 'الرواتب',
  'ضريبة القيمة المضافة', 'رأس المال',
];

const fmtEGP = (n) => Number(n || 0).toLocaleString('en-EG', { maximumFractionDigits: 2 });

const LedgerAccountingModule = ({ language: lang = 'ar', userRole, company }) => {
  const { language: ctxLang } = useLanguage();
  const language = lang || ctxLang;
  const isRTL = language === 'ar';
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('journal'); // journal | ledger | trial
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState([]);
  const [trial, setTrial] = useState(null);
  // Date filters (from, to)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sending, setSending] = useState(false);

  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات',
    'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي',
    'Board Chairman', 'رئيس مجلس الإدارة', 'Super Admin'].includes(userRole || user?.role);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const buildParams = () => {
    const params = {};
    if (dateFrom) params.start_date = dateFrom;
    if (dateTo) params.end_date = dateTo;
    return params;
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/journal-entries`, { headers: headers(), params: buildParams() });
      setEntries(res.data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await axios.get(`${API}/api/journal-entries/ledger`, { headers: headers(), params: buildParams() });
      setLedger(res.data || []);
    } catch { setLedger([]); }
  };

  const fetchTrial = async () => {
    try {
      const res = await axios.get(`${API}/api/journal-entries/trial-balance`, { headers: headers(), params: buildParams() });
      setTrial(res.data || null);
    } catch { setTrial(null); }
  };

  useEffect(() => {
    fetchEntries();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'ledger') fetchLedger();
    if (activeTab === 'trial') fetchTrial();
  }, [activeTab, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const td = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
    const tc = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);
    return { td, tc, count: entries.length };
  }, [entries]);

  // ----- Print invoice-style -----
  const printJournal = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = entries.map((e) => {
      const linesHtml = (e.lines || []).map((l) => `
        <tr>
          <td>${l.account}</td>
          <td>${l.description || '—'}</td>
          <td class="amt">${l.debit > 0 ? fmtEGP(l.debit) : '—'}</td>
          <td class="amt">${l.credit > 0 ? fmtEGP(l.credit) : '—'}</td>
        </tr>`).join('');
      return `
        <div class="entry">
          <div class="entry-header">
            <span><strong>${e.entry_number}</strong> · ${e.date}</span>
            <span>${e.reference ? `${language === 'ar' ? 'مرجع: ' : 'Ref: '}${e.reference}` : ''}</span>
          </div>
          <div class="desc">${e.description}</div>
          <table>
            <thead><tr>
              <th>${language === 'ar' ? 'الحساب' : 'Account'}</th>
              <th>${language === 'ar' ? 'البيان' : 'Description'}</th>
              <th>${language === 'ar' ? 'مدين' : 'Debit'}</th>
              <th>${language === 'ar' ? 'دائن' : 'Credit'}</th>
            </tr></thead>
            <tbody>${linesHtml}
              <tr class="totals">
                <td colspan="2">${language === 'ar' ? 'الإجمالي' : 'Total'}</td>
                <td class="amt">${fmtEGP(e.total_debit)}</td>
                <td class="amt">${fmtEGP(e.total_credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }).join('');

    const html = `
<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${language}">
<head><meta charset="UTF-8"><title>${language === 'ar' ? 'القيود اليومية' : 'Journal Entries'}</title>
<style>
  body { font-family: 'Noto Sans Arabic', Arial, sans-serif; padding: 24px; color: #1e293b; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #28376B; padding-bottom: 14px; margin-bottom: 24px; }
  .header h1 { margin: 0; color: #28376B; font-size: 22px; }
  .header .meta { font-size: 11px; color: #64748b; text-align: ${isRTL ? 'left' : 'right'}; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .stat h3 { margin: 0; font-size: 10px; color: #64748b; text-transform: uppercase; }
  .stat p { margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #28376B; }
  .entry { margin-bottom: 22px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .entry-header { display: flex; justify-content: space-between; background: #f1f5f9; padding: 8px 12px; font-size: 12px; }
  .desc { padding: 8px 12px; background: #fff; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #28376B; color: #fff; padding: 8px; font-size: 11px; text-align: ${isRTL ? 'right' : 'left'}; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  td.amt { text-align: ${isRTL ? 'left' : 'right'}; font-weight: 600; }
  .totals td { background: #ecfdf5; font-weight: 700; color: #065f46; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; }
  .sig { margin-top: 20px; padding: 20px 0; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-around; font-size: 12px; }
  .sig div { text-align: center; }
  .sig strong { display: block; margin-bottom: 30px; color: #475569; }
  @media print { body { padding: 12px; } .no-print { display: none; } }
</style></head>
<body>
  <div class="header">
    <div>
      <h1>${language === 'ar' ? 'دفتر القيود اليومية' : 'Journal Entries Book'}</h1>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">${company?.name || ''}</div>
    </div>
    <div class="meta">
      ${language === 'ar' ? 'تاريخ الطباعة' : 'Printed'}: ${new Date().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}<br/>
      ${language === 'ar' ? 'عدد القيود' : 'Entries'}: ${totals.count}
    </div>
  </div>

  <div class="summary">
    <div class="stat"><h3>${language === 'ar' ? 'عدد القيود' : 'Total Entries'}</h3><p>${totals.count}</p></div>
    <div class="stat"><h3>${language === 'ar' ? 'إجمالي المدين' : 'Total Debit'}</h3><p>${fmtEGP(totals.td)} EGP</p></div>
    <div class="stat"><h3>${language === 'ar' ? 'إجمالي الدائن' : 'Total Credit'}</h3><p>${fmtEGP(totals.tc)} EGP</p></div>
  </div>

  ${rows || '<p style="text-align:center;color:#94a3b8;">' + (language === 'ar' ? 'لا توجد قيود' : 'No entries') + '</p>'}

  <div class="sig">
    <div><strong>${language === 'ar' ? 'المحاسب' : 'Accountant'}</strong>____________________</div>
    <div><strong>${language === 'ar' ? 'مدير الحسابات' : 'Accounting Manager'}</strong>____________________</div>
    <div><strong>${language === 'ar' ? 'الإدارة' : 'Management'}</strong>____________________</div>
  </div>

  <div class="footer">
    <span>DataLife Account © ${new Date().getFullYear()}</span>
    <span>${language === 'ar' ? 'صفحة 1' : 'Page 1'}</span>
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const printTrial = () => {
    if (!trial) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = (trial.accounts || []).map((a) => `
      <tr>
        <td>${a.account}</td>
        <td class="amt">${a.debit_balance > 0 ? fmtEGP(a.debit_balance) : '—'}</td>
        <td class="amt">${a.credit_balance > 0 ? fmtEGP(a.credit_balance) : '—'}</td>
      </tr>`).join('');
    const html = `
<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${language}">
<head><meta charset="UTF-8"><title>${language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'}</title>
<style>
  body { font-family: 'Noto Sans Arabic', Arial, sans-serif; padding: 24px; color: #1e293b; }
  h1 { color: #28376B; border-bottom: 3px solid #28376B; padding-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #28376B; color: #fff; padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  td.amt { text-align: ${isRTL ? 'left' : 'right'}; font-weight: 600; }
  tfoot td { background: #ecfdf5; font-weight: 700; color: #065f46; font-size: 14px; }
  .ok { color: #059669; font-weight: bold; }
  .err { color: #dc2626; font-weight: bold; }
</style></head>
<body>
  <h1>${language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'}</h1>
  <p>${company?.name || ''} — ${new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</p>
  <table>
    <thead><tr>
      <th>${language === 'ar' ? 'الحساب' : 'Account'}</th>
      <th>${language === 'ar' ? 'رصيد مدين' : 'Debit Balance'}</th>
      <th>${language === 'ar' ? 'رصيد دائن' : 'Credit Balance'}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td>${language === 'ar' ? 'الإجمالي' : 'Total'}</td>
      <td class="amt">${fmtEGP(trial.totals.total_debit)} EGP</td>
      <td class="amt">${fmtEGP(trial.totals.total_credit)} EGP</td>
    </tr></tfoot>
  </table>
  <p style="margin-top:20px;" class="${trial.totals.is_balanced ? 'ok' : 'err'}">
    ${trial.totals.is_balanced
      ? (language === 'ar' ? '✓ ميزان المراجعة متوازن' : '✓ Trial Balance is balanced')
      : (language === 'ar' ? '✗ غير متوازن!' : '✗ Not balanced!')}
  </p>
  <script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // ----- New entry modal state -----
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { account: '', description: '', debit: 0, credit: 0 },
      { account: '', description: '', debit: 0, credit: 0 },
    ],
  });

  const resetNew = () => {
    setNewEntry({
      date: new Date().toISOString().split('T')[0],
      description: '', reference: '',
      lines: [
        { account: '', description: '', debit: 0, credit: 0 },
        { account: '', description: '', debit: 0, credit: 0 },
      ],
    });
  };

  const newTotals = useMemo(() => {
    const d = newEntry.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const c = newEntry.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    return { d, c, balanced: Math.round(d * 100) === Math.round(c * 100) && d > 0 };
  }, [newEntry.lines]);

  const saveEntry = async () => {
    if (!newEntry.description.trim()) {
      toast.error(language === 'ar' ? 'أدخل بياناً للقيد' : 'Description is required');
      return;
    }
    if (!newTotals.balanced) {
      toast.error(language === 'ar' ? 'القيد غير متوازن: المدين ≠ الدائن' : 'Entry not balanced');
      return;
    }
    try {
      await axios.post(`${API}/api/journal-entries`, newEntry, { headers: headers() });
      toast.success(language === 'ar' ? 'تم حفظ القيد' : 'Entry saved');
      setShowAdd(false);
      resetNew();
      fetchEntries();
    } catch (err) {
      toast.error(err.response?.data?.detail || (language === 'ar' ? 'فشل الحفظ' : 'Save failed'));
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm(language === 'ar' ? 'تأكيد حذف هذا القيد؟' : 'Delete this entry?')) return;
    try {
      await axios.delete(`${API}/api/journal-entries/${id}`, { headers: headers() });
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
      fetchEntries();
    } catch {
      toast.error(language === 'ar' ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const exportCSV = () => {
    const headers_csv = language === 'ar'
      ? ['رقم القيد', 'التاريخ', 'البيان', 'الحساب', 'مدين', 'دائن']
      : ['Entry #', 'Date', 'Description', 'Account', 'Debit', 'Credit'];
    const rows = [];
    entries.forEach((e) => {
      (e.lines || []).forEach((l) => {
        rows.push([e.entry_number, e.date, e.description, l.account, l.debit, l.credit]);
      });
    });
    const csv = [headers_csv, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `journal-entries-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(language === 'ar' ? 'تم التصدير' : 'Exported');
  };

  // ----- PDF Download (server-rendered via WeasyPrint) -----
  const downloadPdf = async (kind /* 'trial-balance' | 'ledger' */) => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('start_date', dateFrom);
      if (dateTo) params.append('end_date', dateTo);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await axios.get(
        `${API}/api/journal-entries/${kind}/pdf${qs}`,
        { headers: headers(), responseType: 'blob' },
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'ar' ? 'تم تنزيل PDF' : 'PDF downloaded');
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل تنزيل PDF' : 'PDF download failed');
    }
  };

  // ----- Send monthly report email -----
  const sendMonthlyEmail = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${API}/api/journal-entries/send-monthly-report`,
        {},
        { headers: headers() },
      );
      toast.success(
        language === 'ar'
          ? `تم إرسال التقرير الشهري إلى ${res.data?.recipient || ''}`
          : `Monthly report sent to ${res.data?.recipient || ''}`
      );
    } catch (err) {
      toast.error(err.response?.data?.detail
        || (language === 'ar' ? 'فشل إرسال الإيميل' : 'Email send failed'));
    } finally {
      setSending(false);
    }
  };

  // -------------- RENDER --------------
  const Tab = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === id
          ? 'bg-blue-600 text-white shadow'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
      }`}
      data-testid={`ledger-tab-${id}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'} data-testid="ledger-accounting-module">
      {/* Tabs + Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Tab id="journal" icon={BookOpen} label={language === 'ar' ? 'القيود اليومية' : 'Journal Entries'} />
          <Tab id="ledger"  icon={Eye}      label={language === 'ar' ? 'دفتر الأستاذ' : 'General Ledger'} />
          <Tab id="trial"   icon={Scale}    label={language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date filters — apply across all tabs */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 px-1">{language === 'ar' ? 'من' : 'From'}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs bg-transparent border-0 outline-none p-1 w-32"
              data-testid="ledger-date-from"
            />
            <span className="text-xs text-slate-500 px-1">{language === 'ar' ? 'إلى' : 'To'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs bg-transparent border-0 outline-none p-1 w-32"
              data-testid="ledger-date-to"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1 rounded"
                title={language === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}
                data-testid="ledger-date-clear"
              ><X className="h-3 w-3" /></button>
            )}
          </div>

          {activeTab === 'journal' && (
            <>
              <Button size="sm" variant="outline" onClick={exportCSV} data-testid="journal-export-csv"><FileSpreadsheet className="h-4 w-4 mr-1" />CSV</Button>
              <Button size="sm" variant="outline" onClick={printJournal} data-testid="journal-print"><Printer className="h-4 w-4 mr-1" />{language === 'ar' ? 'طباعة' : 'Print'}</Button>
              {canEdit && (
                <Button size="sm" onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="journal-new-entry-btn">
                  <Plus className="h-4 w-4 mr-1" />{language === 'ar' ? 'قيد جديد' : 'New Entry'}
                </Button>
              )}
            </>
          )}
          {activeTab === 'ledger' && (
            <>
              <Button size="sm" variant="outline" onClick={() => downloadPdf('ledger')} data-testid="ledger-pdf-btn"><FileText className="h-4 w-4 mr-1" />PDF</Button>
              <Button size="sm" variant="outline" onClick={sendMonthlyEmail} disabled={sending} data-testid="ledger-email-btn">
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                {language === 'ar' ? 'تقرير شهري' : 'Monthly Email'}
              </Button>
            </>
          )}
          {activeTab === 'trial' && (
            <>
              <Button size="sm" variant="outline" onClick={() => downloadPdf('trial-balance')} data-testid="trial-pdf-btn"><FileText className="h-4 w-4 mr-1" />PDF</Button>
              <Button size="sm" variant="outline" onClick={printTrial} data-testid="trial-print-btn"><Printer className="h-4 w-4 mr-1" />{language === 'ar' ? 'طباعة' : 'Print'}</Button>
              <Button size="sm" variant="outline" onClick={sendMonthlyEmail} disabled={sending} data-testid="trial-email-btn">
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                {language === 'ar' ? 'تقرير شهري' : 'Monthly Email'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* JOURNAL */}
      {activeTab === 'journal' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{language === 'ar' ? 'دفتر القيود اليومية' : 'Journal Entries Book'}</CardTitle>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-slate-500">{language === 'ar' ? 'العدد' : 'Count'}: <strong className="text-slate-800">{totals.count}</strong></span>
              <span className="text-emerald-600">{language === 'ar' ? 'إجمالي مدين' : 'Total Debit'}: <strong>{fmtEGP(totals.td)} EGP</strong></span>
              <span className="text-rose-600">{language === 'ar' ? 'إجمالي دائن' : 'Total Credit'}: <strong>{fmtEGP(totals.tc)} EGP</strong></span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" />{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <BookOpen className="h-10 w-10 mx-auto opacity-40 mb-2" />
                <p>{language === 'ar' ? 'لا توجد قيود بعد. ابدأ بإنشاء قيد جديد.' : 'No entries yet. Create a new journal entry.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => (
                  <details key={e.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" data-testid={`entry-${e.entry_number}`}>
                    <summary className="cursor-pointer px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 shrink-0" />
                        <span className="font-mono text-xs font-bold text-blue-600">{e.entry_number}</span>
                        <span className="text-xs text-slate-500">{e.date}</span>
                        <span className="text-sm text-slate-800 dark:text-slate-100 truncate">{e.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-semibold text-emerald-700">{fmtEGP(e.total_debit)} EGP</span>
                        {canEdit && (
                          <button onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); deleteEntry(e.id); }} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </summary>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-700/50 text-xs text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className={`p-2 ${isRTL ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الحساب' : 'Account'}</th>
                          <th className={`p-2 ${isRTL ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'البيان' : 'Description'}</th>
                          <th className={`p-2 ${isRTL ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'مدين' : 'Debit'}</th>
                          <th className={`p-2 ${isRTL ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'دائن' : 'Credit'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(e.lines || []).map((l, i) => (
                          <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                            <td className="p-2 font-medium">{l.account}</td>
                            <td className="p-2 text-slate-500">{l.description || '—'}</td>
                            <td className={`p-2 font-semibold ${isRTL ? 'text-left' : 'text-right'}`}>{l.debit > 0 ? fmtEGP(l.debit) : '—'}</td>
                            <td className={`p-2 font-semibold ${isRTL ? 'text-left' : 'text-right'}`}>{l.credit > 0 ? fmtEGP(l.credit) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LEDGER */}
      {activeTab === 'ledger' && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{language === 'ar' ? 'دفتر الأستاذ العام' : 'General Ledger'}</CardTitle></CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-center py-10 text-slate-500">{language === 'ar' ? 'لا توجد بيانات. أضف قيوداً أولاً.' : 'No data. Add journal entries first.'}</p>
            ) : (
              <div className="space-y-4">
                {ledger.map((acc) => (
                  <details key={acc.account} className="border rounded-lg overflow-hidden">
                    <summary className="cursor-pointer px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-between">
                      <span className="font-bold text-indigo-700 dark:text-indigo-200">{acc.account}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-emerald-700">D: <strong>{fmtEGP(acc.total_debit)}</strong></span>
                        <span className="text-rose-700">C: <strong>{fmtEGP(acc.total_credit)}</strong></span>
                        <span className="text-slate-700">Bal: <strong>{fmtEGP(acc.balance)}</strong></span>
                      </div>
                    </summary>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100"><tr>
                        <th className="p-2">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th className="p-2">{language === 'ar' ? 'القيد' : 'Entry'}</th>
                        <th className="p-2">{language === 'ar' ? 'البيان' : 'Description'}</th>
                        <th className="p-2">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                        <th className="p-2">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                        <th className="p-2">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                      </tr></thead>
                      <tbody>
                        {acc.transactions.map((tx, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{tx.date}</td>
                            <td className="p-2 font-mono text-blue-600">{tx.entry_number}</td>
                            <td className="p-2">{tx.line_description || tx.description}</td>
                            <td className="p-2 text-emerald-700 font-semibold">{tx.debit > 0 ? fmtEGP(tx.debit) : '—'}</td>
                            <td className="p-2 text-rose-700 font-semibold">{tx.credit > 0 ? fmtEGP(tx.credit) : '—'}</td>
                            <td className="p-2 font-bold">{fmtEGP(tx.running_balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TRIAL BALANCE */}
      {activeTab === 'trial' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-3">
              <Scale className="h-5 w-5 text-indigo-600" />
              {language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'}
              {trial?.totals?.is_balanced ? (
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{language === 'ar' ? 'متوازن ✓' : 'Balanced ✓'}</span>
              ) : trial && (
                <span className="ml-auto text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full">{language === 'ar' ? 'غير متوازن!' : 'Not balanced!'}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!trial || trial.accounts.length === 0 ? (
              <p className="text-center py-10 text-slate-500">{language === 'ar' ? 'لا توجد بيانات.' : 'No data.'}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-600 text-white">
                    <tr>
                      <th className={`p-3 ${isRTL ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الحساب' : 'Account'}</th>
                      <th className={`p-3 ${isRTL ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'رصيد مدين' : 'Debit Balance'}</th>
                      <th className={`p-3 ${isRTL ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'رصيد دائن' : 'Credit Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trial.accounts.map((a) => (
                      <tr key={a.account} className="hover:bg-indigo-50/30">
                        <td className="p-3 font-medium">{a.account}</td>
                        <td className={`p-3 font-bold text-emerald-700 ${isRTL ? 'text-left' : 'text-right'}`}>{a.debit_balance > 0 ? `${fmtEGP(a.debit_balance)} EGP` : '—'}</td>
                        <td className={`p-3 font-bold text-rose-700 ${isRTL ? 'text-left' : 'text-right'}`}>{a.credit_balance > 0 ? `${fmtEGP(a.credit_balance)} EGP` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50 border-t-2 border-emerald-300 font-bold">
                    <tr>
                      <td className={`p-3 ${isRTL ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'الإجمالي' : 'Total'}</td>
                      <td className={`p-3 text-emerald-800 ${isRTL ? 'text-left' : 'text-right'}`}>{fmtEGP(trial.totals.total_debit)} EGP</td>
                      <td className={`p-3 text-emerald-800 ${isRTL ? 'text-left' : 'text-right'}`}>{fmtEGP(trial.totals.total_credit)} EGP</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ADD ENTRY MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">{language === 'ar' ? 'قيد جديد' : 'New Journal Entry'}</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                  <input type="date" value={newEntry.date} onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })} className="w-full p-2 border rounded-md text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">{language === 'ar' ? 'البيان' : 'Description'}</label>
                  <input type="text" value={newEntry.description} onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })} className="w-full p-2 border rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">{language === 'ar' ? 'مرجع (اختياري)' : 'Reference (optional)'}</label>
                <input type="text" value={newEntry.reference} onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })} className="w-full p-2 border rounded-md text-sm" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium">{language === 'ar' ? 'بنود القيد' : 'Lines'}</span>
                  <button onClick={() => setNewEntry({ ...newEntry, lines: [...newEntry.lines, { account: '', description: '', debit: 0, credit: 0 }] })}
                    className="text-xs text-blue-600 hover:underline">+ {language === 'ar' ? 'إضافة بند' : 'Add line'}</button>
                </div>
                <div className="space-y-2">
                  {newEntry.lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        list={`accts-${i}`}
                        placeholder={language === 'ar' ? 'الحساب' : 'Account'}
                        value={l.account}
                        onChange={(e) => {
                          const ls = [...newEntry.lines]; ls[i] = { ...ls[i], account: e.target.value };
                          setNewEntry({ ...newEntry, lines: ls });
                        }}
                        className="col-span-3 p-2 border rounded-md text-sm"
                      />
                      <datalist id={`accts-${i}`}>
                        {SUGGESTED_ACCOUNTS.map((a) => <option key={a} value={a} />)}
                      </datalist>
                      <input
                        placeholder={language === 'ar' ? 'بيان' : 'Description'}
                        value={l.description}
                        onChange={(e) => { const ls = [...newEntry.lines]; ls[i] = { ...ls[i], description: e.target.value }; setNewEntry({ ...newEntry, lines: ls }); }}
                        className="col-span-4 p-2 border rounded-md text-sm"
                      />
                      <input
                        type="number" placeholder="Debit" min="0" step="0.01" value={l.debit || ''}
                        onChange={(e) => { const ls = [...newEntry.lines]; ls[i] = { ...ls[i], debit: Number(e.target.value) || 0, credit: 0 }; setNewEntry({ ...newEntry, lines: ls }); }}
                        className="col-span-2 p-2 border rounded-md text-sm"
                      />
                      <input
                        type="number" placeholder="Credit" min="0" step="0.01" value={l.credit || ''}
                        onChange={(e) => { const ls = [...newEntry.lines]; ls[i] = { ...ls[i], credit: Number(e.target.value) || 0, debit: 0 }; setNewEntry({ ...newEntry, lines: ls }); }}
                        className="col-span-2 p-2 border rounded-md text-sm"
                      />
                      <button onClick={() => { const ls = newEntry.lines.filter((_, idx) => idx !== i); setNewEntry({ ...newEntry, lines: ls.length ? ls : newEntry.lines }); }}
                        className="col-span-1 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-3 rounded-lg flex items-center justify-between ${newTotals.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />
                  {newTotals.balanced
                    ? (language === 'ar' ? 'القيد متوازن ✓' : 'Entry is balanced ✓')
                    : (language === 'ar' ? 'القيد غير متوازن — المدين والدائن يجب أن يتساويا' : 'Not balanced — debit must equal credit')}
                </div>
                <div className="text-xs">D: <strong>{fmtEGP(newTotals.d)}</strong> · C: <strong>{fmtEGP(newTotals.c)}</strong></div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={saveEntry} disabled={!newTotals.balanced} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-1" />{language === 'ar' ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerAccountingModule;
