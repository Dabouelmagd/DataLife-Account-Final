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
    </div>
  );
};

export default ProfileTab;
