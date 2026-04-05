import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  FileText, Plus, Send, CheckCircle, Clock, AlertCircle,
  ChevronRight, ArrowUp, ArrowDown, Settings, Download,
  TrendingUp, Receipt, FileCheck, FileClock
} from 'lucide-react';
import { 
  Receipt as ReceiptIcon, FileDoc, PaperPlaneTilt, CheckCircle as CheckIcon,
  ClockCountdown, Warning, Gear, DownloadSimple, ChartLineUp
} from '@phosphor-icons/react';

const InvoicesOverviewContent = ({ 
  language, 
  stats,
  onNavigate,
  onCreateInvoice,
  onGoToETASettings
}) => {
  // Invoices Module color theme (Amber)
  const colors = {
    gradient: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500',
    light: 'bg-amber-50 dark:bg-amber-950/50'
  };

  // Mock stats for invoices (replace with real data)
  const invoiceStats = {
    totalInvoices: stats?.activeProjects || 24,
    pendingInvoices: 8,
    sentInvoices: 12,
    approvedInvoices: 4,
    totalValue: stats?.monthlyRevenue || 125000
  };

  const statsCards = [
    {
      id: 'total',
      title: language === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices',
      value: invoiceStats.totalInvoices,
      change: '+18%',
      trend: 'up',
      icon: ReceiptIcon,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500'
    },
    {
      id: 'pending',
      title: language === 'ar' ? 'في الانتظار' : 'Pending',
      value: invoiceStats.pendingInvoices,
      change: '-5%',
      trend: 'down',
      icon: ClockCountdown,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500'
    },
    {
      id: 'sent',
      title: language === 'ar' ? 'تم الإرسال' : 'Sent to ETA',
      value: invoiceStats.sentInvoices,
      change: '+12%',
      trend: 'up',
      icon: PaperPlaneTilt,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500'
    },
    {
      id: 'approved',
      title: language === 'ar' ? 'تم الاعتماد' : 'Approved',
      value: invoiceStats.approvedInvoices,
      change: '+25%',
      trend: 'up',
      icon: CheckIcon,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500'
    }
  ];

  const quickActions = [
    {
      title: language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice',
      description: language === 'ar' ? 'إنشاء فاتورة مبيعات جديدة' : 'Create new sales invoice',
      icon: Plus,
      color: 'bg-amber-500 hover:bg-amber-600',
      action: onCreateInvoice
    },
    {
      title: language === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice',
      description: language === 'ar' ? 'تسجيل فاتورة مشتريات' : 'Record purchase invoice',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => onNavigate('invoices')
    },
    {
      title: language === 'ar' ? 'التقارير' : 'Reports',
      description: language === 'ar' ? 'تقارير الفواتير والضرائب' : 'Invoice & tax reports',
      icon: ChartLineUp,
      color: 'bg-violet-500 hover:bg-violet-600',
      action: () => onNavigate('reports')
    },
    {
      title: language === 'ar' ? 'إعدادات ETA' : 'ETA Settings',
      description: language === 'ar' ? 'إعدادات مصلحة الضرائب' : 'Tax authority settings',
      icon: Settings,
      color: 'bg-slate-600 hover:bg-slate-700',
      action: onGoToETASettings
    }
  ];

  const invoiceStatusItems = [
    {
      status: language === 'ar' ? 'مسودة' : 'Draft',
      count: 5,
      icon: FileDoc,
      color: 'text-slate-600 bg-slate-100 dark:bg-slate-800'
    },
    {
      status: language === 'ar' ? 'في انتظار الإرسال' : 'Pending Submission',
      count: invoiceStats.pendingInvoices,
      icon: ClockCountdown,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
    },
    {
      status: language === 'ar' ? 'تم الإرسال' : 'Submitted',
      count: invoiceStats.sentInvoices,
      icon: PaperPlaneTilt,
      color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30'
    },
    {
      status: language === 'ar' ? 'معتمدة' : 'Approved',
      count: invoiceStats.approvedInvoices,
      icon: CheckIcon,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'
    },
    {
      status: language === 'ar' ? 'مرفوضة' : 'Rejected',
      count: 0,
      icon: Warning,
      color: 'text-red-600 bg-red-100 dark:bg-red-900/30'
    }
  ];

  return (
    <div className="space-y-6" data-testid="invoices-overview-content">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <ReceiptIcon weight="fill" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {language === 'ar' ? 'الفواتير الإلكترونية' : 'Electronic Invoices'}
                </h1>
                <p className="text-amber-100 text-sm">
                  {language === 'ar' 
                    ? 'إدارة الفواتير وربط مصلحة الضرائب المصرية'
                    : 'Manage invoices and ETA integration'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={onGoToETASettings}
              >
                <Settings className="w-4 h-4 me-2" />
                {language === 'ar' ? 'إعدادات ETA' : 'ETA Settings'}
              </Button>
              <Button 
                className="bg-white text-amber-700 hover:bg-amber-50"
                onClick={onCreateInvoice}
              >
                <Plus className="w-4 h-4 me-2" />
                {language === 'ar' ? 'فاتورة جديدة' : 'New Invoice'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.id}
              className={`group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 ${card.bgColor}`}
              data-testid={`invoice-stat-${card.id}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.iconColor}`}></div>
              
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
                  <div className={`w-12 h-12 rounded-xl ${card.iconColor} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <PaperPlaneTilt weight="fill" className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.action}
                  className={`group p-4 rounded-xl text-white ${action.color} transition-all duration-300 hover:shadow-lg text-start`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-semibold">{action.title}</span>
                  </div>
                  <p className="text-xs text-white/80">{action.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Status Overview */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <FileDoc weight="fill" className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'حالة الفواتير' : 'Invoice Status'}
              </CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-amber-600 hover:text-amber-700"
              onClick={() => onNavigate('invoices')}
            >
              {language === 'ar' ? 'عرض الكل' : 'View All'}
              <ChevronRight className="w-4 h-4 ms-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoiceStatusItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => onNavigate('invoices')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}>
                      <Icon weight="fill" className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.status}</span>
                  </div>
                  <Badge variant="outline" className="text-lg font-bold">
                    {item.count}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ETA Integration Status */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                <Gear weight="fill" className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'ربط مصلحة الضرائب المصرية (ETA)' : 'Egyptian Tax Authority Integration'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {language === 'ar' 
                    ? 'قم بإعداد بيانات الاتصال لإرسال الفواتير الإلكترونية'
                    : 'Configure your credentials to submit electronic invoices'
                  }
                </p>
              </div>
            </div>
            <Button 
              onClick={onGoToETASettings}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <Settings className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إعداد الآن' : 'Configure Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesOverviewContent;
