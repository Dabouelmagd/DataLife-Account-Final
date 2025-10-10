import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Users, Calculator, PieChart, FileText, Building2, BarChart3, 
  TrendingUp, DollarSign, Calendar, Clock, AlertCircle, CheckCircle,
  ArrowUp, ArrowDown, Eye, PlayCircle, X, Home, Settings, Bell,
  Search, Filter, Download, Plus, Edit, Trash2, MapPin, Phone, Mail, Award, ArrowRight, TrendingDown, Printer, ChevronDown, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import { demoData } from '../data/demoData';
import { 
  JournalEntriesModule, 
  TreasuryModule, 
  CustodyModule, 
  AccountsModule, 
  SuppliersModule, 
  CustomersModule 
} from './FinancialSubModules';
import { 
  SalariesModule, 
  AllowancesModule, 
  DeductionsModule, 
  CasualLeaveModule, 
  AnnualLeaveModule, 
  AttendanceModule 
} from './HRSubModules';

const DemoPage = ({ onClose }) => {
  const { language, isRTL } = useLanguage();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isGuidedTour, setIsGuidedTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isAddEmployeeModal, setIsAddEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [newDepartment, setNewDepartment] = useState({ name: '', description: '', manager: '' });
  const [departments, setDepartments] = useState([
    { id: 'IT', name: 'IT', nameAr: 'تكنولوجيا المعلومات' },
    { id: 'HR', name: 'HR', nameAr: 'الموارد البشرية' },
    { id: 'Finance', name: 'Finance', nameAr: 'المالية' },
    { id: 'Operations', name: 'Operations', nameAr: 'العمليات' },
    { id: 'Sales', name: 'Sales', nameAr: 'المبيعات' }
  ]);
  const [customAllowanceTypes, setCustomAllowanceTypes] = useState([]);
  const [customDeductionTypes, setCustomDeductionTypes] = useState([]);
  const [showAddAllowanceType, setShowAddAllowanceType] = useState(false);
  const [showAddDeductionType, setShowAddDeductionType] = useState(false);
  const [newAllowanceType, setNewAllowanceType] = useState({ nameAr: '', nameEn: '' });
  const [newDeductionType, setNewDeductionType] = useState({ nameAr: '', nameEn: '' });
  const [isEditEmployeeModal, setIsEditEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [reportType, setReportType] = useState('attendance');
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState('2024-10');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [isAddTransactionModal, setIsAddTransactionModal] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    description: '',
    category: '',
    amount: '',
    type: 'expense',
    date: new Date().toISOString().split('T')[0]
  });
  const [financialReportTab, setFinancialReportTab] = useState('overview');
  const [financialPeriod, setFinancialPeriod] = useState('monthly');
  const [expandedModule, setExpandedModule] = useState(null);
  const [activeFinancialSubModule, setActiveFinancialSubModule] = useState(null);
  const [activeHRSubModule, setActiveHRSubModule] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    // Basic Info
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
    birthDate: '',
    gender: '',
    maritalStatus: '',
    address: '',
    
    // Job Details
    position: '',
    department: '',
    directManager: '',
    startDate: '',
    employmentType: '',
    workLocation: '',
    
    // Financial
    baseSalary: '',
    allowances: [],
    deductions: [],
    payrollMethod: '',
    bankAccount: '',
    
    // Documents & Files
    profileImage: null,
    cv: null,
    contracts: [],
    certificates: [],
    
    // Transfers History
    transfers: []
  });
  
  const t = (key) => getTranslation(language, key);

  // وظائف التصدير والطباعة
  const exportToCSV = (data, filename) => {
    const csvContent = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    ).join('\n');
    
    const headers = Object.keys(data[0]).join(',');
    const fullContent = headers + '\n' + csvContent;
    
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = (contentId, filename) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const content = document.getElementById(contentId);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
            .no-print { display: none !important; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DataLife Account - ${filename}</h1>
            <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          ${content.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const printReport = (contentId, title) => {
    const originalContents = document.body.innerHTML;
    const printContents = document.getElementById(contentId).innerHTML;
    
    document.body.innerHTML = `
      <div style="font-family: Arial, sans-serif; margin: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1>DataLife Account</h1>
          <h2>${title}</h2>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        ${printContents}
      </div>
    `;
    
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const exportReportData = (reportType) => {
    let data = [];
    let filename = '';

    switch (reportType) {
      case 'attendance':
        data = attendanceData.map(emp => ({
          'اسم الموظف': emp.name,
          'كود الموظف': emp.employeeId,
          'أيام العمل': emp.totalDays,
          'أيام الحضور': emp.presentDays,
          'أيام الغياب': emp.absentDays,
          'أيام التأخير': emp.lateDays,
          'ساعات العمل': emp.regularHours,
          'ساعات إضافية': emp.overtimeHours
        }));
        filename = `تقرير_الحضور_${new Date().toISOString().split('T')[0]}`;
        break;
      case 'payroll':
        data = attendanceData.map(emp => ({
          'اسم الموظف': emp.name,
          'الراتب الأساسي': emp.salary,
          'البدلات': emp.allowances,
          'الخصومات': emp.deductions,
          'صافي الراتب': emp.netSalary
        }));
        filename = `تقرير_المرتبات_${new Date().toISOString().split('T')[0]}`;
        break;
      case 'financial':
        data = [{
          'الإيرادات الشهرية': 285000,
          'المصروفات الشهرية': 180000,
          'صافي الربح': 105000,
          'هامش الربح': '36.8%',
          'نمو الإيرادات': '15.2%'
        }];
        filename = `التقرير_المالي_${new Date().toISOString().split('T')[0]}`;
        break;
    }

    exportToCSV(data, filename);
  };

  // Translated demo data
  const translatedRecentActivity = [
    {
      title: language === 'ar' ? 'تم إضافة الموظف أحمد حسن إلى نظام الموارد البشرية' : 'New employee Ahmed Hassan added to HR system',
      time: language === 'ar' ? 'منذ دقيقتين' : '2 minutes ago',
      type: 'success',
      module: language === 'ar' ? 'الموارد البشرية' : 'HR'
    },
    {
      title: language === 'ar' ? 'تمت معالجة كشوف المرتبات الشهرية بنجاح' : 'Monthly payroll processed successfully',
      time: language === 'ar' ? 'منذ ساعة واحدة' : '1 hour ago',
      type: 'success',
      module: language === 'ar' ? 'الموارد البشرية' : 'HR'
    },
    {
      title: language === 'ar' ? 'تنبيه المخزون: مستلزمات المكتب منخفضة' : 'Inventory alert: Office supplies running low',
      time: language === 'ar' ? 'منذ 3 ساعات' : '3 hours ago',
      type: 'warning',
      module: language === 'ar' ? 'المخزون' : 'Inventory'
    },
    {
      title: language === 'ar' ? 'تم إنشاء التقرير المالي' : 'Financial report generated',
      time: language === 'ar' ? 'منذ 5 ساعات' : '5 hours ago',
      type: 'info',
      module: language === 'ar' ? 'التقارير' : 'Reports'
    },
    {
      title: language === 'ar' ? 'تم إضافة عقد مورد جديد' : 'New supplier contract added',
      time: language === 'ar' ? 'منذ يوم واحد' : '1 day ago',
      type: 'success',
      module: language === 'ar' ? 'المالية' : 'Financial'
    }
  ];

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

  const modules = [
    { id: 'dashboard', name: t('demo.modules.dashboard'), icon: <Home className="h-5 w-5" /> },
    { 
      id: 'hr', 
      name: t('demo.modules.hr'), 
      icon: <Users className="h-5 w-5" />,
      hasSubModules: true
    },
    { 
      id: 'financial', 
      name: t('demo.modules.financial'), 
      icon: <Calculator className="h-5 w-5" />,
      hasSubModules: true
    },
    { id: 'inventory', name: t('demo.modules.inventory'), icon: <PieChart className="h-5 w-5" /> },
    { id: 'reports', name: t('demo.modules.reports'), icon: <FileText className="h-5 w-5" /> },
    { id: 'analytics', name: t('demo.modules.analytics'), icon: <BarChart3 className="h-5 w-5" /> }
  ];

  const hrSubModules = [
    { 
      id: 'hr-overview', 
      name: language === 'ar' ? 'نظرة عامة' : 'Overview',
      icon: <BarChart3 className="h-4 w-4" />
    },
    { 
      id: 'salaries', 
      name: language === 'ar' ? 'المرتبات' : 'Salaries',
      icon: <DollarSign className="h-4 w-4" />
    },
    { 
      id: 'allowances', 
      name: language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime',
      icon: <Award className="h-4 w-4" />
    },
    { 
      id: 'deductions', 
      name: language === 'ar' ? 'الخصومات' : 'Deductions',
      icon: <TrendingDown className="h-4 w-4" />
    },
    { 
      id: 'casual-leave', 
      name: language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave',
      icon: <Calendar className="h-4 w-4" />
    },
    { 
      id: 'annual-leave', 
      name: language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave',
      icon: <Calendar className="h-4 w-4" />
    },
    { 
      id: 'attendance', 
      name: language === 'ar' ? 'الحضور والانصراف' : 'Attendance',
      icon: <Clock className="h-4 w-4" />
    },
    { 
      id: 'hr-reports', 
      name: language === 'ar' ? 'التقارير' : 'Reports',
      icon: <FileText className="h-4 w-4" />
    }
  ];

  const financialSubModules = [
    { 
      id: 'overview', 
      name: language === 'ar' ? 'نظرة عامة' : 'Overview',
      icon: <BarChart3 className="h-4 w-4" />
    },
    { 
      id: 'journal-entries', 
      name: language === 'ar' ? 'القيود اليومية' : 'Journal Entries',
      icon: <FileText className="h-4 w-4" />
    },
    { 
      id: 'treasury', 
      name: language === 'ar' ? 'الخزنة' : 'Treasury',
      icon: <DollarSign className="h-4 w-4" />
    },
    { 
      id: 'custody', 
      name: language === 'ar' ? 'العهدة' : 'Custody',
      icon: <Award className="h-4 w-4" />
    },
    { 
      id: 'accounts', 
      name: language === 'ar' ? 'الحسابات' : 'Accounts',
      icon: <Building2 className="h-4 w-4" />
    },
    { 
      id: 'suppliers', 
      name: language === 'ar' ? 'الموردين' : 'Suppliers',
      icon: <Users className="h-4 w-4" />
    },
    { 
      id: 'customers', 
      name: language === 'ar' ? 'العملاء' : 'Customers',
      icon: <Users className="h-4 w-4" />
    }
  ];

  const kpiCards = [
    {
      title: t('demo.kpi.totalEmployees'),
      value: demoData.summary.totalEmployees,
      change: '+12%',
      trend: 'up',
      icon: <Users className="h-6 w-6" />,
      color: 'text-blue-600'
    },
    {
      title: t('demo.kpi.monthlyRevenue'),
      value: `${demoData.summary.monthlyRevenue.toLocaleString()} ${t('demo.currency')}`,
      change: '+23%',
      trend: 'up',
      icon: <DollarSign className="h-6 w-6" />,
      color: 'text-green-600'
    },
    {
      title: t('demo.kpi.activeProjects'),
      value: demoData.summary.activeProjects,
      change: '+8%',
      trend: 'up',
      icon: <Building2 className="h-6 w-6" />,
      color: 'text-purple-600'
    },
    {
      title: t('demo.kpi.efficiency'),
      value: `${demoData.summary.efficiency}%`,
      change: '+15%',
      trend: 'up',
      icon: <TrendingUp className="h-6 w-6" />,
      color: 'text-orange-600'
    }
  ];

  const renderDashboard = () => (
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
                setTimeout(() => setIsAddEmployeeModal(true), 500);
              }}
            >
              <Users className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.addEmployee')}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => {
                setActiveModule('financial');
                setTimeout(() => alert(language === 'ar' ? 'فتح نموذج معاملة جديدة (عرض توضيحي)' : 'Opening new transaction form (Demo)'), 500);
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
                setTimeout(() => alert(language === 'ar' ? 'إنشاء تقرير جديد (عرض توضيحي)' : 'Generating new report (Demo)'), 500);
              }}
            >
              <FileText className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.generateReport')}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => {
                setActiveModule('inventory');
                setTimeout(() => alert(language === 'ar' ? 'فحص حالة المخزون (عرض توضيحي)' : 'Checking inventory status (Demo)'), 500);
              }}
            >
              <PieChart className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.checkInventory')}</span>
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

  const renderHRModule = () => (
    <div className="space-y-6">
      {/* HR Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('demo.hr.totalEmployees')}</p>
                <p className="text-3xl font-bold">{demoData.hr.totalEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('demo.hr.presentToday')}</p>
                <p className="text-3xl font-bold">{demoData.hr.presentToday}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('demo.hr.onLeave')}</p>
                <p className="text-3xl font-bold">{demoData.hr.onLeave}</p>
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
              onClick={() => setIsAddEmployeeModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('demo.hr.addEmployee')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
              {demoData.hr.employees.map((employee, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={employee.avatar} />
                        <AvatarFallback>{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-sm text-gray-500">{employee.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'Present' ? 'success' : employee.status === 'Absent' ? 'destructive' : 'warning'}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowEmployeeDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setEditingEmployee(employee);
                          setIsEditEmployeeModal(true);
                          // Initialize edit form with employee data
                          setEmployeeForm({
                            fullName: employee.name,
                            email: employee.email,
                            phone: employee.phone || '',
                            nationalId: '',
                            birthDate: '',
                            gender: '',
                            maritalStatus: '',
                            address: '',
                            position: employee.position,
                            department: employee.department,
                            directManager: '',
                            startDate: employee.joinDate || '',
                            employmentType: '',
                            workLocation: '',
                            baseSalary: employee.salary?.toString() || '',
                            allowances: [],
                            deductions: [],
                            payrollMethod: '',
                            bankAccount: '',
                            profileImage: null,
                            cv: null,
                            contracts: [],
                            certificates: [],
                            transfers: []
                          });
                        }}
                      >
                        <Edit className="h-4 w-4" />
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
  );

  const renderFinancialModule = () => {
    // بيانات مالية شاملة
    const financialData = {
      executiveSummary: {
        currentMonth: {
          revenue: 285000,
          expenses: 180000,
          netProfit: 105000,
          profitMargin: 36.8,
          revenueGrowth: 15.2,
          expenseGrowth: 8.5
        },
        previousMonth: {
          revenue: 248000,
          expenses: 166000,
          netProfit: 82000
        },
        yearToDate: {
          revenue: 2650000,
          expenses: 1950000,
          netProfit: 700000
        }
      },
      
      profitLoss: {
        revenue: {
          sales: 285000,
          services: 45000,
          other: 15000,
          total: 345000
        },
        cogs: 120000,
        grossProfit: 225000,
        operatingExpenses: {
          salaries: 85000,
          rent: 25000,
          marketing: 15000,
          utilities: 8000,
          maintenance: 7000,
          other: 20000,
          total: 160000
        },
        operatingProfit: 65000,
        nonOperating: {
          income: 5000,
          expenses: 3000,
          net: 2000
        },
        profitBeforeTax: 67000,
        tax: 10000,
        netProfit: 57000
      },

      cashFlow: {
        operating: {
          netIncome: 57000,
          depreciation: 8000,
          accountsReceivable: -15000,
          inventory: -8000,
          accountsPayable: 12000,
          total: 54000
        },
        investing: {
          equipment: -25000,
          investments: -10000,
          total: -35000
        },
        financing: {
          loans: 20000,
          dividends: -15000,
          total: 5000
        },
        netCashFlow: 24000,
        beginningCash: 120000,
        endingCash: 144000
      },

      balanceSheet: {
        assets: {
          current: {
            cash: 144000,
            accountsReceivable: 85000,
            inventory: 65000,
            prepaid: 15000,
            total: 309000
          },
          fixed: {
            equipment: 180000,
            buildings: 350000,
            depreciation: -45000,
            total: 485000
          },
          totalAssets: 794000
        },
        liabilities: {
          current: {
            accountsPayable: 45000,
            shortTermLoans: 25000,
            accrued: 18000,
            total: 88000
          },
          longTerm: {
            loans: 150000,
            total: 150000
          },
          totalLiabilities: 238000
        },
        equity: {
          capital: 400000,
          retainedEarnings: 156000,
          totalEquity: 556000
        }
      },

      kpis: {
        profitability: {
          grossMargin: 65.2,
          operatingMargin: 18.8,
          netMargin: 16.5,
          roe: 10.3,
          roa: 7.2
        },
        liquidity: {
          currentRatio: 3.51,
          quickRatio: 2.77,
          cashRatio: 1.64
        },
        efficiency: {
          assetTurnover: 0.43,
          receivablesTurnover: 4.1,
          inventoryTurnover: 5.3,
          payablesTurnover: 3.6
        }
      }
    };

    return (
      <div className="space-y-6">
        {/* التحكم في التقارير المالية */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                {language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}
              </CardTitle>
              <div className="flex gap-2">
                <select 
                  className="border rounded px-3 py-2 text-sm"
                  value={financialPeriod}
                  onChange={(e) => setFinancialPeriod(e.target.value)}
                >
                  <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                  <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
                </select>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const reportTitle = financialReportTab === 'overview' ? 'الملخص التنفيذي' :
                                        financialReportTab === 'profitLoss' ? 'بيان الربح والخسارة' :
                                        financialReportTab === 'cashFlow' ? 'بيان التدفق النقدي' :
                                        financialReportTab === 'balance' ? 'الميزانية العمومية' :
                                        financialReportTab === 'kpis' ? 'مؤشرات الأداء' : 'التحليل التفصيلي';
                      printReport('financial-content', `التقرير المالي - ${reportTitle}`);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'طباعة' : 'Print'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => exportReportData('financial')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تصدير' : 'Export'}
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-[#28376B]"
                    onClick={() => setIsAddTransactionModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('demo.financial.newTransaction')}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* تبويبات التقارير */}
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: language === 'ar' ? 'الملخص التنفيذي' : 'Executive Summary' },
              { id: 'profitLoss', label: language === 'ar' ? 'الربح والخسارة' : 'Profit & Loss' },
              { id: 'cashFlow', label: language === 'ar' ? 'التدفق النقدي' : 'Cash Flow' },
              { id: 'balance', label: language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet' },
              { id: 'kpis', label: language === 'ar' ? 'مؤشرات الأداء' : 'KPIs' },
              { id: 'analysis', label: language === 'ar' ? 'التحليل التفصيلي' : 'Detailed Analysis' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFinancialReportTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  financialReportTab === tab.id 
                    ? 'border-[#28376B] text-[#28376B]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div id="financial-content">
        {/* الملخص التنفيذي */}
        {financialReportTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">{language === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</p>
                      <p className="text-2xl font-bold text-green-800">{financialData.executiveSummary.currentMonth.revenue.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-green-600">+{financialData.executiveSummary.currentMonth.revenueGrowth}%</p>
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
                      <p className="text-2xl font-bold text-red-800">{financialData.executiveSummary.currentMonth.expenses.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-red-600">+{financialData.executiveSummary.currentMonth.expenseGrowth}%</p>
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
                      <p className="text-2xl font-bold text-blue-800">{financialData.executiveSummary.currentMonth.netProfit.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-blue-600">{financialData.executiveSummary.currentMonth.profitMargin}% {language === 'ar' ? 'هامش' : 'margin'}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">{language === 'ar' ? 'الإيرادات السنوية' : 'YTD Revenue'}</p>
                      <p className="text-2xl font-bold text-purple-800">{financialData.executiveSummary.yearToDate.revenue.toLocaleString()} {t('demo.currency')}</p>
                      <p className="text-sm text-purple-600">{language === 'ar' ? 'حتى تاريخه' : 'Year to Date'}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* مقارنة الأداء */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مقارنة الأداء الشهري' : 'Monthly Performance Comparison'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'الشهر الحالي' : 'Current Month'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium">{financialData.executiveSummary.currentMonth.revenue.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-red-600">{financialData.executiveSummary.currentMonth.expenses.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">{financialData.executiveSummary.currentMonth.netProfit.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'الشهر السابق' : 'Previous Month'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium">{financialData.executiveSummary.previousMonth.revenue.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-red-600">{financialData.executiveSummary.previousMonth.expenses.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">{financialData.executiveSummary.previousMonth.netProfit.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'التغيير' : 'Change'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium text-green-600">+{financialData.executiveSummary.currentMonth.revenueGrowth}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-orange-600">+{financialData.executiveSummary.currentMonth.expenseGrowth}%</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">+28.0%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* بيان الربح والخسارة */}
        {financialReportTab === 'profitLoss' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'بيان الربح والخسارة' : 'Profit & Loss Statement'} - {financialPeriod === 'monthly' ? (language === 'ar' ? 'شهري' : 'Monthly') : (language === 'ar' ? 'سنوي' : 'Annual')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* الإيرادات */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-3">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-medium">{financialData.profitLoss.revenue.sales.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الخدمات:' : 'Services:'}</span>
                      <span className="font-medium">{financialData.profitLoss.revenue.services.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'أخرى:' : 'Other:'}</span>
                      <span className="font-medium">{financialData.profitLoss.revenue.other.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-700 border-t pt-2">
                      <span>{language === 'ar' ? 'إجمالي الإيرادات:' : 'Total Revenue:'}</span>
                      <span>{financialData.profitLoss.revenue.total.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* تكلفة البضاعة المباعة */}
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-semibold">{language === 'ar' ? 'تكلفة البضاعة المباعة:' : 'Cost of Goods Sold:'}</span>
                    <span className="font-semibold text-orange-600">({financialData.profitLoss.cogs.toLocaleString()}) {t('demo.currency')}</span>
                  </div>
                </div>

                {/* إجمالي الربح */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-semibold text-blue-800">{language === 'ar' ? 'إجمالي الربح:' : 'Gross Profit:'}</span>
                    <span className="font-semibold text-blue-800">{financialData.profitLoss.grossProfit.toLocaleString()} {t('demo.currency')}</span>
                  </div>
                </div>

                {/* المصروفات التشغيلية */}
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-3">{language === 'ar' ? 'المصروفات التشغيلية' : 'Operating Expenses'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الرواتب:' : 'Salaries:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.salaries.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الإيجار:' : 'Rent:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.rent.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'التسويق:' : 'Marketing:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.marketing.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'المرافق:' : 'Utilities:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.utilities.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الصيانة:' : 'Maintenance:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.maintenance.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-red-700 border-t pt-2">
                      <span>{language === 'ar' ? 'إجمالي المصروفات:' : 'Total Expenses:'}</span>
                      <span>({financialData.profitLoss.operatingExpenses.total.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* النتيجة النهائية */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">{language === 'ar' ? 'الربح التشغيلي:' : 'Operating Profit:'}</span>
                      <span className="font-semibold">{financialData.profitLoss.operatingProfit.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'إيرادات/مصروفات غير تشغيلية:' : 'Non-Operating (Net):'}</span>
                      <span className="text-green-600">+{financialData.profitLoss.nonOperating.net.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">{language === 'ar' ? 'الربح قبل الضرائب:' : 'Profit Before Tax:'}</span>
                      <span className="font-semibold">{financialData.profitLoss.profitBeforeTax.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الضرائب:' : 'Tax:'}</span>
                      <span className="text-red-600">({financialData.profitLoss.tax.toLocaleString()}) {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span className="text-green-800">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                      <span className="text-green-800">{financialData.profitLoss.netProfit.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* بيان التدفق النقدي */}
        {financialReportTab === 'cashFlow' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'بيان التدفق النقدي' : 'Cash Flow Statement'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* التدفقات التشغيلية */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3">{language === 'ar' ? 'التدفقات من الأنشطة التشغيلية' : 'Cash Flows from Operating Activities'}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'صافي الدخل:' : 'Net Income:'}</span>
                      <span className="font-medium">{financialData.cashFlow.operating.netIncome.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الاستهلاك:' : 'Depreciation:'}</span>
                      <span className="font-medium">+{financialData.cashFlow.operating.depreciation.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'حسابات مدينة:' : 'Accounts Receivable:'}</span>
                      <span className="font-medium text-red-600">{financialData.cashFlow.operating.accountsReceivable.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'المخزون:' : 'Inventory:'}</span>
                      <span className="font-medium text-red-600">{financialData.cashFlow.operating.inventory.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'حسابات دائنة:' : 'Accounts Payable:'}</span>
                      <span className="font-medium text-green-600">+{financialData.cashFlow.operating.accountsPayable.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span className="text-blue-700">{language === 'ar' ? 'صافي التدفق التشغيلي:' : 'Net Operating Cash Flow:'}</span>
                      <span className="text-blue-700">{financialData.cashFlow.operating.total.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* التدفقات الاستثمارية */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 mb-3">{language === 'ar' ? 'التدفقات من الأنشطة الاستثمارية' : 'Cash Flows from Investing Activities'}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'شراء معدات:' : 'Equipment Purchase:'}</span>
                      <span className="font-medium text-red-600">{financialData.cashFlow.investing.equipment.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'استثمارات:' : 'Investments:'}</span>
                      <span className="font-medium text-red-600">{financialData.cashFlow.investing.investments.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span className="text-yellow-700">{language === 'ar' ? 'صافي التدفق الاستثماري:' : 'Net Investing Cash Flow:'}</span>
                      <span className="text-red-600">{financialData.cashFlow.investing.total.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* التدفقات التمويلية */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-3">{language === 'ar' ? 'التدفقات من الأنشطة التمويلية' : 'Cash Flows from Financing Activities'}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'قروض جديدة:' : 'New Loans:'}</span>
                      <span className="font-medium text-green-600">+{financialData.cashFlow.financing.loans.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'أرباح موزعة:' : 'Dividends Paid:'}</span>
                      <span className="font-medium text-red-600">{financialData.cashFlow.financing.dividends.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span className="text-green-700">{language === 'ar' ? 'صافي التدفق التمويلي:' : 'Net Financing Cash Flow:'}</span>
                      <span className="text-green-700">{financialData.cashFlow.financing.total.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* الملخص النهائي */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span>{language === 'ar' ? 'صافي التغير في النقدية:' : 'Net Change in Cash:'}</span>
                      <span className="text-blue-600">{financialData.cashFlow.netCashFlow.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'النقدية في بداية الفترة:' : 'Beginning Cash Balance:'}</span>
                      <span className="font-medium">{financialData.cashFlow.beginningCash.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span className="text-green-800">{language === 'ar' ? 'النقدية في نهاية الفترة:' : 'Ending Cash Balance:'}</span>
                      <span className="text-green-800">{financialData.cashFlow.endingCash.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* الميزانية العمومية */}
        {financialReportTab === 'balance' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* الأصول */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-800">{language === 'ar' ? 'الأصول' : 'Assets'}</h3>
                  
                  {/* الأصول المتداولة */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-700 mb-3">{language === 'ar' ? 'الأصول المتداولة' : 'Current Assets'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'النقد وما في حكمه:' : 'Cash & Cash Equivalents:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.current.cash.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'حسابات مدينة:' : 'Accounts Receivable:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.current.accountsReceivable.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المخزون:' : 'Inventory:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.current.inventory.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'مصروفات مدفوعة مقدماً:' : 'Prepaid Expenses:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.current.prepaid.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-blue-700">{language === 'ar' ? 'إجمالي الأصول المتداولة:' : 'Total Current Assets:'}</span>
                        <span className="text-blue-700">{financialData.balanceSheet.assets.current.total.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  {/* الأصول الثابتة */}
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-700 mb-3">{language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'معدات:' : 'Equipment:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.fixed.equipment.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'مباني:' : 'Buildings:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.fixed.buildings.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'استهلاك متراكم:' : 'Accumulated Depreciation:'}</span>
                        <span className="font-medium text-red-600">({Math.abs(financialData.balanceSheet.assets.fixed.depreciation).toLocaleString()}) {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-blue-700">{language === 'ar' ? 'صافي الأصول الثابتة:' : 'Net Fixed Assets:'}</span>
                        <span className="text-blue-700">{financialData.balanceSheet.assets.fixed.total.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-200 p-4 rounded-lg">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-blue-800">{language === 'ar' ? 'إجمالي الأصول:' : 'Total Assets:'}</span>
                      <span className="text-blue-800">{financialData.balanceSheet.assets.totalAssets.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>
                </div>

                {/* الخصوم وحقوق الملكية */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-800">{language === 'ar' ? 'الخصوم وحقوق الملكية' : 'Liabilities & Equity'}</h3>
                  
                  {/* الخصوم المتداولة */}
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-700 mb-3">{language === 'ar' ? 'الخصوم المتداولة' : 'Current Liabilities'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'حسابات دائنة:' : 'Accounts Payable:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.liabilities.current.accountsPayable.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'قروض قصيرة الأجل:' : 'Short-term Loans:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.liabilities.current.shortTermLoans.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'مستحقات:' : 'Accrued Liabilities:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.liabilities.current.accrued.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-red-700">{language === 'ar' ? 'إجمالي الخصوم المتداولة:' : 'Total Current Liabilities:'}</span>
                        <span className="text-red-700">{financialData.balanceSheet.liabilities.current.total.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  {/* الخصوم طويلة الأجل */}
                  <div className="bg-red-100 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-700 mb-3">{language === 'ar' ? 'الخصوم طويلة الأجل' : 'Long-term Liabilities'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'قروض طويلة الأجل:' : 'Long-term Loans:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.liabilities.longTerm.loans.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-red-700">{language === 'ar' ? 'إجمالي الخصوم طويلة الأجل:' : 'Total Long-term Liabilities:'}</span>
                        <span className="text-red-700">{financialData.balanceSheet.liabilities.longTerm.total.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  {/* إجمالي الخصوم */}
                  <div className="bg-red-200 p-4 rounded-lg">
                    <div className="flex justify-between font-semibold">
                      <span className="text-red-800">{language === 'ar' ? 'إجمالي الخصوم:' : 'Total Liabilities:'}</span>
                      <span className="text-red-800">{financialData.balanceSheet.liabilities.totalLiabilities.toLocaleString()} {t('demo.currency')}</span>
                    </div>
                  </div>

                  {/* حقوق الملكية */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-3">{language === 'ar' ? 'حقوق الملكية' : 'Shareholders\' Equity'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'رأس المال:' : 'Share Capital:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.equity.capital.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الأرباح المحتجزة:' : 'Retained Earnings:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.equity.retainedEarnings.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-green-700">{language === 'ar' ? 'إجمالي حقوق الملكية:' : 'Total Equity:'}</span>
                        <span className="text-green-700">{financialData.balanceSheet.equity.totalEquity.toLocaleString()} {t('demo.currency')}</span>
                      </div>
                    </div>
                  </div>

                  {/* التحقق من توازن الميزانية */}
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <div className="flex justify-between font-bold text-lg">
                      <span>{language === 'ar' ? 'إجمالي الخصوم وحقوق الملكية:' : 'Total Liabilities & Equity:'}</span>
                      <span className="text-gray-800">{(financialData.balanceSheet.liabilities.totalLiabilities + financialData.balanceSheet.equity.totalEquity).toLocaleString()} {t('demo.currency')}</span>
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-sm text-green-600 font-medium">✓ {language === 'ar' ? 'الميزانية متوازنة' : 'Balance Sheet Balanced'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* مؤشرات الأداء الرئيسية */}
        {financialReportTab === 'kpis' && (
          <div className="space-y-6">
            {/* مؤشرات الربحية */}
            <Card>
              <CardHeader>
                <CardTitle className="text-green-800">{language === 'ar' ? 'مؤشرات الربحية' : 'Profitability Ratios'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.grossMargin}%</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'هامش الربح الإجمالي' : 'Gross Margin'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.operatingMargin}%</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'هامش الربح التشغيلي' : 'Operating Margin'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.netMargin}%</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'هامش صافي الربح' : 'Net Margin'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.roe}%</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'العائد على الملكية' : 'ROE'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.roa}%</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'العائد على الأصول' : 'ROA'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* مؤشرات السيولة */}
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-800">{language === 'ar' ? 'مؤشرات السيولة' : 'Liquidity Ratios'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{financialData.kpis.liquidity.currentRatio}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'نسبة التداول' : 'Current Ratio'}</div>
                    <div className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'الأصول المتداولة / الخصوم المتداولة' : 'Current Assets / Current Liabilities'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{financialData.kpis.liquidity.quickRatio}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'النسبة السريعة' : 'Quick Ratio'}</div>
                    <div className="text-xs text-gray-500 mt-1">{language === 'ar' ? '(الأصول المتداولة - المخزون) / الخصوم المتداولة' : '(Current Assets - Inventory) / Current Liabilities'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{financialData.kpis.liquidity.cashRatio}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'النسبة النقدية' : 'Cash Ratio'}</div>
                    <div className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'النقد / الخصوم المتداولة' : 'Cash / Current Liabilities'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* مؤشرات الكفاءة */}
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-800">{language === 'ar' ? 'مؤشرات الكفاءة' : 'Efficiency Ratios'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{financialData.kpis.efficiency.assetTurnover}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'دوران الأصول' : 'Asset Turnover'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{financialData.kpis.efficiency.receivablesTurnover}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'دوران المدينين' : 'Receivables Turnover'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{financialData.kpis.efficiency.inventoryTurnover}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'دوران المخزون' : 'Inventory Turnover'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{financialData.kpis.efficiency.payablesTurnover}</div>
                    <div className="text-sm text-gray-600">{language === 'ar' ? 'دوران الدائنين' : 'Payables Turnover'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* مقارنة المعايير الصناعية */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مقارنة مع المعايير الصناعية' : 'Industry Benchmarks Comparison'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{language === 'ar' ? 'هامش صافي الربح' : 'Net Profit Margin'}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الشركة:' : 'Company:'} <strong>{financialData.kpis.profitability.netMargin}%</strong></span>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الصناعة:' : 'Industry:'} <strong>12.3%</strong></span>
                      <span className="text-sm text-green-600 font-semibold">+4.2%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{language === 'ar' ? 'نسبة التداول' : 'Current Ratio'}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الشركة:' : 'Company:'} <strong>{financialData.kpis.liquidity.currentRatio}</strong></span>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الصناعة:' : 'Industry:'} <strong>2.1</strong></span>
                      <span className="text-sm text-green-600 font-semibold">+1.41</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{language === 'ar' ? 'العائد على الأصول' : 'Return on Assets'}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الشركة:' : 'Company:'} <strong>{financialData.kpis.profitability.roa}%</strong></span>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'الصناعة:' : 'Industry:'} <strong>5.8%</strong></span>
                      <span className="text-sm text-green-600 font-semibold">+1.4%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* التحليل التفصيلي */}
        {financialReportTab === 'analysis' && (
          <div className="space-y-6">
            {/* التحليل الإقليمي/المنتج */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'التحليل حسب القسم/المنطقة' : 'Analysis by Department/Region'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">{language === 'ar' ? 'الإيرادات حسب القسم' : 'Revenue by Department'}</h4>
                    <div className="space-y-2">
                      {[
                        { dept: language === 'ar' ? 'المبيعات' : 'Sales', revenue: 180000, percentage: 52 },
                        { dept: language === 'ar' ? 'الخدمات' : 'Services', revenue: 95000, percentage: 28 },
                        { dept: language === 'ar' ? 'التسويق' : 'Marketing', revenue: 45000, percentage: 13 },
                        { dept: language === 'ar' ? 'أخرى' : 'Others', revenue: 25000, percentage: 7 }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{item.dept}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{item.revenue.toLocaleString()} {t('demo.currency')}</span>
                            <span className="text-sm text-gray-600">({item.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">{language === 'ar' ? 'المصروفات حسب الفئة' : 'Expenses by Category'}</h4>
                    <div className="space-y-2">
                      {[
                        { category: language === 'ar' ? 'الرواتب' : 'Salaries', amount: 85000, percentage: 47 },
                        { category: language === 'ar' ? 'التشغيل' : 'Operations', amount: 45000, percentage: 25 },
                        { category: language === 'ar' ? 'الإيجار' : 'Rent', amount: 25000, percentage: 14 },
                        { category: language === 'ar' ? 'أخرى' : 'Others', amount: 25000, percentage: 14 }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                          <span className="font-medium">{item.category}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-red-600">({item.amount.toLocaleString()}) {t('demo.currency')}</span>
                            <span className="text-sm text-gray-600">({item.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* تحليل الاتجاهات */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'تحليل الاتجاهات (آخر 6 أشهر)' : 'Trend Analysis (Last 6 Months)'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">{language === 'ar' ? 'الشهر' : 'Month'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'المصروفات' : 'Expenses'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'النمو %' : 'Growth %'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { month: language === 'ar' ? 'أكتوبر 2024' : 'Oct 2024', revenue: 285000, expenses: 180000, profit: 105000, growth: 15.2 },
                        { month: language === 'ar' ? 'سبتمبر 2024' : 'Sep 2024', revenue: 248000, expenses: 166000, profit: 82000, growth: 8.5 },
                        { month: language === 'ar' ? 'أغسطس 2024' : 'Aug 2024', revenue: 228000, expenses: 158000, profit: 70000, growth: 5.2 },
                        { month: language === 'ar' ? 'يوليو 2024' : 'Jul 2024', revenue: 217000, expenses: 152000, profit: 65000, growth: 3.1 },
                        { month: language === 'ar' ? 'يونيو 2024' : 'Jun 2024', revenue: 210000, expenses: 148000, profit: 62000, growth: 2.8 },
                        { month: language === 'ar' ? 'مايو 2024' : 'May 2024', revenue: 204000, expenses: 145000, profit: 59000, growth: 1.5 }
                      ].map((month, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{month.month}</td>
                          <td className="p-2">{month.revenue.toLocaleString()} {t('demo.currency')}</td>
                          <td className="p-2 text-red-600">({month.expenses.toLocaleString()}) {t('demo.currency')}</td>
                          <td className="p-2 text-green-600">{month.profit.toLocaleString()} {t('demo.currency')}</td>
                          <td className="p-2">
                            <span className={`font-medium ${month.growth > 10 ? 'text-green-600' : month.growth > 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                              +{month.growth}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* التوصيات والملاحظات */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'التوصيات والملاحظات المالية' : 'Financial Recommendations & Notes'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-700 mb-3">{language === 'ar' ? 'نقاط القوة' : 'Strengths'}</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'نمو مستمر في الإيرادات بنسبة 15.2%' : 'Consistent revenue growth of 15.2%'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'سيولة ممتازة مع نسبة تداول 3.51' : 'Excellent liquidity with current ratio of 3.51'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'هامش ربح صافي مرتفع 16.5%' : 'High net profit margin of 16.5%'}</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-700 mb-3">{language === 'ar' ? 'مجالات التحسين' : 'Areas for Improvement'}</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'تحسين كفاءة إدارة المخزون' : 'Improve inventory management efficiency'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'تسريع تحصيل الذمم المدينة' : 'Accelerate accounts receivable collection'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <span className="text-sm">{language === 'ar' ? 'مراجعة استراتيجية التسويق للتكاليف' : 'Review marketing strategy for cost optimization'}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>
    );
  };

  const renderInventoryModule = () => (
    <div className="space-y-6">
      {/* Inventory Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {demoData.inventory.overview.map((item, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{item.label}</p>
                  <p className="text-3xl font-bold">{item.value}</p>
                </div>
                <item.icon className={`h-8 w-8 ${item.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inventory Items */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('demo.inventory.items')}</CardTitle>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                {t('demo.inventory.filter')}
              </Button>
              <Button size="sm" className="bg-[#28376B]">
                <Plus className="h-4 w-4 mr-2" />
                {t('demo.inventory.addItem')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('demo.inventory.product')}</TableHead>
                <TableHead>{t('demo.inventory.sku')}</TableHead>
                <TableHead>{t('demo.inventory.quantity')}</TableHead>
                <TableHead>{t('demo.inventory.value')}</TableHead>
                <TableHead>{t('demo.inventory.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoData.inventory.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.product}</p>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.quantity}</p>
                      <Progress value={(item.quantity / item.maxQuantity) * 100} className="w-16 h-2" />
                    </div>
                  </TableCell>
                  <TableCell>{item.value.toLocaleString()} {t('demo.currency')}</TableCell>
                  <TableCell>
                    <Badge variant={
                      item.status === 'In Stock' ? 'success' : 
                      item.status === 'Low Stock' ? 'warning' : 'destructive'
                    }>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderReportsModule = () => {
    // بيانات وهمية للحضور والانصراف
    const attendanceData = [
      { 
        employeeId: 'AMH', 
        name: 'أحمد محمد حسن',
        totalDays: 22, 
        presentDays: 20, 
        absentDays: 2, 
        lateDays: 3,
        overtimeHours: 15,
        regularHours: 176,
        salary: 15000,
        deductions: 500,
        allowances: 2000,
        netSalary: 16500
      },
      { 
        employeeId: 'FAA', 
        name: 'فاطمة الزهراء علي',
        totalDays: 22, 
        presentDays: 22, 
        absentDays: 0, 
        lateDays: 1,
        overtimeHours: 8,
        regularHours: 176,
        salary: 12000,
        deductions: 200,
        allowances: 1500,
        netSalary: 13300
      },
      { 
        employeeId: 'ORM', 
        name: 'عمر رشيد محمد',
        totalDays: 22, 
        presentDays: 19, 
        absentDays: 3, 
        lateDays: 5,
        overtimeHours: 12,
        regularHours: 152,
        salary: 18000,
        deductions: 800,
        allowances: 2500,
        netSalary: 19700
      },
      { 
        employeeId: 'LMK', 
        name: 'ليلى محمود خالد',
        totalDays: 22, 
        presentDays: 21, 
        absentDays: 1, 
        lateDays: 2,
        overtimeHours: 6,
        regularHours: 168,
        salary: 13500,
        deductions: 300,
        allowances: 1800,
        netSalary: 15000
      },
      { 
        employeeId: 'YIS', 
        name: 'يوسف إبراهيم سعيد',
        totalDays: 22, 
        presentDays: 20, 
        absentDays: 2, 
        lateDays: 4,
        overtimeHours: 20,
        regularHours: 160,
        salary: 16000,
        deductions: 600,
        allowances: 2200,
        netSalary: 17600
      }
    ];

    const summaryStats = {
      totalEmployees: attendanceData.length,
      totalPresent: attendanceData.reduce((sum, emp) => sum + emp.presentDays, 0),
      totalAbsent: attendanceData.reduce((sum, emp) => sum + emp.absentDays, 0),
      totalOvertime: attendanceData.reduce((sum, emp) => sum + emp.overtimeHours, 0),
      totalSalaries: attendanceData.reduce((sum, emp) => sum + emp.salary, 0),
      totalDeductions: attendanceData.reduce((sum, emp) => sum + emp.deductions, 0),
      totalAllowances: attendanceData.reduce((sum, emp) => sum + emp.allowances, 0),
      totalNetSalaries: attendanceData.reduce((sum, emp) => sum + emp.netSalary, 0)
    };

    return (
      <div className="space-y-6">
        {/* تحكم التقارير */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              {language === 'ar' ? 'تقارير الموظفين' : 'Employee Reports'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {language === 'ar' ? 'نوع التقرير' : 'Report Type'}
                </label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="attendance">{language === 'ar' ? 'تقرير الحضور والانصراف' : 'Attendance Report'}</option>
                  <option value="payroll">{language === 'ar' ? 'تقرير المرتبات' : 'Payroll Report'}</option>
                  <option value="overtime">{language === 'ar' ? 'تقرير العمل الإضافي' : 'Overtime Report'}</option>
                  <option value="deductions">{language === 'ar' ? 'تقرير الخصومات' : 'Deductions Report'}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {language === 'ar' ? 'الفترة الزمنية' : 'Period'}
                </label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                >
                  <option value="weekly">{language === 'ar' ? 'أسبوعي' : 'Weekly'}</option>
                  <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                  <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
                </select>
              </div>

              {reportPeriod === 'monthly' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {language === 'ar' ? 'الشهر' : 'Month'}
                  </label>
                  <input 
                    type="month"
                    className="w-full border rounded px-3 py-2"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
              )}

              {reportPeriod === 'yearly' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {language === 'ar' ? 'السنة' : 'Year'}
                  </label>
                  <select 
                    className="w-full border rounded px-3 py-2"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2 w-full">
                  <Button 
                    className="bg-[#28376B] flex-1"
                    onClick={() => exportReportData(reportType)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => exportToPDF('reports-content', `تقرير_${reportType}_${reportPeriod}`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => printReport('reports-content', `تقرير ${reportType === 'attendance' ? 'الحضور والانصراف' : reportType === 'payroll' ? 'المرتبات' : reportType === 'overtime' ? 'العمل الإضافي' : 'الخصومات'}`)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'طباعة التقرير' : 'Print Report'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ملخص إحصائي */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#28376B]">{summaryStats.totalEmployees}</div>
              <div className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{summaryStats.totalPresent}</div>
              <div className="text-sm text-gray-600">{language === 'ar' ? 'أيام الحضور' : 'Present Days'}</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{summaryStats.totalAbsent}</div>
              <div className="text-sm text-gray-600">{language === 'ar' ? 'أيام الغياب' : 'Absent Days'}</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{summaryStats.totalOvertime}</div>
              <div className="text-sm text-gray-600">{language === 'ar' ? 'ساعات إضافية' : 'Overtime Hours'}</div>
            </CardContent>
          </Card>
        </div>

        {/* جدول التقرير */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {reportType === 'attendance' && (language === 'ar' ? 'تقرير الحضور والانصراف' : 'Attendance Report')}
                {reportType === 'payroll' && (language === 'ar' ? 'تقرير المرتبات' : 'Payroll Report')}
                {reportType === 'overtime' && (language === 'ar' ? 'تقرير العمل الإضافي' : 'Overtime Report')}
                {reportType === 'deductions' && (language === 'ar' ? 'تقرير الخصومات' : 'Deductions Report')}
                {' - '}
                {reportPeriod === 'weekly' && (language === 'ar' ? 'أسبوعي' : 'Weekly')}
                {reportPeriod === 'monthly' && (language === 'ar' ? `شهري - ${selectedMonth}` : `Monthly - ${selectedMonth}`)}
                {reportPeriod === 'yearly' && (language === 'ar' ? `سنوي - ${selectedYear}` : `Yearly - ${selectedYear}`)}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => exportReportData(reportType)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => printReport('reports-content', `تقرير ${reportType === 'attendance' ? 'الحضور والانصراف' : reportType === 'payroll' ? 'المرتبات' : reportType === 'overtime' ? 'العمل الإضافي' : 'الخصومات'}`)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'طباعة' : 'Print'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent id="reports-content">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">{language === 'ar' ? 'الموظف' : 'Employee'}</th>
                    
                    {reportType === 'attendance' && (
                      <>
                        <th className="text-left p-2">{language === 'ar' ? 'أيام العمل' : 'Work Days'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'أيام الحضور' : 'Present'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'أيام الغياب' : 'Absent'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'أيام التأخير' : 'Late Days'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'ساعات العمل' : 'Work Hours'}</th>
                      </>
                    )}

                    {reportType === 'payroll' && (
                      <>
                        <th className="text-left p-2">{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'البدلات' : 'Allowances'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'الخصومات' : 'Deductions'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'صافي الراتب' : 'Net Salary'}</th>
                      </>
                    )}

                    {reportType === 'overtime' && (
                      <>
                        <th className="text-left p-2">{language === 'ar' ? 'الساعات العادية' : 'Regular Hours'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'الساعات الإضافية' : 'Overtime Hours'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'مقابل الإضافي' : 'Overtime Pay'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                      </>
                    )}

                    {reportType === 'deductions' && (
                      <>
                        <th className="text-left p-2">{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'خصم الغياب' : 'Absence Deduction'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'خصم التأخير' : 'Late Deduction'}</th>
                        <th className="text-left p-2">{language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((employee) => (
                    <tr key={employee.employeeId} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-gray-500">{employee.employeeId}</div>
                        </div>
                      </td>

                      {reportType === 'attendance' && (
                        <>
                          <td className="p-2">{employee.totalDays}</td>
                          <td className="p-2">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                              {employee.presentDays}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                              {employee.absentDays}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                              {employee.lateDays}
                            </span>
                          </td>
                          <td className="p-2">{employee.regularHours}h</td>
                        </>
                      )}

                      {reportType === 'payroll' && (
                        <>
                          <td className="p-2">{employee.salary.toLocaleString()} {t('demo.currency')}</td>
                          <td className="p-2">
                            <span className="text-green-600">+{employee.allowances.toLocaleString()}</span>
                          </td>
                          <td className="p-2">
                            <span className="text-red-600">-{employee.deductions.toLocaleString()}</span>
                          </td>
                          <td className="p-2 font-semibold">{employee.netSalary.toLocaleString()} {t('demo.currency')}</td>
                        </>
                      )}

                      {reportType === 'overtime' && (
                        <>
                          <td className="p-2">{employee.regularHours}h</td>
                          <td className="p-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                              {employee.overtimeHours}h
                            </span>
                          </td>
                          <td className="p-2">{(employee.overtimeHours * 50).toLocaleString()} {t('demo.currency')}</td>
                          <td className="p-2 font-semibold">
                            {(employee.salary + (employee.overtimeHours * 50)).toLocaleString()} {t('demo.currency')}
                          </td>
                        </>
                      )}

                      {reportType === 'deductions' && (
                        <>
                          <td className="p-2">{employee.salary.toLocaleString()} {t('demo.currency')}</td>
                          <td className="p-2">
                            <span className="text-red-600">-{(employee.absentDays * 200).toLocaleString()}</span>
                          </td>
                          <td className="p-2">
                            <span className="text-red-600">-{(employee.lateDays * 50).toLocaleString()}</span>
                          </td>
                          <td className="p-2 font-semibold text-red-600">
                            -{employee.deductions.toLocaleString()} {t('demo.currency')}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ملخص إجمالي */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-3">{language === 'ar' ? 'الملخص الإجمالي' : 'Summary Totals'}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reportType === 'payroll' && (
                  <>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الرواتب:' : 'Total Salaries:'}</span>
                      <div className="font-semibold">{summaryStats.totalSalaries.toLocaleString()} {t('demo.currency')}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي البدلات:' : 'Total Allowances:'}</span>
                      <div className="font-semibold text-green-600">+{summaryStats.totalAllowances.toLocaleString()} {t('demo.currency')}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الخصومات:' : 'Total Deductions:'}</span>
                      <div className="font-semibold text-red-600">-{summaryStats.totalDeductions.toLocaleString()} {t('demo.currency')}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'صافي الإجمالي:' : 'Net Total:'}</span>
                      <div className="font-semibold text-[#28376B]">{summaryStats.totalNetSalaries.toLocaleString()} {t('demo.currency')}</div>
                    </div>
                  </>
                )}

                {reportType === 'attendance' && (
                  <>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'معدل الحضور:' : 'Attendance Rate:'}</span>
                      <div className="font-semibold text-green-600">
                        {((summaryStats.totalPresent / (summaryStats.totalPresent + summaryStats.totalAbsent)) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الساعات الإضافية:' : 'Total Overtime:'}</span>
                      <div className="font-semibold text-orange-600">{summaryStats.totalOvertime} {language === 'ar' ? 'ساعة' : 'hours'}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderModule = () => {
    // Check if we're in an HR sub-module
    if (activeModule === 'hr' && activeHRSubModule) {
      const userRole = language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager'; // Demo role
      
      switch (activeHRSubModule) {
        case 'hr-overview':
          return renderHRModule();
        case 'salaries':
          return <SalariesModule language={language} userRole={userRole} />;
        case 'allowances':
          return <AllowancesModule language={language} userRole={userRole} />;
        case 'deductions':
          return <DeductionsModule language={language} userRole={userRole} />;
        case 'casual-leave':
          return <CasualLeaveModule language={language} userRole={userRole} />;
        case 'annual-leave':
          return <AnnualLeaveModule language={language} userRole={userRole} />;
        case 'attendance':
          return <AttendanceModule language={language} userRole={userRole} />;
        default:
          return renderHRModule();
      }
    }
    
    // Check if we're in a financial sub-module
    if (activeModule === 'financial' && activeFinancialSubModule) {
      const userRole = language === 'ar' ? 'المدير المالي' : 'Financial Manager'; // Demo role
      
      switch (activeFinancialSubModule) {
        case 'overview':
          return renderFinancialModule();
        case 'journal-entries':
          return <JournalEntriesModule language={language} userRole={userRole} />;
        case 'treasury':
          return <TreasuryModule language={language} userRole={userRole} />;
        case 'custody':
          return <CustodyModule language={language} userRole={userRole} />;
        case 'accounts':
          return <AccountsModule language={language} userRole={userRole} />;
        case 'suppliers':
          return <SuppliersModule language={language} userRole={userRole} />;
        case 'customers':
          return <CustomersModule language={language} userRole={userRole} />;
        default:
          return renderFinancialModule();
      }
    }
    
    switch (activeModule) {
      case 'dashboard': return renderDashboard();
      case 'hr': return renderHRModule();
      case 'financial': return renderFinancialModule();
      case 'inventory': return renderInventoryModule();
      case 'reports': return renderReportsModule();
      case 'analytics': return renderDashboard(); // Reuse dashboard for now
      default: return renderDashboard();
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : ''}`}>
      {/* Demo Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('demo.title')}
              </h1>
              <p className="text-gray-600">{t('demo.subtitle')}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className="bg-green-100 text-green-800">
                {t('demo.demoMode')}
              </Badge>
              <Button 
                variant="outline" 
                onClick={() => setIsGuidedTour(!isGuidedTour)}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                {t('demo.guidedTour')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white h-screen shadow-sm overflow-y-auto">
          <div className="p-6">
            <div className="space-y-2">
              {modules.map((module) => (
                <div key={module.id}>
                  <Button
                    variant={activeModule === module.id && !activeFinancialSubModule && !activeHRSubModule ? "default" : "ghost"}
                    className={`w-full justify-start ${activeModule === module.id && !activeFinancialSubModule && !activeHRSubModule ? 'bg-[#28376B]' : ''}`}
                    onClick={() => {
                      if (module.hasSubModules) {
                        setExpandedModule(expandedModule === module.id ? null : module.id);
                        setActiveModule(module.id);
                        if (expandedModule !== module.id) {
                          setActiveFinancialSubModule(null);
                          setActiveHRSubModule(null);
                        }
                      } else {
                        setActiveModule(module.id);
                        setActiveFinancialSubModule(null);
                        setActiveHRSubModule(null);
                        setExpandedModule(null);
                      }
                    }}
                  >
                    {module.icon}
                    <span className={`${isRTL ? 'mr-2' : 'ml-2'} flex-1 text-${isRTL ? 'right' : 'left'}`}>{module.name}</span>
                    {module.hasSubModules && (
                      expandedModule === module.id ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {/* Sub-modules for HR */}
                  {module.hasSubModules && module.id === 'hr' && expandedModule === module.id && (
                    <div className={`${isRTL ? 'mr-4' : 'ml-4'} mt-1 space-y-1`}>
                      {hrSubModules.map((subModule) => (
                        <Button
                          key={subModule.id}
                          variant={activeHRSubModule === subModule.id ? "default" : "ghost"}
                          size="sm"
                          className={`w-full justify-start ${activeHRSubModule === subModule.id ? 'bg-[#28376B]' : ''}`}
                          onClick={() => {
                            setActiveHRSubModule(subModule.id);
                            setActiveFinancialSubModule(null);
                            setActiveModule('hr');
                          }}
                        >
                          {subModule.icon}
                          <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm`}>{subModule.name}</span>
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Sub-modules for Financial */}
                  {module.hasSubModules && module.id === 'financial' && expandedModule === module.id && (
                    <div className={`${isRTL ? 'mr-4' : 'ml-4'} mt-1 space-y-1`}>
                      {financialSubModules.map((subModule) => (
                        <Button
                          key={subModule.id}
                          variant={activeFinancialSubModule === subModule.id ? "default" : "ghost"}
                          size="sm"
                          className={`w-full justify-start ${activeFinancialSubModule === subModule.id ? 'bg-[#28376B]' : ''}`}
                          onClick={() => {
                            setActiveFinancialSubModule(subModule.id);
                            setActiveHRSubModule(null);
                            setActiveModule('financial');
                          }}
                        >
                          {subModule.icon}
                          <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm`}>{subModule.name}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {renderModule()}
        </div>
      </div>

      {/* Guided Tour Overlay */}
      {isGuidedTour && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>{t('demo.tour.welcome')}</CardTitle>
              <CardDescription>{t('demo.tour.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsGuidedTour(false)}
                className="w-full bg-[#28376B]"
              >
                {t('demo.tour.start')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advanced Add Employee Modal */}
      {isAddEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex justify-between items-center">
                {t('demo.employeeForm.basic.personalInfo')}
                <Button variant="ghost" onClick={() => setIsAddEmployeeModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            
            {/* Tabs Navigation */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {['basic', 'job', 'financial', 'documents', 'transfers'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                      activeTab === tab 
                        ? 'border-[#28376B] text-[#28376B]' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t(`demo.employeeForm.tabs.${tab}`)}
                  </button>
                ))}
              </div>
            </div>

            <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Basic Information Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.fullName')} *</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.basic.fullName')} 
                        value={employeeForm.fullName}
                        onChange={(e) => setEmployeeForm({...employeeForm, fullName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.email')} *</label>
                      <input 
                        type="email"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="example@company.com" 
                        value={employeeForm.email}
                        onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.phone')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="+20 1xxxxxxxxx" 
                        value={employeeForm.phone}
                        onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.nationalId')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="00000000000000" 
                        value={employeeForm.nationalId}
                        onChange={(e) => setEmployeeForm({...employeeForm, nationalId: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.birthDate')}</label>
                      <input 
                        type="date"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        value={employeeForm.birthDate}
                        onChange={(e) => setEmployeeForm({...employeeForm, birthDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.gender')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.gender}
                        onChange={(e) => setEmployeeForm({...employeeForm, gender: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.basic.gender')}</option>
                        <option value="male">{t('demo.employeeForm.basic.male')}</option>
                        <option value="female">{t('demo.employeeForm.basic.female')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.maritalStatus')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.maritalStatus}
                        onChange={(e) => setEmployeeForm({...employeeForm, maritalStatus: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.basic.maritalStatus')}</option>
                        <option value="single">{t('demo.employeeForm.basic.single')}</option>
                        <option value="married">{t('demo.employeeForm.basic.married')}</option>
                        <option value="divorced">{t('demo.employeeForm.basic.divorced')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('demo.employeeForm.basic.address')}</label>
                    <textarea 
                      className="w-full border rounded px-3 py-2 mt-1 h-20" 
                      placeholder={t('demo.employeeForm.basic.address')} 
                      value={employeeForm.address}
                      onChange={(e) => setEmployeeForm({...employeeForm, address: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Job Details Tab */}
              {activeTab === 'job' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.job.jobDetails')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.position')} *</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.job.position')} 
                        value={employeeForm.position}
                        onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.department')} *</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 border rounded px-3 py-2 mt-1"
                          value={employeeForm.department}
                          onChange={(e) => setEmployeeForm({...employeeForm, department: e.target.value})}
                        >
                          <option value="">{t('demo.employeeForm.job.department')}</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {language === 'ar' ? dept.nameAr : dept.name}
                            </option>
                          ))}
                        </select>
                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="mt-1 px-3"
                          onClick={() => setShowAddDepartmentModal(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {language === 'ar' ? 'اضغط + لإضافة قسم جديد' : 'Click + to add new department'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.directManager')}</label>
                      <select className="w-full border rounded px-3 py-2 mt-1">
                        <option value="">{t('demo.employeeForm.job.directManager')}</option>
                        <option value="ahmed">Ahmed Hassan</option>
                        <option value="fatima">Fatima Al-Zahra</option>
                        <option value="omar">Omar Rashid</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.startDate')} *</label>
                      <input 
                        type="date"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        value={employeeForm.startDate}
                        onChange={(e) => setEmployeeForm({...employeeForm, startDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.employmentType')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.employmentType}
                        onChange={(e) => setEmployeeForm({...employeeForm, employmentType: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.job.employmentType')}</option>
                        <option value="fullTime">{t('demo.employeeForm.job.fullTime')}</option>
                        <option value="partTime">{t('demo.employeeForm.job.partTime')}</option>
                        <option value="contract">{t('demo.employeeForm.job.contract')}</option>
                        <option value="internship">{t('demo.employeeForm.job.internship')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.workLocation')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.job.workLocation')} 
                        value={employeeForm.workLocation}
                        onChange={(e) => setEmployeeForm({...employeeForm, workLocation: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Tab */}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.financial.salaryInfo')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.baseSalary')} *</label>
                      <input 
                        type="number"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="0" 
                        value={employeeForm.baseSalary}
                        onChange={(e) => setEmployeeForm({...employeeForm, baseSalary: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.payrollMethod')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.payrollMethod}
                        onChange={(e) => setEmployeeForm({...employeeForm, payrollMethod: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.financial.payrollMethod')}</option>
                        <option value="cash">{t('demo.employeeForm.financial.cash')}</option>
                        <option value="bank">{t('demo.employeeForm.financial.bank')}</option>
                      </select>
                    </div>
                  </div>

                  {employeeForm.payrollMethod === 'bank' && (
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.bankAccount')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.financial.bankAccount')} 
                        value={employeeForm.bankAccount}
                        onChange={(e) => setEmployeeForm({...employeeForm, bankAccount: e.target.value})}
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{t('demo.employeeForm.financial.allowances')}</h4>
                      <Button 
                        size="sm" 
                        onClick={() => setEmployeeForm({
                          ...employeeForm, 
                          allowances: [...employeeForm.allowances, { type: '', amount: '' }]
                        })}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('demo.employeeForm.actions.addAllowance')}
                      </Button>
                    </div>
                    
                    {employeeForm.allowances.map((allowance, index) => (
                      <div key={index} className="flex gap-3 mb-3">
                        <div className="flex-1 flex gap-2">
                          <select 
                            className="flex-1 border rounded px-3 py-2"
                            value={allowance.type}
                            onChange={(e) => {
                              const newAllowances = [...employeeForm.allowances];
                              newAllowances[index].type = e.target.value;
                              if (e.target.value === 'custom') {
                                newAllowances[index].customName = '';
                              }
                              setEmployeeForm({...employeeForm, allowances: newAllowances});
                            }}
                          >
                            <option value="">{t('demo.employeeForm.financial.allowanceType')}</option>
                            <option value="transportation">{t('demo.employeeForm.financial.transportation')}</option>
                            <option value="housing">{t('demo.employeeForm.financial.housing')}</option>
                            <option value="food">{t('demo.employeeForm.financial.food')}</option>
                            <option value="communication">{t('demo.employeeForm.financial.communication')}</option>
                            <option value="other">{t('demo.employeeForm.financial.other')}</option>
                            {customAllowanceTypes.map((customType, customIndex) => (
                              <option key={customIndex} value={`custom_${customIndex}`}>
                                {language === 'ar' ? customType.nameAr : customType.nameEn}
                              </option>
                            ))}
                            <option value="custom">{t('demo.employeeForm.customTypes.custom')}</option>
                          </select>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowAddAllowanceType(true)}
                            title={t('demo.employeeForm.actions.addCustomType')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {allowance.type === 'custom' && (
                          <input 
                            type="text"
                            className="flex-1 border rounded px-3 py-2 mt-2"
                            placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                            value={allowance.customName || ''}
                            onChange={(e) => {
                              const newAllowances = [...employeeForm.allowances];
                              newAllowances[index].customName = e.target.value;
                              setEmployeeForm({...employeeForm, allowances: newAllowances});
                            }}
                          />
                        )}
                        <input 
                          type="number"
                          className="flex-1 border rounded px-3 py-2"
                          placeholder={t('demo.employeeForm.financial.allowanceAmount')}
                          value={allowance.amount}
                          onChange={(e) => {
                            const newAllowances = [...employeeForm.allowances];
                            newAllowances[index].amount = e.target.value;
                            setEmployeeForm({...employeeForm, allowances: newAllowances});
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const newAllowances = employeeForm.allowances.filter((_, i) => i !== index);
                            setEmployeeForm({...employeeForm, allowances: newAllowances});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{t('demo.employeeForm.financial.deductions')}</h4>
                      <Button 
                        size="sm" 
                        onClick={() => setEmployeeForm({
                          ...employeeForm, 
                          deductions: [...employeeForm.deductions, { type: '', amount: '' }]
                        })}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('demo.employeeForm.actions.addDeduction')}
                      </Button>
                    </div>
                    
                    {employeeForm.deductions.map((deduction, index) => (
                      <div key={index} className="flex gap-3 mb-3">
                        <div className="flex-1 flex gap-2">
                          <select 
                            className="flex-1 border rounded px-3 py-2"
                            value={deduction.type}
                            onChange={(e) => {
                              const newDeductions = [...employeeForm.deductions];
                              newDeductions[index].type = e.target.value;
                              if (e.target.value === 'custom') {
                                newDeductions[index].customName = '';
                              }
                              setEmployeeForm({...employeeForm, deductions: newDeductions});
                            }}
                          >
                            <option value="">{t('demo.employeeForm.financial.deductionType')}</option>
                            <option value="insurance">{t('demo.employeeForm.financial.insurance')}</option>
                            <option value="tax">{t('demo.employeeForm.financial.tax')}</option>
                            <option value="loan">{t('demo.employeeForm.financial.loan')}</option>
                            <option value="other">{t('demo.employeeForm.financial.other')}</option>
                            {customDeductionTypes.map((customType, customIndex) => (
                              <option key={customIndex} value={`custom_${customIndex}`}>
                                {language === 'ar' ? customType.nameAr : customType.nameEn}
                              </option>
                            ))}
                            <option value="custom">{t('demo.employeeForm.customTypes.custom')}</option>
                          </select>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowAddDeductionType(true)}
                            title={t('demo.employeeForm.actions.addCustomType')}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {deduction.type === 'custom' && (
                          <input 
                            type="text"
                            className="flex-1 border rounded px-3 py-2 mt-2"
                            placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                            value={deduction.customName || ''}
                            onChange={(e) => {
                              const newDeductions = [...employeeForm.deductions];
                              newDeductions[index].customName = e.target.value;
                              setEmployeeForm({...employeeForm, deductions: newDeductions});
                            }}
                          />
                        )}
                        <input 
                          type="number"
                          className="flex-1 border rounded px-3 py-2"
                          placeholder={t('demo.employeeForm.financial.deductionAmount')}
                          value={deduction.amount}
                          onChange={(e) => {
                            const newDeductions = [...employeeForm.deductions];
                            newDeductions[index].amount = e.target.value;
                            setEmployeeForm({...employeeForm, deductions: newDeductions});
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const newDeductions = employeeForm.deductions.filter((_, i) => i !== index);
                            setEmployeeForm({...employeeForm, deductions: newDeductions});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.documents.documentsFiles')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.profileImage')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.profileImage ? (
                            <div className="space-y-2">
                              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                              </div>
                              <p className="text-sm text-green-600 font-medium">{employeeForm.profileImage.name}</p>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEmployeeForm({...employeeForm, profileImage: null})}
                              >
                                {language === 'ar' ? 'إزالة الصورة' : 'Remove Image'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                <Users className="h-8 w-8 text-gray-400" />
                              </div>
                              <input 
                                type="file" 
                                id="profileImage" 
                                accept="image/*" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setEmployeeForm({...employeeForm, profileImage: file});
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('profileImage').click()}
                              >
                                {t('demo.employeeForm.documents.uploadImage')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">JPG, PNG - {t('demo.employeeForm.documents.maxSize')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.cv')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.cv ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                              <p className="text-sm text-green-600 font-medium">{employeeForm.cv.name}</p>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEmployeeForm({...employeeForm, cv: null})}
                              >
                                {language === 'ar' ? 'إزالة السيرة الذاتية' : 'Remove CV'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <input 
                                type="file" 
                                id="cvFile" 
                                accept=".pdf,.doc,.docx" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setEmployeeForm({...employeeForm, cv: file});
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('cvFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadCV')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.contracts')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.contracts && employeeForm.contracts.length > 0 ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                              <div className="space-y-1">
                                {employeeForm.contracts.map((contract, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span className="text-green-600">{contract.name}</span>
                                    <Button 
                                      size="xs" 
                                      variant="ghost"
                                      onClick={() => {
                                        const newContracts = employeeForm.contracts.filter((_, i) => i !== index);
                                        setEmployeeForm({...employeeForm, contracts: newContracts});
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('contractFile').click()}
                              >
                                {language === 'ar' ? 'إضافة عقد آخر' : 'Add Another Contract'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('contractFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadContract')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="contractFile" 
                            accept=".pdf,.doc,.docx" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const newContracts = [...(employeeForm.contracts || []), file];
                                setEmployeeForm({...employeeForm, contracts: newContracts});
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.certificates')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.certificates && employeeForm.certificates.length > 0 ? (
                            <div className="space-y-2">
                              <Award className="h-8 w-8 text-green-600 mx-auto" />
                              <div className="space-y-1">
                                {employeeForm.certificates.map((certificate, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span className="text-green-600">{certificate.name}</span>
                                    <Button 
                                      size="xs" 
                                      variant="ghost"
                                      onClick={() => {
                                        const newCertificates = employeeForm.certificates.filter((_, i) => i !== index);
                                        setEmployeeForm({...employeeForm, certificates: newCertificates});
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('certificateFile').click()}
                              >
                                {language === 'ar' ? 'إضافة شهادة أخرى' : 'Add Another Certificate'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <Award className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('certificateFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadCertificate')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="certificateFile" 
                            accept=".pdf,.doc,.docx,.jpg,.png" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const newCertificates = [...(employeeForm.certificates || []), file];
                                setEmployeeForm({...employeeForm, certificates: newCertificates});
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfers Tab */}
              {activeTab === 'transfers' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{t('demo.employeeForm.transfers.transferHistory')}</h3>
                    <Button 
                      size="sm" 
                      onClick={() => setEmployeeForm({
                        ...employeeForm, 
                        transfers: [...employeeForm.transfers, { 
                          fromDepartment: '', 
                          toDepartment: '', 
                          date: '', 
                          reason: '', 
                          notes: '' 
                        }]
                      })}
                      className="bg-[#28376B]"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('demo.employeeForm.transfers.addTransfer')}
                    </Button>
                  </div>

                  {employeeForm.transfers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>{language === 'ar' ? 'لا يوجد انتقالات بعد' : 'No transfers yet'}</p>
                    </div>
                  ) : (
                    employeeForm.transfers.map((transfer, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.fromDepartment')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.fromDepartment}
                              onChange={(e) => {
                                const newTransfers = [...employeeForm.transfers];
                                newTransfers[index].fromDepartment = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">Select Department</option>
                              <option value="IT">IT</option>
                              <option value="HR">HR</option>
                              <option value="Finance">Finance</option>
                              <option value="Operations">Operations</option>
                              <option value="Sales">Sales</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.toDepartment')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.toDepartment}
                              onChange={(e) => {
                                const newTransfers = [...employeeForm.transfers];
                                newTransfers[index].toDepartment = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">Select Department</option>
                              <option value="IT">IT</option>
                              <option value="HR">HR</option>
                              <option value="Finance">Finance</option>
                              <option value="Operations">Operations</option>
                              <option value="Sales">Sales</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.transferDate')}</label>
                            <input 
                              type="date"
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.date}
                              onChange={(e) => {
                                const newTransfers = [...employeeForm.transfers];
                                newTransfers[index].date = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.reason')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.reason}
                              onChange={(e) => {
                                const newTransfers = [...employeeForm.transfers];
                                newTransfers[index].reason = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">{t('demo.employeeForm.transfers.reason')}</option>
                              <option value="promotion">{t('demo.employeeForm.transfers.promotion')}</option>
                              <option value="departmentChange">{t('demo.employeeForm.transfers.departmentChange')}</option>
                              <option value="locationChange">{t('demo.employeeForm.transfers.locationChange')}</option>
                              <option value="restructuring">{t('demo.employeeForm.transfers.restructuring')}</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.notes')}</label>
                            <textarea 
                              className="w-full border rounded px-3 py-2 mt-1 h-20"
                              placeholder={t('demo.employeeForm.transfers.notes')}
                              value={transfer.notes}
                              onChange={(e) => {
                                const newTransfers = [...employeeForm.transfers];
                                newTransfers[index].notes = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            />
                          </div>
                          <div className="md:col-span-2 flex justify-end">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const newTransfers = employeeForm.transfers.filter((_, i) => i !== index);
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {language === 'ar' ? 'حذف' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>

            {/* Modal Footer */}
            <div className="border-t p-6">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {activeTab !== 'basic' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const tabs = ['basic', 'job', 'financial', 'documents', 'transfers'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                      }}
                    >
                      {t('demo.employeeForm.actions.previous')}
                    </Button>
                  )}
                  {activeTab !== 'transfers' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const tabs = ['basic', 'job', 'financial', 'documents', 'transfers'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                      }}
                    >
                      {t('demo.employeeForm.actions.next')}
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setIsAddEmployeeModal(false)}
                  >
                    {t('demo.employeeForm.actions.cancel')}
                  </Button>
                  <Button 
                    className="bg-[#28376B]"
                    onClick={() => {
                      alert(language === 'ar' ? 'تم حفظ الموظف بنجاح! (عرض توضيحي)' : 'Employee saved successfully! (Demo)');
                      setIsAddEmployeeModal(false);
                      // Reset form
                      setEmployeeForm({
                        fullName: '', email: '', phone: '', nationalId: '', birthDate: '', gender: '', maritalStatus: '', address: '',
                        position: '', department: '', directManager: '', startDate: '', employmentType: '', workLocation: '',
                        baseSalary: '', allowances: [], deductions: [], payrollMethod: '', bankAccount: '',
                        profileImage: null, cv: null, contracts: [], certificates: [], transfers: []
                      });
                      setActiveTab('basic');
                    }}
                  >
                    {t('demo.employeeForm.actions.save')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Employee Details Modal */}
      {showEmployeeDetails && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="max-w-lg w-full mx-4">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {language === 'ar' ? 'تفاصيل الموظف' : 'Employee Details'}
                <Button variant="ghost" onClick={() => setShowEmployeeDetails(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedEmployee.avatar} />
                  <AvatarFallback className="text-lg">{selectedEmployee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-gray-600">{selectedEmployee.position}</p>
                  <Badge variant={selectedEmployee.status === 'Present' ? 'success' : selectedEmployee.status === 'Absent' ? 'destructive' : 'warning'}>
                    {selectedEmployee.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                  <p className="text-sm">{selectedEmployee.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{language === 'ar' ? 'القسم' : 'Department'}</label>
                  <p className="text-sm">{selectedEmployee.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{language === 'ar' ? 'الراتب' : 'Salary'}</label>
                  <p className="text-sm">{selectedEmployee.salary?.toLocaleString()} {t('demo.currency')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">{language === 'ar' ? 'تاريخ الانضمام' : 'Join Date'}</label>
                  <p className="text-sm">{selectedEmployee.joinDate}</p>
                </div>
              </div>
              
              <div className="pt-4">
                <Button 
                  className="w-full"
                  onClick={() => setShowEmployeeDetails(false)}
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDepartmentModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {t('demo.employeeForm.addDepartment.title')}
                <Button variant="ghost" onClick={() => setShowAddDepartmentModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {language === 'ar' ? t('demo.employeeForm.addDepartment.nameAr') : t('demo.employeeForm.addDepartment.nameEn')} *
                </label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={t('demo.employeeForm.addDepartment.namePlaceholder')}
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({...newDepartment, name: e.target.value})}
                />
              </div>

              {language === 'ar' ? (
                <div>
                  <label className="text-sm font-medium">{t('demo.employeeForm.addDepartment.nameEn')}</label>
                  <input 
                    className="w-full border rounded px-3 py-2 mt-1" 
                    placeholder="Enter English name"
                    value={newDepartment.nameEn || ''}
                    onChange={(e) => setNewDepartment({...newDepartment, nameEn: e.target.value})}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">{t('demo.employeeForm.addDepartment.nameAr')}</label>
                  <input 
                    className="w-full border rounded px-3 py-2 mt-1" 
                    placeholder="أدخل الاسم بالعربية"
                    value={newDepartment.nameAr || ''}
                    onChange={(e) => setNewDepartment({...newDepartment, nameAr: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.addDepartment.description')}</label>
                <textarea 
                  className="w-full border rounded px-3 py-2 mt-1 h-20" 
                  placeholder={t('demo.employeeForm.addDepartment.descriptionPlaceholder')}
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({...newDepartment, description: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.addDepartment.manager')}</label>
                <select 
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={newDepartment.manager}
                  onChange={(e) => setNewDepartment({...newDepartment, manager: e.target.value})}
                >
                  <option value="">{t('demo.employeeForm.addDepartment.manager')}</option>
                  <option value="ahmed">Ahmed Hassan - {language === 'ar' ? 'مدير تنفيذي' : 'Executive Manager'}</option>
                  <option value="fatima">Fatima Al-Zahra - {language === 'ar' ? 'مدير HR' : 'HR Manager'}</option>
                  <option value="omar">Omar Rashid - {language === 'ar' ? 'مدير مالي' : 'Finance Manager'}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowAddDepartmentModal(false);
                    setNewDepartment({ name: '', description: '', manager: '' });
                  }}
                >
                  {t('demo.employeeForm.addDepartment.cancel')}
                </Button>
                <Button 
                  className="flex-1 bg-[#28376B]"
                  onClick={() => {
                    if (newDepartment.name.trim()) {
                      const departmentId = newDepartment.name.replace(/\s+/g, '_').toUpperCase();
                      const newDept = {
                        id: departmentId,
                        name: language === 'ar' ? (newDepartment.nameEn || newDepartment.name) : newDepartment.name,
                        nameAr: language === 'ar' ? newDepartment.name : (newDepartment.nameAr || newDepartment.name),
                        description: newDepartment.description,
                        manager: newDepartment.manager
                      };
                      
                      setDepartments([...departments, newDept]);
                      setEmployeeForm({...employeeForm, department: departmentId});
                      
                      alert(language === 'ar' ? 
                        `تم إضافة قسم "${newDept.nameAr}" بنجاح! (عرض توضيحي)` : 
                        `Department "${newDept.name}" added successfully! (Demo)`
                      );
                      
                      setShowAddDepartmentModal(false);
                      setNewDepartment({ name: '', description: '', manager: '' });
                    } else {
                      alert(language === 'ar' ? 'يرجى إدخال اسم القسم' : 'Please enter department name');
                    }
                  }}
                  disabled={!newDepartment.name.trim()}
                >
                  {t('demo.employeeForm.addDepartment.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Custom Allowance Type Modal */}
      {showAddAllowanceType && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {t('demo.employeeForm.customTypes.allowanceTitle')}
                <Button variant="ghost" onClick={() => setShowAddAllowanceType(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {language === 'ar' ? t('demo.employeeForm.customTypes.nameAr') : t('demo.employeeForm.customTypes.nameEn')} *
                </label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                  value={language === 'ar' ? newAllowanceType.nameAr : newAllowanceType.nameEn}
                  onChange={(e) => setNewAllowanceType({
                    ...newAllowanceType, 
                    [language === 'ar' ? 'nameAr' : 'nameEn']: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {language === 'ar' ? t('demo.employeeForm.customTypes.nameEn') : t('demo.employeeForm.customTypes.nameAr')}
                </label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={language === 'ar' ? 'Enter English name' : 'أدخل الاسم بالعربية'}
                  value={language === 'ar' ? newAllowanceType.nameEn : newAllowanceType.nameAr}
                  onChange={(e) => setNewAllowanceType({
                    ...newAllowanceType, 
                    [language === 'ar' ? 'nameEn' : 'nameAr']: e.target.value
                  })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowAddAllowanceType(false);
                    setNewAllowanceType({ nameAr: '', nameEn: '' });
                  }}
                >
                  {t('demo.employeeForm.customTypes.cancel')}
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    const primaryName = language === 'ar' ? newAllowanceType.nameAr : newAllowanceType.nameEn;
                    if (primaryName.trim()) {
                      const newType = {
                        nameAr: newAllowanceType.nameAr || primaryName,
                        nameEn: newAllowanceType.nameEn || primaryName
                      };
                      
                      setCustomAllowanceTypes([...customAllowanceTypes, newType]);
                      
                      alert(language === 'ar' ? 
                        `تم إضافة نوع البدلة "${newType.nameAr}" بنجاح! (عرض توضيحي)` : 
                        `Allowance type "${newType.nameEn}" added successfully! (Demo)`
                      );
                      
                      setShowAddAllowanceType(false);
                      setNewAllowanceType({ nameAr: '', nameEn: '' });
                    }
                  }}
                  disabled={!(language === 'ar' ? newAllowanceType.nameAr.trim() : newAllowanceType.nameEn.trim())}
                >
                  {t('demo.employeeForm.customTypes.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Custom Deduction Type Modal */}
      {showAddDeductionType && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {t('demo.employeeForm.customTypes.deductionTitle')}
                <Button variant="ghost" onClick={() => setShowAddDeductionType(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {language === 'ar' ? t('demo.employeeForm.customTypes.nameAr') : t('demo.employeeForm.customTypes.nameEn')} *
                </label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                  value={language === 'ar' ? newDeductionType.nameAr : newDeductionType.nameEn}
                  onChange={(e) => setNewDeductionType({
                    ...newDeductionType, 
                    [language === 'ar' ? 'nameAr' : 'nameEn']: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {language === 'ar' ? t('demo.employeeForm.customTypes.nameEn') : t('demo.employeeForm.customTypes.nameAr')}
                </label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={language === 'ar' ? 'Enter English name' : 'أدخل الاسم بالعربية'}
                  value={language === 'ar' ? newDeductionType.nameEn : newDeductionType.nameAr}
                  onChange={(e) => setNewDeductionType({
                    ...newDeductionType, 
                    [language === 'ar' ? 'nameEn' : 'nameAr']: e.target.value
                  })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowAddDeductionType(false);
                    setNewDeductionType({ nameAr: '', nameEn: '' });
                  }}
                >
                  {t('demo.employeeForm.customTypes.cancel')}
                </Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    const primaryName = language === 'ar' ? newDeductionType.nameAr : newDeductionType.nameEn;
                    if (primaryName.trim()) {
                      const newType = {
                        nameAr: newDeductionType.nameAr || primaryName,
                        nameEn: newDeductionType.nameEn || primaryName
                      };
                      
                      setCustomDeductionTypes([...customDeductionTypes, newType]);
                      
                      alert(language === 'ar' ? 
                        `تم إضافة نوع الخصم "${newType.nameAr}" بنجاح! (عرض توضيحي)` : 
                        `Deduction type "${newType.nameEn}" added successfully! (Demo)`
                      );
                      
                      setShowAddDeductionType(false);
                      setNewDeductionType({ nameAr: '', nameEn: '' });
                    }
                  }}
                  disabled={!(language === 'ar' ? newDeductionType.nameAr.trim() : newDeductionType.nameEn.trim())}
                >
                  {t('demo.employeeForm.customTypes.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditEmployeeModal && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex justify-between items-center">
                {language === 'ar' ? `تحرير بيانات الموظف: ${editingEmployee.name}` : `Edit Employee: ${editingEmployee.name}`}
                <Button variant="ghost" onClick={() => {
                  setIsEditEmployeeModal(false);
                  setEditingEmployee(null);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            
            {/* Tabs Navigation */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {['basic', 'job', 'financial', 'documents', 'transfers'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                      activeTab === tab 
                        ? 'border-[#28376B] text-[#28376B]' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t(`demo.employeeForm.tabs.${tab}`)}
                  </button>
                ))}
              </div>
            </div>

            <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Basic Information Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.fullName')} *</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.basic.fullName')} 
                        value={employeeForm.fullName}
                        onChange={(e) => setEmployeeForm({...employeeForm, fullName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.email')} *</label>
                      <input 
                        type="email"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="example@company.com" 
                        value={employeeForm.email}
                        onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.basic.phone')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="+20 1xxxxxxxxx" 
                        value={employeeForm.phone}
                        onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.position')} *</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.job.position')} 
                        value={employeeForm.position}
                        onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.department')} *</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.department}
                        onChange={(e) => setEmployeeForm({...employeeForm, department: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.job.department')}</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {language === 'ar' ? dept.nameAr : dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.baseSalary')}</label>
                      <input 
                        type="number"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="0" 
                        value={employeeForm.baseSalary}
                        onChange={(e) => setEmployeeForm({...employeeForm, baseSalary: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                      {language === 'ar' ? 'معلومات الموظف الحالية' : 'Current Employee Information'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-700">
                      <div><strong>{language === 'ar' ? 'الحالة:' : 'Status:'}</strong> {editingEmployee.status}</div>
                      <div><strong>{language === 'ar' ? 'تاريخ الانضمام:' : 'Join Date:'}</strong> {editingEmployee.joinDate}</div>
                      <div><strong>{language === 'ar' ? 'الراتب الحالي:' : 'Current Salary:'}</strong> {editingEmployee.salary?.toLocaleString()} {t('demo.currency')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Job Details Tab */}
              {activeTab === 'job' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.job.jobDetails')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.position')} *</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.job.position')} 
                        value={employeeForm.position}
                        onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.department')} *</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 border rounded px-3 py-2 mt-1"
                          value={employeeForm.department}
                          onChange={(e) => setEmployeeForm({...employeeForm, department: e.target.value})}
                        >
                          <option value="">{t('demo.employeeForm.job.department')}</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {language === 'ar' ? dept.nameAr : dept.name}
                            </option>
                          ))}
                        </select>
                        <Button 
                          type="button"
                          size="sm" 
                          variant="outline"
                          className="mt-1 px-3"
                          onClick={() => setShowAddDepartmentModal(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.directManager')}</label>
                      <select className="w-full border rounded px-3 py-2 mt-1">
                        <option value="">{t('demo.employeeForm.job.directManager')}</option>
                        <option value="ahmed">Ahmed Hassan</option>
                        <option value="fatima">Fatima Al-Zahra</option>
                        <option value="omar">Omar Rashid</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.startDate')} *</label>
                      <input 
                        type="date"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        value={employeeForm.startDate}
                        onChange={(e) => setEmployeeForm({...employeeForm, startDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.employmentType')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.employmentType}
                        onChange={(e) => setEmployeeForm({...employeeForm, employmentType: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.job.employmentType')}</option>
                        <option value="fullTime">{t('demo.employeeForm.job.fullTime')}</option>
                        <option value="partTime">{t('demo.employeeForm.job.partTime')}</option>
                        <option value="contract">{t('demo.employeeForm.job.contract')}</option>
                        <option value="internship">{t('demo.employeeForm.job.internship')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.job.workLocation')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.job.workLocation')} 
                        value={employeeForm.workLocation}
                        onChange={(e) => setEmployeeForm({...employeeForm, workLocation: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Tab */}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.financial.salaryInfo')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.baseSalary')} *</label>
                      <input 
                        type="number"
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder="0" 
                        value={employeeForm.baseSalary}
                        onChange={(e) => setEmployeeForm({...employeeForm, baseSalary: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.payrollMethod')}</label>
                      <select 
                        className="w-full border rounded px-3 py-2 mt-1"
                        value={employeeForm.payrollMethod}
                        onChange={(e) => setEmployeeForm({...employeeForm, payrollMethod: e.target.value})}
                      >
                        <option value="">{t('demo.employeeForm.financial.payrollMethod')}</option>
                        <option value="cash">{t('demo.employeeForm.financial.cash')}</option>
                        <option value="bank">{t('demo.employeeForm.financial.bank')}</option>
                      </select>
                    </div>
                  </div>

                  {employeeForm.payrollMethod === 'bank' && (
                    <div>
                      <label className="text-sm font-medium">{t('demo.employeeForm.financial.bankAccount')}</label>
                      <input 
                        className="w-full border rounded px-3 py-2 mt-1" 
                        placeholder={t('demo.employeeForm.financial.bankAccount')} 
                        value={employeeForm.bankAccount}
                        onChange={(e) => setEmployeeForm({...employeeForm, bankAccount: e.target.value})}
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{t('demo.employeeForm.financial.allowances')}</h4>
                      <Button 
                        size="sm" 
                        onClick={() => setEmployeeForm({
                          ...employeeForm, 
                          allowances: [...(employeeForm.allowances || []), { type: '', amount: '' }]
                        })}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('demo.employeeForm.actions.addAllowance')}
                      </Button>
                    </div>
                    
                    {(employeeForm.allowances || []).map((allowance, index) => (
                      <div key={index} className="flex gap-3 mb-3">
                        <div className="flex-1 flex gap-2">
                          <select 
                            className="flex-1 border rounded px-3 py-2"
                            value={allowance.type}
                            onChange={(e) => {
                              const newAllowances = [...(employeeForm.allowances || [])];
                              newAllowances[index].type = e.target.value;
                              if (e.target.value === 'custom') {
                                newAllowances[index].customName = '';
                              }
                              setEmployeeForm({...employeeForm, allowances: newAllowances});
                            }}
                          >
                            <option value="">{t('demo.employeeForm.financial.allowanceType')}</option>
                            <option value="transportation">{t('demo.employeeForm.financial.transportation')}</option>
                            <option value="housing">{t('demo.employeeForm.financial.housing')}</option>
                            <option value="food">{t('demo.employeeForm.financial.food')}</option>
                            <option value="communication">{t('demo.employeeForm.financial.communication')}</option>
                            <option value="other">{t('demo.employeeForm.financial.other')}</option>
                            {customAllowanceTypes.map((customType, customIndex) => (
                              <option key={customIndex} value={`custom_${customIndex}`}>
                                {language === 'ar' ? customType.nameAr : customType.nameEn}
                              </option>
                            ))}
                            <option value="custom">{t('demo.employeeForm.customTypes.custom')}</option>
                          </select>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowAddAllowanceType(true)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {allowance.type === 'custom' && (
                          <input 
                            type="text"
                            className="flex-1 border rounded px-3 py-2"
                            placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                            value={allowance.customName || ''}
                            onChange={(e) => {
                              const newAllowances = [...(employeeForm.allowances || [])];
                              newAllowances[index].customName = e.target.value;
                              setEmployeeForm({...employeeForm, allowances: newAllowances});
                            }}
                          />
                        )}
                        <input 
                          type="number"
                          className="flex-1 border rounded px-3 py-2"
                          placeholder={t('demo.employeeForm.financial.allowanceAmount')}
                          value={allowance.amount}
                          onChange={(e) => {
                            const newAllowances = [...(employeeForm.allowances || [])];
                            newAllowances[index].amount = e.target.value;
                            setEmployeeForm({...employeeForm, allowances: newAllowances});
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const newAllowances = (employeeForm.allowances || []).filter((_, i) => i !== index);
                            setEmployeeForm({...employeeForm, allowances: newAllowances});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{t('demo.employeeForm.financial.deductions')}</h4>
                      <Button 
                        size="sm" 
                        onClick={() => setEmployeeForm({
                          ...employeeForm, 
                          deductions: [...(employeeForm.deductions || []), { type: '', amount: '' }]
                        })}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('demo.employeeForm.actions.addDeduction')}
                      </Button>
                    </div>
                    
                    {(employeeForm.deductions || []).map((deduction, index) => (
                      <div key={index} className="flex gap-3 mb-3">
                        <div className="flex-1 flex gap-2">
                          <select 
                            className="flex-1 border rounded px-3 py-2"
                            value={deduction.type}
                            onChange={(e) => {
                              const newDeductions = [...(employeeForm.deductions || [])];
                              newDeductions[index].type = e.target.value;
                              if (e.target.value === 'custom') {
                                newDeductions[index].customName = '';
                              }
                              setEmployeeForm({...employeeForm, deductions: newDeductions});
                            }}
                          >
                            <option value="">{t('demo.employeeForm.financial.deductionType')}</option>
                            <option value="insurance">{t('demo.employeeForm.financial.insurance')}</option>
                            <option value="tax">{t('demo.employeeForm.financial.tax')}</option>
                            <option value="loan">{t('demo.employeeForm.financial.loan')}</option>
                            <option value="other">{t('demo.employeeForm.financial.other')}</option>
                            {customDeductionTypes.map((customType, customIndex) => (
                              <option key={customIndex} value={`custom_${customIndex}`}>
                                {language === 'ar' ? customType.nameAr : customType.nameEn}
                              </option>
                            ))}
                            <option value="custom">{t('demo.employeeForm.customTypes.custom')}</option>
                          </select>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowAddDeductionType(true)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {deduction.type === 'custom' && (
                          <input 
                            type="text"
                            className="flex-1 border rounded px-3 py-2"
                            placeholder={t('demo.employeeForm.customTypes.namePlaceholder')}
                            value={deduction.customName || ''}
                            onChange={(e) => {
                              const newDeductions = [...(employeeForm.deductions || [])];
                              newDeductions[index].customName = e.target.value;
                              setEmployeeForm({...employeeForm, deductions: newDeductions});
                            }}
                          />
                        )}
                        <input 
                          type="number"
                          className="flex-1 border rounded px-3 py-2"
                          placeholder={t('demo.employeeForm.financial.deductionAmount')}
                          value={deduction.amount}
                          onChange={(e) => {
                            const newDeductions = [...(employeeForm.deductions || [])];
                            newDeductions[index].amount = e.target.value;
                            setEmployeeForm({...employeeForm, deductions: newDeductions});
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const newDeductions = (employeeForm.deductions || []).filter((_, i) => i !== index);
                            setEmployeeForm({...employeeForm, deductions: newDeductions});
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">{t('demo.employeeForm.documents.documentsFiles')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.profileImage')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.profileImage ? (
                            <div className="space-y-2">
                              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                              </div>
                              <p className="text-sm text-green-600 font-medium">{employeeForm.profileImage.name}</p>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEmployeeForm({...employeeForm, profileImage: null})}
                              >
                                {language === 'ar' ? 'إزالة الصورة' : 'Remove Image'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                                <Users className="h-8 w-8 text-gray-400" />
                              </div>
                              <input 
                                type="file" 
                                id="editProfileImage" 
                                accept="image/*" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setEmployeeForm({...employeeForm, profileImage: file});
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editProfileImage').click()}
                              >
                                {t('demo.employeeForm.documents.uploadImage')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">JPG, PNG - {t('demo.employeeForm.documents.maxSize')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.cv')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.cv ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                              <p className="text-sm text-green-600 font-medium">{employeeForm.cv.name}</p>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEmployeeForm({...employeeForm, cv: null})}
                              >
                                {language === 'ar' ? 'إزالة السيرة الذاتية' : 'Remove CV'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <input 
                                type="file" 
                                id="editCvFile" 
                                accept=".pdf,.doc,.docx" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setEmployeeForm({...employeeForm, cv: file});
                                  }
                                }}
                              />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editCvFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadCV')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.contracts')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.contracts && employeeForm.contracts.length > 0 ? (
                            <div className="space-y-2">
                              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                              <div className="space-y-1">
                                {employeeForm.contracts.map((contract, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span className="text-green-600">{contract.name}</span>
                                    <Button 
                                      size="xs" 
                                      variant="ghost"
                                      onClick={() => {
                                        const newContracts = employeeForm.contracts.filter((_, i) => i !== index);
                                        setEmployeeForm({...employeeForm, contracts: newContracts});
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editContractFile').click()}
                              >
                                {language === 'ar' ? 'إضافة عقد آخر' : 'Add Another Contract'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editContractFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadContract')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="editContractFile" 
                            accept=".pdf,.doc,.docx" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const newContracts = [...(employeeForm.contracts || []), file];
                                setEmployeeForm({...employeeForm, contracts: newContracts});
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">{t('demo.employeeForm.documents.certificates')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#28376B] transition-colors cursor-pointer">
                          {employeeForm.certificates && employeeForm.certificates.length > 0 ? (
                            <div className="space-y-2">
                              <Award className="h-8 w-8 text-green-600 mx-auto" />
                              <div className="space-y-1">
                                {employeeForm.certificates.map((certificate, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span className="text-green-600">{certificate.name}</span>
                                    <Button 
                                      size="xs" 
                                      variant="ghost"
                                      onClick={() => {
                                        const newCertificates = employeeForm.certificates.filter((_, i) => i !== index);
                                        setEmployeeForm({...employeeForm, certificates: newCertificates});
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editCertificateFile').click()}
                              >
                                {language === 'ar' ? 'إضافة شهادة أخرى' : 'Add Another Certificate'}
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <Award className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => document.getElementById('editCertificateFile').click()}
                              >
                                {t('demo.employeeForm.documents.uploadCertificate')}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2">{t('demo.employeeForm.documents.supportedFormats')}</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="editCertificateFile" 
                            accept=".pdf,.doc,.docx,.jpg,.png" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const newCertificates = [...(employeeForm.certificates || []), file];
                                setEmployeeForm({...employeeForm, certificates: newCertificates});
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfers Tab */}
              {activeTab === 'transfers' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{t('demo.employeeForm.transfers.transferHistory')}</h3>
                    <Button 
                      size="sm" 
                      onClick={() => setEmployeeForm({
                        ...employeeForm, 
                        transfers: [...(employeeForm.transfers || []), { 
                          fromDepartment: '', 
                          toDepartment: '', 
                          date: '', 
                          reason: '', 
                          notes: '' 
                        }]
                      })}
                      className="bg-[#28376B]"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('demo.employeeForm.transfers.addTransfer')}
                    </Button>
                  </div>

                  {(!employeeForm.transfers || employeeForm.transfers.length === 0) ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>{language === 'ar' ? 'لا يوجد انتقالات بعد' : 'No transfers yet'}</p>
                    </div>
                  ) : (
                    (employeeForm.transfers || []).map((transfer, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.fromDepartment')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.fromDepartment}
                              onChange={(e) => {
                                const newTransfers = [...(employeeForm.transfers || [])];
                                newTransfers[index].fromDepartment = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">Select Department</option>
                              <option value="IT">IT</option>
                              <option value="HR">HR</option>
                              <option value="Finance">Finance</option>
                              <option value="Operations">Operations</option>
                              <option value="Sales">Sales</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.toDepartment')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.toDepartment}
                              onChange={(e) => {
                                const newTransfers = [...(employeeForm.transfers || [])];
                                newTransfers[index].toDepartment = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">Select Department</option>
                              <option value="IT">IT</option>
                              <option value="HR">HR</option>
                              <option value="Finance">Finance</option>
                              <option value="Operations">Operations</option>
                              <option value="Sales">Sales</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.transferDate')}</label>
                            <input 
                              type="date"
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.date}
                              onChange={(e) => {
                                const newTransfers = [...(employeeForm.transfers || [])];
                                newTransfers[index].date = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.reason')}</label>
                            <select 
                              className="w-full border rounded px-3 py-2 mt-1"
                              value={transfer.reason}
                              onChange={(e) => {
                                const newTransfers = [...(employeeForm.transfers || [])];
                                newTransfers[index].reason = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <option value="">{t('demo.employeeForm.transfers.reason')}</option>
                              <option value="promotion">{t('demo.employeeForm.transfers.promotion')}</option>
                              <option value="departmentChange">{t('demo.employeeForm.transfers.departmentChange')}</option>
                              <option value="locationChange">{t('demo.employeeForm.transfers.locationChange')}</option>
                              <option value="restructuring">{t('demo.employeeForm.transfers.restructuring')}</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium">{t('demo.employeeForm.transfers.notes')}</label>
                            <textarea 
                              className="w-full border rounded px-3 py-2 mt-1 h-20"
                              placeholder={t('demo.employeeForm.transfers.notes')}
                              value={transfer.notes}
                              onChange={(e) => {
                                const newTransfers = [...(employeeForm.transfers || [])];
                                newTransfers[index].notes = e.target.value;
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            />
                          </div>
                          <div className="md:col-span-2 flex justify-end">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                const newTransfers = (employeeForm.transfers || []).filter((_, i) => i !== index);
                                setEmployeeForm({...employeeForm, transfers: newTransfers});
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {language === 'ar' ? 'حذف' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>

            {/* Modal Footer */}
            <div className="border-t p-6">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {activeTab !== 'basic' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const tabs = ['basic', 'job', 'financial', 'documents', 'transfers'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                      }}
                    >
                      {t('demo.employeeForm.actions.previous')}
                    </Button>
                  )}
                  {activeTab !== 'transfers' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const tabs = ['basic', 'job', 'financial', 'documents', 'transfers'];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                      }}
                    >
                      {t('demo.employeeForm.actions.next')}
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditEmployeeModal(false);
                      setEditingEmployee(null);
                    }}
                  >
                    {t('demo.employeeForm.actions.cancel')}
                  </Button>
                  <Button 
                    className="bg-[#28376B]"
                    onClick={() => {
                      alert(language === 'ar' ? 
                        `تم تحديث بيانات الموظف "${editingEmployee.name}" بنجاح! (عرض توضيحي)` : 
                        `Employee "${editingEmployee.name}" updated successfully! (Demo)`
                      );
                      setIsEditEmployeeModal(false);
                      setEditingEmployee(null);
                      setActiveTab('basic');
                    }}
                  >
                    {language === 'ar' ? 'حفظ التحديثات' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddTransactionModal && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {t('demo.employeeForm.newTransaction.title')}
                <Button variant="ghost" onClick={() => setIsAddTransactionModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.newTransaction.description')} *</label>
                <input 
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder={language === 'ar' ? 'وصف المعاملة' : 'Transaction description'}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.newTransaction.type')} *</label>
                <select 
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                >
                  <option value="expense">{t('demo.employeeForm.newTransaction.expense')}</option>
                  <option value="income">{t('demo.employeeForm.newTransaction.income')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.newTransaction.category')} *</label>
                <select 
                  className="w-full border rounded px-3 py-2 mt-1"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                >
                  <option value="">{t('demo.employeeForm.newTransaction.category')}</option>
                  <option value="salary">{t('demo.employeeForm.newTransaction.categories.salary')}</option>
                  <option value="rent">{t('demo.employeeForm.newTransaction.categories.rent')}</option>
                  <option value="utilities">{t('demo.employeeForm.newTransaction.categories.utilities')}</option>
                  <option value="supplies">{t('demo.employeeForm.newTransaction.categories.supplies')}</option>
                  <option value="marketing">{t('demo.employeeForm.newTransaction.categories.marketing')}</option>
                  <option value="maintenance">{t('demo.employeeForm.newTransaction.categories.maintenance')}</option>
                  <option value="sales">{t('demo.employeeForm.newTransaction.categories.sales')}</option>
                  <option value="other">{t('demo.employeeForm.newTransaction.categories.other')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.newTransaction.amount')} *</label>
                <input 
                  type="number"
                  className="w-full border rounded px-3 py-2 mt-1" 
                  placeholder="0"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t('demo.employeeForm.newTransaction.date')} *</label>
                <input 
                  type="date"
                  className="w-full border rounded px-3 py-2 mt-1" 
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsAddTransactionModal(false);
                    setNewTransaction({
                      description: '',
                      category: '',
                      amount: '',
                      type: 'expense',
                      date: new Date().toISOString().split('T')[0]
                    });
                  }}
                >
                  {t('demo.employeeForm.newTransaction.cancel')}
                </Button>
                <Button 
                  className="flex-1 bg-[#28376B]"
                  onClick={() => {
                    if (newTransaction.description.trim() && newTransaction.category && newTransaction.amount) {
                      alert(language === 'ar' ? 
                        `تم إضافة المعاملة "${newTransaction.description}" بمبلغ ${newTransaction.amount} ${t('demo.currency')} بنجاح! (عرض توضيحي)` : 
                        `Transaction "${newTransaction.description}" of ${newTransaction.amount} ${t('demo.currency')} added successfully! (Demo)`
                      );
                      
                      setIsAddTransactionModal(false);
                      setNewTransaction({
                        description: '',
                        category: '',
                        amount: '',
                        type: 'expense',
                        date: new Date().toISOString().split('T')[0]
                      });
                    } else {
                      alert(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
                    }
                  }}
                  disabled={!newTransaction.description.trim() || !newTransaction.category || !newTransaction.amount}
                >
                  {t('demo.employeeForm.newTransaction.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DemoPage;