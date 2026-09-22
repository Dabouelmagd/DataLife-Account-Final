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
  // step 2 of the reset: the emailed code + the new password
  const [resetStep, setResetStep] = useState('email');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

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
      resetSuccess: 'Password changed — you can sign in now',
      otpSent: 'If the email is registered, a code valid for 10 minutes was sent to it',
      otpLabel: 'Verification code', newPasswordLabel: 'New password (8+ characters)', confirmReset: 'Change password',
      showPassword: 'Show Password',
      hidePassword: 'Hide Password',
      copiedCode: 'Copied!'
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
      resetSuccess: 'تم تغيير كلمة المرور — يمكنك تسجيل الدخول الآن',
      otpSent: 'إذا كان البريد مسجلاً، فقد أُرسل إليه رمز تحقق صالح لمدة 10 دقائق',
      otpLabel: 'رمز التحقق', newPasswordLabel: 'كلمة المرور الجديدة (8 أحرف على الأقل)', confirmReset: 'تغيير كلمة المرور',
      showPassword: 'إظهار كلمة المرور',
      hidePassword: 'إخفاء كلمة المرور',
      copiedCode: 'تم النسخ!'
    }
  };

  const t = translations[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      const role = result.user?.role;
      // Super Admin → admin dashboard
      const isSuperAdmin = role === 'Super Admin' || role === 'مدير النظام';
      // Employee / موظف → ESS portal (only sees own data)
      const isEmployee = role === 'Employee' || role === 'موظف';
      
      if (isSuperAdmin) {
        navigate('/admin');
      } else if (isEmployee) {
        // Employees go directly to their personal portal — no access to company data
        navigate('/my-portal');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  // Forgot password: 1) email a one-time code, 2) code + new password.
  // It used to reset the password straight from the email address and, when
  // mail failed, show the new password on screen — anyone could take over any account.
  const resetForgotState = () => {
    setShowForgotPassword(false); setResetEmail(''); setError(''); setResetSuccess(false);
    setResetStep('email'); setResetOtp(''); setResetNewPassword('');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const base = process.env.REACT_APP_BACKEND_URL;
    try {
      if (resetStep === 'email') {
        const response = await fetch(`${base}/api/auth/request-password-reset?email=${encodeURIComponent(resetEmail.trim())}`, { method: 'POST' });
        if (!response.ok) {
          const d = await response.json().catch(() => ({}));
          throw new Error(d.detail || '');
        }
        setResetStep('otp');
      } else {
        const response = await fetch(`${base}/api/auth/verify-otp-reset-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail.trim(), otp: resetOtp.trim(), new_password: resetNewPassword }),
        });
        const d = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(d.detail || '');
        setResetSuccess(true);
        setTimeout(resetForgotState, 2500);
      }
    } catch (err) {
      setError(err.message || (language === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'An error occurred, try again'));
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
        <div className="flex justify-center mb-8">
          <CompanyLogo size="default" style={{ maxWidth: 200, display: "block", margin: "0 auto" }} />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={resetForgotState}>
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
                    disabled={resetStep === 'otp'}
                  />
                </div>
              </div>

              {resetStep === 'otp' && !resetSuccess && (
                <>
                  <p className="text-sm text-gray-600">{t.otpSent}</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t.otpLabel}</label>
                    <input value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} required inputMode="numeric" autoComplete="one-time-code" dir="ltr"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg tracking-widest text-center focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t.newPasswordLabel}</label>
                    <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (resetStep === 'otp' ? t.confirmReset : t.sendReset)}
                </button>
                <button
                  type="button"
                  onClick={resetForgotState}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;
