import React, { useState, useEffect, useCallback } from 'react';
import PublishUpdatePanel from '../components/PublishUpdatePanel';
import AssistantsPanel from '../components/AssistantsPanel';
import SubscriptionsPanel from '../components/SubscriptionsPanel';
import PaymentsAdminPanel from '../components/PaymentsAdminPanel';
import ActivationCodesPanel from '../components/ActivationCodesPanel';
import MessagesAdminPanel from '../components/MessagesAdminPanel';
import SystemHealthPanel from '../components/SystemHealthPanel';
import AdsPanel from '../components/AdsPanel';
import NewsletterPanel from '../components/NewsletterPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Building2, Users, CreditCard, Search, RefreshCw, Eye, Edit2, 
  Trash2, Power, PowerOff, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Calendar, Mail, Phone, Globe, Shield, UserCog,
  ChevronDown, ChevronUp, BarChart3, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SuperAdminDashboard = ({ language = 'ar' }) => {
  const isRTL = language === 'ar';
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('companies');
  
  // Data
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    suspendedCompanies: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modals
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Expanded rows
  const [expandedCompany, setExpandedCompany] = useState(null);

  const t = {
    ar: {
      title: 'لوحة تحكم Super Admin',
      subtitle: 'إدارة جميع الشركات والمستخدمين على المنصة',
      companies: 'الشركات',
      users: 'المستخدمين',
      statistics: 'الإحصائيات',
      totalCompanies: 'إجمالي الشركات',
      activeCompanies: 'شركات نشطة',
      suspendedCompanies: 'شركات موقوفة',
      totalUsers: 'إجمالي المستخدمين',
      activeSubscriptions: 'اشتراكات نشطة',
      trialSubscriptions: 'فترات تجريبية',
      search: 'بحث...',
      all: 'الكل',
      active: 'نشط',
      suspended: 'موقوف',
      trial: 'تجريبي',
      companyName: 'اسم الشركة',
      email: 'البريد الإلكتروني',
      phone: 'الهاتف',
      subscriptionType: 'نوع الاشتراك',
      status: 'الحالة',
      usersCount: 'عدد المستخدمين',
      createdAt: 'تاريخ التسجيل',
      actions: 'الإجراءات',
      view: 'عرض',
      edit: 'تعديل',
      suspend: 'إيقاف',
      activate: 'تفعيل',
      delete: 'حذف',
      companyDetails: 'تفاصيل الشركة',
      subscriptionDetails: 'تفاصيل الاشتراك',
      plan: 'الخطة',
      startDate: 'تاريخ البدء',
      endDate: 'تاريخ الانتهاء',
      refresh: 'تحديث',
      noCompanies: 'لا توجد شركات',
      noUsers: 'لا يوجد مستخدمين',
      role: 'الدور',
      company: 'الشركة',
      lastLogin: 'آخر دخول',
      activateSuccess: 'تم تفعيل الشركة بنجاح',
      suspendSuccess: 'تم إيقاف الشركة بنجاح',
      error: 'حدث خطأ'
    },
    en: {
      title: 'Super Admin Dashboard',
      subtitle: 'Manage all companies and users on the platform',
      companies: 'Companies',
      users: 'Users',
      statistics: 'Statistics',
      totalCompanies: 'Total Companies',
      activeCompanies: 'Active Companies',
      suspendedCompanies: 'Suspended Companies',
      totalUsers: 'Total Users',
      activeSubscriptions: 'Active Subscriptions',
      trialSubscriptions: 'Trial Subscriptions',
      search: 'Search...',
      all: 'All',
      active: 'Active',
      suspended: 'Suspended',
      trial: 'Trial',
      companyName: 'Company Name',
      email: 'Email',
      phone: 'Phone',
      subscriptionType: 'Subscription Type',
      status: 'Status',
      usersCount: 'Users Count',
      createdAt: 'Created At',
      actions: 'Actions',
      view: 'View',
      edit: 'Edit',
      suspend: 'Suspend',
      activate: 'Activate',
      delete: 'Delete',
      companyDetails: 'Company Details',
      subscriptionDetails: 'Subscription Details',
      plan: 'Plan',
      startDate: 'Start Date',
      endDate: 'End Date',
      refresh: 'Refresh',
      noCompanies: 'No companies found',
      noUsers: 'No users found',
      role: 'Role',
      company: 'Company',
      lastLogin: 'Last Login',
      activateSuccess: 'Company activated successfully',
      suspendSuccess: 'Company suspended successfully',
      error: 'An error occurred'
    }
  };
  
  const text = t[language] || t.ar;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch companies
      const companiesRes = await fetch(`${API_URL}/api/admin/companies`, { headers });
      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        setCompanies(companiesData);
        
        // Calculate stats
        const active = companiesData.filter(c => c.is_active !== false).length;
        const suspended = companiesData.filter(c => c.is_active === false).length;
        const trials = companiesData.filter(c => c.subscription?.plan === 'trial').length;
        const activeSubscriptions = companiesData.filter(c => c.subscription?.status === 'active').length;
        const totalUsersCount = companiesData.reduce((sum, c) => sum + (c.user_count || 0), 0);
        
        setStats({
          totalCompanies: companiesData.length,
          activeCompanies: active,
          suspendedCompanies: suspended,
          totalUsers: totalUsersCount,
          activeSubscriptions: activeSubscriptions,
          trialSubscriptions: trials
        });
      }

      // Fetch all users
      const usersRes = await fetch(`${API_URL}/api/admin/all-users`, { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleCompany = async (companyId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/companies/${companyId}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(currentStatus ? text.suspendSuccess : text.activateSuccess);
        fetchData();
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  // Filter companies
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && company.is_active !== false) ||
      (statusFilter === 'suspended' && company.is_active === false) ||
      (statusFilter === 'trial' && company.subscription?.plan === 'trial');
    
    return matchesSearch && matchesStatus;
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'       ? true :
      statusFilter === 'active'    ? user.is_active !== false :
      statusFilter === 'suspended' ? user.is_active === false :
      true;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (company) => {
    if (company.is_active === false) {
      return (
        <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          {text.suspended}
        </Badge>
      );
    }
    if (company.subscription?.plan === 'trial') {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {text.trial}
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {text.active}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  };

  return (
    <div className="p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'} data-testid="super-admin-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-purple-600" />
            {text.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{text.subtitle}</p>
        </div>
        <Button onClick={fetchData} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {text.refresh}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalCompanies}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalCompanies}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.activeCompanies}</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeCompanies}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.suspendedCompanies}</p>
                <p className="text-2xl font-bold text-red-600">{stats.suspendedCompanies}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalUsers}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.activeSubscriptions}</p>
                <p className="text-2xl font-bold text-amber-600">{stats.activeSubscriptions}</p>
              </div>
              <CreditCard className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.trialSubscriptions}</p>
                <p className="text-2xl font-bold text-cyan-600">{stats.trialSubscriptions}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-cyan-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto flex-nowrap scrollbar-hide">
        <Button
          variant={activeTab === 'companies' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('companies')}
          className={activeTab === 'companies' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          <Building2 className="w-4 h-4 mr-2" />
          {text.companies}
        </Button>
        <Button
          variant={activeTab === 'updates' ? 'default' : 'ghost'}
          className={activeTab === 'updates' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          onClick={() => setActiveTab('updates')}
        >
          <span>🚀</span>
          {language === 'ar' ? 'التحديثات' : 'Updates'}
        </Button>
        <Button
          variant={activeTab === 'assistants' ? 'default' : 'ghost'}
          className={activeTab === 'assistants' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          onClick={() => setActiveTab('assistants')}
        >
          <span>👥</span>
          {language === 'ar' ? 'المساعدون' : 'Assistants'}
        </Button>
        <Button
          variant={activeTab === 'payments' ? 'default' : 'ghost'}
          className={activeTab === 'payments' ? 'bg-green-700 hover:bg-green-800' : ''}
          onClick={() => setActiveTab('payments')}
        >
          <span>💰</span>
          {language === 'ar' ? 'المدفوعات' : 'Payments'}
        </Button>
        <Button
          variant={activeTab === 'codes' ? 'default' : 'ghost'}
          className={activeTab === 'codes' ? 'bg-purple-700 hover:bg-purple-800' : ''}
          onClick={() => setActiveTab('codes')}
        >
          <span>🔑</span>
          {language === 'ar' ? 'أكواد التفعيل' : 'Activation Codes'}
        </Button>
        <Button
          variant={activeTab === 'messages' ? 'default' : 'ghost'}
          className={activeTab === 'messages' ? 'bg-sky-700 hover:bg-sky-800' : ''}
          onClick={() => setActiveTab('messages')}
        >
          <span>💬</span>
          {language === 'ar' ? 'الرسائل' : 'Messages'}
        </Button>
        <Button
          variant={activeTab === 'newsletter' ? 'default' : 'ghost'}
          className={activeTab === 'newsletter' ? 'bg-indigo-700 hover:bg-indigo-800' : ''}
          onClick={() => setActiveTab('newsletter')}
        >
          <span>📨</span>
          {language === 'ar' ? 'النشرة البريدية' : 'Newsletter'}
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className={activeTab === 'users' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          <Users className="w-4 h-4 mr-2" />
          {text.users}
        </Button>
        <Button
          variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
          className={activeTab === 'subscriptions' ? 'bg-blue-700 hover:bg-blue-800' : ''}
          onClick={() => setActiveTab('subscriptions')}
        >
          <span>💳</span>
          {language === 'ar' ? 'الاشتراكات' : 'Subscriptions'}
        </Button>
        <Button
          variant={activeTab === 'health' ? 'default' : 'ghost'}
          className={activeTab === 'health' ? 'bg-emerald-700 hover:bg-emerald-800' : ''}
          onClick={() => setActiveTab('health')}
        >
          <span>🩺</span>
          {language === 'ar' ? 'صحة النظام' : 'System Health'}
        </Button>
        <Button
          variant={activeTab === 'ads' ? 'default' : 'ghost'}
          className={activeTab === 'ads' ? 'bg-orange-700 hover:bg-orange-800' : ''}
          onClick={() => setActiveTab('ads')}
        >
          <span>📢</span>
          {language === 'ar' ? 'الإعلانات' : 'Ads'}
        </Button>
      </div>

      {/* Filters - only for companies and users tabs */}
      {(activeTab === 'companies' || activeTab === 'users') && (
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={text.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={text.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.all}</SelectItem>
            <SelectItem value="active">{text.active}</SelectItem>
            <SelectItem value="suspended">{text.suspended}</SelectItem>
            {activeTab === 'companies' && <SelectItem value="trial">{text.trial}</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      )}
      
      {/* Companies Table */}
      {activeTab === 'companies' && (
        <div className="space-y-4">

          {/* Colored Banner */}
          <div className="bg-gradient-to-r from-[#0f1729] to-[#4c1d95] rounded-2xl p-5 text-white flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black">{language === 'ar' ? 'إدارة الشركات' : 'Companies Management'}</h2>
                <p className="text-purple-200 text-xs mt-0.5">
                  {language === 'ar'
                    ? `${stats.totalCompanies} شركة — ${stats.activeCompanies} نشطة — ${stats.trialSubscriptions} تجريبي`
                    : `${stats.totalCompanies} companies — ${stats.activeCompanies} active — ${stats.trialSubscriptions} trial`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {[
                { v: stats.totalCompanies,      l: language==='ar'?'الكل':'Total',      bg:'bg-white/15' },
                { v: stats.activeCompanies,     l: language==='ar'?'نشط':'Active',      bg:'bg-green-500/30' },
                { v: stats.suspendedCompanies,  l: language==='ar'?'موقوف':'Suspended', bg:'bg-red-500/30' },
                { v: stats.activeSubscriptions, l: language==='ar'?'مدفوع':'Paid',      bg:'bg-blue-500/30' },
                { v: stats.trialSubscriptions,  l: language==='ar'?'تجريبي':'Trial',    bg:'bg-yellow-500/30' },
              ].map((s,i) => (
                <div key={i} className={`${s.bg} rounded-xl px-3 py-1.5 text-center min-w-[50px]`}>
                  <p className="text-lg font-black">{s.v}</p>
                  <p className="text-[10px] text-white/70">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{text.noCompanies}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{text.companyName}</TableHead>
                    <TableHead>{language==='ar'?'كود الشركة':'Code'}</TableHead>
                    <TableHead>{text.email}</TableHead>
                    <TableHead>{language==='ar'?'الهاتف':'Phone'}</TableHead>
                    <TableHead>{text.subscriptionType}</TableHead>
                    <TableHead>{language==='ar'?'انتهاء الاشتراك':'Sub End'}</TableHead>
                    <TableHead>{text.usersCount}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead>{text.createdAt}</TableHead>
                    <TableHead>{text.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <React.Fragment key={company.id}>
                      <TableRow className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${company.is_active === false ? 'bg-red-50/50' : ''}`}>

                        {/* Expand */}
                        <TableCell>
                          <Button variant="ghost" size="sm"
                            onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}>
                            {expandedCompany === company.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </TableCell>

                        {/* Company name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[140px]">{company.name}</p>
                              {company.industry && <p className="text-xs text-gray-400 truncate">{company.industry}</p>}
                            </div>
                          </div>
                        </TableCell>

                        {/* Company code */}
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
                            {company.company_code || '—'}
                          </code>
                        </TableCell>

                        {/* Email */}
                        <TableCell className="text-sm">
                          <p className="truncate max-w-[160px]">{company.email || '—'}</p>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="text-sm text-gray-600">
                          {company.phone || '—'}
                        </TableCell>

                        {/* Subscription plan */}
                        <TableCell>
                          {(() => {
                            const plan = company.subscription?.plan || company.subscription_plan || 'trial';
                            const colors = {
                              trial: 'bg-gray-100 text-gray-600',
                              starter: 'bg-blue-100 text-blue-700',
                              professional: 'bg-purple-100 text-purple-700',
                              enterprise: 'bg-amber-100 text-amber-700',
                            };
                            const labels = {
                              trial: language==='ar'?'تجريبي':'Trial',
                              starter: language==='ar'?'مبتدئ':'Starter',
                              professional: language==='ar'?'احترافي':'Professional',
                              enterprise: language==='ar'?'مؤسسي':'Enterprise',
                            };
                            return (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[plan]||colors.trial}`}>
                                {labels[plan] || plan}
                              </span>
                            );
                          })()}
                        </TableCell>

                        {/* Subscription end date */}
                        <TableCell className="text-sm">
                          {(() => {
                            const endDate = company.subscription?.end_date
                              || company.subscription_end
                              || company.subscription_expires_at
                              || company.trial_ends_at;
                            if (!endDate) return <span className="text-gray-400">—</span>;
                            const d = new Date(endDate);
                            const now = new Date();
                            const daysLeft = Math.ceil((d - now) / (1000*60*60*24));
                            const color = daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-600' : 'text-gray-700';
                            return (
                              <div>
                                <p className={`text-xs font-medium ${color}`}>{formatDate(endDate)}</p>
                                {daysLeft >= 0 && daysLeft <= 30 && (
                                  <p className="text-xs text-orange-500">{daysLeft} {language==='ar'?'يوم متبقي':'days left'}</p>
                                )}
                                {daysLeft < 0 && (
                                  <p className="text-xs text-red-500">{language==='ar'?'منتهي':'Expired'}</p>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>

                        {/* Users */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="font-semibold text-sm">{company.active_users || 0}</span>
                            <span className="text-gray-400 text-xs">/{company.user_count || 0}</span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>{getStatusBadge(company)}</TableCell>

                        {/* Created */}
                        <TableCell className="text-xs text-gray-500">{formatDate(company.created_at)}</TableCell>

                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon"
                              onClick={() => { setSelectedCompany(company); setShowCompanyModal(true); }}
                              title={text.view}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon"
                              onClick={() => handleToggleCompany(company.id, company.is_active !== false)}
                              title={company.is_active !== false ? text.suspend : text.activate}
                              className={company.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}>
                              {company.is_active !== false ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>

                      </TableRow>

                      {/* EXPANDED ROW — full details */}
                      {expandedCompany === company.id && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-blue-50/30 p-0">
                            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">

                              {/* Company Info */}
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                                  <Building2 className="w-4 h-4 text-purple-600" />
                                  {language==='ar'?'بيانات الشركة':'Company Info'}
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {[
                                    {label: language==='ar'?'الاسم':'Name', value: company.name},
                                    {label: language==='ar'?'الكود':'Code', value: company.company_code, mono: true},
                                    {label: language==='ar'?'البريد':'Email', value: company.email},
                                    {label: language==='ar'?'الهاتف':'Phone', value: company.phone},
                                    {label: language==='ar'?'القطاع':'Industry', value: company.industry},
                                    {label: language==='ar'?'العنوان':'Address', value: company.address},
                                    {label: language==='ar'?'المدينة':'City', value: company.city},
                                    {label: language==='ar'?'الرقم الضريبي':'Tax No.', value: company.tax_number},
                                    {label: language==='ar'?'السجل التجاري':'Comm. Reg.', value: company.commercial_registration},
                                  ].filter(f => f.value).map((f, i) => (
                                    <div key={i} className="flex justify-between items-start gap-2">
                                      <span className="text-gray-500 flex-shrink-0">{f.label}:</span>
                                      <span className={`font-medium text-left break-all ${f.mono ? 'font-mono text-xs bg-gray-100 px-1 rounded' : ''}`}>{f.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Subscription Info */}
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                                  <CreditCard className="w-4 h-4 text-blue-600" />
                                  {language==='ar'?'بيانات الاشتراك':'Subscription'}
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {[
                                    {label: language==='ar'?'الخطة':'Plan', value: company.subscription?.plan || company.subscription_plan},
                                    {label: language==='ar'?'الحالة':'Status', value: company.subscription?.status || company.subscription_status},
                                    {label: language==='ar'?'تاريخ البدء':'Start', value: formatDate(company.subscription?.start_date || company.created_at)},
                                    {label: language==='ar'?'تاريخ الانتهاء':'End', value: formatDate(company.subscription?.end_date || company.subscription_expires_at || company.trial_ends_at)},
                                    {label: language==='ar'?'المبلغ':'Amount', value: company.subscription?.amount ? `${company.subscription.amount} ج.م` : language==='ar'?'مجاني':'Free'},
                                    {label: language==='ar'?'طريقة الدفع':'Payment', value: company.subscription?.payment_method},
                                    {label: language==='ar'?'عدد الموظفين المسموح':'Max Employees', value: company.max_employees},
                                  ].filter(f => f.value).map((f, i) => (
                                    <div key={i} className="flex justify-between items-start gap-2">
                                      <span className="text-gray-500 flex-shrink-0">{f.label}:</span>
                                      <span className="font-medium text-left">{f.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Users in this company */}
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                                  <Users className="w-4 h-4 text-green-600" />
                                  {language==='ar'?'المستخدمون':'Users'} ({company.user_count || 0})
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {users.filter(u => u.company_id === company.id).map(user => (
                                    <div key={user.id} className={`flex items-center gap-2 p-2 rounded-lg ${user.is_active === false ? 'bg-red-50' : 'bg-gray-50'}`}>
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${user.is_active === false ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-500 to-indigo-600'}`}>
                                        {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{user.full_name}</p>
                                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                      </div>
                                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0">{user.role?.replace('_',' ') || '—'}</span>
                                    </div>
                                  ))}
                                  {users.filter(u => u.company_id === company.id).length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-3">{language==='ar'?'لا يوجد مستخدمون':'No users'}</p>
                                  )}
                                </div>
                              </div>

                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Users Table */}
      {activeTab === 'updates' && (
        <PublishUpdatePanel />
      )}

      {activeTab === 'health' && (
        <SystemHealthPanel />
      )}

      {activeTab === 'ads' && (
        <AdsPanel />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionsPanel />
      )}

      {activeTab === 'payments' && (
        <PaymentsAdminPanel />
      )}

      {activeTab === 'newsletter' && (
        <NewsletterPanel />
      )}

      {activeTab === 'messages' && (
        <MessagesAdminPanel />
      )}

      {activeTab === 'codes' && (
        <ActivationCodesPanel />
      )}

      {activeTab === 'assistants' && (
        <AssistantsPanel />
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">

          {/* Colored Banner */}
          <div className="bg-gradient-to-r from-[#0f1729] to-[#065f46] rounded-2xl p-5 text-white flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black">{language === 'ar' ? 'إدارة المستخدمين' : 'Users Management'}</h2>
                <p className="text-green-200 text-xs mt-0.5">
                  {language === 'ar'
                    ? `${users.length} مستخدم — ${users.filter(u=>u.is_active!==false).length} نشط — ${users.filter(u=>u.is_active===false).length} موقوف`
                    : `${users.length} users — ${users.filter(u=>u.is_active!==false).length} active — ${users.filter(u=>u.is_active===false).length} suspended`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {[
                { v: users.length,                                   l: language==='ar'?'الكل':'Total',     bg:'bg-white/15' },
                { v: users.filter(u=>u.is_active!==false).length,    l: language==='ar'?'نشط':'Active',    bg:'bg-green-500/30' },
                { v: users.filter(u=>u.is_active===false).length,    l: language==='ar'?'موقوف':'Suspended',bg:'bg-red-500/30' },
                { v: companies.length,                               l: language==='ar'?'شركة':'Companies', bg:'bg-blue-500/30' },
              ].map((s,i) => (
                <div key={i} className={`${s.bg} rounded-xl px-3 py-1.5 text-center min-w-[50px]`}>
                  <p className="text-lg font-black">{s.v}</p>
                  <p className="text-[10px] text-white/70">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: language==='ar'?'إجمالي المستخدمين':'Total Users',  value: users.length,                                    color:'text-blue-700',   bg:'bg-blue-50' },
              { label: language==='ar'?'نشط':'Active',                      value: users.filter(u=>u.is_active!==false).length,     color:'text-green-700',  bg:'bg-green-50' },
              { label: language==='ar'?'موقوف':'Suspended',                  value: users.filter(u=>u.is_active===false).length,     color:'text-red-700',    bg:'bg-red-50' },
            ].map((s,i) => (
              <div key={i} className={`${s.bg} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{text.noUsers}</p>
            </div>
          ) : (() => {
            // Group by company
            const grouped = {};
            filteredUsers.forEach(user => {
              const key = user.company_id || '__platform__';
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(user);
            });

            return Object.entries(grouped).map(([companyId, companyUsers]) => {
              const company = companies.find(c => c.id === companyId);
              const companyName = companyId === '__platform__'
                ? (language==='ar' ? '🛡️ مستخدمو المنصة (Super Admins)' : '🛡️ Platform Users (Super Admins)')
                : (company?.name || companyUsers[0]?.company_name || (language==='ar'?'شركة غير معروفة':'Unknown Company'));
              const isExpanded = expandedCompany === companyId;
              const activeInGroup = companyUsers.filter(u => u.is_active !== false).length;

              return (
                <Card key={companyId} className="overflow-hidden border border-gray-100">

                  {/* Company header — clickable */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedCompany(isExpanded ? null : companyId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${companyId==='__platform__'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}`}>
                        {companyId==='__platform__' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{companyName}</h3>
                        <p className="text-xs text-gray-500">
                          {companyUsers.length} {language==='ar'?'مستخدم':'users'}
                          <span className="mx-1.5">·</span>
                          <span className="text-green-600 font-medium">{activeInGroup} {language==='ar'?'نشط':'active'}</span>
                          {company?.subscription_plan && (
                            <><span className="mx-1.5">·</span>
                            <span className="text-purple-600 font-medium capitalize">{company.subscription_plan}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {company && (
                        <Badge className={company.is_active!==false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {company.is_active!==false ? (language==='ar'?'نشط':'Active') : (language==='ar'?'موقوف':'Suspended')}
                        </Badge>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Users table */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">{language==='ar'?'المستخدم':'User'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'البريد':'Email'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'الهاتف':'Phone'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'الدور':'Role'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'الصلاحيات':'Permissions'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'آخر دخول':'Last Login'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'الحالة':'Status'}</TableHead>
                              <TableHead className="text-xs">{language==='ar'?'الإجراءات':'Actions'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {companyUsers.map(user => (
                              <TableRow key={user.id}
                                className={`hover:bg-gray-50 ${user.is_active===false?'opacity-60 bg-red-50/20':''}`}>

                                {/* Avatar + name */}
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${user.is_active===false?'bg-gray-400':'bg-gradient-to-br from-purple-500 to-indigo-600'}`}>
                                      {user.full_name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'U'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate max-w-[120px]">{user.full_name}</p>
                                      {user.employee_id && <p className="text-xs text-gray-400">{user.employee_id}</p>}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Email */}
                                <TableCell className="text-sm text-gray-600">
                                  <p className="truncate max-w-[160px]">{user.email}</p>
                                </TableCell>

                                {/* Phone */}
                                <TableCell className="text-sm text-gray-500">
                                  {user.phone || '—'}
                                </TableCell>

                                {/* Role */}
                                <TableCell>
                                  <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                                    {user.role?.replace(/_/g,' ') || '—'}
                                  </Badge>
                                </TableCell>

                                {/* Permissions count */}
                                <TableCell className="text-center">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                                    {user.permissions?.length || 0}
                                  </span>
                                </TableCell>

                                {/* Last login */}
                                <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                                  {user.last_login
                                    ? new Date(user.last_login).toLocaleDateString(language==='ar'?'ar-EG':'en-US')
                                    : '—'}
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                  {user.is_active===false ? (
                                    <Badge className="bg-red-100 text-red-700 text-xs">
                                      ❌ {language==='ar'?'موقوف':'Suspended'}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                      ✅ {language==='ar'?'نشط':'Active'}
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Actions */}
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {/* Toggle active/suspended */}
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`${API_URL}/api/admin/users/${user.id}/toggle`, {
                                            method: 'PUT', headers
                                          });
                                          if (res.ok) {
                                            toast.success(user.is_active!==false
                                              ? (language==='ar'?'✅ تم إيقاف المستخدم':'✅ User suspended')
                                              : (language==='ar'?'✅ تم تفعيل المستخدم':'✅ User activated'));
                                            fetchData();
                                          }
                                        } catch {}
                                      }}
                                      title={user.is_active!==false ? (language==='ar'?'إيقاف':'Suspend') : (language==='ar'?'تفعيل':'Activate')}
                                      className={`p-1.5 rounded-lg transition-colors ${user.is_active!==false ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`}
                                    >
                                      {user.is_active!==false ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                    </button>

                                    {/* Delete */}
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(language==='ar'?'حذف هذا المستخدم نهائياً؟':'Delete this user permanently?')) return;
                                        try {
                                          const res = await fetch(`${API_URL}/api/admin/users/${user.id}`, {
                                            method: 'DELETE', headers
                                          });
                                          if (res.ok) {
                                            toast.success(language==='ar'?'✅ تم حذف المستخدم':'✅ User deleted');
                                            fetchData();
                                          }
                                        } catch {}
                                      }}
                                      title={language==='ar'?'حذف':'Delete'}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </TableCell>

                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            });
          })()}
        </div>
      )}

    </div>
  );
}

export default SuperAdminDashboard;
