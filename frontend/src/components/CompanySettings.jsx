import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { Building2, User, Key, Globe, Users, ClipboardList, Shield } from 'lucide-react';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import ImageCropper from './ImageCropper';

// Import refactored components
import {
  CompanyTab,
  ProfileTab,
  EmployeesTab,
  PermissionModal,
  InviteModal,
  SubscriptionTab,
  LanguageTab,
  ActivityLogTab,
  PermissionsTab,
  getAvailableRoles,
  getAvailablePermissions,
  MANAGEMENT_ROLES
} from './settings';

const CompanySettings = () => {
  const { user } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [company, setCompany] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // Get initial tab from URL or default to 'company'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'company');
  const [copied, setCopied] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Invite Employee States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({
    full_name: '',
    email: '',
    role: 'موظف',
    permissions: ['dashboard']
  });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  
  const isRTL = language === 'ar';
  const canManageEmployees = MANAGEMENT_ROLES.includes(user?.role);
  const canUploadLogo = MANAGEMENT_ROLES.includes(user?.role);
  const subscriptionCode = user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase() || '--------';
  
  const availableRoles = getAvailableRoles(language);
  const availablePermissions = getAvailablePermissions(language);

  // Update URL when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  useEffect(() => {
    fetchCompanyData();
    if (canManageEmployees) {
      fetchEmployees();
    }
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

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const openPermissionModal = (employee) => {
    setSelectedEmployee(employee);
    setSelectedPermissions(employee.permissions || []);
    setSelectedRole(employee.role || '');
    setShowPermissionModal(true);
  };

  const handlePermissionToggle = (permissionId) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const saveEmployeeSettings = async () => {
    if (!selectedEmployee) return;
    setSavingPermissions(true);
    try {
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${selectedEmployee.id}/permissions`,
        { permissions: selectedPermissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (selectedRole !== selectedEmployee.role) {
        await axios.put(
          `${process.env.REACT_APP_BACKEND_URL}/api/users/${selectedEmployee.id}/role?role=${encodeURIComponent(selectedRole)}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setMessage(language === 'ar' ? 'تم حفظ التغييرات بنجاح' : 'Changes saved successfully');
      setMessageType('success');
      setShowPermissionModal(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving:', error);
      setMessage(language === 'ar' ? 'فشل حفظ التغييرات' : 'Failed to save changes');
      setMessageType('error');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessage(language === 'ar' ? 'تم حذف الموظف بنجاح' : 'Employee deleted successfully');
      setMessageType('success');
      fetchEmployees(); // Refresh the list
    } catch (error) {
      console.error('Error deleting employee:', error);
      const errorMsg = error.response?.data?.detail || (language === 'ar' ? 'فشل حذف الموظف' : 'Failed to delete employee');
      setMessage(errorMsg);
      setMessageType('error');
      throw error; // Re-throw to handle in the component
    }
  };

  const sendInvitation = async () => {
    if (!inviteData.full_name || !inviteData.email) {
      setMessage(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      setMessageType('error');
      return;
    }

    setSendingInvite(true);
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/invite`,
        {
          full_name: inviteData.full_name,
          email: inviteData.email,
          role: inviteData.role,
          permissions: inviteData.permissions,
          company_id: user.company_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage(language === 'ar' ? 'تم إرسال الدعوة بنجاح! سيتلقى الموظف بريد إلكتروني ببيانات الدخول.' : 'Invitation sent successfully!');
      setMessageType('success');
      toast.success(language === 'ar' ? '✅ تم إرسال الدعوة بنجاح!' : '✅ Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteData({ full_name: '', email: '', role: 'موظف', permissions: ['dashboard'] });
      fetchEmployees();
    } catch (error) {
      console.error('Error sending invitation:', error);
      const errorMsg = error.response?.data?.detail || (language === 'ar' ? 'فشل إرسال الدعوة' : 'Failed to send invitation');
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleInvitePermissionToggle = (permissionId) => {
    setInviteData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage(language === 'ar' ? 'يرجى اختيار ملف صورة فقط' : 'Please select an image file only');
      setMessageType('error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
      setMessageType('error');
      return;
    }

    // Open cropper
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleCroppedUpload = async (blob) => {
    setCropImageSrc(null);
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'profile.jpg');

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/upload-photo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage(language === 'ar' ? 'تم رفع الصورة بنجاح!' : 'Photo uploaded successfully!');
      setMessageType('success');
      
      const photoUrl = response.data.photo_url.startsWith('http') 
        ? response.data.photo_url 
        : `${process.env.REACT_APP_BACKEND_URL}${response.data.photo_url}`;
      
      // Update user in localStorage and auth context without page reload
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, profile_photo: photoUrl, profile_photo_url: photoUrl };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Force re-render by updating window event
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage(language === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload photo');
      setMessageType('error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage(language === 'ar' ? 'يرجى اختيار ملف صورة فقط' : 'Please select an image file only');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)' : 'File size too large (max 10MB)');
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
      setMessageType('success');
      
      // Update company data with new logo
      if (response.data.logo_url) {
        setCompany(prev => ({ ...prev, logo_url: response.data.logo_url }));
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage(language === 'ar' ? 'فشل رفع الشعار' : 'Failed to upload logo');
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(subscriptionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'company', label: language === 'ar' ? 'الشركة' : 'Company', icon: Building2 },
    { id: 'profile', label: language === 'ar' ? 'الملف الشخصي' : 'Profile', icon: User },
    ...(canManageEmployees ? [{ id: 'employees', label: language === 'ar' ? 'الموظفين' : 'Employees', icon: Users }] : []),
    ...(canManageEmployees ? [{ id: 'permissions', label: language === 'ar' ? 'الصلاحيات' : 'Permissions', icon: Shield }] : []),
    ...(canManageEmployees ? [{ id: 'activity', label: language === 'ar' ? 'سجل النشاطات' : 'Activity Log', icon: ClipboardList }] : []),
    { id: 'subscription', label: language === 'ar' ? 'الاشتراك' : 'Subscription', icon: Key },
    { id: 'language', label: language === 'ar' ? 'اللغة' : 'Language', icon: Globe },
  ];

  return (
    <>
    <Toaster position="top-center" richColors />
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Image Cropper Modal */}
      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCropComplete={handleCroppedUpload}
          onCancel={() => setCropImageSrc(null)}
          language={language}
        />
      )}

      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-[#28376B] mb-6">
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
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

        {/* Tab Content */}
        {activeTab === 'company' && (
          <CompanyTab
            company={company}
            language={language}
            canUploadLogo={canUploadLogo}
            uploading={uploading}
            handleLogoUpload={handleLogoUpload}
            message={message}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            language={language}
            subscriptionCode={subscriptionCode}
            copied={copied}
            handleCopyCode={handleCopyCode}
            uploadingPhoto={uploadingPhoto}
            handleProfilePhotoUpload={handleProfilePhotoUpload}
          />
        )}

        {activeTab === 'employees' && canManageEmployees && (
          <EmployeesTab
            language={language}
            employees={employees}
            loadingEmployees={loadingEmployees}
            onInviteClick={() => setShowInviteModal(true)}
            onEditClick={openPermissionModal}
            onDeleteEmployee={handleDeleteEmployee}
            currentUserId={user?.id}
            onRefresh={fetchEmployees}
          />
        )}

        {activeTab === 'permissions' && canManageEmployees && (
          <PermissionsTab
            language={language}
            currentUserId={user?.id}
          />
        )}

        {activeTab === 'subscription' && (
          <SubscriptionTab
            language={language}
            company={company}
            subscriptionCode={subscriptionCode}
            copied={copied}
            handleCopyCode={handleCopyCode}
          />
        )}

        {activeTab === 'industry' && (
          <IndustryAddonsTab
            language={language}
            company={company}
            user={user}
            onRefresh={fetchCompanyData}
          />
        )}

        {activeTab === 'language' && (
          <LanguageTab
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {activeTab === 'activity' && canManageEmployees && (
          <ActivityLogTab language={language} />
        )}

        {/* Modals */}
        {showPermissionModal && selectedEmployee && (
          <PermissionModal
            language={language}
            employee={selectedEmployee}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            selectedPermissions={selectedPermissions}
            handlePermissionToggle={handlePermissionToggle}
            availableRoles={availableRoles}
            availablePermissions={availablePermissions}
            savingPermissions={savingPermissions}
            onSave={saveEmployeeSettings}
            onClose={() => setShowPermissionModal(false)}
          />
        )}

        {showInviteModal && (
          <InviteModal
            language={language}
            inviteData={inviteData}
            setInviteData={setInviteData}
            availableRoles={availableRoles}
            availablePermissions={availablePermissions}
            handleInvitePermissionToggle={handleInvitePermissionToggle}
            sendingInvite={sendingInvite}
            onSend={sendInvitation}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </div>
    </div>
    </>
  );
};


// ── INDUSTRY ADDONS TAB ─────────────────────────────────────────────────
const API = process.env.REACT_APP_BACKEND_URL || '';

const ADDON_CATALOG = [
  { key: 'ads',           name: 'شركات الإعلانات',       name_en: 'Advertising',     icon: '📢', price: 299, tags: ['إدارة الحملات', 'شراء الوسائط', 'المؤثرون'] },
  { key: 'construction',  name: 'المقاولات والإنشاءات',  name_en: 'Construction',    icon: '🏗️', price: 399, tags: ['BOQ', 'إدارة المواقع', 'المعدات'] },
  { key: 'manufacturing', name: 'المصانع والإنتاج',      name_en: 'Manufacturing',   icon: '🏭', price: 599, tags: ['أوامر إنتاج', 'BOM', 'مراقبة الجودة'] },
  { key: 'medical',       name: 'الطبية والصيدليات',     name_en: 'Medical',         icon: '🏥', price: 349, tags: ['المرضى', 'الوصفات', 'مخزون أدوية'] },
  { key: 'real_estate',   name: 'العقارات',              name_en: 'Real Estate',     icon: '🏠', price: 299, tags: ['إدارة وحدات', 'إيجار', 'حجوزات'] },
  { key: 'restaurants',   name: 'المطاعم والضيافة',     name_en: 'Restaurants',     icon: '🍽️', price: 249, tags: ['إدارة طاولات', 'KDS مطبخ', 'توصيل'] },
  { key: 'education',     name: 'التعليم والمدارس',     name_en: 'Education',       icon: '🎓', price: 199, tags: ['الطلاب', 'الرسوم', 'جداول'] },
  { key: 'retail',        name: 'التجزئة والمتاجر',     name_en: 'Retail',          icon: '🛒', price: 249, tags: ['POS', 'باركود', 'نقاط ولاء'] },
  { key: 'logistics',     name: 'اللوجستيات والشحن',    name_en: 'Logistics',       icon: '🚚', price: 399, tags: ['أسطول', 'شحنات', 'جمارك'] },
];

function IndustryAddonsTab({ language, company, user, onRefresh }) {
  const ar = language === 'ar';
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const active = company?.industry_addons || [];
  const activeKeys = active.map(a => a.key);
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const addAddon = async (addonKey, addonName) => {
    if (!window.confirm(ar
      ? `هل تريد إضافة تخصص "${addonName}"؟ سيُضاف سعره على فاتورتك الشهرية.`
      : `Add "${addonName}" industry addon? Its price will be added to your monthly invoice.`
    )) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/companies/${company.id}/addons`, {
        method: 'POST', headers,
        body: JSON.stringify({ addon_key: addonKey })
      });
      const d = await res.json();
      if (res.ok) { setMsg({ type: 'success', text: d.message || '✅ تم إضافة التخصص' }); onRefresh?.(); }
      else setMsg({ type: 'error', text: d.detail || 'خطأ' });
    } catch { setMsg({ type: 'error', text: 'خطأ في الاتصال' }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const removeAddon = async (addonKey, addonName) => {
    if (!window.confirm(ar ? `إزالة تخصص "${addonName}"؟` : `Remove "${addonName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/companies/${company.id}/addons/${addonKey}`, { method: 'DELETE', headers });
      if (res.ok) { setMsg({ type: 'success', text: '✅ تم إزالة التخصص' }); onRefresh?.(); }
    } catch {}
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
        <h2 className="text-lg font-bold text-amber-900 mb-1">{ar ? '🏭 التخصصات القطاعية' : '🏭 Industry Add-ons'}</h2>
        <p className="text-sm text-amber-700">
          {ar
            ? 'أضف تخصصات قطاعية لتوسيع النظام — تظهر في الشريط الجانبي فور الإضافة وتُحتسب على الفاتورة الشهرية'
            : 'Add industry modules to extend the system — appears in sidebar immediately and billed monthly'}
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Active Addons */}
      {active.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">{ar ? 'التخصصات المفعّلة' : 'Active Add-ons'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map(a => {
              const info = ADDON_CATALOG.find(c => c.key === a.key);
              return (
                <div key={a.key} className="flex items-center gap-3 p-4 bg-white border-2 border-amber-200 rounded-xl shadow-sm">
                  <span className="text-2xl">{info?.icon || '🔷'}</span>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{ar ? a.name_ar : a.name}</div>
                    <div className="text-xs text-amber-600 font-semibold">+ {a.price} {ar ? 'ج.م / شهر' : 'EGP/mo'}</div>
                    <div className="text-xs text-gray-400">{ar ? 'مفعّل منذ' : 'Since'}: {new Date(a.activated_at).toLocaleDateString('ar-EG')}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{ar ? 'مفعّل ✓' : 'Active ✓'}</span>
                    <button onClick={() => removeAddon(a.key, ar ? a.name_ar : a.name)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1">
                      {ar ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Addons */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">{ar ? 'التخصصات المتاحة' : 'Available Add-ons'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ADDON_CATALOG.map(addon => {
            const isActive = activeKeys.includes(addon.key);
            return (
              <div key={addon.key}
                className={`p-4 rounded-xl border-2 transition-all ${isActive ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{addon.icon}</span>
                  {isActive && <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{ar ? 'مفعّل' : 'Active'}</span>}
                </div>
                <div className="font-bold text-gray-900 mb-1">{ar ? addon.name : addon.name_en}</div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {addon.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-black text-amber-600">+ {addon.price} <span className="text-xs font-normal text-gray-500">{ar ? 'ج.م/شهر' : 'EGP/mo'}</span></div>
                  {!isActive ? (
                    <button onClick={() => addAddon(addon.key, ar ? addon.name : addon.name_en)}
                      disabled={loading}
                      className="px-3 py-1.5 bg-[#1e3a8a] text-white rounded-lg text-xs font-bold hover:bg-[#1e40af] disabled:opacity-50">
                      {ar ? '+ إضافة' : '+ Add'}
                    </button>
                  ) : (
                    <button onClick={() => removeAddon(addon.key, ar ? addon.name : addon.name_en)}
                      disabled={loading}
                      className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100">
                      {ar ? 'إزالة' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>{ar ? '💡 كيف يعمل؟' : '💡 How it works?'}</strong><br/>
        {ar
          ? 'تُضاف التخصصات فوراً للشريط الجانبي · سعرها يُضاف على فاتورتك الشهرية · يمكن إضافة أكثر من تخصص'
          : 'Add-ons appear in the sidebar immediately · Price is added to your monthly invoice · Multiple add-ons supported'}
      </div>
    </div>
  );
}

export default CompanySettings;
