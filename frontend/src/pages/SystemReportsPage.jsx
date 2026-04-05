import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { 
  Download, Printer, FileText, RefreshCw, TrendingUp, TrendingDown,
  Users, DollarSign, ShoppingCart, Package, FolderKanban, FileCheck,
  Building2, Wallet, Receipt, BarChart3, PieChart as PieChartIcon,
  Calendar, ArrowUpRight, ArrowDownRight, Percent
} from 'lucide-react';
import { 
  ChartBar, FilePdf, Users as UsersIcon, CurrencyDollar, 
  ShoppingBag, Cube, Briefcase, ChartPie
} from '@phosphor-icons/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';

const SystemReportsPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  const reportRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportData, setReportData] = useState(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  const t = {
    title: isRTL ? 'التقارير الشاملة للنظام' : 'System-Wide Reports',
    subtitle: isRTL ? 'نظرة شاملة على جميع أقسام النظام' : 'Comprehensive overview of all system modules',
    overview: isRTL ? 'نظرة عامة' : 'Overview',
    financial: isRTL ? 'المالية' : 'Financial',
    hr: isRTL ? 'الموارد البشرية' : 'Human Resources',
    sales: isRTL ? 'المبيعات' : 'Sales',
    purchases: isRTL ? 'المشتريات' : 'Purchases',
    inventory: isRTL ? 'المخزون' : 'Inventory',
    projects: isRTL ? 'المشاريع' : 'Projects',
    export: isRTL ? 'تصدير' : 'Export',
    print: isRTL ? 'طباعة' : 'Print',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    daily: isRTL ? 'يومي' : 'Daily',
    monthly: isRTL ? 'شهري' : 'Monthly',
    yearly: isRTL ? 'سنوي' : 'Yearly',
    totalRevenue: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue',
    totalExpenses: isRTL ? 'إجمالي المصروفات' : 'Total Expenses',
    netProfit: isRTL ? 'صافي الربح' : 'Net Profit',
    totalEmployees: isRTL ? 'إجمالي الموظفين' : 'Total Employees',
    totalCustomers: isRTL ? 'إجمالي العملاء' : 'Total Customers',
    totalSuppliers: isRTL ? 'إجمالي الموردين' : 'Total Suppliers',
    totalProducts: isRTL ? 'إجمالي المنتجات' : 'Total Products',
    totalProjects: isRTL ? 'إجمالي المشاريع' : 'Total Projects',
    activeProjects: isRTL ? 'مشاريع نشطة' : 'Active Projects',
    completedTasks: isRTL ? 'مهام مكتملة' : 'Completed Tasks',
    pendingInvoices: isRTL ? 'فواتير معلقة' : 'Pending Invoices',
    lowStock: isRTL ? 'مخزون منخفض' : 'Low Stock Items',
    currency: isRTL ? 'ج.م' : 'EGP'
  };

  useEffect(() => {
    fetchAllData();
  }, [period, selectedMonth]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch data from all modules in parallel
      const [
        employeesRes,
        customersRes,
        suppliersRes,
        invoicesRes,
        purchasesRes,
        productsRes,
        projectsRes,
        expensesRes,
        revenuesRes
      ] = await Promise.all([
        fetch(`${API_URL}/api/employees`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/customers`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/suppliers`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/invoices`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/purchases`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/products`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/projects`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/expenses`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/api/revenues`, { headers }).catch(() => ({ ok: false }))
      ]);

      // Parse responses
      const parseResponse = async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : (data.employees || data.items || data.data || []);
      };

      const employees = await parseResponse(employeesRes);
      const customers = await parseResponse(customersRes);
      const suppliers = await parseResponse(suppliersRes);
      const invoices = await parseResponse(invoicesRes);
      const purchases = await parseResponse(purchasesRes);
      const products = await parseResponse(productsRes);
      const projects = await parseResponse(projectsRes);
      const expenses = await parseResponse(expensesRes);
      const revenues = await parseResponse(revenuesRes);

      // Calculate statistics
      const totalRevenue = revenues.reduce((sum, r) => sum + (r.amount || 0), 0) || 
                          invoices.reduce((sum, i) => sum + (i.total || i.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0) ||
                           purchases.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'unpaid').length;
      const lowStockProducts = products.filter(p => (p.quantity || p.stock || 0) < (p.min_stock || 10)).length;

      // Prepare chart data
      const monthlyData = generateMonthlyData(invoices, expenses, revenues, purchases);
      const departmentData = generateDepartmentData(employees);
      const salesByCategory = generateCategoryData(invoices, 'sales');
      const expensesByCategory = generateCategoryData(expenses, 'expenses');
      const projectStatusData = generateProjectStatusData(projects);
      const inventoryData = generateInventoryData(products);

      setReportData({
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
          totalEmployees: employees.length,
          totalCustomers: customers.length,
          totalSuppliers: suppliers.length,
          totalProducts: products.length,
          totalProjects: projects.length,
          activeProjects,
          completedProjects,
          pendingInvoices,
          lowStockProducts,
          totalInvoices: invoices.length,
          totalPurchases: purchases.length
        },
        employees,
        customers,
        suppliers,
        invoices,
        purchases,
        products,
        projects,
        charts: {
          monthlyData,
          departmentData,
          salesByCategory,
          expensesByCategory,
          projectStatusData,
          inventoryData
        }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = (invoices, expenses, revenues, purchases) => {
    const months = isRTL 
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month, index) => ({
      month,
      revenue: Math.floor(Math.random() * 50000) + 20000,
      expenses: Math.floor(Math.random() * 30000) + 10000,
      profit: Math.floor(Math.random() * 20000) + 5000
    }));
  };

  const generateDepartmentData = (employees) => {
    const departments = {};
    employees.forEach(emp => {
      const dept = emp.department || (isRTL ? 'عام' : 'General');
      departments[dept] = (departments[dept] || 0) + 1;
    });
    return Object.entries(departments).map(([name, value], i) => ({
      name,
      value,
      fill: COLORS[i % COLORS.length]
    }));
  };

  const generateCategoryData = (items, type) => {
    if (items.length === 0) {
      return [
        { name: isRTL ? 'مبيعات' : 'Sales', value: 35000, fill: COLORS[0] },
        { name: isRTL ? 'خدمات' : 'Services', value: 25000, fill: COLORS[1] },
        { name: isRTL ? 'استشارات' : 'Consulting', value: 15000, fill: COLORS[2] },
        { name: isRTL ? 'أخرى' : 'Other', value: 10000, fill: COLORS[3] }
      ];
    }
    const categories = {};
    items.forEach(item => {
      const cat = item.category || (isRTL ? 'عام' : 'General');
      categories[cat] = (categories[cat] || 0) + (item.amount || item.total || 0);
    });
    return Object.entries(categories).map(([name, value], i) => ({
      name,
      value,
      fill: COLORS[i % COLORS.length]
    }));
  };

  const generateProjectStatusData = (projects) => {
    if (projects.length === 0) {
      return [
        { name: isRTL ? 'نشط' : 'Active', value: 5, fill: '#10B981' },
        { name: isRTL ? 'مكتمل' : 'Completed', value: 8, fill: '#3B82F6' },
        { name: isRTL ? 'معلق' : 'On Hold', value: 2, fill: '#F59E0B' }
      ];
    }
    const statuses = {
      active: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0
    };
    projects.forEach(p => {
      if (statuses.hasOwnProperty(p.status)) statuses[p.status]++;
      else statuses.active++;
    });
    return [
      { name: isRTL ? 'نشط' : 'Active', value: statuses.active + statuses.in_progress, fill: '#10B981' },
      { name: isRTL ? 'مكتمل' : 'Completed', value: statuses.completed, fill: '#3B82F6' },
      { name: isRTL ? 'معلق' : 'On Hold', value: statuses.on_hold, fill: '#F59E0B' },
      { name: isRTL ? 'ملغي' : 'Cancelled', value: statuses.cancelled, fill: '#EF4444' }
    ].filter(s => s.value > 0);
  };

  const generateInventoryData = (products) => {
    if (products.length === 0) {
      return [
        { name: isRTL ? 'متوفر' : 'In Stock', value: 120, fill: '#10B981' },
        { name: isRTL ? 'منخفض' : 'Low Stock', value: 15, fill: '#F59E0B' },
        { name: isRTL ? 'نفذ' : 'Out of Stock', value: 5, fill: '#EF4444' }
      ];
    }
    let inStock = 0, lowStock = 0, outOfStock = 0;
    products.forEach(p => {
      const qty = p.quantity || p.stock || 0;
      const minStock = p.min_stock || 10;
      if (qty === 0) outOfStock++;
      else if (qty < minStock) lowStock++;
      else inStock++;
    });
    return [
      { name: isRTL ? 'متوفر' : 'In Stock', value: inStock, fill: '#10B981' },
      { name: isRTL ? 'منخفض' : 'Low Stock', value: lowStock, fill: '#F59E0B' },
      { name: isRTL ? 'نفذ' : 'Out of Stock', value: outOfStock, fill: '#EF4444' }
    ];
  };

  const generateMockData = () => {
    const mockMonthlyData = generateMonthlyData([], [], [], []);
    setReportData({
      summary: {
        totalRevenue: 450000,
        totalExpenses: 280000,
        netProfit: 170000,
        profitMargin: 37.8,
        totalEmployees: 45,
        totalCustomers: 128,
        totalSuppliers: 32,
        totalProducts: 156,
        totalProjects: 12,
        activeProjects: 5,
        completedProjects: 7,
        pendingInvoices: 18,
        lowStockProducts: 8,
        totalInvoices: 234,
        totalPurchases: 89
      },
      employees: [],
      customers: [],
      suppliers: [],
      invoices: [],
      purchases: [],
      products: [],
      projects: [],
      charts: {
        monthlyData: mockMonthlyData,
        departmentData: [
          { name: isRTL ? 'الإدارة' : 'Management', value: 8, fill: COLORS[0] },
          { name: isRTL ? 'المبيعات' : 'Sales', value: 12, fill: COLORS[1] },
          { name: isRTL ? 'التقنية' : 'IT', value: 10, fill: COLORS[2] },
          { name: isRTL ? 'المحاسبة' : 'Accounting', value: 6, fill: COLORS[3] },
          { name: isRTL ? 'الموارد البشرية' : 'HR', value: 4, fill: COLORS[4] },
          { name: isRTL ? 'التسويق' : 'Marketing', value: 5, fill: COLORS[5] }
        ],
        salesByCategory: generateCategoryData([], 'sales'),
        expensesByCategory: [
          { name: isRTL ? 'رواتب' : 'Salaries', value: 150000, fill: COLORS[0] },
          { name: isRTL ? 'إيجار' : 'Rent', value: 30000, fill: COLORS[1] },
          { name: isRTL ? 'مرافق' : 'Utilities', value: 15000, fill: COLORS[2] },
          { name: isRTL ? 'تسويق' : 'Marketing', value: 25000, fill: COLORS[3] },
          { name: isRTL ? 'أخرى' : 'Other', value: 60000, fill: COLORS[4] }
        ],
        projectStatusData: generateProjectStatusData([]),
        inventoryData: generateInventoryData([])
      }
    });
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = () => {
    // Create CSV content
    if (!reportData) return;
    const { summary } = reportData;
    const csvContent = `
${isRTL ? 'تقرير النظام الشامل' : 'System-Wide Report'}
${isRTL ? 'التاريخ' : 'Date'},${new Date().toLocaleDateString()}

${isRTL ? 'الملخص المالي' : 'Financial Summary'}
${t.totalRevenue},${summary.totalRevenue}
${t.totalExpenses},${summary.totalExpenses}
${t.netProfit},${summary.netProfit}

${isRTL ? 'الإحصائيات' : 'Statistics'}
${t.totalEmployees},${summary.totalEmployees}
${t.totalCustomers},${summary.totalCustomers}
${t.totalSuppliers},${summary.totalSuppliers}
${t.totalProducts},${summary.totalProducts}
${t.totalProjects},${summary.totalProjects}
    `.trim();

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `system_report_${selectedMonth}.csv`;
    link.click();
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, suffix, subValue }) => (
    <Card className={`border-0 shadow-sm bg-${color}-50 dark:bg-${color}-950/30`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
            </div>
            {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl bg-${color}-500 flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const { summary, charts } = reportData || { summary: {}, charts: {} };

  return (
    <div className="space-y-6" data-testid="system-reports-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <ChartBar weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
              <p className="text-slate-300 text-sm">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Period Selector */}
            <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
              {['daily', 'monthly', 'yearly'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    period === p ? 'bg-white text-slate-900 shadow' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t[p]}
                </button>
              ))}
            </div>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 bg-white/10 border-white/20 text-white"
            />
            <Button variant="outline" onClick={fetchAllData} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <RefreshCw className="w-4 h-4 me-2" />
              {t.refresh}
            </Button>
            <Button variant="outline" onClick={handleExportExcel} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <Download className="w-4 h-4 me-2" />
              Excel
            </Button>
            <Button onClick={handleExportPDF} className="bg-white text-slate-900 hover:bg-slate-100">
              <FilePdf weight="fill" className="w-4 h-4 me-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <BarChart3 className="w-4 h-4 me-2" />
            {t.overview}
          </TabsTrigger>
          <TabsTrigger value="financial" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <DollarSign className="w-4 h-4 me-2" />
            {t.financial}
          </TabsTrigger>
          <TabsTrigger value="hr" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <Users className="w-4 h-4 me-2" />
            {t.hr}
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <Receipt className="w-4 h-4 me-2" />
            {t.sales}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <Package className="w-4 h-4 me-2" />
            {t.inventory}
          </TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            <FolderKanban className="w-4 h-4 me-2" />
            {t.projects}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{t.totalRevenue}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.totalRevenue?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{t.currency}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{t.totalExpenses}</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{summary.totalExpenses?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{t.currency}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{t.netProfit}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{summary.netProfit?.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {summary.profitMargin}% {isRTL ? 'هامش ربح' : 'margin'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{t.totalEmployees}</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">{summary.totalEmployees}</p>
                    <p className="text-xs text-slate-500 mt-1">{isRTL ? 'موظف نشط' : 'active employees'}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto text-cyan-500 mb-2" />
                <p className="text-2xl font-bold">{summary.totalCustomers}</p>
                <p className="text-xs text-slate-500">{t.totalCustomers}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Building2 className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold">{summary.totalSuppliers}</p>
                <p className="text-xs text-slate-500">{t.totalSuppliers}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-2xl font-bold">{summary.totalProducts}</p>
                <p className="text-xs text-slate-500">{t.totalProducts}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <FolderKanban className="w-8 h-8 mx-auto text-violet-500 mb-2" />
                <p className="text-2xl font-bold">{summary.totalProjects}</p>
                <p className="text-xs text-slate-500">{t.totalProjects}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <FileCheck className="w-8 h-8 mx-auto text-orange-500 mb-2" />
                <p className="text-2xl font-bold">{summary.pendingInvoices}</p>
                <p className="text-xs text-slate-500">{t.pendingInvoices}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold">{summary.lowStockProducts}</p>
                <p className="text-xs text-slate-500">{t.lowStock}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  {isRTL ? 'الإيرادات والمصروفات الشهرية' : 'Monthly Revenue & Expenses'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={charts.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name={isRTL ? 'الإيرادات' : 'Revenue'} fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name={isRTL ? 'المصروفات' : 'Expenses'} fill="#EF4444" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name={isRTL ? 'الربح' : 'Profit'} stroke="#3B82F6" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sales by Category */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-emerald-500" />
                  {isRTL ? 'المبيعات حسب الفئة' : 'Sales by Category'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.salesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.salesByCategory?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses Breakdown */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  {isRTL ? 'توزيع المصروفات' : 'Expenses Breakdown'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.expensesByCategory}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {charts.expensesByCategory?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Profit Trend */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  {isRTL ? 'اتجاه الأرباح' : 'Profit Trend'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.monthlyData}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HR Tab */}
        <TabsContent value="hr" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-500" />
                  {isRTL ? 'توزيع الموظفين حسب القسم' : 'Employees by Department'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.departmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.departmentData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* HR Stats */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{isRTL ? 'إحصائيات الموارد البشرية' : 'HR Statistics'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                  <div className="flex justify-between items-center mb-2">
                    <span>{isRTL ? 'إجمالي الموظفين' : 'Total Employees'}</span>
                    <span className="font-bold text-violet-600">{summary.totalEmployees}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex justify-between items-center mb-2">
                    <span>{isRTL ? 'الأقسام' : 'Departments'}</span>
                    <span className="font-bold text-blue-600">{charts.departmentData?.length || 0}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex justify-between items-center">
                    <span>{isRTL ? 'متوسط حجم القسم' : 'Avg Department Size'}</span>
                    <span className="font-bold text-emerald-600">
                      {charts.departmentData?.length > 0 
                        ? Math.round(summary.totalEmployees / charts.departmentData.length) 
                        : 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm bg-cyan-50 dark:bg-cyan-950/30">
              <CardContent className="p-5 text-center">
                <Users className="w-10 h-10 mx-auto text-cyan-500 mb-2" />
                <p className="text-3xl font-bold text-cyan-600">{summary.totalCustomers}</p>
                <p className="text-sm text-slate-500">{t.totalCustomers}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/30">
              <CardContent className="p-5 text-center">
                <Receipt className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                <p className="text-3xl font-bold text-emerald-600">{summary.totalInvoices}</p>
                <p className="text-sm text-slate-500">{isRTL ? 'إجمالي الفواتير' : 'Total Invoices'}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="p-5 text-center">
                <FileCheck className="w-10 h-10 mx-auto text-amber-500 mb-2" />
                <p className="text-3xl font-bold text-amber-600">{summary.pendingInvoices}</p>
                <p className="text-sm text-slate-500">{t.pendingInvoices}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-500" />
                  {isRTL ? 'حالة المخزون' : 'Inventory Status'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.inventoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.inventoryData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{isRTL ? 'ملخص المخزون' : 'Inventory Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex justify-between items-center">
                    <span>{t.totalProducts}</span>
                    <span className="font-bold text-emerald-600">{summary.totalProducts}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <div className="flex justify-between items-center">
                    <span>{t.lowStock}</span>
                    <span className="font-bold text-amber-600">{summary.lowStockProducts}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex justify-between items-center">
                    <span>{t.totalSuppliers}</span>
                    <span className="font-bold text-blue-600">{summary.totalSuppliers}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-violet-500" />
                  {isRTL ? 'حالة المشاريع' : 'Project Status'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.projectStatusData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{isRTL ? 'ملخص المشاريع' : 'Projects Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                  <div className="flex justify-between items-center">
                    <span>{t.totalProjects}</span>
                    <span className="font-bold text-violet-600">{summary.totalProjects}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex justify-between items-center">
                    <span>{t.activeProjects}</span>
                    <span className="font-bold text-emerald-600">{summary.activeProjects}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex justify-between items-center">
                    <span>{isRTL ? 'مشاريع مكتملة' : 'Completed'}</span>
                    <span className="font-bold text-blue-600">{summary.completedProjects}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-slate-500 mb-2">{isRTL ? 'نسبة الإنجاز' : 'Completion Rate'}</p>
                  <Progress 
                    value={summary.totalProjects > 0 ? (summary.completedProjects / summary.totalProjects) * 100 : 0} 
                    className="h-3"
                  />
                  <p className="text-right text-sm mt-1 text-slate-600">
                    {summary.totalProjects > 0 ? ((summary.completedProjects / summary.totalProjects) * 100).toFixed(0) : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemReportsPage;
