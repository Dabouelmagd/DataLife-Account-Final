import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Users, DollarSign, FileText, Calendar, TrendingUp, Building2,
  ArrowUp, ArrowDown, AlertCircle, Clock, Target, Wallet,
  BarChart3, PieChart, Activity, Zap, CheckCircle, Package,
  ChevronRight, ShoppingCart, FolderKanban, Scale
} from 'lucide-react';
import { 
  UsersThree, ChartLineUp, Money, CalendarCheck, 
  TrendUp, Receipt, Cube, ClipboardText, Lightning
} from '@phosphor-icons/react';
import DashboardCharts from './DashboardCharts';
import HRAlerts from './HRAlerts';

const DashboardContent = ({ language, stats, employees, onNavigate }) => {
  const isRTL = language === 'ar';
  
  // Module color themes matching sidebar
  const moduleColors = {
    hr: {
      gradient: 'from-cyan-500 to-cyan-600',
      bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      border: 'border-cyan-500/30',
      text: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-500',
      light: 'bg-cyan-50 dark:bg-cyan-950/50'
    },
    financial: {
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500',
      light: 'bg-emerald-50 dark:bg-emerald-950/50'
    },
    invoices: {
      gradient: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500',
      light: 'bg-amber-50 dark:bg-amber-950/50'
    },
    projects: {
      gradient: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      border: 'border-indigo-500/30',
      text: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-500',
      light: 'bg-indigo-50 dark:bg-indigo-950/50'
    },
    inventory: {
      gradient: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-500/10 dark:bg-teal-500/20',
      border: 'border-teal-500/30',
      text: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-500',
      light: 'bg-teal-50 dark:bg-teal-950/50'
    }
  };

  // Stats cards with matching sidebar colors
  const statsCards = [
    {
      id: 'employees',
      title: language === 'ar' ? 'الموظفين' : 'Employees',
      value: stats.totalEmployees,
      change: '+12%',
      trend: 'up',
      icon: UsersThree,
      color: moduleColors.hr,
      module: 'hr'
    },
    {
      id: 'revenue',
      title: language === 'ar' ? 'إيرادات الشهر' : 'Monthly Revenue',
      value: `${stats.monthlyRevenue?.toLocaleString() || 0}`,
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      trend: stats.monthlyRevenue > 0 ? 'up' : 'neutral',
      icon: ChartLineUp,
      color: moduleColors.financial,
      module: 'financial'
    },
    {
      id: 'expenses',
      title: language === 'ar' ? 'مصروفات الشهر' : 'Monthly Expenses',
      value: `${stats.monthlyExpenses?.toLocaleString() || 0}`,
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      trend: stats.monthlyExpenses > 0 ? 'down' : 'neutral',
      icon: Receipt,
      color: '#ef4444',
      module: 'financial'
    },
    {
      id: 'invoices',
      title: language === 'ar' ? 'الفواتير' : 'Invoices',
      value: stats.invoiceCount || 0,
      trend: 'up',
      icon: Receipt,
      color: moduleColors.invoices,
      module: 'invoices'
    },
    {
      id: 'inventory',
      title: language === 'ar' ? 'أصناف المخزون' : 'Inventory Items',
      value: stats.inventoryCount || 0,
      trend: stats.lowStockCount > 0 ? 'down' : 'up',
      icon: Cube,
      color: moduleColors.inventory,
      module: 'inventory'
    }
  ];

  // Quick actions — all main entry points
  const quickActions = [
    { title: language === 'ar' ? 'إضافة موظف' : 'Add Employee',    icon: Users,        color: moduleColors.hr,        action: () => onNavigate?.('hr', 'employees') },
    { title: language === 'ar' ? 'قيد جديد' : 'New Journal Entry', icon: FileText,     color: moduleColors.financial,  action: () => onNavigate?.('financial', 'journal-entries') },
    { title: language === 'ar' ? 'فاتورة جديدة' : 'New Invoice',   icon: Receipt,      color: moduleColors.invoices,   action: () => onNavigate?.('invoices', 'invoices') },
    { title: language === 'ar' ? 'مشروع جديد' : 'New Project',     icon: FolderKanban, color: moduleColors.projects,   action: () => onNavigate?.('projects') },
    { title: language === 'ar' ? 'عميل جديد' : 'New Customer',     icon: Users,        color: moduleColors.hr,        action: () => onNavigate?.('sales') },
    { title: language === 'ar' ? 'التحليلات' : 'Analytics',         icon: BarChart3,    color: moduleColors.financial,  action: () => onNavigate?.('analytics') },
  ];

  // Recent activities — real data from stats
  const recentActivities = [
    {
      title: language === 'ar' ? `${stats.totalEmployees} موظف في النظام` : `${stats.totalEmployees} employees`,
      time: language === 'ar' ? 'HR' : 'HR',
      type: 'hr',
      icon: Users
    },
    {
      title: language === 'ar' 
        ? `الإيرادات: ${stats.monthlyRevenue?.toLocaleString() || 0} ج.م` 
        : `Revenue: ${stats.monthlyRevenue?.toLocaleString() || 0} EGP`,
      time: language === 'ar' ? 'هذا الشهر' : 'This month',
      type: 'financial',
      icon: DollarSign
    },
    {
      title: language === 'ar' 
        ? `المصروفات: ${stats.monthlyExpenses?.toLocaleString() || 0} ج.م` 
        : `Expenses: ${stats.monthlyExpenses?.toLocaleString() || 0} EGP`,
      time: language === 'ar' ? 'هذا الشهر' : 'This month',
      type: 'financial',
      icon: DollarSign
    },
    {
      title: language === 'ar' ? `${stats.activeProjects} مشاريع نشطة` : `${stats.activeProjects} active projects`,
      time: language === 'ar' ? 'المشاريع' : 'Projects',
      type: 'projects',
      icon: Building2
    },
    {
      title: language === 'ar' ? `${stats.totalCustomers} عميل | ${stats.totalSuppliers} مورد` : `${stats.totalCustomers} customers | ${stats.totalSuppliers} suppliers`,
      time: language === 'ar' ? 'المالية' : 'Financial',
      type: 'financial',
      icon: Package
    },
    {
      title: language === 'ar' ? `${stats.invoiceCount} فاتورة` : `${stats.invoiceCount} invoices`,
      time: language === 'ar' ? 'الفواتير' : 'Invoices',
      type: 'invoices',
      icon: Package
    },
  ];

  // Upcoming tasks — dynamic based on real data
  const upcomingTasks = [
    ...(stats.pendingApprovals > 0 ? [{
      title: language === 'ar' ? `${stats.pendingApprovals} طلب موافقة معلق` : `${stats.pendingApprovals} pending approvals`,
      dueDate: language === 'ar' ? 'عاجل' : 'Urgent',
      priority: 'high',
      progress: 0
    }] : []),
    ...(stats.lowStockCount > 0 ? [{
      title: language === 'ar' ? `${stats.lowStockCount} صنف مخزون منخفض` : `${stats.lowStockCount} low stock items`,
      dueDate: language === 'ar' ? 'تنبيه' : 'Alert',
      priority: 'medium',
      progress: 0
    }] : []),
    {
      title: language === 'ar' ? 'مراجعة التقارير الشهرية' : 'Review monthly reports',
      dueDate: language === 'ar' ? 'نهاية الشهر' : 'End of month',
      priority: 'medium',
      progress: 50
    },
    {
      title: language === 'ar' ? 'تحديث بيانات الموظفين' : 'Update employee data',
      dueDate: language === 'ar' ? 'أسبوعياً' : 'Weekly',
      priority: 'low',
      progress: 70
    }
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'hr': return moduleColors.hr;
      case 'financial': return moduleColors.financial;
      case 'invoices': return moduleColors.invoices;
      default: return moduleColors.projects;
    }
  };

  return (
    <div className="space-y-6 pb-6" data-testid="dashboard-content">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'مرحباً بك في لوحة التحكم' : 'Welcome to Dashboard'}
              </h1>
              <p className="text-slate-300 text-sm">
                {language === 'ar' 
                  ? 'نظرة عامة على أداء الأعمال والإحصائيات الرئيسية'
                  : 'Overview of business performance and key statistics'
                }
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
              <CalendarCheck weight="duotone" className="w-5 h-5 text-cyan-400" />
              <span className="text-sm">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.id}
              className={`group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer ${card.color.light}`}
              onClick={() => onNavigate?.(card.module)}
              data-testid={`stat-card-${card.id}`}
            >
              {/* Gradient accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color.gradient}`}></div>
              
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {card.title}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {card.value}
                      </span>
                      {card.suffix && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {card.suffix}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {card.trend === 'up' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${card.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {card.change}
                      </span>
                      <span className="text-xs text-slate-400">
                        {language === 'ar' ? 'هذا الشهر' : 'this month'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.color.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon weight="fill" className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <Lightning weight="fill" className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.action}
                  className={`group relative p-4 rounded-xl ${action.color.light} border ${action.color.border} hover:border-opacity-60 transition-all duration-300 hover:shadow-md`}
                  data-testid={`quick-action-${index}`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${action.color.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className={`text-sm font-medium ${action.color.text}`}>
                      {action.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                {language === 'ar' ? 'عرض الكل' : 'View All'}
                <ChevronRight className="w-4 h-4 ms-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => {
                const color = getActivityColor(activity.type);
                const Icon = activity.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-3 rounded-xl ${color.light} transition-colors duration-200`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${color.iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activity.time}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${color.text} ${color.border} border text-xs`}
                    >
                      {activity.type === 'hr' 
                        ? (language === 'ar' ? 'موارد بشرية' : 'HR')
                        : (language === 'ar' ? 'مالية' : 'Financial')
                      }
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* HR Alerts & Upcoming Tasks Column */}
        <div className="space-y-6">
          {/* HR Alerts */}
          <HRAlerts language={language} onNavigate={onNavigate} />
          
          {/* Upcoming Tasks */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'المهام القادمة' : 'Upcoming Tasks'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingTasks.map((task, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {task.title}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {task.dueDate}
                      </span>
                    </div>
                    <Progress value={task.progress} className="h-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Module Navigation Cards — All Modules */}
      <div>
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-3">
          {language === 'ar' ? '🗂️ وحدات النظام' : '🗂️ System Modules'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[
            { id:'hr',        label_ar:'الموارد البشرية',       label_en:'Human Resources',     icon:<UsersThree weight="fill" className="w-6 h-6 text-white"/>,  color:moduleColors.hr,        nav:['hr','hr-overview'],          desc_ar:'موظفون · رواتب · حضور',         desc_en:'Employees · Payroll · HR' },
            { id:'financial', label_ar:'الإدارة المالية',        label_en:'Financial',           icon:<Money weight="fill" className="w-6 h-6 text-white"/>,      color:moduleColors.financial,  nav:['financial','journal-entries'],desc_ar:'محاسبة · قيود · تقارير',        desc_en:'Accounting · Ledger' },
            { id:'sales',     label_ar:'المبيعات CRM',           label_en:'Sales & CRM',         icon:<TrendingUp className="w-6 h-6 text-white"/>,               color:moduleColors.projects,   nav:['sales'],                      desc_ar:'عملاء · عروض · فواتير',          desc_en:'Customers · Quotations' },
            { id:'invoices',  label_ar:'الفواتير الإلكترونية',   label_en:'E-Invoicing',         icon:<Receipt weight="fill" className="w-6 h-6 text-white"/>,    color:moduleColors.invoices,   nav:['invoices','invoices'],        desc_ar:'ETA · ضرائب · فواتير',           desc_en:'ETA · Taxes · Invoices' },
            { id:'purchases', label_ar:'المشتريات',              label_en:'Purchases',           icon:<ShoppingCart className="w-6 h-6 text-white"/>,             color:moduleColors.inventory,  nav:['purchases'],                  desc_ar:'موردون · أوامر شراء',            desc_en:'Suppliers · Orders' },
            { id:'projects',  label_ar:'المشاريع والمهام',        label_en:'Projects',            icon:<FolderKanban className="w-6 h-6 text-white"/>,             color:moduleColors.projects,   nav:['projects'],                   desc_ar:'مشاريع · مهام · تقدم',           desc_en:'Projects · Tasks · Progress' },
            { id:'assets',    label_ar:'الأصول الثابتة',          label_en:'Fixed Assets',        icon:<Building2 className="w-6 h-6 text-white"/>,                color:moduleColors.financial,  nav:['assets'],                     desc_ar:'أصول · إهلاك · تقييم',           desc_en:'Assets · Depreciation' },
            { id:'taxes',     label_ar:'الضرائب',                label_en:'Taxes',               icon:<Scale className="w-6 h-6 text-white"/>,                    color:moduleColors.invoices,   nav:['taxes'],                      desc_ar:'ضريبة قيمة مضافة · استقطاعات',  desc_en:'VAT · Withholding' },
            { id:'analytics', label_ar:'التقارير والتحليلات',     label_en:'Analytics',           icon:<BarChart3 className="w-6 h-6 text-white"/>,                color:moduleColors.hr,         nav:['analytics'],                  desc_ar:'15 تقرير شامل',                   desc_en:'15 comprehensive reports' },
            { id:'approvals', label_ar:'الموافقات',              label_en:'Approvals',           icon:<CheckCircle className="w-6 h-6 text-white"/>,              color:moduleColors.projects,   nav:['approvals'],                  desc_ar:'طلبات · موافقة · رفض',           desc_en:'Requests · Approve · Reject' },
          ].map((mod) => (
            <Card
              key={mod.id}
              className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              onClick={() => onNavigate?.(mod.nav[0], mod.nav[1])}
              data-testid={`module-card-${mod.id}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl ${mod.color.iconBg} flex items-center justify-center flex-shrink-0`}>
                    {mod.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {language === 'ar' ? mod.label_ar : mod.label_en}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {language === 'ar' ? mod.desc_ar : mod.desc_en}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <ChevronRight className={`w-4 h-4 ${mod.color.text} group-hover:translate-x-1 transition-transform`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts language={language} stats={stats} />
    </div>
  );
};

export default DashboardContent;
