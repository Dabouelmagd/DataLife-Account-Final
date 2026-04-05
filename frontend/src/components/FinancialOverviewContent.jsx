import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Building2,
  FileText, Calculator, BarChart, ChevronRight, ArrowUp, ArrowDown,
  Wallet, CreditCard, PiggyBank, Receipt
} from 'lucide-react';
import { 
  Money, ChartLineUp, Wallet as WalletIcon, Bank, UsersThree,
  Receipt as ReceiptIcon, Scales, ChartPie
} from '@phosphor-icons/react';

const FinancialOverviewContent = ({ 
  language, 
  stats, 
  t,
  onNavigate 
}) => {
  // Financial Module color theme (Emerald)
  const colors = {
    gradient: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500',
    light: 'bg-emerald-50 dark:bg-emerald-950/50'
  };

  const monthlyRevenue = stats?.monthlyRevenue || 0;
  const monthlyExpenses = stats?.monthlyExpenses || 0;
  const netProfit = monthlyRevenue - monthlyExpenses;
  const profitMargin = monthlyRevenue > 0 ? ((netProfit / monthlyRevenue) * 100).toFixed(1) : 0;

  const statsCards = [
    {
      id: 'revenue',
      title: language === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Revenue',
      value: monthlyRevenue.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      change: '+15.2%',
      trend: 'up',
      icon: ChartLineUp,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-700 dark:text-emerald-400'
    },
    {
      id: 'expenses',
      title: language === 'ar' ? 'المصروفات الشهرية' : 'Monthly Expenses',
      value: monthlyExpenses.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      change: '+8.5%',
      trend: 'up',
      icon: WalletIcon,
      bgColor: 'bg-rose-50 dark:bg-rose-950/50',
      iconColor: 'bg-rose-500',
      textColor: 'text-rose-700 dark:text-rose-400'
    },
    {
      id: 'profit',
      title: language === 'ar' ? 'صافي الربح' : 'Net Profit',
      value: netProfit.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      subtext: `${profitMargin}% ${language === 'ar' ? 'هامش' : 'margin'}`,
      change: '+23%',
      trend: 'up',
      icon: Money,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-700 dark:text-blue-400'
    },
    {
      id: 'customers',
      title: language === 'ar' ? 'العملاء النشطين' : 'Active Customers',
      value: stats?.totalCustomers || 0,
      subtext: language === 'ar' ? 'عميل' : 'customers',
      change: '+5%',
      trend: 'up',
      icon: UsersThree,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500',
      textColor: 'text-violet-700 dark:text-violet-400'
    }
  ];

  const quickActions = [
    {
      title: language === 'ar' ? 'قيد يومي' : 'Journal Entry',
      icon: FileText,
      color: 'bg-emerald-500 hover:bg-emerald-600',
      action: () => onNavigate('journal-entries')
    },
    {
      title: language === 'ar' ? 'عميل جديد' : 'New Customer',
      icon: Users,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => onNavigate('customers')
    },
    {
      title: language === 'ar' ? 'مورد جديد' : 'New Supplier',
      icon: Building2,
      color: 'bg-amber-500 hover:bg-amber-600',
      action: () => onNavigate('suppliers')
    },
    {
      title: language === 'ar' ? 'التقارير' : 'Reports',
      icon: BarChart,
      color: 'bg-violet-500 hover:bg-violet-600',
      action: () => onNavigate('financial-reports')
    }
  ];

  const summaryItems = [
    {
      label: language === 'ar' ? 'إجمالي العملاء' : 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
    },
    {
      label: language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers',
      value: stats?.totalSuppliers || 0,
      icon: Building2,
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30'
    },
    {
      label: language === 'ar' ? 'الإيرادات' : 'Revenue',
      value: `${monthlyRevenue.toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'
    },
    {
      label: language === 'ar' ? 'المصروفات' : 'Expenses',
      value: `${monthlyExpenses.toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`,
      icon: TrendingDown,
      color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30'
    }
  ];

  return (
    <div className="space-y-6" data-testid="financial-overview-content">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Money weight="fill" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {language === 'ar' ? 'المالية والعمليات' : 'Finance & Operations'}
                </h1>
                <p className="text-emerald-100 text-sm">
                  {language === 'ar' 
                    ? 'إدارة الحسابات والمعاملات المالية'
                    : 'Manage accounts and financial transactions'
                  }
                </p>
              </div>
            </div>
            <Button 
              className="bg-white text-emerald-700 hover:bg-emerald-50"
              onClick={() => onNavigate('journal-entries')}
            >
              <FileText className="w-4 h-4 me-2" />
              {language === 'ar' ? 'قيد جديد' : 'New Entry'}
            </Button>
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
              data-testid={`financial-stat-${card.id}`}
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
                      {card.suffix && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {card.suffix}
                        </span>
                      )}
                    </div>
                    {card.subtext && (
                      <p className={`text-xs mt-1 ${card.textColor}`}>{card.subtext}</p>
                    )}
                    {card.change && (
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
                    )}
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Scales weight="fill" className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'الإجراءات المالية السريعة' : 'Quick Financial Actions'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  onClick={action.action}
                  className={`h-20 flex flex-col items-center justify-center gap-2 text-white ${action.color}`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{action.title}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <ChartPie weight="fill" className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'ملخص مالي' : 'Financial Summary'}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
              <ChevronRight className="w-4 h-4 ms-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summaryItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{item.value}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialOverviewContent;
