import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  ArrowLeft, Shield, Check, X, Save, User, 
  Home, Users, Building2, FileText, Package, 
  FolderKanban, BarChart3, Settings, CheckCircle, AlertCircle
} from 'lucide-react';
import axios from 'axios';

// Permission icons mapping
const permissionIcons = {
  dashboard: Home,
  hr: Users,
  financial: Building2,
  invoices: FileText,
  purchases: Package,
  projects: FolderKanban,
  analytics: BarChart3,
  settings: Settings,
  users: Users,
  approvals: CheckCircle,
};

const PermissionsManager = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { userId } = useParams();
  const isRTL = language === 'ar';
  
  const [targetUser, setTargetUser] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [originalPermissions, setOriginalPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Admin roles that can manage permissions
  const adminRoles = ['General Manager', 'CEO', 'Board Chairman', 'رئيس مجلس الإدارة', 'المدير التنفيذي', 'مدير عام'];
  const canManagePermissions = adminRoles.includes(user?.role);

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 5000);
  };

  useEffect(() => {
    if (!canManagePermissions) {
      navigate('/dashboard');
      return;
    }
    fetchUserPermissions();
  }, [userId]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch user permissions
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/users/${userId}/permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Fetch user details
      const usersResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const foundUser = usersResponse.data.find(u => u.id === userId);
      setTargetUser(foundUser);
      setAllPermissions(response.data.all_permissions);
      setUserPermissions(response.data.permissions || []);
      setOriginalPermissions(response.data.permissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      showToast(
        language === 'ar' ? 'حدث خطأ في جلب الصلاحيات' : 'Error fetching permissions',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId) => {
    // Don't allow removing dashboard permission
    if (permissionId === 'dashboard' && userPermissions.includes(permissionId)) {
      showToast(
        language === 'ar' ? 'لا يمكن إزالة صلاحية لوحة التحكم' : 'Cannot remove dashboard permission',
        'error'
      );
      return;
    }
    
    setUserPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(p => p !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/users/${userId}/permissions`,
        { permissions: userPermissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setOriginalPermissions(userPermissions);
      showToast(
        language === 'ar' ? 'تم حفظ الصلاحيات بنجاح' : 'Permissions saved successfully',
        'success'
      );
    } catch (error) {
      console.error('Error saving permissions:', error);
      const errorMessage = error.response?.data?.detail || 
        (language === 'ar' ? 'حدث خطأ في حفظ الصلاحيات' : 'Error saving permissions');
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    setUserPermissions(allPermissions.map(p => p.id));
  };

  const handleDeselectAll = () => {
    // Keep only dashboard
    setUserPermissions(['dashboard']);
  };

  const hasChanges = JSON.stringify(userPermissions.sort()) !== JSON.stringify(originalPermissions.sort());

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/user-management')}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'العودة' : 'Back'}
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {language === 'ar' ? 'إدارة الصلاحيات' : 'Permissions Management'}
              </h1>
              <p className="text-gray-600">
                {language === 'ar' ? 'تعديل صلاحيات المستخدم' : 'Modify user permissions'}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleSavePermissions}
            disabled={saving || !hasChanges}
            className={`rounded-xl h-12 ${
              hasChanges 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                : 'bg-gray-400'
            }`}
          >
            <Save className="h-5 w-5 mr-2" />
            {saving 
              ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') 
              : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
          </Button>
        </div>

        {/* User Info Card */}
        {targetUser && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {targetUser.profile_photo_url ? (
                  <img 
                    src={targetUser.profile_photo_url} 
                    alt={targetUser.full_name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-blue-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                    {targetUser.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{targetUser.full_name}</h2>
                  <p className="text-gray-600">{targetUser.email}</p>
                  <Badge className="mt-1 bg-blue-100 text-blue-800">{targetUser.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            className="rounded-xl"
          >
            <Check className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحديد الكل' : 'Select All'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDeselectAll}
            className="rounded-xl"
          >
            <X className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All'}
          </Button>
        </div>

        {/* Permissions Grid */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              {language === 'ar' ? 'الصلاحيات المتاحة' : 'Available Permissions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allPermissions.map((permission) => {
                const isEnabled = userPermissions.includes(permission.id);
                const IconComponent = permissionIcons[permission.id] || Shield;
                const isDashboard = permission.id === 'dashboard';
                
                return (
                  <div
                    key={permission.id}
                    onClick={() => !isDashboard && handleTogglePermission(permission.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isEnabled
                        ? 'bg-green-50 border-green-300 hover:border-green-400'
                        : 'bg-red-50 border-red-200 hover:border-red-300'
                    } ${isDashboard ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isEnabled ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
                        }`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {language === 'ar' ? permission.name_ar : permission.name_en}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {permission.id}
                          </p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full relative transition-colors ${
                        isEnabled ? 'bg-green-500' : 'bg-red-400'
                      }`}>
                        <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all shadow ${
                          isEnabled ? (isRTL ? 'left-0.5' : 'right-0.5') : (isRTL ? 'right-0.5' : 'left-0.5')
                        }`} />
                      </div>
                    </div>
                    {isDashboard && (
                      <p className="text-xs text-gray-500 mt-2">
                        {language === 'ar' ? 'صلاحية إلزامية' : 'Required permission'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {language === 'ar' ? 'ملخص الصلاحيات' : 'Permissions Summary'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? `${userPermissions.length} من ${allPermissions.length} صلاحيات مفعّلة`
                    : `${userPermissions.length} of ${allPermissions.length} permissions enabled`}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-100 text-green-800">
                  {userPermissions.length} {language === 'ar' ? 'مفعّل' : 'Enabled'}
                </Badge>
                <Badge className="bg-red-100 text-red-800">
                  {allPermissions.length - userPermissions.length} {language === 'ar' ? 'معطّل' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PermissionsManager;
