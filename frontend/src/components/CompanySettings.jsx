import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Upload, Building2, Mail, Phone, MapPin, User, Shield, Key, Globe, Bell, Copy, Check, Languages } from 'lucide-react';
import axios from 'axios';

const CompanySettings = () => {
  const { user } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [company, setCompany] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('company');
  const [copied, setCopied] = useState(false);
  const isRTL = language === 'ar';

  // Get subscription code
  const subscriptionCode = user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase() || '--------';

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompany(response.data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage(language === 'ar' ? 'يرجى اختيار ملف صورة فقط' : 'Please select an image file only');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}/upload-logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage(language === 'ar' ? 'تم رفع الشعار بنجاح!' : 'Logo uploaded successfully!');
      fetchCompanyData(); // Refresh company data
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage(language === 'ar' ? 'فشل رفع الشعار' : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  // Check if user can upload logo
  const canUploadLogo = ['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'].includes(user.role);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(subscriptionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'company', label: language === 'ar' ? 'الشركة' : 'Company', icon: Building2 },
    { id: 'profile', label: language === 'ar' ? 'الملف الشخصي' : 'Profile', icon: User },
    { id: 'subscription', label: language === 'ar' ? 'الاشتراك' : 'Subscription', icon: Key },
    { id: 'language', label: language === 'ar' ? 'اللغة' : 'Language', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-[#28376B] mb-6">
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#28376B] text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Company Tab */}
        {activeTab === 'company' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Logo */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'شعار الشركة' : 'Company Logo'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt="Company Logo"
                  className="w-40 h-40 object-contain border-2 border-gray-200 rounded-lg p-2"
                />
              ) : (
                <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded-lg">
                  <Building2 className="h-20 w-20 text-gray-400" />
                </div>
              )}

              {canUploadLogo && (
                <>
                  <label htmlFor="logo-upload">
                    <Button
                      disabled={uploading}
                      className="bg-[#28376B] cursor-pointer"
                      onClick={() => document.getElementById('logo-upload').click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading
                        ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...')
                        : (language === 'ar' ? 'رفع شعار' : 'Upload Logo')}
                    </Button>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </>
              )}

              {message && (
                <p className={`text-sm ${message.includes('نجاح') || message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'معلومات الشركة' : 'Company Information'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Building2 className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'اسم الشركة' : 'Company Name'}</p>
                <p className="font-semibold text-lg">{company.name}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</p>
                <p className="font-semibold">{company.contact_email}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Phone className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الهاتف' : 'Phone'}</p>
                <p className="font-semibold">{company.phone}</p>
              </div>
            </div>

            {company.address && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-[#28376B] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'العنوان' : 'Address'}</p>
                  <p className="font-semibold">{company.address}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{language === 'ar' ? 'حالة الاشتراك' : 'Subscription Status'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  company.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {company.subscription_status === 'active' 
                    ? (language === 'ar' ? 'نشط' : 'Active')
                    : (language === 'ar' ? 'تجريبي' : 'Trial')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#28376B]" />
                  {language === 'ar' ? 'معلومات المستخدم' : 'User Information'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {user?.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url}
                      alt={user.full_name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-[#28376B]/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#28376B] to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                      {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{user?.full_name}</h3>
                    <p className="text-gray-500">{user?.email}</p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{language === 'ar' ? 'الدور الوظيفي' : 'Role'}</span>
                    <span className="font-semibold text-[#28376B]">{user?.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      user?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user?.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{language === 'ar' ? 'تاريخ الانضمام' : 'Joined'}</span>
                    <span className="font-semibold">{new Date(user?.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Code Card */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Key className="h-5 w-5" />
                  {language === 'ar' ? 'كود الاشتراك' : 'Subscription Code'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <p className="text-sm text-amber-600 mb-3">
                    {language === 'ar' ? 'احفظ هذا الكود، ستحتاجه لإدارة حسابك' : 'Save this code, you will need it to manage your account'}
                  </p>
                  <div className="bg-white rounded-xl p-4 border-2 border-amber-200 inline-block">
                    <code className="text-3xl font-mono font-bold text-amber-600 tracking-widest">
                      {subscriptionCode}
                    </code>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={handleCopyCode}
                      className={`${copied ? 'bg-green-600' : 'bg-amber-600'} hover:bg-amber-700`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'تم النسخ!' : 'Copied!'}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'نسخ الكود' : 'Copy Code'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#28376B]" />
                  {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'dashboard', name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard' },
                    { id: 'hr', name: language === 'ar' ? 'الموارد البشرية' : 'Human Resources' },
                    { id: 'financial', name: language === 'ar' ? 'الإدارة المالية' : 'Financial' },
                    { id: 'invoices', name: language === 'ar' ? 'الفواتير' : 'Invoices' },
                    { id: 'purchases', name: language === 'ar' ? 'المشتريات' : 'Purchases' },
                    { id: 'projects', name: language === 'ar' ? 'المشاريع' : 'Projects' },
                    { id: 'analytics', name: language === 'ar' ? 'التحليلات' : 'Analytics' },
                    { id: 'settings', name: language === 'ar' ? 'الإعدادات' : 'Settings' },
                  ].map((module) => {
                    // Check if user has access based on role (simplified check)
                    const hasAccess = true; // In real app, check against user's actual permissions
                    return (
                      <div
                        key={module.id}
                        className={`p-3 rounded-lg border-2 flex items-center gap-2 ${
                          hasAccess
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${hasAccess ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-sm">{module.name}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subscription Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#28376B]" />
                  {language === 'ar' ? 'تفاصيل الاشتراك' : 'Subscription Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-600 mb-2">{language === 'ar' ? 'كود الاشتراك' : 'Subscription Code'}</p>
                  <code className="text-2xl font-mono font-bold text-amber-700 tracking-widest">
                    {subscriptionCode}
                  </code>
                  <Button
                    onClick={handleCopyCode}
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-700"
                  >
                    {copied ? (
                      <><Check className="h-3 w-3 mr-1" /> {language === 'ar' ? 'تم!' : 'Done!'}</>
                    ) : (
                      <><Copy className="h-3 w-3 mr-1" /> {language === 'ar' ? 'نسخ' : 'Copy'}</>
                    )}
                  </Button>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{language === 'ar' ? 'نوع الاشتراك' : 'Plan Type'}</span>
                    <span className="font-semibold text-[#28376B]">
                      {company?.subscription_status === 'active' 
                        ? (language === 'ar' ? 'اشتراك مدفوع' : 'Paid Plan')
                        : (language === 'ar' ? 'فترة تجريبية' : 'Trial Period')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      company?.subscription_status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {company?.subscription_status === 'active' 
                        ? (language === 'ar' ? 'نشط' : 'Active')
                        : (language === 'ar' ? 'تجريبي' : 'Trial')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{language === 'ar' ? 'الشركة' : 'Company'}</span>
                    <span className="font-semibold">{company?.name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#28376B]" />
                  {language === 'ar' ? 'المميزات المتاحة' : 'Available Features'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: language === 'ar' ? 'إدارة الموظفين' : 'Employee Management', included: true },
                    { name: language === 'ar' ? 'إدارة الرواتب' : 'Payroll Management', included: true },
                    { name: language === 'ar' ? 'الفواتير والمبيعات' : 'Invoices & Sales', included: true },
                    { name: language === 'ar' ? 'إدارة المشتريات' : 'Purchases Management', included: true },
                    { name: language === 'ar' ? 'إدارة المشاريع' : 'Projects Management', included: true },
                    { name: language === 'ar' ? 'التقارير المتقدمة' : 'Advanced Reports', included: true },
                    { name: language === 'ar' ? 'التحليلات الذكية' : 'Smart Analytics', included: true },
                    { name: language === 'ar' ? 'الدعم الفني' : 'Technical Support', included: true },
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        feature.included ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Check className="h-3 w-3" />
                      </div>
                      <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Language Tab */}
        {activeTab === 'language' && (
          <div className="max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-[#28376B]" />
                  {language === 'ar' ? 'إعدادات اللغة' : 'Language Settings'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'اختر لغة العرض للنظام. سيتم تطبيق التغيير على جميع صفحات التطبيق.'
                    : 'Choose the display language for the system. The change will be applied to all application pages.'}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Arabic Option */}
                  <div
                    onClick={() => language !== 'ar' && toggleLanguage()}
                    className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      language === 'ar'
                        ? 'border-[#28376B] bg-[#28376B]/5 ring-2 ring-[#28376B]/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    data-testid="language-option-ar"
                  >
                    <div className="text-center space-y-3">
                      <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                        language === 'ar' ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className="text-xl font-bold">ع</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">العربية</h3>
                        <p className="text-sm text-gray-500">Arabic</p>
                      </div>
                      {language === 'ar' && (
                        <div className="text-[#28376B] font-semibold text-sm flex items-center justify-center gap-1">
                          <Check className="h-4 w-4" />
                          {language === 'ar' ? 'اللغة الحالية' : 'Current'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* English Option */}
                  <div
                    onClick={() => language !== 'en' && toggleLanguage()}
                    className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      language === 'en'
                        ? 'border-[#28376B] bg-[#28376B]/5 ring-2 ring-[#28376B]/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    data-testid="language-option-en"
                  >
                    <div className="text-center space-y-3">
                      <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                        language === 'en' ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className="text-xl font-bold">En</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">English</h3>
                        <p className="text-sm text-gray-500">الإنجليزية</p>
                      </div>
                      {language === 'en' && (
                        <div className="text-[#28376B] font-semibold text-sm flex items-center justify-center gap-1">
                          <Check className="h-4 w-4" />
                          Current Language
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 text-center">
                    {language === 'ar'
                      ? 'ملاحظة: سيتم حفظ تفضيلات اللغة تلقائياً'
                      : 'Note: Language preferences will be saved automatically'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
    </div>
  );
};

export default CompanySettings;
