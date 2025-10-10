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
  Search, Filter, Download, Plus, Edit, Trash2, MapPin, Phone, Mail, Award, ArrowRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import { demoData } from '../data/demoData';

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
    { id: 'hr', name: t('demo.modules.hr'), icon: <Users className="h-5 w-5" /> },
    { id: 'financial', name: t('demo.modules.financial'), icon: <Calculator className="h-5 w-5" /> },
    { id: 'inventory', name: t('demo.modules.inventory'), icon: <PieChart className="h-5 w-5" /> },
    { id: 'reports', name: t('demo.modules.reports'), icon: <FileText className="h-5 w-5" /> },
    { id: 'analytics', name: t('demo.modules.analytics'), icon: <BarChart3 className="h-5 w-5" /> }
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

  const renderFinancialModule = () => (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {demoData.financial.overview.map((item, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{item.label}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className={`text-sm ${item.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {item.change}
                  </p>
                </div>
                <item.icon className={`h-8 w-8 ${item.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('demo.financial.recentTransactions')}</CardTitle>
            <Button size="sm" className="bg-[#28376B]">
              <Plus className="h-4 w-4 mr-2" />
              {t('demo.financial.newTransaction')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('demo.financial.date')}</TableHead>
                <TableHead>{t('demo.financial.description')}</TableHead>
                <TableHead>{t('demo.financial.category')}</TableHead>
                <TableHead>{t('demo.financial.amount')}</TableHead>
                <TableHead>{t('demo.financial.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoData.financial.transactions.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{transaction.category}</Badge>
                  </TableCell>
                  <TableCell className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toLocaleString()} {t('demo.currency')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={transaction.status === 'Completed' ? 'success' : 'warning'}>
                      {transaction.status}
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

  const renderReportsModule = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('demo.reports.financialSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-4">{t('demo.reports.monthlyRevenue')}</h4>
              <div className="space-y-2">
                {demoData.reports.monthlyRevenue.map((month, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{month.month}</span>
                    <span className="font-medium">{month.revenue.toLocaleString()} {t('demo.currency')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('demo.reports.expenses')}</h4>
              <div className="space-y-2">
                {demoData.reports.expenses.map((expense, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{expense.category}</span>
                    <span className="font-medium text-red-600">{expense.amount.toLocaleString()} {t('demo.currency')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderModule = () => {
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
        <div className="w-64 bg-white h-screen shadow-sm">
          <div className="p-6">
            <div className="space-y-2">
              {modules.map((module) => (
                <Button
                  key={module.id}
                  variant={activeModule === module.id ? "default" : "ghost"}
                  className={`w-full justify-start ${activeModule === module.id ? 'bg-[#28376B]' : ''}`}
                  onClick={() => setActiveModule(module.id)}
                >
                  {module.icon}
                  <span className="ml-2">{module.name}</span>
                </Button>
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
    </div>
  );
};

export default DemoPage;