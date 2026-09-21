import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { 
  FileText, Download, Calendar, Printer, CheckCircle2, XCircle,
  Loader2, TrendingUp, TrendingDown, Scale, PieChart, BarChart3
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FinancialReportsPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [activeReport, setActiveReport] = useState('trial-balance');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateFilters, setDateFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    asOfDate: new Date().toISOString().split('T')[0]
  });

  const translations = {
    ar: {
      title: 'التقارير المالية',
      subtitle: 'عرض وتحليل البيانات المالية',
      trialBalance: 'ميزان المراجعة',
      incomeStatement: 'قائمة الدخل',
      balanceSheet: 'الميزانية العمومية',
      cashFlow: 'قائمة التدفقات النقدية',
      asOfDate: 'كما في تاريخ',
      fromDate: 'من تاريخ',
      toDate: 'إلى تاريخ',
      generate: 'إنشاء التقرير',
      export: 'تصدير',
      print: 'طباعة',
      accountCode: 'رقم الحساب',
      accountName: 'اسم الحساب',
      debit: 'مدين',
      credit: 'دائن',
      amount: 'المبلغ',
      total: 'الإجمالي',
      balanced: 'متوازن',
      notBalanced: 'غير متوازن',
      revenues: 'الإيرادات',
      expenses: 'المصروفات',
      totalRevenue: 'إجمالي الإيرادات',
      totalExpenses: 'إجمالي المصروفات',
      netIncome: 'صافي الدخل',
      netLoss: 'صافي الخسارة',
      assets: 'الأصول',
      currentAssets: 'الأصول المتداولة',
      fixedAssets: 'الأصول الثابتة',
      totalAssets: 'إجمالي الأصول',
      liabilities: 'الخصوم',
      currentLiabilities: 'الخصوم المتداولة',
      longTermLiabilities: 'الخصوم طويلة الأجل',
      totalLiabilities: 'إجمالي الخصوم',
      equity: 'حقوق الملكية',
      totalEquity: 'إجمالي حقوق الملكية',
      totalLiabilitiesAndEquity: 'إجمالي الخصوم وحقوق الملكية',
      period: 'الفترة',
      noData: 'لا توجد بيانات'
    },
    en: {
      title: 'Financial Reports',
      subtitle: 'View and analyze financial data',
      trialBalance: 'Trial Balance',
      incomeStatement: 'Income Statement',
      balanceSheet: 'Balance Sheet',
      cashFlow: 'Cash Flow Statement',
      asOfDate: 'As of Date',
      fromDate: 'From Date',
      toDate: 'To Date',
      generate: 'Generate Report',
      export: 'Export',
      print: 'Print',
      accountCode: 'Account Code',
      accountName: 'Account Name',
      debit: 'Debit',
      credit: 'Credit',
      amount: 'Amount',
      total: 'Total',
      balanced: 'Balanced',
      notBalanced: 'Not Balanced',
      revenues: 'Revenues',
      expenses: 'Expenses',
      totalRevenue: 'Total Revenue',
      totalExpenses: 'Total Expenses',
      netIncome: 'Net Income',
      netLoss: 'Net Loss',
      assets: 'Assets',
      currentAssets: 'Current Assets',
      fixedAssets: 'Fixed Assets',
      totalAssets: 'Total Assets',
      liabilities: 'Liabilities',
      currentLiabilities: 'Current Liabilities',
      longTermLiabilities: 'Long-term Liabilities',
      totalLiabilities: 'Total Liabilities',
      equity: 'Equity',
      totalEquity: 'Total Equity',
      totalLiabilitiesAndEquity: 'Total Liabilities & Equity',
      period: 'Period',
      noData: 'No data available'
    }
  };

  const t = translations[language] || translations.en;

  const reports = [
    { id: 'trial-balance', name: t.trialBalance, icon: Scale },
    { id: 'income-statement', name: t.incomeStatement, icon: BarChart3 },
    { id: 'balance-sheet', name: t.balanceSheet, icon: PieChart },
    { id: 'cash-flow', name: t.cashFlow, icon: BarChart3 }
  ];

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const handleExport = async () => {
    if (activeReport === 'cash-flow') {           // no server export: build a CSV from the statement
      if (!reportData) return;
      const r = reportData, o = r.operating_activities;
      const rows = [['البند', 'المبلغ'], ['صافي الربح', o.net_income], ['الإهلاك', o.depreciation],
        ...o.working_capital.map((w) => [w.item, w.amount]), ['صافي التدفق من الأنشطة التشغيلية', o.net],
        ...r.investing_activities.items.map((w) => [w.item, w.amount]), ['صافي التدفق من الأنشطة الاستثمارية', r.investing_activities.net],
        ...r.financing_activities.items.map((w) => [w.item, w.amount]), ['صافي التدفق من الأنشطة التمويلية', r.financing_activities.net],
        ['صافي التغير في النقدية', r.net_change_in_cash], ['النقدية أول الفترة', r.opening_cash_balance], ['النقدية آخر الفترة', r.closing_cash_balance]];
      const csv = '\uFEFF' + rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
        download: `cash-flow_${dateFilters.startDate}_${dateFilters.endDate}.csv` });
      a.click(); return;
    }
    try {
      const token = localStorage.getItem('token');
      let url = '';
      let params = new URLSearchParams();

      switch (activeReport) {
        case 'trial-balance':
          url = `${API_URL}/api/accounting/reports/trial-balance/export`;
          if (dateFilters.asOfDate) params.append('as_of_date', dateFilters.asOfDate);
          break;
        case 'income-statement':
          url = `${API_URL}/api/accounting/reports/income-statement/export`;
          params.append('start_date', dateFilters.startDate);
          params.append('end_date', dateFilters.endDate);
          break;
        case 'balance-sheet':
          url = `${API_URL}/api/accounting/reports/balance-sheet/export`;
          if (dateFilters.asOfDate) params.append('as_of_date', dateFilters.asOfDate);
          break;
      }

      const response = await axios.get(
        `${url}?${params.toString()}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Download file
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${activeReport}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = '';
      let params = new URLSearchParams();

      switch (activeReport) {
        case 'trial-balance':
          url = `${API_URL}/api/accounting/reports/trial-balance`;
          if (dateFilters.asOfDate) params.append('as_of_date', dateFilters.asOfDate);
          break;
        case 'income-statement':
          url = `${API_URL}/api/accounting/reports/income-statement`;
          params.append('start_date', dateFilters.startDate);
          params.append('end_date', dateFilters.endDate);
          break;
        case 'balance-sheet':
          url = `${API_URL}/api/accounting/reports/balance-sheet`;
          if (dateFilters.asOfDate) params.append('as_of_date', dateFilters.asOfDate);
          break;
        case 'cash-flow':
          url = `${API_URL}/api/cash-flow/indirect`;
          params.append('year', dateFilters.startDate.slice(0, 4));
          params.append('date_from', dateFilters.startDate);
          params.append('date_to', dateFilters.endDate);
          break;
      }

      const response = await axios.get(
        `${url}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTrialBalance = () => {
    if (!reportData || !reportData.items) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-[#28376B] to-[#3d4f8f] text-white">
          <h2 className="text-2xl font-bold">{t.trialBalance}</h2>
          <p className="opacity-80">{t.asOfDate}: {reportData.as_of_date}</p>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-start text-sm font-semibold text-gray-700">{t.accountCode}</th>
              <th className="px-6 py-4 text-start text-sm font-semibold text-gray-700">{t.accountName}</th>
              <th className="px-6 py-4 text-end text-sm font-semibold text-gray-700">{t.debit}</th>
              <th className="px-6 py-4 text-end text-sm font-semibold text-gray-700">{t.credit}</th>
            </tr>
          </thead>
          <tbody>
            {reportData.items.map((item, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">{item.account_code}</td>
                <td className="px-6 py-4">{item.account_name}</td>
                <td className="px-6 py-4 text-end text-green-600 font-medium">
                  {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 text-end text-red-600 font-medium">
                  {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr className="font-bold text-lg">
              <td colSpan="2" className="px-6 py-4">{t.total}</td>
              <td className="px-6 py-4 text-end text-green-700">{reportData.total_debit?.toLocaleString()}</td>
              <td className="px-6 py-4 text-end text-red-700">{reportData.total_credit?.toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan="4" className="px-6 py-3">
                <div className={`flex items-center justify-center gap-2 ${reportData.is_balanced ? 'text-green-600' : 'text-red-600'}`}>
                  {reportData.is_balanced ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">{t.balanced}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">{t.notBalanced}</span>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderIncomeStatement = () => {
    if (!reportData) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-[#28376B] to-[#3d4f8f] text-white">
          <h2 className="text-2xl font-bold">{t.incomeStatement}</h2>
          <p className="opacity-80">{t.period}: {reportData.period_start} - {reportData.period_end}</p>
        </div>

        <div className="p-6">
          {/* Revenues */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-green-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t.revenues}
            </h3>
            <table className="w-full">
              <tbody>
                {(reportData.revenues || []).map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-3 text-gray-600">{item.account_name}</td>
                    <td className="py-3 text-end font-medium text-green-600">
                      {item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-green-700 bg-green-50">
                  <td className="py-3 px-2">{t.totalRevenue}</td>
                  <td className="py-3 px-2 text-end">{reportData.total_revenue?.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expenses */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              {t.expenses}
            </h3>
            <table className="w-full">
              <tbody>
                {(reportData.expenses || []).map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-3 text-gray-600">{item.account_name}</td>
                    <td className="py-3 text-end font-medium text-red-600">
                      ({item.amount.toLocaleString()})
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-red-700 bg-red-50">
                  <td className="py-3 px-2">{t.totalExpenses}</td>
                  <td className="py-3 px-2 text-end">({reportData.total_expenses?.toLocaleString()})</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Net Income */}
          <div className={`p-6 rounded-xl ${reportData.is_profit ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-xl font-bold ${reportData.is_profit ? 'text-green-800' : 'text-red-800'}`}>
                {reportData.is_profit ? t.netIncome : t.netLoss}
              </span>
              <span className={`text-3xl font-bold ${reportData.is_profit ? 'text-green-800' : 'text-red-800'}`}>
                {reportData.net_income?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCashFlow = () => {
    if (!reportData || !reportData.operating_activities) return null;
    const r = reportData, o = r.operating_activities;
    const ar = language === 'ar';
    const fmt = (n) => { const v = Number(n) || 0; const s = Math.abs(v).toLocaleString(ar ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return v < 0 ? `(${s})` : s; };
    const Row = ({ label, value, strong, indent }) => (
      <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'font-bold border-t border-gray-200 mt-1 pt-2' : ''} ${indent ? (ar ? 'pr-5' : 'pl-5') : ''}`}>
        <span>{label}</span><span className="tabular-nums whitespace-nowrap">{fmt(value)}</span></div>
    );
    const Section = ({ title, children }) => (
      <section className="bg-white rounded-xl shadow-sm p-5"><h3 className="font-extrabold text-gray-900 mb-2">{title}</h3>{children}</section>
    );
    return (
      <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
        <Section title={ar ? 'أولاً: التدفقات النقدية من الأنشطة التشغيلية' : 'Operating activities'}>
          <Row label={ar ? 'صافي الربح (الخسارة)' : 'Net profit (loss)'} value={o.net_income} />
          <p className="text-xs text-gray-500 mt-2 mb-1">{ar ? 'تسويات لبنود غير نقدية:' : 'Non-cash adjustments:'}</p>
          <Row indent label={ar ? 'الإهلاك' : 'Depreciation'} value={o.depreciation} />
          {!!o.gains_on_disposal && <Row indent label={ar ? 'أرباح بيع أصول' : 'Gains on disposal'} value={o.gains_on_disposal} />}
          <p className="text-xs text-gray-500 mt-2 mb-1">{ar ? 'التغير في رأس المال العامل:' : 'Working capital changes:'}</p>
          {o.working_capital.map((w) => <Row indent key={w.account} label={`${w.account} — ${w.item}`} value={w.amount} />)}
          <Row strong label={ar ? 'صافي التدفق من الأنشطة التشغيلية' : 'Net cash from operating activities'} value={o.net} />
        </Section>
        <Section title={ar ? 'ثانياً: التدفقات النقدية من الأنشطة الاستثمارية' : 'Investing activities'}>
          {r.investing_activities.items.map((w) => <Row indent key={w.account + w.item} label={`${w.account} — ${w.item}`} value={w.amount} />)}
          <Row strong label={ar ? 'صافي التدفق من الأنشطة الاستثمارية' : 'Net cash from investing activities'} value={r.investing_activities.net} />
        </Section>
        <Section title={ar ? 'ثالثاً: التدفقات النقدية من الأنشطة التمويلية' : 'Financing activities'}>
          {r.financing_activities.items.map((w) => <Row indent key={w.account + w.item} label={`${w.account} — ${w.item}`} value={w.amount} />)}
          <Row strong label={ar ? 'صافي التدفق من الأنشطة التمويلية' : 'Net cash from financing activities'} value={r.financing_activities.net} />
        </Section>
        <section className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <Row strong label={ar ? 'صافي التغير في النقدية' : 'Net change in cash'} value={r.net_change_in_cash} />
          <Row label={ar ? 'النقدية وما في حكمها أول الفترة' : 'Cash at beginning of period'} value={r.opening_cash_balance} />
          <Row strong label={ar ? 'النقدية وما في حكمها آخر الفترة' : 'Cash at end of period'} value={r.closing_cash_balance} />
          <p className={`mt-3 text-sm font-semibold ${r.reconciliation?.reconciled ? 'text-emerald-700' : 'text-red-700'}`}>
            {r.reconciliation?.reconciled
              ? (ar ? '✓ مطابقة لحركة الخزينة والبنوك في دفتر الأستاذ' : '✓ Reconciles to treasury and bank in the ledger')
              : (ar ? `✗ فرق عن الدفتر: ${fmt(r.reconciliation?.difference)}` : `✗ Differs from the ledger by ${fmt(r.reconciliation?.difference)}`)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{r.standard}</p>
        </section>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!reportData) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-[#28376B] to-[#3d4f8f] text-white">
          <h2 className="text-2xl font-bold">{t.balanceSheet}</h2>
          <p className="opacity-80">{t.asOfDate}: {reportData.as_of_date}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 p-6">
          {/* Assets */}
          <div>
            <h3 className="text-xl font-bold text-[#28376B] mb-4 pb-2 border-b-2 border-[#28376B]">
              {t.assets}
            </h3>
            
            {/* Current Assets */}
            {reportData.assets?.current?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">{t.currentAssets}</h4>
                {reportData.assets.current.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account_name}</span>
                    <span className="font-medium">{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Fixed Assets */}
            {reportData.assets?.fixed?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">{t.fixedAssets}</h4>
                {reportData.assets.fixed.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account_name}</span>
                    <span className="font-medium">{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between py-3 bg-blue-50 px-3 rounded-lg font-bold text-[#28376B]">
              <span>{t.totalAssets}</span>
              <span>{reportData.assets?.total?.toLocaleString()}</span>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div>
            <h3 className="text-xl font-bold text-[#28376B] mb-4 pb-2 border-b-2 border-[#28376B]">
              {t.liabilities} & {t.equity}
            </h3>

            {/* Current Liabilities */}
            {reportData.liabilities?.current?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">{t.currentLiabilities}</h4>
                {reportData.liabilities.current.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account_name}</span>
                    <span className="font-medium">{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Long-term Liabilities */}
            {reportData.liabilities?.long_term?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">{t.longTermLiabilities}</h4>
                {reportData.liabilities.long_term.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account_name}</span>
                    <span className="font-medium">{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between py-2 px-3 bg-purple-50 rounded-lg font-semibold text-purple-700 mb-4">
              <span>{t.totalLiabilities}</span>
              <span>{reportData.liabilities?.total?.toLocaleString()}</span>
            </div>

            {/* Equity */}
            {reportData.equity?.items?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">{t.equity}</h4>
                {reportData.equity.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">{item.account_name}</span>
                    <span className="font-medium">{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between py-2 px-3 bg-indigo-50 rounded-lg font-semibold text-indigo-700 mb-4">
              <span>{t.totalEquity}</span>
              <span>{reportData.equity?.total?.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-3 bg-[#28376B] text-white px-3 rounded-lg font-bold">
              <span>{t.totalLiabilitiesAndEquity}</span>
              <span>{reportData.total_liabilities_and_equity?.toLocaleString()}</span>
            </div>

            {/* Balance Check */}
            <div className={`mt-4 p-3 rounded-lg flex items-center justify-center gap-2 ${
              reportData.is_balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {reportData.is_balanced ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{t.balanced}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">{t.notBalanced}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#28376B] flex items-center gap-3">
            <FileText className="w-8 h-8" />
            {t.title}
          </h1>
          <p className="text-gray-600 mt-1">{t.subtitle}</p>
        </div>

        {/* Report Selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeReport === report.id
                      ? 'bg-[#28376B] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <report.icon className="w-5 h-5" />
                  {report.name}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-4">
              {activeReport === 'income-statement' || activeReport === 'cash-flow' ? (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">{t.fromDate}:</label>
                    <input
                      type="date"
                      value={dateFilters.startDate}
                      onChange={(e) => setDateFilters({ ...dateFilters, startDate: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">{t.toDate}:</label>
                    <input
                      type="date"
                      value={dateFilters.endDate}
                      onChange={(e) => setDateFilters({ ...dateFilters, endDate: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">{t.asOfDate}:</label>
                  <input
                    type="date"
                    value={dateFilters.asOfDate}
                    onChange={(e) => setDateFilters({ ...dateFilters, asOfDate: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              
              <button
                onClick={fetchReport}
                className="bg-[#28376B] text-white px-4 py-2 rounded-lg hover:bg-[#1e2a52] transition-colors"
              >
                {t.generate}
              </button>
              
              {reportData && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  data-testid="export-btn"
                >
                  <Download className="w-4 h-4" />
                  {t.export} Excel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-20 flex justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#28376B]" />
          </div>
        ) : !reportData ? (
          <div className="bg-white rounded-xl shadow-sm p-20 text-center text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>{t.noData}</p>
          </div>
        ) : (
          <>
            {activeReport === 'trial-balance' && renderTrialBalance()}
            {activeReport === 'income-statement' && renderIncomeStatement()}
            {activeReport === 'balance-sheet' && renderBalanceSheet()}
            {activeReport === 'cash-flow' && renderCashFlow()}
          </>
        )}
      </div>
    </div>
  );
};

export default FinancialReportsPage;
