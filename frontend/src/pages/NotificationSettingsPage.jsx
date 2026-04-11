import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Bell, Mail, Save, Loader2, CheckCircle, Settings,
  DollarSign, Users, FileText, Calendar, AlertTriangle,
  Plus, X, Send, Clock, Building2
} from 'lucide-react';

const NotificationSettingsPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [logs, setLogs] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('welcome');
  
  const emailTemplates = [
    { id: 'welcome', label: language === 'ar' ? 'ترحيب بالموظف الجديد' : 'Welcome New Employee' },
    { id: 'payslip', label: language === 'ar' ? 'كشف الراتب' : 'Payslip' },
    { id: 'leave_approved', label: language === 'ar' ? 'الموافقة على الإجازة' : 'Leave Approved' },
    { id: 'leave_rejected', label: language === 'ar' ? 'رفض الإجازة' : 'Leave Rejected' },
    { id: 'invoice', label: language === 'ar' ? 'فاتورة جديدة' : 'New Invoice' },
    { id: 'transaction', label: language === 'ar' ? 'تنبيه معاملة بنكية' : 'Bank Transaction Alert' },
    { id: 'subscription', label: language === 'ar' ? 'تذكير انتهاء الاشتراك' : 'Subscription Expiry' },
    { id: 'password_reset', label: language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Password Reset' },
  ];
  
  const [settings, setSettings] = useState({
    email_notifications_enabled: true,
    notify_large_transactions: true,
    large_transaction_threshold: 100000,
    notify_payroll_ready: true,
    notify_employees_payslip: true,
    notify_contract_expiry: true,
    contract_expiry_days: 30,
    notify_leave_expiry: true,
    leave_expiry_days: 30,
    notify_invoice_due: true,
    invoice_due_days: 7,
    notify_new_invoice: true,
    notify_pending_approvals: true,
    admin_emails: []
  });

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/logs?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmail = () => {
    if (newEmail && !settings.admin_emails.includes(newEmail)) {
      setSettings(prev => ({
        ...prev,
        admin_emails: [...prev.admin_emails, newEmail]
      }));
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email) => {
    setSettings(prev => ({
      ...prev,
      admin_emails: prev.admin_emails.filter(e => e !== email)
    }));
  };

  const handleSendTestEmail = async () => {
    if (settings.admin_emails.length === 0) {
      alert(language === 'ar' ? 'أضف بريد إلكتروني أولاً' : 'Add an email first');
      return;
    }
    
    setTestSending(true);
    try {
      const response = await fetch(
        `${API_URL}/api/notifications/send-test-email?to_email=${encodeURIComponent(settings.admin_emails[0])}&template_type=${selectedTemplate}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        alert(language === 'ar' ? 'تم إرسال البريد التجريبي بنجاح! ✅' : 'Test email sent successfully! ✅');
        fetchLogs();
      } else {
        const data = await response.json();
        alert(language === 'ar' ? `فشل إرسال البريد: ${data.detail || 'خطأ غير معروف'}` : `Failed to send email: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      alert(language === 'ar' ? 'حدث خطأ أثناء الإرسال' : 'Error occurred while sending');
    } finally {
      setTestSending(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const ToggleSwitch = ({ checked, onChange, label, description, icon: Icon, color }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-medium dark:text-white">{label}</p>
          {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
              <Bell className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
              </h1>
              <p className="text-white/70 mt-1">
                {language === 'ar' 
                  ? 'تخصيص إشعارات البريد الإلكتروني' 
                  : 'Customize email notifications'}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-white text-amber-600 hover:bg-amber-50 gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved 
              ? (language === 'ar' ? 'تم الحفظ!' : 'Saved!') 
              : (language === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Emails */}
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Mail className="w-5 h-5 text-blue-500" />
              {language === 'ar' ? 'البريد الإلكتروني للإدارة' : 'Admin Emails'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={language === 'ar' ? 'أضف بريد إلكتروني' : 'Add email'}
                className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
              />
              <Button onClick={handleAddEmail} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {settings.admin_emails.map((email, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm dark:text-white truncate">{email}</span>
                  <button onClick={() => handleRemoveEmail(email)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {settings.admin_emails.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {language === 'ar' ? 'لا يوجد بريد إلكتروني' : 'No emails added'}
                </p>
              )}
            </div>
            
            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-white">
                {language === 'ar' ? 'نوع القالب' : 'Template Type'}
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
              >
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
            
            <Button 
              onClick={handleSendTestEmail}
              disabled={testSending || settings.admin_emails.length === 0}
              variant="outline"
              className="w-full"
            >
              {testSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              )}
              {language === 'ar' ? 'إرسال رسالة تجريبية' : 'Send Test Email'}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card className="lg:col-span-2 border-0 shadow-lg dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Settings className="w-5 h-5 text-purple-500" />
              {language === 'ar' ? 'أنواع الإشعارات' : 'Notification Types'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleSwitch
              checked={settings.email_notifications_enabled}
              onChange={(v) => handleChange('email_notifications_enabled', v)}
              label={language === 'ar' ? 'تفعيل إشعارات البريد' : 'Enable Email Notifications'}
              description={language === 'ar' ? 'تفعيل/تعطيل جميع الإشعارات' : 'Enable/disable all notifications'}
              icon={Mail}
              color="bg-blue-500"
            />
            
            <ToggleSwitch
              checked={settings.notify_large_transactions}
              onChange={(v) => handleChange('notify_large_transactions', v)}
              label={language === 'ar' ? 'معاملات بنكية كبيرة' : 'Large Bank Transactions'}
              description={`${language === 'ar' ? 'تنبيه عند تجاوز' : 'Alert when exceeding'} ${settings.large_transaction_threshold.toLocaleString()}`}
              icon={DollarSign}
              color="bg-green-500"
            />
            
            <ToggleSwitch
              checked={settings.notify_employees_payslip}
              onChange={(v) => handleChange('notify_employees_payslip', v)}
              label={language === 'ar' ? 'كشوف الرواتب' : 'Payslips'}
              description={language === 'ar' ? 'إرسال كشف الراتب للموظفين' : 'Send payslips to employees'}
              icon={Users}
              color="bg-purple-500"
            />
            
            <ToggleSwitch
              checked={settings.notify_contract_expiry}
              onChange={(v) => handleChange('notify_contract_expiry', v)}
              label={language === 'ar' ? 'انتهاء العقود' : 'Contract Expiry'}
              description={`${language === 'ar' ? 'قبل' : 'Before'} ${settings.contract_expiry_days} ${language === 'ar' ? 'يوم' : 'days'}`}
              icon={Calendar}
              color="bg-amber-500"
            />
            
            <ToggleSwitch
              checked={settings.notify_invoice_due}
              onChange={(v) => handleChange('notify_invoice_due', v)}
              label={language === 'ar' ? 'الفواتير المستحقة' : 'Due Invoices'}
              description={`${language === 'ar' ? 'قبل' : 'Before'} ${settings.invoice_due_days} ${language === 'ar' ? 'أيام' : 'days'}`}
              icon={FileText}
              color="bg-red-500"
            />
            
            <ToggleSwitch
              checked={settings.notify_pending_approvals}
              onChange={(v) => handleChange('notify_pending_approvals', v)}
              label={language === 'ar' ? 'طلبات الموافقة' : 'Pending Approvals'}
              description={language === 'ar' ? 'إشعار بطلبات الموافقة الجديدة' : 'Notify on new approval requests'}
              icon={AlertTriangle}
              color="bg-cyan-500"
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Notifications Log */}
      <Card className="border-0 shadow-lg dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Clock className="w-5 h-5 text-gray-500" />
            {language === 'ar' ? 'سجل الإشعارات الأخيرة' : 'Recent Notification Log'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {language === 'ar' ? 'لا توجد إشعارات مرسلة' : 'No notifications sent yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      log.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {log.status === 'success' 
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <AlertTriangle className="w-4 h-4 text-red-600" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium dark:text-white">{log.subject}</p>
                      <p className="text-xs text-gray-500">{log.recipient || `${log.recipients_count} recipients`}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(log.sent_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettingsPage;
