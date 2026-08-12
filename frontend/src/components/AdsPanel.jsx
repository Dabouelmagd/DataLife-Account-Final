/**
 * AdsPanel — نظام الإعلانات الكامل
 * صفحات: المساحات + الحجز + الإعدادات
 */
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Megaphone, Plus, CheckCircle, Clock, DollarSign,
  Settings, Globe, Zap, Monitor, Smartphone, Loader2,
  RefreshCw, Eye, Edit2, X, Image, Link, Phone, Mail
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const SPACE_ICONS = { hero_banner: Monitor, sidebar_right: Smartphone, pricing_banner: DollarSign, blog_inline: Globe, footer_banner: Megaphone, popup_ad: Zap };
const PAYMENT_METHODS = [
  { id: 'instapay',      label_ar: 'InstaPay',         label_en: 'InstaPay' },
  { id: 'vodafone_cash', label_ar: 'فودافون كاش',       label_en: 'Vodafone Cash' },
  { id: 'bank_transfer', label_ar: 'تحويل بنكي',        label_en: 'Bank Transfer' },
];

export default function AdsPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [spaces, setSpaces]       = useState([]);
  const [bookings, setBookings]   = useState({ bookings: [], total: 0, pending: 0, active: 0, total_revenue_egp: 0 });
  const [adsense, setAdsense]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('spaces');
  const [showBookForm, setShowBookForm] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState(null);

  const [form, setForm] = useState({
    space_id: '', duration: 'monthly', start_date: new Date().toISOString().split('T')[0],
    advertiser_name: '', advertiser_email: '', advertiser_phone: '',
    ad_title: '', ad_url: '', payment_method: 'bank_transfer', payment_reference: '', notes: ''
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [spacesRes, bookingsRes, adsenseRes] = await Promise.all([
        fetch(`${API}/api/ads/spaces`, { headers }),
        fetch(`${API}/api/ads/bookings`, { headers }),
        fetch(`${API}/api/ads/adsense/config`, { headers }),
      ]);
      if (spacesRes.ok) setSpaces((await spacesRes.json()).spaces || []);
      if (bookingsRes.ok) setBookings(await bookingsRes.json());
      if (adsenseRes.ok) setAdsense(await adsenseRes.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleBook = async () => {
    if (!form.advertiser_name || !form.advertiser_email) {
      setMsg({ type: 'error', text: ar ? 'الاسم والبريد مطلوبان' : 'Name and email required' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/ads/book`, {
        method: 'POST', headers, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: ar ? `✅ تم إرسال طلب الحجز! المبلغ: ${data.total_price_egp?.toLocaleString()} ج.م` : `✅ Booking submitted! Amount: ${data.total_price_egp?.toLocaleString()} EGP` });
        setShowBookForm(null);
        fetchAll();
      } else {
        setMsg({ type: 'error', text: data.detail || 'Error' });
      }
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 8000);
  };

  const updateBooking = async (id, status) => {
    await fetch(`${API}/api/ads/bookings/${id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status })
    });
    fetchAll();
  };

  const saveAdsense = async () => {
    setSaving(true);
    await fetch(`${API}/api/ads/adsense/config`, {
      method: 'PUT', headers, body: JSON.stringify(adsense)
    });
    setSaving(false);
    setMsg({ type: 'success', text: ar ? '✅ تم حفظ إعدادات AdSense' : '✅ AdSense settings saved' });
    setTimeout(() => setMsg(null), 3000);
  };

  const getPrice = (space, duration) => {
    const map = { daily: space.daily_price_egp, weekly: space.weekly_price_egp, monthly: space.monthly_price_egp };
    return map[duration] || space.monthly_price_egp;
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a0a2e] to-[#16213e] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'نظام الإعلانات' : 'Advertising System'}</h2>
              <p className="text-purple-200 text-xs mt-0.5">{ar ? 'إدارة المساحات الإعلانية + AdSense' : 'Ad spaces management + AdSense'}</p>
            </div>
          </div>
          <button onClick={fetchAll} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: ar ? 'المساحات' : 'Spaces',           value: spaces.length,                      color: 'text-white' },
            { label: ar ? 'حجوزات نشطة' : 'Active',       value: bookings.active,                    color: 'text-green-300' },
            { label: ar ? 'في الانتظار' : 'Pending',       value: bookings.pending,                   color: 'text-yellow-300' },
            { label: ar ? 'الإيراد' : 'Revenue',           value: `${(bookings.total_revenue_egp||0).toLocaleString()} ج.م`, color: 'text-purple-300' },
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
        {[
          { id: 'spaces',   label: ar ? '📐 المساحات' : '📐 Ad Spaces' },
          { id: 'bookings', label: ar ? '📋 الحجوزات' : '📋 Bookings' },
          { id: 'adsense',  label: ar ? '⚙️ AdSense' : '⚙️ AdSense' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* ── AD SPACES TAB ── */}
      {activeTab === 'spaces' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? <div className="col-span-2 flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div> :
          spaces.map(space => {
            const SpaceIcon = SPACE_ICONS[space.id] || Monitor;
            return (
              <Card key={space.id} className={`border ${space.is_available ? 'border-purple-100' : 'border-gray-100 opacity-70'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SpaceIcon className="w-5 h-5 text-purple-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{ar ? space.name_ar : space.name_en}</span>
                        <Badge className={space.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {space.is_available ? (ar ? `✅ ${space.available_slots} متاح` : `✅ ${space.available_slots} available`) : (ar ? '❌ ممتلئ' : '❌ Full')}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{ar ? space.location_ar : space.location_en}</p>
                      <p className="text-xs text-gray-400 mt-0.5">📐 {space.size}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{ar ? space.description_ar : space.description_ar}</p>

                  {/* Prices */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: ar ? 'يومي' : 'Daily', price: space.daily_price_egp },
                      { label: ar ? 'أسبوعي' : 'Weekly', price: space.weekly_price_egp },
                      { label: ar ? 'شهري' : 'Monthly', price: space.monthly_price_egp },
                    ].map((p, i) => (
                      <div key={i} className="text-center bg-purple-50 rounded-lg py-2">
                        <p className="text-xs text-gray-500">{p.label}</p>
                        <p className="font-bold text-purple-800 text-sm">{p.price?.toLocaleString()}</p>
                        <p className="text-xs text-purple-600">{ar ? 'ج.م' : 'EGP'}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setShowBookForm(space); setForm(f => ({ ...f, space_id: space.id })); }}
                    disabled={!space.is_available}
                    className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {space.is_available ? (ar ? '📅 حجز هذه المساحة' : '📅 Book this space') : (ar ? 'غير متاح حالياً' : 'Not available')}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── BOOKING FORM MODAL ── */}
      {showBookForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">📅 {ar ? `حجز: ${showBookForm.name_ar}` : `Book: ${showBookForm.name_en}`}</h3>
              <button onClick={() => setShowBookForm(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              {/* Duration + Price */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'مدة الحجز' : 'Duration'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['daily','weekly','monthly'].map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, duration: d }))}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${form.duration === d ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}>
                      {d === 'daily' ? (ar ? 'يومي' : 'Daily') : d === 'weekly' ? (ar ? 'أسبوعي' : 'Weekly') : (ar ? 'شهري' : 'Monthly')}
                      <br /><span className="text-purple-700 font-bold">{getPrice(showBookForm, d)?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'الاسم *' : 'Name *'}</label>
                  <input type="text" value={form.advertiser_name}
                    onChange={e => setForm(f => ({ ...f, advertiser_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'البريد *' : 'Email *'}</label>
                  <input type="email" value={form.advertiser_email}
                    onChange={e => setForm(f => ({ ...f, advertiser_email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'الهاتف' : 'Phone'}</label>
                  <input type="tel" value={form.advertiser_phone}
                    onChange={e => setForm(f => ({ ...f, advertiser_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'تاريخ البداية' : 'Start Date'}</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'عنوان الإعلان' : 'Ad Title'}</label>
                <input type="text" value={form.ad_title}
                  onChange={e => setForm(f => ({ ...f, ad_title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'رابط الإعلان (URL)' : 'Ad URL'}</label>
                <input type="url" placeholder="https://..." value={form.ad_url}
                  onChange={e => setForm(f => ({ ...f, ad_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>

              {/* Payment */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'طريقة الدفع' : 'Payment Method'}</label>
                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{ar ? m.label_ar : m.label_en}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'رقم المرجع / الإيصال' : 'Payment Reference'}</label>
                <input type="text" value={form.payment_reference}
                  onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>

              {/* Total */}
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-600">{ar ? 'إجمالي المبلغ' : 'Total Amount'}</p>
                <p className="text-2xl font-black text-purple-800">{getPrice(showBookForm, form.duration)?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={handleBook} disabled={saving}
                  className="flex-1 py-2.5 bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {ar ? 'إرسال طلب الحجز' : 'Submit Booking Request'}
                </button>
                <button onClick={() => setShowBookForm(null)} className="px-4 border border-gray-300 rounded-xl text-gray-600 text-sm">
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKINGS TAB ── */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {bookings.bookings?.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{ar ? 'لا توجد حجوزات' : 'No bookings yet'}</p>
            </div>
          ) : bookings.bookings?.map(booking => (
            <Card key={booking.id} className={`border ${
              booking.status === 'active' ? 'border-green-200' :
              booking.status === 'pending' ? 'border-yellow-200 bg-yellow-50/20' : 'border-gray-100'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    booking.status === 'active' ? 'bg-green-100' : booking.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    {booking.status === 'active' ? '✅' : booking.status === 'pending' ? '⏳' : '❌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{booking.advertiser_name}</span>
                      <Badge className="text-xs bg-purple-100 text-purple-700">{ar ? booking.space_name_ar : booking.space_name_en}</Badge>
                      <Badge className={`text-xs ${booking.status === 'active' ? 'bg-green-100 text-green-700' : booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                      <span>📧 {booking.advertiser_email}</span>
                      <span>💰 {booking.price_egp?.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                      <span>📅 {booking.start_date?.split('T')[0]} → {booking.end_date?.split('T')[0]}</span>
                    </div>
                    {booking.ad_url && <p className="text-xs text-blue-500 mt-0.5 truncate">🔗 {booking.ad_url}</p>}
                  </div>
                  {booking.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => updateBooking(booking.id, 'active')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                        {ar ? 'تفعيل' : 'Activate'}
                      </button>
                      <button onClick={() => updateBooking(booking.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">
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

      {/* ── ADSENSE TAB ── */}
      {activeTab === 'adsense' && (
        <Card className="border border-blue-200">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{ar ? 'إعدادات Google AdSense' : 'Google AdSense Settings'}</h3>
                <p className="text-xs text-gray-500">{ar ? 'ربط الموقع بـ AdSense لعرض إعلانات Google' : 'Connect site to AdSense for Google ads'}</p>
              </div>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-sm font-medium text-blue-800">{ar ? 'تفعيل AdSense' : 'Enable AdSense'}</span>
              <button
                onClick={() => setAdsense(a => ({ ...a, enabled: !a.enabled }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${adsense.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${adsense.enabled ? (isRTL ? 'right-1' : 'left-7') : (isRTL ? 'right-7' : 'left-1')}`} />
              </button>
            </div>

            {/* Client ID */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'AdSense Client ID' : 'AdSense Client ID'}</label>
              <input type="text" placeholder="ca-pub-0000000000000000"
                value={adsense.client_id || ''}
                onChange={e => setAdsense(a => ({ ...a, client_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              <p className="text-xs text-gray-400 mt-1">{ar ? 'تجده في: AdSense → Account → Account information' : 'Find it in: AdSense → Account → Account information'}</p>
            </div>

            {/* Slots */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">{ar ? 'رموز وحدات الإعلان' : 'Ad Unit Slots'}</label>
              <div className="space-y-2">
                {Object.keys(adsense.slots || {}).length === 0 ?
                  ['hero_banner','sidebar_right','pricing_banner','blog_inline','footer_banner'].map(slot => (
                    <div key={slot} className="flex items-center gap-3">
                      <label className="text-xs text-gray-600 w-36 flex-shrink-0">{slot}</label>
                      <input type="text" placeholder="0000000000"
                        value={(adsense.slots || {})[slot] || ''}
                        onChange={e => setAdsense(a => ({ ...a, slots: { ...(a.slots || {}), [slot]: e.target.value } }))}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" />
                    </div>
                  ))
                  :
                  Object.entries(adsense.slots || {}).map(([slot, value]) => (
                    <div key={slot} className="flex items-center gap-3">
                      <label className="text-xs text-gray-600 w-36 flex-shrink-0">{slot}</label>
                      <input type="text" value={value}
                        onChange={e => setAdsense(a => ({ ...a, slots: { ...a.slots, [slot]: e.target.value } }))}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" />
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Payment instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <p className="font-bold text-amber-800 mb-2">💡 {ar ? 'ملاحظة مهمة' : 'Important Note'}</p>
              <p className="text-amber-700 text-xs leading-relaxed">
                {ar
                  ? 'عند تفعيل AdSense، تظهر إعلانات Google في المساحات الخالية. عند وجود حجز يدوي، يتم عرض الإعلان اليدوي أولاً وتُعطّل AdSense لتلك المساحة.'
                  : 'When AdSense is enabled, Google ads appear in empty spaces. When manual booking exists, it takes priority over AdSense for that space.'}
              </p>
            </div>

            <button onClick={saveAdsense} disabled={saving}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {ar ? 'حفظ إعدادات AdSense' : 'Save AdSense Settings'}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
