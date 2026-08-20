import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Send, RefreshCw, History, Users, Filter, Mail, AlertTriangle, Gift, Wrench, Info } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const REASONS = [
  { id: 'general',     icon: <Info className="w-4 h-4" />,          label_ar: 'رسالة عامة',         label_en: 'General Message' },
  { id: 'update',      icon: <RefreshCw className="w-4 h-4" />,     label_ar: 'تحديث النظام',        label_en: 'System Update' },
  { id: 'warning',     icon: <AlertTriangle className="w-4 h-4" />, label_ar: 'تحذير / تنبيه',      label_en: 'Warning / Alert' },
  { id: 'offer',       icon: <Gift className="w-4 h-4" />,          label_ar: 'عرض خاص',            label_en: 'Special Offer' },
  { id: 'maintenance', icon: <Wrench className="w-4 h-4" />,        label_ar: 'صيانة مجدولة',       label_en: 'Scheduled Maintenance' },
];

const SCOPES = [
  { id: 'all',     label_ar: 'كل الشركات',         label_en: 'All Companies' },
  { id: 'trial',   label_ar: 'الاشتراكات التجريبية', label_en: 'Trial Companies' },
  { id: 'plan',    label_ar: 'خطة معينة',           label_en: 'Specific Plan' },
  { id: 'partial', label_ar: 'شركات محددة',         label_en: 'Selected Companies' },
];

export default function OutreachPanel() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [tab, setTab]           = useState('compose');
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [logs, setLogs]         = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [form, setForm] = useState({
    scope: 'all', plan_filter: 'professional', reason: 'general',
    subject_ar: '', subject_en: '', body_ar: '', body_en: '',
    send_ar: true, send_en: false,
  });

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/outreach/logs`, { headers });
      if (r.ok) setLogs(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/companies`, { headers });
      if (r.ok) setCompanies(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchLogs(); fetchCompanies(); }, [fetchLogs, fetchCompanies]);

  const send = async () => {
    if (!form.subject_ar && !form.subject_en) { toast.error(ar ? 'أدخل الموضوع' : 'Enter subject'); return; }
    if (!form.body_ar && !form.body_en)       { toast.error(ar ? 'أدخل نص الرسالة' : 'Enter message body'); return; }
    setSending(true);
    try {
      const payload = { ...form };
      if (form.scope === 'partial') payload.company_ids = selectedCompanies;
      const r = await fetch(`${API}/api/admin/outreach/send`, {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success(ar ? `✅ تم الإرسال لـ ${d.sent} شركة` : `✅ Sent to ${d.sent} companies`);
        if (d.failed > 0) toast.error(ar ? `فشل الإرسال لـ ${d.failed} شركة` : `Failed for ${d.failed}`);
        setTab('history');
        fetchLogs();
      } else {
        toast.error(d.detail || 'Error');
      }
    } catch { toast.error('Error'); }
    setSending(false);
  };

  const reasonInfo = REASONS.find(r => r.id === form.reason);
  const scopeInfo  = SCOPES.find(s => s.id === form.scope);

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#4a1942] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">{ar ? 'مراسلات العملاء' : 'Client Outreach'}</h2>
            <p className="text-pink-200 text-xs">{ar ? 'إرسال رسائل جماعية أو مخصصة للشركات' : 'Send bulk or targeted messages to companies'}</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[['compose', ar?'إنشاء رسالة':'Compose'], ['history', ar?'سجل الإرسال':'History']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===id?'bg-white text-[#0f1729]':'bg-white/10 hover:bg-white/20'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* COMPOSE TAB */}
      {tab === 'compose' && (
        <div className="space-y-4">
          {/* Scope + Reason row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scope */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#28376B]" /> {ar ? 'نطاق الإرسال' : 'Send To'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SCOPES.map(s => (
                  <button key={s.id} onClick={() => setForm(f => ({ ...f, scope: s.id }))}
                    className={`p-3 rounded-xl text-sm font-semibold text-center border-2 transition-all ${form.scope===s.id?'border-[#28376B] bg-[#28376B]/5 text-[#28376B]':'border-gray-100 text-gray-600 hover:border-gray-300'}`}>
                    {ar ? s.label_ar : s.label_en}
                  </button>
                ))}
              </div>

              {form.scope === 'plan' && (
                <select value={form.plan_filter} onChange={e => setForm(f => ({ ...f, plan_filter: e.target.value }))}
                  className="w-full mt-3 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {['starter','professional','enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}

              {form.scope === 'partial' && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                  {companies.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedCompanies.includes(c.id)}
                        onChange={e => setSelectedCompanies(prev => e.target.checked ? [...prev,c.id] : prev.filter(id=>id!==c.id))}
                        className="rounded" />
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#28376B]" /> {ar ? 'سبب المراسلة' : 'Message Reason'}
              </label>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <button key={r.id} onClick={() => setForm(f => ({ ...f, reason: r.id }))}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm border-2 transition-all ${form.reason===r.id?'border-[#28376B] bg-[#28376B]/5 text-[#28376B] font-semibold':'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                    {r.icon}
                    {ar ? r.label_ar : r.label_en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <label className="text-sm font-bold text-gray-700">{ar ? 'موضوع الرسالة' : 'Subject'}</label>
            <input value={form.subject_ar} onChange={e => setForm(f=>({...f,subject_ar:e.target.value}))}
              dir="rtl" placeholder={ar ? 'الموضوع بالعربي *' : 'Arabic Subject *'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            <input value={form.subject_en} onChange={e => setForm(f=>({...f,subject_en:e.target.value}))}
              dir="ltr" placeholder="English Subject (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Body */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <label className="text-sm font-bold text-gray-700">{ar ? 'نص الرسالة' : 'Message Body'}</label>
            <textarea value={form.body_ar} onChange={e => setForm(f=>({...f,body_ar:e.target.value}))}
              rows={5} dir="rtl" placeholder={ar ? 'نص الرسالة بالعربي *' : 'Arabic message *'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none font-[Cairo]" />
            <textarea value={form.body_en} onChange={e => setForm(f=>({...f,body_en:e.target.value}))}
              rows={4} dir="ltr" placeholder="English message (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          {/* Send button */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-sm text-gray-500">
              <span className="font-semibold">{ar ? 'سيُرسل إلى:' : 'Will send to:'} </span>
              <span className="text-[#28376B] font-bold">{ar ? scopeInfo?.label_ar : scopeInfo?.label_en}</span>
              {form.scope==='partial' && <span className="text-gray-400"> ({selectedCompanies.length} {ar?'شركة':'companies'})</span>}
              <span className="mx-2 text-gray-300">·</span>
              <span>{ar ? reasonInfo?.label_ar : reasonInfo?.label_en}</span>
            </div>
            <button onClick={send} disabled={sending}
              className="flex items-center gap-2 bg-[#28376B] hover:bg-[#0f1729] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
              <Send className="w-4 h-4" />
              {sending ? (ar?'جاري الإرسال...':'Sending...') : (ar?'إرسال الرسالة':'Send Message')}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="space-y-3">
          {loading && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>}
          {!loading && logs.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">{ar ? 'لا توجد رسائل مرسلة بعد' : 'No messages sent yet'}</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-sm">{log.subject_ar || log.subject_en}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    log.reason==='warning'?'bg-red-100 text-red-600':
                    log.reason==='offer'?'bg-amber-100 text-amber-600':
                    log.reason==='update'?'bg-blue-100 text-blue-600':
                    'bg-gray-100 text-gray-600'}`}>
                    {REASONS.find(r=>r.id===log.reason)?.[ar?'label_ar':'label_en'] || log.reason}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(log.created_at).toLocaleString(ar?'ar-EG':'en-US')} ·
                  {ar ? ` نطاق: ${log.scope}` : ` Scope: ${log.scope}`}
                </p>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-emerald-600">{log.sent_count}</div>
                <div className="text-xs text-gray-400">{ar?'أُرسل':'sent'}</div>
              </div>
              {log.failed > 0 && (
                <div className="text-center">
                  <div className="text-lg font-black text-red-500">{log.failed}</div>
                  <div className="text-xs text-gray-400">{ar?'فشل':'failed'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
