import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  Download, FileText, TrendingUp, TrendingDown, DollarSign,
  Calendar, Users, Building, Clock, AlertTriangle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const InvoiceReportsPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [activeReport, setActiveReport] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState('date');

  const t = {
    ar: {
      reports: 'تقارير الفواتير',
      salesReport: 'تقرير المبيعات',
      purchasesReport: 'تقرير المشتريات',
      vatReport: 'تقرير ضريبة القيمة المضافة',
      agingReport: 'تقرير أعمار الديون',
      startDate: 'من تاريخ',
      endDate: 'إلى تاريخ',
      groupBy: 'تجميع حسب',
      date: 'التاريخ',
      customer: 'العميل',
      supplier: 'المورد',
      product: 'المنتج/الخدمة',
      generate: 'إنشاء التقرير',
      export: 'تصدير Excel',
      invoiceCount: 'عدد الفواتير',
      totalSales: 'إجمالي المبيعات',
      totalPurchases: 'إجمالي المشتريات',
      totalTax: 'إجمالي الضريبة',
      totalDiscount: 'إجمالي الخصم',
      totalPaid: 'إجمالي المدفوع',
      totalDue: 'إجمالي المستحق',
      outputTax: 'ضريبة المخرجات (المبيعات)',
      inputTax: 'ضريبة المدخلات (المشتريات)',
      netVat: 'صافي الضريبة المستحقة',
      payable: 'مستحق الدفع',
      refundable: 'مستحق الاسترداد',
      receivables: 'المستحقات (الذمم المدينة)',
      payables: 'المطلوبات (الذمم الدائنة)',
      current: '0-30 يوم',
      days30_60: '31-60 يوم',
      days60_90: '61-90 يوم',
      over90: 'أكثر من 90 يوم',
      totalOutstanding: 'إجمالي المستحق',
      noData: 'لا توجد بيانات',
      invoiceNumber: 'رقم الفاتورة',
      partyName: 'الاسم',
      amount: 'المبلغ',
      daysOverdue: 'أيام التأخير',
      taxableAmount: 'المبلغ الخاضع للضريبة',
      taxAmount: 'مبلغ الضريبة',
      count: 'العدد',
      total: 'الإجمالي',
      quantity: 'الكمية'
    },
    en: {
      reports: 'Invoice Reports',
      salesReport: 'Sales Report',
      purchasesReport: 'Purchases Report',
      vatReport: 'VAT Report',
      agingReport: 'Aging Report',
      startDate: 'Start Date',
      endDate: 'End Date',
      groupBy: 'Group By',
      date: 'Date',
      customer: 'Customer',
      supplier: 'Supplier',
      product: 'Product/Service',
      generate: 'Generate Report',
      export: 'Export Excel',
      invoiceCount: 'Invoice Count',
      totalSales: 'Total Sales',
      totalPurchases: 'Total Purchases',
      totalTax: 'Total Tax',
      totalDiscount: 'Total Discount',
      totalPaid: 'Total Paid',
      totalDue: 'Total Due',
      outputTax: 'Output Tax (Sales)',
      inputTax: 'Input Tax (Purchases)',
      netVat: 'Net VAT Due',
      payable: 'Payable',
      refundable: 'Refundable',
      receivables: 'Receivables',
      payables: 'Payables',
      current: '0-30 Days',
      days30_60: '31-60 Days',
      days60_90: '61-90 Days',
      over90: 'Over 90 Days',
      totalOutstanding: 'Total Outstanding',
      noData: 'No data available',
      invoiceNumber: 'Invoice #',
      partyName: 'Name',
      amount: 'Amount',
      daysOverdue: 'Days Overdue',
      taxableAmount: 'Taxable Amount',
      taxAmount: 'Tax Amount',
      count: 'Count',
      total: 'Total',
      quantity: 'Quantity'
    }
  };

  const text = t[language] || t.ar;
  const getToken = () => localStorage.getItem('token');

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      let url = `${API}/reports/${activeReport}?`;
      
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (activeReport === 'sales' || activeReport === 'purchases') {
        url += `group_by=${groupBy}`;
      }
      if (activeReport === 'aging') {
        url += `report_type=receivables`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        toast.error('Failed to load report');
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Error loading report');
    } finally {
      setLoading(false);
    }
  }, [activeReport, startDate, endDate, groupBy]);

  const handleExport = async () => {
    try {
      const token = getToken();
      let url = `${API}/reports/export/${activeReport}?`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${activeReport}_report.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        toast.success(language === 'ar' ? 'تم تصدير التقرير' : 'Report exported');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Export failed');
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const renderSalesReport = () => {
    if (!reportData) return null;
    const { summary, data, grouped_by } = reportData;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.invoiceCount}</p>
                  <p className="text-2xl font-bold">{summary.invoice_count}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalSales}</p>
                  <p className="text-2xl font-bold text-green-600">{summary.total_sales?.toLocaleString()} EGP</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalTax}</p>
                  <p className="text-2xl font-bold">{summary.total_tax?.toLocaleString()} EGP</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalDue}</p>
                  <p className="text-2xl font-bold text-red-600">{summary.total_due?.toLocaleString()} EGP</p>
                </div>
                <Clock className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grouped Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>{text.salesReport}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {grouped_by === 'date' && <TableHead>{text.date}</TableHead>}
                  {grouped_by === 'customer' && <TableHead>{text.customer}</TableHead>}
                  {grouped_by === 'product' && <TableHead>{text.product}</TableHead>}
                  <TableHead>{text.count}</TableHead>
                  {grouped_by === 'product' && <TableHead>{text.quantity}</TableHead>}
                  <TableHead>{text.total}</TableHead>
                  {grouped_by !== 'product' && <TableHead>{text.totalTax}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">{text.noData}</TableCell>
                  </TableRow>
                ) : (
                  data?.map((item, idx) => (
                    <TableRow key={idx}>
                      {grouped_by === 'date' && <TableCell>{item.date}</TableCell>}
                      {grouped_by === 'customer' && <TableCell>{item.customer_name}</TableCell>}
                      {grouped_by === 'product' && <TableCell>{item.product}</TableCell>}
                      <TableCell>{item.count || '-'}</TableCell>
                      {grouped_by === 'product' && <TableCell>{item.quantity}</TableCell>}
                      <TableCell className="font-medium">{item.total?.toLocaleString()} EGP</TableCell>
                      {grouped_by !== 'product' && <TableCell>{item.tax?.toLocaleString()} EGP</TableCell>}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPurchasesReport = () => {
    if (!reportData) return null;
    const { summary, data, grouped_by } = reportData;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.invoiceCount}</p>
                  <p className="text-2xl font-bold">{summary.invoice_count}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalPurchases}</p>
                  <p className="text-2xl font-bold text-red-600">{summary.total_purchases?.toLocaleString()} EGP</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalTax}</p>
                  <p className="text-2xl font-bold">{summary.total_tax?.toLocaleString()} EGP</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{text.totalDue}</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.total_due?.toLocaleString()} EGP</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{text.purchasesReport}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {grouped_by === 'date' && <TableHead>{text.date}</TableHead>}
                  {grouped_by === 'supplier' && <TableHead>{text.supplier}</TableHead>}
                  {grouped_by === 'product' && <TableHead>{text.product}</TableHead>}
                  <TableHead>{text.count}</TableHead>
                  {grouped_by === 'product' && <TableHead>{text.quantity}</TableHead>}
                  <TableHead>{text.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">{text.noData}</TableCell>
                  </TableRow>
                ) : (
                  data?.map((item, idx) => (
                    <TableRow key={idx}>
                      {grouped_by === 'date' && <TableCell>{item.date}</TableCell>}
                      {grouped_by === 'supplier' && <TableCell>{item.supplier_name}</TableCell>}
                      {grouped_by === 'product' && <TableCell>{item.product}</TableCell>}
                      <TableCell>{item.count || '-'}</TableCell>
                      {grouped_by === 'product' && <TableCell>{item.quantity}</TableCell>}
                      <TableCell className="font-medium">{item.total?.toLocaleString()} EGP</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderVatReport = () => {
    if (!reportData) return null;
    const { output_tax, input_tax, net_vat, tax_breakdown } = reportData;

    return (
      <div className="space-y-6">
        {/* VAT Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">{text.outputTax}</p>
                  <p className="text-3xl font-bold text-green-800 mt-2">{output_tax?.tax_amount?.toLocaleString()} EGP</p>
                  <p className="text-sm text-green-600 mt-1">
                    {output_tax?.invoice_count} {language === 'ar' ? 'فاتورة' : 'invoices'}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium">{text.inputTax}</p>
                  <p className="text-3xl font-bold text-red-800 mt-2">{input_tax?.tax_amount?.toLocaleString()} EGP</p>
                  <p className="text-sm text-red-600 mt-1">
                    {input_tax?.invoice_count} {language === 'ar' ? 'فاتورة' : 'invoices'}
                  </p>
                </div>
                <TrendingDown className="w-12 h-12 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${net_vat?.amount >= 0 ? 'border-blue-400 bg-blue-50' : 'border-purple-400 bg-purple-50'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${net_vat?.amount >= 0 ? 'text-blue-700' : 'text-purple-700'}`}>
                    {text.netVat}
                  </p>
                  <p className={`text-3xl font-bold mt-2 ${net_vat?.amount >= 0 ? 'text-blue-800' : 'text-purple-800'}`}>
                    {net_vat?.amount?.toLocaleString()} EGP
                  </p>
                  <Badge className={`mt-2 ${net_vat?.amount >= 0 ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'}`}>
                    {net_vat?.amount >= 0 ? text.payable : text.refundable}
                  </Badge>
                </div>
                <DollarSign className={`w-12 h-12 ${net_vat?.amount >= 0 ? 'text-blue-500' : 'text-purple-500'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tax Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'تفصيل الضريبة حسب النسبة' : 'Tax Breakdown by Rate'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'نسبة الضريبة' : 'Tax Rate'}</TableHead>
                  <TableHead>{language === 'ar' ? 'وعاء المبيعات' : 'Sales Base'}</TableHead>
                  <TableHead>{language === 'ar' ? 'ضريبة المبيعات' : 'Sales Tax'}</TableHead>
                  <TableHead>{language === 'ar' ? 'وعاء المشتريات' : 'Purchases Base'}</TableHead>
                  <TableHead>{language === 'ar' ? 'ضريبة المشتريات' : 'Purchases Tax'}</TableHead>
                  <TableHead>{language === 'ar' ? 'صافي الضريبة' : 'Net Tax'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tax_breakdown?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.rate}%</TableCell>
                    <TableCell>{item.sales_base?.toLocaleString()} EGP</TableCell>
                    <TableCell className="text-green-600">{item.sales_tax?.toLocaleString()} EGP</TableCell>
                    <TableCell>{item.purchases_base?.toLocaleString()} EGP</TableCell>
                    <TableCell className="text-red-600">{item.purchases_tax?.toLocaleString()} EGP</TableCell>
                    <TableCell className={`font-bold ${item.net_tax >= 0 ? 'text-blue-600' : 'text-purple-600'}`}>
                      {item.net_tax?.toLocaleString()} EGP
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAgingReport = () => {
    if (!reportData) return null;
    const { summary, buckets, by_party } = reportData;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">{text.totalOutstanding}</p>
              <p className="text-2xl font-bold text-red-600">{summary?.total_outstanding?.toLocaleString()} EGP</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">{text.invoiceCount}</p>
              <p className="text-2xl font-bold">{summary?.invoice_count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Age Buckets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-700">{text.current}</span>
              </div>
              <p className="text-2xl font-bold">{buckets?.current?.total?.toLocaleString()} EGP</p>
              <p className="text-sm text-gray-500">{buckets?.current?.count} {language === 'ar' ? 'فاتورة' : 'invoices'}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <span className="font-medium text-yellow-700">{text.days30_60}</span>
              </div>
              <p className="text-2xl font-bold">{buckets?.["30_60"]?.total?.toLocaleString()} EGP</p>
              <p className="text-sm text-gray-500">{buckets?.["30_60"]?.count} {language === 'ar' ? 'فاتورة' : 'invoices'}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <span className="font-medium text-orange-700">{text.days60_90}</span>
              </div>
              <p className="text-2xl font-bold">{buckets?.["60_90"]?.total?.toLocaleString()} EGP</p>
              <p className="text-sm text-gray-500">{buckets?.["60_90"]?.count} {language === 'ar' ? 'فاتورة' : 'invoices'}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-medium text-red-700">{text.over90}</span>
              </div>
              <p className="text-2xl font-bold">{buckets?.over_90?.total?.toLocaleString()} EGP</p>
              <p className="text-sm text-gray-500">{buckets?.over_90?.count} {language === 'ar' ? 'فاتورة' : 'invoices'}</p>
            </CardContent>
          </Card>
        </div>

        {/* By Party */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'تفصيل حسب العميل' : 'Breakdown by Customer'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.partyName}</TableHead>
                  <TableHead>{text.current}</TableHead>
                  <TableHead>{text.days30_60}</TableHead>
                  <TableHead>{text.days60_90}</TableHead>
                  <TableHead>{text.over90}</TableHead>
                  <TableHead>{text.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {by_party?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">{text.noData}</TableCell>
                  </TableRow>
                ) : (
                  by_party?.map((party, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{party.party_name}</TableCell>
                      <TableCell className="text-green-600">{party.current?.toLocaleString()}</TableCell>
                      <TableCell className="text-yellow-600">{party["30_60"]?.toLocaleString()}</TableCell>
                      <TableCell className="text-orange-600">{party["60_90"]?.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">{party.over_90?.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{party.total?.toLocaleString()} EGP</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{text.reports}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {language === 'ar' ? 'تقارير المبيعات والمشتريات والضرائب وأعمار الديون' : 'Sales, Purchases, VAT, and Aging Reports'}
        </p>
      </div>

      {/* Report Type Tabs */}
      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="sales" data-testid="tab-sales">
            <TrendingUp className="w-4 h-4 mr-2" />
            {text.salesReport}
          </TabsTrigger>
          <TabsTrigger value="purchases" data-testid="tab-purchases">
            <TrendingDown className="w-4 h-4 mr-2" />
            {text.purchasesReport}
          </TabsTrigger>
          <TabsTrigger value="vat" data-testid="tab-vat">
            <DollarSign className="w-4 h-4 mr-2" />
            {text.vatReport}
          </TabsTrigger>
          <TabsTrigger value="aging" data-testid="tab-aging">
            <Clock className="w-4 h-4 mr-2" />
            {text.agingReport}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{text.startDate}</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{text.endDate}</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            
            {(activeReport === 'sales' || activeReport === 'purchases') && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.groupBy}</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">{text.date}</SelectItem>
                    <SelectItem value={activeReport === 'sales' ? 'customer' : 'supplier'}>
                      {activeReport === 'sales' ? text.customer : text.supplier}
                    </SelectItem>
                    <SelectItem value="product">{text.product}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={fetchReport} className="bg-[#28376B] hover:bg-[#1e2a52] text-white">
              <Calendar className="w-4 h-4 mr-2" />
              {text.generate}
            </Button>

            {(activeReport === 'sales' || activeReport === 'purchases' || activeReport === 'vat') && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                {text.export}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#28376B]"></div>
        </div>
      ) : (
        <>
          {activeReport === 'sales' && renderSalesReport()}
          {activeReport === 'purchases' && renderPurchasesReport()}
          {activeReport === 'vat' && renderVatReport()}
          {activeReport === 'aging' && renderAgingReport()}
        </>
      )}
    </div>
  );
};

export default InvoiceReportsPage;
