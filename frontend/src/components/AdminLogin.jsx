import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

const AdminLogin = () => {
  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    secureArea: isRTL ? 'منطقة محمية - للمسؤولين فقط' : 'Secure Area - Administrators Only'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl shadow-2xl mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400">{t.secureArea}</p>
        </div>

        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center text-white">{t.subtitle}</CardTitle>
          </CardHeader>
          <CardContent>
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

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                {t.backToMain}
              </button>
            </div>
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
