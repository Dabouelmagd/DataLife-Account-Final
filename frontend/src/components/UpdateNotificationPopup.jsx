import React, { useEffect, useState } from 'react';
import { Sparkles, X, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Shows a one-time notification popup whenever the deployed app version
 * changes. The version is read from the build-time env var
 * REACT_APP_VERSION (falls back to the build hash via NODE_ENV).
 * After the user dismisses the popup, the new version is persisted
 * in localStorage so it won't show again until the next deploy.
 */
const UpdateNotificationPopup = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [show, setShow] = useState(false);

  const currentVersion =
    process.env.REACT_APP_VERSION ||
    process.env.REACT_APP_BUILD_ID ||
    'feb-2026-r2';

  useEffect(() => {
    const seen = localStorage.getItem('datalife_last_seen_version');
    if (seen !== currentVersion) {
      // Slight delay so it doesn't compete with first render
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [currentVersion]);

  const dismiss = () => {
    localStorage.setItem('datalife_last_seen_version', currentVersion);
    setShow(false);
  };

  const reloadAndDismiss = () => {
    localStorage.setItem('datalife_last_seen_version', currentVersion);
    window.location.reload();
  };

  if (!show) return null;

  const t = language === 'ar' ? {
    title: 'تحديث جديد متاح!',
    body: 'تم تحديث برنامج DataLife Account بميزات جديدة. اكتشف الجديد الآن.',
    refresh: 'إعادة التحميل',
    close: 'لاحقاً',
    badge: 'جديد',
  } : {
    title: 'New update available!',
    body: 'DataLife Account has been updated with new features. Explore what\'s new.',
    refresh: 'Reload',
    close: 'Later',
    badge: 'NEW',
  };

  return (
    <div
      className="fixed bottom-6 z-[100] animate-in slide-in-from-bottom-5 duration-500"
      style={{ [isRTL ? 'right' : 'left']: '1.5rem', maxWidth: 'calc(100vw - 3rem)' }}
      data-testid="update-popup"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white rounded-2xl shadow-2xl p-5 w-80 relative overflow-hidden">
        {/* Decorative gradient blob */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl"></div>

        <button
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close"
          data-testid="update-popup-close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex items-start gap-3">
          <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-sm">{t.title}</h4>
              <span className="text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">
                {t.badge}
              </span>
            </div>
            <p className="text-xs text-white/85 leading-relaxed">{t.body}</p>
          </div>
        </div>

        <div className="relative mt-4 flex gap-2">
          <button
            onClick={reloadAndDismiss}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white text-indigo-700 hover:bg-white/90 text-sm font-semibold py-2 px-3 rounded-lg transition-colors"
            data-testid="update-popup-reload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t.refresh}
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            data-testid="update-popup-dismiss"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotificationPopup;
