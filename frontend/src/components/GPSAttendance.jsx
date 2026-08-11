/**
 * GPS Attendance — تسجيل الحضور بالـ GPS
 * الموظف يضغط زر واحد → يتحدد موقعه → يسجّل حضوره
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MapPin, Clock, CheckCircle, XCircle, Loader2,
  Navigation, LogIn, LogOut, AlertTriangle, Wifi
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function GPSAttendance({ employeeId, employeeName }) {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [status, setStatus]         = useState(null);   // today's attendance
  const [gpsSettings, setGpsSettings] = useState({});
  const [locating, setLocating]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);    // success / error
  const [currentLocation, setCurrentLocation] = useState(null);
  const [time, setTime]             = useState(new Date());

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch today status
  const fetchStatus = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await fetch(`${API}/api/attendance/today-status/${employeeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.attendance);
        setGpsSettings(data.gps_settings || {});
      }
    } catch {}
  }, [employeeId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Get GPS location
  const getLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(ar ? 'المتصفح لا يدعم GPS' : 'Browser does not support GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(new Error(ar ? 'تعذّر تحديد الموقع. تأكد من تفعيل GPS' : 'Could not get location. Enable GPS')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const handleCheckIn = async () => {
    setLocating(true);
    setResult(null);
    try {
      const loc = await getLocation();
      setCurrentLocation(loc);
      setLocating(false);
      setLoading(true);

      const res = await fetch(`${API}/api/attendance/check-in`, {
        method: 'POST', headers,
        body: JSON.stringify({
          employee_id: employeeId,
          location: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy },
          method: 'gps',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: 'success', message: ar ? '✅ تم تسجيل الحضور بنجاح!' : '✅ Check-in recorded!', data });
        fetchStatus();
      } else {
        setResult({ type: 'error', message: data.detail || (ar ? 'فشل تسجيل الحضور' : 'Check-in failed') });
      }
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    }
    setLocating(false);
    setLoading(false);
  };

  const handleCheckOut = async () => {
    setLocating(true);
    setResult(null);
    try {
      const loc = await getLocation();
      setCurrentLocation(loc);
      setLocating(false);
      setLoading(true);

      const res = await fetch(`${API}/api/attendance/check-out`, {
        method: 'POST', headers,
        body: JSON.stringify({
          employee_id: employeeId,
          location: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: 'success', message: ar ? '✅ تم تسجيل الانصراف بنجاح!' : '✅ Check-out recorded!', data });
        fetchStatus();
      } else {
        setResult({ type: 'error', message: data.detail || (ar ? 'فشل تسجيل الانصراف' : 'Check-out failed') });
      }
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    }
    setLocating(false);
    setLoading(false);
  };

  const checkedIn  = !!status?.check_in_time;
  const checkedOut = !!status?.check_out_time;
  const busy = locating || loading;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-sm mx-auto space-y-4">

      {/* Clock */}
      <div className="bg-gradient-to-br from-[#0F1729] to-[#28376B] rounded-2xl p-6 text-center text-white">
        <p className="text-4xl font-black tracking-tight">
          {time.toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="text-blue-200 text-sm mt-1">
          {time.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        {employeeName && (
          <p className="text-white/60 text-xs mt-2">👤 {employeeName}</p>
        )}
      </div>

      {/* GPS indicator */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
        gpsSettings.enabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
      }`}>
        <Navigation className="w-4 h-4 flex-shrink-0" />
        <span>
          {gpsSettings.enabled
            ? (ar ? `GPS مُفعّل | نطاق ${gpsSettings.radius_meters || 200}م` : `GPS Active | Radius ${gpsSettings.radius_meters || 200}m`)
            : (ar ? 'GPS غير مُفعّل — سيُسجَّل الحضور بدون تحقق موقع' : 'GPS not active — attendance without location check')}
        </span>
      </div>

      {/* Today Status */}
      {(checkedIn || checkedOut) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <h3 className="font-bold text-gray-800 text-sm">{ar ? 'حالة اليوم' : "Today's Status"}</h3>
          {checkedIn && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span>{ar ? 'وقت الحضور:' : 'Check-in:'}</span>
              <span className="font-bold">
                {new Date(status.check_in_time).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {status.is_late && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {ar ? `تأخير ${status.late_minutes} د` : `Late ${status.late_minutes}m`}
                </span>
              )}
            </div>
          )}
          {checkedOut && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle className="w-4 h-4" />
              <span>{ar ? 'وقت الانصراف:' : 'Check-out:'}</span>
              <span className="font-bold">
                {new Date(status.check_out_time).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {status.work_hours > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {status.work_hours.toFixed(1)} {ar ? 'ساعة' : 'hrs'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result message */}
      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl text-sm ${
          result.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {result.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span className="font-medium leading-snug">{result.message}</span>
        </div>
      )}

      {/* Action Buttons */}
      {!checkedIn && (
        <button
          onClick={handleCheckIn}
          disabled={busy}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
          {locating ? (ar ? 'جاري تحديد الموقع...' : 'Getting location...') :
           loading  ? (ar ? 'جاري التسجيل...' : 'Recording...') :
                      (ar ? 'تسجيل الحضور' : 'Check In')}
        </button>
      )}

      {checkedIn && !checkedOut && (
        <button
          onClick={handleCheckOut}
          disabled={busy}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
          {locating ? (ar ? 'جاري تحديد الموقع...' : 'Getting location...') :
           loading  ? (ar ? 'جاري التسجيل...' : 'Recording...') :
                      (ar ? 'تسجيل الانصراف' : 'Check Out')}
        </button>
      )}

      {checkedIn && checkedOut && (
        <div className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-500" />
          {ar ? 'تم تسجيل الحضور والانصراف اليوم ✅' : 'Attendance complete for today ✅'}
        </div>
      )}

      {/* Current location display */}
      {currentLocation && (
        <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
          <MapPin className="w-3 h-3" />
          <span>{currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}</span>
          <span>±{Math.round(currentLocation.accuracy)}m</span>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-2">
        {ar ? '🔒 موقعك محمي ولا يُشارك خارج النظام' : '🔒 Your location is private and secure'}
      </p>
    </div>
  );
}
