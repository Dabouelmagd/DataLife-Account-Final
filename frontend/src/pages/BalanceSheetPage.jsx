import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Download, Printer, RefreshCw, Calendar, Loader2, 
  Building2, Wallet, Users, TrendingUp, FileText,
  ChevronDown, ChevronRight, CheckCircle, AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const BalanceSheetPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedSections, setExpandedSections] = useState({
    currentAssets: true,
    fixedAssets: true,
    currentLiabilities: true,
    longTermLiabilities: true,
    equity: true
  });

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/accounting/reports/balance-sheet?as_of_date=${asOfDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setBalanceSheet(data);
      }
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, [asOfDate]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const exportToCSV = () => {
    if (!balanceSheet) return;

    const headers = language === 'ar' 
      ? ['البند', 'المبلغ']
      : ['Item', 'Amount'];
    
    let rows = [];
    rows.push([language === 'ar' ? '=== الأصول ===' : '=== Assets ===', '']);
    rows.push([language === 'ar' ? '-- أصول متداولة --' : '-- Current Assets --', '']);
    balanceSheet.assets?.current?.forEach(a => rows.push([a.account_name, a.amount]));
    rows.push([language === 'ar' ? '-- أصول ثابتة --' : '-- Fixed Assets --', '']);
    balanceSheet.assets?.fixed?.forEach(a => rows.push([a.account_name, a.amount]));
    rows.push([language === 'ar' ? 'إجمالي الأصول' : 'Total Assets', balanceSheet.assets?.total]);
    
    rows.push(['', '']);
    rows.push([language === 'ar' ? '=== الخصوم ===' : '=== Liabilities ===', '']);
    balanceSheet.liabilities?.current?.forEach(l => rows.push([l.account_name, l.amount]));
    balanceSheet.liabilities?.long_term?.forEach(l => rows.push([l.account_name, l.amount]));
    rows.push([language === 'ar' ? 'إجمالي الخصوم' : 'Total Liabilities', balanceSheet.liabilities?.total]);
    
    rows.push(['', '']);
    rows.push([language === 'ar' ? '=== حقوق الملكية ===' : '=== Equity ===', '']);
    balanceSheet.equity?.items?.forEach(e => rows.push([e.account_name, e.amount]));
    rows.push([language === 'ar' ? 'إجمالي حقوق الملكية' : 'Total Equity', balanceSheet.equity?.total]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `balance_sheet_${asOfDate}.csv`;
    link.click();
  };

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

  // Check if balanced
  const isBalanced = balanceSheet ? 
    Math.abs((balanceSheet.assets?.total || 0) - ((balanceSheet.liabilities?.total || 0) + (balanceSheet.equity?.total || 0))) < 0.01 
    : true;

  // Prepare chart data
  const assetsBreakdown = [
    { name: language === 'ar' ? 'أصول متداولة' : 'Current Assets', value: balanceSheet?.assets?.current?.reduce((s, a) => s + a.amount, 0) || 0, fill: '#3b82f6' },
    { name: language === 'ar' ? 'أصول ثابتة' : 'Fixed Assets', value: balanceSheet?.assets?.fixed?.reduce((s, a) => s + a.amount, 0) || 0, fill: '#06b6d4' }
  ];

  const financingBreakdown = [
    { name: language === 'ar' ? 'خصوم متداولة' : 'Current Liabilities', value: balanceSheet?.liabilities?.current?.reduce((s, l) => s + l.amount, 0) || 0, fill: '#ef4444' },
    { name: language === 'ar' ? 'خصوم طويلة الأجل' : 'Long-term Liabilities', value: balanceSheet?.liabilities?.long_term?.reduce((s, l) => s + l.amount, 0) || 0, fill: '#f59e0b' },
    { name: language === 'ar' ? 'حقوق الملكية' : 'Equity', value: balanceSheet?.equity?.total || 0, fill: '#8b5cf6' }
  ];

  const renderSection = (title, items, total, icon, colorClass, sectionKey) => (
    <div className="mb-4">
      <div 
        className={`flex items-center justify-between p-3 ${colorClass} rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
        onClick={() => toggleSection(sectionKey)}
      >
        <div className="flex items-center gap-2 text-white font-bold">
          {expandedSections[sectionKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {icon}
          {title}
        </div>
        <span className="text-white font-bold">{(total || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
      </div>
      {expandedSections[sectionKey] && items && items.length > 0 && (
        <div className="mt-2 space-y-1 pl-6">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-slate-700/30 rounded">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">{item.account_code}</span>
                <span className="dark:text-gray-200">{item.account_name}</span>
              </div>
              <span className="font-medium dark:text-gray-200">{item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}</h1>
              <p className="text-blue-200 text-sm">{language === 'ar' ? 'المركز المالي للشركة' : 'Company Financial Position'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4" />
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-transparent border-none text-white text-sm focus:outline-none"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchBalanceSheet} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
        </div>
      ) : (
        <>
          {/* Balance Equation Card */}
          <Card className={`border-2 ${isBalanced ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isBalanced ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                  <div>
                    <h3 className={`text-lg font-bold ${isBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {isBalanced 
                        ? (language === 'ar' ? 'الميزانية متوازنة ✓' : 'Balance Sheet is Balanced ✓')
                        : (language === 'ar' ? 'الميزانية غير متوازنة ✗' : 'Balance Sheet is Not Balanced ✗')}
                    </h3>
                    <p className="text-sm text-gray-500">{language === 'ar' ? 'الأصول = الخصوم + حقوق الملكية' : 'Assets = Liabilities + Equity'}</p>
                  </div>
                </div>
                <div className="flex gap-8 items-center">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">{language === 'ar' ? 'الأصول' : 'Assets'}</p>
                    <p className="text-2xl font-bold text-blue-600">{(balanceSheet?.assets?.total || 0).toLocaleString()}</p>
                  </div>
                  <span className="text-2xl font-light text-gray-400">=</span>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">{language === 'ar' ? 'الخصوم' : 'Liabilities'}</p>
                    <p className="text-2xl font-bold text-red-600">{(balanceSheet?.liabilities?.total || 0).toLocaleString()}</p>
                  </div>
                  <span className="text-2xl font-light text-gray-400">+</span>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">{language === 'ar' ? 'حقوق الملكية' : 'Equity'}</p>
                    <p className="text-2xl font-bold text-purple-600">{(balanceSheet?.equity?.total || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-blue-500 dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}</p>
                    <p className="text-3xl font-bold text-blue-600">{(balanceSheet?.assets?.total || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{language === 'ar' ? 'إجمالي الخصوم' : 'Total Liabilities'}</p>
                    <p className="text-3xl font-bold text-red-600">{(balanceSheet?.liabilities?.total || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{language === 'ar' ? 'حقوق الملكية' : 'Total Equity'}</p>
                    <p className="text-3xl font-bold text-purple-600">{(balanceSheet?.equity?.total || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets Breakdown */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg text-blue-600">{language === 'ar' ? 'توزيع الأصول' : 'Assets Breakdown'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetsBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {assetsBreakdown.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => v.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Financing Breakdown */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg text-purple-600">{language === 'ar' ? 'مصادر التمويل' : 'Financing Sources'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financingBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {financingBreakdown.map((entry, index) => (
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

          {/* Detailed Balance Sheet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="text-xl text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Wallet className="w-6 h-6" />
                  {language === 'ar' ? 'الأصول' : 'Assets'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {renderSection(
                  language === 'ar' ? 'الأصول المتداولة' : 'Current Assets',
                  balanceSheet?.assets?.current,
                  balanceSheet?.assets?.current?.reduce((s, a) => s + a.amount, 0),
                  <Wallet className="w-4 h-4" />,
                  'bg-blue-500',
                  'currentAssets'
                )}
                {renderSection(
                  language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets',
                  balanceSheet?.assets?.fixed,
                  balanceSheet?.assets?.fixed?.reduce((s, a) => s + a.amount, 0),
                  <Building2 className="w-4 h-4" />,
                  'bg-cyan-500',
                  'fixedAssets'
                )}
                <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span className="text-blue-800 dark:text-blue-300">{language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}</span>
                    <span className="text-blue-800 dark:text-blue-300">{(balanceSheet?.assets?.total || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card className="dark:bg-slate-800/50">
              <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
                <CardTitle className="text-xl text-purple-700 dark:text-purple-400 flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  {language === 'ar' ? 'الخصوم وحقوق الملكية' : 'Liabilities & Equity'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {renderSection(
                  language === 'ar' ? 'الخصوم المتداولة' : 'Current Liabilities',
                  balanceSheet?.liabilities?.current,
                  balanceSheet?.liabilities?.current?.reduce((s, l) => s + l.amount, 0),
                  <TrendingUp className="w-4 h-4" />,
                  'bg-red-500',
                  'currentLiabilities'
                )}
                {renderSection(
                  language === 'ar' ? 'الخصوم طويلة الأجل' : 'Long-term Liabilities',
                  balanceSheet?.liabilities?.long_term,
                  balanceSheet?.liabilities?.long_term?.reduce((s, l) => s + l.amount, 0),
                  <TrendingUp className="w-4 h-4" />,
                  'bg-amber-500',
                  'longTermLiabilities'
                )}
                {renderSection(
                  language === 'ar' ? 'حقوق الملكية' : 'Equity',
                  balanceSheet?.equity?.items,
                  balanceSheet?.equity?.total,
                  <Users className="w-4 h-4" />,
                  'bg-purple-500',
                  'equity'
                )}
                <div className="mt-4 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span className="text-purple-800 dark:text-purple-300">{language === 'ar' ? 'إجمالي الخصوم وحقوق الملكية' : 'Total Liabilities & Equity'}</span>
                    <span className="text-purple-800 dark:text-purple-300">{((balanceSheet?.liabilities?.total || 0) + (balanceSheet?.equity?.total || 0)).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default BalanceSheetPage;
