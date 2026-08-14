/**
 * SalesModule — نظام المبيعات الشامل
 * عملاء CRM | عروض أسعار | فواتير مبيعات | اشتراكات
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, FileText, Receipt, RefreshCw, Plus, Search,
  ChevronDown, Edit2, Trash2, Eye, Send, CheckCircle,
  XCircle, Clock, AlertTriangle, DollarSign, TrendingUp,
  Loader2, X, ArrowRight, Repeat, Phone, Mail, MapPin,
  Star, Filter, Download, MoreVertical, CreditCard
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

const STATUS_COLORS = {
  // quotes
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  accepted:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  expired:   'bg-orange-100 text-orange-700',
  converted: 'bg-purple-100 text-purple-700',
  // invoices
  partial:   'bg-yellow-100 text-yellow-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  // customers
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  blocked:   'bg-red-100 text-red-700',
  // subscriptions
  paused:    'bg-orange-100 text-orange-700',
};

const STATUS_AR = {
  draft:'مسودة', sent:'مرسل', accepted:'مقبول', rejected:'مرفوض',
  expired:'منتهي', converted:'محوّل', partial:'جزئي', paid:'مدفوع',
  overdue:'متأخر', cancelled:'ملغي', active:'نشط', inactive:'غير نشط',
  blocked:'محجوب', paused:'موقوف', unpaid:'غير مدفوع',
};

// ── Stat Card ─────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color = 'text-blue-700', bg = 'bg-blue-50', sub }) => (
  <Card className="border-0 shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

// ── Empty State ───────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, action }) => (
  <div className="text-center py-16 text-gray-400">
    <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
    <p className="font-medium">{title}</p>
    {action && <button onClick={action.fn} className="mt-4 px-4 py-2 bg-[#1e3a8a] text-white rounded-xl text-sm">{action.label}</button>}
  </div>
);

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function SalesModule({ language: propLang }) {
  const { language: ctxLang, isRTL } = useLanguage();
  const language = propLang || ctxLang || 'ar';
  const ar = language === 'ar';

  const [tab, setTab]     = useState('overview');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]     = useState(null);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sales/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const TABS = [
    { id: 'overview',       label: ar ? '📊 نظرة عامة'    : '📊 Overview' },
    { id: 'customers',      label: ar ? '👥 العملاء CRM'   : '👥 Customers CRM' },
    { id: 'quotations',     label: ar ? '📋 عروض الأسعار'  : '📋 Quotations' },
    { id: 'invoices',       label: ar ? '🧾 فواتير المبيعات': '🧾 Sales Invoices' },
    { id: 'subscriptions',  label: ar ? '🔄 الاشتراكات'    : '🔄 Subscriptions' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#1e3a8a] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'نظام المبيعات الشامل' : 'Sales Management'}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{ar ? 'عملاء · عروض · فواتير · اشتراكات' : 'Customers · Quotes · Invoices · Subscriptions'}</p>
            </div>
          </div>
          <button onClick={fetchStats} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: ar ? 'إجمالي العملاء' : 'Customers',    value: stats.total_customers || 0,   color: 'text-white' },
            { label: ar ? 'إيرادات الشهر'  : 'Monthly Rev',  value: `${fmt(stats.monthly_revenue)} ج.م`, color: 'text-green-300' },
            { label: ar ? 'فواتير غير مدفوعة': 'Unpaid',     value: stats.unpaid_invoices || 0,   color: 'text-yellow-300' },
            { label: ar ? 'رصيد مستحق'     : 'Outstanding',  value: `${fmt(stats.outstanding_balance)} ج.م`, color: 'text-orange-300' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={ar?'العملاء':'Customers'}     value={stats.total_customers||0}      icon={Users}    color="text-blue-700"   bg="bg-blue-50" />
            <StatCard label={ar?'عروض الأسعار':'Quotes'}  value={stats.total_quotes||0}         icon={FileText} color="text-purple-700" bg="bg-purple-50"
                      sub={`${stats.quote_conversion_rate||0}% ${ar?'نسبة التحويل':'conversion'}`} />
            <StatCard label={ar?'الفواتير':'Invoices'}     value={stats.total_invoices||0}       icon={Receipt}  color="text-amber-700"  bg="bg-amber-50" />
            <StatCard label={ar?'فواتير متأخرة':'Overdue'} value={stats.overdue_invoices||0}     icon={AlertTriangle} color="text-red-700" bg="bg-red-50" />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: ar?'عميل جديد':'New Customer',      tab:'customers',    icon: Users,    color:'bg-blue-600 hover:bg-blue-700' },
              { label: ar?'عرض سعر':'New Quote',          tab:'quotations',   icon: FileText, color:'bg-purple-600 hover:bg-purple-700' },
              { label: ar?'فاتورة مبيعات':'New Invoice',  tab:'invoices',     icon: Receipt,  color:'bg-amber-600 hover:bg-amber-700' },
              { label: ar?'اشتراك جديد':'New Subscription',tab:'subscriptions',icon:Repeat,   color:'bg-green-600 hover:bg-green-700' },
            ].map((a, i) => (
              <button key={i} onClick={() => setTab(a.tab)}
                className={`${a.color} text-white rounded-xl p-4 text-center transition-colors`}>
                <a.icon className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-bold">{a.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CUSTOMERS ── */}
      {tab === 'customers' && (
        <CustomersTab headers={headers} ar={ar} showMsg={showMsg} />
      )}

      {/* ── QUOTATIONS ── */}
      {tab === 'quotations' && (
        <QuotationsTab headers={headers} ar={ar} showMsg={showMsg} setTab={setTab} fetchStats={fetchStats} />
      )}

      {/* ── INVOICES ── */}
      {tab === 'invoices' && (
        <InvoicesTab headers={headers} ar={ar} showMsg={showMsg} fetchStats={fetchStats} />
      )}

      {/* ── SUBSCRIPTIONS ── */}
      {tab === 'subscriptions' && (
        <SubscriptionsTab headers={headers} ar={ar} showMsg={showMsg} fetchStats={fetchStats} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CUSTOMERS TAB
// ════════════════════════════════════════════════════════════════
function CustomersTab({ headers, ar, showMsg }) {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editCustomer, setEdit]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    name:'', name_en:'', type:'individual', phone:'', phone2:'', email:'',
    address:'', city:'', country:'مصر', tax_number:'', commercial_reg:'',
    credit_limit:0, payment_terms:30, discount_percent:0,
    source:'', stage:'customer', notes:''
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status, page:1, limit:50 });
      const res = await fetch(`${API}/api/sales/customers?${q}`, { headers });
      if (res.ok) { const d = await res.json(); setCustomers(d.customers||[]); setTotal(d.total||0); }
    } catch {}
    setLoading(false);
  }, [search, status]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openForm = (cust = null) => {
    if (cust) { setEdit(cust); setForm({ name:cust.name||'', name_en:cust.name_en||'', type:cust.type||'individual', phone:cust.phone||'', phone2:cust.phone2||'', email:cust.email||'', address:cust.address||'', city:cust.city||'', country:cust.country||'مصر', tax_number:cust.tax_number||'', commercial_reg:cust.commercial_reg||'', credit_limit:cust.credit_limit||0, payment_terms:cust.payment_terms||30, discount_percent:cust.discount_percent||0, source:cust.source||'', stage:cust.stage||'customer', notes:cust.notes||'' }); }
    else { setEdit(null); setForm({ name:'', name_en:'', type:'individual', phone:'', phone2:'', email:'', address:'', city:'', country:'مصر', tax_number:'', commercial_reg:'', credit_limit:0, payment_terms:30, discount_percent:0, source:'', stage:'customer', notes:'' }); }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) { showMsg('error', ar?'الاسم مطلوب':'Name required'); return; }
    setSaving(true);
    try {
      const url    = editCustomer ? `${API}/api/sales/customers/${editCustomer.id}` : `${API}/api/sales/customers`;
      const method = editCustomer ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (res.ok) { showMsg('success', ar?'✅ تم الحفظ':'✅ Saved'); setShowForm(false); fetchCustomers(); }
      else showMsg('error', (await res.json()).detail || 'Error');
    } catch { showMsg('error', ar?'خطأ':'Error'); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm(ar?'حذف العميل؟':'Delete customer?')) return;
    try {
      const res = await fetch(`${API}/api/sales/customers/${id}`, { method:'DELETE', headers });
      if (res.ok) { showMsg('success', ar?'✅ تم الحذف':'✅ Deleted'); fetchCustomers(); }
      else showMsg('error', (await res.json()).detail || 'Error');
    } catch {}
  };

  const TYPE_LABELS = { individual: ar?'فرد':'Individual', company: ar?'شركة':'Company', government: ar?'حكومي':'Government' };
  const STAGE_LABELS = { lead:ar?'عميل محتمل':'Lead', prospect:ar?'مرتقب':'Prospect', customer:ar?'عميل':'Customer', vip:'VIP' };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={ar?'بحث باسم أو هاتف أو بريد...':'Search by name, phone, email...'}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={status} onChange={e=>setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm">
          <option value="">{ar?'كل الحالات':'All Status'}</option>
          <option value="active">{ar?'نشط':'Active'}</option>
          <option value="inactive">{ar?'غير نشط':'Inactive'}</option>
          <option value="blocked">{ar?'محجوب':'Blocked'}</option>
        </select>
        <button onClick={() => openForm()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-xl text-sm font-bold">
          <Plus className="w-4 h-4" /> {ar?'عميل جديد':'New Customer'}
        </button>
      </div>

      <p className="text-xs text-gray-500">{ar?`إجمالي: ${total} عميل`:`Total: ${total} customers`}</p>

      {/* Table */}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> :
       customers.length === 0 ? <EmptyState icon={Users} title={ar?'لا يوجد عملاء بعد':'No customers yet'} action={{fn:()=>openForm(), label:ar?'إضافة أول عميل':'Add first customer'}} /> :
       <div className="space-y-2">
        {customers.map(c => (
          <Card key={c.id} className="border border-gray-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 flex-shrink-0">
                  {c.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{c.name}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[c.status]||'bg-gray-100'}`}>{ar?STATUS_AR[c.status]:c.status}</Badge>
                    <Badge className="text-xs bg-gray-100 text-gray-600">{ar?TYPE_LABELS[c.type]:c.type}</Badge>
                    {c.stage === 'vip' && <Badge className="text-xs bg-yellow-100 text-yellow-700">⭐ VIP</Badge>}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>📧 {c.email}</span>}
                    {c.city && <span>📍 {c.city}</span>}
                    {c.code && <span className="text-gray-400">{c.code}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openForm(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">{editCustomer ? (ar?'تعديل عميل':'Edit Customer') : (ar?'إضافة عميل جديد':'New Customer')}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {key:'name',label:ar?'الاسم *':'Name *',required:true},
                {key:'name_en',label:ar?'الاسم بالإنجليزية':'Name (EN)'},
                {key:'phone',label:ar?'الهاتف':'Phone'},
                {key:'phone2',label:ar?'هاتف آخر':'Phone 2'},
                {key:'email',label:ar?'البريد الإلكتروني':'Email',type:'email'},
                {key:'city',label:ar?'المدينة':'City'},
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]} required={f.required}
                    onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'العنوان':'Address'}</label>
                <input type="text" value={form.address} onChange={e=>setForm(v=>({...v,address:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {[
                {key:'type',label:ar?'النوع':'Type',options:{individual:ar?'فرد':'Individual',company:ar?'شركة':'Company',government:ar?'حكومي':'Government'}},
                {key:'stage',label:ar?'المرحلة':'Stage',options:{lead:ar?'عميل محتمل':'Lead',prospect:ar?'مرتقب':'Prospect',customer:ar?'عميل':'Customer',vip:'VIP'}},
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <select value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(f.options).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              ))}
              {[
                {key:'tax_number',label:ar?'الرقم الضريبي':'Tax Number'},
                {key:'commercial_reg',label:ar?'السجل التجاري':'Commercial Reg'},
                {key:'credit_limit',label:ar?'حد الائتمان':'Credit Limit',type:'number'},
                {key:'payment_terms',label:ar?'شروط الدفع (أيام)':'Payment Terms (days)',type:'number'},
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:f.type==='number'?Number(e.target.value):e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'ملاحظات':'Notes'}</label>
                <textarea value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-[#1e3a8a] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar?'حفظ':'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 border border-gray-300 rounded-xl text-sm text-gray-600">
                {ar?'إلغاء':'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// QUOTATIONS TAB
// ════════════════════════════════════════════════════════════════
function QuotationsTab({ headers, ar, showMsg, setTab, fetchStats }) {
  const [quotes, setQuotes]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    customer_name:'', customer_tax_number:'', customer_address:'',
    date: new Date().toISOString().split('T')[0],
    validity_days: 30, vat_percent: 14, discount_percent: 0,
    notes:'', terms: ar?'الأسعار شاملة ضريبة القيمة المضافة':'Prices include VAT',
    items: [{ description:'', quantity:1, unit:'', unit_price:0, total:0 }]
  });

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status, page:1, limit:50 });
      const res = await fetch(`${API}/api/sales/quotations?${q}`, { headers });
      if (res.ok) { const d = await res.json(); setQuotes(d.quotations||[]); setTotal(d.total||0); }
    } catch {}
    setLoading(false);
  }, [search, status]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: field === 'quantity' || field === 'unit_price' ? Number(value) : value };
    items[idx].total = items[idx].quantity * items[idx].unit_price;
    setForm(f => ({ ...f, items }));
  };

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { description:'', quantity:1, unit:'', unit_price:0, total:0 }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_,i)=>i!==idx) }));

  const calcTotals = () => {
    const sub = form.items.reduce((a,i) => a + (i.quantity * i.unit_price), 0);
    const da  = sub * (form.discount_percent / 100);
    const ad  = sub - da;
    const va  = ad * (form.vat_percent / 100);
    return { sub, da, ad, va, total: ad + va };
  };

  const save = async () => {
    if (!form.customer_name) { showMsg('error', ar?'اسم العميل مطلوب':'Customer name required'); return; }
    if (form.items.length === 0) { showMsg('error', ar?'أضف صنفاً واحداً على الأقل':'Add at least one item'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/sales/quotations`, { method:'POST', headers, body: JSON.stringify(form) });
      if (res.ok) { showMsg('success', ar?'✅ تم إنشاء عرض السعر':'✅ Quote created'); setShowForm(false); fetchQuotes(); fetchStats(); }
      else showMsg('error', (await res.json()).detail || 'Error');
    } catch { showMsg('error', ar?'خطأ':'Error'); }
    setSaving(false);
  };

  const updateStatus = async (id, newStatus) => {
    await fetch(`${API}/api/sales/quotations/${id}`, { method:'PUT', headers, body: JSON.stringify({ status: newStatus }) });
    fetchQuotes();
  };

  const convertToInvoice = async (id, qnum) => {
    if (!window.confirm(ar?`تحويل ${qnum} لفاتورة مبيعات؟`:`Convert ${qnum} to invoice?`)) return;
    try {
      const res = await fetch(`${API}/api/sales/quotations/${id}/convert`, { method:'POST', headers });
      const d = await res.json();
      if (res.ok) { showMsg('success', ar?`✅ تم التحويل — ${d.invoice?.invoice_number}`:`✅ Converted — ${d.invoice?.invoice_number}`); fetchQuotes(); fetchStats(); setTab('invoices'); }
      else showMsg('error', d.detail || 'Error');
    } catch {}
  };

  const { sub, da, ad, va, total: tot } = calcTotals();

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={ar?'بحث...':'Search...'}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm" />
        </div>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-xl text-sm">
          <option value="">{ar?'كل الحالات':'All'}</option>
          {['draft','sent','accepted','rejected','expired','converted'].map(s =>
            <option key={s} value={s}>{ar?STATUS_AR[s]:s}</option>
          )}
        </select>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-700 text-white rounded-xl text-sm font-bold">
          <Plus className="w-4 h-4" /> {ar?'عرض سعر جديد':'New Quote'}
        </button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div> :
       quotes.length === 0 ? <EmptyState icon={FileText} title={ar?'لا توجد عروض أسعار':'No quotations yet'} action={{fn:()=>setShowForm(true), label:ar?'إنشاء أول عرض':'Create first quote'}} /> :
       <div className="space-y-2">
        {quotes.map(q => (
          <Card key={q.id} className="border border-gray-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900">{q.quote_number}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[q.status]||'bg-gray-100'}`}>{ar?STATUS_AR[q.status]:q.status}</Badge>
                    <span className="text-sm text-gray-600">{q.customer_name}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    <span>📅 {fmtDate(q.date)}</span>
                    <span>{ar?'ينتهي:':'Expires:'} {fmtDate(q.expiry_date)}</span>
                    <span className="font-bold text-gray-800">{fmt(q.total)} {ar?'ج.م':'EGP'}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                  {q.status === 'draft' && (
                    <button onClick={() => updateStatus(q.id,'sent')}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium">
                      {ar?'إرسال':'Send'}
                    </button>
                  )}
                  {['draft','sent'].includes(q.status) && (
                    <button onClick={() => convertToInvoice(q.id, q.quote_number)}
                      className="px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />{ar?'تحويل':'Convert'}
                    </button>
                  )}
                  {q.status === 'sent' && (
                    <>
                      <button onClick={() => updateStatus(q.id,'accepted')} className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs">{ar?'قبول':'Accept'}</button>
                      <button onClick={() => updateStatus(q.id,'rejected')} className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs">{ar?'رفض':'Reject'}</button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>}

      {/* Quote Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">{ar?'إنشاء عرض سعر جديد':'New Quotation'}</h3>
              <button onClick={()=>setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'اسم العميل *':'Customer Name *'}</label>
                <input type="text" value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {[
                {key:'date',label:ar?'التاريخ':'Date',type:'date'},
                {key:'validity_days',label:ar?'صالح (أيام)':'Valid (days)',type:'number'},
                {key:'vat_percent',label:ar?'ضريبة %':'VAT %',type:'number'},
                {key:'discount_percent',label:ar?'خصم %':'Discount %',type:'number'},
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <input type={f.type||'text'} value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:f.type==='number'?Number(e.target.value):e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-700">{ar?'الأصناف':'Items'}</label>
                <button onClick={addItem} className="text-xs text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3"/>{ar?'إضافة صنف':'Add Item'}</button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1 text-xs text-gray-500 font-medium px-1">
                  <span className="col-span-5">{ar?'الوصف':'Description'}</span>
                  <span className="col-span-2">{ar?'الكمية':'Qty'}</span>
                  <span className="col-span-2">{ar?'الوحدة':'Unit'}</span>
                  <span className="col-span-2">{ar?'السعر':'Price'}</span>
                  <span className="col-span-1"></span>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                    <input className="col-span-5 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder={ar?'وصف الصنف...':'Item description...'} value={item.description} onChange={e=>updateItem(idx,'description',e.target.value)} />
                    <input className="col-span-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" type="number" min="0" value={item.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} />
                    <input className="col-span-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder={ar?'وحدة':'Unit'} value={item.unit} onChange={e=>updateItem(idx,'unit',e.target.value)} />
                    <input className="col-span-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" type="number" min="0" value={item.unit_price} onChange={e=>updateItem(idx,'unit_price',e.target.value)} />
                    <button onClick={()=>removeItem(idx)} className="col-span-1 flex justify-center text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
              {[
                {label:ar?'المجموع قبل الخصم':'Subtotal', value:fmt(sub)},
                {label:ar?`خصم ${form.discount_percent}%`:`Discount ${form.discount_percent}%`, value:fmt(da)},
                {label:ar?`ضريبة ${form.vat_percent}%`:`VAT ${form.vat_percent}%`, value:fmt(va)},
              ].map((r,i) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{r.label}</span><span>{r.value} {ar?'ج.م':'EGP'}</span>
                </div>
              ))}
              <div className="flex justify-between font-black text-gray-900 text-base pt-1.5 border-t border-gray-200">
                <span>{ar?'الإجمالي':'Total'}</span><span>{fmt(tot)} {ar?'ج.م':'EGP'}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'ملاحظات':'Notes'}</label>
              <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none mb-2" />
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar?'حفظ عرض السعر':'Save Quotation'}
              </button>
              <button onClick={()=>setShowForm(false)} className="px-5 border border-gray-300 rounded-xl text-sm text-gray-600">{ar?'إلغاء':'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INVOICES TAB
// ════════════════════════════════════════════════════════════════
function InvoicesTab({ headers, ar, showMsg, fetchStats }) {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [showPayModal, setShowPayModal] = useState(null);
  const [payForm, setPayForm]   = useState({ amount:0, method:'cash', date: new Date().toISOString().split('T')[0], reference:'' });
  const [saving, setSaving]     = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, payment_status: payStatus, page:1, limit:50 });
      const res = await fetch(`${API}/api/sales/invoices?${q}`, { headers });
      if (res.ok) { const d = await res.json(); setInvoices(d.invoices||[]); setTotal(d.total||0); }
    } catch {}
    setLoading(false);
  }, [search, payStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const recordPayment = async () => {
    if (!payForm.amount || payForm.amount <= 0) { showMsg('error', ar?'أدخل المبلغ':'Enter amount'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/sales/invoices/${showPayModal.id}/payment`, {
        method:'POST', headers, body: JSON.stringify(payForm)
      });
      if (res.ok) {
        const d = await res.json();
        showMsg('success', ar?`✅ تم تسجيل الدفعة — الرصيد: ${fmt(d.balance)} ج.م`:`✅ Payment recorded — Balance: ${fmt(d.balance)} EGP`);
        setShowPayModal(null);
        fetchInvoices();
        fetchStats();
      } else showMsg('error', (await res.json()).detail || 'Error');
    } catch {}
    setSaving(false);
  };

  const PAY_METHOD = { cash:ar?'نقدي':'Cash', bank:ar?'تحويل بنكي':'Bank', instapay:'InstaPay', check:ar?'شيك':'Check' };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={ar?'بحث...':'Search...'}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm" />
        </div>
        <select value={payStatus} onChange={e=>setPayStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-xl text-sm">
          <option value="">{ar?'كل الحالات':'All'}</option>
          {['unpaid','partial','paid'].map(s => <option key={s} value={s}>{ar?STATUS_AR[s]:s}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-500">{ar?`إجمالي: ${total} فاتورة`:`Total: ${total} invoices`}</p>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div> :
       invoices.length === 0 ? <EmptyState icon={Receipt} title={ar?'لا توجد فواتير بعد':'No invoices yet'} /> :
       <div className="space-y-2">
        {invoices.map(inv => (
          <Card key={inv.id} className={`border ${inv.payment_status==='overdue'?'border-red-200':inv.payment_status==='paid'?'border-green-100':'border-gray-100'} hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900">{inv.invoice_number}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[inv.payment_status]||'bg-gray-100'}`}>
                      {ar?STATUS_AR[inv.payment_status]:inv.payment_status}
                    </Badge>
                    <span className="text-sm text-gray-600">{inv.customer_name}</span>
                    {inv.from_quote && <span className="text-xs text-purple-500">من {inv.quote_number}</span>}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    <span>📅 {fmtDate(inv.date)}</span>
                    <span>{ar?'استحقاق:':'Due:'} {fmtDate(inv.due_date)}</span>
                    <span className="font-bold text-gray-800">{fmt(inv.total)} {ar?'ج.م':'EGP'}</span>
                    {inv.balance > 0 && <span className="text-red-600 font-bold">{ar?'متبقي:':'Balance:'} {fmt(inv.balance)} {ar?'ج.م':'EGP'}</span>}
                  </div>
                  {/* Payment progress */}
                  {inv.total > 0 && inv.paid_amount > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{width:`${Math.min(100,inv.paid_amount/inv.total*100)}%`}} />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(inv.paid_amount/inv.total*100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
                {inv.payment_status !== 'paid' && (
                  <button onClick={() => { setShowPayModal(inv); setPayForm(f=>({...f,amount:inv.balance||inv.total,date:new Date().toISOString().split('T')[0]})); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium flex-shrink-0">
                    <DollarSign className="w-3 h-3" />{ar?'تسجيل دفعة':'Record Payment'}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" dir="rtl">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900">{ar?'تسجيل دفعة':'Record Payment'}</h3>
              <button onClick={()=>setShowPayModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-bold text-gray-800">{showPayModal.invoice_number} — {showPayModal.customer_name}</p>
              <p className="text-gray-600">{ar?'الرصيد المستحق:':'Balance due:'} <span className="font-bold text-red-600">{fmt(showPayModal.balance)} {ar?'ج.م':'EGP'}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'المبلغ *':'Amount *'}</label>
                <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:Number(e.target.value)}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'طريقة الدفع':'Payment Method'}</label>
                <select value={payForm.method} onChange={e=>setPayForm(f=>({...f,method:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {Object.entries(PAY_METHOD).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'التاريخ':'Date'}</label>
                <input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'المرجع':'Reference'}</label>
                <input type="text" value={payForm.reference} onChange={e=>setPayForm(f=>({...f,reference:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={recordPayment} disabled={saving}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar?'تأكيد الدفعة':'Confirm Payment'}
              </button>
              <button onClick={()=>setShowPayModal(null)} className="px-5 border border-gray-300 rounded-xl text-sm text-gray-600">{ar?'إلغاء':'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS TAB
// ════════════════════════════════════════════════════════════════
function SubscriptionsTab({ headers, ar, showMsg, fetchStats }) {
  const [subs, setSubs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    customer_name:'', service_name:'', description:'', billing_cycle:'monthly',
    amount:0, currency:'EGP', start_date: new Date().toISOString().split('T')[0],
    auto_renew: true, payment_method:'', notes:''
  });

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status, page:1, limit:50 });
      const res = await fetch(`${API}/api/sales/subscriptions?${q}`, { headers });
      if (res.ok) { const d = await res.json(); setSubs(d.subscriptions||[]); setTotal(d.total||0); }
    } catch {}
    setLoading(false);
  }, [status]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const save = async () => {
    if (!form.customer_name || !form.service_name) { showMsg('error', ar?'الاسم والخدمة مطلوبان':'Name and service required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/sales/subscriptions`, { method:'POST', headers, body: JSON.stringify(form) });
      if (res.ok) { showMsg('success', ar?'✅ تم إنشاء الاشتراك':'✅ Subscription created'); setShowForm(false); fetchSubs(); fetchStats(); }
      else showMsg('error', (await res.json()).detail || 'Error');
    } catch {}
    setSaving(false);
  };

  const updateStatus = async (id, newStatus) => {
    await fetch(`${API}/api/sales/subscriptions/${id}`, { method:'PATCH', headers, body: JSON.stringify({ status: newStatus }) });
    fetchSubs();
  };

  const generateInvoice = async (id, name) => {
    try {
      const res = await fetch(`${API}/api/sales/subscriptions/${id}/generate-invoice`, { method:'POST', headers });
      const d = await res.json();
      if (res.ok) showMsg('success', ar?`✅ تم توليد الفاتورة ${d.invoice?.invoice_number}`:`✅ Invoice ${d.invoice?.invoice_number} generated`);
      else showMsg('error', d.detail || 'Error');
    } catch {}
  };

  const CYCLE_LABELS = { monthly:ar?'شهري':'Monthly', quarterly:ar?'ربع سنوي':'Quarterly', 'semi-annual':ar?'نصف سنوي':'Semi-Annual', annual:ar?'سنوي':'Annual' };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-xl text-sm">
          <option value="">{ar?'كل الحالات':'All'}</option>
          {['active','paused','cancelled','expired'].map(s=><option key={s} value={s}>{ar?STATUS_AR[s]:s}</option>)}
        </select>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-xl text-sm font-bold">
          <Plus className="w-4 h-4" /> {ar?'اشتراك جديد':'New Subscription'}
        </button>
      </div>

      <p className="text-xs text-gray-500">{ar?`إجمالي: ${total} اشتراك`:`Total: ${total} subscriptions`}</p>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div> :
       subs.length === 0 ? <EmptyState icon={Repeat} title={ar?'لا توجد اشتراكات':'No subscriptions yet'} action={{fn:()=>setShowForm(true),label:ar?'إنشاء اشتراك':'Create subscription'}} /> :
       <div className="space-y-2">
        {subs.map(s => (
          <Card key={s.id} className={`border ${s.status==='active'?'border-green-100':s.status==='paused'?'border-orange-100':'border-gray-100'} hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Repeat className="w-5 h-5 text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900">{s.service_name}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[s.status]||'bg-gray-100'}`}>{ar?STATUS_AR[s.status]:s.status}</Badge>
                    <Badge className="text-xs bg-blue-100 text-blue-700">{ar?CYCLE_LABELS[s.billing_cycle]:s.billing_cycle}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{s.customer_name}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    <span className="font-bold text-gray-800">{fmt(s.amount)} {ar?'ج.م':'EGP'}</span>
                    <span>{ar?'الفاتورة القادمة:':'Next billing:'} {fmtDate(s.next_billing_date)}</span>
                    <span>{ar?'فواتير مُولّدة:':'Invoices:'} {s.invoices_generated||0}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                  {s.status === 'active' && (
                    <>
                      <button onClick={() => generateInvoice(s.id, s.service_name)}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                        <Receipt className="w-3 h-3" />{ar?'فاتورة':'Invoice'}
                      </button>
                      <button onClick={() => updateStatus(s.id,'paused')} className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">{ar?'إيقاف':'Pause'}</button>
                    </>
                  )}
                  {s.status === 'paused' && (
                    <button onClick={() => updateStatus(s.id,'active')} className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs">{ar?'تفعيل':'Resume'}</button>
                  )}
                  {['active','paused'].includes(s.status) && (
                    <button onClick={() => updateStatus(s.id,'cancelled')} className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs">{ar?'إلغاء':'Cancel'}</button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>}

      {/* Subscription Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">{ar?'اشتراك جديد':'New Subscription'}</h3>
              <button onClick={()=>setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                {key:'customer_name',label:ar?'اسم العميل *':'Customer Name *'},
                {key:'service_name',label:ar?'اسم الخدمة *':'Service Name *'},
                {key:'description',label:ar?'الوصف':'Description'},
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <input type="text" value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'دورة الفوترة':'Billing Cycle'}</label>
                  <select value={form.billing_cycle} onChange={e=>setForm(f=>({...f,billing_cycle:e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {Object.entries(CYCLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'المبلغ':'Amount'}</label>
                  <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:Number(e.target.value)}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'تاريخ البداية':'Start Date'}</label>
                <input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <input type="checkbox" checked={form.auto_renew} onChange={e=>setForm(f=>({...f,auto_renew:e.target.checked}))}
                  className="w-4 h-4 rounded" />
                <label className="text-sm text-gray-700 font-medium">{ar?'تجديد تلقائي':'Auto-renew'}</label>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar?'ملاحظات':'Notes'}</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 bg-green-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar?'إنشاء الاشتراك':'Create Subscription'}
              </button>
              <button onClick={()=>setShowForm(false)} className="px-5 border border-gray-300 rounded-xl text-sm text-gray-600">{ar?'إلغاء':'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
