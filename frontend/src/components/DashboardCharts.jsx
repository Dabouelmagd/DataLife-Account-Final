import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, FileText, Calendar,
  ChevronDown, BarChart3, PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { ChartLineUp, ChartBar, ChartPie, CalendarBlank } from '@phosphor-icons/react';

const DashboardCharts = ({ language, stats }) => {
  const [chartPeriod, setChartPeriod] = useState('month');

  // Color palette matching sidebar
  const colors = {
    primary: '#06b6d4', // cyan-500
    secondary: '#10b981', // emerald-500  
    accent: '#f59e0b', // amber-500
    purple: '#8b5cf6', // violet-500
    pink: '#ec4899', // pink-500
    slate: '#64748b', // slate-500
  };

  // Generate mock data for charts based on stats
  const generateMonthlyData = () => {
    const months = language === 'ar' 
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const baseRevenue = stats?.monthlyRevenue || 50000;
    const baseEmployees = stats?.totalEmployees || 10;
    
    return months.map((month, index) => ({
      month,
      revenue: Math.round(baseRevenue * (0.7 + Math.random() * 0.6) * (1 + index * 0.1)),
      expenses: Math.round(baseRevenue * (0.4 + Math.random() * 0.3)),
      employees: Math.round(baseEmployees * (0.8 + index * 0.05)),
      invoices: Math.round(5 + Math.random() * 15 + index * 2),
    }));
  };

  const generateDepartmentData = () => {
    return [
      { 
        name: language === 'ar' ? 'الإدارة' : 'Management', 
        value: 15, 
        color: colors.primary 
      },
      { 
        name: language === 'ar' ? 'المالية' : 'Finance', 
        value: 25, 
        color: colors.secondary 
      },
      { 
        name: language === 'ar' ? 'الموارد البشرية' : 'HR', 
        value: 20, 
        color: colors.accent 
      },
      { 
        name: language === 'ar' ? 'المبيعات' : 'Sales', 
        value: 30, 
        color: colors.purple 
      },
      { 
        name: language === 'ar' ? 'أخرى' : 'Other', 
        value: 10, 
        color: colors.slate 
      },
    ];
  };

  const generateExpenseData = () => {
    return [
      { 
        name: language === 'ar' ? 'الرواتب' : 'Salaries', 
        value: 45, 
        color: colors.primary 
      },
      { 
        name: language === 'ar' ? 'الإيجار' : 'Rent', 
        value: 20, 
        color: colors.secondary 
      },
      { 
        name: language === 'ar' ? 'المرافق' : 'Utilities', 
        value: 10, 
        color: colors.accent 
      },
      { 
        name: language === 'ar' ? 'التسويق' : 'Marketing', 
        value: 15, 
        color: colors.purple 
      },
      { 
        name: language === 'ar' ? 'أخرى' : 'Other', 
        value: 10, 
        color: colors.pink 
      },
    ];
  };

  const monthlyData = generateMonthlyData();
  const departmentData = generateDepartmentData();
  const expenseData = generateExpenseData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const periodOptions = [
    { value: 'week', label: language === 'ar' ? 'أسبوع' : 'Week' },
    { value: 'month', label: language === 'ar' ? 'شهر' : 'Month' },
    { value: 'quarter', label: language === 'ar' ? 'ربع سنة' : 'Quarter' },
    { value: 'year', label: language === 'ar' ? 'سنة' : 'Year' },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ChartLineUp weight="fill" className="w-6 h-6 text-cyan-500" />
          {language === 'ar' ? 'التحليلات والرسوم البيانية' : 'Analytics & Charts'}
        </h2>
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {periodOptions.map(option => (
            <Button
              key={option.value}
              variant={chartPeriod === option.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartPeriod(option.value)}
              className={chartPeriod === option.value 
                ? 'bg-white dark:bg-slate-700 shadow-sm' 
                : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <ChartLineUp weight="fill" className="w-4 h-4 text-white" />
                </div>
                {language === 'ar' ? 'الإيرادات والمصروفات' : 'Revenue vs Expenses'}
              </CardTitle>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                +23%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={colors.primary}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name={language === 'ar' ? 'الإيرادات' : 'Revenue'}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke={colors.accent}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  name={language === 'ar' ? 'المصروفات' : 'Expenses'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Invoices Bar Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <ChartBar weight="fill" className="w-4 h-4 text-white" />
                </div>
                {language === 'ar' ? 'الفواتير الشهرية' : 'Monthly Invoices'}
              </CardTitle>
              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                +8%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="invoices" 
                  fill={colors.accent}
                  radius={[6, 6, 0, 0]}
                  name={language === 'ar' ? 'الفواتير' : 'Invoices'}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Distribution Pie Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <ChartPie weight="fill" className="w-4 h-4 text-white" />
              </div>
              {language === 'ar' ? 'توزيع الموظفين حسب القسم' : 'Employees by Department'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-[40%] space-y-2">
                {departmentData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{item.name}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              {language === 'ar' ? 'توزيع المصروفات' : 'Expense Breakdown'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-[40%] space-y-2">
                {expenseData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{item.name}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Growth Line Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              {language === 'ar' ? 'نمو عدد الموظفين' : 'Employee Growth'}
            </CardTitle>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
              +12%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="employees"
                stroke={colors.secondary}
                strokeWidth={3}
                dot={{ fill: colors.secondary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: colors.secondary }}
                name={language === 'ar' ? 'الموظفين' : 'Employees'}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCharts;
