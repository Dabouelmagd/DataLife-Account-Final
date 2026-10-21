/**
 * GPS Settings — إعدادات GPS للشركة
 * HR Admin يحدد موقع الشركة ونطاق الحضور
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MapPin, Save, Navigation, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { getPosition } from '../utils/geo';

const API = process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com';

export default function GPSSettings() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [settings, setSettings] = useState({
    enabled: false, latitude: '', longitude: '',
    radius_meters: 40, address: '', allow_remote: false, remote_mode: 'none',
  });
  const [locating, setLocating] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/attendance/gps-settings`, { headers })
      .then(r => r.json())
      .then(d => { if (d.gps_settings && d.gps_settings.latitude) setSettings(s => ({ ...s, ...d.gps_settings,
        remote_mode: d.gps_settings.remote_mode || (d.gps_settings.allow_remote ? 'all' : 'none') })); })
      .catch(() => {});
    loadRemote();
  }, []);

  // ── per-employee remote-work exceptions ──
  const [emps, setEmps] = useState([]);
  const [remoteIds, setRemoteIds] = useState(new Set());
  const [empQuery, setEmpQuery] = useState('');
  const [empErr, setEmpErr] = useState('');
  function loadRemote() {
    fetch(`${API}/api/attendance/remote-employees`, { headers })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : ''); return d; })
      .then(d => { const list = d.employees || []; setEmps(list); setRemoteIds(new Set(list.filter(e => e.remote_work_allowed).map(e => e.id))); })
      .catch(e => setEmpErr(e.message || (ar ? 'تعذّر تحميل الموظفين' : 'Could not load employees')));
  }
  const toggleEmp = (id) => setRemoteIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const shownEmps = emps.filter(e => {
    const q = empQuery.trim().toLowerCase();
    return !q || [e.name, e.employee_code, e.department, e.branch].some(v => (v || '').toString().toLowerCase().includes(q));
  });

  const detectMyLocation = () => {
    setLocating(true);
    getPosition({ ar }).then(
      pos => {
        setSettings(s => ({ ...s, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      (err) => { setMsg({ type: 'error', text: err.message }); setLocating(false); }
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
        method: 'POST', headers, body: JSON.stringify({ ...settings, allow_remote: settings.remote_mode === 'all' }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && settings.remote_mode === 'selected') {
        const r2 = await fetch(`${API}/api/attendance/remote-employees`, {
          method: 'PUT', headers, body: JSON.stringify({ employee_ids: [...remoteIds] }),
        });
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) { setMsg({ type: 'error', text: typeof d2.detail === 'string' ? d2.detail : (ar ? 'فشل حفظ الموظفين' : 'Saving employees failed') }); setSaving(false); return; }
      }
      if (res.ok) setMsg({ type: 'success', text: ar ? '✅ تم حفظ إعدادات GPS' : '✅ GPS settings saved' });
      else        setMsg({ type: 'error', text: typeof d.detail === 'string' ? d.detail : (ar ? 'فشل الحفظ' : 'Save failed') });
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 6000);
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
          type="range" min="20" max="2000" step="10"
          value={settings.radius_meters}
          onChange={e => setSettings(s => ({ ...s, radius_meters: parseInt(e.target.value) }))}
          className="w-full accent-blue-600"
        />
        {settings.radius_meters <= 30 && (
          <p className="text-xs text-amber-700 mt-2">
            {ar ? 'دقة GPS في الموبايل داخل المباني غالباً بين 10 و30 متراً — مع نطاق ضيق قد يُرفض موظف موجود فعلاً في المكتب، فيعيد المحاولة بجوار شباك أو يُفعّل «الموقع الدقيق» في الموبايل.'
                : 'Phone GPS indoors is often 10–30 m accurate — a tight radius may refuse someone who is in the office.'}
          </p>
        )}
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>20م {ar ? '(دقيق جداً)' : '(very precise)'}</span>
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

      {/* Remote work: nobody / selected employees / everyone */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
        <div>
          <span className="text-sm font-medium text-amber-800 block">{ar ? 'العمل عن بُعد' : 'Remote work'}</span>
          <span className="text-xs text-amber-700">{ar ? 'مين يقدر يسجّل حضوره من أي مكان (خارج نطاق موقع الشركة)' : 'Who may check in from anywhere (outside the office radius)'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={ar ? 'العمل عن بُعد' : 'Remote work'}>
          {[
            ['none', ar ? 'لا أحد' : 'Nobody', ar ? 'الكل من موقع الشركة' : 'Everyone at the office'],
            ['selected', ar ? 'موظفين محددين' : 'Selected employees', ar ? 'استثناءات تختارها' : 'Exceptions you pick'],
            ['all', ar ? 'كل الموظفين' : 'All employees', ar ? 'من أي مكان' : 'From anywhere'],
          ].map(([val, label, hint]) => (
            <button key={val} type="button" role="radio" aria-checked={settings.remote_mode === val}
              onClick={() => setSettings(s => ({ ...s, remote_mode: val }))}
              className={`text-start px-3 py-2 rounded-lg border text-sm transition-colors ${settings.remote_mode === val
                ? 'border-amber-500 bg-white ring-2 ring-amber-400 text-amber-900 font-bold'
                : 'border-amber-200 bg-amber-50/50 text-amber-800 hover:bg-white'}`}>
              <span className="block">{label}</span>
              <span className="block text-xs font-normal text-amber-700">{hint}</span>
            </button>
          ))}
        </div>

        {settings.remote_mode === 'selected' && (
          <div className="bg-white rounded-lg border border-amber-200 p-2 space-y-2">
            <div className="flex items-center gap-2">
              <input type="search" value={empQuery} onChange={e => setEmpQuery(e.target.value)}
                placeholder={ar ? 'ابحث بالاسم أو الكود أو القسم' : 'Search by name, code or department'}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
              <span className="text-xs text-gray-600 whitespace-nowrap">{ar ? `المختارين: ${remoteIds.size}` : `Selected: ${remoteIds.size}`}</span>
            </div>
            {empErr && <p className="text-xs text-red-700">{empErr}</p>}
            {!empErr && emps.length === 0 && <p className="text-xs text-gray-500 p-2">{ar ? 'لا يوجد موظفين' : 'No employees'}</p>}
            <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
              {shownEmps.map(e => (
                <li key={e.id}>
                  <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-amber-50 rounded">
                    <input type="checkbox" checked={remoteIds.has(e.id)} onChange={() => toggleEmp(e.id)} className="w-4 h-4 accent-amber-600" />
                    <span className="text-sm text-gray-800 flex-1">{e.name}{e.employee_code ? <span className="text-xs text-gray-500"> · {e.employee_code}</span> : null}</span>
                    {(e.department || e.branch) && <span className="text-xs text-gray-500">{[e.department, e.branch].filter(Boolean).join(' — ')}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-600">{ar ? 'باقي الموظفين لازم يكونوا داخل نطاق موقع الشركة. اضغط «حفظ» تحت عشان الاختيار يتسجّل.' : 'Everyone else must be inside the office radius. Press Save below to apply.'}</p>
          </div>
        )}
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
