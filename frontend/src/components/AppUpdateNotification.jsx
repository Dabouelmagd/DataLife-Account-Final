/**
 * AppUpdateNotification
 * يظهر عند وجود تحديث جديد — رسالة أنيقة في أسفل الشاشة
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { X, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function AppUpdateNotification() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [updates, setUpdates] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

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
      setUpdates(list);
      setVisible(list.length > 0);
    } catch { /* silent */ }
  }, []);

  // Poll every 5 minutes
  useEffect(() => {
    fetchUpdates();
    const iv = setInterval(fetchUpdates, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchUpdates]);

  const acknowledge = async (updateId, action) => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await fetch(`${API}/api/updates/${updateId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      // Remove from list
      setUpdates(prev => prev.filter(u => u.id !== updateId));
      if (updates.length <= 1) setVisible(false);
    } catch { /* silent */ }
    setLoading(false);
  };

  const dismissAll = async () => {
    for (const u of updates) await acknowledge(u.id, 'seen');
  };

  if (!visible || updates.length === 0) return null;

  const latest = updates[0];
  const isCritical = latest.is_critical;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`fixed bottom-4 ${isRTL ? 'right-4' : 'left-4'} z-50 w-[360px] max-w-[calc(100vw-2rem)] shadow-2xl rounded-2xl overflow-hidden border ${
        isCritical ? 'border-red-300' : 'border-blue-200'
      }`}
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isCritical
          ? 'bg-gradient-to-r from-red-600 to-orange-600'
          : 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">
              {language === 'ar' ? latest.title_ar : latest.title_en}
            </p>
            {latest.version && (
              <p className="text-blue-200 text-xs">v{latest.version}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {updates.length > 1 && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {updates.length}
            </span>
          )}
          <button
            onClick={dismissAll}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white p-4">
        <p className="text-gray-600 text-sm leading-relaxed">
          {language === 'ar' ? latest.description_ar : latest.description_en}
        </p>

        {/* Features list */}
        {latest.features?.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {expanded
                ? (language === 'ar' ? 'إخفاء التفاصيل' : 'Hide details')
                : (language === 'ar' ? 'عرض التفاصيل' : 'Show details')}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1">
                {latest.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { window.location.reload(); acknowledge(latest.id, 'updated'); }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-bold text-white transition-all ${
              isCritical
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1e3a8a] hover:bg-[#1e40af]'
            } ${loading ? 'opacity-70' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {language === 'ar' ? 'تحديث الآن' : 'Update Now'}
          </button>
          <button
            onClick={() => acknowledge(latest.id, 'seen')}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            {language === 'ar' ? 'لاحقاً' : 'Later'}
          </button>
        </div>
      </div>

      {/* Progress dots if multiple updates */}
      {updates.length > 1 && (
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-center gap-1 border-t border-gray-100">
          {updates.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
