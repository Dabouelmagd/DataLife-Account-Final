import React from 'react';
import ExecutiveDashboard from './ExecutiveDashboard';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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

  const ar = language === 'ar';
  const n = (v) => (Number(v) || 0).toLocaleString('en-US');

  // العدّادات — counts only, no invented trend percentages
  const statsCards = [
    { id: 'employees', title: ar ? 'الموظفون' : 'Employees', value: n(stats.totalEmployees), icon: UsersThree, color: moduleColors.hr, module: 'hr' },
    { id: 'customers', title: ar ? 'العملاء' : 'Customers', value: n(stats.totalCustomers), icon: Users, color: moduleColors.projects, module: 'sales' },
    { id: 'suppliers', title: ar ? 'الموردون' : 'Suppliers', value: n(stats.totalSuppliers), icon: ShoppingCart, color: moduleColors.inventory, module: 'purchases' },
    { id: 'invoices', title: ar ? 'الفواتير' : 'Invoices', value: n(stats.invoiceCount), icon: Receipt, color: moduleColors.invoices, module: 'invoices', subModule: 'invoices' },
    { id: 'inventory', title: ar ? 'أصناف المخزون' : 'Inventory items', value: n(stats.inventoryCount), icon: Cube, color: moduleColors.inventory, module: 'financial', subModule: 'inventory',
      note: stats.lowStockCount > 0 ? (ar ? `${n(stats.lowStockCount)} قارب النفاد` : `${n(stats.lowStockCount)} low`) : null },
    { id: 'projects', title: ar ? 'مشاريع نشطة' : 'Active projects', value: n(stats.activeProjects), icon: FolderKanban, color: moduleColors.projects, module: 'projects' },
  ];

  // Quick actions — all main entry points
  const quickActions = [
    { title: ar ? 'إضافة موظف' : 'Add Employee',    icon: Users,        color: moduleColors.hr,        action: () => onNavigate?.('hr', 'employees') },
    { title: ar ? 'قيد جديد' : 'New Journal Entry', icon: FileText,     color: moduleColors.financial,  action: () => onNavigate?.('financial', 'journal-entries') },
    { title: ar ? 'فاتورة جديدة' : 'New Invoice',   icon: Receipt,      color: moduleColors.invoices,   action: () => onNavigate?.('invoices', 'invoices') },
    { title: ar ? 'مشروع جديد' : 'New Project',     icon: FolderKanban, color: moduleColors.projects,   action: () => onNavigate?.('projects') },
    { title: ar ? 'عميل جديد' : 'New Customer',     icon: Users,        color: moduleColors.hr,        action: () => onNavigate?.('sales') },
    { title: ar ? 'التحليلات' : 'Analytics',         icon: BarChart3,    color: moduleColors.financial,  action: () => onNavigate?.('analytics') },
  ];

  // تنبيهات حقيقية فقط — no placeholder tasks with made-up progress
  const upcomingTasks = [
    ...(stats.pendingApprovals > 0 ? [{
      title: ar ? `${n(stats.pendingApprovals)} طلب موافقة معلق` : `${n(stats.pendingApprovals)} pending approvals`,
      dueDate: ar ? 'عاجل' : 'Urgent', priority: 'high', go: () => onNavigate?.('approvals'),
    }] : []),
    ...(stats.lowStockCount > 0 ? [{
      title: ar ? `${n(stats.lowStockCount)} صنف مخزون منخفض` : `${n(stats.lowStockCount)} low stock items`,
      dueDate: ar ? 'تنبيه' : 'Alert', priority: 'medium', go: () => onNavigate?.('financial', 'inventory'),
    }] : []),
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-6 pb-6" data-testid="dashboard-content" dir={ar ? 'rtl' : 'ltr'}>
      {/* الترحيب والتاريخ — أول الصفحة */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
        <div className="absolute top-0 end-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl -translate-y-1/2" aria-hidden></div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{ar ? 'لوحة التحكم' : 'Dashboard'}</h1>
            <p className="text-slate-300 text-sm mt-0.5">
              {ar ? 'الأرقام المالية من دفتر الأستاذ مباشرةً — اضغط أي رقم لفتح تفاصيله' : 'Figures come straight from the ledger — click any to open it'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-sm">
            <CalendarCheck weight="duotone" className="w-5 h-5 text-cyan-400" aria-hidden />
            {new Date().toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* أرقام القرار: النقدية والمديونيات والضرائب والنتيجة */}
      <ExecutiveDashboard language={language} onNavigate={(m) => onNavigate?.(m)} />

      {/* العدّادات */}
      <section aria-label={ar ? 'العدّادات' : 'Counts'}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statsCards.map((card) => {
            const Icon = card.icon;
            return (
              <button key={card.id} type="button" onClick={() => onNavigate?.(card.module, card.subModule)}
                data-testid={`stat-card-${card.id}`}
                className="text-start bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md hover:border-slate-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{card.title}</span>
                  <span className={`w-8 h-8 rounded-lg ${card.color.iconBg} flex items-center justify-center`}>
                    <Icon weight="fill" className="w-4 h-4 text-white" aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{card.value}</p>
                {card.note && <p className="text-[11px] text-amber-700 mt-0.5">{card.note}</p>}
              </button>
            );
          })}
        </div>
      </section>

      {/* إجراءات سريعة + التنبيهات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-slate-200 shadow-none bg-white dark:bg-slate-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lightning weight="fill" className="w-4 h-4 text-amber-500" aria-hidden />
              {ar ? 'إجراءات سريعة' : 'Quick Actions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button key={index} type="button" onClick={action.action} data-testid={`quick-action-${index}`}
                    className={`flex items-center gap-3 p-3 rounded-xl ${action.color.light} border ${action.color.border} hover:shadow-sm transition`}>
                    <span className={`w-9 h-9 rounded-lg ${action.color.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4 text-white" aria-hidden />
                    </span>
                    <span className={`text-sm font-semibold ${action.color.text}`}>{action.title}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <HRAlerts language={language} onNavigate={onNavigate} />
          <Card className="border border-slate-200 shadow-none bg-white dark:bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" aria-hidden />
                {ar ? 'يحتاج انتباهك' : 'Needs attention'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length === 0 ? (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" aria-hidden />
                  {ar ? 'لا توجد موافقات معلقة ولا أصناف قاربت النفاد.' : 'Nothing pending.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingTasks.map((task, index) => (
                    <li key={index}>
                      <button type="button" onClick={task.go}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 text-start">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                          <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} aria-hidden></span>
                          {task.title}
                        </span>
                        <span className="text-xs text-slate-500">{task.dueDate}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts language={language} stats={stats} />

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
              className="group relative cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              onClick={() => onNavigate?.(mod.nav[0], mod.nav[1])}
              data-testid={`module-card-${mod.id}`}
            >
              <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${mod.color.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
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

    </div>
  );
};

export default DashboardContent;
