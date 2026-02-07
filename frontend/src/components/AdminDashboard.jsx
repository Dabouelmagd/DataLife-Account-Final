import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  ArrowLeft, ArrowRight, Building2, Users, CreditCard, DollarSign,
  Gift, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle,
  RefreshCw, Plus, Trash2, Copy, AlertCircle, Loader2,
  Calendar, BarChart3, Settings, ChevronDown, Power, Mail, 
  Send, Eye, UserX, UserCheck, Bell, Shield, Save, MessageSquare, Briefcase,
  LogOut, Globe, LayoutDashboard
} from 'lucide-react';
import axios from 'axios';
import CompanyLogo from './CompanyLogo';

const AdminDashboard = () => {
  const { token, user, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activationCodes, setActivationCodes] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  // Generate code form
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    plan: 'starter',
    duration: '12_months',
    discount_percent: 0,
    count: 1,
    prefix: 'DL',
    company_name: '',
    contract_start: '',
    contract_end: ''
  });
  const [generating, setGenerating] = useState(false);
  
  // Notification form
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    target_type: 'all',
    target_id: '',
    subject: '',
    message: ''
  });
  const [sendingNotification, setSendingNotification] = useState(false);
  
  // Selected company for viewing users
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Permission editing
  const [editingUserPermissions, setEditingUserPermissions] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // All users tab
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Contact messages tab
  const [contactMessages, setContactMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  
  // Role editing
  const [editingUserRole, setEditingUserRole] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const t = {
    title: isRTL ? 'لوحة تحكم الإدارة' : 'Admin Dashboard',
    back: isRTL ? 'رجوع' : 'Back',
    overview: isRTL ? 'نظرة عامة' : 'Overview',
    subscriptions: isRTL ? 'الاشتراكات' : 'Subscriptions',
    transactions: isRTL ? 'المدفوعات' : 'Transactions',
    codes: isRTL ? 'أكواد التفعيل' : 'Activation Codes',
    companies: isRTL ? 'الشركات' : 'Companies',
    totalCompanies: isRTL ? 'إجمالي الشركات' : 'Total Companies',
    totalUsers: isRTL ? 'إجمالي المستخدمين' : 'Total Users',
    activeSubscriptions: isRTL ? 'الاشتراكات النشطة' : 'Active Subscriptions',
    totalRevenue: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue',
    monthlyRevenue: isRTL ? 'إيرادات الشهر' : 'Monthly Revenue',
    activeCodes: isRTL ? 'أكواد نشطة' : 'Active Codes',
    expiringSoon: isRTL ? 'تنتهي قريباً' : 'Expiring Soon',
    recentTransactions: isRTL ? 'آخر المعاملات' : 'Recent Transactions',
    planBreakdown: isRTL ? 'توزيع الخطط' : 'Plan Breakdown',
    generateCode: isRTL ? 'إنشاء كود' : 'Generate Code',
    bulkGenerate: isRTL ? 'إنشاء مجموعة' : 'Bulk Generate',
    plan: isRTL ? 'الخطة' : 'Plan',
    duration: isRTL ? 'المدة' : 'Duration',
    discount: isRTL ? 'الخصم' : 'Discount',
    count: isRTL ? 'العدد' : 'Count',
    prefix: isRTL ? 'البادئة' : 'Prefix',
    generate: isRTL ? 'إنشاء' : 'Generate',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    code: isRTL ? 'الكود' : 'Code',
    uses: isRTL ? 'الاستخدامات' : 'Uses',
    status: isRTL ? 'الحالة' : 'Status',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    active: isRTL ? 'نشط' : 'Active',
    inactive: isRTL ? 'غير نشط' : 'Inactive',
    paid: isRTL ? 'مدفوع' : 'Paid',
    pending: isRTL ? 'معلق' : 'Pending',
    failed: isRTL ? 'فشل' : 'Failed',
    company: isRTL ? 'الشركة' : 'Company',
    email: isRTL ? 'البريد' : 'Email',
    amount: isRTL ? 'المبلغ' : 'Amount',
    date: isRTL ? 'التاريخ' : 'Date',
    daysLeft: isRTL ? 'أيام متبقية' : 'Days Left',
    endDate: isRTL ? 'تاريخ الانتهاء' : 'End Date',
    userCount: isRTL ? 'عدد المستخدمين' : 'Users',
    copied: isRTL ? 'تم النسخ!' : 'Copied!',
    currency: isRTL ? 'ج.م' : 'EGP',
    suspend: isRTL ? 'إيقاف' : 'Suspend',
    activate: isRTL ? 'تفعيل' : 'Activate',
    suspended: isRTL ? 'موقوف' : 'Suspended',
    viewUsers: isRTL ? 'عرض المستخدمين' : 'View Users',
    sendNotification: isRTL ? 'إرسال إشعار' : 'Send Notification',
    subject: isRTL ? 'الموضوع' : 'Subject',
    message: isRTL ? 'الرسالة' : 'Message',
    send: isRTL ? 'إرسال' : 'Send',
    targetType: isRTL ? 'نوع الهدف' : 'Target Type',
    allUsers: isRTL ? 'جميع المستخدمين' : 'All Users',
    specificCompany: isRTL ? 'شركة محددة' : 'Specific Company',
    specificUser: isRTL ? 'مستخدم محدد' : 'Specific User',
    companyUsers: isRTL ? 'مستخدمو الشركة' : 'Company Users',
    close: isRTL ? 'إغلاق' : 'Close',
    role: isRTL ? 'الدور' : 'Role',
    lastLogin: isRTL ? 'آخر دخول' : 'Last Login',
    editPermissions: isRTL ? 'تعديل الصلاحيات' : 'Edit Permissions',
    permissions: isRTL ? 'الصلاحيات' : 'Permissions',
    savePermissions: isRTL ? 'حفظ الصلاحيات' : 'Save Permissions',
    permissionsUpdated: isRTL ? 'تم تحديث الصلاحيات بنجاح' : 'Permissions updated successfully',
    selectAll: isRTL ? 'تحديد الكل' : 'Select All',
    deselectAll: isRTL ? 'إلغاء تحديد الكل' : 'Deselect All'
  };

  const planNames = {
    starter: isRTL ? 'المبتدئ' : 'Starter',
    professional: isRTL ? 'المحترف' : 'Professional',
    enterprise: isRTL ? 'المؤسسي' : 'Enterprise'
  };

  const durationNames = {
    '3_months': isRTL ? '3 أشهر' : '3 Months',
    '6_months': isRTL ? '6 أشهر' : '6 Months',
    '9_months': isRTL ? '9 أشهر' : '9 Months',
    '12_months': isRTL ? 'سنة' : '1 Year',
    'lifetime': isRTL ? 'مدى الحياة' : 'Lifetime'
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Fetch new messages count every minute
  useEffect(() => {
    const fetchNewMessagesCount = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`${API_URL}/api/contact/messages`, config);
        const newCount = response.data.filter(m => !m.read).length;
        setNewMessagesCount(newCount);
      } catch (error) {
        console.error('Error fetching messages count:', error);
      }
    };
    
    fetchNewMessagesCount();
    const interval = setInterval(fetchNewMessagesCount, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (activeTab === 'overview' || !dashboardData) {
        const dashRes = await axios.get(`${API_URL}/api/admin/dashboard`, config);
        setDashboardData(dashRes.data);
        
        // Also fetch messages count for overview
        try {
          const messagesRes = await axios.get(`${API_URL}/api/contact/messages`, config);
          setContactMessages(messagesRes.data);
          setNewMessagesCount(messagesRes.data.filter(m => !m.read).length);
        } catch (e) {
          console.error('Error fetching messages:', e);
        }
      }
      
      if (activeTab === 'subscriptions') {
        const subsRes = await axios.get(`${API_URL}/api/admin/subscriptions`, config);
        setSubscriptions(subsRes.data);
      }
      
      if (activeTab === 'transactions') {
        const transRes = await axios.get(`${API_URL}/api/admin/transactions`, config);
        setTransactions(transRes.data);
      }
      
      if (activeTab === 'codes') {
        const codesRes = await axios.get(`${API_URL}/api/admin/activation-codes`, config);
        setActivationCodes(codesRes.data);
      }
      
      if (activeTab === 'companies') {
        const companiesRes = await axios.get(`${API_URL}/api/admin/companies`, config);
        setCompanies(companiesRes.data);
      }
      
      if (activeTab === 'users') {
        const usersRes = await axios.get(`${API_URL}/api/admin/all-users`, config);
        setAllUsers(usersRes.data);
        setFilteredUsers(usersRes.data);
      }
      
      if (activeTab === 'messages') {
        setLoadingMessages(true);
        const messagesRes = await axios.get(`${API_URL}/api/contact/messages`, config);
        setContactMessages(messagesRes.data);
        setLoadingMessages(false);
        
        // Mark all messages as read
        const unreadCount = messagesRes.data.filter(m => !m.read).length;
        if (unreadCount > 0) {
          await axios.put(`${API_URL}/api/contact/messages/mark-read`, {}, config);
          setNewMessagesCount(0);
          // Update local state to reflect read status
          setContactMessages(prev => prev.map(m => ({ ...m, read: true })));
        }
      }
    } catch (error) {
      // Error fetching data
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCodes = async () => {
    setGenerating(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (generateForm.count > 1) {
        await axios.post(`${API_URL}/api/admin/activation-codes/bulk-generate`, generateForm, config);
      } else {
        await axios.post(`${API_URL}/api/admin/activation-codes/generate`, generateForm, config);
      }
      
      setShowGenerateForm(false);
      fetchData();
    } catch (error) {
      // Error generating
    } finally {
      setGenerating(false);
    }
  };

  const toggleCodeStatus = async (code) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/api/admin/activation-codes/${code}/toggle`, {}, config);
      fetchData();
    } catch (error) {
      // Error toggling
    }
  };

  const deleteCode = async (code) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/api/admin/activation-codes/${code}`, config);
      fetchData();
    } catch (error) {
      // Error deleting
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToastMessage(t.copied, 'success');
  };

  const showToastMessage = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const toggleCompanyStatus = async (companyId, currentStatus) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.put(`${API_URL}/api/admin/companies/${companyId}/toggle`, {}, config);
      showToastMessage(response.data.message, 'success');
      fetchData();
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ' : 'Error occurred', 'error');
    }
  };

  const toggleUserStatus = async (userId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/api/admin/users/${userId}/toggle`, {}, config);
      // Refresh company users
      if (selectedCompany) {
        fetchCompanyUsers(selectedCompany.id);
      }
      showToastMessage(isRTL ? 'تم تحديث حالة المستخدم' : 'User status updated', 'success');
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ' : 'Error occurred', 'error');
    }
  };

  const fetchCompanyUsers = async (companyId) => {
    setLoadingUsers(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${API_URL}/api/admin/companies/${companyId}/users`, config);
      setCompanyUsers(response.data);
    } catch (error) {
      setCompanyUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleViewCompanyUsers = async (company) => {
    setSelectedCompany(company);
    await fetchCompanyUsers(company.id);
  };

  const handleSendNotification = async () => {
    if (!notificationForm.message) {
      showToastMessage(isRTL ? 'الرسالة مطلوبة' : 'Message is required', 'error');
      return;
    }
    
    setSendingNotification(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(`${API_URL}/api/admin/send-notification`, notificationForm, config);
      showToastMessage(
        isRTL ? `تم إرسال الإشعار إلى ${response.data.emails_sent} مستخدم` : `Notification sent to ${response.data.emails_sent} users`,
        'success'
      );
      setShowNotificationForm(false);
      setNotificationForm({ target_type: 'all', target_id: '', subject: '', message: '' });
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ في الإرسال' : 'Error sending notification', 'error');
    } finally {
      setSendingNotification(false);
    }
  };

  // Fetch available permissions
  const fetchAvailablePermissions = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${API_URL}/api/admin/permissions`, config);
      setAvailablePermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  // Open edit permissions modal
  const handleEditPermissions = async (user) => {
    setEditingUserPermissions(user);
    setUserPermissions(user.permissions || []);
    
    // Fetch available permissions if not loaded
    if (availablePermissions.length === 0) {
      await fetchAvailablePermissions();
    }
  };

  // Toggle a permission
  const togglePermission = (permId) => {
    setUserPermissions(prev => {
      if (prev.includes(permId)) {
        return prev.filter(p => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
  };

  // Save user permissions
  const handleSavePermissions = async () => {
    if (!editingUserPermissions) return;
    
    setSavingPermissions(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(
        `${API_URL}/api/admin/users/${editingUserPermissions.id}/permissions`,
        { permissions: userPermissions },
        config
      );
      
      showToastMessage(t.permissionsUpdated, 'success');
      
      // Update the user in the local state
      setCompanyUsers(prev => prev.map(u => 
        u.id === editingUserPermissions.id 
          ? { ...u, permissions: userPermissions }
          : u
      ));
      
      setEditingUserPermissions(null);
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ في الحفظ' : 'Error saving permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Select/Deselect all permissions
  const selectAllPermissions = () => {
    setUserPermissions(availablePermissions.map(p => p.id));
  };

  const deselectAllPermissions = () => {
    setUserPermissions([]);
  };

  // Fetch available roles
  const fetchAvailableRoles = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${API_URL}/api/admin/roles`, config);
      setAvailableRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  // Open edit role modal
  const handleEditRole = async (user) => {
    setEditingUserRole(user);
    setSelectedRole(user.role || '');
    
    if (availableRoles.length === 0) {
      await fetchAvailableRoles();
    }
  };

  // Save user role
  const handleSaveRole = async () => {
    if (!editingUserRole || !selectedRole) return;
    
    setSavingRole(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(
        `${API_URL}/api/admin/users/${editingUserRole.id}/role`,
        { role: selectedRole },
        config
      );
      
      showToastMessage(isRTL ? 'تم تغيير الوظيفة بنجاح' : 'Role updated successfully', 'success');
      
      // Update local state
      setAllUsers(prev => prev.map(u => 
        u.id === editingUserRole.id ? { ...u, role: selectedRole } : u
      ));
      setFilteredUsers(prev => prev.map(u => 
        u.id === editingUserRole.id ? { ...u, role: selectedRole } : u
      ));
      setCompanyUsers(prev => prev.map(u => 
        u.id === editingUserRole.id ? { ...u, role: selectedRole } : u
      ));
      
      setEditingUserRole(null);
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ في تغيير الوظيفة' : 'Error updating role', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  // Filter users based on search query
  const handleUserSearch = (query) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(u => 
        u.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email?.toLowerCase().includes(query.toLowerCase()) ||
        u.company_name?.toLowerCase().includes(query.toLowerCase()) ||
        u.role?.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  const tabs = [
    { id: 'overview', label: t.overview, icon: BarChart3 },
    { id: 'subscriptions', label: t.subscriptions, icon: CreditCard },
    { id: 'transactions', label: t.transactions, icon: DollarSign },
    { id: 'codes', label: t.codes, icon: Gift },
    { id: 'companies', label: t.companies, icon: Building2 },
    { id: 'users', label: isRTL ? 'جميع المستخدمين' : 'All Users', icon: Users },
    { id: 'messages', label: isRTL ? 'الرسائل' : 'Messages', icon: Mail, badge: newMessagesCount }
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US');
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} ${t.currency}`;
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {toast.message}
        </div>
      )}

      {/* Admin Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-800 to-slate-900 text-white min-h-screen flex flex-col print:hidden">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg">DataLife</h1>
              <p className="text-xs text-gray-400">{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-600 rounded-full flex items-center justify-center font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.full_name || 'Admin'}</p>
              <Badge className="bg-red-500/20 text-red-300 text-xs">Super Admin</Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
          >
            <Globe className="h-4 w-4" />
            <span className="text-sm flex-1 text-start">{isRTL ? 'English' : 'عربي'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tabs.find(t => t.id === activeTab)?.label || t.title}
              </h1>
              <p className="text-gray-500 text-sm">
                {isRTL ? 'إدارة النظام والمستخدمين' : 'System and user management'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {isRTL ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">

        {/* Overview Tab */}
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <Building2 className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{dashboardData.statistics.total_companies}</p>
                  <p className="text-sm opacity-80">{t.totalCompanies}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <Users className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{dashboardData.statistics.total_users}</p>
                  <p className="text-sm opacity-80">{t.totalUsers}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <CreditCard className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{dashboardData.statistics.active_subscriptions}</p>
                  <p className="text-sm opacity-80">{t.activeSubscriptions}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <CardContent className="p-4">
                  <DollarSign className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{formatCurrency(dashboardData.statistics.total_revenue)}</p>
                  <p className="text-sm opacity-80">{t.totalRevenue}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
                <CardContent className="p-4">
                  <TrendingUp className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{formatCurrency(dashboardData.statistics.monthly_revenue)}</p>
                  <p className="text-sm opacity-80">{t.monthlyRevenue}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
                <CardContent className="p-4">
                  <Gift className="h-8 w-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{dashboardData.statistics.active_codes}</p>
                  <p className="text-sm opacity-80">{t.activeCodes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Messages Card - Separate Row */}
            <Card 
              className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white cursor-pointer hover:shadow-xl transition-all"
              onClick={() => setActiveTab('messages')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{isRTL ? 'رسائل الاتصال' : 'Contact Messages'}</h3>
                      <p className="text-blue-100 text-sm">{isRTL ? 'اضغط لعرض جميع الرسائل' : 'Click to view all messages'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {newMessagesCount > 0 && (
                      <div className="text-center">
                        <p className="text-3xl font-bold">{newMessagesCount}</p>
                        <p className="text-sm opacity-80">{isRTL ? 'جديدة' : 'New'}</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-3xl font-bold">{contactMessages.length}</p>
                      <p className="text-sm opacity-80">{isRTL ? 'إجمالي' : 'Total'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Breakdown & Expiring Soon */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.planBreakdown}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.plan_breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="font-medium">{planNames[item.plan] || item.plan}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                    {dashboardData.plan_breakdown.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        {isRTL ? 'لا توجد اشتراكات' : 'No subscriptions yet'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    {t.expiringSoon}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData.expiring_soon.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.company_id}</p>
                          <p className="text-sm text-gray-500">{planNames[item.plan]}</p>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {item.days_left} {t.daysLeft}
                        </Badge>
                      </div>
                    ))}
                    {dashboardData.expiring_soon.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        {isRTL ? 'لا توجد اشتراكات تنتهي قريباً' : 'No subscriptions expiring soon'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>{t.recentTransactions}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.plan}</TableHead>
                      <TableHead>{t.amount}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.date}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recent_transactions.map((tx, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{tx.user_email || '-'}</TableCell>
                        <TableCell>{planNames[tx.plan] || tx.plan}</TableCell>
                        <TableCell>{formatCurrency(tx.amount_egp)}</TableCell>
                        <TableCell>
                          <Badge className={tx.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {tx.payment_status === 'paid' ? t.paid : t.pending}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <Card>
            <CardHeader>
              <CardTitle>{t.subscriptions}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.company}</TableHead>
                    <TableHead>{t.plan}</TableHead>
                    <TableHead>{t.duration}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.endDate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.company_name || sub.company_id}</p>
                          <p className="text-sm text-gray-500">{sub.company_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{planNames[sub.plan] || sub.plan}</TableCell>
                      <TableCell>{durationNames[sub.duration] || sub.duration}</TableCell>
                      <TableCell>
                        <Badge className={sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {sub.status === 'active' ? t.active : t.inactive}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(sub.end_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>{t.transactions}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.email}</TableHead>
                    <TableHead>{t.plan}</TableHead>
                    <TableHead>{t.amount}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.date}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{tx.user_email || '-'}</TableCell>
                      <TableCell>{planNames[tx.plan] || tx.plan}</TableCell>
                      <TableCell>{formatCurrency(tx.amount_egp)}</TableCell>
                      <TableCell>
                        <Badge className={
                          tx.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                          tx.payment_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {tx.payment_status === 'paid' ? t.paid : 
                           tx.payment_status === 'pending' ? t.pending : t.failed}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(tx.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Activation Codes Tab */}
        {activeTab === 'codes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{t.codes}</h2>
              <Button onClick={() => setShowGenerateForm(true)} data-testid="generate-code-btn">
                <Plus className="h-4 w-4 mr-2" />
                {t.generateCode}
              </Button>
            </div>

            {/* Generate Form Modal */}
            {showGenerateForm && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle>{t.generateCode}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-5 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t.plan}</label>
                      <select
                        value={generateForm.plan}
                        onChange={(e) => setGenerateForm({...generateForm, plan: e.target.value})}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.duration}</label>
                      <select
                        value={generateForm.duration}
                        onChange={(e) => setGenerateForm({...generateForm, duration: e.target.value})}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="3_months">3 Months</option>
                        <option value="6_months">6 Months</option>
                        <option value="9_months">9 Months</option>
                        <option value="12_months">1 Year</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.discount} %</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={generateForm.discount_percent}
                        onChange={(e) => setGenerateForm({...generateForm, discount_percent: parseInt(e.target.value) || 0})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.count}</label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={generateForm.count}
                        onChange={(e) => setGenerateForm({...generateForm, count: parseInt(e.target.value) || 1})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.prefix}</label>
                      <Input
                        value={generateForm.prefix}
                        onChange={(e) => setGenerateForm({...generateForm, prefix: e.target.value.toUpperCase()})}
                        className="mt-1"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  
                  {/* New Fields: Company Name & Contract Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-blue-800">{isRTL ? 'اسم الشركة' : 'Company Name'}</label>
                      <Input
                        value={generateForm.company_name}
                        onChange={(e) => setGenerateForm({...generateForm, company_name: e.target.value})}
                        className="mt-1"
                        placeholder={isRTL ? 'أدخل اسم الشركة' : 'Enter company name'}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-blue-800">{isRTL ? 'بداية التعاقد' : 'Contract Start'}</label>
                      <Input
                        type="date"
                        value={generateForm.contract_start}
                        onChange={(e) => setGenerateForm({...generateForm, contract_start: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-blue-800">{isRTL ? 'نهاية التعاقد' : 'Contract End'}</label>
                      <Input
                        type="date"
                        value={generateForm.contract_end}
                        onChange={(e) => setGenerateForm({...generateForm, contract_end: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleGenerateCodes} disabled={generating}>
                      {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {t.generate}
                    </Button>
                    <Button variant="outline" onClick={() => setShowGenerateForm(false)}>
                      {t.cancel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.code}</TableHead>
                      <TableHead>{isRTL ? 'اسم الشركة' : 'Company'}</TableHead>
                      <TableHead>{t.plan}</TableHead>
                      <TableHead>{isRTL ? 'بداية التعاقد' : 'Start'}</TableHead>
                      <TableHead>{isRTL ? 'نهاية التعاقد' : 'End'}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activationCodes.map((code, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                              {code.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(code.code)}
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={code.company_name ? 'font-medium' : 'text-gray-400'}>
                            {code.company_name || (isRTL ? 'غير محدد' : 'Not set')}
                          </span>
                        </TableCell>
                        <TableCell>{planNames[code.plan] || code.plan}</TableCell>
                        <TableCell>
                          {code.contract_start ? (
                            <span className="text-green-600">{code.contract_start}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {code.contract_end ? (
                            <span className="text-red-600">{code.contract_end}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={code.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {code.is_active ? t.active : t.inactive}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCodeStatus(code.code)}
                              className="h-8 w-8 p-0"
                            >
                              {code.is_active ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCode(code.code)}
                              className="h-8 w-8 p-0 text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{t.companies}</h2>
              <Button onClick={() => setShowNotificationForm(true)}>
                <Bell className="h-4 w-4 mr-2" />
                {t.sendNotification}
              </Button>
            </div>

            {/* Notification Form Modal */}
            {showNotificationForm && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    {t.sendNotification}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t.targetType}</label>
                      <select
                        value={notificationForm.target_type}
                        onChange={(e) => setNotificationForm({...notificationForm, target_type: e.target.value})}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="all">{t.allUsers}</option>
                        <option value="company">{t.specificCompany}</option>
                        <option value="user">{t.specificUser}</option>
                      </select>
                    </div>
                    {notificationForm.target_type !== 'all' && (
                      <div>
                        <label className="text-sm font-medium">ID</label>
                        <Input
                          value={notificationForm.target_id}
                          onChange={(e) => setNotificationForm({...notificationForm, target_id: e.target.value})}
                          className="mt-1"
                          placeholder={notificationForm.target_type === 'company' ? 'Company ID' : 'User ID'}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t.subject}</label>
                    <Input
                      value={notificationForm.subject}
                      onChange={(e) => setNotificationForm({...notificationForm, subject: e.target.value})}
                      className="mt-1"
                      placeholder={isRTL ? 'موضوع الإشعار' : 'Notification subject'}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t.message}</label>
                    <textarea
                      value={notificationForm.message}
                      onChange={(e) => setNotificationForm({...notificationForm, message: e.target.value})}
                      className="w-full mt-1 p-2 border rounded-lg min-h-[100px]"
                      placeholder={isRTL ? 'نص الرسالة...' : 'Message text...'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSendNotification} disabled={sendingNotification}>
                      {sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      {t.send}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNotificationForm(false)}>
                      {t.cancel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Users Modal */}
            {selectedCompany && (
              <Card className="border-2 border-purple-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    {t.companyUsers}: {selectedCompany.name}
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedCompany(null)}>
                    <XCircle className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                          <TableHead>{t.email}</TableHead>
                          <TableHead>{t.role}</TableHead>
                          <TableHead>{t.status}</TableHead>
                          <TableHead>{t.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyUsers.map((user, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {user.is_active ? t.active : t.suspended}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditPermissions(user)}
                                  className="text-blue-600 hover:text-blue-700"
                                  title={t.editPermissions}
                                  data-testid={`edit-permissions-${user.id}`}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleUserStatus(user.id)}
                                  className={user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                                >
                                  {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Edit Permissions Modal */}
            {editingUserPermissions && (
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    {t.editPermissions}: {editingUserPermissions.full_name}
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setEditingUserPermissions(null)}>
                    <XCircle className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* User Info */}
                    <div className="flex items-center gap-4 p-3 bg-white rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{editingUserPermissions.full_name}</p>
                        <p className="text-sm text-gray-500">{editingUserPermissions.email}</p>
                      </div>
                      <Badge variant="outline">{editingUserPermissions.role}</Badge>
                    </div>

                    {/* Select All / Deselect All Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllPermissions}
                        data-testid="select-all-permissions"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t.selectAll}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={deselectAllPermissions}
                        data-testid="deselect-all-permissions"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {t.deselectAll}
                      </Button>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {availablePermissions.map((perm) => (
                        <div
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            userPermissions.includes(perm.id)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          data-testid={`permission-${perm.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              userPermissions.includes(perm.id)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {userPermissions.includes(perm.id) && (
                                <CheckCircle className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm font-medium">
                              {isRTL ? perm.name_ar : perm.name_en}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Current Permissions Count */}
                    <div className="text-sm text-gray-500 text-center">
                      {isRTL 
                        ? `الصلاحيات المحددة: ${userPermissions.length} من ${availablePermissions.length}`
                        : `Selected: ${userPermissions.length} of ${availablePermissions.length} permissions`
                      }
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button 
                        variant="outline" 
                        onClick={() => setEditingUserPermissions(null)}
                      >
                        {t.cancel}
                      </Button>
                      <Button 
                        onClick={handleSavePermissions} 
                        disabled={savingPermissions}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="save-permissions-btn"
                      >
                        {savingPermissions ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {t.savePermissions}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.company}</TableHead>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.userCount}</TableHead>
                      <TableHead>{t.plan}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.endDate}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company, idx) => (
                      <TableRow key={idx} className={!company.is_active && company.is_active !== undefined ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.contact_email || company.owner_email}</TableCell>
                        <TableCell>
                          <span className="font-medium">{company.active_users || company.user_count}</span>
                          <span className="text-gray-400">/{company.user_count}</span>
                        </TableCell>
                        <TableCell>
                          {company.subscription ? planNames[company.subscription.plan] || company.subscription.plan : '-'}
                        </TableCell>
                        <TableCell>
                          {company.is_active === false ? (
                            <Badge className="bg-red-100 text-red-700">{t.suspended}</Badge>
                          ) : company.subscription ? (
                            <Badge className={company.subscription.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                              {company.subscription.status === 'active' ? t.active : t.inactive}
                            </Badge>
                          ) : (
                            <Badge variant="outline">-</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {company.subscription ? formatDate(company.subscription.end_date) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCompanyUsers(company)}
                              title={t.viewUsers}
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                              className={company.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                              title={company.is_active !== false ? t.suspend : t.activate}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* All Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      placeholder={isRTL ? 'بحث بالاسم، البريد، الشركة...' : 'Search by name, email, company...'}
                      className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      data-testid="user-search-input"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="h-5 w-5" />
                    {filteredUsers.length} {isRTL ? 'مستخدم' : 'users'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.company}</TableHead>
                      <TableHead>{isRTL ? 'الدور' : 'Role'}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{isRTL ? 'الصلاحيات' : 'Permissions'}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((usr, idx) => (
                      <TableRow key={idx} className={!usr.is_active ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">{usr.full_name || '-'}</TableCell>
                        <TableCell>{usr.email}</TableCell>
                        <TableCell>{usr.company_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{usr.role || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={usr.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {usr.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معلق' : 'Suspended')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-500">
                            {usr.permissions?.length || 0} {isRTL ? 'صلاحية' : 'perms'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(usr)}
                              className="text-orange-600 hover:text-orange-700"
                              title={isRTL ? 'تغيير الوظيفة' : 'Change Role'}
                              data-testid={`edit-role-${usr.id}`}
                            >
                              <Briefcase className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPermissions(usr)}
                              className="text-blue-600 hover:text-blue-700"
                              title={t.editPermissions}
                              data-testid={`edit-user-permissions-${usr.id}`}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {/* Header */}
            <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{isRTL ? 'رسائل الاتصال' : 'Contact Messages'}</h2>
                      <p className="text-blue-100">{isRTL ? 'إدارة رسائل الزوار والعملاء' : 'Manage visitor and customer messages'}</p>
                    </div>
                  </div>
                  <Badge className="bg-white/20 text-white text-lg px-4 py-2">
                    {contactMessages.length} {isRTL ? 'رسالة' : 'messages'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Messages List */}
            {loadingMessages ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : contactMessages.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    {isRTL ? 'لا توجد رسائل' : 'No Messages Yet'}
                  </h3>
                  <p className="text-gray-500">
                    {isRTL ? 'ستظهر رسائل الزوار هنا' : 'Visitor messages will appear here'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {contactMessages.map((msg, idx) => (
                  <Card key={idx} className={`hover:shadow-lg transition-all ${!msg.read ? 'border-l-4 border-l-blue-500' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                              {msg.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{msg.name}</h3>
                              <a href={`mailto:${msg.email}`} className="text-blue-600 hover:underline text-sm">
                                {msg.email}
                              </a>
                            </div>
                            {!msg.read && (
                              <Badge className="bg-blue-100 text-blue-700">
                                {isRTL ? 'جديد' : 'New'}
                              </Badge>
                            )}
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg mt-3">
                            <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {new Date(msg.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `mailto:${msg.email}?subject=رد على استفسارك - DataLife`}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            {isRTL ? 'رد' : 'Reply'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Permissions Modal - Shared across tabs */}
        {editingUserPermissions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full border-2 border-blue-200 bg-white shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t.editPermissions}: {editingUserPermissions.full_name}
                </CardTitle>
                <Button variant="ghost" onClick={() => setEditingUserPermissions(null)} className="text-white hover:bg-white/20">
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium">{editingUserPermissions.full_name}</p>
                      <p className="text-sm text-gray-500">{editingUserPermissions.email}</p>
                    </div>
                    <Badge variant="outline">{editingUserPermissions.role}</Badge>
                  </div>

                  {/* Select All / Deselect All Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllPermissions}
                      data-testid="select-all-permissions-modal"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t.selectAll}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={deselectAllPermissions}
                      data-testid="deselect-all-permissions-modal"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {t.deselectAll}
                    </Button>
                  </div>

                  {/* Permissions Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {availablePermissions.map((perm) => (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          userPermissions.includes(perm.id)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        data-testid={`modal-permission-${perm.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            userPermissions.includes(perm.id)
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {userPermissions.includes(perm.id) && (
                              <CheckCircle className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {isRTL ? perm.name_ar : perm.name_en}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Current Permissions Count */}
                  <div className="text-sm text-gray-500 text-center">
                    {isRTL 
                      ? `الصلاحيات المحددة: ${userPermissions.length} من ${availablePermissions.length}`
                      : `Selected: ${userPermissions.length} of ${availablePermissions.length} permissions`
                    }
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingUserPermissions(null)}
                    >
                      {t.cancel}
                    </Button>
                    <Button 
                      onClick={handleSavePermissions} 
                      disabled={savingPermissions}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="save-permissions-modal-btn"
                    >
                      {savingPermissions ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {t.savePermissions}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Role Modal */}
        {editingUserRole && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full border-2 border-orange-200 bg-white shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  {isRTL ? 'تغيير الوظيفة' : 'Change Role'}
                </CardTitle>
                <Button variant="ghost" onClick={() => setEditingUserRole(null)} className="text-white hover:bg-white/20">
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold">
                      {editingUserRole.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{editingUserRole.full_name}</p>
                      <p className="text-sm text-gray-500">{editingUserRole.email}</p>
                    </div>
                  </div>

                  {/* Current Role */}
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-700">
                      {isRTL ? 'الوظيفة الحالية:' : 'Current Role:'} <strong>{editingUserRole.role}</strong>
                    </p>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {isRTL ? 'اختر الوظيفة الجديدة:' : 'Select New Role:'}
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      data-testid="role-select"
                    >
                      <option value="">{isRTL ? '-- اختر وظيفة --' : '-- Select Role --'}</option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {isRTL ? role.name_ar : role.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingUserRole(null)}
                    >
                      {t.cancel}
                    </Button>
                    <Button 
                      onClick={handleSaveRole} 
                      disabled={savingRole || !selectedRole || selectedRole === editingUserRole.role}
                      className="bg-orange-600 hover:bg-orange-700"
                      data-testid="save-role-btn"
                    >
                      {savingRole ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isRTL ? 'حفظ التغيير' : 'Save Change'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
