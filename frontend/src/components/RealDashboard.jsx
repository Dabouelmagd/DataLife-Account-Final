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
  Upload, BookOpen, Package, UserMinus, Scale, Book, Shield
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
import ProjectsPage from '../pages/ProjectsPage';
import CasualLeavePage from '../pages/CasualLeavePage';
import AnnualLeavePage from '../pages/AnnualLeavePage';
import HRReportsPage from '../pages/HRReportsPage';
import TerminationPage from '../pages/TerminationPage';
import DeductionsPage from '../pages/DeductionsPage';
import AllowancesPage from '../pages/AllowancesPage';
import ShiftsManagementPage from '../pages/ShiftsManagementPage';
import SalariesPage from '../pages/SalariesPage';
import HRComprehensiveReportsPage from '../pages/HRComprehensiveReportsPage';
import SystemReportsPage from '../pages/SystemReportsPage';
import TrialBalancePage from '../pages/TrialBalancePage';
import IncomeStatementPage from '../pages/IncomeStatementPage';
import BalanceSheetPage from '../pages/BalanceSheetPage';
import BankManagementPage from '../pages/BankManagementPage';
import BankSettingsPage from '../pages/BankSettingsPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import NotificationSettingsPage from '../pages/NotificationSettingsPage';
import UserGuidePage from '../pages/UserGuidePage';
import PermissionsSettingsPage from '../pages/PermissionsSettingsPage';
import ReportManagementPage from '../pages/ReportManagementPage';

// Import new overview components
import HROverviewContent from './HROverviewContent';
import FinancialOverviewContent from './FinancialOverviewContent';
import InvoicesOverviewContent from './InvoicesOverviewContent';

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
import DashboardContent from './DashboardContent';

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
    // أدوار المالية (المدير المالي ورئيس الحسابات) - لديهم فواتير ومشتريات + HR مالي
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

    // ========================================
    // HR Module - تقسيم إلى إداري ومالي
    // ========================================
    
    // الأقسام الإدارية (بيانات، حضور، إجازات، إلخ)
    const hrAdminSubModules = [
      { id: 'hr-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart /> },
      { id: 'shifts', name: language === 'ar' ? 'الورديات' : 'Work Shifts', icon: <Clock /> },
      { id: 'attendance', name: language === 'ar' ? 'الحضور والانصراف' : 'Attendance', icon: <Clock /> },
      { id: 'casual-leave', name: language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave', icon: <Calendar /> },
      { id: 'annual-leave', name: language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave', icon: <Calendar /> },
      { id: 'termination', name: language === 'ar' ? 'إنهاء الخدمة' : 'Termination', icon: <UserMinus /> },
      { id: 'hr-settings', name: language === 'ar' ? 'إعدادات الحضور والرواتب' : 'HR Settings', icon: <Settings /> }
    ];
    
    // الأقسام المالية (رواتب، بدلات، خصومات، تقارير)
    const hrFinancialSubModules = [
      { id: 'payroll', name: language === 'ar' ? 'الرواتب والأجور' : 'Payroll', icon: <DollarSign /> },
      { id: 'salaries', name: language === 'ar' ? 'المرتبات' : 'Salaries', icon: <DollarSign /> },
      { id: 'allowances', name: language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime', icon: <Award /> },
      { id: 'deductions', name: language === 'ar' ? 'الخصومات' : 'Deductions', icon: <TrendingDown /> },
      { id: 'hr-reports', name: language === 'ar' ? 'التقارير' : 'Reports', icon: <FileText /> },
      { id: 'hr-comprehensive-reports', name: language === 'ar' ? 'التقارير الشاملة' : 'Comprehensive Reports', icon: <BarChart /> }
    ];

    // تحديد صلاحيات HR للمستخدم
    const hasHRAdminAccess = topManagementRoles.includes(role) || 
                            financialManagerRoles.includes(role) || 
                            hrOnlyRoles.includes(role);
    const hasHRFinancialAccess = topManagementRoles.includes(role) || 
                                 financialManagerRoles.includes(role);

    // بناء قائمة الأقسام الفرعية لـ HR حسب الصلاحيات
    let hrSubModules = [];
    
    if (hasHRAdminAccess && hasHRFinancialAccess) {
      // الإدارة العليا والمدير المالي يرون كل شيء
      hrSubModules = [
        { id: 'hr-overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <BarChart /> },
        { id: 'divider-admin', name: language === 'ar' ? '── إداري ──' : '── Administrative ──', isDivider: true },
        ...hrAdminSubModules.filter(m => m.id !== 'hr-overview'),
        { id: 'divider-financial', name: language === 'ar' ? '── مالي ──' : '── Financial ──', isDivider: true },
        ...hrFinancialSubModules,
      ];
    } else if (hasHRAdminAccess) {
      // مدير HR يرى الإداري فقط
      hrSubModules = hrAdminSubModules;
    } else if (hasHRFinancialAccess) {
      // المالية ترى المالي فقط
      hrSubModules = hrFinancialSubModules;
    }

    // إضافة وحدة HR إذا كان للمستخدم صلاحية
    if (hasHRAdminAccess || hasHRFinancialAccess) {
      modules.push({ 
        id: 'hr', 
        name: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', 
        icon: <Users />,
        hasSubModules: true,
        subModules: hrSubModules
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
          { id: 'trial-balance', name: language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance', icon: <Scale />, group: 'accounting' },
          { id: 'income-statement', name: language === 'ar' ? 'قائمة الدخل' : 'Income Statement', icon: <TrendingUp />, group: 'accounting' },
          { id: 'balance-sheet', name: language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet', icon: <Building2 />, group: 'accounting' },
          { id: 'financial-reports', name: language === 'ar' ? 'التقارير المالية' : 'Financial Reports', icon: <PieChart />, group: 'accounting' },
          
          // الخزينة والنقدية
          { id: 'divider-treasury', name: language === 'ar' ? '── الخزينة ──' : '── Treasury ──', isDivider: true },
          { id: 'treasury', name: language === 'ar' ? 'الخزنة' : 'Cash Box', icon: <DollarSign />, group: 'treasury' },
          { id: 'bank', name: language === 'ar' ? 'البنك' : 'Bank', icon: <DollarSign />, group: 'treasury' },
          { id: 'bank-settings', name: language === 'ar' ? 'إعدادات البنك' : 'Bank Settings', icon: <Settings />, group: 'treasury' },
          { id: 'custody', name: language === 'ar' ? 'العهدة' : 'Custody', icon: <Award />, group: 'treasury' },
          
          // العملاء والموردين
          { id: 'divider-parties', name: language === 'ar' ? '── الأطراف ──' : '── Parties ──', isDivider: true },
          { id: 'customers', name: language === 'ar' ? 'العملاء' : 'Customers', icon: <Users />, group: 'parties' },
          { id: 'suppliers', name: language === 'ar' ? 'الموردين' : 'Suppliers', icon: <Users />, group: 'parties' },
          
          // المشتريات
          { id: 'divider-purchases', name: language === 'ar' ? '── المشتريات ──' : '── Purchases ──', isDivider: true },
          { id: 'purchases', name: language === 'ar' ? 'المشتريات وأوامر الشراء' : 'Purchases & Orders', icon: <ShoppingCart />, group: 'purchases' },
          
          // المخزون
          { id: 'divider-inventory', name: language === 'ar' ? '── المخزون ──' : '── Inventory ──', isDivider: true },
          { id: 'inventory', name: language === 'ar' ? 'إدارة المخزون' : 'Inventory Management', icon: <Package />, group: 'inventory' },
          { id: 'products', name: language === 'ar' ? 'المنتجات والخدمات' : 'Products & Services', icon: <Package />, group: 'inventory' },
          
          // المشاريع
          { id: 'divider-projects', name: language === 'ar' ? '── المشاريع ──' : '── Projects ──', isDivider: true },
          { id: 'projects', name: language === 'ar' ? 'المشاريع والمهام' : 'Projects & Tasks', icon: <FolderKanban />, group: 'projects' },
          
          // العملات
          { id: 'divider-currencies', name: language === 'ar' ? '── العملات ──' : '── Currencies ──', isDivider: true },
          { id: 'currencies', name: language === 'ar' ? 'إدارة العملات' : 'Currency Management', icon: <DollarSign />, group: 'currencies' }
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
      modules.push({ 
        id: 'system-reports', 
        name: language === 'ar' ? 'التقارير الشاملة' : 'System Reports', 
        icon: <BarChart /> 
      });
    }

    // Analytics module - للإدارة العليا والأدوار المالية العليا فقط
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role)) {
      modules.push({ 
        id: 'analytics', 
        name: language === 'ar' ? 'التحليلات' : 'Analytics', 
        icon: <BarChart /> 
      });
      modules.push({ 
        id: 'admin-dashboard', 
        name: language === 'ar' ? 'لوحة التحكم الإدارية' : 'Admin Dashboard', 
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
      modules.push({ 
        id: 'notification-settings', 
        name: language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings', 
        icon: <Settings /> 
      });
      modules.push({ 
        id: 'permissions-settings', 
        name: language === 'ar' ? 'إعدادات الصلاحيات' : 'Permissions Settings', 
        icon: <Shield /> 
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

    // Report Management module - للإدارة العليا والأدوار المالية
    if (topManagementRoles.includes(role) || financialManagerRoles.includes(role)) {
      modules.push({ 
        id: 'report-management', 
        name: language === 'ar' ? 'إدارة التقارير' : 'Report Management', 
        icon: <FileText /> 
      });
    }

    // User Guide - متاح للجميع
    modules.push({ 
      id: 'user-guide', 
      name: language === 'ar' ? 'الدليل الشامل' : 'User Guide', 
      icon: <Book /> 
    });

    return modules;
  };

  // Navigate handler for dashboard
  const handleDashboardNavigate = (module, subModule = null) => {
    setActiveModule(module);
    if (module === 'hr' && subModule) {
      setActiveHRSubModule(subModule);
    } else if (module === 'financial' && subModule) {
      setActiveFinancialSubModule(subModule);
    } else if (module === 'invoices' && subModule) {
      setActiveInvoiceSubModule(subModule);
    }
  };

  const renderContent = () => {
    // Dashboard Overview - New Modern Design
    if (activeModule === 'dashboard') {
      return (
        <DashboardContent
          language={language}
          stats={stats}
          employees={employees}
          onNavigate={handleDashboardNavigate}
        />
      );
    }

    // HR Sub-modules
    if (activeModule === 'hr') {
      // HR Overview
      if (activeHRSubModule === 'hr-overview' || !activeHRSubModule) {
        return (
          <HROverviewContent
            language={language}
            stats={stats}
            employees={employees}
            onAddEmployee={() => {
              setActiveModule('hr');
              setActiveHRSubModule('salaries');
            }}
            onViewProfile={(employeeId) => {
              setSelectedEmployeeId(employeeId);
              setActiveHRSubModule('employee-profile');
            }}
            onEditEmployee={(employeeId) => {
              setSelectedEmployeeId(employeeId);
              setActiveHRSubModule('employee-profile');
            }}
          />
        );
      }
      
      // HR Sub-module components
      switch (activeHRSubModule) {
        case 'payroll':
          return <PayrollPage language={language} />;
        case 'shifts':
          return <ShiftsManagementPage language={language} />;
        case 'attendance':
          return <AttendancePage language={language} />;
        case 'hr-settings':
          return <HRSettingsPage language={language} />;
        case 'employee-profile':
          return selectedEmployeeId ? (
            <EmployeeProfilePage 
              employeeId={selectedEmployeeId} 
              onBack={() => { setSelectedEmployeeId(null); setActiveHRSubModule('hr-overview'); }}
              language={language}
            />
          ) : null;
        case 'salaries':
          return <SalariesPage language={language} />;
        case 'allowances':
          return <AllowancesPage language={language} />;
        case 'deductions':
          return <DeductionsPage language={language} />;
        case 'casual-leave':
          return <CasualLeavePage language={language} />;
        case 'annual-leave':
          return <AnnualLeavePage language={language} />;
        case 'hr-reports':
          return <HRReportsPage language={language} />;
        case 'hr-comprehensive-reports':
          return <HRComprehensiveReportsPage language={language} />;
        case 'termination':
          return <TerminationPage language={language} employees={employees} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }

    // Financial Sub-modules
    if (activeModule === 'financial') {
      // Financial Overview  
      if (activeFinancialSubModule === 'financial-overview' || !activeFinancialSubModule) {
        return (
          <FinancialOverviewContent
            language={language}
            stats={stats}
            t={t}
            onNavigate={(subModule) => setActiveFinancialSubModule(subModule)}
          />
        );
      }
      
      // Financial Sub-module components
      switch (activeFinancialSubModule) {
        case 'journal-entries':
          return <JournalEntriesPage language={language} />;
        case 'general-ledger':
          return <GeneralLedgerPage language={language} />;
        case 'trial-balance':
          return <TrialBalancePage language={language} />;
        case 'income-statement':
          return <IncomeStatementPage language={language} />;
        case 'balance-sheet':
          return <BalanceSheetPage language={language} />;
        case 'financial-reports':
          return <FinancialReportsPage language={language} />;
        case 'treasury':
          return <TreasuryModule language={language} userRole={user?.role} />;
        case 'custody':
          return <CustodyModule language={language} userRole={user?.role} />;
        case 'accounts':
          return <AccountsModule language={language} userRole={user?.role} />;
        case 'bank':
          return <BankManagementPage language={language} />;
        case 'bank-settings':
          return <BankSettingsPage language={language} />;
        case 'customers':
          return <CustomersModule language={language} userRole={user?.role} />;
        case 'suppliers':
          return <SuppliersModule language={language} userRole={user?.role} />;
        case 'products':
          return <ProductsPage language={language} />;
        case 'currencies':
          return <CurrenciesPage language={language} />;
        case 'purchases':
        case 'purchase-invoices':
          return <PurchasesModule language={language} userRole={user?.role} />;
        case 'inventory':
          return <InventoryPage />;
        case 'projects':
        case 'tasks':
          return <ProjectsPage language={language} />;
        case 'admin-dashboard':
          return <AdminDashboardPage language={language} />;
        case 'notification-settings':
          return <NotificationSettingsPage language={language} />;
        case 'permissions-settings':
          return <PermissionsSettingsPage language={language} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }

    // Reports Module
    if (activeModule === 'reports') {
      return (
        <div className="space-y-6">
          {/* Modern Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900 p-6 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <BarChart className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'التقارير' : 'Reports'}</h1>
                <p className="text-slate-300 text-sm">{language === 'ar' ? 'التقارير والتحليلات الشاملة لجميع أقسام النظام' : 'Comprehensive reports and analytics for all system modules'}</p>
              </div>
            </div>
          </div>

          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* HR Reports */}
            <Card 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30"
              onClick={() => {
                setActiveModule('hr');
                setActiveHRSubModule('hr-reports');
              }}
            >
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-xl bg-cyan-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  {language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'تقارير الموظفين، الحضور، الرواتب والأداء' : 'Employee, attendance, payroll and performance reports'}
                </p>
              </CardContent>
            </Card>

            {/* Financial Reports */}
            <Card 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30"
              onClick={() => {
                setActiveModule('financial');
                setActiveFinancialSubModule('financial-reports');
              }}
            >
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calculator className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  {language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'الميزانية، قائمة الدخل، التدفقات النقدية' : 'Balance sheet, income statement, cash flows'}
                </p>
              </CardContent>
            </Card>

            {/* System Reports */}
            <Card 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"
              onClick={() => setActiveModule('system-reports')}
            >
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-xl bg-violet-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BarChart className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                  {language === 'ar' ? 'تقارير النظام' : 'System Reports'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'المشاريع، المشتريات، المخزون، والموافقات' : 'Projects, purchases, inventory, and approvals'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // Analytics Module
    if (activeModule === 'analytics') {
      return <AnalyticsModule language={language} userRole={user?.role} />;
    }

    // System Reports Module
    if (activeModule === 'system-reports') {
      return <SystemReportsPage language={language} />;
    }

    // Report Management Module (Admin PDF Reports)
    if (activeModule === 'report-management') {
      return <ReportManagementPage />;
    }

    // Invoices Module
    if (activeModule === 'invoices') {
      // Invoice Overview
      if (activeInvoiceSubModule === 'overview' || !activeInvoiceSubModule) {
        return (
          <InvoicesOverviewContent
            language={language}
            stats={stats}
            onNavigate={(subModule) => setActiveInvoiceSubModule(subModule)}
            onCreateInvoice={() => setActiveInvoiceSubModule('invoices')}
            onGoToETASettings={() => setActiveInvoiceSubModule('eta-settings')}
          />
        );
      }
      
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

    // Admin Dashboard Module
    if (activeModule === 'admin-dashboard') {
      return <AdminDashboardPage language={language} />;
    }

    // Notification Settings Module
    if (activeModule === 'notification-settings') {
      return <NotificationSettingsPage language={language} />;
    }

    // Permissions Settings Module
    if (activeModule === 'permissions-settings') {
      return <PermissionsSettingsPage language={language} />;
    }

    // User Guide Module
    if (activeModule === 'user-guide') {
      return <UserGuidePage language={language} />;
    }

    // Coupon Management - redirect to dedicated page
    if (activeModule === 'coupons') {
      navigate('/admin/coupons');
      return null;
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
