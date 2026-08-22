import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Package, BarChart3,
  RefreshCw, Calendar, CheckCircle, Clock, AlertCircle, Briefcase,
  FolderKanban, ShoppingCart, UserCheck, Activity, Building2,
  FileText, Truck, Landmark, Scale, Heart, Layers
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const C   = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#a78bfa'];

export const AnalyticsModule = ({ language }) => {
  const ar = language === 'ar';
  const [tab, setTab]       = useState('overview');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [cache, setCache]   = useState({});

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTab = useCallback(async (t, p) => {
    const key = `${t}_${p}`;
    if (cache[key]) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/analytics/${t}?period=${p}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setCache(prev => ({ ...prev, [key]: json }));
      }
    } catch {}
    setLoading(false);
  }, [token, cache]);

  const refresh = () => {
    const key = `${tab}_${period}`;
    setCache(prev => { const c = {...prev}; delete c[key]; return c; });
  };

  useEffect(() => { fetchTab(tab, period); }, [tab, period]);

  const d = cache[`${tab}_${period}`];

  const TABS = [
    { id:'overview',  label: ar?'نظرة عامة':'Overview',         icon: BarChart3    },
    { id:'financial', label: ar?'المالية':'Financial',           icon: DollarSign   },
    { id:'treasury',  label: ar?'الخزينة والبنك':'Treasury',     icon: Landmark     },
    { id:'hr',        label: ar?'الموارد البشرية':'HR',          icon: Users        },
    { id:'payroll',   label: ar?'الرواتب':'Payroll',             icon: Briefcase    },
    { id:'leaves',    label: ar?'الإجازات':'Leaves',             icon: Calendar     },
    { id:'loans',     label: ar?'القروض والإضافات':'Loans',      icon: Heart        },
    { id:'attendance',label: ar?'الحضور':'Attendance',           icon: UserCheck    },
    { id:'inventory', label: ar?'المخزون':'Inventory',           icon: Package      },
    { id:'stock',     label: ar?'حركة المخزون':'Stock Moves',   icon: Layers       },
    { id:'assets',    label: ar?'الأصول الثابتة':'Fixed Assets', icon: Building2    },
    { id:'projects',  label: ar?'المشاريع':'Projects',           icon: FolderKanban },
    { id:'sales',     label: ar?'المبيعات':'Sales',              icon: ShoppingCart },
    { id:'purchases', label: ar?'المشتريات':'Purchases',         icon: Truck        },
    { id:'eta',       label: ar?'الفواتير الإلكترونية':'ETA',   icon: FileText     },
  ];

  const PERIODS = [
    { v:'daily',     l: ar?'اليوم':'Today'          },
    { v:'monthly',   l: ar?'آخر 30 يوم':'30 Days'  },
    { v:'quarterly', l: ar?'آخر 90 يوم':'90 Days'  },
    { v:'yearly',    l: ar?'السنة':'Year'           },
  ];

  const fmt  = n => typeof n === 'number' ? n.toLocaleString('ar-EG') + ' ج.م' : (n || '-');
  const fmtN = n => typeof n === 'number' ? n.toLocaleString('ar-EG') : (n || '0');
  const pct  = n => `${(n||0).toFixed(1)}%`;

  const KPI = ({ label, val, color='text-blue-600', bg='bg-blue-50', icon: Icon=DollarSign, sub, trend }) => (
    <Card className={`${bg} border-0 shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1 truncate">{label}</p>
            <p className={`text-xl font-black ${color} truncate`}>{val}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ml-2 ${bg.replace('50','100')}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const Ch = ({ title, children, span=1 }) => (
    <Card className={span===2 ? 'lg:col-span-2' : ''}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  const listRows = (items=[], keyF, valF, colorClass='text-blue-600') => (
    <div className="space-y-1.5 max-h-52 overflow-y-auto">
      {items.length === 0 && <p className="text-center text-gray-400 text-xs py-4">{ar?'لا توجد بيانات':'No data'}</p>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 bg-gray-100 text-gray-500 rounded-full text-xs flex items-center justify-center flex-shrink-0">{i+1}</span>
            <span className="text-xs text-gray-700 truncate">{keyF(item)}</span>
          </div>
          <span className={`text-xs font-bold ${colorClass} flex-shrink-0`}>{valF(item)}</span>
        </div>
      ))}
    </div>
  );

  const pieChart = (data=[], dataKey, nameKey, h=240) => (
    <ResponsiveContainer width="100%" height={h}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={h*0.35} label={false}>
          {data.map((_,i) => <Cell key={i} fill={C[i%C.length]}/>)}
        </Pie>
        <Tooltip formatter={v => v?.toLocaleString?.() ?? v}/>
        <Legend iconSize={10} wrapperStyle={{fontSize:'11px'}}/>
      </PieChart>
    </ResponsiveContainer>
  );

  const barChart = (data=[], dataKey, nameKey='month', h=220, color='#3b82f6', name='') => (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
        <XAxis dataKey={nameKey} tick={{fontSize:10}}/>
        <YAxis tick={{fontSize:10}}/>
        <Tooltip formatter={v => v?.toLocaleString?.() ?? v}/>
        <Bar dataKey={dataKey} fill={color} name={name||dataKey} radius={[3,3,0,0]}/>
      </BarChart>
    </ResponsiveContainer>
  );

  const areaChart = (data=[], keys=[], h=220) => (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
        <XAxis dataKey="month" tick={{fontSize:10}}/>
        <YAxis tick={{fontSize:10}}/>
        <Tooltip formatter={v => v?.toLocaleString?.() ?? v}/>
        <Legend iconSize={10} wrapperStyle={{fontSize:'11px'}}/>
        {keys.map((k,i) => <Area key={k.key} type="monotone" dataKey={k.key} stroke={C[i]} fill={C[i]+'30'} name={k.name}/>)}
      </AreaChart>
    </ResponsiveContainer>
  );

  const lineChart = (data=[], keys=[], xKey='month', h=220) => (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
        <XAxis dataKey={xKey} tick={{fontSize:10}}/>
        <YAxis tick={{fontSize:10}}/>
        <Tooltip/>
        <Legend iconSize={10} wrapperStyle={{fontSize:'11px'}}/>
        {keys.map((k,i) => <Line key={k.key} type="monotone" dataKey={k.key} stroke={C[i]} name={k.name} strokeWidth={2} dot={false}/>)}
      </LineChart>
    </ResponsiveContainer>
  );

  const progBar = (items=[], nameF, rateF, colorF=()=>'bg-blue-500') => (
    <div className="space-y-2.5 max-h-52 overflow-y-auto">
      {items.map((item,i)=>(
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-gray-700 truncate max-w-[60%]">{nameF(item)}</span>
            <span className="font-bold text-gray-600">{rateF(item)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colorF(item)}`} style={{width:`${Math.min(parseFloat(rateF(item)),100)}%`}}/>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 p-4" dir={ar?'rtl':'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">{ar?'التحليلات المتقدمة':'Advanced Analytics'}</h1>
          <p className="text-xs text-gray-500">{ar?'15 تقرير شامل لكل أقسام النظام':'15 comprehensive reports across all modules'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={period} onChange={e=>{setPeriod(e.target.value);}}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white">
            {PERIODS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <button onClick={refresh} className="p-1.5 border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading?'animate-spin text-blue-500':'text-gray-400'}`}/>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-max min-w-full">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  tab===t.id?'bg-white text-[#28376B] shadow-sm':'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="h-3.5 w-3.5"/>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && !d && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400"/>
          <p className="text-sm text-gray-400">{ar?'جاري تحميل التحليلات...':'Loading analytics...'}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          OVERVIEW
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='overview' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'صافي الربح':'Net Profit'}          val={fmt(d.financial_analytics?.net_profit)}   color="text-blue-600"   bg="bg-blue-50"   icon={DollarSign}/>
            <KPI label={ar?'إجمالي الإيرادات':'Revenue'}       val={fmt(d.financial_analytics?.total_revenue)} color="text-green-600" bg="bg-green-50"  icon={TrendingUp}/>
            <KPI label={ar?'إجمالي المصروفات':'Expenses'}      val={fmt(d.financial_analytics?.total_expenses)}color="text-red-600"   bg="bg-red-50"    icon={TrendingDown}/>
            <KPI label={ar?'هامش الربح':'Profit Margin'}       val={pct(d.financial_analytics?.profit_margin)} color="text-purple-600"bg="bg-purple-50" icon={Activity}/>
            <KPI label={ar?'الموظفين':'Employees'}              val={fmtN(d.hr_analytics?.total_employees)}   color="text-cyan-600"   bg="bg-cyan-50"   icon={Users}/>
            <KPI label={ar?'العملاء':'Customers'}               val={fmtN(d.financial_analytics?.total_customers)} color="text-indigo-600" bg="bg-indigo-50" icon={ShoppingCart}/>
            <KPI label={ar?'الموردين':'Suppliers'}              val={fmtN(d.financial_analytics?.total_suppliers)} color="text-orange-600" bg="bg-orange-50" icon={Truck}/>
            <KPI label={ar?'قيمة المخزون':'Inventory Value'}   val={fmt(d.inventory_analytics?.total_value)}  color="text-amber-600"  bg="bg-amber-50"  icon={Package}/>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FINANCIAL
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='financial' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الإيرادات':'Revenue'}  val={fmt(d.total_revenue)}  color="text-green-600" bg="bg-green-50"  icon={TrendingUp}/>
            <KPI label={ar?'إجمالي المصروفات':'Expenses'} val={fmt(d.total_expenses)} color="text-red-600"   bg="bg-red-50"    icon={TrendingDown}/>
            <KPI label={ar?'صافي الربح':'Net Profit'}     val={fmt(d.net_profit)}     color="text-blue-600"  bg="bg-blue-50"   icon={DollarSign}/>
            <KPI label={ar?'هامش الربح':'Margin'}         val={pct(d.profit_margin)}  color="text-purple-600"bg="bg-purple-50" icon={Activity}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'الإيرادات مقابل المصروفات':'Revenue vs Expenses'} span={2}>
              {areaChart(
                (d.revenue_by_month||[]).map((item,i)=>({month:item.month, [ar?'إيرادات':'Revenue']:item.amount, [ar?'مصروفات':'Expenses']:(d.expenses_by_month||[])[i]?.amount||0})),
                [{key:ar?'إيرادات':'Revenue'},{key:ar?'مصروفات':'Expenses'}], 260
              )}
            </Ch>
            <Ch title={ar?'أعلى العملاء':'Top Customers'}>
              {listRows(d.customer_balances||[], c=>c.name, c=>fmt(c.balance), 'text-blue-600')}
            </Ch>
            <Ch title={ar?'أعلى الموردين':'Top Suppliers'}>
              {listRows(d.supplier_balances||[], s=>s.name, s=>fmt(s.balance), 'text-red-500')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TREASURY
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='treasury' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'رصيد الخزينة':'Treasury Balance'}  val={fmt(d.treasury_balance)}  color="text-green-600"  bg="bg-green-50"  icon={Landmark}/>
            <KPI label={ar?'رصيد البنوك':'Bank Balance'}        val={fmt(d.bank_balance)}      color="text-blue-600"   bg="bg-blue-50"   icon={Landmark}/>
            <KPI label={ar?'إجمالي الأرصدة':'Total Balance'}   val={fmt(d.total_balance)}     color="text-purple-600" bg="bg-purple-50" icon={DollarSign}/>
            <KPI label={ar?'إجمالي الإيداعات':'Total In'}      val={fmt(d.total_in)}          color="text-cyan-600"   bg="bg-cyan-50"   icon={TrendingUp}/>
            <KPI label={ar?'إجمالي السحوبات':'Total Out'}       val={fmt(d.total_out)}         color="text-red-600"    bg="bg-red-50"    icon={TrendingDown}/>
            <KPI label={ar?'إيداعات الخزينة':'Treasury In'}    val={fmt(d.treasury_in)}       color="text-emerald-600"bg="bg-emerald-50"icon={TrendingUp}/>
            <KPI label={ar?'سحوبات الخزينة':'Treasury Out'}    val={fmt(d.treasury_out)}      color="text-orange-600" bg="bg-orange-50" icon={TrendingDown}/>
            <KPI label={ar?'الحسابات البنكية':'Bank Accounts'}  val={fmtN(d.bank_accounts?.length)} color="text-indigo-600" bg="bg-indigo-50" icon={Landmark}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'الحركة اليومية (الإيداعات مقابل السحوبات)':'Daily Cash Flow'} span={2}>
              {areaChart(d.daily_trend||[], [{key:'in',name:ar?'وارد':'In'},{key:'out',name:ar?'صادر':'Out'}], 260)}
            </Ch>
            <Ch title={ar?'أرصدة الحسابات البنكية':'Bank Account Balances'}>
              {listRows(d.bank_accounts||[], b=>b.name, b=>fmt(b.balance), 'text-blue-600')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HR
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='hr' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الموظفين':'Employees'}    val={fmtN(d.total_employees)}  color="text-blue-600"  bg="bg-blue-50"  icon={Users}/>
            <KPI label={ar?'إجمالي الإجازات':'Leaves'}       val={fmtN(d.total_leaves)}     color="text-amber-600" bg="bg-amber-50" icon={Calendar}/>
            <KPI label={ar?'إجمالي البدلات':'Allowances'}    val={fmt(d.total_allowances)}  color="text-green-600" bg="bg-green-50" icon={TrendingUp}/>
            <KPI label={ar?'إجمالي الخصومات':'Deductions'}   val={fmt(d.total_deductions)}  color="text-red-600"   bg="bg-red-50"   icon={TrendingDown}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Ch title={ar?'توزيع الأقسام':'Departments'}>
              {pieChart(d.department_distribution||[], 'count', 'department')}
            </Ch>
            <Ch title={ar?'توزيع الرواتب':'Salary Ranges'}>
              {barChart(d.salary_distribution||[], 'count', 'range', 220, '#8b5cf6', ar?'موظفون':'Employees')}
            </Ch>
            <Ch title={ar?'الحضور الشهري':'Attendance'}>
              {lineChart(d.attendance_data||[], [{key:'present',name:ar?'حاضر':'Present'},{key:'absent',name:ar?'غائب':'Absent'}], 'month')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PAYROLL
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='payroll' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي المرتبات':'Gross'}       val={fmt(d.total_gross)}      color="text-blue-600"   bg="bg-blue-50"   icon={DollarSign}/>
            <KPI label={ar?'صافي المرتبات':'Net'}            val={fmt(d.total_net)}        color="text-green-600"  bg="bg-green-50"  icon={TrendingUp}/>
            <KPI label={ar?'إجمالي الضرائب':'Tax'}           val={fmt(d.total_tax)}        color="text-red-600"    bg="bg-red-50"    icon={Scale}/>
            <KPI label={ar?'التأمينات':'Insurance'}           val={fmt(d.total_insurance)}  color="text-amber-600"  bg="bg-amber-50"  icon={Heart}/>
            <KPI label={ar?'الموظفون':'Employees'}            val={fmtN(d.total_employees)} color="text-purple-600" bg="bg-purple-50" icon={Users}/>
            <KPI label={ar?'دورات الرواتب':'Runs'}           val={fmtN(d.runs_count)}      color="text-cyan-600"   bg="bg-cyan-50"   icon={Activity}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'تكلفة الرواتب الشهرية':'Monthly Payroll Cost'}>
              {barChart(d.monthly_trend||[], 'amount', 'month', 240, '#3b82f6', ar?'المبلغ':'Amount')}
            </Ch>
            <Ch title={ar?'تكلفة كل قسم':'Department Cost'}>
              {pieChart(d.department_costs||[], 'salary', 'department')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LEAVES
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='leaves' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الطلبات':'Requests'}     val={fmtN(d.total_requests)} color="text-blue-600"  bg="bg-blue-50"  icon={Calendar}/>
            <KPI label={ar?'إجمالي الأيام':'Days'}           val={fmtN(d.total_days)}     color="text-purple-600"bg="bg-purple-50"icon={Clock}/>
            <KPI label={ar?'مقبولة':'Approved'}              val={fmtN(d.approved)}       color="text-green-600" bg="bg-green-50" icon={CheckCircle}/>
            <KPI label={ar?'في الانتظار':'Pending'}          val={fmtN(d.pending)}        color="text-amber-600" bg="bg-amber-50" icon={Clock}/>
            <KPI label={ar?'مرفوضة':'Rejected'}              val={fmtN(d.rejected)}       color="text-red-600"   bg="bg-red-50"   icon={AlertCircle}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Ch title={ar?'حسب النوع':'By Type'}>
              {pieChart((d.by_type||[]).map(t=>({name:t.type,count:t.count})), 'count', 'name')}
            </Ch>
            <Ch title={ar?'حسب الحالة':'By Status'}>
              {pieChart(d.by_status||[], 'count', 'status')}
            </Ch>
            <Ch title={ar?'حسب القسم (أيام)':'By Department'}>
              {barChart(d.by_department||[], 'days', 'department', 220, '#8b5cf6', ar?'أيام':'Days')}
            </Ch>
          </div>
          <Ch title={ar?'الطلبات الشهرية':'Monthly Trend'}>
            {lineChart(d.monthly_trend||[], [{key:'days',name:ar?'أيام الإجازة':'Leave Days'}], 'month', 200)}
          </Ch>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LOANS & OVERTIME & EOS
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='loans' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي القروض':'Total Loans'}          val={fmtN(d.total_loans)}           color="text-blue-600"   bg="bg-blue-50"   icon={DollarSign}/>
            <KPI label={ar?'قيمة القروض':'Loan Amount'}            val={fmt(d.total_loan_amount)}       color="text-purple-600" bg="bg-purple-50" icon={DollarSign}/>
            <KPI label={ar?'المسدد':'Paid'}                        val={fmt(d.paid_amount)}             color="text-green-600"  bg="bg-green-50"  icon={CheckCircle}/>
            <KPI label={ar?'المتبقي':'Remaining'}                  val={fmt(d.remaining_amount)}        color="text-red-600"    bg="bg-red-50"    icon={Clock}/>
            <KPI label={ar?'قروض نشطة':'Active Loans'}            val={fmtN(d.active_loans)}           color="text-amber-600"  bg="bg-amber-50"  icon={Activity}/>
            <KPI label={ar?'ساعات الإضافي':'OT Hours'}            val={fmtN(d.total_overtime_hours)}   color="text-cyan-600"   bg="bg-cyan-50"   icon={Clock}/>
            <KPI label={ar?'مكافأة الإضافي':'OT Amount'}          val={fmt(d.total_overtime_amount)}   color="text-indigo-600" bg="bg-indigo-50" icon={DollarSign}/>
            <KPI label={ar?'مكافأة نهاية الخدمة':'EOS Amount'}    val={fmt(d.total_eos_amount)}        color="text-rose-600"   bg="bg-rose-50"   icon={Users}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'حالة القروض':'Loan Status'}>
              {pieChart(d.loan_status||[], 'count', 'status')}
            </Ch>
            <Ch title={ar?'أحدث القروض':'Recent Loans'}>
              {listRows(d.recent_loans||[], l=>l.employee_name||l.employee_id||'', l=>fmt(l.amount))}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ATTENDANCE
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='attendance' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label={ar?'إجمالي السجلات':'Records'}  val={fmtN(d.total_records)}       color="text-blue-600"  bg="bg-blue-50"  icon={Activity}/>
            <KPI label={ar?'حاضر':'Present'}             val={fmtN(d.present)}             color="text-green-600" bg="bg-green-50" icon={CheckCircle}/>
            <KPI label={ar?'غائب':'Absent'}              val={fmtN(d.absent)}              color="text-red-600"   bg="bg-red-50"   icon={AlertCircle}/>
            <KPI label={ar?'متأخر':'Late'}               val={fmtN(d.late)}                color="text-amber-600" bg="bg-amber-50" icon={Clock}/>
            <KPI label={ar?'معدل الحضور':'Rate'}         val={pct(d.attendance_rate)}      color="text-cyan-600"  bg="bg-cyan-50"  icon={TrendingUp}/>
          </div>
          <Ch title={ar?'الحضور اليومي (آخر 30 يوم)':'Daily Attendance'}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={(d.daily_trend||[]).slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip/><Legend iconSize={10} wrapperStyle={{fontSize:'11px'}}/>
                <Bar dataKey="present" fill="#10b981" name={ar?'حاضر':'Present'} stackId="a"/>
                <Bar dataKey="absent"  fill="#ef4444" name={ar?'غائب':'Absent'}  stackId="a"/>
                <Bar dataKey="late"    fill="#f59e0b" name={ar?'متأخر':'Late'}   stackId="a" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Ch>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'أعلى معدل حضور':'Best Attendance'}>
              {progBar([...(d.employee_rates||[])].reverse().slice(0,8), e=>e.name, e=>`${e.rate}%`, e=>e.rate>90?'bg-green-500':e.rate>75?'bg-amber-400':'bg-red-400')}
            </Ch>
            <Ch title={ar?'أدنى معدل حضور':'Worst Attendance'}>
              {progBar(d.worst_attendance||[], e=>e.name, e=>`${e.rate}%`, ()=>'bg-red-400')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          INVENTORY
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='inventory' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الأصناف':'Items'}       val={fmtN(d.total_items)}            color="text-blue-600"  bg="bg-blue-50"  icon={Package}/>
            <KPI label={ar?'قيمة المخزون':'Stock Value'}   val={fmt(d.total_value)}              color="text-green-600" bg="bg-green-50" icon={DollarSign}/>
            <KPI label={ar?'تنبيهات نفاد':'Low Stock'}     val={fmtN(d.low_stock_alerts?.length)}color="text-red-600"   bg="bg-red-50"   icon={AlertCircle}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'توزيع الفئات':'Category Distribution'}>
              {pieChart(d.category_distribution||[], 'count', 'category')}
            </Ch>
            <Ch title={ar?'حالة المخزون':'Stock Status'}>
              {pieChart(d.status_distribution||[], 'count', 'status')}
            </Ch>
          </div>
          {d.low_stock_alerts?.length>0 && (
            <Ch title={`⚠️ ${ar?'تنبيهات المخزون المنخفض':'Low Stock Alerts'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {d.low_stock_alerts.map((item,i)=>(
                  <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-xs font-medium text-gray-700">{item.name}</span>
                    <span className="text-xs text-red-600 font-bold">{item.quantity}/{item.min_quantity}</span>
                  </div>
                ))}
              </div>
            </Ch>
          )}
          <Ch title={ar?'أعلى الأصناف قيمة':'Top Items by Value'}>
            {listRows(d.top_items_by_value?.slice(0,10)||[], i=>i.name, i=>fmt(i.total_value))}
          </Ch>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STOCK MOVEMENTS
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='stock' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الحركات':'Movements'}   val={fmtN(d.total_movements)}  color="text-blue-600"  bg="bg-blue-50"  icon={Activity}/>
            <KPI label={ar?'وارد':'Stock In'}               val={fmtN(d.total_in)}          color="text-green-600" bg="bg-green-50" icon={TrendingUp}/>
            <KPI label={ar?'صادر':'Stock Out'}              val={fmtN(d.total_out)}         color="text-red-600"   bg="bg-red-50"   icon={TrendingDown}/>
            <KPI label={ar?'قيمة المخزون':'Total Value'}   val={fmt(d.total_value)}         color="text-purple-600"bg="bg-purple-50"icon={DollarSign}/>
            <KPI label={ar?'مخزون منخفض':'Low Stock'}      val={fmtN(d.low_stock_count)}   color="text-amber-600" bg="bg-amber-50" icon={AlertCircle}/>
            <KPI label={ar?'المستودعات':'Warehouses'}       val={fmtN(d.warehouses?.length)}color="text-cyan-600"  bg="bg-cyan-50"  icon={Package}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'الحركة الشهرية':'Monthly Movement'}>
              {areaChart(d.monthly_trend||[], [{key:'in',name:ar?'وارد':'In'},{key:'out',name:ar?'صادر':'Out'}], 240)}
            </Ch>
            <Ch title={ar?'أنواع الحركات':'Movement Types'}>
              {pieChart(d.movement_types||[], 'qty', 'type')}
            </Ch>
          </div>
          <Ch title={ar?'المستودعات':'Warehouses'}>
            {listRows(d.warehouses||[], w=>w.name, w=>`${fmtN(w.items)} صنف / ${fmt(w.value)}`, 'text-blue-600')}
          </Ch>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FIXED ASSETS
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='assets' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'عدد الأصول':'Assets'}            val={fmtN(d.total_assets)}      color="text-blue-600"  bg="bg-blue-50"  icon={Building2}/>
            <KPI label={ar?'تكلفة الشراء':'Total Cost'}      val={fmt(d.total_cost)}          color="text-purple-600"bg="bg-purple-50"icon={DollarSign}/>
            <KPI label={ar?'مجمع الإهلاك':'Depreciation'}    val={fmt(d.total_depreciation)}  color="text-red-600"   bg="bg-red-50"   icon={TrendingDown}/>
            <KPI label={ar?'القيمة الدفترية':'Book Value'}   val={fmt(d.net_value)}           color="text-green-600" bg="bg-green-50" icon={TrendingUp}/>
            <KPI label={ar?'نسبة الإهلاك':'Dep. Rate'}       val={pct(d.depreciation_rate)}   color="text-amber-600" bg="bg-amber-50" icon={Activity}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'توزيع الأصول حسب النوع':'Asset Types'}>
              {pieChart((d.by_type||[]).map(t=>({name:t.type,value:t.cost})), 'value', 'name')}
            </Ch>
            <Ch title={ar?'القيمة الدفترية حسب النوع':'Book Value by Type'}>
              {barChart(d.by_type||[], 'net_value', 'type', 220, '#10b981', ar?'القيمة الدفترية':'Net Value')}
            </Ch>
          </div>
          <Ch title={ar?'حالة الأصول':'Asset Status'}>
            {pieChart(d.status_distribution||[], 'count', 'status')}
          </Ch>
          <Ch title={ar?'أعلى الأصول قيمة':'Top Assets by Cost'}>
            {listRows(d.assets||[], a=>a.name||a.asset_name||'', a=>`${fmt(a.cost||a.purchase_price)} | ${ar?'دفتري':''}: ${fmt((a.cost||0)-(a.accumulated_depreciation||0))}`)}
          </Ch>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PROJECTS
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='projects' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'المشاريع':'Projects'}           val={fmtN(d.total_projects)}    color="text-blue-600"   bg="bg-blue-50"   icon={FolderKanban}/>
            <KPI label={ar?'المهام':'Tasks'}                val={fmtN(d.total_tasks)}        color="text-purple-600" bg="bg-purple-50" icon={CheckCircle}/>
            <KPI label={ar?'مكتملة':'Completed'}            val={fmtN(d.completed_tasks)}    color="text-green-600"  bg="bg-green-50"  icon={CheckCircle}/>
            <KPI label={ar?'متأخرة':'Overdue'}              val={fmtN(d.overdue_tasks)}      color="text-red-600"    bg="bg-red-50"    icon={AlertCircle}/>
            <KPI label={ar?'معدل الإنجاز':'Completion'}    val={pct(d.completion_rate)}      color="text-cyan-600"   bg="bg-cyan-50"   icon={Activity}/>
            <KPI label={ar?'الإيرادات':'Revenues'}          val={fmt(d.total_revenues)}      color="text-green-600"  bg="bg-green-50"  icon={TrendingUp}/>
            <KPI label={ar?'المصروفات':'Expenses'}          val={fmt(d.total_expenses)}      color="text-red-600"    bg="bg-red-50"    icon={TrendingDown}/>
            <KPI label={ar?'صافي الربح':'Net Profit'}       val={fmt(d.net_profit)}          color="text-blue-600"   bg="bg-blue-50"   icon={DollarSign}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'حالة المشاريع':'Project Status'}>
              {pieChart(d.status_distribution||[], 'count', 'status')}
            </Ch>
            <Ch title={ar?'الميزانية مقابل الإنفاق':'Budget vs Spent'}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={(d.budget_usage||[]).slice(0,8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis type="number" tick={{fontSize:10}}/>
                  <YAxis dataKey="name" type="category" tick={{fontSize:9}} width={70}/>
                  <Tooltip formatter={v=>v?.toLocaleString?.()}/><Legend iconSize={10} wrapperStyle={{fontSize:'10px'}}/>
                  <Bar dataKey="budget" fill="#6366f1" name={ar?'الميزانية':'Budget'} radius={[0,3,3,0]}/>
                  <Bar dataKey="spent"  fill="#ef4444" name={ar?'المنفق':'Spent'}   radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SALES
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='sales' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'العملاء':'Customers'}           val={fmtN(d.total_customers)}   color="text-blue-600"  bg="bg-blue-50"  icon={ShoppingCart}/>
            <KPI label={ar?'الفواتير':'Invoices'}           val={fmtN(d.total_invoices)}     color="text-purple-600"bg="bg-purple-50"icon={FileText}/>
            <KPI label={ar?'إجمالي مفوتر':'Invoiced'}      val={fmt(d.total_invoiced)}       color="text-indigo-600"bg="bg-indigo-50"icon={DollarSign}/>
            <KPI label={ar?'تم التحصيل':'Collected'}        val={fmt(d.total_paid)}           color="text-green-600" bg="bg-green-50" icon={CheckCircle}/>
            <KPI label={ar?'مستحق':'Pending'}               val={fmt(d.total_pending)}        color="text-amber-600" bg="bg-amber-50" icon={Clock}/>
            <KPI label={ar?'معدل التحصيل':'Collection %'}  val={pct(d.collection_rate)}      color="text-cyan-600"  bg="bg-cyan-50"  icon={TrendingUp}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'الإيرادات الشهرية':'Monthly Revenue'}>
              {areaChart(d.monthly_trend||[], [{key:'revenue',name:ar?'الإيرادات':'Revenue'}], 240)}
            </Ch>
            <Ch title={ar?'حالة الفواتير':'Invoice Status'}>
              {pieChart(d.status_distribution||[], 'count', 'status')}
            </Ch>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PURCHASES
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='purchases' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'الموردون':'Suppliers'}          val={fmtN(d.total_suppliers)}   color="text-blue-600"  bg="bg-blue-50"  icon={Truck}/>
            <KPI label={ar?'أوامر الشراء':'POs'}           val={fmtN(d.total_pos)}          color="text-purple-600"bg="bg-purple-50"icon={FileText}/>
            <KPI label={ar?'إجمالي المشتريات':'Purchases'} val={fmtN(d.total_purchases)}    color="text-indigo-600"bg="bg-indigo-50"icon={Package}/>
            <KPI label={ar?'قيمة المشتريات':'Amount'}      val={fmt(d.total_amount)}         color="text-green-600" bg="bg-green-50" icon={DollarSign}/>
            <KPI label={ar?'تم الدفع':'Paid'}               val={fmt(d.paid)}                color="text-cyan-600"  bg="bg-cyan-50"  icon={CheckCircle}/>
            <KPI label={ar?'مستحق الدفع':'Pending'}         val={fmt(d.pending)}             color="text-amber-600" bg="bg-amber-50" icon={Clock}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ch title={ar?'المشتريات الشهرية':'Monthly Purchases'}>
              {barChart(d.monthly_trend||[], 'amount', 'month', 240, '#f59e0b', ar?'المبلغ':'Amount')}
            </Ch>
            <Ch title={ar?'حالة المشتريات':'Purchase Status'}>
              {pieChart(d.status_distribution||[], 'count', 'status')}
            </Ch>
          </div>
          <Ch title={ar?'أعلى الموردين مشتريات':'Top Suppliers'}>
            {listRows(d.top_suppliers||[], s=>s.name, s=>fmt(s.amount), 'text-orange-600')}
          </Ch>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ETA INVOICES
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && tab==='eta' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={ar?'إجمالي الفواتير':'Invoices'}       val={fmtN(d.total_invoices)}   color="text-blue-600"  bg="bg-blue-50"  icon={FileText}/>
            <KPI label={ar?'القيمة الإجمالية':'Total Value'}   val={fmt(d.total_value)}         color="text-green-600" bg="bg-green-50" icon={DollarSign}/>
            <KPI label={ar?'مرسلة لـ ETA':'ETA Submitted'}    val={fmtN(d.eta_submitted)}      color="text-purple-600"bg="bg-purple-50"icon={Activity}/>
            <KPI label={ar?'مقبولة':'Accepted'}                val={fmtN(d.eta_accepted)}       color="text-cyan-600"  bg="bg-cyan-50"  icon={CheckCircle}/>
            <KPI label={ar?'مرفوضة':'Rejected'}               val={fmtN(d.eta_rejected)}       color="text-red-600"   bg="bg-red-50"   icon={AlertCircle}/>
            <KPI label={ar?'نسبة القبول':'Acceptance Rate'}   val={pct(d.acceptance_rate)}     color="text-amber-600" bg="bg-amber-50" icon={TrendingUp}/>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Ch title={ar?'الفواتير الشهرية':'Monthly Invoices'} span={2}>
              {areaChart(d.monthly_trend||[], [{key:'amount',name:ar?'القيمة':'Amount'}], 240)}
            </Ch>
            <Ch title={ar?'حالة الفواتير':'Invoice Status'}>
              {pieChart(d.status_distribution||[], 'count', 'status')}
            </Ch>
          </div>
          <Ch title={ar?'أنواع الوثائق':'Document Types'}>
            {pieChart(d.type_distribution||[], 'count', 'type')}
          </Ch>
        </div>
      )}

      {/* Empty state */}
      {!loading && !d && (
        <div className="text-center py-20 text-gray-400">
          <BarChart3 className="h-14 w-14 mx-auto mb-4 opacity-20"/>
          <p className="font-medium">{ar?'لا توجد بيانات للفترة المحددة':'No data for selected period'}</p>
          <p className="text-xs mt-1">{ar?'جرب فترة زمنية مختلفة':'Try a different time period'}</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsModule;
