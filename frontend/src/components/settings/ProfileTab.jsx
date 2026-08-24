import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { User, Shield, Key, Upload, Copy, Check, Lock, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

const ProfileTab = ({ 
  user, 
  language, 
  subscriptionCode, 
  copied, 
  handleCopyCode,
  uploadingPhoto,
  handleProfilePhotoUpload
}) => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', position: user?.position || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm)
      });
      setProfileMsg(language === 'ar' ? '✅ تم الحفظ' : '✅ Saved');
      setEditingProfile(false);
      setTimeout(() => setProfileMsg(''), 3000);
    } catch {
      setProfileMsg(language === 'ar' ? '❌ فشل الحفظ' : '❌ Failed');
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    setPasswordMessage({ type: '', text: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ 
        type: 'error', 
        text: language === 'ar' ? 'جميع الحقول مطلوبة' : 'All fields are required' 
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ 
        type: 'error', 
        text: language === 'ar' ? 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' : 'New password must be at least 6 characters' 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ 
        type: 'error', 
        text: language === 'ar' ? 'كلمة المرور الجديدة غير متطابقة' : 'New passwords do not match' 
      });
      return;
    }

    setChangingPassword(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordMessage({ 
          type: 'success', 
          text: language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully' 
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setShowChangePassword(false), 2000);
      } else {
        setPasswordMessage({ 
          type: 'error', 
          text: data.detail || (language === 'ar' ? 'فشل تغيير كلمة المرور' : 'Failed to change password')
        });
      }
    } catch (error) {
      setPasswordMessage({ 
        type: 'error', 
        text: language === 'ar' ? 'حدث خطأ أثناء تغيير كلمة المرور' : 'Error changing password' 
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
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
            <div className="relative group">
              {user?.profile_photo_url || user?.profile_photo ? (
                <img
                  src={user.profile_photo_url || user.profile_photo}
                  alt={user.full_name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#28376B]/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#28376B] to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </div>
              )}
              {/* Upload Photo Button Overlay */}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                {uploadingPhoto ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                ) : (
                  <Upload className="h-6 w-6 text-white" />
                )}
              </label>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{user?.full_name}</h3>
              <p className="text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                {language === 'ar' ? 'مرر الماوس على الصورة للتغيير' : 'Hover over photo to change'}
              </p>
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

      {/* Change Password Card */}
      <Card className="md:col-span-2 bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="h-5 w-5" />
              {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangePassword(!showChangePassword)}
            >
              {showChangePassword 
                ? (language === 'ar' ? 'إلغاء' : 'Cancel')
                : (language === 'ar' ? 'تغيير' : 'Change')
              }
            </Button>
          </CardTitle>
        </CardHeader>
        {showChangePassword && (
          <CardContent>
            <div className="space-y-4 max-w-md">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور الحالية' : 'Enter current password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور الجديدة' : 'Enter new password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={language === 'ar' ? 'أعد إدخال كلمة المرور الجديدة' : 'Re-enter new password'}
                />
              </div>

              {/* Message */}
              {passwordMessage.text && (
                <div className={`p-3 rounded-lg text-sm ${
                  passwordMessage.type === 'success' 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {passwordMessage.text}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'ar' ? 'جاري التغيير...' : 'Changing...'}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Permissions Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#28376B]" />
            {language === 'ar' ? 'الصلاحيات' : 'My Permissions'}
            <span className="text-sm font-normal text-gray-500">
              ({(user?.permissions || []).length} / {(user?.permissions || []).length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { id: 'dashboard', name_en: 'Dashboard', name_ar: 'لوحة التحكم', emoji: '🏠', color: 'from-slate-500 to-slate-600' },
              { id: 'hr', name_en: 'Human Resources', name_ar: 'الموارد البشرية', emoji: '👥', color: 'from-cyan-600 to-cyan-700', description_ar: 'وصول كامل', description_en: 'Full HR Access' },
              { id: 'hr_admin', name_en: 'HR - Administrative', name_ar: 'الموارد البشرية - إداري', emoji: '👥', color: 'from-cyan-500 to-blue-500', description_ar: 'حضور، إجازات، ورديات', description_en: 'Attendance, Leaves, Shifts' },
              { id: 'hr_financial', name_en: 'HR - Financial', name_ar: 'الموارد البشرية - مالي', emoji: '💵', color: 'from-teal-500 to-emerald-500', description_ar: 'رواتب، بدلات، خصومات', description_en: 'Payroll, Allowances, Deductions' },
              { id: 'financial', name_en: 'Financial Management', name_ar: 'الإدارة المالية', emoji: '💰', color: 'from-emerald-500 to-green-600' },
              { id: 'invoices', name_en: 'Invoices', name_ar: 'الفواتير', emoji: '📄', color: 'from-amber-500 to-orange-500' },
              { id: 'purchases', name_en: 'Purchases', name_ar: 'المشتريات', emoji: '🛒', color: 'from-rose-500 to-pink-500' },
              { id: 'projects', name_en: 'Projects & Tasks', name_ar: 'المشاريع والمهام', emoji: '📊', color: 'from-indigo-500 to-purple-500' },
              { id: 'reports', name_en: 'Reports', name_ar: 'التقارير', emoji: '📑', color: 'from-violet-500 to-purple-600' },
              { id: 'analytics', name_en: 'Analytics', name_ar: 'التحليلات', emoji: '📈', color: 'from-blue-500 to-indigo-600' },
              { id: 'inventory', name_en: 'Inventory', name_ar: 'المخزون', emoji: '📦', color: 'from-teal-500 to-cyan-600' },
              { id: 'settings', name_en: 'Settings', name_ar: 'الإعدادات', emoji: '⚙️', color: 'from-gray-500 to-gray-600' },
              { id: 'users', name_en: 'User Management', name_ar: 'إدارة المستخدمين', emoji: '👤', color: 'from-blue-500 to-cyan-500' },
              { id: 'approvals', name_en: 'Approvals', name_ar: 'الموافقات', emoji: '✅', color: 'from-green-500 to-emerald-600' },
              { id: 'admin', name_en: 'Administration', name_ar: 'الإدارة', emoji: '🔧', color: 'from-red-500 to-red-600' },
              { id: 'subscriptions', name_en: 'Subscriptions', name_ar: 'الاشتراكات', emoji: '📋', color: 'from-purple-500 to-purple-600' },
              { id: 'companies', name_en: 'Companies', name_ar: 'الشركات', emoji: '🏢', color: 'from-orange-500 to-orange-600' },
              { id: 'audit_logs', name_en: 'Audit Logs', name_ar: 'سجل التدقيق', emoji: '📝', color: 'from-gray-600 to-gray-700' },
              { id: 'system_settings', name_en: 'System Settings', name_ar: 'إعدادات النظام', emoji: '🔩', color: 'from-slate-600 to-slate-700' },
              { id: 'billing', name_en: 'Billing', name_ar: 'الفوترة', emoji: '💳', color: 'from-yellow-500 to-yellow-600' },
              { id: 'support', name_en: 'Support', name_ar: 'الدعم الفني', emoji: '🎧', color: 'from-sky-500 to-sky-600' },
            ].map((module) => {
              const userPermissions = user?.permissions || [];
              // Check for legacy 'hr' permission and map to new hr_admin/hr_financial
              const hasLegacyHR = userPermissions.includes('hr');
              const hasAccess = userPermissions.includes(module.id) || 
                               (hasLegacyHR && (module.id === 'hr_admin' || module.id === 'hr_financial')) ||
                               user?.role === 'company_manager' || 
                               user?.role === 'رئيس مجلس الإدارة';
              return (
                <div
                  key={module.id}
                  className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    hasAccess
                      ? 'bg-white border-green-200 shadow-sm hover:shadow-md'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
                    hasAccess ? `bg-gradient-to-r ${module.color} text-white shadow-sm` : 'bg-gray-300'
                  }`}>
                    {module.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium text-sm block truncate ${hasAccess ? 'text-gray-800' : 'text-gray-500'}`}>
                      {language === 'ar' ? module.name_ar : module.name_en}
                    </span>
                    {module.description_ar && (
                      <span className={`text-[10px] block truncate ${hasAccess ? 'text-gray-500' : 'text-gray-400'}`}>
                        {language === 'ar' ? module.description_ar : module.description_en}
                      </span>
                    )}
                    <span className={`text-xs ${hasAccess ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasAccess 
                        ? (language === 'ar' ? 'مفعّل' : 'Enabled') 
                        : (language === 'ar' ? 'غير مفعّل' : 'Disabled')}
                    </span>
                  </div>
                  {hasAccess ? (
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                      <Lock className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Permissions Summary */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {language === 'ar' 
                ? `لديك صلاحية الوصول إلى ${(user?.permissions || []).length || 13} وحدة` 
                : `You have access to ${(user?.permissions || []).length || 13} modules`}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              (user?.permissions || []).length >= 11 
                ? 'bg-green-100 text-green-700' 
                : (user?.permissions || []).length >= 5 
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              {(user?.permissions || []).length >= 11 
                ? (language === 'ar' ? 'صلاحيات كاملة' : 'Full Access')
                : (user?.permissions || []).length >= 5 
                  ? (language === 'ar' ? 'صلاحيات متوسطة' : 'Moderate Access')
                  : (language === 'ar' ? 'صلاحيات محدودة' : 'Limited Access')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileTab;
