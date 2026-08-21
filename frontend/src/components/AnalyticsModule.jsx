import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Package, BarChart3,
  RefreshCw, Calendar, CheckCircle, Clock, AlertCircle, Briefcase,
  FolderKanban, ShoppingCart, UserCheck, Activity
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'];

export const AnalyticsModule = ({ language }) => {
  const ar = language === 'ar';
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod]       = useState('monthly');
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState({});

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTab = useCallback(async (tab, p) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/analytics/${tab}?period=${p}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setData(prev => ({ ...prev, [tab]: json }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchTab(activeTab, period); }, [activeTab, period]);

  const TABS = [
    { id:'overview',   label: ar?'نظرة عامة':'Overview',       icon: BarChart3   },
    { id:'financial',  label: ar?'المالية':'Financial',         icon: DollarSign  },
    { id:'hr',         label: ar?'الموارد البشرية':'HR',        icon: Users       },
    { id:'payroll',    label: ar?'الرواتب':'Payroll',           icon: Briefcase   },
    { id:'inventory',  label: ar?'المخزون':'Inventory',         icon: Package     },
    { id:'projects',   label: ar?'المشاريع':'Projects',         icon: FolderKanban},
    { id:'sales',      label: ar?'المبيعات':'Sales',            icon: ShoppingCart},
    { id:'attendance', label: ar?'الحضور':'Attendance',         icon: UserCheck   },
  ];

  const d = data[activeTab];

  const kpiCard = (label, val, color, bg, icon, sub) => (
    <Card className={`${bg} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{val}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg.replace('50','100')}`}>
            {React.createElement(icon, { className: `h-5 w-5 ${color}` })}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const chart = (title, children) => (
    <Card><CardHeader><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  const fmt = n => (typeof n === 'number' ? n.toLocaleString() + ' ج.م' : '-');

  return (
    <div className="space-y-5 p-5" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{ar ? 'التحليلات المتقدمة' : 'Advanced Analytics'}</h1>
          <p className="text-sm text-gray-500">{ar ? 'تقارير شاملة لكل أقسام النظام' : 'Comprehensive reports across all modules'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value="daily">{ar?'اليوم':'Today'}</option>
            <option value="monthly">{ar?'آخر 30 يوم':'Last 30 days'}</option>
            <option value="quarterly">{ar?'آخر 90 يوم':'Last 90 days'}</option>
            <option value="yearly">{ar?'آخر سنة':'Last year'}</option>
          </select>
          <button onClick={() => fetchTab(activeTab, period)}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-500' : 'text-gray-500'}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 p-1 rounded-2xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-[#28376B] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && activeTab === 'overview' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'صافي الربح':'Net Profit',          fmt(d.financial_analytics?.net_profit),      'text-blue-600',   'bg-blue-50',   DollarSign, ar?'إجمالي':'Total')}
            {kpiCard(ar?'الإيرادات':'Revenue',              fmt(d.financial_analytics?.total_revenue),   'text-green-600',  'bg-green-50',  TrendingUp)}
            {kpiCard(ar?'المصروفات':'Expenses',             fmt(d.financial_analytics?.total_expenses),  'text-red-600',    'bg-red-50',    TrendingDown)}
            {kpiCard(ar?'الموظفين':'Employees',             d.hr_analytics?.total_employees || 0,        'text-purple-600', 'bg-purple-50', Users)}
            {kpiCard(ar?'قيمة المخزون':'Inventory Value',  fmt(d.inventory_analytics?.total_value),     'text-amber-600',  'bg-amber-50',  Package)}
            {kpiCard(ar?'العملاء':'Customers',              d.financial_analytics?.total_customers || 0, 'text-cyan-600',   'bg-cyan-50',   ShoppingCart)}
            {kpiCard(ar?'الموردين':'Suppliers',             d.financial_analytics?.total_suppliers || 0, 'text-indigo-600', 'bg-indigo-50', Users)}
            {kpiCard(ar?'هامش الربح':'Profit Margin',       `${(d.financial_analytics?.profit_margin||0).toFixed(1)}%`, 'text-rose-600', 'bg-rose-50', Activity)}
          </div>
        </div>
      )}

      {/* ── FINANCIAL ── */}
      {!loading && activeTab === 'financial' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'إجمالي الإيرادات':'Total Revenue',  fmt(d.total_revenue),  'text-green-600',  'bg-green-50',  TrendingUp)}
            {kpiCard(ar?'إجمالي المصروفات':'Total Expenses', fmt(d.total_expenses), 'text-red-600',    'bg-red-50',    TrendingDown)}
            {kpiCard(ar?'صافي الربح':'Net Profit',           fmt(d.net_profit),     'text-blue-600',   'bg-blue-50',   DollarSign)}
            {kpiCard(ar?'هامش الربح':'Profit Margin',        `${(d.profit_margin||0).toFixed(1)}%`, 'text-purple-600','bg-purple-50', Activity)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'الإيرادات مقابل المصروفات':'Revenue vs Expenses',
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={(d.revenue_by_month||[]).map((item,i) => ({ month:item.month, revenue:item.amount, expenses:(d.expenses_by_month||[])[i]?.amount||0 }))}>
                  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Legend/>
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#d1fae5" name={ar?'إيرادات':'Revenue'}/>
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#fee2e2" name={ar?'مصروفات':'Expenses'}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'أعلى العملاء':'Top Customers',
              <div className="space-y-2">
                {(d.customer_balances||[]).slice(0,8).map((c,i)=>(
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center font-bold">{i+1}</span>
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{(c.balance||0).toLocaleString()} ج.م</span>
                  </div>
                ))}
                {!(d.customer_balances?.length) && <p className="text-center text-gray-400 text-sm py-4">{ar?'لا توجد بيانات':'No data'}</p>}
              </div>
            )}
            {chart(ar?'أعلى الموردين':'Top Suppliers',
              <div className="space-y-2">
                {(d.supplier_balances||[]).slice(0,8).map((s,i)=>(
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-red-100 text-red-600 rounded-full text-xs flex items-center justify-center font-bold">{i+1}</span>
                      <span className="text-sm text-gray-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{(s.balance||0).toLocaleString()} ج.م</span>
                  </div>
                ))}
                {!(d.supplier_balances?.length) && <p className="text-center text-gray-400 text-sm py-4">{ar?'لا توجد بيانات':'No data'}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HR ── */}
      {!loading && activeTab === 'hr' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'الموظفين':'Employees',           d.total_employees||0,                       'text-blue-600','bg-blue-50',  Users)}
            {kpiCard(ar?'إجمالي الإجازات':'Total Leaves', d.total_leaves||0,                          'text-amber-600','bg-amber-50',Calendar)}
            {kpiCard(ar?'إجمالي البدلات':'Allowances',   fmt(d.total_allowances),                    'text-green-600','bg-green-50',TrendingUp)}
            {kpiCard(ar?'إجمالي الخصومات':'Deductions',  fmt(d.total_deductions),                    'text-red-600','bg-red-50',   TrendingDown)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'توزيع الأقسام':'Department Distribution',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.department_distribution||[]} dataKey="count" nameKey="department" cx="50%" cy="50%" outerRadius={90}
                    label={e=>`${e.department}: ${e.count}`} labelLine={false}>
                    {(d.department_distribution||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'توزيع الرواتب':'Salary Distribution',
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.salary_distribution||[]}>
                  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="range" tick={{fontSize:11}}/><YAxis/><Tooltip/>
                  <Bar dataKey="count" fill="#6366f1" name={ar?'الموظفون':'Employees'} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'الحضور الشهري':'Monthly Attendance',
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={d.attendance_data||[]}>
                  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis/><Tooltip/><Legend/>
                  <Line type="monotone" dataKey="present" stroke="#10b981" name={ar?'حاضر':'Present'} strokeWidth={2}/>
                  <Line type="monotone" dataKey="absent"  stroke="#ef4444" name={ar?'غائب':'Absent'}  strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── PAYROLL ── */}
      {!loading && activeTab === 'payroll' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'إجمالي المرتبات':'Total Gross',      fmt(d.total_gross),       'text-blue-600','bg-blue-50',   DollarSign)}
            {kpiCard(ar?'صافي المرتبات':'Total Net',           fmt(d.total_net),         'text-green-600','bg-green-50', TrendingUp)}
            {kpiCard(ar?'إجمالي الضرائب':'Total Tax',          fmt(d.total_tax),         'text-red-600','bg-red-50',    TrendingDown)}
            {kpiCard(ar?'التأمينات':'Insurance',               fmt(d.total_insurance),   'text-amber-600','bg-amber-50', Users)}
            {kpiCard(ar?'عدد الموظفين':'Employees',            d.total_employees||0,     'text-purple-600','bg-purple-50',Users)}
            {kpiCard(ar?'دورات الرواتب':'Payroll Runs',        d.runs_count||0,          'text-cyan-600','bg-cyan-50',  Activity)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'تكلفة الرواتب الشهرية':'Monthly Payroll Cost',
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.monthly_trend||[]}>
                  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis/><Tooltip/>
                  <Bar dataKey="amount" fill="#3b82f6" name={ar?'المبلغ':'Amount'} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'تكلفة كل قسم':'Department Salary Cost',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.department_costs||[]} dataKey="salary" nameKey="department" cx="50%" cy="50%" outerRadius={90}
                    label={e=>`${e.department}`} labelLine={false}>
                    {(d.department_costs||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v)=>`${v.toLocaleString()} ج.م`}/>
                  <Legend/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── INVENTORY ── */}
      {!loading && activeTab === 'inventory' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpiCard(ar?'إجمالي الأصناف':'Total Items',    d.total_items||0,          'text-blue-600','bg-blue-50',  Package)}
            {kpiCard(ar?'قيمة المخزون':'Stock Value',       fmt(d.total_value),        'text-green-600','bg-green-50',DollarSign)}
            {kpiCard(ar?'تنبيهات':'Low Stock Alerts',       d.low_stock_alerts?.length||0,'text-red-600','bg-red-50', AlertCircle)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'توزيع الفئات':'Category Distribution',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.category_distribution||[]} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={90}
                    label={e=>`${e.category}: ${e.count}`} labelLine={false}>
                    {(d.category_distribution||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/><Legend/>
                </PieChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'حالة المخزون':'Stock Status',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.status_distribution||[]} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}>
                    {(d.status_distribution||[]).map((e,i)=><Cell key={i} fill={e.status==='in-stock'?'#10b981':e.status==='low-stock'?'#f59e0b':'#ef4444'}/>)}
                  </Pie>
                  <Tooltip/><Legend/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {d.low_stock_alerts?.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader><CardTitle className="text-red-600 text-sm">⚠️ {ar?'تنبيهات المخزون المنخفض':'Low Stock Alerts'}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {d.low_stock_alerts.map((item,i)=>(
                    <div key={i} className="flex justify-between items-center p-2 bg-white rounded-lg border border-red-100">
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      <span className="text-xs text-red-600 font-semibold">{ar?'الكمية':'Qty'}: {item.quantity}/{item.min_quantity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {d.top_items_by_value?.length > 0 && chart(ar?'أعلى الأصناف قيمةً':'Top Items by Value',
            <div className="space-y-2">
              {d.top_items_by_value.slice(0,8).map((item,i)=>(
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className="text-sm font-bold text-blue-600">{(item.total_value||0).toLocaleString()} ج.م</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROJECTS ── */}
      {!loading && activeTab === 'projects' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'إجمالي المشاريع':'Total Projects',   d.total_projects||0,         'text-blue-600','bg-blue-50',  FolderKanban)}
            {kpiCard(ar?'إجمالي المهام':'Total Tasks',         d.total_tasks||0,            'text-purple-600','bg-purple-50',CheckCircle)}
            {kpiCard(ar?'مهام مكتملة':'Completed Tasks',      d.completed_tasks||0,        'text-green-600','bg-green-50', CheckCircle)}
            {kpiCard(ar?'مهام متأخرة':'Overdue Tasks',        d.overdue_tasks||0,          'text-red-600','bg-red-50',    AlertCircle)}
            {kpiCard(ar?'معدل الإنجاز':'Completion Rate',     `${d.completion_rate||0}%`,  'text-cyan-600','bg-cyan-50',  Activity)}
            {kpiCard(ar?'إجمالي الإيرادات':'Revenues',        fmt(d.total_revenues),       'text-green-600','bg-green-50', TrendingUp)}
            {kpiCard(ar?'إجمالي المصروفات':'Expenses',        fmt(d.total_expenses),       'text-red-600','bg-red-50',    TrendingDown)}
            {kpiCard(ar?'صافي الربح':'Net Profit',            fmt(d.net_profit),           'text-blue-600','bg-blue-50',  DollarSign)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'توزيع حالة المشاريع':'Project Status',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.status_distribution||[]} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}
                    label={e=>`${e.status}: ${e.count}`} labelLine={false}>
                    {(d.status_distribution||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/><Legend/>
                </PieChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'الميزانية مقابل الإنفاق':'Budget vs Spent',
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(d.budget_usage||[]).slice(0,8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" tick={{fontSize:10}} width={80}/><Tooltip/><Legend/>
                  <Bar dataKey="budget" fill="#6366f1" name={ar?'الميزانية':'Budget'} radius={[0,4,4,0]}/>
                  <Bar dataKey="spent"  fill="#ef4444" name={ar?'المنفق':'Spent'}    radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── SALES ── */}
      {!loading && activeTab === 'sales' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'العملاء':'Customers',            d.total_customers||0,         'text-blue-600','bg-blue-50',  ShoppingCart)}
            {kpiCard(ar?'الفواتير':'Invoices',             d.total_invoices||0,          'text-purple-600','bg-purple-50',Activity)}
            {kpiCard(ar?'إجمالي الفواتير':'Invoiced',      fmt(d.total_invoiced),        'text-green-600','bg-green-50', DollarSign)}
            {kpiCard(ar?'تم التحصيل':'Collected',          fmt(d.total_paid),            'text-cyan-600','bg-cyan-50',  CheckCircle)}
            {kpiCard(ar?'مستحق التحصيل':'Pending',         fmt(d.total_pending),         'text-amber-600','bg-amber-50', Clock)}
            {kpiCard(ar?'معدل التحصيل':'Collection Rate',  `${d.collection_rate||0}%`,   'text-indigo-600','bg-indigo-50',TrendingUp)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'الإيرادات الشهرية':'Monthly Revenue',
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={d.monthly_trend||[]}>
                  <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis/><Tooltip/>
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#d1fae5" name={ar?'الإيرادات':'Revenue'}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chart(ar?'حالة الفواتير':'Invoice Status',
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.status_distribution||[]} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}
                    label={e=>`${e.status}: ${e.count}`} labelLine={false}>
                    {(d.status_distribution||[]).map((e,i)=><Cell key={i} fill={
                      e.status==='paid'||e.status==='accepted'?'#10b981':
                      e.status==='pending'||e.status==='sent'?'#f59e0b':
                      e.status==='cancelled'?'#ef4444':'#6366f1'}/>)}
                  </Pie>
                  <Tooltip/><Legend/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE ── */}
      {!loading && activeTab === 'attendance' && d && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCard(ar?'إجمالي السجلات':'Total Records', d.total_records||0,       'text-blue-600','bg-blue-50',  Activity)}
            {kpiCard(ar?'حاضر':'Present',                  d.present||0,             'text-green-600','bg-green-50', CheckCircle)}
            {kpiCard(ar?'غائب':'Absent',                   d.absent||0,              'text-red-600','bg-red-50',    AlertCircle)}
            {kpiCard(ar?'متأخر':'Late',                    d.late||0,                'text-amber-600','bg-amber-50', Clock)}
            {kpiCard(ar?'معدل الحضور':'Attendance Rate',  `${d.attendance_rate||0}%`,'text-cyan-600','bg-cyan-50',  TrendingUp)}
          </div>
          {chart(ar?'الحضور اليومي (آخر 30 يوم)':'Daily Attendance (Last 30 days)',
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={(d.daily_trend||[]).slice(-30)}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:9}}/><YAxis/><Tooltip/><Legend/>
                <Bar dataKey="present" fill="#10b981" name={ar?'حاضر':'Present'} stackId="a" radius={[0,0,0,0]}/>
                <Bar dataKey="absent"  fill="#ef4444" name={ar?'غائب':'Absent'}  stackId="a"/>
                <Bar dataKey="late"    fill="#f59e0b" name={ar?'متأخر':'Late'}   stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {chart(ar?'أعلى معدل حضور':'Best Attendance',
              <div className="space-y-2">
                {(d.employee_rates||[]).slice(-5).reverse().map((e,i)=>(
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4">{i+1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-green-600 font-bold">{e.rate}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-green-500 rounded-full" style={{width:`${e.rate}%`}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {chart(ar?'أدنى معدل حضور':'Worst Attendance',
              <div className="space-y-2">
                {(d.worst_attendance||[]).slice(0,5).map((e,i)=>(
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4">{i+1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-red-600 font-bold">{e.rate}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-red-500 rounded-full" style={{width:`${e.rate}%`}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !d && (
        <div className="text-center py-16 text-gray-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30"/>
          <p className="text-sm">{ar?'لا توجد بيانات للفترة المحددة':'No data for selected period'}</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsModule;
