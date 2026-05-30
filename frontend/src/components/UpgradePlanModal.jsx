import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Zap, Building2, Crown, Check, Loader2, Sparkles, Tag, Shield, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * UpgradePlanModal — compact in-app upgrade flow.
 * - Lists Starter / Professional / Enterprise side-by-side
 * - Lets the user pick a billing cycle (3, 6, 9, 12 months, or lifetime)
 * - Accepts an optional activation code for discount validation
 * - Triggers Stripe checkout (POST /api/payments/create-checkout)
 */
const DURATIONS = [
  { key: '3_months',  ar: '3 شهور',     en: '3 Months',  discount: 0 },
  { key: '6_months',  ar: '6 شهور',     en: '6 Months',  discount: 0 },
  { key: '12_months', ar: 'سنة كاملة',  en: 'Yearly',    discount: 20, popular: true },
  { key: 'lifetime',  ar: 'مدى الحياة', en: 'Lifetime',  discount: 33 },
];

const PLAN_META = {
  starter: {
    icon: Zap,
    color: 'from-blue-500 to-indigo-600',
    ringColor: 'ring-blue-500',
    ar: { name: 'المبتدئ', tagline: '1-10 موظفين', features: [
      'الموارد البشرية الأساسية', 'الإدارة المالية', 'تقارير أساسية', 'دعم بالبريد الإلكتروني',
    ]},
    en: { name: 'Starter', tagline: '1-10 employees', features: [
      'Basic HR', 'Financial Management', 'Basic Reports', 'Email Support',
    ]},
  },
  professional: {
    icon: Building2,
    color: 'from-purple-500 to-pink-600',
    ringColor: 'ring-purple-500',
    popular: true,
    ar: { name: 'المحترف', tagline: '11-100 موظف', features: [
      'كل مميزات المبتدئ', 'المخزون والمشتريات', 'تحليلات متقدمة', 'إدارة مشاريع', 'دعم بالأولوية',
    ]},
    en: { name: 'Professional', tagline: '11-100 employees', features: [
      'Everything in Starter', 'Inventory & Purchases', 'Advanced Analytics', 'Project Management', 'Priority Support',
    ]},
  },
  enterprise: {
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    ringColor: 'ring-amber-500',
    ar: { name: 'المؤسسي', tagline: 'موظفون بلا حدود', features: [
      'كل مميزات المحترف', 'موافقات متعددة المستويات', 'إدارة المستخدمين', 'استيراد بيانات', 'مدير حساب مخصص',
    ]},
    en: { name: 'Enterprise', tagline: 'Unlimited employees', features: [
      'Everything in Professional', 'Multi-level Approvals', 'User Management', 'Data Import', 'Dedicated Account Manager',
    ]},
  },
};

const fmtEGP = (n) => Number(n || 0).toLocaleString('en-EG');

const UpgradePlanModal = ({ open, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [packages, setPackages] = useState([]);
  const [duration, setDuration] = useState('12_months');
  const [loading, setLoading] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(null);
  const [activationCode, setActivationCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null); // {valid, discount?, message?}

  // Fetch all packages from backend on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/payments/packages`);
        if (!cancelled) setPackages(res.data || []);
      } catch {
        if (!cancelled) toast.error(language === 'ar' ? 'تعذّر تحميل الباقات' : 'Failed to load plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, language]);

  // Lookup helper: get a package by plan + duration
  const findPackage = (plan, dur) =>
    packages.find((p) => p.plan === plan && p.duration === dur) || null;

  // Validate activation code via backend
  const validateCode = async () => {
    if (!activationCode.trim()) {
      setCodeStatus(null);
      return;
    }
    try {
      const res = await axios.post(
        `${API}/api/subscriptions/validate-code?code=${encodeURIComponent(activationCode.trim())}`
      );
      setCodeStatus(res.data);
      if (res.data?.valid) {
        toast.success(language === 'ar'
          ? `كود صالح! خصم ${res.data.discount}%`
          : `Valid! ${res.data.discount}% off`);
      } else {
        toast.error(res.data?.message || (language === 'ar' ? 'كود غير صالح' : 'Invalid code'));
      }
    } catch {
      setCodeStatus({ valid: false, message: 'error' });
      toast.error(language === 'ar' ? 'فشل التحقق من الكود' : 'Validation failed');
    }
  };

  // Trigger Stripe checkout for a given plan
  const handleCheckout = async (plan) => {
    const pkg = findPackage(plan, duration);
    if (!pkg) {
      toast.error(language === 'ar' ? 'الباقة غير متاحة' : 'Package not available');
      return;
    }
    setSubmittingPlan(plan);
    try {
      const res = await axios.post(`${API}/api/payments/create-checkout`, {
        package_id: pkg.id,
        origin_url: window.location.origin,
        user_email: user?.email,
        company_id: user?.company_id,
      });
      const url = res.data?.url;
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        toast.error(language === 'ar' ? 'تعذّر بدء عملية الدفع' : 'Could not start payment');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail
        || (language === 'ar' ? 'فشل بدء الدفع' : 'Payment failed to start'));
    } finally {
      setSubmittingPlan(null);
    }
  };

  // Apply discount from activation code to displayed price (visual only — backend will apply real discount)
  const pricedPlans = useMemo(() => {
    const discount = codeStatus?.valid ? Number(codeStatus.discount || 0) : 0;
    return ['starter', 'professional', 'enterprise'].map((planId) => {
      const pkg = findPackage(planId, duration);
      const original = pkg?.price_egp ?? null;
      const final = original != null ? Math.round(original * (1 - discount / 100)) : null;
      return { planId, pkg, original, final, discount };
    });
  }, [packages, duration, codeStatus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
      data-testid="upgrade-plan-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl shadow-2xl my-4 max-h-[95vh] overflow-y-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#28376B] to-indigo-700 text-white p-5 sm:p-6 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 sm:top-5 sm:left-5 p-1 hover:bg-white/20 rounded-lg transition-colors"
            style={isRTL ? { left: 'auto', right: '1rem' } : {}}
            data-testid="upgrade-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-6 w-6 text-yellow-300" />
            <h2 className="text-xl sm:text-2xl font-bold">
              {language === 'ar' ? 'ترقية الباقة' : 'Upgrade Your Plan'}
            </h2>
          </div>
          <p className="text-sm text-blue-100">
            {language === 'ar'
              ? 'اختر الباقة المناسبة لشركتك وادفع بشكل آمن عبر Stripe'
              : 'Choose the right plan for your business — pay securely with Stripe'}
          </p>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Duration toggle */}
          <div className="flex flex-wrap gap-2 justify-center" data-testid="duration-toggle">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDuration(d.key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  duration === d.key
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                data-testid={`duration-${d.key}`}
              >
                {language === 'ar' ? d.ar : d.en}
                {d.discount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    -{d.discount}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Activation Code */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              <label className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {language === 'ar' ? 'كود الاشتراك / التفعيل (اختياري)' : 'Activation / Subscription Code (optional)'}
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => { setActivationCode(e.target.value.toUpperCase()); setCodeStatus(null); }}
                placeholder={language === 'ar' ? 'DL-XXXX-XXXX' : 'DL-XXXX-XXXX'}
                className="flex-1 px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono tracking-wider"
                data-testid="activation-code-input"
              />
              <button
                onClick={validateCode}
                disabled={!activationCode.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="validate-code-btn"
              >
                {language === 'ar' ? 'تحقق' : 'Validate'}
              </button>
            </div>
            {codeStatus && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${
                codeStatus.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
              }`} data-testid="code-status">
                {codeStatus.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {codeStatus.valid
                  ? (language === 'ar' ? `كود صالح — خصم ${codeStatus.discount}%` : `Valid — ${codeStatus.discount}% off`)
                  : (codeStatus.message || (language === 'ar' ? 'كود غير صالح' : 'Invalid code'))}
              </div>
            )}
          </div>

          {/* Plans grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {language === 'ar' ? 'جاري تحميل الباقات...' : 'Loading plans...'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="plans-grid">
              {pricedPlans.map(({ planId, original, final, discount, pkg }) => {
                const meta = PLAN_META[planId];
                const Icon = meta.icon;
                const txt = language === 'ar' ? meta.ar : meta.en;
                const isPopular = meta.popular;
                return (
                  <div
                    key={planId}
                    className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all hover:scale-[1.02] ${
                      isPopular
                        ? 'border-purple-500 shadow-xl bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                    data-testid={`plan-card-${planId}`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                        {language === 'ar' ? 'الأكثر شعبية' : 'Most Popular'}
                      </span>
                    )}
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} text-white mb-3`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{txt.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{txt.tagline}</p>

                    {/* Price */}
                    <div className="mb-4">
                      {original != null ? (
                        <>
                          {discount > 0 && (
                            <div className="text-sm line-through text-slate-400">
                              {fmtEGP(original)} EGP
                            </div>
                          )}
                          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                            {fmtEGP(final)}
                            <span className="text-sm font-normal text-slate-500 ml-1">EGP</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {duration === 'lifetime'
                              ? (language === 'ar' ? 'دفعة واحدة' : 'one-time')
                              : `/ ${DURATIONS.find((d) => d.key === duration)?.[language === 'ar' ? 'ar' : 'en']}`}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-400">
                          {language === 'ar' ? 'غير متاح' : 'N/A'}
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-5 flex-1">
                      {txt.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => handleCheckout(planId)}
                      disabled={!pkg || submittingPlan === planId}
                      className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      data-testid={`checkout-${planId}-btn`}
                    >
                      {submittingPlan === planId ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />{language === 'ar' ? 'جاري التحويل...' : 'Redirecting...'}</>
                      ) : (
                        <>{language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}<ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-600" />{language === 'ar' ? 'دفع آمن SSL' : 'Secure SSL Payment'}</div>
            <div className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" />{language === 'ar' ? 'ضمان استرداد 14 يوم' : '14-Day Money Back'}</div>
            <div className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-500" />{language === 'ar' ? 'إلغاء أي وقت' : 'Cancel Anytime'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanModal;
