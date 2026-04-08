import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Eye, EyeOff, AlertCircle, Loader2, KeyRound, ArrowLeft, CheckCircle, Mail, RefreshCw } from 'lucide-react';
import axios from 'axios';

const AdminLogin = () => {
  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Reset password states
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Success
  const [resetData, setResetData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Admin roles that can access admin dashboard
  const adminRoles = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'];

  const t = {
    title: isRTL ? 'لوحة تحكم المدير' : 'Admin Control Panel',
    subtitle: isRTL ? 'تسجيل دخول المسؤول' : 'Administrator Login',
    email: isRTL ? 'البريد الإلكتروني' : 'Email Address',
    password: isRTL ? 'كلمة المرور' : 'Password',
    login: isRTL ? 'تسجيل الدخول' : 'Sign In',
    backToMain: isRTL ? 'العودة للموقع الرئيسي' : 'Back to Main Site',
    invalidCredentials: isRTL ? 'بيانات غير صحيحة' : 'Invalid credentials',
    notAdmin: isRTL ? 'هذا الحساب ليس لديه صلاحيات إدارية' : 'This account does not have admin privileges',
    secureArea: isRTL ? 'منطقة محمية - للمسؤولين فقط' : 'Secure Area - Administrators Only',
    forgotPassword: isRTL ? 'نسيت كلمة المرور؟' : 'Forgot Password?',
    resetPassword: isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
    newPassword: isRTL ? 'كلمة المرور الجديدة' : 'New Password',
    confirmPassword: isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password',
    resetBtn: isRTL ? 'إعادة التعيين' : 'Reset',
    backToLogin: isRTL ? 'العودة لتسجيل الدخول' : 'Back to Login',
    passwordMismatch: isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match',
    resetSuccessMsg: isRTL ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!',
    loginNow: isRTL ? 'سجل الدخول الآن' : 'Login Now',
    sendOtp: isRTL ? 'إرسال رمز التحقق' : 'Send Verification Code',
    enterOtp: isRTL ? 'أدخل رمز التحقق' : 'Enter Verification Code',
    otpSent: isRTL ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' : 'Verification code sent to your email',
    verifyAndReset: isRTL ? 'تحقق وغيّر كلمة المرور' : 'Verify & Reset Password',
    resendOtp: isRTL ? 'إعادة إرسال الرمز' : 'Resend Code',
    resendIn: isRTL ? 'إعادة الإرسال بعد' : 'Resend in',
    seconds: isRTL ? 'ثانية' : 'seconds',
    otpPlaceholder: isRTL ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Check if user has admin role
        if (adminRoles.includes(result.user?.role)) {
          navigate('/admin-dashboard');
        } else {
          setError(t.notAdmin);
          // Logout the non-admin user
          localStorage.removeItem('token');
        }
      } else {
        setError(result.error || t.invalidCredentials);
      }
    } catch (err) {
      setError(t.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    
    // Validate passwords match
    if (resetData.newPassword !== resetData.confirmPassword) {
      setResetError(t.passwordMismatch);
      return;
    }
    
    setResetLoading(true);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/verify-otp-reset-password`,
        null,
        {
          params: {
            email: resetData.email,
            otp: resetData.otp,
            new_password: resetData.newPassword
          }
        }
      );
      
      if (response.data.success) {
        setResetSuccess(true);
        setResetStep(3);
      } else {
        setResetError(response.data.message || 'Error resetting password');
      }
    } catch (err) {
      setResetError(err.response?.data?.detail || (isRTL ? 'حدث خطأ في إعادة التعيين' : 'Error resetting password'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/request-password-reset`,
        null,
        {
          params: {
            email: resetData.email
          }
        }
      );
      
      if (response.data.success) {
        setResetStep(2);
        // Start countdown for resend (60 seconds)
        setCountdown(60);
        setCanResend(false);
      }
    } catch (err) {
      setResetError(err.response?.data?.detail || (isRTL ? 'حدث خطأ في إرسال الرمز' : 'Error sending OTP'));
    } finally {
      setResetLoading(false);
    }
  };

  // Countdown effect for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && resetStep === 2) {
      setCanResend(true);
    }
  }, [countdown, resetStep]);

  const handleResendOtp = async () => {
    setResetError('');
    setResetLoading(true);
    
    try {
      await axios.post(
        `${API_URL}/api/auth/request-password-reset`,
        null,
        { params: { email: resetData.email } }
      );
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setResetError(err.response?.data?.detail || (isRTL ? 'حدث خطأ' : 'Error'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowResetForm(false);
    setResetSuccess(false);
    setResetError('');
    setResetStep(1);
    setResetData({ email: '', otp: '', newPassword: '', confirmPassword: '' });
    setCountdown(0);
    setCanResend(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl shadow-2xl mb-4">
            {showResetForm ? <KeyRound className="h-10 w-10 text-white" /> : <Shield className="h-10 w-10 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {showResetForm ? t.resetPassword : t.title}
          </h1>
          <p className="text-slate-400">{t.secureArea}</p>
        </div>

        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center text-white">
              {showResetForm ? t.resetPassword : t.subtitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Reset Password Success */}
            {resetSuccess ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <p className="text-green-400 text-lg font-semibold mb-4">{t.resetSuccessMsg}</p>
                <Button
                  onClick={handleBackToLogin}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-4 rounded-xl"
                >
                  {t.loginNow}
                </Button>
              </div>
            ) : showResetForm ? (
              /* Reset Password Form - Multi Step */
              <>
                {resetError && (
                  <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-200">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    {resetError}
                  </div>
                )}
                
                {/* Step 1: Enter Email */}
                {resetStep === 1 && (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/20 rounded-full mb-3">
                        <Mail className="h-6 w-6 text-amber-400" />
                      </div>
                      <p className="text-slate-300 text-sm">
                        {isRTL ? 'أدخل بريدك الإلكتروني لإرسال رمز التحقق' : 'Enter your email to receive a verification code'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {t.email}
                      </label>
                      <Input
                        type="email"
                        value={resetData.email}
                        onChange={(e) => setResetData({ ...resetData, email: e.target.value })}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                        placeholder="admin@company.com"
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-6 rounded-xl font-semibold text-lg"
                    >
                      {resetLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      {t.sendOtp}
                    </Button>
                  </form>
                )}
                
                {/* Step 2: Enter OTP and New Password */}
                {resetStep === 2 && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-3">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                      </div>
                      <p className="text-green-400 text-sm font-medium">{t.otpSent}</p>
                      <p className="text-slate-400 text-xs mt-1">{resetData.email}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {t.enterOtp}
                      </label>
                      <Input
                        type="text"
                        value={resetData.otp}
                        onChange={(e) => setResetData({ ...resetData, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        required
                        maxLength={6}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-center text-2xl tracking-widest font-mono"
                        placeholder="000000"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {t.newPassword}
                      </label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={resetData.newPassword}
                          onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                          required
                          minLength={6}
                          className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 pr-10"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {t.confirmPassword}
                      </label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={resetData.confirmPassword}
                          onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                          required
                          minLength={6}
                          className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 pr-10"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={resetLoading || resetData.otp.length !== 6}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-6 rounded-xl font-semibold text-lg"
                    >
                      {resetLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <KeyRound className="h-5 w-5 mr-2" />
                      )}
                      {t.verifyAndReset}
                    </Button>
                    
                    {/* Resend OTP */}
                    <div className="text-center mt-4">
                      {canResend ? (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={resetLoading}
                          className="text-amber-400 hover:text-amber-300 text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                          <RefreshCw className="h-4 w-4" />
                          {t.resendOtp}
                        </button>
                      ) : (
                        <p className="text-slate-500 text-sm">
                          {t.resendIn} {countdown} {t.seconds}
                        </p>
                      )}
                    </div>
                  </form>
                )}
                
                <div className="mt-6 text-center">
                  <button
                    onClick={handleBackToLogin}
                    className="text-slate-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t.backToLogin}
                  </button>
                </div>
              </>
            ) : (
              /* Login Form */
              <>
                {error && (
                  <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-200">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t.email}
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                      placeholder="admin@datalife.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {t.password}
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-6 rounded-xl font-semibold text-lg"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Shield className="h-5 w-5 mr-2" />
                    )}
                    {t.login}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowResetForm(true)}
                    className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
                  >
                    {t.forgotPassword}
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate('/')}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    {t.backToMain}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>{isRTL ? 'جميع محاولات الدخول مسجلة' : 'All login attempts are logged'}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
