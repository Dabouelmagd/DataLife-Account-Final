import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import CompanyLogo from './CompanyLogo';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionCode, setSubscriptionCode] = useState('');

  const isRTL = language === 'ar';

  const translations = {
    en: {
      title: 'Welcome Back',
      subtitle: 'Sign in to your DataLife Account',
      email: 'Email Address',
      password: 'Password',
      loginButton: 'Sign In',
      forgotPassword: 'Forgot Password?',
      noAccount: "Don't have an account?",
      registerCompany: 'Register Company',
      backToHome: 'Back to Home',
      resetPasswordTitle: 'Reset Password',
      resetPasswordDesc: 'Enter your email and we will send you a new password',
      sendReset: 'Send',
      cancel: 'Cancel',
      resetSuccess: 'New password sent to your email',
      showPassword: 'Show Password',
      hidePassword: 'Hide Password',
      subscriptionCodeTitle: 'Your Subscription Code',
      subscriptionCodeDesc: 'Save this code, you will need it to manage your account',
      copyCode: 'Copy Code',
      copiedCode: 'Copied!',
      continueToApp: 'Continue to Application'
    },
    ar: {
      title: 'مرحباً بعودتك',
      subtitle: 'تسجيل الدخول إلى حساب DataLife',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      loginButton: 'تسجيل الدخول',
      forgotPassword: 'نسيت كلمة المرور؟',
      noAccount: 'ليس لديك حساب؟',
      registerCompany: 'تسجيل شركة',
      backToHome: 'العودة للرئيسية',
      resetPasswordTitle: 'إعادة تعيين كلمة المرور',
      resetPasswordDesc: 'أدخل بريدك الإلكتروني وسنرسل لك كلمة المرور الجديدة',
      sendReset: 'إرسال',
      cancel: 'إلغاء',
      resetSuccess: 'تم إرسال كلمة المرور الجديدة إلى بريدك الإلكتروني',
      showPassword: 'إظهار كلمة المرور',
      hidePassword: 'إخفاء كلمة المرور',
      subscriptionCodeTitle: 'كود الاشتراك الخاص بك',
      subscriptionCodeDesc: 'احفظ هذا الكود، ستحتاجه لإدارة حسابك',
      copyCode: 'نسخ الكود',
      copiedCode: 'تم النسخ!',
      continueToApp: 'الانتقال للتطبيق'
    }
  };

  const t = translations[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      // Get subscription code from user data
      const code = result.user?.subscription_code || result.user?.company_id?.slice(0, 8).toUpperCase() || '';
      setSubscriptionCode(code);
      setShowSubscriptionModal(true);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      if (response.ok) {
        const data = await response.json();
        setResetSuccess(true);
        setError('');
        // إذا كان هناك خطأ في الإيميل، نعرض كلمة المرور
        if (data.email_error && data.new_password) {
          alert(`${language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}: ${data.new_password}`);
        }
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetSuccess(false);
          setResetEmail('');
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || (language === 'ar' ? 'فشل إعادة تعيين كلمة المرور' : 'Failed to reset password'));
      }
    } catch (error) {
      setError(language === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'An error occurred, try again');
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CompanyLogo />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h2>
            <p className="text-gray-600">{t.subtitle}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.email}
              </label>
              <div className="relative">
                <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder={t.email}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.password}
              </label>
              <div className="relative">
                <Lock className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={`w-full ${isRTL ? 'pr-10 pl-10 text-right' : 'pl-10 pr-10'} py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder={t.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} text-gray-400 hover:text-gray-600`}
                  title={showPassword ? t.hidePassword : t.showPassword}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={20} />
              {loading ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') : t.loginButton}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t.forgotPassword}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center space-y-4">
            <p className="text-sm text-gray-600">
              {t.noAccount}{' '}
              <Link to="/register-company" className="text-blue-600 hover:text-blue-700 font-semibold">
                {t.registerCompany}
              </Link>
            </p>
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              {t.backToHome}
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowForgotPassword(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.resetPasswordTitle}</h3>
            <p className="text-gray-600 mb-6">{t.resetPasswordDesc}</p>

            {resetSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                {t.resetSuccess}
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.email}
                </label>
                <div className="relative">
                  <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={20} />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder={t.email}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : t.sendReset}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                    setError('');
                    setResetSuccess(false);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Code Modal - Shows after successful login */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.subscriptionCodeTitle}</h3>
              <p className="text-gray-600">{t.subscriptionCodeDesc}</p>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
              <div className="text-center">
                <code className="text-3xl font-mono font-bold text-amber-600 tracking-widest">
                  {subscriptionCode}
                </code>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(subscriptionCode);
                  const btn = document.getElementById('copy-btn');
                  if (btn) {
                    btn.textContent = t.copiedCode;
                    setTimeout(() => {
                      btn.textContent = t.copyCode;
                    }, 2000);
                  }
                }}
                id="copy-btn"
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                {t.copyCode}
              </button>
              <button
                onClick={() => {
                  setShowSubscriptionModal(false);
                  navigate('/dashboard');
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t.continueToApp}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
