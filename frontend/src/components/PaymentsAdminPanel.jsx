/**
 * PaymentsAdminPanel — لوحة المدفوعات للسوبر ادمن
 * عرض كل المدفوعات + تأكيد الدفع اليدوي + إحصائيات الإيراد
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  DollarSign, Search, RefreshCw, CheckCircle, XCircle,
  Clock, TrendingUp, CreditCard, Banknote, Smartphone,
  Filter, Download, Eye, Check, X, Loader2, BarChart3,
  Building2, Calendar, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const METHOD_ICONS = {
  instapay: '📱', vodafone_cash: '📲', bank_transfer: '🏦',
  credit_card: '💳', activation_code: '🔑', cash: '💵',
  paypal: '🅿️', online: '💻', check: '📝', unknown: '❓'
};

const METHOD_NAMES_AR = {
  instapay: 'InstaPay', vodafone_cash: 'فودافون كاش',
  bank_transfer: 'تحويل بنكي', credit_card: 'بطاقة ائتمان',
  activation_code: 'كود تفعيل', cash: 'نقدي',
  paypal: 'PayPal', online: 'دفع إلكتروني', check: 'شيك'
};

export default function PaymentsAdminPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [data, setData]         = useState({ subscriptions: [], summary: {} });
  const [requests, setRequests] = useState([]);
  const [summary, setSummary]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [activeTab, setActiveTab] = useState('transactions');
  const [updating, setUpdating] = useState(null);
  const [msg, setMsg]           = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [confirmForm, setConfirmForm] = useState({ method: 'instapay', reference: '', amount: '' });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, summaryRes, reqRes] = await Promise.all([
        fetch(`${API}/api/admin/payments/subscriptions?status=${filter === 'all' ? '' : filter}`, { headers }),
        fetch(`${API}/api/admin/payments/summary`, { headers }),
        fetch(`${API}/api/admin/payment-requests`, { headers }),
      ]);
      if (subsRes.ok) {
        const d = await subsRes.json();
        setData(d);
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (reqRes.ok) {
        const r = await reqRes.json();
        setRequests(Array.isArray(r) ? r : r.requests || []);
      }
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const confirmPayment = async (subId, isPaid) => {
    if (!subId) return;
    setUpdating(subId);
    try {
      const res = await fetch(`${API}/api/admin/payments/subscriptions/${subId}/payment`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          is_paid: isPaid,
          payment_method: confirmForm.method,
          reference_number: confirmForm.reference,
          amount: parseFloat(confirmForm.amount) || undefined,
          payment_date: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setMsg({ type: 'success', text: ar ? '✅ تم تحديث حالة الدفع' : '✅ Payment status updated' });
        setShowConfirmModal(null);
        fetchData();
      }
    } catch {}
    setUpdating(null);
    setTimeout(() => setMsg(null), 4000);
  };

  const filtered = (data.subscriptions || []).filter(s => {
    const q = search.toLowerCase();
    return (s.company_name || '').toLowerCase().includes(q) ||
           (s.company_email || '').toLowerCase().includes(q);
  });

  const totalRevenue = summary.total_revenue || 0;
  const byMethod = summary.by_payment_method || {};
  const byMonth = summary.by_month || {};

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F1729] to-[#1a3a2a] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'المدفوعات والمعاملات' : 'Payments & Transactions'}</h2>
              <p className="text-green-200 text-xs mt-0.5">{ar ? 'إدارة كل مدفوعات الاشتراكات' : 'Manage all subscription payments'}</p>
            </div>
          </div>
          <button onClick={fetchData} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: ar ? 'إجمالي الإيراد' : 'Total Revenue',       value: `${totalRevenue.toLocaleString()} ${ar ? 'ج.م' : 'EGP'}`, color: 'text-green-300', icon: TrendingUp },
            { label: ar ? 'مدفوع' : 'Paid',                          value: data.summary?.paid || 0,           color: 'text-green-300', icon: CheckCircle },
            { label: ar ? 'غير مدفوع' : 'Unpaid',                   value: data.summary?.unpaid || 0,         color: 'text-red-300',   icon: AlertCircle },
            { label: ar ? 'إيراد معلق' : 'Pending Revenue',         value: `${(data.summary?.pending_revenue || 0).toLocaleString()} ${ar ? 'ج.م' : 'EGP'}`, color: 'text-yellow-300', icon: Clock },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-white/60 text-xs">{s.label}</p>
              </div>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* By Method */}
        {Object.keys(byMethod).length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/60 text-xs mb-2">{ar ? 'الإيراد بطريقة الدفع:' : 'Revenue by payment method:'}</p>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(byMethod).map(([method, info]) => (
                <div key={method} className="bg-white/10 rounded-lg px-3 py-1.5 text-xs">
                  <span>{METHOD_ICONS[method] || '💰'} {ar ? (METHOD_NAMES_AR[method] || method) : method}</span>
                  <span className="text-green-300 font-bold mr-2">
                    {info.total?.toLocaleString()} {ar ? 'ج.م' : 'EGP'} ({info.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'transactions', label: ar ? 'المعاملات' : 'Transactions' },
          { id: 'requests',     label: ar ? `طلبات الدفع ${requests.filter(r=>r.status==='pending').length > 0 ? '🔴' : ''}` : `Payment Requests ${requests.filter(r=>r.status==='pending').length > 0 ? '🔴' : ''}` },
          { id: 'analytics',   label: ar ? 'التحليلات' : 'Analytics' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={ar ? 'بحث عن شركة...' : 'Search company...'}
                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            {['all','paid','unpaid'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium ${filter === f ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600'}`}>
                {f === 'all' ? (ar ? 'الكل' : 'All') : f === 'paid' ? (ar ? '✅ مدفوع' : '✅ Paid') : (ar ? '❌ غير مدفوع' : '❌ Unpaid')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map(sub => (
                <Card key={sub.id} className={`border ${sub.is_paid ? 'border-green-100' : 'border-red-100'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${sub.is_paid ? 'bg-green-100' : 'bg-red-50'}`}>
                        {sub.is_paid ? '✅' : '⏳'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{sub.company_name}</span>
                          <Badge className={`text-xs ${sub.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {sub.is_paid ? (ar ? 'مدفوع' : 'Paid') : (ar ? 'غير مدفوع' : 'Unpaid')}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-700 text-xs">{sub.plan}</Badge>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span>📧 {sub.company_email}</span>
                          <span>💰 {sub.payment_amount?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                          {sub.payment_method && <span>{METHOD_ICONS[sub.payment_method]} {ar ? METHOD_NAMES_AR[sub.payment_method] : sub.payment_method}</span>}
                          {sub.reference_number && <span>🔖 {sub.reference_number}</span>}
                          {sub.payment_date && <span>📅 {new Date(sub.payment_date).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!sub.is_paid ? (
                          <button
                            onClick={() => { setShowConfirmModal(sub); setConfirmForm({ method: 'instapay', reference: '', amount: sub.payment_amount?.toString() || '' }); }}
                            disabled={updating === sub.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            {ar ? 'تأكيد' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            onClick={() => confirmPayment(sub.id, false)}
                            disabled={updating === sub.id}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            {ar ? 'إلغاء' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>{ar ? 'لا توجد معاملات' : 'No transactions found'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{ar ? 'لا توجد طلبات دفع معلقة' : 'No pending payment requests'}</p>
            </div>
          ) : requests.map(req => (
            <Card key={req.id} className={`border ${req.status === 'pending' ? 'border-yellow-200 bg-yellow-50/30' : req.status === 'approved' ? 'border-green-200' : 'border-gray-100'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{req.status === 'pending' ? '⏳' : req.status === 'approved' ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{req.company_name || req.company_id?.slice(0,8)}</span>
                      <Badge className={`text-xs ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {req.status === 'pending' ? (ar ? 'معلق' : 'Pending') : req.status === 'approved' ? (ar ? 'موافق عليه' : 'Approved') : (ar ? 'مرفوض' : 'Rejected')}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                      <span>{METHOD_ICONS[req.payment_method]} {ar ? METHOD_NAMES_AR[req.payment_method] : req.payment_method}</span>
                      <span>💰 {req.amount_egp?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                      {req.reference_number && <span>🔖 {req.reference_number}</span>}
                      <span>📅 {new Date(req.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>
                    </div>
                    {req.notes && <p className="text-xs text-gray-400 mt-1">💬 {req.notes}</p>}
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                        {ar ? 'موافقة' : 'Approve'}
                      </button>
                      <button className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">
                        {ar ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* By Method */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  {ar ? 'الإيراد بطريقة الدفع' : 'Revenue by Method'}
                </h3>
                <div className="space-y-2">
                  {Object.entries(byMethod).sort(([,a],[,b]) => b.total - a.total).map(([method, info]) => (
                    <div key={method} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{METHOD_ICONS[method]} {ar ? METHOD_NAMES_AR[method] || method : method}</span>
                      <div className="text-right">
                        <span className="font-bold text-sm text-gray-900">{info.total?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                        <span className="text-xs text-gray-400 mr-1">({info.count})</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(byMethod).length === 0 && <p className="text-gray-400 text-sm">{ar ? 'لا توجد بيانات' : 'No data'}</p>}
                </div>
              </CardContent>
            </Card>

            {/* By Month */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  {ar ? 'الإيراد الشهري' : 'Monthly Revenue'}
                </h3>
                <div className="space-y-2">
                  {Object.entries(byMonth).slice(0,6).map(([month, info]) => (
                    <div key={month} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">📅 {month}</span>
                      <div className="text-right">
                        <span className="font-bold text-sm text-emerald-700">{info.total?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                        <span className="text-xs text-gray-400 mr-1">({info.count})</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(byMonth).length === 0 && <p className="text-gray-400 text-sm">{ar ? 'لا توجد بيانات' : 'No data'}</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{ar ? 'تأكيد الدفع' : 'Confirm Payment'}</h3>
              <button onClick={() => setShowConfirmModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {ar ? `تأكيد دفع اشتراك "${showConfirmModal.company_name}"` : `Confirm payment for "${showConfirmModal.company_name}"`}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'طريقة الدفع' : 'Payment Method'}</label>
                <select
                  value={confirmForm.method}
                  onChange={e => setConfirmForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {['instapay','vodafone_cash','bank_transfer','cash','credit_card','activation_code'].map(m => (
                    <option key={m} value={m}>{METHOD_ICONS[m]} {ar ? METHOD_NAMES_AR[m] : m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'رقم المرجع / الإيصال' : 'Reference / Receipt No.'}</label>
                <input
                  type="text" placeholder={ar ? 'اختياري' : 'Optional'}
                  value={confirmForm.reference}
                  onChange={e => setConfirmForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'المبلغ المدفوع (ج.م)' : 'Amount Paid (EGP)'}</label>
                <input
                  type="number"
                  value={confirmForm.amount}
                  onChange={e => setConfirmForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => confirmPayment(showConfirmModal.id, true)}
                disabled={!!updating}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {ar ? 'تأكيد الدفع' : 'Confirm Payment'}
              </button>
              <button onClick={() => setShowConfirmModal(null)} className="px-4 border border-gray-300 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
