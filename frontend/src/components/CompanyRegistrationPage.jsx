import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import CompanyLogo from './CompanyLogo';
import { Building2, Mail, Phone, MapPin, User, Lock, AlertCircle, CheckCircle } from 'lucide-react';

const CompanyRegistrationPage = () => {
  const { registerCompany } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  
  const trialEmail = location.state?.email || '';
  const trialId = location.state?.trialId || '';
  
  const [step, setStep] = useState(1);
  const [companyData, setCompanyData] = useState({
    name: '',
    industry: '',
    size: 'Small (1-50)',
    contact_email: trialEmail,
    phone: '',
    address: '',
    trial_id: trialId
  });
  
  const [userData, setUserData] = useState({
    full_name: '',
    email: trialEmail,
    password: '',
    confirmPassword: ''
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError(language === 'ar' ? 'يرجى اختيار ملف صورة فقط' : 'Please select an image file only');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const isRTL = language === 'ar';

  const translations = {
    en: {
      title: 'Register Your Company',
      step1: 'Company Information',
      step2: 'Admin Account',
      companyName: 'Company Name',
      industry: 'Industry',
      companySize: 'Company Size',
      email: 'Contact Email',
      phone: 'Phone Number',
      address: 'Address (Optional)',
      fullName: 'Full Name',
      userEmail: 'Your Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      nextButton: 'Next',
      backButton: 'Back',
      registerButton: 'Complete Registration',
      alreadyHaveAccount: 'Already have an account?',
      signIn: 'Sign In'
    },
    ar: {
      title: 'تسجيل شركتك',
      step1: 'معلومات الشركة',
      step2: 'حساب المدير',
      companyName: 'اسم الشركة',
      industry: 'القطاع',
      companySize: 'حجم الشركة',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      address: 'العنوان (اختياري)',
      fullName: 'الاسم الكامل',
      userEmail: 'بريدك الإلكتروني',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      nextButton: 'التالي',
      backButton: 'السابق',
      registerButton: 'إتمام التسجيل',
      alreadyHaveAccount: 'لديك حساب بالفعل؟',
      signIn: 'تسجيل الدخول'
    }
  };

  const t = translations[language];

  const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Other'];
  const sizes = ['Small (1-50)', 'Medium (51-200)', 'Large (201+)'];

  const handleCompanyChange = (e) => {
    setCompanyData({ ...companyData, [e.target.name]: e.target.value });
  };

  const handleUserChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    setError('');
    if (!companyData.name || !companyData.industry || !companyData.contact_email || !companyData.phone) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (userData.password !== userData.confirmPassword) {
      setError(language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    if (userData.password.length < 6) {
      setError(language === 'ar' ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await registerCompany(companyData, userData);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <CompanyLogo />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h2>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className={`flex items-center ${step === 1 ? 'text-blue-600' : 'text-green-600'}`}>
                {step === 1 ? <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">1</div> : <CheckCircle />}
                <span className={`${isRTL ? 'mr-2' : 'ml-2'}`}>{t.step1}</span>
              </div>
              <div className="h-0.5 w-16 bg-gray-300" />
              <div className={`flex items-center ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center`}>2</div>
                <span className={`${isRTL ? 'mr-2' : 'ml-2'}`}>{t.step2}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.companyName}</label>
                <div className="relative">
                  <Building2 className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="text"
                    name="name"
                    value={companyData.name}
                    onChange={handleCompanyChange}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.industry}</label>
                  <select
                    name="industry"
                    value={companyData.industry}
                    onChange={handleCompanyChange}
                    required
                    className={`w-full py-3 px-4 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : ''}`}
                  >
                    <option value="">Select...</option>
                    {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.companySize}</label>
                  <select
                    name="size"
                    value={companyData.size}
                    onChange={handleCompanyChange}
                    required
                    className={`w-full py-3 px-4 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : ''}`}
                  >
                    {sizes.map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.email}</label>
                  <div className="relative">
                    <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                    <input
                      type="email"
                      name="contact_email"
                      value={companyData.contact_email}
                      onChange={handleCompanyChange}
                      required
                      className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.phone}</label>
                  <div className="relative">
                    <Phone className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                    <input
                      type="tel"
                      name="phone"
                      value={companyData.phone}
                      onChange={handleCompanyChange}
                      required
                      className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.address}</label>
                <div className="relative">
                  <MapPin className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="text"
                    name="address"
                    value={companyData.address}
                    onChange={handleCompanyChange}
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'شعار الشركة (اختياري)' : 'Company Logo (Optional)'}
                </label>
                <div className="flex items-center space-x-4">
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo Preview" className="w-20 h-20 object-contain border rounded" />
                  )}
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg border border-gray-300">
                    <span className="text-sm">{language === 'ar' ? 'اختر صورة' : 'Choose Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  {logoFile && (
                    <span className="text-sm text-gray-600">{logoFile.name}</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t.nextButton}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.fullName}</label>
                <div className="relative">
                  <User className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="text"
                    name="full_name"
                    value={userData.full_name}
                    onChange={handleUserChange}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.userEmail}</label>
                <div className="relative">
                  <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="email"
                    name="email"
                    value={userData.email}
                    onChange={handleUserChange}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.password}</label>
                <div className="relative">
                  <Lock className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="password"
                    name="password"
                    value={userData.password}
                    onChange={handleUserChange}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.confirmPassword}</label>
                <div className="relative">
                  <Lock className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={userData.confirmPassword}
                    onChange={handleUserChange}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg`}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  {t.backButton}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (language === 'ar' ? 'جاري التسجيل...' : 'Registering...') : t.registerButton}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyRegistrationPage;
