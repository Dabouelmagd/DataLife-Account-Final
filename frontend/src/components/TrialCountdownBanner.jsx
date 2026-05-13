import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Zap, X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlan } from '../contexts/PlanContext';

/**
 * Trial Countdown Banner
 * Renders a sticky banner at the top of the dashboard when the company
 * is on the "trial" plan, showing days remaining and an "Upgrade Now" CTA.
 * Auto-hides for any non-trial plan or after the user dismisses it.
 */
const TrialCountdownBanner = () => {
  const { language } = useLanguage();
  const { plan, trial } = usePlan();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('trial_banner_dismissed') === '1'
  );

  // Only show for trial plan
  if (plan !== 'trial' || !trial?.is_trial || dismissed) return null;

  const days = trial.days_remaining ?? 0;
  const expired = trial.expired;
  const urgent = days <= 3 && !expired;

  const dismiss = () => {
    sessionStorage.setItem('trial_banner_dismissed', '1');
    setDismissed(true);
  };

  const t = language === 'ar'
    ? {
        title: expired ? 'انتهت تجربتك المجانية' : 'الفترة التجريبية المجانية',
        daysLeft: 'يوم متبقي',
        daysLeftPlural: 'أيام متبقية',
        message: expired
          ? 'انتهت تجربتك. اشترك الآن للاستمرار في استخدام كل الميزات.'
          : urgent
            ? 'تنبيه: تجربتك على وشك الانتهاء! اشترك الآن قبل أن تفقد الوصول.'
            : 'استكشف كل الميزات بشكل كامل. اشترك للاحتفاظ بصلاحياتك بعد انتهاء التجربة.',
        upgrade: 'ترقية الآن',
        dismiss: 'إغلاق',
      }
    : {
        title: expired ? 'Your free trial has expired' : 'Free Trial',
        daysLeft: 'day remaining',
        daysLeftPlural: 'days remaining',
        message: expired
          ? 'Your trial has ended. Subscribe now to keep using all features.'
          : urgent
            ? 'Heads up: your trial is about to end! Upgrade now to keep access.'
            : 'Explore all features. Upgrade to keep your access once the trial ends.',
        upgrade: 'Upgrade Now',
        dismiss: 'Dismiss',
      };

  const bgClass = expired
    ? 'from-red-600 via-rose-600 to-red-700'
    : urgent
      ? 'from-orange-500 via-amber-500 to-orange-600'
      : 'from-indigo-600 via-purple-600 to-fuchsia-600';

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r ${bgClass} text-white shadow-lg`}
      data-testid="trial-banner"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-yellow-300/10 rounded-full blur-2xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 p-1.5 bg-white/15 rounded-lg backdrop-blur-sm">
            {expired ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-bold text-sm" data-testid="trial-title">{t.title}</span>
              {!expired && (
                <span className="inline-flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm">
                  <span className="text-base leading-none" data-testid="trial-days">{days}</span>
                  <span>{days === 1 ? t.daysLeft : t.daysLeftPlural}</span>
                </span>
              )}
            </div>
            <p className="text-[12px] text-white/85 mt-0.5 truncate">{t.message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/subscription')}
            className="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-white/90 font-semibold text-xs px-4 py-2 rounded-lg shadow-md transition-all hover:scale-105"
            data-testid="trial-upgrade-btn"
          >
            <Zap className="h-3.5 w-3.5" />
            {t.upgrade}
          </button>
          {!expired && (
            <button
              onClick={dismiss}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors"
              title={t.dismiss}
              aria-label={t.dismiss}
              data-testid="trial-dismiss-btn"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialCountdownBanner;
