import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Users, DollarSign, FileText, Calendar, Settings, LogOut,
  Building2, TrendingUp, PieChart, BarChart, Calculator,
  Home, PlayCircle, ArrowUp, ArrowDown, AlertCircle, CheckCircle,
  Eye, Edit, Plus, Download, Printer, Clock, Award, TrendingDown,
  ChevronDown, ChevronRight, CreditCard, ShoppingCart
} from 'lucide-react';
import axios from 'axios';
import { getTranslation } from '../data/translations';
import NotificationCenter from './NotificationCenter';
import InvoicesModule from './InvoicesModule';
import CustomerPortalManagement from './CustomerPortalManagement';
import PurchasesModule from './PurchasesModule';
import ApprovalsModule from './ApprovalsModule';
import AttendanceManagement from './AttendanceManagement';

// Import sub-modules from existing files
import {
  SalariesModule,
  AllowancesModule,
  DeductionsModule,
  CasualLeaveModule,
  AnnualLeaveModule,
  AttendanceModule,
  HRReportsModule
} from './HRSubModules';

import {
  JournalEntriesModule,
  TreasuryModule,
  BankModule,
  CustomersModule,
  SuppliersModule,
  CustodyModule,
  AccountsModule,
  InventoryModule,
  FinancialReportsModule
} from './FinancialSubModules';

import { AnalyticsModule } from './AnalyticsModule';

const RealDashboard = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [activeSubModule, setActiveSubModule] = useState(null);
  const [activeHRSubModule, setActiveHRSubModule] = useState(null);
  const [activeFinancialSubModule, setActiveFinancialSubModule] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [financialReportTab, setFinancialReportTab] = useState('overview');
  const [financialPeriod, setFinancialPeriod] = useState('monthly');
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    activeProjects: 0
  });
  const isRTL = language === 'ar';
  
  const t = (key) => getTranslation(language, key);

  useEffect(() => {
    fetchCompanyData();
    fetchStats();
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

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Fetch data from various endpoints
      const [employeesRes, allowances, deductions, customers, suppliers, journalEntries] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/employees`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/allowances`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/deductions`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/financial/customers`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/financial/suppliers`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/financial/journal-entries`, config).catch(() => ({ data: [] }))
      ]);
      
      setEmployees(employeesRes.data);
      
      // Calculate financial stats from journal entries
      const revenue = journalEntries.data
        .filter(entry => entry.type === 'credit')
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);
      const expenses = journalEntries.data
        .filter(entry => entry.type === 'debit')
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);

      setStats({
        totalEmployees: employeesRes.data.length,
        totalAllowances: allowances.data.reduce((sum, a) => sum + (a.amount || 0), 0),
        totalDeductions: deductions.data.reduce((sum, d) => sum + (d.amount || 0), 0),
        totalCustomers: customers.data.length,
        totalSuppliers: suppliers.data.length,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        activeProjects: customers.data.length + suppliers.data.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Define modules based on user role
  const getAvailableModules = () => {
    const role = user?.role;
    const modules = [];

    // Dashboard available to all
    modules.push({ 
      id: 'dashboard', 
      name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', 
      icon: <Home /> 
    });

    // HR Module
    const hrRoles = ['General Manager', 'CEO', 'Board Chairman', 'HR Manager', 'Financial Manager', 'Chief Accountant',
                     'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'مدير الموارد البشرية', 'المدير المالي', 'رئيس الحسابات'];
    if (hrRoles.includes(role)) {
      modules.push({ 
        id: 'hr', 
        name: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', 
        icon: <Users />,
        hasSubModules: true,
        subModules: [
          { id: 'hr-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart /> },
          { id: 'salaries', name: language === 'ar' ? 'المرتبات' : 'Salaries', icon: <DollarSign /> },
          { id: 'allowances', name: language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime', icon: <Award /> },
          { id: 'deductions', name: language === 'ar' ? 'الخصومات' : 'Deductions', icon: <TrendingDown /> },
          { id: 'casual-leave', name: language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave', icon: <Calendar /> },
          { id: 'annual-leave', name: language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave', icon: <Calendar /> },
          { id: 'attendance', name: language === 'ar' ? 'الحضور والانصراف' : 'Attendance', icon: <Clock /> },
          { id: 'hr-reports', name: language === 'ar' ? 'التقارير' : 'Reports', icon: <FileText /> }
        ]
      });
    }

    // Financial Module
    const financialRoles = ['General Manager', 'CEO', 'Board Chairman', 'Financial Manager', 'Chief Accountant', 'Accountant',
                            'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير المالي', 'رئيس الحسابات', 'محاسب'];
    if (financialRoles.includes(role)) {
      modules.push({ 
        id: 'financial', 
        name: language === 'ar' ? 'المالية' : 'Financial', 
        icon: <Calculator />,
        hasSubModules: true,
        subModules: [
          { id: 'financial-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart /> },
          { id: 'journal-entries', name: language === 'ar' ? 'القيود اليومية' : 'Journal Entries', icon: <FileText /> },
          { id: 'treasury', name: language === 'ar' ? 'الخزنة' : 'Treasury', icon: <DollarSign /> },
          { id: 'custody', name: language === 'ar' ? 'العهدة' : 'Custody', icon: <Award /> },
          { id: 'accounts', name: language === 'ar' ? 'الحسابات' : 'Accounts', icon: <Building2 /> },
          { id: 'suppliers', name: language === 'ar' ? 'الموردين' : 'Suppliers', icon: <Users /> },
          { id: 'customers', name: language === 'ar' ? 'العملاء' : 'Customers', icon: <Users /> },
          { id: 'bank', name: language === 'ar' ? 'البنك' : 'Bank', icon: <DollarSign /> },
          { id: 'financial-reports', name: language === 'ar' ? 'التقارير' : 'Reports', icon: <FileText /> }
        ]
      });
    }
    
    // Invoices module - available to financial roles
    if (financialRoles.includes(role)) {
      modules.push({ 
        id: 'invoices', 
        name: language === 'ar' ? 'الفواتير' : 'Invoices', 
        icon: <FileText /> 
      });
    }

    // Purchases module - available to financial roles
    if (financialRoles.includes(role)) {
      modules.push({ 
        id: 'purchases', 
        name: language === 'ar' ? 'المشتريات' : 'Purchases', 
        icon: <ShoppingCart /> 
      });
    }

    // Approvals module - available to all users
    modules.push({ 
      id: 'approvals', 
      name: language === 'ar' ? 'الموافقات' : 'Approvals', 
      icon: <CheckCircle /> 
    });

    // Attendance module - available to HR and managers
    const hrRoles = ['General Manager', 'CEO', 'HR Manager', 'مدير عام', 'المدير التنفيذي', 'مدير الموارد البشرية'];
    if (hrRoles.includes(role) || financialRoles.includes(role)) {
      modules.push({ 
        id: 'attendance-mgmt', 
        name: language === 'ar' ? 'الحضور والانصراف' : 'Attendance', 
        icon: <Clock /> 
      });
    }

    // Customer Portal Management - available to managers
    const managerRoles = ['General Manager', 'CEO', 'Board Chairman', 'Financial Manager', 
                          'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير المالي'];
    if (managerRoles.includes(role)) {
      modules.push({ 
        id: 'customer-portal-mgmt', 
        name: language === 'ar' ? 'بوابة العملاء' : 'Customer Portal', 
        icon: <Users /> 
      });
    }

    // Inventory, Reports, Analytics modules available to managers
    if (managerRoles.includes(role)) {
      modules.push({ 
        id: 'inventory', 
        name: language === 'ar' ? 'المخزون' : 'Inventory', 
        icon: <PieChart /> 
      });
      modules.push({ 
        id: 'reports', 
        name: language === 'ar' ? 'التقارير' : 'Reports', 
        icon: <FileText /> 
      });
      modules.push({ 
        id: 'analytics', 
        name: language === 'ar' ? 'التحليلات' : 'Analytics', 
        icon: <BarChart /> 
      });
    }

    return modules;
  };

  const renderContent = () => {
    // Dashboard Overview
    if (activeModule === 'dashboard') {
      // KPI Cards data
      const kpiCards = [
        {
          title: t('demo.kpi.totalEmployees'),
          value: stats.totalEmployees,
          change: '+12%',
          trend: 'up',
          icon: <Users className="h-6 w-6" />,
          color: 'text-blue-600'
        },
        {
          title: t('demo.kpi.monthlyRevenue'),
          value: `${stats.monthlyRevenue.toLocaleString()} ${t('demo.currency')}`,
          change: '+23%',
          trend: 'up',
          icon: <DollarSign className="h-6 w-6" />,
          color: 'text-green-600'
        },
        {
          title: t('demo.kpi.activeProjects'),
          value: stats.activeProjects,
          change: '+8%',
          trend: 'up',
          icon: <Building2 className="h-6 w-6" />,
          color: 'text-purple-600'
        },
        {
          title: t('demo.kpi.efficiency'),
          value: `${stats.totalEmployees > 0 ? Math.round((stats.monthlyRevenue / stats.totalEmployees) / 100) : 0}%`,
          change: '+15%',
          trend: 'up',
          icon: <TrendingUp className="h-6 w-6" />,
          color: 'text-orange-600'
        }
      ];

      // Recent Activity (from real data)
      const translatedRecentActivity = [
        {
          title: language === 'ar' ? `تمت إضافة ${stats.totalEmployees} موظف إلى النظام` : `${stats.totalEmployees} employees in system`,
          time: language === 'ar' ? 'اليوم' : 'Today',
          type: 'success',
          module: language === 'ar' ? 'الموارد البشرية' : 'HR'
        },
        {
          title: language === 'ar' ? `إجمالي البدلات: ${stats.totalAllowances.toLocaleString()}` : `Total Allowances: ${stats.totalAllowances.toLocaleString()}`,
          time: language === 'ar' ? 'اليوم' : 'Today',
          type: 'success',
          module: language === 'ar' ? 'الموارد البشرية' : 'HR'
        },
        {
          title: language === 'ar' ? `العملاء: ${stats.totalCustomers}` : `Customers: ${stats.totalCustomers}`,
          time: language === 'ar' ? 'اليوم' : 'Today',
          type: 'info',
          module: language === 'ar' ? 'المالية' : 'Financial'
        },
        {
          title: language === 'ar' ? `الموردين: ${stats.totalSuppliers}` : `Suppliers: ${stats.totalSuppliers}`,
          time: language === 'ar' ? 'اليوم' : 'Today',
          type: 'info',
          module: language === 'ar' ? 'المالية' : 'Financial'
        }
      ];

      // Upcoming Tasks
      const translatedUpcomingTasks = [
        {
          title: language === 'ar' ? 'معالجة كشوف المرتبات الشهرية' : 'Process monthly payroll',
          dueDate: language === 'ar' ? 'مستحق غداً' : 'Due tomorrow',
          priority: 'high'
        },
        {
          title: language === 'ar' ? 'مراجعة فواتير الموردين' : 'Review supplier invoices',
          dueDate: language === 'ar' ? 'مستحق خلال يومين' : 'Due in 2 days',
          priority: 'medium'
        },
        {
          title: language === 'ar' ? 'تحديث مستويات المخزون' : 'Update inventory levels',
          dueDate: language === 'ar' ? 'مستحق خلال 3 أيام' : 'Due in 3 days',
          priority: 'medium'
        },
        {
          title: language === 'ar' ? 'إنشاء التقرير الفصلي' : 'Generate quarterly report',
          dueDate: language === 'ar' ? 'مستحق الأسبوع القادم' : 'Due next week',
          priority: 'low'
        }
      ];

      return (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiCards.map((kpi, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={kpi.color}>{kpi.icon}</div>
                    <Badge variant={kpi.trend === 'up' ? 'success' : 'destructive'} className="text-xs">
                      {kpi.trend === 'up' ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                      {kpi.change}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                  <p className="text-sm text-gray-600">{kpi.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PlayCircle className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('demo.quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col items-center justify-center"
                  onClick={() => {
                    setActiveModule('hr');
                    setActiveHRSubModule('salaries');
                  }}
                >
                  <Users className="h-5 w-5 mb-1" />
                  <span className="text-xs">{language === 'ar' ? 'إدارة الموظفين' : 'Manage Employees'}</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col items-center justify-center"
                  onClick={() => {
                    setActiveModule('financial');
                    setActiveFinancialSubModule('journal-entries');
                  }}
                >
                  <Calculator className="h-5 w-5 mb-1" />
                  <span className="text-xs">{t('demo.quickActions.newTransaction')}</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col items-center justify-center"
                  onClick={() => {
                    setActiveModule('reports');
                  }}
                >
                  <FileText className="h-5 w-5 mb-1" />
                  <span className="text-xs">{t('demo.quickActions.generateReport')}</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-16 flex flex-col items-center justify-center"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-5 w-5 mb-1" />
                  <span className="text-xs">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('demo.recentActivity.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {translatedRecentActivity.map((activity, index) => (
                    <div key={index} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                      <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-green-500' : activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{activity.module}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('demo.upcomingTasks.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {translatedUpcomingTasks.map((task, index) => (
                    <div key={index} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.priority === 'high' ? 'bg-red-100 text-red-600' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-gray-500">{task.dueDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // HR Sub-modules
    if (activeModule === 'hr') {
      // HR Overview
      if (activeHRSubModule === 'hr-overview' || !activeHRSubModule) {
        return (
          <div className="space-y-6">
            {/* HR Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{t('demo.hr.totalEmployees')}</p>
                      <p className="text-3xl font-bold">{stats.totalEmployees}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances'}</p>
                      <p className="text-3xl font-bold">{stats.totalAllowances.toLocaleString()}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}</p>
                      <p className="text-3xl font-bold">{stats.totalDeductions.toLocaleString()}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Table */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('demo.hr.employeeList')}</CardTitle>
                  <Button 
                    size="sm" 
                    className="bg-[#28376B]"
                    onClick={() => {
                      setActiveModule('hr');
                      setActiveHRSubModule('salaries');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('demo.hr.addEmployee')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {employees.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('demo.hr.employee')}</TableHead>
                        <TableHead>{t('demo.hr.position')}</TableHead>
                        <TableHead>{t('demo.hr.department')}</TableHead>
                        <TableHead>{t('demo.hr.status')}</TableHead>
                        <TableHead>{t('demo.hr.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarFallback>{employee.employee_name?.split(' ').map(n => n[0]).join('') || 'NA'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{employee.employee_name || 'N/A'}</p>
                                <p className="text-sm text-gray-500">{employee.employee_id || ''}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.job_title || 'N/A'}</TableCell>
                          <TableCell>{employee.department || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="success">
                              {language === 'ar' ? 'نشط' : 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="ghost"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {language === 'ar' ? 'لا يوجد موظفين بعد' : 'No employees yet'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }
      
      // HR Sub-module components
      switch (activeHRSubModule) {
        case 'salaries':
          return <SalariesModule language={language} userRole={user?.role} />;
        case 'allowances':
          return <AllowancesModule language={language} userRole={user?.role} />;
        case 'deductions':
          return <DeductionsModule language={language} userRole={user?.role} />;
        case 'casual-leave':
          return <CasualLeaveModule language={language} userRole={user?.role} />;
        case 'annual-leave':
          return <AnnualLeaveModule language={language} userRole={user?.role} />;
        case 'attendance':
          return <AttendanceModule language={language} userRole={user?.role} />;
        case 'hr-reports':
          return <HRReportsModule language={language} userRole={user?.role} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }

    // Financial Sub-modules
    if (activeModule === 'financial') {
      // Financial Overview  
      if (activeFinancialSubModule === 'financial-overview' || !activeFinancialSubModule) {
        return (
          <div className="space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">{language === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</p>
                      <p className="text-2xl font-bold text-green-800">{stats.monthlyRevenue.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-green-600">+15.2%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-red-50 to-red-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700">{language === 'ar' ? 'المصروفات الشهرية' : 'Monthly Expenses'}</p>
                      <p className="text-2xl font-bold text-red-800">{stats.monthlyExpenses.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-red-600">+8.5%</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</p>
                      <p className="text-2xl font-bold text-blue-800">{(stats.monthlyRevenue - stats.monthlyExpenses).toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-blue-600">{stats.monthlyRevenue > 0 ? ((stats.monthlyRevenue - stats.monthlyExpenses) / stats.monthlyRevenue * 100).toFixed(1) : 0}% {language === 'ar' ? 'هامش' : 'margin'}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">{language === 'ar' ? 'العملاء النشطين' : 'Active Customers'}</p>
                      <p className="text-2xl font-bold text-purple-800">{stats.totalCustomers}</p>
                      <p className="text-sm text-purple-600">{language === 'ar' ? 'عميل' : 'customers'}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Financial Actions */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'الإجراءات المالية السريعة' : 'Quick Financial Actions'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveFinancialSubModule('journal-entries')}
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-sm">{language === 'ar' ? 'قيد يومي' : 'Journal Entry'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveFinancialSubModule('customers')}
                  >
                    <Users className="h-6 w-6" />
                    <span className="text-sm">{language === 'ar' ? 'عميل جديد' : 'New Customer'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveFinancialSubModule('suppliers')}
                  >
                    <Building2 className="h-6 w-6" />
                    <span className="text-sm">{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveFinancialSubModule('financial-reports')}
                  >
                    <BarChart className="h-6 w-6" />
                    <span className="text-sm">{language === 'ar' ? 'التقارير' : 'Reports'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'ملخص مالي' : 'Financial Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-medium">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</span>
                    <span className="text-lg font-bold">{stats.totalCustomers}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-medium">{language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers'}</span>
                    <span className="text-lg font-bold">{stats.totalSuppliers}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="font-medium">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</span>
                    <span className="text-lg font-bold text-green-600">{stats.monthlyRevenue.toLocaleString()} {t('demo.currency')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
                    <span className="text-lg font-bold text-red-600">{stats.monthlyExpenses.toLocaleString()} {t('demo.currency')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }
      
      // Financial Sub-module components
      switch (activeFinancialSubModule) {
        case 'journal-entries':
          return <JournalEntriesModule language={language} userRole={user?.role} />;
        case 'treasury':
          return <TreasuryModule language={language} userRole={user?.role} />;
        case 'custody':
          return <CustodyModule language={language} userRole={user?.role} />;
        case 'accounts':
          return <AccountsModule language={language} userRole={user?.role} />;
        case 'bank':
          return <BankModule language={language} userRole={user?.role} />;
        case 'customers':
          return <CustomersModule language={language} userRole={user?.role} />;
        case 'suppliers':
          return <SuppliersModule language={language} userRole={user?.role} />;
        case 'financial-reports':
          return <FinancialReportsModule language={language} userRole={user?.role} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }
    
    // Inventory Module
    if (activeModule === 'inventory') {
      return <InventoryModule language={language} userRole={user?.role} />;
    }

    // Reports Module
    if (activeModule === 'reports') {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'التقارير' : 'Reports'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'التقارير والتحليلات' : 'Reports and Analytics'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => {
                    setActiveModule('hr');
                    setActiveHRSubModule('hr-reports');
                  }}
                >
                  <Users className="h-6 w-6 mb-2" />
                  <span>{language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports'}</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => {
                    setActiveModule('financial');
                    setActiveFinancialSubModule('financial-reports');
                  }}
                >
                  <Calculator className="h-6 w-6 mb-2" />
                  <span>{language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Analytics Module
    if (activeModule === 'analytics') {
      return <AnalyticsModule language={language} userRole={user?.role} />;
    }

    // Invoices Module
    if (activeModule === 'invoices') {
      return <InvoicesModule />;
    }

    // Customer Portal Management Module
    if (activeModule === 'customer-portal-mgmt') {
      return <CustomerPortalManagement />;
    }

    // Purchases Module
    if (activeModule === 'purchases') {
      return <PurchasesModule />;
    }

    // Approvals Module
    if (activeModule === 'approvals') {
      return <ApprovalsModule />;
    }

    // Attendance Module
    if (activeModule === 'attendance-mgmt') {
      return <AttendanceManagement />;
    }

    return null;
  };

  const modules = getAvailableModules();
  const currentModule = modules.find(m => m.id === activeModule);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Sidebar */}
      <div className="w-72 bg-gradient-to-b from-[#1e293b] to-[#0f172a] shadow-2xl flex flex-col relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-32 -translate-x-32"></div>
        
        {/* Company Logo/Name - Modern Header */}
        <div className="p-6 pb-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 shadow-xl">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-14 object-contain mx-auto filter drop-shadow-lg" />
            ) : (
              <h2 className="text-xl font-bold text-white text-center tracking-tight">{company?.name}</h2>
            )}
          </div>
        </div>

        {/* Current User Info - Professional Card */}
        <div className="px-6 pb-4 relative z-10">
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20 shadow-xl">
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <NotificationCenter />
              
              {/* User Avatar */}
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={user.full_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/50 shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </div>
              )}
              
              {/* User Details */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {user?.full_name || 'User'}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge className={`text-xs px-2 py-0.5 ${
                    ['CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(user?.role) 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0'
                      : ['General Manager', 'مدير عام'].includes(user?.role)
                      ? 'bg-gradient-to-r from-purple-400 to-pink-500 text-white border-0'
                      : ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات'].includes(user?.role)
                      ? 'bg-gradient-to-r from-green-400 to-teal-500 text-white border-0'
                      : ['HR Manager', 'مدير الموارد البشرية'].includes(user?.role)
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white border-0'
                      : 'bg-gray-500 text-white border-0'
                  }`}>
                    {user?.role || 'N/A'}
                  </Badge>
                </div>
                <p className="text-gray-300 text-xs mt-1 truncate">
                  {user?.email || 'No email'}
                </p>
              </div>
            </div>
            
            {/* Permissions Indicator */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-gray-300 mb-2">
                {language === 'ar' ? 'الصلاحيات:' : 'Permissions:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {modules.map((module, index) => (
                  <span 
                    key={index}
                    className="text-xs px-2 py-1 bg-white/10 text-white rounded-lg"
                    title={module.name}
                  >
                    {React.cloneElement(module.icon, { className: 'h-3 w-3' })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Modules - Modern Design */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 relative z-10 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {modules.map(module => (
            <div key={module.id} className="space-y-1">
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 group ${
                  activeModule === module.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
                }`}
                onClick={() => {
                  setActiveModule(module.id);
                  if (module.id === 'hr') {
                    setActiveHRSubModule(null);
                    setActiveFinancialSubModule(null);
                  } else if (module.id === 'financial') {
                    setActiveFinancialSubModule(null);
                    setActiveHRSubModule(null);
                  } else {
                    setActiveHRSubModule(null);
                    setActiveFinancialSubModule(null);
                  }
                  setActiveSubModule(null);
                }}
              >
                <div className={`p-2 rounded-lg transition-all duration-300 ${
                  activeModule === module.id 
                    ? 'bg-white/20' 
                    : 'bg-white/5 group-hover:bg-white/10'
                }`}>
                  {React.cloneElement(module.icon, { className: 'h-5 w-5' })}
                </div>
                <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-semibold`}>{module.name}</span>
                {module.hasSubModules && (
                  <div className={`transition-transform duration-300 ${activeModule === module.id ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Sub-modules - Modern Collapse Animation */}
              {module.hasSubModules && activeModule === module.id && (
                <div className={`space-y-1 ${isRTL ? 'mr-4 pr-4 border-r-2' : 'ml-4 pl-4 border-l-2'} border-blue-500/30 animate-in slide-in-from-top-2 duration-300`}>
                  {module.subModules.map(sub => {
                    const isActive = module.id === 'hr' ? activeHRSubModule === sub.id : 
                                    module.id === 'financial' ? activeFinancialSubModule === sub.id : 
                                    activeSubModule === sub.id;
                    
                    return (
                      <button
                        key={sub.id}
                        className={`w-full text-sm px-4 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-white/20 text-white font-semibold shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        } ${isRTL ? 'text-right' : 'text-left'}`}
                        onClick={() => {
                          if (module.id === 'hr') {
                            setActiveHRSubModule(sub.id);
                          } else if (module.id === 'financial') {
                            setActiveFinancialSubModule(sub.id);
                          } else {
                            setActiveSubModule(sub.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                            isActive ? 'bg-white w-2 h-2' : 'bg-gray-500'
                          }`}></div>
                          {sub.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Actions - Modern Glass Effect */}
        <div className="p-4 space-y-2 relative z-10 border-t border-white/10">
          {['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'].includes(user?.role) && (
            <>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 group"
                onClick={() => navigate('/user-management')}
                data-testid="user-management-btn"
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all duration-300">
                  <Users className="h-5 w-5" />
                </div>
                <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
                  {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
                </span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all duration-300 group"
                onClick={() => navigate('/subscription')}
                data-testid="subscription-btn"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-all duration-300">
                  <CreditCard className="h-5 w-5" />
                </div>
                <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
                  {language === 'ar' ? 'الاشتراكات' : 'Subscriptions'}
                </span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-300 group"
                onClick={() => navigate('/admin')}
                data-testid="admin-dashboard-btn"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-all duration-300">
                  <BarChart className="h-5 w-5" />
                </div>
                <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
                  {language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}
                </span>
              </button>
            </>
          )}
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 group"
            onClick={() => navigate('/settings')}
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all duration-300">
              <Settings className="h-5 w-5" />
            </div>
            <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 group"
            onClick={handleLogout}
          >
            <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-all duration-300">
              <LogOut className="h-5 w-5" />
            </div>
            <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
              {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default RealDashboard;
