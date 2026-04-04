import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, Building, Key, Globe, CheckCircle, XCircle,
  RefreshCw, Save, TestTube, Send, FileText, Clock,
  AlertCircle, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api/eta';
const getToken = () => localStorage.getItem('token');

export default function ETASettingsPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('settings');

  const text = {
    ar: {
      title: 'إعدادات مصلحة الضرائب المصرية',
      subtitle: 'تكوين بيانات التكامل مع منظومة الفاتورة الإلكترونية',
      
      tabs: {
        settings: 'الإعدادات',
        submissions: 'سجل الإرسالات'
      },
      
      taxSection: 'بيانات التسجيل الضريبي',
      taxDesc: 'معلومات الشركة لدى مصلحة الضرائب',
      taxRegNumber: 'رقم التسجيل الضريبي',
      branchId: 'رقم الفرع',
      branchIdDesc: '0 للمقر الرئيسي',
      activityCode: 'كود النشاط',
      
      apiSection: 'بيانات API',
      apiDesc: 'بيانات الاعتماد من بوابة الفاتورة الإلكترونية',
      clientId: 'Client ID',
      clientSecret: 'Client Secret',
      
      envSection: 'البيئة',
      envDesc: 'اختر بيئة الاختبار أو الإنتاج',
      environment: 'البيئة',
      preprod: 'بيئة الاختبار (Preproduction)',
      production: 'بيئة الإنتاج (Production)',
      
      statusSection: 'حالة التكامل',
      isActive: 'تفعيل التكامل',
      autoSubmit: 'إرسال الفواتير تلقائياً عند الاعتماد',
      lastTest: 'آخر اختبار اتصال',
      connectionStatus: 'حالة الاتصال',
      connected: 'متصل',
      disconnected: 'غير متصل',
      notTested: 'لم يتم الاختبار',
      
      testConnection: 'اختبار الاتصال',
      testingConnection: 'جاري الاختبار...',
      testSuccess: 'تم الاتصال بنجاح',
      testFailed: 'فشل الاتصال',
      
      save: 'حفظ الإعدادات',
      saving: 'جاري الحفظ...',
      saved: 'تم حفظ الإعدادات بنجاح',
      error: 'حدث خطأ',
      
      submissionsTitle: 'سجل الإرسالات',
      submissionsDesc: 'الفواتير المرسلة إلى مصلحة الضرائب',
      invoiceNumber: 'رقم الفاتورة',
      submissionDate: 'تاريخ الإرسال',
      status: 'الحالة',
      documentUuid: 'UUID المستند',
      noSubmissions: 'لا توجد إرسالات',
      
      statusPending: 'في الانتظار',
      statusSubmitted: 'تم الإرسال',
      statusValid: 'صالح',
      statusInvalid: 'غير صالح',
      statusRejected: 'مرفوض',
      statusCancelled: 'ملغي',
      
      getCredentials: 'الحصول على بيانات الاعتماد',
      preprodPortal: 'بوابة الاختبار',
      prodPortal: 'بوابة الإنتاج',
      
      warning: 'تحذير',
      warningText: 'تأكد من استخدام بيئة الاختبار (Preproduction) أولاً قبل التبديل إلى بيئة الإنتاج'
    },
    en: {
      title: 'Egyptian Tax Authority Settings',
      subtitle: 'Configure integration with e-invoicing portal',
      
      tabs: {
        settings: 'Settings',
        submissions: 'Submissions Log'
      },
      
      taxSection: 'Tax Registration Data',
      taxDesc: 'Company information at the Tax Authority',
      taxRegNumber: 'Tax Registration Number',
      branchId: 'Branch ID',
      branchIdDesc: '0 for head office',
      activityCode: 'Activity Code',
      
      apiSection: 'API Credentials',
      apiDesc: 'Credentials from e-invoicing portal',
      clientId: 'Client ID',
      clientSecret: 'Client Secret',
      
      envSection: 'Environment',
      envDesc: 'Choose test or production environment',
      environment: 'Environment',
      preprod: 'Preproduction (Testing)',
      production: 'Production',
      
      statusSection: 'Integration Status',
      isActive: 'Enable Integration',
      autoSubmit: 'Auto-submit invoices on approval',
      lastTest: 'Last Connection Test',
      connectionStatus: 'Connection Status',
      connected: 'Connected',
      disconnected: 'Disconnected',
      notTested: 'Not Tested',
      
      testConnection: 'Test Connection',
      testingConnection: 'Testing...',
      testSuccess: 'Connection successful',
      testFailed: 'Connection failed',
      
      save: 'Save Settings',
      saving: 'Saving...',
      saved: 'Settings saved successfully',
      error: 'An error occurred',
      
      submissionsTitle: 'Submissions Log',
      submissionsDesc: 'Invoices sent to Tax Authority',
      invoiceNumber: 'Invoice Number',
      submissionDate: 'Submission Date',
      status: 'Status',
      documentUuid: 'Document UUID',
      noSubmissions: 'No submissions',
      
      statusPending: 'Pending',
      statusSubmitted: 'Submitted',
      statusValid: 'Valid',
      statusInvalid: 'Invalid',
      statusRejected: 'Rejected',
      statusCancelled: 'Cancelled',
      
      getCredentials: 'Get Credentials',
      preprodPortal: 'Test Portal',
      prodPortal: 'Production Portal',
      
      warning: 'Warning',
      warningText: 'Make sure to use Preproduction environment first before switching to Production'
    }
  }[language];

  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/submissions?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSubmissions();
  }, [fetchSettings, fetchSubmissions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();
      const response = await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast.success(text.saved);
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(text.error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings?.client_id || (!settings?.client_secret && !settings?.client_secret_masked)) {
      toast.error(language === 'ar' ? 'يرجى إدخال بيانات الاعتماد أولاً' : 'Please enter credentials first');
      return;
    }
    
    setTesting(true);
    try {
      const token = getToken();
      const response = await fetch(`${API}/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: settings.client_id,
          client_secret: settings.client_secret || '',
          environment: settings.environment || 'preprod'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(text.testSuccess);
        setSettings(prev => ({
          ...prev,
          connection_status: 'connected',
          last_connection_test: new Date().toISOString()
        }));
      } else {
        toast.error(`${text.testFailed}: ${data.error || ''}`);
        setSettings(prev => ({
          ...prev,
          connection_status: 'failed'
        }));
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(text.testFailed);
    } finally {
      setTesting(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid':
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'invalid':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: text.statusPending,
      submitted: text.statusSubmitted,
      valid: text.statusValid,
      invalid: text.statusInvalid,
      rejected: text.statusRejected,
      cancelled: text.statusCancelled
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="eta-settings-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-7 h-7 text-[#28376B]" />
            {text.title}
          </h1>
          <p className="text-gray-500 mt-1">{text.subtitle}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} data-testid="save-eta-settings-btn">
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? text.saving : text.save}
        </Button>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-800">{text.warning}</p>
          <p className="text-sm text-yellow-700">{text.warningText}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-[#28376B] text-[#28376B]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4 inline-block mr-2" />
            {text.tabs.settings}
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'submissions'
                ? 'border-[#28376B] text-[#28376B]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            {text.tabs.submissions}
          </button>
        </nav>
      </div>

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tax Registration Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#28376B]">
                <Building className="w-5 h-5" />
                {text.taxSection}
              </CardTitle>
              <CardDescription>{text.taxDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{text.taxRegNumber}</label>
                <Input 
                  value={settings?.tax_registration_number || ''}
                  onChange={e => updateSetting('tax_registration_number', e.target.value)}
                  placeholder="123456789"
                  data-testid="eta-tax-reg-number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{text.branchId}</label>
                <p className="text-xs text-gray-500 mb-1">{text.branchIdDesc}</p>
                <Input 
                  value={settings?.branch_id || '0'}
                  onChange={e => updateSetting('branch_id', e.target.value)}
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{text.activityCode}</label>
                <Input 
                  value={settings?.activity_code || ''}
                  onChange={e => updateSetting('activity_code', e.target.value)}
                  placeholder="4610"
                />
              </div>
            </CardContent>
          </Card>

          {/* API Credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <Key className="w-5 h-5" />
                {text.apiSection}
              </CardTitle>
              <CardDescription>{text.apiDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{text.clientId}</label>
                <Input 
                  value={settings?.client_id || ''}
                  onChange={e => updateSetting('client_id', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  data-testid="eta-client-id"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{text.clientSecret}</label>
                <div className="relative">
                  <Input 
                    type={showSecret ? 'text' : 'password'}
                    value={settings?.client_secret || ''}
                    onChange={e => updateSetting('client_secret', e.target.value)}
                    placeholder={settings?.client_secret_masked || '••••••••••••'}
                    data-testid="eta-client-secret"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <a
                  href="https://profile.preprod.eta.gov.eg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {text.preprodPortal}
                </a>
                <span className="text-gray-300">|</span>
                <a
                  href="https://profile.eta.gov.eg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {text.prodPortal}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Globe className="w-5 h-5" />
                {text.envSection}
              </CardTitle>
              <CardDescription>{text.envDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{text.environment}</label>
                <select 
                  className="w-full p-2 border rounded-md"
                  value={settings?.environment || 'preprod'}
                  onChange={e => updateSetting('environment', e.target.value)}
                  data-testid="eta-environment"
                >
                  <option value="preprod">{text.preprod}</option>
                  <option value="production">{text.production}</option>
                </select>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full"
                data-testid="eta-test-connection-btn"
              >
                {testing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                {testing ? text.testingConnection : text.testConnection}
              </Button>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                {text.statusSection}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-medium">{text.isActive}</label>
                <input 
                  type="checkbox" 
                  checked={settings?.is_active ?? false}
                  onChange={e => updateSetting('is_active', e.target.checked)}
                  className="w-5 h-5 accent-[#28376B]"
                  data-testid="eta-is-active"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="font-medium">{text.autoSubmit}</label>
                <input 
                  type="checkbox" 
                  checked={settings?.auto_submit_invoices ?? false}
                  onChange={e => updateSetting('auto_submit_invoices', e.target.checked)}
                  className="w-5 h-5 accent-[#28376B]"
                />
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{text.connectionStatus}:</span>
                  <span className={`font-medium ${
                    settings?.connection_status === 'connected' ? 'text-green-600' : 
                    settings?.connection_status === 'failed' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {settings?.connection_status === 'connected' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> {text.connected}
                      </span>
                    ) : settings?.connection_status === 'failed' ? (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> {text.disconnected}
                      </span>
                    ) : text.notTested}
                  </span>
                </div>
                
                {settings?.last_connection_test && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{text.lastTest}:</span>
                    <span className="font-medium">
                      {new Date(settings.last_connection_test).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'submissions' && (
        <Card>
          <CardHeader>
            <CardTitle>{text.submissionsTitle}</CardTitle>
            <CardDescription>{text.submissionsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{text.noSubmissions}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{text.invoiceNumber}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{text.submissionDate}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{text.status}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">{text.documentUuid}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {submissions.map((sub, idx) => (
                      <tr key={sub.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{sub.invoice_number}</td>
                        <td className="px-4 py-3 text-sm">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                            {getStatusText(sub.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">
                          {sub.document_uuid ? sub.document_uuid.substring(0, 8) + '...' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
