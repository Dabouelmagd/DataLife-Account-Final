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
  LogOut, Globe, LayoutDashboard, History, Crown, Sparkles, Zap, Star, HeartPulse,
  BookOpen,
  Search, SortAsc, SortDesc, Filter, Key
} from 'lucide-react';
import axios from 'axios';
import CompanyLogo from './CompanyLogo';
import AuditLogPage from '../pages/AuditLogPage';
import NotificationBell from './NotificationBell';

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
  
  // Payments tab
  const [paymentsData, setPaymentsData] = useState({ subscriptions: [], summary: {} });
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Subscription search
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState('');
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  
  // Role editing
  const [editingUserRole, setEditingUserRole] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  
  // Subscription status editing
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [savingSubscription, setSavingSubscription] = useState(false);
  
  // Subscription Assignment Modal
  const [assigningSubscription, setAssigningSubscription] = useState(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState('professional');
  const [subscriptionDuration, setSubscriptionDuration] = useState('monthly');
  const [assigningLoading, setAssigningLoading] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const t = {
    title: isRTL ? 'لوحة تحكم الإدارة' : 'Admin Dashboard',
    back: isRTL ? 'رجوع' : 'Back',
    overview: isRTL ? 'نظرة عامة' : 'Overview',
    subscriptions: isRTL ? 'الاشتراكات' : 'Subscriptions',
    transactions: isRTL ? 'المعاملات' : 'Transactions',
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

  // Subscription prices
  const PLAN_PRICES = {
    starter: { monthly: 299, quarterly: 799, yearly: 2990, lifetime: 9990 },
    professional: { monthly: 799, quarterly: 2199, yearly: 7990, lifetime: 24990 },
    enterprise: { monthly: 1499, quarterly: 3999, yearly: 14990, lifetime: 50000 }
  };

  const durationNames = {
    monthly: isRTL ? 'شهري' : 'Monthly',
    quarterly: isRTL ? 'ربع سنوي' : 'Quarterly',
    yearly: isRTL ? 'سنوي' : 'Yearly',
    lifetime: isRTL ? 'مدى الحياة' : 'Lifetime',
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
      
      if (activeTab === 'payments') {
        setLoadingPayments(true);
        try {
          const paymentsRes = await axios.get(`${API_URL}/api/admin/payments/subscriptions?status=${paymentFilter}&search=${paymentSearch}`, config);
          setPaymentsData(paymentsRes.data);
          
          // Get payment methods from admin API
          const methodsRes = await axios.get(`${API_URL}/api/admin/payments/methods`);
          setPaymentMethods(methodsRes.data || []);
        } catch (e) {
          console.error('Error fetching payments:', e);
          // Set default payment methods if API fails
          setPaymentMethods([
            { id: 'cash', name: 'Cash', name_ar: 'نقدي', icon: '💵' },
            { id: 'credit_card', name: 'Credit Card', name_ar: 'بطاقة ائتمان', icon: '💳' },
            { id: 'bank_transfer', name: 'Bank Transfer', name_ar: 'تحويل بنكي', icon: '🏦' },
            { id: 'instapay', name: 'InstaPay', name_ar: 'إنستاباي', icon: '📱' },
            { id: 'vodafone_cash', name: 'Vodafone Cash', name_ar: 'فودافون كاش', icon: '📲' },
            { id: 'activation_code', name: 'Activation Code', name_ar: 'كود تفعيل', icon: '🔑' },
          ]);
        }
        setLoadingPayments(false);
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

  // Update company subscription status
  const handleUpdateSubscription = async (companyId) => {
    if (!subscriptionStatus) return;
    
    setSavingSubscription(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/api/admin/companies/${companyId}/subscription`, 
        { subscription_status: subscriptionStatus },
        config
      );
      showToastMessage(isRTL ? 'تم تحديث حالة الاشتراك بنجاح' : 'Subscription status updated successfully', 'success');
      setEditingSubscription(null);
      fetchData();
    } catch (error) {
      showToastMessage(isRTL ? 'حدث خطأ في تحديث الاشتراك' : 'Error updating subscription', 'error');
    } finally {
      setSavingSubscription(false);
    }
  };

  const openSubscriptionEdit = (company) => {
    setEditingSubscription(company);
    setSubscriptionStatus(company.subscription_status || company.subscription?.status || 'trial');
  };

  // Open subscription assignment modal
  const openAssignSubscription = (company) => {
    setAssigningSubscription(company);
    setSubscriptionPlan('professional');
    setSubscriptionDuration('monthly');
  };

  // Handle subscription assignment
  const handleAssignSubscription = async () => {
    if (!assigningSubscription) return;
    
    setAssigningLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(`${API_URL}/api/admin/subscriptions/assign`, {
        company_id: assigningSubscription.id,
        plan: subscriptionPlan,
        duration: subscriptionDuration
      }, config);
      
      // Check if response indicates success
      if (response.data && response.data.success) {
        showToastMessage(
          isRTL ? `تم تعيين اشتراك ${planNames[subscriptionPlan]} بنجاح` : `${planNames[subscriptionPlan]} subscription assigned successfully`, 
          'success'
        );
        
        setAssigningSubscription(null);
        
        // Refresh data
        try {
          const dashResponse = await axios.get(`${API_URL}/api/admin/dashboard`, config);
          setStats(dashResponse.data.statistics || {});
          setCompanies(dashResponse.data.companies || []);
        } catch (refreshError) {
          console.log('Dashboard refresh error (non-critical):', refreshError);
        }
      } else {
        showToastMessage(isRTL ? 'حدث خطأ في تعيين الاشتراك' : 'Error assigning subscription', 'error');
      }
      
    } catch (error) {
      console.error('Subscription assignment error:', error);
      let errorMsg = isRTL ? 'حدث خطأ في تعيين الاشتراك' : 'Error assigning subscription';
      if (error.response?.data?.detail) {
        errorMsg = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : JSON.stringify(error.response.data.detail);
      }
      showToastMessage(errorMsg, 'error');
    } finally {
      setAssigningLoading(false);
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

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(isRTL ? `هل أنت متأكد من حذف المستخدم "${userName}"؟` : `Are you sure you want to delete "${userName}"?`)) {
      return;
    }
    
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/api/admin/users/${userId}`, config);
      
      // Refresh lists
      if (selectedCompany) {
        fetchCompanyUsers(selectedCompany.id);
      }
      // Update allUsers and filteredUsers
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      setFilteredUsers(prev => prev.filter(u => u.id !== userId));
      
      showToastMessage(isRTL ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully', 'success');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || (isRTL ? 'حدث خطأ في الحذف' : 'Error deleting user');
      showToastMessage(errorMsg, 'error');
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

  // Filter subscriptions based on search query (searches in company name, company email, and user emails)
  const handleSubscriptionSearch = (query) => {
    setSubscriptionSearchQuery(query);
    if (!query.trim()) {
      setFilteredSubscriptions(subscriptions);
    } else {
      const filtered = subscriptions.filter(sub => 
        sub.company_name?.toLowerCase().includes(query.toLowerCase()) ||
        sub.company_email?.toLowerCase().includes(query.toLowerCase()) ||
        sub.user_emails?.some(email => email?.toLowerCase().includes(query.toLowerCase())) ||
        sub.users?.some(u => u.name?.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredSubscriptions(filtered);
    }
  };

  // Update filtered subscriptions when subscriptions change
  useEffect(() => {
    setFilteredSubscriptions(subscriptions);
    setSubscriptionSearchQuery('');
  }, [subscriptions]);

  // Update payment status
  const handleUpdatePayment = async (subscriptionId, paymentData) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(`${API_URL}/api/admin/payments/subscriptions/${subscriptionId}/payment`, paymentData, config);
      showToastMessage(isRTL ? 'تم تحديث حالة الدفع بنجاح' : 'Payment status updated', 'success');
      setEditingPayment(null);
      // Refresh payments data
      const paymentsRes = await axios.get(`${API_URL}/api/admin/payments/subscriptions?status=${paymentFilter}&search=${paymentSearch}`, config);
      setPaymentsData(paymentsRes.data);
    } catch (error) {
      showToastMessage(isRTL ? 'فشل تحديث حالة الدفع' : 'Failed to update payment', 'error');
    }
  };

  // Refresh payments when filter changes
  useEffect(() => {
    if (activeTab === 'payments') {
      fetchData();
    }
  }, [paymentFilter, paymentSearch]);

  const tabs = [
    { id: 'overview', label: t.overview, icon: BarChart3 },
    { id: 'subscriptions', label: t.subscriptions, icon: CreditCard },
    { id: 'payments', label: isRTL ? 'المدفوعات' : 'Payments', icon: DollarSign },
    { id: 'transactions', label: t.transactions, icon: DollarSign },
    { id: 'codes', label: t.codes, icon: Gift },
    { id: 'companies', label: t.companies, icon: Building2 },
    { id: 'users', label: isRTL ? 'جميع المستخدمين' : 'All Users', icon: Users },
    { id: 'audit', label: isRTL ? 'سجل التدقيق' : 'Audit Log', icon: History },
    { id: 'messages', label: isRTL ? 'الرسائل' : 'Messages', icon: Mail, badge: newMessagesCount },
    { id: 'health', label: isRTL ? 'صحة النظام' : 'System Health', icon: HeartPulse },
    { id: 'referrals', label: isRTL ? 'الإحالات' : 'Referrals', icon: Gift },
    { id: 'payment-config', label: isRTL ? 'طرق الدفع' : 'Payment Methods', icon: CreditCard },
    { id: 'system-guide', label: isRTL ? 'الدليل الشامل' : 'System Guide', icon: BookOpen },
    { id: 'outreach', label: isRTL ? 'مراسلات العملاء' : 'Client Outreach', icon: Mail },
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
            <NotificationBell />
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
            <div className="flex items-center gap-2 flex-wrap">
              {/* Global Search */}
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  style={{[isRTL ? 'right' : 'left']: '10px'}} />
                <input
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder={isRTL ? 'بحث...' : 'Search...'}
                  className="border border-gray-200 rounded-xl py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  style={{[isRTL ? 'paddingRight' : 'paddingLeft']: '34px', [isRTL ? 'paddingLeft' : 'paddingRight']: '12px', width: '200px'}}
                />
              </div>
              <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {isRTL ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
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
              <div className="flex items-center justify-between">
                <CardTitle>{t.subscriptions}</CardTitle>
                <div className="relative w-80">
                  <Input
                    placeholder={isRTL ? 'بحث بالشركة أو البريد الإلكتروني...' : 'Search by company or email...'}
                    value={subscriptionSearchQuery}
                    onChange={(e) => handleSubscriptionSearch(e.target.value)}
                    className="pl-10"
                    data-testid="subscription-search-input"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
              {subscriptionSearchQuery && (
                <p className="text-sm text-gray-500 mt-2">
                  {isRTL 
                    ? `عرض ${filteredSubscriptions.length} من ${subscriptions.length} اشتراك`
                    : `Showing ${filteredSubscriptions.length} of ${subscriptions.length} subscriptions`
                  }
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.company}</TableHead>
                    <TableHead>{isRTL ? 'المستخدمون' : 'Users'}</TableHead>
                    <TableHead>{t.plan}</TableHead>
                    <TableHead>{t.duration}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.endDate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub, idx) => (
                    <TableRow key={idx} data-testid={`subscription-row-${idx}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.company_name || sub.company_id}</p>
                          <p className="text-sm text-gray-500">{sub.company_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {sub.users && sub.users.length > 0 ? (
                            <div className="space-y-1">
                              {sub.users.slice(0, 3).map((user, uidx) => (
                                <div key={uidx} className="text-sm">
                                  <span className="font-medium text-gray-700">{user.name || '-'}</span>
                                  <span className="text-gray-500 text-xs block">{user.email}</span>
                                </div>
                              ))}
                              {sub.users.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{sub.users.length - 3} {isRTL ? 'آخرين' : 'more'}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">{isRTL ? 'لا يوجد مستخدمين' : 'No users'}</span>
                          )}
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
                  {filteredSubscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {subscriptionSearchQuery 
                          ? (isRTL ? 'لا توجد نتائج للبحث' : 'No results found')
                          : (isRTL ? 'لا توجد اشتراكات' : 'No subscriptions')
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{isRTL ? 'إجمالي الاشتراكات' : 'Total Subscriptions'}</p>
                      <p className="text-2xl font-bold">{paymentsData.summary?.total || 0}</p>
                    </div>
                    <CreditCard className="h-10 w-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{isRTL ? 'المدفوع' : 'Paid'}</p>
                      <p className="text-2xl font-bold">{paymentsData.summary?.paid || 0}</p>
                    </div>
                    <CheckCircle className="h-10 w-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{isRTL ? 'غير مدفوع' : 'Unpaid'}</p>
                      <p className="text-2xl font-bold">{paymentsData.summary?.unpaid || 0}</p>
                    </div>
                    <Clock className="h-10 w-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80">{isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
                      <p className="text-2xl font-bold">{formatCurrency(paymentsData.summary?.total_revenue || 0)}</p>
                    </div>
                    <DollarSign className="h-10 w-10 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex gap-2">
                    <Button
                      variant={paymentFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('all')}
                    >
                      {isRTL ? 'الكل' : 'All'}
                    </Button>
                    <Button
                      variant={paymentFilter === 'paid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('paid')}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      {isRTL ? 'مدفوع' : 'Paid'}
                    </Button>
                    <Button
                      variant={paymentFilter === 'unpaid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('unpaid')}
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      {isRTL ? 'غير مدفوع' : 'Unpaid'}
                    </Button>
                  </div>
                  
                  <Input
                    placeholder={isRTL ? 'بحث بالاسم أو الإيميل أو الكود...' : 'Search by name, email or code...'}
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  
                  <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Payments Table */}
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'سجل المدفوعات' : 'Payment Records'}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الشركة' : 'Company'}</TableHead>
                        <TableHead>{isRTL ? 'الكود' : 'Code'}</TableHead>
                        <TableHead>{isRTL ? 'الخطة' : 'Plan'}</TableHead>
                        <TableHead>{isRTL ? 'المدة' : 'Duration'}</TableHead>
                        <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                        <TableHead>{isRTL ? 'تاريخ الدفع' : 'Payment Date'}</TableHead>
                        <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsData.subscriptions?.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.company_name}</p>
                              <p className="text-xs text-gray-500">{sub.company_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {sub.company_code || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{planNames[sub.plan] || sub.plan}</Badge>
                          </TableCell>
                          <TableCell>{durationNames[sub.duration] || sub.duration}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(sub.payment_amount)}</TableCell>
                          <TableCell>
                            <Badge className={sub.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                              {sub.is_paid ? (isRTL ? '✅ مدفوع' : '✅ Paid') : (isRTL ? '⏳ غير مدفوع' : '⏳ Unpaid')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.payment_method ? (
                              <span className="flex items-center gap-1">
                                {paymentMethods.find(m => m.id === sub.payment_method)?.icon || '💳'}
                                {paymentMethods.find(m => m.id === sub.payment_method)?.[isRTL ? 'name_ar' : 'name'] || sub.payment_method}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{sub.payment_date ? formatDate(sub.payment_date) : '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPayment(sub)}
                            >
                              {isRTL ? 'تعديل' : 'Edit'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* Edit Payment Modal */}
            {editingPayment && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md m-4">
                  <CardHeader>
                    <CardTitle>{isRTL ? 'تعديل حالة الدفع' : 'Edit Payment Status'}</CardTitle>
                    <CardDescription>{editingPayment.company_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">{isRTL ? 'حالة الدفع' : 'Payment Status'}</label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={editingPayment.is_paid ? 'default' : 'outline'}
                          className={editingPayment.is_paid ? 'bg-green-500' : ''}
                          onClick={() => setEditingPayment({...editingPayment, is_paid: true})}
                        >
                          {isRTL ? 'مدفوع' : 'Paid'}
                        </Button>
                        <Button
                          variant={!editingPayment.is_paid ? 'default' : 'outline'}
                          className={!editingPayment.is_paid ? 'bg-amber-500' : ''}
                          onClick={() => setEditingPayment({...editingPayment, is_paid: false})}
                        >
                          {isRTL ? 'غير مدفوع' : 'Unpaid'}
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</label>
                      <select
                        className="w-full mt-2 p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
                        value={editingPayment.payment_method || ''}
                        onChange={(e) => {
                          const method = e.target.value;
                          const updates = { payment_method: method };
                          // Activation code = free gift, amount must be 0
                          if (method === 'activation_code') {
                            updates.payment_amount = 0;
                          }
                          setEditingPayment({...editingPayment, ...updates});
                        }}
                      >
                        <option value="">{isRTL ? 'اختر طريقة الدفع' : 'Select method'}</option>
                        {paymentMethods.map(method => (
                          <option key={method.id} value={method.id}>
                            {method.icon} {isRTL ? method.name_ar : method.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">{isRTL ? 'المبلغ' : 'Amount'}</label>
                      <Input
                        type="number"
                        className="mt-2"
                        value={editingPayment.payment_amount ?? ''}
                        onChange={(e) => setEditingPayment({...editingPayment, payment_amount: parseFloat(e.target.value) || 0})}
                        disabled={editingPayment.payment_method === 'activation_code'}
                      />
                      {editingPayment.payment_method === 'activation_code' && (
                        <p className="text-xs text-green-600 mt-1">{isRTL ? 'كود التفعيل = هدية مجانية (المبلغ = 0)' : 'Activation Code = Free Gift (Amount = 0)'}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">{isRTL ? 'تاريخ الدفع' : 'Payment Date'}</label>
                      <Input
                        type="date"
                        className="mt-2"
                        value={editingPayment.payment_date?.slice(0, 10) || ''}
                        onChange={(e) => setEditingPayment({...editingPayment, payment_date: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">{isRTL ? 'رقم المرجع' : 'Reference Number'}</label>
                      <Input
                        className="mt-2"
                        placeholder={isRTL ? 'رقم الإيصال أو التحويل' : 'Receipt or transfer number'}
                        value={editingPayment.reference_number || ''}
                        onChange={(e) => setEditingPayment({...editingPayment, reference_number: e.target.value})}
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        className="flex-1"
                        onClick={() => handleUpdatePayment(editingPayment.id, {
                          is_paid: editingPayment.is_paid,
                          payment_method: editingPayment.payment_method,
                          payment_date: editingPayment.payment_date,
                          reference_number: editingPayment.reference_number,
                          amount: editingPayment.payment_method === 'activation_code' ? 0 : editingPayment.payment_amount
                        })}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isRTL ? 'حفظ' : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingPayment(null)}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>{t.transactions}</CardTitle>
                <div className="flex gap-2 items-center flex-wrap">
                  <select onChange={e => setSortConfig({field: e.target.value, dir: sortConfig.dir})}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                    <option value="created_at">{isRTL ? 'التاريخ' : 'Date'}</option>
                    <option value="amount_egp">{isRTL ? 'المبلغ' : 'Amount'}</option>
                    <option value="payment_status">{isRTL ? 'الحالة' : 'Status'}</option>
                    <option value="plan">{isRTL ? 'الخطة' : 'Plan'}</option>
                  </select>
                  <button onClick={() => setSortConfig(s => ({...s, dir: s.dir==='asc'?'desc':'asc'}))}
                    className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {sortConfig.dir === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </button>
                  <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                    placeholder={isRTL ? 'بحث...' : 'Search...'}
                    className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none" />
                </div>
              </div>
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
                  {[...transactions]
                    .filter(tx => !globalSearch || 
                      (tx.user_email||'').toLowerCase().includes(globalSearch.toLowerCase()) ||
                      (tx.plan||'').toLowerCase().includes(globalSearch.toLowerCase()))
                    .sort((a,b) => {
                      const av = a[sortConfig.field]||'', bv = b[sortConfig.field]||'';
                      return sortConfig.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1);
                    })
                    .map((tx, idx) => (
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
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-xl font-semibold">{t.companies}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                  placeholder={isRTL ? 'بحث...' : 'Search...'}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-40" />
                <select onChange={e => setSortConfig(s => ({...s, field: e.target.value}))}
                  className="text-sm border border-gray-200 rounded-xl px-2 py-1.5 focus:outline-none">
                  <option value="created_at">{isRTL ? 'تاريخ التسجيل' : 'Date'}</option>
                  <option value="name">{isRTL ? 'الاسم' : 'Name'}</option>
                  <option value="subscription_plan">{isRTL ? 'الخطة' : 'Plan'}</option>
                </select>
                <button onClick={() => setSortConfig(s => ({...s, dir: s.dir==='asc'?'desc':'asc'}))}
                  className="p-1.5 border border-gray-200 rounded-xl hover:bg-gray-50">
                  {sortConfig.dir === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </button>
                <Button onClick={() => setShowNotificationForm(true)}>
                  <Bell className="h-4 w-4 mr-2" />
                  {t.sendNotification}
                </Button>
              </div>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteUser(user.id, user.full_name)}
                                  className="text-red-600 hover:text-red-700"
                                  title={isRTL ? 'حذف المستخدم' : 'Delete User'}
                                  data-testid={`delete-company-user-${user.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
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
                      <TableHead>{isRTL ? 'الكود' : 'Code'}</TableHead>
                      <TableHead>{t.userCount}</TableHead>
                      <TableHead>{t.plan}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.endDate}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...companies]
                    .filter(c => !globalSearch || 
                      (c.name||'').toLowerCase().includes(globalSearch.toLowerCase()) ||
                      (c.email||'').toLowerCase().includes(globalSearch.toLowerCase()) ||
                      (c.company_code||'').toLowerCase().includes(globalSearch.toLowerCase()))
                    .sort((a,b) => {
                      const av = a['created_at']||'', bv = b['created_at']||'';
                      return sortConfig.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1);
                    })
                    .map((company, idx) => (
                      <TableRow key={idx} className={!company.is_active && company.is_active !== undefined ? 'bg-red-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{company.name}</p>
                            <p className="text-xs text-gray-400 font-mono" title="Company ID">
                              {company.id?.substring(0, 8)}...
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(company.id);
                                  showToastMessage(isRTL ? 'تم نسخ ID' : 'ID copied!', 'success');
                                }}
                                className="ml-1 text-blue-500 hover:text-blue-700"
                              >
                                📋
                              </button>
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{company.contact_email || company.owner_email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">
                              {company.company_code || '-'}
                            </code>
                            {company.company_code && (
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(company.company_code);
                                  showToastMessage(isRTL ? 'تم نسخ الكود' : 'Code copied!', 'success');
                                }}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                📋
                              </button>
                            )}
                          </div>
                        </TableCell>
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
                              onClick={() => openAssignSubscription(company)}
                              title={isRTL ? 'تعيين اشتراك' : 'Assign Subscription'}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            >
                              <Crown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSubscriptionEdit(company)}
                              title={isRTL ? 'تعديل الاشتراك' : 'Edit Subscription'}
                            >
                              <CreditCard className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                              className={company.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                              title={company.is_active !== false ? t.suspend : t.activate}
                            >
                              <Power className="h-4 w-4" />
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => {
                                 const newCode = window.prompt(
                                   isRTL ? `تغيير كود الشركة "${company.name}"\nالكود الحالي: ${company.company_code || '-'}`
                                         : `Change code for "${company.name}"\nCurrent: ${company.company_code || '-'}`,
                                   company.company_code || ""
                                 );
                                 if (newCode !== null && newCode.trim()) {
                                   handleChangeCompanyCode(company.id, newCode.trim().toUpperCase());
                                 }
                               }}
                               className="text-indigo-600 hover:bg-indigo-50"
                               title={isRTL ? 'تغيير كود الشركة' : 'Change Company Code'}
                             >
                               <Key className="h-4 w-4" />
                             </Button>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Subscription Status Editing Modal */}
            {editingSubscription && (
              <Card className="border-2 border-green-200 bg-green-50 mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-600" />
                    {isRTL ? 'تغيير حالة الاشتراك' : 'Change Subscription Status'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{editingSubscription.name}</p>
                      <p className="text-sm text-gray-500">{editingSubscription.contact_email || editingSubscription.owner_email}</p>
                    </div>
                    <Badge variant="outline">
                      {isRTL ? 'كود: ' : 'Code: '}{editingSubscription.subscription_code || editingSubscription.id?.slice(0, 8).toUpperCase()}
                    </Badge>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">{isRTL ? 'حالة الاشتراك' : 'Subscription Status'}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setSubscriptionStatus('trial')}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          subscriptionStatus === 'trial' 
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Clock className="h-6 w-6 mx-auto mb-2" />
                        <span className="font-medium block">{isRTL ? 'تجريبي' : 'Trial'}</span>
                      </button>
                      <button
                        onClick={() => setSubscriptionStatus('active')}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          subscriptionStatus === 'active' 
                            ? 'border-green-500 bg-green-50 text-green-700' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CheckCircle className="h-6 w-6 mx-auto mb-2" />
                        <span className="font-medium block">{isRTL ? 'نشط' : 'Active'}</span>
                      </button>
                      <button
                        onClick={() => setSubscriptionStatus('expired')}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          subscriptionStatus === 'expired' 
                            ? 'border-red-500 bg-red-50 text-red-700' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <XCircle className="h-6 w-6 mx-auto mb-2" />
                        <span className="font-medium block">{isRTL ? 'منتهي' : 'Expired'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingSubscription(null)}
                    >
                      {t.cancel}
                    </Button>
                    <Button 
                      onClick={() => handleUpdateSubscription(editingSubscription.id)}
                      disabled={savingSubscription}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {savingSubscription ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* All Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                placeholder={isRTL ? 'بحث بالاسم أو البريد أو الشركة...' : 'Search by name, email or company...'}
                className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <select onChange={e => setSortConfig({field: e.target.value, dir: sortConfig.dir})}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none">
                <option value="created_at">{isRTL ? 'تاريخ التسجيل' : 'Registration Date'}</option>
                <option value="full_name">{isRTL ? 'الاسم' : 'Name'}</option>
                <option value="company_name">{isRTL ? 'الشركة' : 'Company'}</option>
                <option value="role">{isRTL ? 'الدور' : 'Role'}</option>
              </select>
              <button onClick={() => setSortConfig(s => ({...s, dir: s.dir==='asc'?'desc':'asc'}))}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50">
                {sortConfig.dir === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </button>
            </div>
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
                    {[...filteredUsers]
                    .sort((a,b) => {
                      const f = sortConfig.field === 'created_at' ? 'created_at' : sortConfig.field;
                      const av = a[f]||'', bv = b[f]||'';
                      return sortConfig.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1);
                    })
                    .map((usr, idx) => (
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteUser(usr.id, usr.full_name)}
                              className="text-red-600 hover:text-red-700"
                              title={isRTL ? 'حذف المستخدم' : 'Delete User'}
                              data-testid={`delete-user-${usr.id}`}
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

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <AuditLogPage />
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


        {/* ══════════ Health Check Tab ══════════ */}
        {activeTab === 'health' && (
          <HealthCheckPanel isRTL={isRTL} />
        )}

        {/* ══════════ New Panels ══════════ */}
        {activeTab === 'referrals' && (
          <div className="p-2"><AdminReferralsPanel /></div>
        )}
        {activeTab === 'payment-config' && (
          <div className="p-2"><PaymentMethodsPanel /></div>
        )}
        {activeTab === 'system-guide' && (
          <div className="p-2"><SystemGuidePanel /></div>
        )}
        {activeTab === 'outreach' && (
          <div className="p-2"><OutreachPanel /></div>
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

        {/* Subscription Assignment Modal - Modern Design */}
        {assigningSubscription && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 p-6 text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                      <Crown className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">
                        {isRTL ? 'تعيين اشتراك' : 'Assign Subscription'}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {assigningSubscription.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Plan Selection */}
                <div>
                  <label className={`block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? 'اختر الباقة' : 'Select Plan'}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Starter */}
                    <button
                      onClick={() => setSubscriptionPlan('starter')}
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                        subscriptionPlan === 'starter'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg shadow-blue-500/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          subscriptionPlan === 'starter' 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <Zap className={`h-5 w-5 ${subscriptionPlan === 'starter' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-semibold text-sm ${subscriptionPlan === 'starter' ? 'text-blue-700' : 'text-gray-700 dark:text-gray-300'}`}>
                          {isRTL ? 'المبتدئ' : 'Starter'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {PLAN_PRICES.starter[subscriptionDuration]} {isRTL ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                      {subscriptionPlan === 'starter' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>

                    {/* Professional */}
                    <button
                      onClick={() => setSubscriptionPlan('professional')}
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                        subscriptionPlan === 'professional'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-lg shadow-purple-500/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50/50'
                      }`}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                          {isRTL ? 'الأكثر شعبية' : 'Popular'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 mt-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          subscriptionPlan === 'professional' 
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <Star className={`h-5 w-5 ${subscriptionPlan === 'professional' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-semibold text-sm ${subscriptionPlan === 'professional' ? 'text-purple-700' : 'text-gray-700 dark:text-gray-300'}`}>
                          {isRTL ? 'المحترف' : 'Pro'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {PLAN_PRICES.professional[subscriptionDuration]} {isRTL ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                      {subscriptionPlan === 'professional' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>

                    {/* Enterprise */}
                    <button
                      onClick={() => setSubscriptionPlan('enterprise')}
                      className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                        subscriptionPlan === 'enterprise'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-lg shadow-amber-500/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          subscriptionPlan === 'enterprise' 
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <Crown className={`h-5 w-5 ${subscriptionPlan === 'enterprise' ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-semibold text-sm ${subscriptionPlan === 'enterprise' ? 'text-amber-700' : 'text-gray-700 dark:text-gray-300'}`}>
                          {isRTL ? 'المؤسسي' : 'Enterprise'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {PLAN_PRICES.enterprise[subscriptionDuration]} {isRTL ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                      {subscriptionPlan === 'enterprise' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Duration Selection */}
                <div>
                  <label className={`block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? 'مدة الاشتراك' : 'Subscription Duration'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['monthly', 'quarterly', 'yearly', 'lifetime'].map((dur) => (
                      <button
                        key={dur}
                        onClick={() => setSubscriptionDuration(dur)}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                          subscriptionDuration === dur
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
                        }`}
                      >
                        <span className="text-xs font-medium block">
                          {durationNames[dur]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Summary */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div className={`${isRTL ? 'text-right' : ''}`}>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isRTL ? 'المبلغ الإجمالي' : 'Total Amount'}
                      </p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {PLAN_PRICES[subscriptionPlan]?.[subscriptionDuration] || 0}
                        </span>
                        <span className="text-gray-500 text-sm">{isRTL ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-0 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setAssigningSubscription(null)}
                  className="flex-1 h-12 rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleAssignSubscription}
                  disabled={assigningLoading}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/30 transition-all duration-300"
                >
                  {assigningLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {isRTL ? 'جاري التعيين...' : 'Assigning...'}
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      {isRTL ? 'تعيين الاشتراك' : 'Assign Subscription'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

/* ══════════ Health Check Panel Component ══════════ */
const HealthCheckPanel = ({ isRTL }) => {
  const [loading, setLoading] = React.useState(false);
  const [routeResult, setRouteResult] = React.useState(null);
  const [systemResult, setSystemResult] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [lastChecked, setLastChecked] = React.useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const runFullCheck = async () => {
    setLoading(true);
    try {
      const [routeRes, detailRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/api/health/test-routes`, { headers }),
        axios.get(`${API_URL}/api/health/detailed`, { headers }),
        axios.get(`${API_URL}/api/health/history?limit=10`, { headers })
      ]);
      setRouteResult(routeRes.data);
      setSystemResult(detailRes.data);
      setHistory(histRes.data.history || []);
      setLastChecked(new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { runFullCheck(); }, []);

  const statusColor = (s) => s === 'ok' || s === 'pass' ? 'text-green-600 bg-green-50' : s === 'warn' || s === 'degraded' ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
  const statusIcon = (s) => s === 'ok' || s === 'pass' ? <CheckCircle className="h-4 w-4 text-green-500" /> : s === 'warn' || s === 'degraded' ? <AlertCircle className="h-4 w-4 text-yellow-500" /> : <XCircle className="h-4 w-4 text-red-500" />;

  return (
    <div className="space-y-4" data-testid="health-check-panel">
      {/* Header */}
      <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <HeartPulse className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{isRTL ? 'صحة النظام' : 'System Health'}</h2>
                <p className="text-emerald-100">{isRTL ? 'فحص شامل لكل مسارات وخدمات التطبيق' : 'Full check of all routes and services'}</p>
              </div>
            </div>
            <Button onClick={runFullCheck} disabled={loading} className="bg-white/20 hover:bg-white/30 text-white border-0">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              <span className="ms-2">{isRTL ? 'فحص الآن' : 'Check Now'}</span>
            </Button>
          </div>
          {lastChecked && <p className="text-emerald-200 text-xs mt-3">{isRTL ? 'آخر فحص:' : 'Last check:'} {lastChecked}</p>}
        </CardContent>
      </Card>

      {/* System Checks */}
      {systemResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {statusIcon(systemResult.status)}
              {isRTL ? 'فحص الأنظمة' : 'System Checks'}
              <Badge className={`ms-auto ${statusColor(systemResult.status)} text-xs`}>
                {systemResult.summary.passed}/{systemResult.summary.total} {isRTL ? 'ناجح' : 'passed'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(systemResult.checks).map(([name, check]) => (
                <div key={name} className={`rounded-xl p-3 border ${check.status === 'ok' ? 'border-green-200 bg-green-50/50' : check.status === 'warn' ? 'border-yellow-200 bg-yellow-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(check.status)}
                    <span className="text-xs font-semibold text-gray-700 capitalize">{name}</span>
                  </div>
                  {check.latency_ms && <p className="text-xs text-gray-500">{check.latency_ms}ms</p>}
                  {check.total !== undefined && <p className="text-xs text-gray-500">{check.total} {isRTL ? 'عنصر' : 'items'}</p>}
                  {check.admins !== undefined && <p className="text-xs text-gray-500">{check.admins} {isRTL ? 'مدير' : 'admins'}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Tests */}
      {routeResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {statusIcon(routeResult.overall_status)}
              {isRTL ? 'فحص المسارات' : 'Route Tests'}
              <Badge className={`ms-auto ${statusColor(routeResult.overall_status)} text-xs`}>
                {routeResult.summary.passed}/{routeResult.summary.total_tested} ({routeResult.summary.pass_rate})
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Categories Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
              {Object.entries(routeResult.categories).map(([cat, s]) => (
                <div key={cat} className={`rounded-lg p-2.5 text-center border ${s.failed === 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <p className="text-xs font-bold text-gray-700 capitalize">{cat}</p>
                  <p className={`text-lg font-bold ${s.failed === 0 ? 'text-green-600' : 'text-red-600'}`}>{s.passed}/{s.passed + s.failed}</p>
                </div>
              ))}
            </div>

            {/* Failed Routes */}
            {routeResult.failed_routes.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                <p className="font-bold text-red-700 text-sm mb-2">{isRTL ? 'مسارات فاشلة:' : 'Failed Routes:'}</p>
                {routeResult.failed_routes.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-red-600 py-1">
                    <XCircle className="h-3 w-3" />
                    <code className="font-mono">{r.method} {r.path}</code>
                    <span className="text-red-400">({r.status_code})</span>
                  </div>
                ))}
              </div>
            )}

            {/* All Routes Detail */}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">{isRTL ? 'عرض كل المسارات' : 'Show all routes'}</summary>
              <div className="mt-2 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="p-1.5 text-start">{isRTL ? 'المسار' : 'Route'}</th><th className="p-1.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th><th className="p-1.5 text-center">{isRTL ? 'السرعة' : 'Latency'}</th></tr></thead>
                  <tbody>
                    {routeResult.all_routes.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="p-1.5 font-mono text-gray-700">{r.method} {r.path}</td>
                        <td className="p-1.5 text-center">{r.result === 'pass' ? <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />}</td>
                        <td className="p-1.5 text-center text-gray-500">{r.latency_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{isRTL ? 'سجل الفحوصات' : 'Check History'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(h.status)}
                    <span className="text-sm text-gray-700">{h.type || 'check'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {h.summary && <span className="text-xs text-gray-500">{h.summary.passed !== undefined ? `${h.summary.passed}/${h.summary.total || h.summary.total_tested}` : ''}</span>}
                    <span className="text-xs text-gray-400">{new Date(h.timestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

};


export default AdminDashboard;
