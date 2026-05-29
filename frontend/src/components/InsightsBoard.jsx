import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Sparkles, TrendingUp, AlertTriangle, Package, Users,
  Wallet, Receipt, Trophy, RefreshCw, Loader2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Map insight kind → icon + gradient
const KIND_STYLE = {
  revenue:     { Icon: TrendingUp,    grad: 'from-emerald-500 to-teal-600' },
  ap:          { Icon: AlertTriangle, grad: 'from-orange-500 to-amber-600' },
  ar:          { Icon: Users,         grad: 'from-blue-500 to-indigo-600' },
  inventory:   { Icon: Package,       grad: 'from-rose-500 to-pink-600' },
  best_seller: { Icon: Trophy,        grad: 'from-yellow-500 to-orange-500' },
  tax:         { Icon: Receipt,       grad: 'from-purple-500 to-fuchsia-600' },
  cash:        { Icon: Wallet,        grad: 'from-cyan-500 to-sky-600' },
};

const SEVERITY_DOT = {
  good:    'bg-emerald-400',
  info:    'bg-blue-400',
  warning: 'bg-amber-400',
};

const InsightsBoard = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const fetchInsights = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/ai-assistant/insights`,
        {
          params: { language, refresh: refresh ? 'true' : 'false' },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setInsights(res.data.cards || []);
      setGeneratedAt(res.data.generated_at);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights(false);
  }, [language]); // eslint-disable-line

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700" dir={isRTL ? 'rtl' : 'ltr'}>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {language === 'ar' ? 'جاري تحليل بياناتك...' : 'Analyzing your data...'}
        </span>
      </div>
    );
  }

  if (insights.length === 0) {
    return null; // Nothing to show yet
  }

  return (
    <div className="mb-6" data-testid="ai-insights-board" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 text-white shadow">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {language === 'ar' ? 'رؤى ذكية لشركتك' : 'AI Insights for Your Business'}
          </h2>
          <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-bold">
            AI
          </span>
        </div>
        <button
          onClick={() => fetchInsights(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 disabled:opacity-50"
          data-testid="refresh-insights"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((card) => {
          const style = KIND_STYLE[card.kind] || { Icon: Sparkles, grad: 'from-slate-500 to-slate-600' };
          const Icon = style.Icon;
          return (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow"
              data-testid={`insight-card-${card.id}`}
            >
              {/* Severity dot */}
              <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} w-2 h-2 rounded-full ${SEVERITY_DOT[card.severity] || 'bg-slate-300'} shadow ring-2 ring-white dark:ring-slate-800`} />

              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${style.grad} flex items-center justify-center text-white shadow-md`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {card.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      {generatedAt && (
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          {language === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
          {new Date(generatedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
          {' · '}
          {language === 'ar' ? 'مدعوم بـ AI' : 'AI-powered'}
        </p>
      )}
    </div>
  );
};

export default InsightsBoard;
