import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Package, 
  FileText, AlertTriangle, CheckCircle, Clock, Building2, CreditCard,
  ArrowUpRight, ArrowDownRight, RefreshCw, Bell, Settings, Calendar,
  Wallet, ShoppingCart, PieChart, Activity, Loader2, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from 'recharts';

const AdminDashboardPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    // الموظفين
    totalEmployees: 0,
    activeEmployees: 0,
    newEmployeesThisMonth: 0,
    // المالية
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    revenueGrowth: 0,
    // البنك
    totalBankBalance: 0,
    todayDeposits: 0,
    todayWithdrawals: 0,
    // الفواتير
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalInvoiceAmount: 0,
    // المخزون
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    // العملاء والموردين
    totalCustomers: 0,
    totalSuppliers: 0,
    // المشاريع
    activeProjects: 0,
    completedProjects: 0
  });
  
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch all data in parallel
      const [
        employeesRes,
        customersRes,
        suppliersRes,
        invoicesRes,
        bankRes,
        transactionsRes,
        productsRes,
        projectsRes
      ] = await Promise.all([
        fetch(`${API_URL}/api/employees`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/customers`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/suppliers`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/invoices`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/bank-accounts`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/bank-transactions`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/products`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/projects`, { headers }).catch(() => null)
      ]);

      // Process employees
      if (employeesRes?.ok) {
        const data = await employeesRes.json();
        const employees = Array.isArray(data) ? data : (data.data || data.employees || []);
        const active = employees.filter(e => e.is_active !== false);
        setStats(prev => ({
          ...prev,
          totalEmployees: employees.length,
          activeEmployees: active.length
        }));
      }

      // Process customers
      if (customersRes?.ok) {
        const data = await customersRes.json();
        setStats(prev => ({
          ...prev,
          totalCustomers: (data.customers || data || []).length
        }));
      }

      // Process suppliers
      if (suppliersRes?.ok) {
        const data = await suppliersRes.json();
        setStats(prev => ({
          ...prev,
          totalSuppliers: (data.suppliers || data || []).length
        }));
      }

      // Process invoices
      if (invoicesRes?.ok) {
        const data = await invoicesRes.json();
        const invoices = data.invoices || data || [];
        const pending = invoices.filter(i => i.status === 'pending' || i.status === 'sent');
        const overdue = invoices.filter(i => {
          if (!i.due_date) return false;
          return new Date(i.due_date) < new Date() && i.status !== 'paid';
        });
        const totalAmount = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
        
        setStats(prev => ({
          ...prev,
          pendingInvoices: pending.length,
          overdueInvoices: overdue.length,
          totalInvoiceAmount: totalAmount,
          totalRevenue: totalAmount * 0.8 // Approximate
        }));
      }

      // Process bank accounts
      if (bankRes?.ok) {
        const data = await bankRes.json();
        const accounts = data.accounts || [];
        const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || a.balance || 0), 0);
        
        setStats(prev => ({
          ...prev,
          totalBankBalance: totalBalance
        }));
      }

      // Process transactions
      if (transactionsRes?.ok) {
        const data = await transactionsRes.json();
        const transactions = data.transactions || [];
        setRecentTransactions(transactions.slice(0, 5));
        
        const today = new Date().toISOString().split('T')[0];
        const todayTxns = transactions.filter(t => t.transaction_date === today);
        const deposits = todayTxns.filter(t => ['deposit', 'check_deposit', 'transfer_in'].includes(t.transaction_type));
        const withdrawals = todayTxns.filter(t => ['withdrawal', 'check_issued', 'transfer_out'].includes(t.transaction_type));
        
        setStats(prev => ({
          ...prev,
          todayDeposits: deposits.reduce((sum, t) => sum + t.amount, 0),
          todayWithdrawals: withdrawals.reduce((sum, t) => sum + t.amount, 0)
        }));
      }

      // Process products
      if (productsRes?.ok) {
        const data = await productsRes.json();
        const products = data.products || data || [];
        const lowStock = products.filter(p => (p.stock || 0) <= (p.reorder_level || 10) && (p.stock || 0) > 0);
        const outOfStock = products.filter(p => (p.stock || 0) === 0);
        
        setStats(prev => ({
          ...prev,
          totalProducts: products.length,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length
        }));
      }

      // Process projects
      if (projectsRes?.ok) {
        const data = await projectsRes.json();
        const projects = data.projects || data || [];
        const active = projects.filter(p => p.status === 'active' || p.status === 'in_progress');
        const completed = projects.filter(p => p.status === 'completed');
        
        setStats(prev => ({
          ...prev,
          activeProjects: active.length,
          completedProjects: completed.length
        }));
      }

      // Generate sample monthly data
      generateMonthlyData();
      generateExpensesData();
      generateAlerts();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = () => {
    const months = language === 'ar' 
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const data = months.map((month, i) => ({
      month,
      revenue: Math.floor(Math.random() * 500000) + 200000,
      expenses: Math.floor(Math.random() * 300000) + 100000,
      profit: Math.floor(Math.random() * 200000) + 50000
    }));
    
    setMonthlyData(data);
  };

  const generateExpensesData = () => {
    const categories = language === 'ar'
      ? [
        { name: 'رواتب', value: 45, color: '#3b82f6' },
        { name: 'إيجار', value: 20, color: '#10b981' },
        { name: 'مرافق', value: 15, color: '#f59e0b' },
        { name: 'تسويق', value: 10, color: '#ef4444' },
        { name: 'أخرى', value: 10, color: '#8b5cf6' }
      ]
      : [
        { name: 'Salaries', value: 45, color: '#3b82f6' },
        { name: 'Rent', value: 20, color: '#10b981' },
        { name: 'Utilities', value: 15, color: '#f59e0b' },
        { name: 'Marketing', value: 10, color: '#ef4444' },
        { name: 'Other', value: 10, color: '#8b5cf6' }
      ];
    
    setExpensesByCategory(categories);
  };

  const generateAlerts = () => {
    const alertsList = [
      {
        type: 'warning',
        title: language === 'ar' ? 'مخزون منخفض' : 'Low Stock',
        message: language === 'ar' ? '5 منتجات تحتاج إعادة طلب' : '5 products need reorder',
        icon: Package
      },
      {
        type: 'danger',
        title: language === 'ar' ? 'فواتير متأخرة' : 'Overdue Invoices',
        message: language === 'ar' ? '3 فواتير متأخرة السداد' : '3 invoices are overdue',
        icon: FileText
      },
      {
        type: 'info',
        title: language === 'ar' ? 'عقود منتهية' : 'Expiring Contracts',
        message: language === 'ar' ? '2 عقود تنتهي خلال 30 يوم' : '2 contracts expiring in 30 days',
        icon: Users
      }
    ];
    
    setAlerts(alertsList);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const StatCard = ({ title, value, icon: Icon, change, changeType, color, subValue }) => (
    <Card className="border-0 shadow-lg dark:bg-slate-800 hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <p className="text-2xl font-bold dark:text-white">{value}</p>
            {subValue && (
              <p className="text-xs text-gray-400 mt-1">{subValue}</p>
            )}
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${changeType === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {changeType === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>{change}%</span>
                <span className="text-gray-400 text-xs">{language === 'ar' ? 'من الشهر السابق' : 'from last month'}</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 bg-gray-50 dark:bg-slate-900 min-h-screen ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {language === 'ar' ? 'لوحة التحكم الإدارية' : 'Admin Dashboard'}
              </h1>
              <p className="text-white/70 mt-1">
                {language === 'ar' ? 'نظرة شاملة على أداء الشركة' : 'Complete overview of company performance'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RefreshCw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} ${refreshing ? 'animate-spin' : ''}`} />
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Bell className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {alerts.length}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Row 1 - Financial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
          value={`${(stats.totalRevenue || 0).toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`}
          icon={TrendingUp}
          change={12.5}
          changeType="up"
          color="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <StatCard
          title={language === 'ar' ? 'رصيد البنوك' : 'Bank Balance'}
          value={`${(stats.totalBankBalance || 0).toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`}
          icon={Wallet}
          subValue={`${language === 'ar' ? 'إيداعات اليوم:' : "Today's deposits:"} ${stats.todayDeposits.toLocaleString()}`}
          color="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <StatCard
          title={language === 'ar' ? 'فواتير معلقة' : 'Pending Invoices'}
          value={stats.pendingInvoices}
          icon={FileText}
          subValue={`${stats.overdueInvoices} ${language === 'ar' ? 'متأخرة' : 'overdue'}`}
          color="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <StatCard
          title={language === 'ar' ? 'صافي الربح' : 'Net Profit'}
          value={`${((stats.totalRevenue || 0) * 0.25).toLocaleString()} ${language === 'ar' ? 'ج.م' : 'EGP'}`}
          icon={DollarSign}
          change={8.3}
          changeType="up"
          color="bg-gradient-to-br from-purple-500 to-pink-600"
        />
      </div>

      {/* Quick Stats Row 2 - Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={language === 'ar' ? 'الموظفين' : 'Employees'}
          value={stats.totalEmployees}
          icon={Users}
          subValue={`${stats.activeEmployees} ${language === 'ar' ? 'نشط' : 'active'}`}
          color="bg-gradient-to-br from-cyan-500 to-teal-600"
        />
        <StatCard
          title={language === 'ar' ? 'العملاء' : 'Customers'}
          value={stats.totalCustomers}
          icon={Building2}
          color="bg-gradient-to-br from-rose-500 to-red-600"
        />
        <StatCard
          title={language === 'ar' ? 'المنتجات' : 'Products'}
          value={stats.totalProducts}
          icon={Package}
          subValue={`${stats.lowStockCount} ${language === 'ar' ? 'مخزون منخفض' : 'low stock'}`}
          color="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <StatCard
          title={language === 'ar' ? 'المشاريع النشطة' : 'Active Projects'}
          value={stats.activeProjects}
          icon={Activity}
          subValue={`${stats.completedProjects} ${language === 'ar' ? 'مكتمل' : 'completed'}`}
          color="bg-gradient-to-br from-fuchsia-500 to-pink-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Expenses Chart */}
        <Card className="lg:col-span-2 border-0 shadow-lg dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {language === 'ar' ? 'الإيرادات والمصروفات' : 'Revenue & Expenses'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }} 
                />
                <Legend />
                <Bar dataKey="revenue" name={language === 'ar' ? 'الإيرادات' : 'Revenue'} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={language === 'ar' ? 'المصروفات' : 'Expenses'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name={language === 'ar' ? 'الربح' : 'Profit'} stroke="#8b5cf6" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <PieChart className="w-5 h-5 text-purple-500" />
              {language === 'ar' ? 'توزيع المصروفات' : 'Expenses Breakdown'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 border-0 shadow-lg dark:bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <CreditCard className="w-5 h-5 text-blue-500" />
              {language === 'ar' ? 'آخر الحركات البنكية' : 'Recent Transactions'}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-500">
              {language === 'ar' ? 'عرض الكل' : 'View All'}
              <ChevronRight className={`w-4 h-4 ${isRTL ? 'mr-1 rotate-180' : 'ml-1'}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {language === 'ar' ? 'لا توجد حركات حديثة' : 'No recent transactions'}
                </p>
              ) : (
                recentTransactions.map((txn, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        ['deposit', 'check_deposit', 'transfer_in'].includes(txn.transaction_type)
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {['deposit', 'check_deposit', 'transfer_in'].includes(txn.transaction_type) 
                          ? <ArrowUpRight className="w-5 h-5 text-green-600" />
                          : <ArrowDownRight className="w-5 h-5 text-red-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium dark:text-white">{txn.description || txn.transaction_number}</p>
                        <p className="text-xs text-gray-500">{txn.bank_name} • {txn.transaction_date}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      ['deposit', 'check_deposit', 'transfer_in'].includes(txn.transaction_type)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {['deposit', 'check_deposit', 'transfer_in'].includes(txn.transaction_type) ? '+' : '-'}
                      {txn.amount?.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Bell className="w-5 h-5 text-amber-500" />
              {language === 'ar' ? 'التنبيهات' : 'Alerts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border-r-4 ${
                    alert.type === 'danger' 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                      : alert.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <alert.icon className={`w-5 h-5 mt-0.5 ${
                      alert.type === 'danger' ? 'text-red-500' :
                      alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div>
                      <p className="font-medium dark:text-white">{alert.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
