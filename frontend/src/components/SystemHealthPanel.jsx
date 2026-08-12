/**
 * SystemHealthPanel — لوحة صحة النظام
 * Super Admin يراقب كل مكونات النظام
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Activity, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Server, Database, Mail, Bell, Shield, Users, CreditCard,
  Zap, Clock, BarChart3, Globe, Loader2, Play
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_CONFIG = {
  ok:       { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200', icon: CheckCircle,    label_ar: 'يعمل',      label_en: 'OK' },
  warn:     { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200',icon: AlertTriangle,  label_ar: 'تحذير',     label_en: 'Warning' },
  fail:     { color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',   icon: XCircle,        label_ar: 'فشل',       label_en: 'Failed' },
  degraded: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',icon: AlertTriangle,  label_ar: 'متدهور',    label_en: 'Degraded' },
  critical: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   icon: XCircle,        label_ar: 'حرج',       label_en: 'Critical' },
  unknown:  { color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200',  icon: Clock,          label_ar: 'غير معروف', label_en: 'Unknown' },
};

const CHECK_ICONS = {
  database: Database, collections: Database, users: Users,
  auth_service: Shield, email: Mail, push: Bell,
  subscriptions: CreditCard,
};

const CATEGORY_ICONS = {
  auth: Shield, health: Activity, admin: Server,
  payments: CreditCard, push: Bell, hr: Users,
  financial: BarChart3, invoices: CreditCard,
  projects: Zap, inventory: Globe,
  employees: Users, subscriptions: CreditCard, coupons: Zap,
  scheduler: Clock,
};

export default function SystemHealthPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [health, setHealth]         = useState(null);
  const [routes, setRoutes]         = useState(null);
  const [allRoutes, setAllRoutes]   = useState(null);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [activeTab, setActiveTab]   = useState('overview');
  const [lastRun, setLastRun]       = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, historyRes] = await Promise.all([
        fetch(`${API}/api/health/detailed`, { headers }),
        fetch(`${API}/api/health/history?limit=20`, { headers }),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const runFullTest = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/health/run-now`, {
        method: 'POST', headers
      });
      if (res.ok) {
        const data = await res.json();
        setHealth(data.system_health);
        setRoutes(data.route_test);
        setLastRun(data.timestamp);
      }
    } catch {}
    setRunning(false);
    fetchHealth();
  };

  const fetchAllRoutes = async () => {
    try {
      const res = await fetch(`${API}/api/health/routes`, { headers });
      if (res.ok) setAllRoutes(await res.json());
    } catch {}
  };

  const statusCfg = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.unknown;

  const overallStatus = health?.status || 'unknown';
  const cfg = statusCfg(overallStatus);
  const StatusIcon = cfg.icon;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className={`rounded-2xl p-6 text-white bg-gradient-to-r ${
        overallStatus === 'ok' ? 'from-emerald-800 to-teal-700' :
        overallStatus === 'warn' ? 'from-yellow-700 to-amber-600' :
        'from-red-800 to-red-700'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'صحة النظام' : 'System Health'}</h2>
              <p className="text-white/70 text-xs mt-0.5">
                {ar ? 'مراقبة كل مكونات النظام' : 'Monitor all system components'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchHealth} disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={runFullTest} disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-800 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors disabled:opacity-60"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {ar ? 'فحص كامل' : 'Full Test'}
            </button>
          </div>
        </div>

        {/* Overall Status */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className="w-5 h-5" />
            {ar ? cfg.label_ar : cfg.label_en}
          </div>
          {lastRun && (
            <span className="text-white/60 text-xs">
              {ar ? 'آخر فحص:' : 'Last run:'} {new Date(lastRun).toLocaleTimeString(ar ? 'ar-EG' : 'en-US')}
            </span>
          )}
        </div>

        {/* Summary Stats */}
        {health?.summary && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: ar ? 'إجمالي الفحوصات' : 'Total Checks', value: health.summary.total,  color: 'text-white' },
              { label: ar ? 'ناجح' : 'Passed',                   value: health.summary.passed, color: 'text-green-300' },
              { label: ar ? 'فشل' : 'Failed',                    value: health.summary.failed, color: 'text-red-300' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'overview', label: ar ? '📊 نظرة عامة' : '📊 Overview' },
          { id: 'routes',   label: ar ? '🌐 فحص المسارات' : '🌐 Route Tests' },
          { id: 'all',      label: ar ? '📋 كل المسارات' : '📋 All Routes' },
          { id: 'history',  label: ar ? '🕒 السجل' : '🕒 History' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'all' && !allRoutes) fetchAllRoutes(); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : health?.checks ? (
            Object.entries(health.checks).map(([key, check]) => {
              const s = statusCfg(check.status);
              const SIcon = s.icon;
              const CIcon = CHECK_ICONS[key] || Shield;
              return (
                <Card key={key} className={`border ${s.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                        <CIcon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 capitalize">{key.replace(/_/g, ' ')}</span>
                          <SIcon className={`w-4 h-4 ${s.color}`} />
                          <span className={`text-xs font-medium ${s.color}`}>
                            {ar ? s.label_ar : s.label_en}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                          {check.latency_ms !== undefined && <span>⚡ {check.latency_ms}ms</span>}
                          {check.total !== undefined && <span>{ar ? 'الإجمالي:' : 'Total:'} {check.total}</span>}
                          {check.admins !== undefined && <span>{ar ? 'مديرون:' : 'Admins:'} {check.admins}</span>}
                          {check.active !== undefined && <span>{ar ? 'نشط:' : 'Active:'} {check.active}</span>}
                          {check.companies !== undefined && <span>{ar ? 'شركات:' : 'Companies:'} {check.companies}</span>}
                          {check.configured !== undefined && <span>{ar ? 'مُعدّ:' : 'Configured:'} {check.configured ? '✅' : '❌'}</span>}
                          {check.missing?.length > 0 && <span className="text-red-500">{ar ? 'ناقص:' : 'Missing:'} {check.missing.join(', ')}</span>}
                          {check.error && <span className="text-red-500 truncate">{check.error}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-center text-gray-400 py-8">{ar ? 'اضغط "فحص كامل" لبدء الفحص' : 'Click "Full Test" to start'}</p>
          )}
        </div>
      )}

      {/* ── ROUTE TESTS TAB ── */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          {!routes ? (
            <div className="text-center py-12">
              <Play className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">{ar ? 'اضغط "فحص كامل" لاختبار كل المسارات' : 'Click "Full Test" to test all routes'}</p>
              <button onClick={runFullTest} disabled={running}
                className="px-6 py-2.5 bg-[#1e3a8a] text-white rounded-xl font-medium text-sm flex items-center gap-2 mx-auto disabled:opacity-60">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {ar ? 'بدء الفحص' : 'Start Test'}
              </button>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: ar ? 'إجمالي' : 'Total',   value: routes.summary?.total_tested, color: 'text-gray-800' },
                  { label: ar ? 'ناجح' : 'Passed',    value: routes.summary?.passed,       color: 'text-green-600' },
                  { label: ar ? 'فشل' : 'Failed',     value: routes.summary?.failed,       color: 'text-red-600' },
                  { label: ar ? 'نسبة' : 'Pass Rate', value: routes.summary?.pass_rate,    color: 'text-blue-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Failed routes */}
              {routes.failed_routes?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {ar ? `المسارات الفاشلة (${routes.failed_routes.length})` : `Failed Routes (${routes.failed_routes.length})`}
                  </h3>
                  <div className="space-y-1">
                    {routes.failed_routes.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <Badge className="bg-red-100 text-red-700">{r.status_code || 'ERR'}</Badge>
                        <code className="font-mono text-red-700">{r.method} {r.path}</code>
                        {r.error && <span className="text-red-400 truncate">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Category */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(routes.categories || {}).map(([cat, info]) => {
                  const CatIcon = CATEGORY_ICONS[cat] || Globe;
                  const allPassed = info.failed === 0;
                  return (
                    <div key={cat} className={`p-3 rounded-xl border ${allPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <CatIcon className={`w-4 h-4 ${allPassed ? 'text-green-600' : 'text-red-600'}`} />
                        <span className="font-medium text-sm capitalize">{cat}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-green-600 font-bold">{info.passed} ✅</span>
                        {info.failed > 0 && <span className="text-red-600 font-bold mr-2"> {info.failed} ❌</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ALL ROUTES TAB ── */}
      {activeTab === 'all' && (
        <div className="space-y-3">
          {!allRoutes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span>{ar ? `إجمالي المسارات المسجّلة: ${allRoutes.total_routes}` : `Total registered routes: ${allRoutes.total_routes}`}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(allRoutes.categories || {}).map(([cat, count]) => (
                  <div key={cat} className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="font-bold text-gray-900 text-lg">{count}</p>
                    <p className="text-xs text-gray-500 capitalize">{cat}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {(allRoutes.routes || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs hover:bg-gray-50">
                    <div className="flex gap-1">
                      {r.methods.map(m => (
                        <Badge key={m} className={`text-xs ${
                          m === 'GET' ? 'bg-blue-100 text-blue-700' :
                          m === 'POST' ? 'bg-green-100 text-green-700' :
                          m === 'PUT' || m === 'PATCH' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{m}</Badge>
                      ))}
                    </div>
                    <code className="font-mono text-gray-600 flex-1 truncate">{r.path}</code>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{ar ? 'لا يوجد سجل فحص بعد' : 'No health check history yet'}</p>
          ) : history.map((h, i) => {
            const s = statusCfg(h.status);
            const SIcon = s.icon;
            return (
              <Card key={i} className={`border ${s.border}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <SIcon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${s.color}`}>{ar ? s.label_ar : s.label_en}</span>
                        <Badge className="bg-gray-100 text-gray-600 text-xs">{h.type}</Badge>
                      </div>
                      {h.summary && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {h.summary.passed}/{h.summary.total} passed
                          {h.summary.failed > 0 && <span className="text-red-500 mr-1"> · {h.summary.failed} failed</span>}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(h.timestamp).toLocaleString(ar ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
