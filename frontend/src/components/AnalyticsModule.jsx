import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Package, 
  Download, FileText, Calendar, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const AnalyticsModule = ({ language, userRole }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    overview: null,
    financial: null,
    hr: null,
    inventory: null
  });

  const isRTL = language === 'ar';
  
  // Version check - v2.0 - PDF/Excel export fixed
  useEffect(() => {
    console.log('AnalyticsModule v2.0 loaded - PDF/Excel export available');
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [overviewRes, financialRes, hrRes, inventoryRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/overview?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/financial?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/hr?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/analytics/inventory?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const overview = await overviewRes.json();
      const financial = await financialRes.json();
      const hr = await hrRes.json();
      const inventory = await inventoryRes.json();

      setAnalyticsData({ overview, financial, hr, inventory });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const { overview, financial, hr, inventory } = analyticsData;
    if (!overview) {
      alert(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }
    
    try {
      console.log('Starting PDF export...');

      const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(language === 'ar' ? 'تقرير التحليلات' : 'Analytics Report', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${language === 'ar' ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    doc.text(`${language === 'ar' ? 'الفترة' : 'Period'}: ${period}`, pageWidth / 2, yPosition + 5, { align: 'center' });

    yPosition += 20;

    // Overview Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(language === 'ar' ? 'نظرة عامة' : 'Overview', 14, yPosition);
    yPosition += 10;

    // Financial Metrics
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(language === 'ar' ? 'المؤشرات المالية:' : 'Financial Metrics:', 14, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${language === 'ar' ? 'صافي الربح' : 'Net Profit'}: ${overview.financial_analytics.net_profit.toLocaleString()}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'هامش الربح' : 'Profit Margin'}: ${overview.financial_analytics.profit_margin.toFixed(1)}%`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}: ${overview.financial_analytics.total_revenue.toLocaleString()}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}: ${overview.financial_analytics.total_expenses.toLocaleString()}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'العملاء' : 'Customers'}: ${overview.financial_analytics.total_customers}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'الموردين' : 'Suppliers'}: ${overview.financial_analytics.total_suppliers}`, 20, yPosition);

    yPosition += 12;

    // HR Metrics
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(language === 'ar' ? 'مؤشرات الموارد البشرية:' : 'HR Metrics:', 14, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}: ${overview.hr_analytics.total_employees}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'البدلات' : 'Allowances'}: ${overview.hr_analytics.total_allowances}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'الخصومات' : 'Deductions'}: ${overview.hr_analytics.total_deductions}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'الإجازات' : 'Leaves'}: ${overview.hr_analytics.total_leaves}`, 20, yPosition);

    yPosition += 12;

    // Inventory Metrics
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(language === 'ar' ? 'مؤشرات المخزون:' : 'Inventory Metrics:', 14, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${language === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}: ${overview.inventory_analytics.total_items}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'متوفر' : 'In Stock'}: ${overview.inventory_analytics.in_stock_items}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}: ${overview.inventory_analytics.low_stock_items}`, 20, yPosition);
    yPosition += 6;
    doc.text(`${language === 'ar' ? 'القيمة الكلية' : 'Total Value'}: ${overview.inventory_analytics.total_value.toLocaleString()}`, 20, yPosition);

    // Add new page for detailed data if available
    if (financial && financial.revenue_by_month && financial.revenue_by_month.length > 0) {
      doc.addPage();
      yPosition = 20;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(language === 'ar' ? 'الإيرادات والمصروفات حسب الشهر' : 'Revenue & Expenses by Month', 14, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      financial.revenue_by_month.slice(0, 12).forEach((item, idx) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        const expense = financial.expenses_by_month[idx]?.amount || 0;
        doc.text(`${item.month}: ${language === 'ar' ? 'إيرادات' : 'Revenue'} ${item.amount.toLocaleString()}, ${language === 'ar' ? 'مصروفات' : 'Expenses'} ${expense.toLocaleString()}`, 20, yPosition);
        yPosition += 6;
      });
    }

    // Save PDF
    const filename = `analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
    console.log('Saving PDF:', filename);
    doc.save(filename);
    console.log('PDF export completed!');
    alert(language === 'ar' ? 'تم تصدير التقرير بنجاح! تحقق من مجلد التنزيلات.' : 'Report exported successfully! Check your downloads folder.');
  } catch (error) {
    console.error('PDF export error:', error);
    alert(language === 'ar' ? 'حدث خطأ أثناء التصدير: ' + error.message : 'Export error: ' + error.message);
  }
  };

  const exportToExcel = () => {
    const { overview, financial, hr, inventory } = analyticsData;
    if (!overview) {
      alert(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

    // Overview Sheet
    const overviewData = [
      [language === 'ar' ? 'تقرير التحليلات - نظرة عامة' : 'Analytics Report - Overview'],
      [language === 'ar' ? 'التاريخ' : 'Date', new Date().toLocaleDateString()],
      [language === 'ar' ? 'الفترة' : 'Period', period],
      [],
      [language === 'ar' ? 'المؤشرات المالية' : 'Financial Metrics'],
      [language === 'ar' ? 'صافي الربح' : 'Net Profit', overview.financial_analytics.net_profit],
      [language === 'ar' ? 'هامش الربح' : 'Profit Margin', `${overview.financial_analytics.profit_margin.toFixed(1)}%`],
      [language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue', overview.financial_analytics.total_revenue],
      [language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses', overview.financial_analytics.total_expenses],
      [language === 'ar' ? 'إجمالي العملاء' : 'Total Customers', overview.financial_analytics.total_customers],
      [language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers', overview.financial_analytics.total_suppliers],
      [],
      [language === 'ar' ? 'مؤشرات الموارد البشرية' : 'HR Metrics'],
      [language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', overview.hr_analytics.total_employees],
      [language === 'ar' ? 'البدلات' : 'Allowances', overview.hr_analytics.total_allowances],
      [language === 'ar' ? 'الخصومات' : 'Deductions', overview.hr_analytics.total_deductions],
      [language === 'ar' ? 'الإجازات' : 'Leaves', overview.hr_analytics.total_leaves],
      [],
      [language === 'ar' ? 'مؤشرات المخزون' : 'Inventory Metrics'],
      [language === 'ar' ? 'إجمالي الأصناف' : 'Total Items', overview.inventory_analytics.total_items],
      [language === 'ar' ? 'متوفر' : 'In Stock', overview.inventory_analytics.in_stock_items],
      [language === 'ar' ? 'مخزون منخفض' : 'Low Stock', overview.inventory_analytics.low_stock_items],
      [language === 'ar' ? 'القيمة الكلية' : 'Total Value', overview.inventory_analytics.total_value]
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, language === 'ar' ? 'نظرة عامة' : 'Overview');

    // Financial Sheet
    if (financial && financial.revenue_by_month) {
      const financialData = [
        [language === 'ar' ? 'التحليلات المالية' : 'Financial Analytics'],
        [],
        [language === 'ar' ? 'الإيرادات والمصروفات حسب الشهر' : 'Revenue and Expenses by Month'],
        [language === 'ar' ? 'الشهر' : 'Month', language === 'ar' ? 'الإيرادات' : 'Revenue', language === 'ar' ? 'المصروفات' : 'Expenses']
      ];
      
      financial.revenue_by_month.forEach((item, idx) => {
        financialData.push([
          item.month,
          item.amount,
          financial.expenses_by_month[idx]?.amount || 0
        ]);
      });

      financialData.push([]);
      financialData.push([language === 'ar' ? 'أرصدة العملاء' : 'Customer Balances']);
      financialData.push([language === 'ar' ? 'الاسم' : 'Name', language === 'ar' ? 'الرصيد' : 'Balance']);
      financial.customer_balances.forEach(customer => {
        financialData.push([customer.name, customer.balance]);
      });

      const financialSheet = XLSX.utils.aoa_to_sheet(financialData);
      XLSX.utils.book_append_sheet(wb, financialSheet, language === 'ar' ? 'المالية' : 'Financial');
    }

    // HR Sheet
    if (hr && hr.department_distribution) {
      const hrData = [
        [language === 'ar' ? 'تحليلات الموارد البشرية' : 'HR Analytics'],
        [],
        [language === 'ar' ? 'توزيع الموظفين حسب القسم' : 'Employee Distribution by Department'],
        [language === 'ar' ? 'القسم' : 'Department', language === 'ar' ? 'العدد' : 'Count']
      ];
      
      hr.department_distribution.forEach(dept => {
        hrData.push([dept.department, dept.count]);
      });

      hrData.push([]);
      hrData.push([language === 'ar' ? 'توزيع الرواتب' : 'Salary Distribution']);
      hrData.push([language === 'ar' ? 'النطاق' : 'Range', language === 'ar' ? 'العدد' : 'Count']);
      hr.salary_distribution.forEach(salary => {
        hrData.push([salary.range, salary.count]);
      });

      const hrSheet = XLSX.utils.aoa_to_sheet(hrData);
      XLSX.utils.book_append_sheet(wb, hrSheet, language === 'ar' ? 'الموارد البشرية' : 'HR');
    }

    // Inventory Sheet
    if (inventory && inventory.category_distribution) {
      const inventoryData = [
        [language === 'ar' ? 'تحليلات المخزون' : 'Inventory Analytics'],
        [],
        [language === 'ar' ? 'توزيع الأصناف حسب الفئة' : 'Items by Category'],
        [language === 'ar' ? 'الفئة' : 'Category', language === 'ar' ? 'العدد' : 'Count', language === 'ar' ? 'القيمة' : 'Value']
      ];
      
      inventory.category_distribution.forEach(cat => {
        inventoryData.push([cat.category, cat.count, cat.value]);
      });

      inventoryData.push([]);
      inventoryData.push([language === 'ar' ? 'تنبيهات المخزون المنخفض' : 'Low Stock Alerts']);
      if (inventory.low_stock_alerts.length > 0) {
        inventoryData.push([language === 'ar' ? 'الصنف' : 'Item', language === 'ar' ? 'الكمية' : 'Quantity', language === 'ar' ? 'الحد الأدنى' : 'Min Stock']);
        inventory.low_stock_alerts.forEach(item => {
          inventoryData.push([item.name, item.quantity, item.min_stock]);
        });
      } else {
        inventoryData.push([language === 'ar' ? 'لا توجد تنبيهات' : 'No alerts']);
      }

      const inventorySheet = XLSX.utils.aoa_to_sheet(inventoryData);
      XLSX.utils.book_append_sheet(wb, inventorySheet, language === 'ar' ? 'المخزون' : 'Inventory');
    }

    // Save Excel file
    const filename = `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    alert(language === 'ar' ? 'تم تصدير التقرير بنجاح! تحقق من مجلد التنزيلات.' : 'Report exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Excel export error:', error);
      alert(language === 'ar' ? 'حدث خطأ أثناء التصدير: ' + error.message : 'Export error: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  const { overview, financial, hr, inventory } = analyticsData;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {language === 'ar' ? 'التحليلات المتقدمة' : 'Advanced Analytics'}
          </h2>
          <p className="text-gray-600 mt-1">
            {language === 'ar' ? 'رؤى شاملة لأداء مؤسستك' : 'Comprehensive insights'}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setPeriod('daily')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                period === 'daily' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {language === 'ar' ? 'يومي' : 'Daily'}
            </button>
            <button onClick={() => setPeriod('monthly')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                period === 'monthly' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {language === 'ar' ? 'شهري' : 'Monthly'}
            </button>
            <button onClick={() => setPeriod('yearly')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                period === 'yearly' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {language === 'ar' ? 'سنوي' : 'Yearly'}
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={exportToPDF} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>{language === 'ar' ? 'PDF' : 'PDF'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>{language === 'ar' ? 'Excel' : 'Excel'}</span>
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-4 overflow-x-auto">
          {[
            { id: 'overview', label: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: BarChart3 },
            { id: 'financial', label: language === 'ar' ? 'المالية' : 'Financial', icon: DollarSign },
            { id: 'hr', label: language === 'ar' ? 'الموارد البشرية' : 'HR', icon: Users },
            { id: 'inventory', label: language === 'ar' ? 'المخزون' : 'Inventory', icon: Package }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition whitespace-nowrap ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}>
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{overview.financial_analytics.net_profit.toLocaleString()}</h3>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {overview.financial_analytics.profit_margin.toFixed(1)}%
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{overview.hr_analytics.total_employees}</h3>
                    <p className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'موظف نشط' : 'Active'}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{language === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{overview.inventory_analytics.total_value.toLocaleString()}</h3>
                    <p className="text-xs text-gray-500 mt-1">{overview.inventory_analytics.total_items} {language === 'ar' ? 'صنف' : 'items'}</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{overview.financial_analytics.total_customers}</h3>
                    <p className="text-xs text-gray-500 mt-1">{overview.financial_analytics.total_suppliers} {language === 'ar' ? 'موردين' : 'suppliers'}</p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'financial' && financial && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={financial.revenue_by_month.map((item, idx) => ({
                month: item.month,
                revenue: item.amount,
                expenses: financial.expenses_by_month[idx]?.amount || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#10b981" name={language === 'ar' ? 'الإيرادات' : 'Revenue'} />
                <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" name={language === 'ar' ? 'المصروفات' : 'Expenses'} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeTab === 'hr' && hr && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'توزيع الموظفين' : 'Employee Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={hr.department_distribution} cx="50%" cy="50%" labelLine={false}
                  label={(entry) => `${entry.department}: ${entry.count}`} outerRadius={80} dataKey="count">
                  {hr.department_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {activeTab === 'inventory' && inventory && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'توزيع الفئات' : 'Category Distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={inventory.category_distribution} cx="50%" cy="50%" labelLine={false}
                      label={(entry) => `${entry.category}: ${entry.count}`} outerRadius={80} dataKey="count">
                      {inventory.category_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'حالة المخزون' : 'Stock Status'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={inventory.status_distribution} cx="50%" cy="50%" labelLine={false}
                      label={(entry) => `${entry.status === 'in-stock' ? (language === 'ar' ? 'متوفر' : 'In Stock') : (language === 'ar' ? 'منخفض' : 'Low')}: ${entry.count}`}
                      outerRadius={80} dataKey="count">
                      {inventory.status_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.status === 'in-stock' ? '#10b981' : '#ef4444'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {inventory.low_stock_alerts.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-600">
                  {language === 'ar' ? '⚠️ تنبيهات المخزون' : '⚠️ Low Stock Alerts'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inventory.low_stock_alerts.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-gray-600">
                        {language === 'ar' ? 'الكمية' : 'Qty'}: {item.quantity} / {item.min_stock}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};