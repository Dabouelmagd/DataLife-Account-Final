import React, { useState, useEffect, useCallback } from 'react';
import PublishUpdatePanel from '../components/PublishUpdatePanel';
import AssistantsPanel from '../components/AssistantsPanel';
import SubscriptionsPanel from '../components/SubscriptionsPanel';
import PaymentsAdminPanel from '../components/PaymentsAdminPanel';
import ActivationCodesPanel from '../components/ActivationCodesPanel';
import MessagesAdminPanel from '../components/MessagesAdminPanel';
import SystemHealthPanel from '../components/SystemHealthPanel';
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
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
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
      <div className="flex gap-2 border-b pb-2">
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
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className={activeTab === 'users' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          <Users className="w-4 h-4 mr-2" />
          {text.users}
        </Button>
      </div>

      {/* Filters */}
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
        {activeTab === 'companies' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={text.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.all}</SelectItem>
              <SelectItem value="active">{text.active}</SelectItem>
              <SelectItem value="suspended">{text.suspended}</SelectItem>
              <SelectItem value="trial">{text.trial}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Companies Table */}
      {activeTab === 'companies' && (
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
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>{text.companyName}</TableHead>
                    <TableHead>{text.email}</TableHead>
                    <TableHead>{text.subscriptionType}</TableHead>
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                          >
                            {expandedCompany === company.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-purple-600" />
                            </div>
                            {company.name}
                          </div>
                        </TableCell>
                        <TableCell>{company.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {company.subscription?.plan || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{company.active_users || 0}</span>
                          <span className="text-gray-400">/{company.user_count || 0}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(company)}</TableCell>
                        <TableCell>{formatDate(company.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedCompany(company); setShowCompanyModal(true); }}
                              title={text.view}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleCompany(company.id, company.is_active !== false)}
                              title={company.is_active !== false ? text.suspend : text.activate}
                              className={company.is_active !== false ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {company.is_active !== false ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row - Company Users */}
                      {expandedCompany === company.id && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-gray-50 dark:bg-gray-900/50 p-4">
                            <div className="space-y-3">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {text.users} ({company.user_count || 0})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {users.filter(u => u.company_id === company.id).map(user => (
                                  <div key={user.id} className={`p-3 rounded-lg border ${user.is_active === false ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-gray-800'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${user.is_active === false ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-500 to-indigo-600'}`}>
                                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{user.full_name}</p>
                                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                        <Badge variant="outline" className="text-xs mt-1">{user.role}</Badge>
                                      </div>
                                      {user.is_active === false && (
                                        <Badge className="bg-red-100 text-red-700 text-xs">
                                          {text.suspended}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
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
      )}

      {/* Users Table */}
      {activeTab === 'updates' && (
        <Card>
          <CardContent className="p-6">
            <PublishUpdatePanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'health' && (
        <Card>
          <CardContent className="p-6">
            <SystemHealthPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionsPanel />
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardContent className="p-6">
            <PaymentsAdminPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'messages' && (
        <Card>
          <CardContent className="p-6">
            <MessagesAdminPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'codes' && (
        <Card>
          <CardContent className="p-6">
            <ActivationCodesPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'assistants' && (
        <Card>
          <CardContent className="p-6">
            <AssistantsPanel />
          </CardContent>
        </Card>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{text.noUsers}</p>
            </div>
          ) : (() => {
            // Group users by company
            const grouped = {};
            filteredUsers.forEach(user => {
              const companyId = user.company_id || '__platform__';
              if (!grouped[companyId]) grouped[companyId] = [];
              grouped[companyId].push(user);
            });
            return Object.entries(grouped).map(([companyId, companyUsers]) => {
              const company = companies.find(c => c.id === companyId);
              const companyName = companyId === '__platform__'
                ? (language === 'ar' ? '🛡️ مستخدمو المنصة (Super Admins)' : '🛡️ Platform Users (Super Admins)')
                : (company?.name || (language === 'ar' ? 'شركة غير معروفة' : 'Unknown Company'));
              const isExpanded = expandedCompany === companyId;
              return (
                <Card key={companyId} className="overflow-hidden">
                  {/* Company Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => setExpandedCompany(isExpanded ? null : companyId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${companyId === '__platform__' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {companyId === '__platform__' ? <Shield className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{companyName}</h3>
                        <p className="text-sm text-gray-500">
                          {companyUsers.length} {language === 'ar' ? 'مستخدم' : 'users'}
                          {company?.subscription_type && (
                            <span className="mx-2">·</span>
                          )}
                          {company?.subscription_type && (
                            <span className="text-purple-600 font-medium">{company.subscription_type}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {company && (
                        <Badge className={company.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {company.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'موقوف' : 'Suspended')}
                        </Badge>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Users List */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                            <TableHead className="text-xs">{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                            <TableHead className="text-xs">{text.email}</TableHead>
                            <TableHead className="text-xs">{text.role}</TableHead>
                            <TableHead className="text-xs">{text.status}</TableHead>
                            <TableHead className="text-xs">{text.actions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyUsers.map((user) => (
                            <TableRow key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${user.is_active === false ? 'opacity-60' : ''}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.is_active === false ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-500 to-indigo-600'}`}>
                                    {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                  </div>
                                  <span className="font-medium text-sm">{user.full_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{user.role}</Badge>
                              </TableCell>
                              <TableCell>
                                {user.is_active === false ? (
                                  <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1 w-fit">
                                    <XCircle className="w-3 h-3" />{text.suspended}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1 w-fit">
                                    <CheckCircle className="w-3 h-3" />{text.active}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title={text.edit}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            });
          })()}
        </div>
      )}

      {/* Company Details Modal */}
      <Dialog open={showCompanyModal} onOpenChange={setShowCompanyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              {text.companyDetails}
            </DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-6">
              {/* Company Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">{text.companyName}</label>
                  <p className="font-semibold">{selectedCompany.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{text.email}</label>
                  <p className="font-semibold">{selectedCompany.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{text.phone}</label>
                  <p className="font-semibold">{selectedCompany.phone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{text.status}</label>
                  <div className="mt-1">{getStatusBadge(selectedCompany)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{text.usersCount}</label>
                  <p className="font-semibold">{selectedCompany.user_count || 0}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{text.createdAt}</label>
                  <p className="font-semibold">{formatDate(selectedCompany.created_at)}</p>
                </div>
              </div>

              {/* Subscription Info */}
              {selectedCompany.subscription && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {text.subscriptionDetails}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">{text.plan}</label>
                      <p className="font-semibold capitalize">{selectedCompany.subscription.plan}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">{text.status}</label>
                      <Badge variant="outline" className="capitalize">
                        {selectedCompany.subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">{text.startDate}</label>
                      <p className="font-semibold">{formatDate(selectedCompany.subscription.start_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">{text.endDate}</label>
                      <p className="font-semibold">{formatDate(selectedCompany.subscription.end_date)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
