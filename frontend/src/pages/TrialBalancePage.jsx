import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Download, Printer, RefreshCw, Calendar, Loader2, 
  Scale, TrendingUp, TrendingDown, CheckCircle, AlertCircle,
  ChevronDown, ChevronRight, FolderOpen, FileText
} from 'lucide-react';

const TrialBalancePage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [trialBalance, setTrialBalance] = useState(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/accounting/reports/trial-balance?as_of_date=${asOfDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTrialBalance(data);
      }
    } catch (error) {
      console.error('Error fetching trial balance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, [asOfDate]);

  // Group accounts by type
  const groupAccountsByType = (items) => {
    const groups = {
      asset: { name: language === 'ar' ? 'الأصول' : 'Assets', items: [], totalDebit: 0, totalCredit: 0 },
      liability: { name: language === 'ar' ? 'الخصوم' : 'Liabilities', items: [], totalDebit: 0, totalCredit: 0 },
      equity: { name: language === 'ar' ? 'حقوق الملكية' : 'Equity', items: [], totalDebit: 0, totalCredit: 0 },
      revenue: { name: language === 'ar' ? 'الإيرادات' : 'Revenue', items: [], totalDebit: 0, totalCredit: 0 },
      expense: { name: language === 'ar' ? 'المصروفات' : 'Expenses', items: [], totalDebit: 0, totalCredit: 0 },
      contra_asset: { name: language === 'ar' ? 'أصول مقابلة' : 'Contra Assets', items: [], totalDebit: 0, totalCredit: 0 }
    };

    items?.forEach(item => {
      const type = item.account_type || 'asset';
      if (groups[type]) {
        groups[type].items.push(item);
        groups[type].totalDebit += item.debit || 0;
        groups[type].totalCredit += item.credit || 0;
      }
    });

    return groups;
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const exportToCSV = () => {
    if (!trialBalance?.items) return;

    const headers = language === 'ar' 
      ? ['كود الحساب', 'اسم الحساب', 'نوع الحساب', 'مدين', 'دائن']
      : ['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit'];
    
    const rows = trialBalance.items.map(item => [
      item.account_code,
      item.account_name,
      item.account_type,
      item.debit,
      item.credit
    ]);

    rows.push(['', language === 'ar' ? 'الإجمالي' : 'Total', '', trialBalance.total_debit, trialBalance.total_credit]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trial_balance_${asOfDate}.csv`;
    link.click();
  };

  const groupedAccounts = trialBalance ? groupAccountsByType(trialBalance.items) : {};

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance'}</h1>
              <p className="text-indigo-200 text-sm">{language === 'ar' ? 'التحقق من توازن الحسابات' : 'Verify account balances'}</p>
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
            <Button variant="outline" size="sm" onClick={fetchTrialBalance} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
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

      {/* Balance Status Card */}
      {trialBalance && (
        <Card className={`border-2 ${trialBalance.is_balanced ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {trialBalance.is_balanced ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-lg font-bold ${trialBalance.is_balanced ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {trialBalance.is_balanced 
                      ? (language === 'ar' ? 'الميزان متوازن ✓' : 'Balance is Correct ✓')
                      : (language === 'ar' ? 'الميزان غير متوازن ✗' : 'Balance is Incorrect ✗')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'ar' ? `حتى تاريخ: ${asOfDate}` : `As of: ${asOfDate}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المدين' : 'Total Debit'}</p>
                  <p className="text-2xl font-bold text-blue-600">{(trialBalance.total_debit || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الدائن' : 'Total Credit'}</p>
                  <p className="text-2xl font-bold text-green-600">{(trialBalance.total_credit || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                </div>
                {!trialBalance.is_balanced && (
                  <div className="text-center">
                    <p className="text-sm text-gray-500">{language === 'ar' ? 'الفرق' : 'Difference'}</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Math.abs(trialBalance.total_debit - trialBalance.total_credit).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial Balance Table */}
      <Card className="dark:bg-slate-800/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{language === 'ar' ? 'تفاصيل ميزان المراجعة' : 'Trial Balance Details'}</CardTitle>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="rounded"
            />
            {language === 'ar' ? 'عرض الأرصدة الصفرية' : 'Show Zero Balances'}
          </label>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="ml-2 text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 dark:bg-slate-700/50">
                  <TableHead className="font-bold w-32">{language === 'ar' ? 'كود الحساب' : 'Account Code'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'اسم الحساب' : 'Account Name'}</TableHead>
                  <TableHead className="font-bold text-center w-40">{language === 'ar' ? 'مدين' : 'Debit'}</TableHead>
                  <TableHead className="font-bold text-center w-40">{language === 'ar' ? 'دائن' : 'Credit'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedAccounts).map(([key, group]) => {
                  if (!showZeroBalances && group.items.length === 0) return null;
                  const isExpanded = expandedGroups[key] !== false;
                  
                  return (
                    <React.Fragment key={key}>
                      {/* Group Header */}
                      <TableRow 
                        className="bg-slate-50 dark:bg-slate-700/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/30"
                        onClick={() => toggleGroup(key)}
                      >
                        <TableCell colSpan={2} className="font-bold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                            {group.name} ({group.items.length})
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600">
                          {group.totalDebit > 0 ? group.totalDebit.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-600">
                          {group.totalCredit > 0 ? group.totalCredit.toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Group Items */}
                      {isExpanded && group.items.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                          <TableCell className="font-mono text-sm text-slate-600 dark:text-slate-400 pl-8">
                            {item.account_code}
                          </TableCell>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3 h-3 text-slate-400" />
                              {item.account_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.debit > 0 ? (
                              <span className="text-blue-600 font-medium">{item.debit.toLocaleString()}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.credit > 0 ? (
                              <span className="text-green-600 font-medium">{item.credit.toLocaleString()}</span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
                
                {/* Total Row */}
                <TableRow className="bg-indigo-50 dark:bg-indigo-900/30 font-bold border-t-2 border-indigo-300">
                  <TableCell colSpan={2} className="text-lg">
                    {language === 'ar' ? 'الإجمالي' : 'Total'}
                  </TableCell>
                  <TableCell className="text-center text-lg text-blue-700 dark:text-blue-400">
                    {(trialBalance?.total_debit || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center text-lg text-green-700 dark:text-green-400">
                    {(trialBalance?.total_credit || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialBalancePage;
