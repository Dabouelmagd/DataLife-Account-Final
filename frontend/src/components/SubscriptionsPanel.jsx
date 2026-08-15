import React, { useState, useEffect, useCallback } from 'react';
import { LogoImg, LogoImgSmall } from '../assets/logos';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CreditCard, Search, RefreshCw, CheckCircle, XCircle,
  Clock, TrendingUp, Users, Building2, Plus, Calendar,
  ChevronDown, AlertTriangle, Crown, Zap, Package, Star,
  Edit2, X, Loader2, Filter
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PLANS = [
  { id: 'trial',        name_ar: 'تجريبي',     name_en: 'Trial',        color: 'bg-gray-500',   icon: '🔍', days: 14,  price_ar: 'مجاني',    price_en: 'Free' },
  { id: 'starter',      name_ar: 'مبتدئ',      name_en: 'Starter',      color: 'bg-blue-500',   icon: '🚀', days: 30,  price_ar: '299 ج.م',  price_en: '299 EGP' },
  { id: 'professional', name_ar: 'محترف',      name_en: 'Professional', color: 'bg-purple-600', icon: '⭐', days: 30,  price_ar: '799 ج.م',  price_en: '799 EGP' },
  { id: 'enterprise',   name_ar: 'مؤسسي',      name_en: 'Enterprise',   color: 'bg-amber-500',  icon: '👑', days: 30,  price_ar: '1,499 ج.م',price_en: '1,499 EGP' },
  { id: 'lifetime',     name_ar: 'مدى الحياة', name_en: 'Lifetime',     color: 'bg-emerald-600',icon: '♾️', days: 9999,price_ar: 'مدى الحياة',price_en: 'Lifetime' },
];

const DURATIONS = [
  { id: 'monthly',  name_ar: 'شهري',        name_en: 'Monthly',    days: 30  },
  { id: '3months',  name_ar: '3 أشهر',      name_en: '3 Months',   days: 90  },
  { id: '6months',  name_ar: '6 أشهر',      name_en: '6 Months',   days: 180 },
  { id: 'yearly',   name_ar: 'سنوي (-20%)', name_en: 'Yearly (-20%)', days: 365 },
  { id: 'lifetime', name_ar: 'مدى الحياة',  name_en: 'Lifetime',   days: 9999 },
];

export default function SubscriptionsPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [subs, setSubs]         = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  const [form, setForm] = useState({
    company_id: '', plan: 'professional', duration: 'monthly'
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, compRes] = await Promise.all([
        fetch(`${API}/api/admin/subscriptions`, { headers }),
        fetch(`${API}/api/admin/companies`, { headers }),
      ]);
      if (subsRes.ok) setSubs(await subsRes.json());
      if (compRes.ok) {
        const data = await compRes.json();
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const stats = {
    total: subs.length,
    active: subs.filter(s => s.status === 'active').length,
    trial: subs.filter(s => s.plan === 'trial').length,
    expiringSoon: subs.filter(s => {
      if (!s.end_date) return false;
      const days = (new Date(s.end_date) - new Date()) / (1000*60*60*24);
      return days > 0 && days <= 7;
    }).length,
    expired: subs.filter(s => s.status === 'expired' || (s.end_date && new Date(s.end_date) < new Date())).length,
  };

  const planRevenue = {
    starter: subs.filter(s => s.plan === 'starter' && s.status === 'active').length * 299,
    professional: subs.filter(s => s.plan === 'professional' && s.status === 'active').length * 799,
    enterprise: subs.filter(s => s.plan === 'enterprise' && s.status === 'active').length * 1499,
  };
  const totalRevenue = Object.values(planRevenue).reduce((a, b) => a + b, 0);

  // Filter subscriptions
  const filtered = subs.filter(s => {
    const name = (s.company_name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active' ? s.status === 'active' :
      filter === 'trial' ? s.plan === 'trial' || s.status === 'trial' :
      filter === 'expiring' ? (() => { const d = (new Date(s.end_date) - new Date()) / (1000*60*60*24); return d > 0 && d <= 7; })() :
      filter === 'expired' ? (s.status === 'expired' || new Date(s.end_date) < new Date()) : true;
    return matchSearch && matchFilter;
  });

  const getDaysLeft = (endDate) => {
    if (!endDate) return null;
    const days = Math.ceil((new Date(endDate) - new Date()) / (1000*60*60*24));
    return days;
  };

  const getPlan = (planId) => PLANS.find(p => p.id === planId) || PLANS[0];

  const handleAssign = async () => {
    if (!form.company_id) {
      setMsg({ type: 'error', text: ar ? 'اختر الشركة' : 'Select company' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/subscriptions/assign`, {
        method: 'POST', headers, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setMsg({ type: 'success', text: ar ? `✅ تم تفعيل اشتراك "${data.company_name}"` : `✅ Subscription activated for "${data.company_name}"` });
        setShowAssign(false);
        fetchData();
      } else {
        setMsg({ type: 'error', text: data.detail || 'Error' });
      }
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 5000);
  };

  const handleExtend = async (companyId, months) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/subscriptions/${companyId}/extend`, {
        method: 'PUT', headers,
        body: JSON.stringify({ extension_days: months * 30 })
      });
      if (res.ok) {
        setMsg({ type: 'success', text: ar ? `✅ تم تمديد الاشتراك ${months} شهر` : `✅ Extended by ${months} month(s)` });
        setSelectedSub(null);
        fetchData();
      }
    } catch {}
    setSaving(false);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F1729] to-[#28376B] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'إدارة الاشتراكات' : 'Subscriptions Management'}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{ar ? 'إدارة اشتراكات كل الشركات' : 'Manage all company subscriptions'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1e3a8a] rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {ar ? 'اشتراك جديد' : 'New Subscription'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: ar ? 'الإجمالي' : 'Total',      value: stats.total,        icon: Building2, color: 'text-white' },
            { label: ar ? 'نشط' : 'Active',           value: stats.active,       icon: CheckCircle, color: 'text-green-300' },
            { label: ar ? 'تجريبي' : 'Trial',         value: stats.trial,        icon: Clock, color: 'text-blue-300' },
            { label: ar ? 'ينتهي قريباً' : 'Expiring', value: stats.expiringSoon, icon: AlertTriangle, color: 'text-yellow-300' },
            { label: ar ? 'منتهي' : 'Expired',        value: stats.expired,      icon: XCircle, color: 'text-red-300' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-white/70">
            <span>🚀 {ar ? 'مبتدئ' : 'Starter'}: {subs.filter(s=>s.plan==='starter'&&s.status==='active').length}</span>
            <span>⭐ {ar ? 'محترف' : 'Pro'}: {subs.filter(s=>s.plan==='professional'&&s.status==='active').length}</span>
            <span>👑 {ar ? 'مؤسسي' : 'Ent'}: {subs.filter(s=>s.plan==='enterprise'&&s.status==='active').length}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">{ar ? 'الإيراد الشهري المتوقع' : 'Expected Monthly Revenue'}</p>
            <p className="text-lg font-black text-yellow-300">{totalRevenue.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`p-4 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <Card className="border-blue-200 shadow-lg">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{ar ? '➕ تفعيل اشتراك جديد' : '➕ Activate New Subscription'}</h3>
              <button onClick={() => setShowAssign(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Company select */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'الشركة *' : 'Company *'}</label>
              <select
                value={form.company_id}
                onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{ar ? 'اختر الشركة...' : 'Select company...'}</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                ))}
              </select>
            </div>

            {/* Plan selection */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">{ar ? 'الخطة' : 'Plan'}</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.filter(p => p.id !== 'trial').map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setForm(f => ({ ...f, plan: plan.id }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.plan === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{plan.icon}</div>
                    <div className="text-xs font-bold text-gray-800">{ar ? plan.name_ar : plan.name_en}</div>
                    <div className="text-xs text-gray-500">{ar ? plan.price_ar : plan.price_en}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">{ar ? 'المدة' : 'Duration'}</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map(dur => (
                  <button
                    key={dur.id}
                    onClick={() => setForm(f => ({ ...f, duration: dur.id }))}
                    className={`p-2.5 rounded-xl border-2 text-center text-xs transition-all ${
                      form.duration === dur.id ? 'border-blue-500 bg-blue-50 font-bold text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {ar ? dur.name_ar : dur.name_en}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAssign} disabled={saving}
                className="flex-1 py-2.5 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar ? 'تفعيل الاشتراك' : 'Activate Subscription'}
              </button>
              <button onClick={() => setShowAssign(false)} className="px-4 border border-gray-300 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={ar ? 'بحث عن شركة...' : 'Search company...'}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {[
            { id: 'all',      label: ar ? 'الكل' : 'All' },
            { id: 'active',   label: ar ? 'نشط' : 'Active' },
            { id: 'trial',    label: ar ? 'تجريبي' : 'Trial' },
            { id: 'expiring', label: ar ? 'ينتهي قريباً' : 'Expiring' },
            { id: 'expired',  label: ar ? 'منتهي' : 'Expired' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{ar ? 'لا توجد اشتراكات' : 'No subscriptions found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => {
            const plan = getPlan(sub.plan);
            const daysLeft = getDaysLeft(sub.end_date);
            const isExpired = daysLeft !== null && daysLeft <= 0;
            const isExpiring = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
            const isLifetime = sub.duration === 'lifetime' || daysLeft > 9000;

            return (
              <Card key={sub.id} className={`border transition-all hover:shadow-md ${
                isExpired ? 'border-red-100 bg-red-50/30' :
                isExpiring ? 'border-yellow-100 bg-yellow-50/30' :
                sub.status === 'active' ? 'border-gray-200' : 'border-gray-100 opacity-70'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Plan icon */}
                    <div className={`w-12 h-12 ${plan.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
                      {plan.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{sub.company_name || sub.company_id?.slice(0,8)}</span>
                        <Badge className={`text-xs text-white ${plan.color}`}>
                          {ar ? plan.name_ar : plan.name_en}
                        </Badge>
                        {isExpired && <Badge className="bg-red-100 text-red-700 text-xs">❌ {ar ? 'منتهي' : 'Expired'}</Badge>}
                        {isExpiring && <Badge className="bg-yellow-100 text-yellow-700 text-xs">⚠️ {ar ? `ينتهي خلال ${daysLeft} يوم` : `Expires in ${daysLeft}d`}</Badge>}
                        {isLifetime && <Badge className="bg-emerald-100 text-emerald-700 text-xs">♾️ {ar ? 'مدى الحياة' : 'Lifetime'}</Badge>}
                        {sub.status === 'active' && !isExpired && !isExpiring && !isLifetime && (
                          <Badge className="bg-green-100 text-green-700 text-xs">✅ {ar ? 'نشط' : 'Active'}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        {sub.start_date && <span>📅 {ar ? 'بدأ' : 'Started'}: {new Date(sub.start_date).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>}
                        {!isLifetime && sub.end_date && <span>🔚 {ar ? 'ينتهي' : 'Ends'}: {new Date(sub.end_date).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>}
                        {!isLifetime && daysLeft !== null && daysLeft > 0 && (
                          <span className={isExpiring ? 'text-yellow-600 font-bold' : ''}>
                            ⏱️ {daysLeft} {ar ? 'يوم متبقي' : 'days left'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setSelectedSub(selectedSub?.id === sub.id ? null : sub)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        {ar ? 'تمديد' : 'Extend'}
                      </button>
                    </div>
                  </div>

                  {/* Extend panel */}
                  {selectedSub?.id === sub.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-600 mb-2">{ar ? 'تمديد الاشتراك:' : 'Extend subscription:'}</p>
                      <div className="flex gap-2 flex-wrap">
                        {[1, 3, 6, 12].map(months => (
                          <button
                            key={months}
                            onClick={() => handleExtend(sub.company_id, months)}
                            disabled={saving}
                            className="px-4 py-2 bg-[#1e3a8a] text-white rounded-xl text-xs font-medium hover:bg-[#1e40af] transition-colors disabled:opacity-60"
                          >
                            +{months} {ar ? (months === 1 ? 'شهر' : 'أشهر') : (months === 1 ? 'Month' : 'Months')}
                          </button>
                        ))}
                        <button
                          onClick={() => setSelectedSub(null)}
                          className="px-4 py-2 border border-gray-300 rounded-xl text-xs text-gray-600 hover:bg-gray-50"
                        >
                          {ar ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
