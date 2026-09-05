/**
 * AppUpdatesPage — صفحة تاريخ التحديثات داخل التطبيق
 * - تعرض كل التحديثات التي وصلت للشركة
 * - المستخدم يرى تفاصيل كل تحديث
 * - "تحديث الآن" = reload فقط — البيانات لا تُمس
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  RefreshCw, Sparkles, Zap, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Shield, ArrowRight
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function AppUpdatesPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [updates, setUpdates] = useState([]);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Texts
  const t = {
    title:       isRTL ? 'تحديثات النظام' : 'System Updates',
    subtitle:    isRTL ? 'سجل كامل بجميع تحديثات DataLife Account' : 'Full log of all DataLife Account updates',
    noUpdates:   isRTL ? 'لا توجد تحديثات حالياً' : 'No updates at the moment',
    pending:     isRTL ? 'في انتظار التحديث' : 'Pending Update',
    done:        isRTL ? 'تم التحديث' : 'Updated',
    critical:    isRTL ? 'عاجل' : 'Critical',
    updateNow:   isRTL ? 'تحديث الآن' : 'Update Now',
    showFeats:   isRTL ? 'عرض المميزات' : 'Show Features',
    hideFeats:   isRTL ? 'إخفاء المميزات' : 'Hide Features',
    safeNote:    isRTL
      ? 'التحديث لا يمس بياناتك — فقط يحمل أحدث إصدار من الواجهة'
      : 'Update only reloads the app — your data is never affected',
    features:    isRTL ? 'المميزات الجديدة' : 'New Features',
    publishedAt: isRTL ? 'نُشر في' : 'Published',
    refresh:     isRTL ? 'تحديث القائمة' : 'Refresh',
  };

  const fetchUpdates = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/updates/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const pendingList = data.updates || [];
      setPendingIds(new Set(pendingList.map(u => u.id)));

      // Also get seen updates — for now we show pending only
      setUpdates(pendingList);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUpdates(); }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUpdates();
  };

  const acknowledge = async (updateId, action) => {
    try {
      await fetch(`${API}/api/updates/${updateId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action }),
      });
      setPendingIds(prev => { const s = new Set(prev); s.delete(updateId); return s; });
    } catch { /* silent */ }
  };

  const handleUpdateNow = async (updateId) => {
    await acknowledge(updateId, 'updated');
    // reload فقط — البيانات لا تُمس
    window.location.reload();
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            {t.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {/* Safe note */}
      <div className="mb-5 flex items-center gap-2 bg-green-50 rounded-xl px-4 py-3 border border-green-100">
        <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700 font-medium">{t.safeNote}</p>
      </div>

      {/* Updates list */}
      {updates.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t.noUpdates}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((upd) => {
            const isPending = pendingIds.has(upd.id);
            const isCritical = upd.is_critical;
            const isExp = expanded[upd.id];

            return (
              <div
                key={upd.id}
                className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${
                  isCritical ? 'border-red-200' : isPending ? 'border-blue-200' : 'border-gray-200'
                }`}
              >
                {/* Card header bar */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  isCritical
                    ? 'bg-gradient-to-r from-red-600 to-orange-600'
                    : isPending
                    ? 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]'
                    : 'bg-gray-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isPending || isCritical ? 'bg-white/20' : 'bg-white'
                    }`}>
                      {isCritical
                        ? <Zap className="w-4 h-4 text-white" />
                        : isPending
                        ? <Sparkles className="w-4 h-4 text-white" />
                        : <CheckCircle2 className="w-4 h-4 text-green-600" />
                      }
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${isPending || isCritical ? 'text-white' : 'text-gray-800'}`}>
                        {isRTL ? upd.title_ar : upd.title_en}
                      </p>
                      {upd.version && (
                        <p className={`text-[11px] ${isPending || isCritical ? 'text-blue-200' : 'text-gray-500'}`}>
                          v{upd.version}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCritical && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {t.critical}
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 ${
                      isPending
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {isPending ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isPending ? t.pending : t.done}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="bg-white p-4">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {isRTL ? upd.description_ar : upd.description_en}
                  </p>

                  {/* Date */}
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.publishedAt}: {formatDate(upd.created_at)}
                  </p>

                  {/* Features toggle */}
                  {upd.features?.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleExpand(upd.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        {isExp ? t.hideFeats : t.showFeats}
                        {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {isExp && (
                        <div className="mt-2 bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-800 mb-2">{t.features}:</p>
                          <ul className="space-y-1">
                            {upd.features.map((f, i) => (
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

                  {/* Update button — only for pending */}
                  {isPending && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleUpdateNow(upd.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md ${
                          isCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1e3a8a] hover:bg-[#1e40af]'
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t.updateNow}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
