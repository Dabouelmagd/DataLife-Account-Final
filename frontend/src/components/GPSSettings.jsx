/**
 * GPS Settings — إعدادات GPS للشركة
 * HR Admin يحدد موقع الشركة ونطاق الحضور
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MapPin, Save, Navigation, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function GPSSettings() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [settings, setSettings] = useState({
    enabled: false, latitude: '', longitude: '',
    radius_meters: 200, address: '', allow_remote: false,
  });
  const [locating, setLocating] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/attendance/gps-settings`, { headers })
      .then(r => r.json())
      .then(d => { if (d.gps_settings && d.gps_settings.latitude) setSettings(s => ({ ...s, ...d.gps_settings })); })
      .catch(() => {});
  }, []);

  const detectMyLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSettings(s => ({ ...s, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      () => { setMsg({ type: 'error', text: ar ? 'تعذّر تحديد الموقع' : 'Could not get location' }); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    if (!settings.latitude || !settings.longitude) {
      setMsg({ type: 'error', text: ar ? 'حدد موقع الشركة أولاً' : 'Set company location first' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/attendance/gps-settings`, {
        method: 'POST', headers, body: JSON.stringify(settings),
      });
      if (res.ok) setMsg({ type: 'success', text: ar ? '✅ تم حفظ إعدادات GPS' : '✅ GPS settings saved' });
      else        setMsg({ type: 'error', text: ar ? 'فشل الحفظ' : 'Save failed' });
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800">{ar ? 'إعدادات تسجيل الحضور بالـ GPS' : 'GPS Attendance Settings'}</h2>
          <p className="text-xs text-gray-500">{ar ? 'حدد موقع الشركة ونطاق الحضور المسموح' : 'Set company location and allowed radius'}</p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
        <span className="text-sm font-medium text-gray-700">
          {ar ? 'تفعيل التحقق من الموقع' : 'Enable location verification'}
        </span>
        <button
          onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
          className={`w-12 h-6 rounded-full transition-colors relative ${settings.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.enabled ? (isRTL ? 'right-1' : 'left-7') : (isRTL ? 'right-7' : 'left-1')}`} />
        </button>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 block">
          {ar ? 'موقع الشركة' : 'Company Location'}
        </label>
        <button
          onClick={detectMyLocation}
          disabled={locating}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {locating ? (ar ? 'جاري التحديد...' : 'Locating...') : (ar ? 'استخدم موقعي الحالي كموقع الشركة' : 'Use my current location as company location')}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{ar ? 'خط العرض' : 'Latitude'}</label>
            <input
              type="number" step="0.000001"
              placeholder="30.044420"
              value={settings.latitude}
              onChange={e => setSettings(s => ({ ...s, latitude: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{ar ? 'خط الطول' : 'Longitude'}</label>
            <input
              type="number" step="0.000001"
              placeholder="31.235712"
              value={settings.longitude}
              onChange={e => setSettings(s => ({ ...s, longitude: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {settings.latitude && settings.longitude && (
          <a
            href={`https://maps.google.com/?q=${settings.latitude},${settings.longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            🗺️ {ar ? 'عرض على خرائط جوجل' : 'View on Google Maps'}
          </a>
        )}
      </div>

      {/* Radius */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            {ar ? 'نطاق الحضور المسموح' : 'Allowed Check-in Radius'}
          </label>
          <span className="text-blue-600 font-bold text-sm">{settings.radius_meters}م</span>
        </div>
        <input
          type="range" min="50" max="2000" step="50"
          value={settings.radius_meters}
          onChange={e => setSettings(s => ({ ...s, radius_meters: parseInt(e.target.value) }))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>50م {ar ? '(دقيق)' : '(precise)'}</span>
          <span>{ar ? '200م (موصى به)' : '200m (recommended)'}</span>
          <span>2000م</span>
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">{ar ? 'عنوان الشركة (اختياري)' : 'Company Address (optional)'}</label>
        <input
          type="text"
          placeholder={ar ? 'مثال: 15 شارع التحرير، القاهرة' : 'e.g. 15 Tahrir St, Cairo'}
          value={settings.address}
          onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Allow remote */}
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div>
          <span className="text-sm font-medium text-amber-800 block">{ar ? 'السماح بالعمل عن بُعد' : 'Allow Remote Work'}</span>
          <span className="text-xs text-amber-600">{ar ? 'الموظف يسجل حضوره من أي مكان' : 'Employee can check in from anywhere'}</span>
        </div>
        <button
          onClick={() => setSettings(s => ({ ...s, allow_remote: !s.allow_remote }))}
          className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.allow_remote ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.allow_remote ? (isRTL ? 'right-1' : 'left-7') : (isRTL ? 'right-7' : 'left-1')}`} />
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          msg.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {ar ? 'حفظ إعدادات GPS' : 'Save GPS Settings'}
      </button>
    </div>
  );
}
