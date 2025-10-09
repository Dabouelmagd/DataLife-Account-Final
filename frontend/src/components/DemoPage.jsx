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
  Search, Filter, Download, Plus, Edit, Trash2, MapPin, Phone, Mail
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import { demoData } from '../data/demoData';

const DemoPage = ({ onClose }) => {
  const { language, isRTL } = useLanguage();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isGuidedTour, setIsGuidedTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  
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
            <Button variant="outline" className="h-16 flex flex-col items-center justify-center">
              <Users className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.addEmployee')}</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col items-center justify-center">
              <Calculator className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.newTransaction')}</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col items-center justify-center">
              <FileText className="h-5 w-5 mb-1" />
              <span className="text-xs">{t('demo.quickActions.generateReport')}</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col items-center justify-center">
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
            <Button size="sm" className="bg-[#28376B]">
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
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
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
    </div>
  );
};

export default DemoPage;