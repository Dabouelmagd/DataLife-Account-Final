import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  TrendingUp, TrendingDown, Loader2, Sparkles, DollarSign, Zap, Timer,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const KpiCard = ({ icon: Icon, color, label, value, sub, delta, testid }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col" data-testid={testid}>
    <div className="flex items-center justify-between mb-2">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      {typeof delta === 'number' && (
        <span className={`text-[11px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
          delta > 0 ? 'bg-emerald-50 text-emerald-700' : delta < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      )}
    </div>
    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100" data-testid={`${testid}-value`}>{value}</div>
    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    {sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{sub}</div>}
  </div>
);

/**
 * Conversion Analytics — 4 KPI cards summarising SaaS growth.
 * Loaded inside Settings → Subscription tab.
 */
const ConversionAnalytics = ({ language }) => {
  const isRTL = language === 'ar';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/analytics/conversion`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) toast.error(language === 'ar' ? 'تعذّر تحميل التحليلات' : 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [language]);

  return (
    <Card className="md:col-span-2" dir={isRTL ? 'rtl' : 'ltr'} data-testid="conversion-analytics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          {language === 'ar' ? 'تحليلات النمو والتحويل' : 'Growth & Conversion Analytics'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : !data ? (
          <p className="text-sm text-rose-600">{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              testid="kpi-conversion"
              icon={TrendingUp}
              color="bg-gradient-to-br from-emerald-500 to-teal-600"
              label={language === 'ar' ? 'معدل تحويل Trial → Paid' : 'Trial → Paid Conversion'}
              value={`${data.conversion?.this_month?.rate_pct ?? 0}%`}
              sub={language === 'ar'
                ? `${data.conversion?.this_month?.converted ?? 0} من ${data.conversion?.this_month?.trials_started ?? 0} تجربة`
                : `${data.conversion?.this_month?.converted ?? 0} of ${data.conversion?.this_month?.trials_started ?? 0} trials`}
              delta={data.conversion?.delta_pct}
            />
            <KpiCard
              testid="kpi-referral-revenue"
              icon={DollarSign}
              color="bg-gradient-to-br from-amber-500 to-orange-600"
              label={language === 'ar' ? 'إيراد الإحالات (هذا الشهر)' : 'Referral Revenue (this month)'}
              value={`${(data.referral_revenue_this_month?.egp ?? 0).toLocaleString('en-EG')} EGP`}
              sub={language === 'ar'
                ? `${data.referral_revenue_this_month?.transactions ?? 0} عملية`
                : `${data.referral_revenue_this_month?.transactions ?? 0} transactions`}
            />
            <KpiCard
              testid="kpi-beta-users"
              icon={Zap}
              color="bg-gradient-to-br from-purple-600 to-pink-600"
              label={language === 'ar' ? 'مستخدمو البيتا النشطون' : 'Active Beta Users'}
              value={data.beta_users ?? 0}
              sub={language === 'ar' ? 'شركات لديها وصول مبكر' : 'companies with early access'}
            />
            <KpiCard
              testid="kpi-time-to-paid"
              icon={Timer}
              color="bg-gradient-to-br from-blue-500 to-indigo-600"
              label={language === 'ar' ? 'متوسط مدة الدفع (Median)' : 'Median Time-to-Paid'}
              value={data.time_to_paid?.median_days != null
                ? `${data.time_to_paid.median_days} ${language === 'ar' ? 'يوم' : 'days'}`
                : '—'}
              sub={language === 'ar'
                ? `${data.time_to_paid?.samples ?? 0} عميل تم رصده`
                : `${data.time_to_paid?.samples ?? 0} customers tracked`}
            />
          </div>
        )}

        {data && (
          <p className="text-[11px] text-slate-400 mt-4 text-right">
            {language === 'ar' ? 'آخر تحديث:' : 'Last updated:'} {new Date(data.generated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ConversionAnalytics;
