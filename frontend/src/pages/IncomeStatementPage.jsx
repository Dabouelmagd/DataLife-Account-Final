import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Download, Printer, RefreshCw, Calendar, Loader2, 
  TrendingUp, TrendingDown, DollarSign, Receipt,
  ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const IncomeStatementPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchIncomeStatement = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/accounting/reports/income-statement?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setIncomeStatement(data);
      }
    } catch (error) {
      console.error('Error fetching income statement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomeStatement();
  }, [startDate, endDate]);

  const exportToCSV = () => {
    if (!incomeStatement) return;

    const headers = language === 'ar' 
      ? ['كود الحساب', 'اسم الحساب', 'المبلغ']
      : ['Account Code', 'Account Name', 'Amount'];
    
    let rows = [];
    rows.push([language === 'ar' ? '=== الإيرادات ===' : '=== Revenue ===', '', '']);
    incomeStatement.revenues?.forEach(r => rows.push([r.account_code, r.account_name, r.amount]));
    rows.push([language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue', '', incomeStatement.total_revenue]);
    
    rows.push(['', '', '']);
    rows.push([language === 'ar' ? '=== المصروفات ===' : '=== Expenses ===', '', '']);
    incomeStatement.expenses?.forEach(e => rows.push([e.account_code, e.account_name, e.amount]));
    rows.push([language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses', '', incomeStatement.total_expenses]);
    
    rows.push(['', '', '']);
    rows.push([language === 'ar' ? 'صافي الدخل' : 'Net Income', '', incomeStatement.net_income]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `income_statement_${startDate}_${endDate}.csv`;
    link.click();
  };

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

  // Prepare chart data
  const revenueChartData = incomeStatement?.revenues?.map((r, i) => ({
    name: r.account_name,
    value: r.amount,
    fill: COLORS[i % COLORS.length]
  })) || [];

  const expenseChartData = incomeStatement?.expenses?.map((e, i) => ({
    name: e.account_name,
    value: e.amount,
    fill: COLORS[i % COLORS.length]
  })) || [];

  const comparisonData = [
    { name: language === 'ar' ? 'الإيرادات' : 'Revenue', amount: incomeStatement?.total_revenue || 0, fill: '#10b981' },
    { name: language === 'ar' ? 'المصروفات' : 'Expenses', amount: incomeStatement?.total_expenses || 0, fill: '#ef4444' },
    { name: language === 'ar' ? 'صافي الدخل' : 'Net Income', amount: incomeStatement?.net_income || 0, fill: incomeStatement?.is_profit ? '#3b82f6' : '#f59e0b' }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Receipt className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'قائمة الدخل' : 'Income Statement'}</h1>
              <p className="text-emerald-200 text-sm">{language === 'ar' ? 'الإيرادات والمصروفات وصافي الربح' : 'Revenue, Expenses & Net Profit'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <span className="text-sm">{language === 'ar' ? 'من' : 'From'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-white text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <span className="text-sm">{language === 'ar' ? 'إلى' : 'To'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-white text-sm focus:outline-none"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchIncomeStatement} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
              <Download className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'تصدير' : 'Export'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
              <Printer className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'طباعة' : 'Print'}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="ml-2 text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue */}
            <Card className="border-l-4 border-l-emerald-500 dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
                    <p className="text-3xl font-bold text-emerald-600">{(incomeStatement?.total_revenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card className="border-l-4 border-l-red-500 dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
                    <p className="text-3xl font-bold text-red-600">{(incomeStatement?.total_expenses || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <ArrowDownRight className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Net Income */}
            <Card className={`border-l-4 ${incomeStatement?.is_profit ? 'border-l-blue-500' : 'border-l-amber-500'} dark:bg-slate-800/50`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {incomeStatement?.is_profit 
                        ? (language === 'ar' ? 'صافي الربح' : 'Net Profit')
                        : (language === 'ar' ? 'صافي الخسارة' : 'Net Loss')}
                    </p>
                    <p className={`text-3xl font-bold ${incomeStatement?.is_profit ? 'text-blue-600' : 'text-amber-600'}`}>
                      {Math.abs(incomeStatement?.net_income || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${incomeStatement?.is_profit ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} flex items-center justify-center`}>
                    {incomeStatement?.is_profit ? (
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-amber-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Comparison Bar Chart */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg">{language === 'ar' ? 'مقارنة الإيرادات والمصروفات' : 'Revenue vs Expenses'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} layout="vertical">
                      <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(v) => v.toLocaleString()} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg">{language === 'ar' ? 'توزيع المصروفات' : 'Expense Breakdown'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => v.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Table */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader className="bg-emerald-50 dark:bg-emerald-900/20">
                <CardTitle className="text-lg text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {language === 'ar' ? 'الإيرادات' : 'Revenue'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">{language === 'ar' ? 'الحساب' : 'Account'}</TableHead>
                      <TableHead className="font-bold text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeStatement?.revenues?.length > 0 ? (
                      <>
                        {incomeStatement.revenues.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-400">{r.account_code}</span>
                                <span>{r.account_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">{r.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-emerald-50 dark:bg-emerald-900/20 font-bold">
                          <TableCell>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                          <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{(incomeStatement.total_revenue || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-500 py-8">{language === 'ar' ? 'لا توجد إيرادات' : 'No revenue'}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Expenses Table */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader className="bg-red-50 dark:bg-red-900/20">
                <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  {language === 'ar' ? 'المصروفات' : 'Expenses'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">{language === 'ar' ? 'الحساب' : 'Account'}</TableHead>
                      <TableHead className="font-bold text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeStatement?.expenses?.length > 0 ? (
                      <>
                        {incomeStatement.expenses.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-400">{e.account_code}</span>
                                <span>{e.account_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">{e.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50 dark:bg-red-900/20 font-bold">
                          <TableCell>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                          <TableCell className="text-right text-red-700 dark:text-red-400">{(incomeStatement.total_expenses || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-500 py-8">{language === 'ar' ? 'لا توجد مصروفات' : 'No expenses'}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Net Income Summary */}
          <Card className={`border-2 ${incomeStatement?.is_profit ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
                  <p className="text-2xl font-bold text-emerald-600">{(incomeStatement?.total_revenue || 0).toLocaleString()}</p>
                </div>
                <span className="text-4xl font-light text-gray-300">-</span>
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
                  <p className="text-2xl font-bold text-red-600">{(incomeStatement?.total_expenses || 0).toLocaleString()}</p>
                </div>
                <span className="text-4xl font-light text-gray-300">=</span>
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    {incomeStatement?.is_profit 
                      ? (language === 'ar' ? 'صافي الربح' : 'Net Profit')
                      : (language === 'ar' ? 'صافي الخسارة' : 'Net Loss')}
                  </p>
                  <p className={`text-3xl font-bold ${incomeStatement?.is_profit ? 'text-blue-600' : 'text-amber-600'}`}>
                    {Math.abs(incomeStatement?.net_income || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default IncomeStatementPage;
