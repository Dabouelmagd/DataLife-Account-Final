/**
 * SystemMonitorPage — لوحة مراقبة النظام (Super Admin فقط)
 * تعرض: CPU / RAM / Disk / DB / الأخطاء الأخيرة + زر إصلاح فوري
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Cpu, HardDrive, Database, Zap, Bell, Wrench, Clock
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com';

const SEV_COLOR = {
  healthy:  'text-green-600 bg-green-50 border-green-200',
  warning:  'text-amber-600 bg-amber-50 border-amber-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
};

const SEV_ICON = {
  healthy:  <CheckCircle2 className="w-5 h-5 text-green-500" />,
  warning:  <AlertTriangle className="w-5 h-5 text-amber-500" />,
  critical: <XCircle className="w-5 h-5 text-red-500" />,
};

function GaugeBar({ value, threshold, label, unit = '%' }) {
  const pct = Math.min(100, value);
  const color = pct >= threshold ? (pct >= threshold * 1.1 ? 'bg-red-500' : 'bg-amber-400') : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-bold text-gray-700">{value}{unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SystemMonitorPage() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const token = localStorage.getItem('token');

  const [status, setStatus]   = useState(null);
  const [alerts, setAlerts]   = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/monitor/status`);
      if (res.ok) setStatus(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/monitor/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    const iv = setInterval(fetchStatus, 60 * 1000); // refresh every minute
    return () => clearInterval(iv);
  }, [fetchStatus, fetchAlerts]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/monitor/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLastScan(data);
        await fetchStatus();
        await fetchAlerts();
      }
    } catch { /* silent */ }
    finally { setScanning(false); }
  };

  const overall = status?.overall || 'healthy';
  const stats   = status?.stats || {};
  const issues  = status?.issues || [];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-600" />
            {ar ? 'مراقبة النظام' : 'System Monitor'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ar ? 'فحص تلقائي كل دقيقة' : 'Auto-scan every minute'}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-md disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {ar ? 'فحص الآن + إصلاح' : 'Scan & Fix Now'}
        </button>
      </div>

      {/* Overall Status */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${SEV_COLOR[overall]}`}>
        {SEV_ICON[overall]}
        <div>
          <p className="font-bold">
            {overall === 'healthy' && (ar ? '✅ النظام يعمل بشكل مثالي' : '✅ System is healthy')}
            {overall === 'warning' && (ar ? '⚠️ يوجد تحذيرات تستحق الانتباه' : '⚠️ Warnings detected')}
            {overall === 'critical' && (ar ? '🔴 مشاكل حرجة تحتاج تدخل فوري' : '🔴 Critical issues detected')}
          </p>
          <p className="text-xs opacity-75 mt-0.5">
            {stats.timestamp ? new Date(stats.timestamp).toLocaleString(ar ? 'ar-EG' : 'en-US') : ''}
          </p>
        </div>
        {issues.length > 0 && (
          <span className="mr-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {issues.length} {ar ? 'مشكلة' : 'issues'}
          </span>
        )}
      </div>

      {/* Gauges */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          {ar ? 'موارد النظام' : 'System Resources'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GaugeBar value={stats.cpu_pct || 0}    threshold={90} label={ar ? 'المعالج CPU' : 'CPU'} />
          <GaugeBar value={stats.memory_pct || 0} threshold={85} label={ar ? 'الذاكرة RAM' : 'RAM'} />
          <GaugeBar value={stats.disk_pct || 0}   threshold={80} label={ar ? 'القرص الصلب' : 'Disk'} />
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" /> {ar ? 'قاعدة البيانات' : 'Database'}
              </span>
              <span className={`font-bold ${(stats.db_lag_ms || 0) > 500 ? 'text-red-500' : 'text-green-600'}`}>
                {stats.db_lag_ms || 0} ms
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${(stats.db_lag_ms || 0) > 500 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, ((stats.db_lag_ms || 0) / 1000) * 100)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { label: ar ? 'شركات' : 'Companies', value: stats.companies || 0, icon: '🏢' },
            { label: ar ? 'مستخدمون' : 'Users',    value: stats.users || 0,    icon: '👥' },
            { label: ar ? 'ذاكرة حرة' : 'Free RAM', value: `${((stats.memory_total_gb || 0) - (stats.memory_used_gb || 0)).toFixed(1)}GB`, icon: '💾' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xl">{s.icon}</div>
              <div className="text-lg font-black text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Issues */}
      {issues.length > 0 && (
        <div className="bg-white border border-red-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            {ar ? 'المشاكل المكتشفة' : 'Detected Issues'}
          </h2>
          <div className="space-y-3">
            {issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${SEV_COLOR[issue.severity]}`}>
                {SEV_ICON[issue.severity]}
                <div className="flex-1">
                  <p className="font-bold text-sm">{ar ? issue.title : issue.title_en}</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    {ar ? `القيمة: ${issue.value}` : `Value: ${issue.value}`}
                    {issue.auto_fix && ` · ${ar ? '✅ تم الإصلاح تلقائياً' : '✅ Auto-fixed'}`}
                  </p>
                </div>
                {issue.auto_fix && (
                  <span className="flex items-center gap-1 text-xs bg-white/60 px-2 py-1 rounded-lg font-semibold">
                    <Wrench className="w-3 h-3" /> {ar ? 'تلقائي' : 'Auto'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Scan Results */}
      {lastScan && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            {ar ? 'نتائج آخر فحص' : 'Last Scan Results'}
          </h2>
          <div className="space-y-2">
            {lastScan.fixes?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-bold text-green-700 mb-1">
                  {ar ? '🔧 إصلاحات تلقائية:' : '🔧 Auto-fixes applied:'}
                </p>
                {lastScan.fixes.map((f, i) => (
                  <p key={i} className="text-xs text-green-600">
                    • {f.issue_id}: {f.action_taken || (f.fixed ? '✅' : '❌')}
                  </p>
                ))}
              </div>
            )}
            {lastScan.alert_sent && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 font-semibold">
                📧 {ar ? 'تم إرسال تنبيه بالإيميل' : 'Alert email sent'}
              </div>
            )}
            {lastScan.issues?.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 font-semibold">
                ✅ {ar ? 'لا توجد مشاكل — النظام سليم تماماً' : 'No issues found — system is clean'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            {ar ? 'سجل التنبيهات' : 'Alert History'}
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {alerts.slice(0, 10).map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                alert.resolved ? 'border-gray-100 bg-gray-50' :
                alert.severity === 'critical' ? 'border-red-100 bg-red-50' : 'border-amber-100 bg-amber-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  alert.resolved ? 'bg-gray-400' :
                  alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">
                    {alert.issues?.length} {ar ? 'مشكلة مكتشفة' : 'issues'}
                    {alert.auto_fixed?.length > 0 && ` · ${alert.auto_fixed.length} ${ar ? 'تم إصلاحها' : 'fixed'}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(alert.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}
                  </p>
                </div>
                {alert.resolved && (
                  <span className="text-xs text-green-600 font-semibold">✅</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
