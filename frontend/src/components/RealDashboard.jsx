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
  ChevronDown, ChevronRight, CreditCard, ShoppingCart, FolderKanban,
  Upload, BookOpen, Package
} from 'lucide-react';
import axios from 'axios';
import { getTranslation } from '../data/translations';
import NotificationCenter from './NotificationCenter';
import ModernSidebar from './ModernSidebar';
import AppFooter from './AppFooter';
import InvoicesModule from './InvoicesModule';
import CustomerPortalManagement from './CustomerPortalManagement';
import PurchasesModule from './PurchasesModule';
import ApprovalsModule from './ApprovalsModule';
import AttendanceManagement from './AttendanceManagement';
import ProjectsModule from './ProjectsModule';
import DocumentsModule from './DocumentsModule';
import JournalEntriesPage from '../pages/JournalEntriesPage';
import GeneralLedgerPage from '../pages/GeneralLedgerPage';
import FinancialReportsPage from '../pages/FinancialReportsPage';
import InvoicesPage from '../pages/InvoicesPage';
import PartiesPage from '../pages/PartiesPage';
import ProductsPage from '../pages/ProductsPage';
import InvoiceReportsPage from '../pages/InvoiceReportsPage';
import CurrenciesPage from '../pages/CurrenciesPage';
import InventoryPage from '../pages/InventoryPage';
import PayrollPage from '../pages/PayrollPage';
import EmployeeProfilePage from '../pages/EmployeeProfilePage';
import ShiftsPage from '../pages/ShiftsPage';
import AttendancePage from '../pages/AttendancePage';
import HRSettingsPage from '../pages/HRSettingsPage';
import ETASettingsPage from '../pages/ETASettingsPage';

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
import CompanySettings from './CompanySettings';
import ImportDataPage from './ImportDataPage';

const RealDashboard = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [activeSubModule, setActiveSubModule] = useState(null);
  const [activeHRSubModule, setActiveHRSubModule] = useState(null);
  const [activeFinancialSubModule, setActiveFinancialSubModule] = useState(null);
  const [activeInvoiceSubModule, setActiveInvoiceSubModule] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
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

    // ========================================
    // الأدوار الإدارية العليا (صلاحيات كاملة)
    // ========================================
    const topManagementRoles = [
      'General Manager', 'CEO', 'Board Chairman',
      'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'
    ];

    // ========================================
    // أدوار HR فقط
    // ========================================
    const hrOnlyRoles = ['HR Manager', 'مدير الموارد البشرية'];

    // ========================================
    // أدوار المالية (المدير المالي ورئيس الحسابات) - لديهم فواتير ومشتريات
    // ========================================
    const financialManagerRoles = [
      'Financial Manager', 'Chief Accountant',
      'المدير المالي', 'رئيس الحسابات'
    ];

    // ========================================
    // الأدوار التنفيذية (محاسب وموظف) - المالية والتقارير فقط
    // ========================================
    const executiveRoles = ['Employee', 'موظف', 'Accountant', 'محاسب'];

    // ========================================
    // أدوار المشاريع فقط
    // ========================================
    const projectOnlyRoles = ['Project Manager', 'مدير المشاريع'];

    // HR Module - للإدارة العليا ومدير HR فقط
    if (topManagementRoles.includes(role) || hrOnlyRoles.includes(role)) {
      modules.push({ 
        id: 'hr', 
        name: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', 
        icon: <Users />,
        hasSubModules: true,
        subModules: [
          { id: 'hr-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart /> },
          { id: 'payroll', name: language === 'ar' ? 'الرواتب والأجور' : 'Payroll', icon: <DollarSign /> },
          { id: 'shifts', name: language === 'ar' ? 'الورديات' : 'Work Shifts', icon: <Clock /> },
          { id: 'salaries', name: language === 'ar' ? 'المرتبات' : 'Salaries', icon: <DollarSign /> },
          { id: 'allowances', name: language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime', icon: <Award /> },
          { id: 'deductions', name: language === 'ar' ? 'الخصومات' : 'Deductions', icon: <TrendingDown /> },
          { id: 'casual-leave', name: language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave', icon: <Calendar /> },
          { id: 'annual-leave', name: language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave', icon: <Calendar /> },
          { id: 'attendance', name: language === 'ar' ? 'الحضور والانصراف' : 'Attendance', icon: <Clock /> },
          { id: 'hr-reports', name: language === 'ar' ? 'التقارير' : 'Reports', icon: <FileText /> },
          { id: 'hr-settings', name: language === 'ar' ? 'إعدادات الحضور والرواتب' : 'HR Settings', icon: <Settings /> }
        ]
      });
    }

    // Financial Module - للإدارة العليا والأدوار المالية والتنفيذية
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role) || executiveRoles.includes(role)) {
      modules.push({ 
        id: 'financial', 
        name: language === 'ar' ? 'المالية والعمليات' : 'Finance & Operations', 
        icon: <Calculator />,
        hasSubModules: true,
        subModules: [
          // نظرة عامة
          { id: 'financial-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart />, group: 'overview' },
          
          // المحاسبة
          { id: 'divider-accounting', name: language === 'ar' ? '── المحاسبة ──' : '── Accounting ──', isDivider: true },
          { id: 'journal-entries', name: language === 'ar' ? 'القيود اليومية' : 'Journal Entries', icon: <FileText />, group: 'accounting' },
          { id: 'general-ledger', name: language === 'ar' ? 'دفتر الأستاذ' : 'General Ledger', icon: <BookOpen />, group: 'accounting' },
          { id: 'accounts', name: language === 'ar' ? 'شجرة الحسابات' : 'Chart of Accounts', icon: <Building2 />, group: 'accounting' },
          { id: 'financial-reports', name: language === 'ar' ? 'التقارير المالية' : 'Financial Reports', icon: <PieChart />, group: 'accounting' },
          
          // الخزينة والنقدية
          { id: 'divider-treasury', name: language === 'ar' ? '── الخزينة ──' : '── Treasury ──', isDivider: true },
          { id: 'treasury', name: language === 'ar' ? 'الخزنة' : 'Cash Box', icon: <DollarSign />, group: 'treasury' },
          { id: 'bank', name: language === 'ar' ? 'البنك' : 'Bank', icon: <DollarSign />, group: 'treasury' },
          { id: 'custody', name: language === 'ar' ? 'العهدة' : 'Custody', icon: <Award />, group: 'treasury' },
          
          // العملاء والموردين
          { id: 'divider-parties', name: language === 'ar' ? '── الأطراف ──' : '── Parties ──', isDivider: true },
          { id: 'customers', name: language === 'ar' ? 'العملاء' : 'Customers', icon: <Users />, group: 'parties' },
          { id: 'suppliers', name: language === 'ar' ? 'الموردين' : 'Suppliers', icon: <Users />, group: 'parties' },
          
          // المشتريات
          { id: 'divider-purchases', name: language === 'ar' ? '── المشتريات ──' : '── Purchases ──', isDivider: true },
          { id: 'purchases', name: language === 'ar' ? 'أوامر الشراء' : 'Purchase Orders', icon: <ShoppingCart />, group: 'purchases' },
          { id: 'purchase-invoices', name: language === 'ar' ? 'فواتير المشتريات' : 'Purchase Invoices', icon: <FileText />, group: 'purchases' },
          
          // المخزون
          { id: 'divider-inventory', name: language === 'ar' ? '── المخزون ──' : '── Inventory ──', isDivider: true },
          { id: 'inventory', name: language === 'ar' ? 'إدارة المخزون' : 'Inventory Management', icon: <Package />, group: 'inventory' },
          { id: 'products', name: language === 'ar' ? 'المنتجات والخدمات' : 'Products & Services', icon: <Package />, group: 'inventory' },
          { id: 'currencies', name: language === 'ar' ? 'العملات' : 'Currencies', icon: <DollarSign />, group: 'inventory' },
          
          // المشاريع
          { id: 'divider-projects', name: language === 'ar' ? '── المشاريع ──' : '── Projects ──', isDivider: true },
          { id: 'projects', name: language === 'ar' ? 'المشاريع' : 'Projects', icon: <FolderKanban />, group: 'projects' },
          { id: 'tasks', name: language === 'ar' ? 'المهام' : 'Tasks', icon: <CheckCircle />, group: 'projects' }
        ]
      });
    }
    
    // Invoices module - للإدارة العليا والأدوار المالية العليا فقط (ليس للتنفيذية)
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role)) {
      modules.push({ 
        id: 'invoices', 
        name: language === 'ar' ? 'الفواتير الإلكترونية' : 'E-Invoices', 
        icon: <FileText />,
        hasSubModules: true,
        subModules: [
          { id: 'invoices', name: language === 'ar' ? 'الفواتير' : 'Invoices', icon: <FileText /> },
          { id: 'reports', name: language === 'ar' ? 'تقارير الفواتير' : 'Invoice Reports', icon: <BarChart /> },
          { id: 'eta-settings', name: language === 'ar' ? 'إعدادات مصلحة الضرائب' : 'Tax Authority Settings', icon: <Settings /> }
        ]
      });
    }

    // Reports module - للإدارة العليا والأدوار المالية والتنفيذية (طباعة فقط)
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role) || executiveRoles.includes(role)) {
      modules.push({ 
        id: 'reports', 
        name: language === 'ar' ? 'التقارير' : 'Reports', 
        icon: <FileText /> 
      });
    }

    // Analytics module - للإدارة العليا والأدوار المالية العليا فقط
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role)) {
      modules.push({ 
        id: 'analytics', 
        name: language === 'ar' ? 'التحليلات' : 'Analytics', 
        icon: <BarChart /> 
      });
    }

    // Approvals module - للإدارة العليا فقط
    if (topManagementRoles.includes(role)) {
      modules.push({ 
        id: 'approvals', 
        name: language === 'ar' ? 'الموافقات' : 'Approvals', 
        icon: <CheckCircle /> 
      });
    }

    // Settings module - للإدارة العليا فقط
    if (topManagementRoles.includes(role)) {
      modules.push({ 
        id: 'settings', 
        name: language === 'ar' ? 'الإعدادات' : 'Settings', 
        icon: <Settings /> 
      });
    }

    // Import Data module - للإدارة العليا والأدوار المالية والموارد البشرية
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role) || hrOnlyRoles.includes(role)) {
      modules.push({ 
        id: 'import', 
        name: language === 'ar' ? 'استيراد البيانات' : 'Import Data', 
        icon: <Upload /> 
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
                                onClick={() => {
                                  setSelectedEmployeeId(employee.id || employee.employee_id);
                                  setActiveHRSubModule('employee-profile');
                                }}
                                title={language === 'ar' ? 'عرض الملف' : 'View Profile'}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedEmployeeId(employee.id || employee.employee_id);
                                  setActiveHRSubModule('employee-profile');
                                }}
                                title={language === 'ar' ? 'تعديل' : 'Edit'}
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
        case 'payroll':
          return <PayrollPage />;
        case 'shifts':
          return <ShiftsPage language={language} />;
        case 'attendance':
          return <AttendancePage language={language} />;
        case 'hr-settings':
          return <HRSettingsPage />;
        case 'employee-profile':
          return selectedEmployeeId ? (
            <EmployeeProfilePage 
              employeeId={selectedEmployeeId} 
              onBack={() => { setSelectedEmployeeId(null); setActiveHRSubModule('hr-overview'); }}
              language={language}
            />
          ) : null;
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
          return <JournalEntriesPage />;
        case 'general-ledger':
          return <GeneralLedgerPage />;
        case 'financial-reports':
          return <FinancialReportsPage />;
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
        case 'products':
          return <ProductsPage />;
        case 'currencies':
          return <CurrenciesPage />;
        case 'purchases':
        case 'purchase-invoices':
          return <PurchasesModule language={language} userRole={user?.role} />;
        case 'inventory':
          return <InventoryPage />;
        case 'projects':
        case 'tasks':
          return <ProjectsPage language={language} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
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
      // Invoice sub-modules
      switch (activeInvoiceSubModule) {
        case 'invoices':
          return <InvoicesPage />;
        case 'reports':
          return <InvoiceReportsPage />;
        case 'eta-settings':
          return <ETASettingsPage />;
        default:
          return <InvoicesPage />;
      }
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

    // Projects & Tasks Module
    if (activeModule === 'projects') {
      return <ProjectsModule />;
    }

    // Documents Module
    if (activeModule === 'documents') {
      return <DocumentsModule />;
    }

    // Settings Module
    if (activeModule === 'settings') {
      return <CompanySettings />;
    }

    // Import Data Module
    if (activeModule === 'import') {
      return <ImportDataPage language={language} />;
    }

    return null;
  };

  const modules = getAvailableModules();
  const currentModule = modules.find(m => m.id === activeModule);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Sidebar - Redesigned */}
      <ModernSidebar
        user={user}
        language={language}
        modules={modules}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        activeHRSubModule={activeHRSubModule}
        setActiveHRSubModule={setActiveHRSubModule}
        activeFinancialSubModule={activeFinancialSubModule}
        setActiveFinancialSubModule={setActiveFinancialSubModule}
        activeInvoiceSubModule={activeInvoiceSubModule}
        setActiveInvoiceSubModule={setActiveInvoiceSubModule}
        onLogout={handleLogout}
        navigate={navigate}
        company={company}
      />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-y-auto ${isRTL ? 'mr-72' : 'ml-72'}`}>
        <div className="flex-1 p-6">
          {renderContent()}
        </div>
        {/* Footer */}
        <AppFooter />
      </div>
    </div>
  );
};

export default RealDashboard;
