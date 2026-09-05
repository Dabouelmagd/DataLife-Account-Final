/**
 * AppUpdateNotification — نظام إشعارات التحديثات
 * - Banner في أسفل الشاشة عند وجود تحديث جديد
 * - "تحديث الآن" → يعمل reload فقط (البيانات لا تُمس)
 * - "لاحقاً" → يخفي الـ banner
 * - Polling كل 5 دقائق
 * - يدعم الـ navigation لصفحة تفاصيل التحديث
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  X, RefreshCw, Sparkles, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, Shield, Zap
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function AppUpdateNotification({ onNavigateToUpdates }) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [updates, setUpdates] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const fetchUpdates = useCallback(async () => {
    const token = localStorage.getItem('token');
    const user  = JSON.parse(localStorage.getItem('user') || '{}');
    if (!token || !user?.company_id) return;

    try {
      const res = await fetch(`${API}/api/updates/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.updates || [];
      if (list.length > 0 && !dismissed) {
        setUpdates(list);
        setVisible(true);
        setCurrentIdx(0);
      }
    } catch { /* silent */ }
  }, [dismissed]);

  useEffect(() => {
    fetchUpdates();
    const iv = setInterval(fetchUpdates, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchUpdates]);

  const acknowledge = async (updateId, action) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API}/api/updates/${updateId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action }),
      });
    } catch { /* silent */ }
  };

  const handleUpdate = async () => {
    const current = updates[currentIdx];
    if (!current) return;
    setLoading(true);
    await acknowledge(current.id, 'updated');
    // reload فقط — لا تعديل على البيانات
    window.location.reload();
  };

  const handleDismiss = async () => {
    const current = updates[currentIdx];
    if (current) await acknowledge(current.id, 'seen');
    const remaining = updates.filter((_, i) => i !== currentIdx);
    if (remaining.length === 0) {
      setVisible(false);
      setDismissed(true);
    } else {
      setUpdates(remaining);
      setCurrentIdx(Math.min(currentIdx, remaining.length - 1));
    }
  };

  const handleDismissAll = async () => {
    for (const u of updates) await acknowledge(u.id, 'seen');
    setVisible(false);
    setDismissed(true);
  };

  const handleSeeDetails = () => {
    handleDismissAll();
    if (onNavigateToUpdates) onNavigateToUpdates();
  };

  if (!visible || updates.length === 0) return null;

  const update = updates[currentIdx];
  const isCritical = update?.is_critical;

  const t = {
    title:       isRTL ? (update?.title_ar || 'تحديث جديد')       : (update?.title_en || 'New Update'),
    desc:        isRTL ? (update?.description_ar || '')            : (update?.description_en || ''),
    updateNow:   isRTL ? 'تحديث الآن'    : 'Update Now',
    later:       isRTL ? 'لاحقاً'        : 'Later',
    details:     isRTL ? 'عرض التفاصيل' : 'Show details',
    hideDetails: isRTL ? 'إخفاء التفاصيل' : 'Hide details',
    seeAll:      isRTL ? 'عرض صفحة التحديثات' : 'View Updates Page',
    safeNote:    isRTL ? '🔒 بياناتك آمنة — التحديث لا يمس بياناتك' : '🔒 Your data is safe — update only refreshes the app',
    critical:    isRTL ? '⚡ تحديث عاجل' : '⚡ Critical Update',
    newFeatures: isRTL ? 'المميزات الجديدة' : 'New Features',
    prev:        isRTL ? 'التالي'  : 'Previous',
    next:        isRTL ? 'السابق' : 'Next',
  };

  const gradientClass = isCritical
    ? 'from-red-700 to-orange-600'
    : 'from-[#1e3a8a] to-[#2563eb]';

  const btnClass = isCritical
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-[#1e3a8a] hover:bg-[#1e40af]';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`fixed bottom-4 ${isRTL ? 'right-4' : 'left-4'} z-[9999] w-[380px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-2xl overflow-hidden border ${
        isCritical ? 'border-red-300' : 'border-blue-200'
      }`}
      style={{ animation: 'slideUp .4s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform:translateY(100px); opacity:0 }
          to   { transform:translateY(0);     opacity:1 }
        }
      `}</style>

      {/* ── Header ── */}
      <div className={`px-4 py-3 flex items-center justify-between bg-gradient-to-r ${gradientClass}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            {isCritical ? <Zap className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div>
            {isCritical && (
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-wider mb-0.5">{t.critical}</p>
            )}
            <p className="text-white font-bold text-sm leading-tight">{t.title}</p>
            {update?.version && (
              <p className="text-blue-200 text-[11px]">v{update.version}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {updates.length > 1 && (
            <span className="bg-white/25 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
              {currentIdx + 1}/{updates.length}
            </span>
          )}
          <button
            onClick={handleDismissAll}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title={isRTL ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-white p-4">
        <p className="text-gray-600 text-sm leading-relaxed">{t.desc}</p>

        {/* Features */}
        {update?.features?.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              {expanded ? t.hideDetails : t.details}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expanded && (
              <div className="mt-2 bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-2">{t.newFeatures}:</p>
                <ul className="space-y-1">
                  {update.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Safe note */}
        <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
          <Shield className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <p className="text-[11px] text-green-700 font-medium">{t.safeNote}</p>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all ${btnClass} ${loading ? 'opacity-70' : ''} shadow-md`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t.updateNow}
          </button>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            {t.later}
          </button>
        </div>

        {/* Navigate to updates page */}
        {onNavigateToUpdates && (
          <button
            onClick={handleSeeDetails}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-1.5 rounded-lg transition-colors"
          >
            {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            {t.seeAll}
          </button>
        )}
      </div>

      {/* Multi-update navigation */}
      {updates.length > 1 && (
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-t border-gray-100">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 flex items-center gap-1"
          >
            {isRTL ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
            {t.prev}
          </button>
          <div className="flex gap-1">
            {updates.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIdx ? 'bg-blue-600' : 'bg-gray-300'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentIdx(i => Math.min(updates.length - 1, i + 1))}
            disabled={currentIdx === updates.length - 1}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 flex items-center gap-1"
          >
            {t.next}
            {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
}
