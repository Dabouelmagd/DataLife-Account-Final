/**
 * NewsletterPanel — نظام النشرة الإخبارية والإيميلات الدورية
 * Super Admin يرسل حملات بريدية للعملاء
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Mail, Plus, Send, Eye, Copy, Trash2, RefreshCw,
  Clock, CheckCircle, XCircle, Users, BarChart3,
  FileText, Loader2, ChevronDown, Play, Pause,
  Calendar, Repeat, X, AlertCircle, Edit2
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const TARGETS = [
  { id: 'all',                label_ar: 'كل الشركات',            label_en: 'All Companies',      icon: '🏢' },
  { id: 'active',             label_ar: 'الشركات النشطة فقط',    label_en: 'Active Companies',    icon: '✅' },
  { id: 'trial',              label_ar: 'الحسابات التجريبية',     label_en: 'Trial Accounts',      icon: '🔍' },
  { id: 'plan:starter',       label_ar: 'خطة المبتدئ',            label_en: 'Starter Plan',        icon: '🚀' },
  { id: 'plan:professional',  label_ar: 'خطة المحترف',            label_en: 'Professional Plan',   icon: '⭐' },
  { id: 'plan:enterprise',    label_ar: 'خطة المؤسسي',            label_en: 'Enterprise Plan',     icon: '👑' },
];

const RECURRENCE = [
  { id: null,        label_ar: 'مرة واحدة فقط',    label_en: 'One time only' },
  { id: 'weekly',    label_ar: 'أسبوعياً',          label_en: 'Weekly' },
  { id: 'monthly',   label_ar: 'شهرياً',            label_en: 'Monthly' },
  { id: 'quarterly', label_ar: 'كل 3 أشهر',        label_en: 'Quarterly' },
];

const HTML_TEMPLATES = {
  welcome: (company='اسم الشركة') => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;direction:rtl;">
  <div style="background:linear-gradient(135deg,#0F1729,#28376B);color:white;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">🎉</div>
    <h1 style="margin:0;font-size:24px;">مرحباً بكم في DataLife Account</h1>
    <p style="opacity:0.8;margin-top:8px;">نظام ERP المصري الأحدث والأكثر تطوراً</p>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;">
    <p>عزيزنا <strong>${company}</strong>،</p>
    <p>يسعدنا انضمامكم إلى عائلة DataLife Account. نظامنا مصمم خصيصاً للشركات المصرية ويتوافق مع:</p>
    <ul style="color:#374151;line-height:2;">
      <li>✅ قانون التأمينات الاجتماعية 148/2019</li>
      <li>✅ 108 حساب وفق الدليل المحاسبي المصري المعياري</li>
      <li>✅ الفاتورة الإلكترونية (ETA)</li>
      <li>✅ تسجيل الحضور بالـ GPS</li>
    </ul>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://datalifeaccount.com/dashboard" style="background:#28376B;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">ابدأ الآن</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-radius:0 0 16px 16px;">
    DataLife Account | datalifeaccount.com | info@datalifeai.com
  </div>
</div>`,

  feature_update: (company='اسم الشركة') => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;direction:rtl;">
  <div style="background:linear-gradient(135deg,#1e3a8a,#7c3aed);color:white;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">🚀</div>
    <h1 style="margin:0;font-size:22px;">تحديثات جديدة في DataLife Account</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;">
    <p>عزيزنا <strong>${company}</strong>،</p>
    <p>يسعدنا إعلامكم بأحدث التحديثات التي تم إضافتها لتحسين تجربتكم:</p>
    <div style="background:#f0f9ff;border-right:4px solid #0ea5e9;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-weight:bold;color:#0c4a6e;">✨ المميزات الجديدة</p>
      <ul style="color:#374151;line-height:2;margin-top:8px;">
        <li>🆕 مميزة 1</li>
        <li>🆕 مميزة 2</li>
        <li>🆕 مميزة 3</li>
      </ul>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://datalifeaccount.com/dashboard" style="background:#1e3a8a;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">جرب الآن</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-radius:0 0 16px 16px;">DataLife Account | datalifeaccount.com</div>
</div>`,

  renewal_reminder: (company='اسم الشركة') => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;direction:rtl;">
  <div style="background:linear-gradient(135deg,#92400e,#d97706);color:white;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">⏰</div>
    <h1 style="margin:0;font-size:22px;">تذكير: تجديد الاشتراك</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;">
    <p>عزيزنا <strong>${company}</strong>،</p>
    <p>نود تذكيركم بأن اشتراككم في DataLife Account سينتهي قريباً.</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-weight:bold;color:#92400e;">🔔 جددوا الآن واستمروا بدون انقطاع</p>
    </div>
    <p>للتجديد أو للاستفسار، تواصلوا معنا:</p>
    <p>📧 info@datalifeai.com</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://datalifeaccount.com" style="background:#d97706;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">جدد الاشتراك</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-radius:0 0 16px 16px;">DataLife Account | datalifeaccount.com</div>
</div>`,

  monthly_tips: (company='اسم الشركة') => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;direction:rtl;">
  <div style="background:linear-gradient(135deg,#065f46,#059669);color:white;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">💡</div>
    <h1 style="margin:0;font-size:22px;">نصائح شهرية — DataLife Account</h1>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;">
    <p>عزيزنا <strong>${company}</strong>،</p>
    <p>إليكم أهم النصائح لهذا الشهر:</p>
    <div style="margin:16px 0;">
      <div style="background:#f0fdf4;border-right:4px solid #22c55e;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
        <p style="margin:0;font-weight:bold;">💰 نصيحة مالية</p>
        <p style="margin:4px 0 0;font-size:14px;color:#374151;">اضيفوا النصيحة هنا</p>
      </div>
      <div style="background:#f0f9ff;border-right:4px solid #0ea5e9;padding:12px 16px;border-radius:8px;margin-bottom:12px;">
        <p style="margin:0;font-weight:bold;">👥 نصيحة HR</p>
        <p style="margin:4px 0 0;font-size:14px;color:#374151;">اضيفوا النصيحة هنا</p>
      </div>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-radius:0 0 16px 16px;">DataLife Account | datalifeaccount.com</div>
</div>`,
};

const STATUS_CONFIG = {
  draft:     { label_ar: 'مسودة',    label_en: 'Draft',     color: 'bg-gray-100 text-gray-600',    icon: FileText },
  scheduled: { label_ar: 'مجدول',   label_en: 'Scheduled', color: 'bg-blue-100 text-blue-700',    icon: Clock },
  sending:   { label_ar: 'يرسل...',  label_en: 'Sending',   color: 'bg-yellow-100 text-yellow-700',icon: Loader2 },
  sent:      { label_ar: 'تم الإرسال', label_en: 'Sent',    color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  paused:    { label_ar: 'موقوف',    label_en: 'Paused',    color: 'bg-orange-100 text-orange-700', icon: Pause },
};

export default function NewsletterPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [campaigns, setCampaigns]       = useState([]);
  const [templates, setTemplates]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(null);
  const [view, setView]                 = useState('list'); // list | create | preview
  const [selected, setSelected]         = useState(null);
  const [recipientCount, setRecipientCount] = useState(null);
  const [msg, setMsg]                   = useState(null);

  const [form, setForm] = useState({
    title: '',
    subject: '',
    html_content: '',
    from_name: 'DataLife Account',
    from_email: 'noreply@datalifeaccount.com',
    target: 'all',
    type: 'one_time',
    recurrence: null,
    schedule_at: '',
    send_now: false,
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, tplRes] = await Promise.all([
        fetch(`${API}/api/newsletter/campaigns`, { headers }),
        fetch(`${API}/api/newsletter/templates`, { headers }),
      ]);
      if (campRes.ok) setCampaigns((await campRes.json()).campaigns || []);
      if (tplRes.ok) setTemplates((await tplRes.json()).templates || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const previewRecipients = async (target) => {
    try {
      const res = await fetch(`${API}/api/newsletter/preview-recipients?target=${target}`, { headers });
      if (res.ok) setRecipientCount(await res.json());
    } catch {}
  };

  useEffect(() => {
    previewRecipients(form.target);
  }, [form.target]);

  const applyTemplate = (tplId) => {
    const fn = HTML_TEMPLATES[tplId];
    if (fn) setForm(f => ({ ...f, html_content: fn() }));
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) setForm(f => ({ ...f, subject: tpl.subject_ar || '' }));
  };

  const saveCampaign = async (sendNow = false) => {
    if (!form.title || !form.subject || !form.html_content) {
      setMsg({ type: 'error', text: ar ? 'العنوان والموضوع والمحتوى مطلوبون' : 'Title, subject, and content required' });
      return;
    }
    setSending('saving');
    try {
      const res = await fetch(`${API}/api/newsletter/campaigns`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...form, send_now: sendNow }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: sendNow ? (ar ? '✅ جاري الإرسال في الخلفية...' : '✅ Sending in background...') : (ar ? '✅ تم حفظ الحملة كمسودة' : '✅ Campaign saved as draft') });
        setView('list');
        setForm({ title: '', subject: '', html_content: '', from_name: 'DataLife Account', from_email: 'noreply@datalifeaccount.com', target: 'all', type: 'one_time', recurrence: null, schedule_at: '', send_now: false });
        fetchData();
      } else {
        setMsg({ type: 'error', text: data.detail || 'Error' });
      }
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSending(null);
    setTimeout(() => setMsg(null), 6000);
  };

  const sendCampaign = async (campaignId) => {
    setSending(campaignId);
    try {
      const res = await fetch(`${API}/api/newsletter/campaigns/${campaignId}/send`, {
        method: 'POST', headers
      });
      if (res.ok) {
        setMsg({ type: 'success', text: ar ? '✅ جاري الإرسال...' : '✅ Sending...' });
        fetchData();
      }
    } catch {}
    setSending(null);
    setTimeout(() => setMsg(null), 4000);
  };

  const duplicateCampaign = async (campaignId) => {
    await fetch(`${API}/api/newsletter/campaigns/${campaignId}/duplicate`, { method: 'POST', headers });
    fetchData();
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm(ar ? 'حذف هذه الحملة؟' : 'Delete this campaign?')) return;
    await fetch(`${API}/api/newsletter/campaigns/${campaignId}`, { method: 'DELETE', headers });
    fetchData();
  };

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    totalSent: campaigns.reduce((a, c) => a + (c.sent_count || 0), 0),
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0c1445] to-[#1e3a8a] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'النشرة الإخبارية والحملات البريدية' : 'Newsletter & Email Campaigns'}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{ar ? 'أرسل نشرات دورية لعملائك مباشرة من الداشبورد' : 'Send periodic newsletters to your clients directly from the dashboard'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView(view === 'create' ? 'list' : 'create')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1e3a8a] rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {ar ? 'حملة جديدة' : 'New Campaign'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: ar ? 'إجمالي الحملات' : 'Total',   value: stats.total,     color: 'text-white' },
            { label: ar ? 'تم الإرسال' : 'Sent',        value: stats.sent,      color: 'text-green-300' },
            { label: ar ? 'مسودات' : 'Drafts',          value: stats.draft,     color: 'text-yellow-300' },
            { label: ar ? 'إجمالي المرسلة' : 'Emails Sent', value: stats.totalSent.toLocaleString(), color: 'text-blue-200' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* ── CREATE FORM ── */}
      {view === 'create' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">{ar ? '✉️ إنشاء حملة بريدية جديدة' : '✉️ Create New Email Campaign'}</h3>
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          {/* Quick templates */}
          <Card className="border-blue-100">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">{ar ? '🎨 ابدأ من قالب جاهز' : '🎨 Start from a template'}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
                    className="p-2.5 text-right border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-sm">
                    <p className="font-medium text-gray-800">{ar ? tpl.name_ar : tpl.name_en}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tpl.preview}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'عنوان الحملة (داخلي) *' : 'Campaign Title (internal) *'}</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={ar ? 'مثال: نشرة أكتوبر 2026' : 'e.g. October 2026 Newsletter'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'موضوع الإيميل *' : 'Email Subject *'}</label>
                <input type="text" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder={ar ? 'موضوع الإيميل الذي يراه العميل' : 'Subject line visible to client'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'اسم المرسل' : 'Sender Name'}</label>
                <input type="text" value={form.from_name}
                  onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
              </div>

              {/* Target */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'المستهدفون' : 'Target Audience'}</label>
                <div className="space-y-1.5">
                  {TARGETS.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, target: t.id }))}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${form.target === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span>{t.icon}</span>
                      <span className="flex-1 text-right font-medium">{ar ? t.label_ar : t.label_en}</span>
                      {form.target === t.id && recipientCount && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                          {recipientCount.count} {ar ? 'شركة' : 'companies'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'التكرار' : 'Recurrence'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {RECURRENCE.map(r => (
                    <button key={r.id || 'once'} onClick={() => setForm(f => ({ ...f, recurrence: r.id }))}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${form.recurrence === r.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                      {r.id ? <Repeat className="w-3 h-3 inline ml-1" /> : <Play className="w-3 h-3 inline ml-1" />}
                      {ar ? r.label_ar : r.label_en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              {form.recurrence === null && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'وقت الإرسال (اختياري)' : 'Schedule Time (optional)'}</label>
                  <input type="datetime-local" value={form.schedule_at}
                    onChange={e => setForm(f => ({ ...f, schedule_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                </div>
              )}
            </div>

            {/* Right column — HTML editor */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'محتوى الإيميل (HTML) *' : 'Email Content (HTML) *'}</label>
              <textarea
                value={form.html_content}
                onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))}
                placeholder={ar ? 'اكتب HTML هنا أو اختر قالباً من الأعلى...' : 'Write HTML here or pick a template above...'}
                className="w-full h-72 px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                {ar ? 'يمكن استخدام: {{company_name}}، {{email}}' : 'Available variables: {{company_name}}, {{email}}'}
              </p>

              {/* HTML Preview */}
              {form.html_content && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">{ar ? '👁️ معاينة' : '👁️ Preview'}</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden h-48 overflow-y-auto bg-white">
                    <iframe
                      srcDoc={form.html_content}
                      title="preview"
                      className="w-full h-full"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recipients preview */}
          {recipientCount && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-800">
                  {ar ? `سيصل إلى ${recipientCount.count} شركة` : `Will reach ${recipientCount.count} companies`}
                </span>
              </div>
              {recipientCount.sample?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipientCount.sample.slice(0, 5).map((c, i) => (
                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{c.name}</span>
                  ))}
                  {recipientCount.count > 5 && (
                    <span className="text-xs text-blue-500">+{recipientCount.count - 5} {ar ? 'أخرى' : 'more'}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => saveCampaign(true)} disabled={!!sending}
              className="flex-1 py-3 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {sending === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {ar ? `إرسال الآن إلى ${recipientCount?.count || '...'} شركة` : `Send Now to ${recipientCount?.count || '...'} companies`}
            </button>
            <button onClick={() => saveCampaign(false)} disabled={!!sending}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-60">
              <FileText className="w-4 h-4" />
              {ar ? 'حفظ كمسودة' : 'Save Draft'}
            </button>
          </div>
        </div>
      )}

      {/* ── CAMPAIGNS LIST ── */}
      {view === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Mail className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-lg">{ar ? 'لا توجد حملات بعد' : 'No campaigns yet'}</p>
              <p className="text-sm mt-1">{ar ? 'اضغط "حملة جديدة" لإنشاء أول نشرة' : 'Click "New Campaign" to create your first newsletter'}</p>
            </div>
          ) : campaigns.map(camp => {
            const statusCfg = STATUS_CONFIG[camp.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusCfg.icon;
            const target = TARGETS.find(t => t.id === camp.target);

            return (
              <Card key={camp.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{camp.title}</span>
                        <Badge className={`text-xs ${statusCfg.color}`}>
                          <StatusIcon className={`w-3 h-3 inline ml-1 ${camp.status === 'sending' ? 'animate-spin' : ''}`} />
                          {ar ? statusCfg.label_ar : statusCfg.label_en}
                        </Badge>
                        {camp.recurrence && (
                          <Badge className="text-xs bg-purple-100 text-purple-700">
                            <Repeat className="w-3 h-3 inline ml-1" />
                            {ar ? (camp.recurrence === 'weekly' ? 'أسبوعي' : camp.recurrence === 'monthly' ? 'شهري' : 'ربع سنوي') : camp.recurrence}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">📧 {camp.subject}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>{target?.icon} {ar ? target?.label_ar : target?.label_en}</span>
                        {camp.sent_count > 0 && (
                          <span className="text-green-600">✅ {camp.sent_count} {ar ? 'تم الإرسال' : 'sent'}</span>
                        )}
                        {camp.failed_count > 0 && (
                          <span className="text-red-500">❌ {camp.failed_count} {ar ? 'فشل' : 'failed'}</span>
                        )}
                        {camp.sent_at && (
                          <span>📅 {new Date(camp.sent_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>
                        )}
                        {camp.created_at && (
                          <span>{ar ? 'أنشئت:' : 'Created:'} {new Date(camp.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {camp.status === 'draft' && (
                        <button onClick={() => sendCampaign(camp.id)} disabled={sending === camp.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
                          {sending === camp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          {ar ? 'إرسال' : 'Send'}
                        </button>
                      )}
                      <button onClick={() => duplicateCampaign(camp.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={ar ? 'تكرار' : 'Duplicate'}>
                        <Copy className="w-4 h-4" />
                      </button>
                      {camp.status === 'draft' && (
                        <button onClick={() => deleteCampaign(camp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={ar ? 'حذف' : 'Delete'}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar for sending */}
                  {camp.status === 'sent' && camp.total_recipients > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.round(camp.sent_count / camp.total_recipients * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(camp.sent_count / camp.total_recipients * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {camp.sent_count}/{camp.total_recipients} {ar ? 'إيميل' : 'emails'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
