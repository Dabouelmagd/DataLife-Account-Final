import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import CompanyLogo from './CompanyLogo';
import { KeyRound, Mail, Lock, User, AlertCircle, CheckCircle, Building2, Loader2 } from 'lucide-react';

const JoinCompanyPage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  const [formData, setFormData] = useState({
    subscription_code: '',
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const t = language === 'ar'
    ? {
        title: 'الانضمام إلى شركتك',
        subtitle: 'أدخل كود الاشتراك الخاص بشركتك للانضمام كموظف',
        code: 'كود اشتراك الشركة',
        codePh: 'مثال: BC778134',
        fullName: 'الاسم الكامل',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        submit: 'إرسال طلب الانضمام',
        submitting: 'جاري الإرسال...',
        backLogin: 'لديك حساب بالفعل؟ تسجيل الدخول',
        successTitle: 'تم إرسال طلبك بنجاح!',
        successDesc: 'طلبك في انتظار موافقة مدير الشركة. ستتمكن من الدخول بمجرد الموافقة عليه.',
        backToHome: 'العودة للرئيسية',
        errors: {
          required: 'جميع الحقول مطلوبة',
          shortPwd: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
          mismatch: 'كلمتا المرور غير متطابقتين',
          failed: 'فشل إرسال طلب الانضمام',
        },
      }
    : {
        title: 'Join Your Company',
        subtitle: 'Enter your company subscription code to join as an employee',
        code: 'Company Subscription Code',
        codePh: 'e.g. BC778134',
        fullName: 'Full Name',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        submit: 'Submit Join Request',
        submitting: 'Submitting...',
        backLogin: 'Already have an account? Sign In',
        successTitle: 'Request submitted successfully!',
        successDesc: 'Your request is awaiting manager approval. You will be able to login once approved.',
        backToHome: 'Back to Home',
        errors: {
          required: 'All fields are required',
          shortPwd: 'Password must be at least 6 characters',
          mismatch: 'Passwords do not match',
          failed: 'Failed to submit join request',
        },
      };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.subscription_code || !formData.full_name || !formData.email || !formData.password) {
      setError(t.errors.required);
      return;
    }
    if (formData.password.length < 6) {
      setError(t.errors.shortPwd);
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError(t.errors.mismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/join-by-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_code: formData.subscription_code.trim().toUpperCase(),
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || t.errors.failed);
      } else {
        setSuccess(data.company_name || '');
      }
    } catch (err) {
      setError(t.errors.failed);
    } finally {
      setLoading(false);
    }
  };

  if (success !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-12 w-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3" data-testid="join-success-title">{t.successTitle}</h2>
          <p className="text-gray-600 mb-6">{t.successDesc}</p>
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-6 flex items-center justify-center gap-2 text-emerald-700">
              <Building2 className="h-4 w-4" />
              <span className="font-semibold">{success}</span>
            </div>
          )}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
            data-testid="back-to-login-btn"
          >
            {t.backLogin}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CompanyLogo />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
            <p className="text-sm text-gray-500 mt-2">{t.subtitle}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm" data-testid="join-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.code}</label>
              <div className="relative">
                <KeyRound className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={18} />
                <input
                  type="text"
                  name="subscription_code"
                  value={formData.subscription_code}
                  onChange={handleChange}
                  placeholder={t.codePh}
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase tracking-widest font-mono`}
                  data-testid="join-code-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.fullName}</label>
              <div className="relative">
                <User className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={18} />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  data-testid="join-fullname-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
              <div className="relative">
                <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={18} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  data-testid="join-email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
              <div className="relative">
                <Lock className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={18} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  data-testid="join-password-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
              <div className="relative">
                <Lock className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-gray-400`} size={18} />
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10'} py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                  data-testid="join-confirm-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              data-testid="join-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link to="/login" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium block">
              {t.backLogin}
            </Link>
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-700 block">
              {t.backToHome}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinCompanyPage;
