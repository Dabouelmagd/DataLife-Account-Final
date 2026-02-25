import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Building2, User, Key, Globe, Users } from 'lucide-react';
import axios from 'axios';

// Import refactored components
import {
  CompanyTab,
  ProfileTab,
  EmployeesTab,
  PermissionModal,
  InviteModal,
  SubscriptionTab,
  LanguageTab,
  getAvailableRoles,
  getAvailablePermissions,
  MANAGEMENT_ROLES
} from './settings';

const CompanySettings = () => {
  const { user } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [company, setCompany] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [activeTab, setActiveTab] = useState('company');
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
  
  const isRTL = language === 'ar';
  const canManageEmployees = MANAGEMENT_ROLES.includes(user?.role);
  const canUploadLogo = MANAGEMENT_ROLES.includes(user?.role);
  const subscriptionCode = user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase() || '--------';
  
  const availableRoles = getAvailableRoles(language);
  const availablePermissions = getAvailablePermissions(language);

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

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

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
      
      const updatedUser = { ...user, profile_photo: response.data.photo_url };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
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
      
      // Force refresh company data and reload page to show new logo
      await fetchCompanyData();
      
      // Add cache-busting and reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    { id: 'subscription', label: language === 'ar' ? 'الاشتراك' : 'Subscription', icon: Key },
    { id: 'language', label: language === 'ar' ? 'اللغة' : 'Language', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold text-[#28376B] mb-6">
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {activeTab === 'language' && (
          <LanguageTab
            language={language}
            toggleLanguage={toggleLanguage}
          />
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
  );
};

export default CompanySettings;
