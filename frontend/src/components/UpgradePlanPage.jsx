import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Zap, Building2, Crown, Check, Loader2, Sparkles,
  Tag, Shield, ArrowRight, Gift,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

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
    ar: { name: 'المبتدئ', tagline: '1-10 موظفين', features: [
      'الموارد البشرية الأساسية', 'الإدارة المالية', 'تقارير أساسية', 'دعم بالبريد الإلكتروني',
      'تخزين 5 جيجابايت', 'مستخدمين بحد أقصى 5',
    ]},
    en: { name: 'Starter', tagline: '1-10 employees', features: [
      'Basic HR', 'Financial Management', 'Basic Reports', 'Email Support',
      '5 GB Storage', 'Up to 5 Users',
    ]},
  },
  professional: {
    icon: Building2,
    color: 'from-purple-500 to-pink-600',
    popular: true,
    ar: { name: 'المحترف', tagline: '11-100 موظف', features: [
      'كل مميزات المبتدئ', 'المخزون والمشتريات', 'تحليلات متقدمة', 'إدارة مشاريع',
      'دعم بالأولوية', 'تخزين 50 جيجابايت', 'مستخدمين بلا حدود', 'الذكاء الاصطناعي',
    ]},
    en: { name: 'Professional', tagline: '11-100 employees', features: [
      'Everything in Starter', 'Inventory & Purchases', 'Advanced Analytics',
      'Project Management', 'Priority Support', '50 GB Storage', 'Unlimited Users', 'AI Features',
    ]},
  },
  enterprise: {
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    ar: { name: 'المؤسسي', tagline: 'موظفون بلا حدود', features: [
      'كل مميزات المحترف', 'موافقات متعددة المستويات', 'إدارة المستخدمين بالكامل',
      'استيراد بيانات', 'مدير حساب مخصص', 'تخزين بلا حدود', 'SLA 99.9%', 'تكامل API',
    ]},
    en: { name: 'Enterprise', tagline: 'Unlimited employees', features: [
      'Everything in Professional', 'Multi-level Approvals', 'Full User Management',
      'Data Import', 'Dedicated Account Manager', 'Unlimited Storage', '99.9% SLA', 'API Integration',
    ]},
  },
};

const fmtEGP = (n) => Number(n || 0).toLocaleString('en-EG');

const UpgradePlanPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const [packages, setPackages] = useState([]);
  const [duration, setDuration] = useState('12_months');
  const [loading, setLoading] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(null);
  const [activationCode, setActivationCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/payments/packages`);
        setPackages(res.data || []);
      } catch {
        toast.error(language === 'ar' ? 'تعذّر تحميل الباقات' : 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, [language]);

  const findPackage = (plan, dur) =>
    packages.find((p) => p.plan === plan && p.duration === dur) || null;

  const validateCode = async () => {
    if (!activationCode.trim()) { setCodeStatus(null); return; }
    try {
      const res = await axios.post(
        `${API}/api/subscriptions/validate-code?code=${encodeURIComponent(activationCode.trim())}`
      );
      setCodeStatus(res.data);
      if (res.data?.valid) {
        toast.success(language === 'ar' ? `كود صالح! خصم ${res.data.discount}%` : `Valid! ${res.data.discount}% off`);
      } else {
        toast.error(res.data?.message || (language === 'ar' ? 'كود غير صالح' : 'Invalid code'));
      }
    } catch {
      setCodeStatus({ valid: false, message: 'error' });
      toast.error(language === 'ar' ? 'فشل التحقق' : 'Validation failed');
    }
  };

  const validateReferral = async () => {
    if (!referralCode.trim()) { setReferralStatus(null); return; }
    try {
      const res = await axios.post(
        `${API}/api/referrals/validate?code=${encodeURIComponent(referralCode.trim().toUpperCase())}`
      );
      setReferralStatus(res.data);
      if (res.data?.valid) {
        toast.success(language === 'ar'
          ? `كود إحالة صالح! شهر مجاني من ${res.data.referrer_company}`
          : `Valid referral! +1 month free from ${res.data.referrer_company}`);
      } else {
        toast.error(res.data?.message || (language === 'ar' ? 'كود إحالة غير صالح' : 'Invalid referral'));
      }
    } catch {
      setReferralStatus({ valid: false });
      toast.error(language === 'ar' ? 'فشل التحقق من الإحالة' : 'Referral check failed');
    }
  };

  const handleCheckout = async (plan) => {
    const pkg = findPackage(plan, duration);
    if (!pkg) {
      toast.error(language === 'ar' ? 'الباقة غير متاحة' : 'Package not available');
      return;
    }
    setSubmittingPlan(plan);
    try {
      const payload = {
        package_id: pkg.id,
        origin_url: window.location.origin,
        user_email: user?.email,
        company_id: user?.company_id,
      };
      if (referralStatus?.valid) payload.referral_code = referralCode.trim().toUpperCase();
      if (codeStatus?.valid) payload.activation_code = activationCode.trim();
      const res = await axios.post(`${API}/api/payments/create-checkout`, payload);
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error(language === 'ar' ? 'تعذّر بدء الدفع' : 'Could not start payment');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || (language === 'ar' ? 'فشل بدء الدفع' : 'Payment failed'));
    } finally {
      setSubmittingPlan(null);
    }
  };

  const pricedPlans = useMemo(() => {
    const discount = codeStatus?.valid ? Number(codeStatus.discount || 0) : 0;
    return ['starter', 'professional', 'enterprise'].map((planId) => {
      const pkg = findPackage(planId, duration);
      const original = pkg?.price_egp ?? null;
      const final = original != null ? Math.round(original * (1 - discount / 100)) : null;
      return { planId, pkg, original, final, discount };
    });
  }, [packages, duration, codeStatus]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir={isRTL ? 'rtl' : 'ltr'} data-testid="upgrade-plan-page">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-[#28376B] to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white mb-4 transition-colors"
            data-testid="upgrade-back-btn"
          >
            <ArrowLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
            {language === 'ar' ? 'رجوع' : 'Back'}
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-yellow-300" />
            <h1 className="text-2xl sm:text-3xl font-bold">
              {language === 'ar' ? 'ترقية باقة الاشتراك' : 'Upgrade Your Subscription'}
            </h1>
          </div>
          <p className="text-sm sm:text-base text-blue-100 max-w-2xl">
            {language === 'ar'
              ? 'اختاري الباقة المناسبة لشركتكم. ادفعي بأمان عبر Stripe وفعّلي اشتراككم على الفور.'
              : 'Pick the plan that fits your business. Pay securely via Stripe and activate instantly.'}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Duration toggle */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
            {language === 'ar' ? 'مدة الاشتراك' : 'Billing Period'}
          </div>
          <div className="flex flex-wrap gap-2" data-testid="duration-toggle">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDuration(d.key)}
                className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  duration === d.key
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                data-testid={`duration-${d.key}`}
              >
                {language === 'ar' ? d.ar : d.en}
                {d.discount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                    -{d.discount}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Codes row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Activation code */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              <label className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {language === 'ar' ? 'كود التفعيل / الخصم (اختياري)' : 'Activation / Discount Code (optional)'}
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => { setActivationCode(e.target.value.toUpperCase()); setCodeStatus(null); }}
                placeholder="DL-XXXX-XXXX"
                className="flex-1 px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono"
                data-testid="activation-code-input"
              />
              <button
                onClick={validateCode}
                disabled={!activationCode.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                data-testid="validate-code-btn"
              >
                {language === 'ar' ? 'تحقق' : 'Validate'}
              </button>
            </div>
            {codeStatus && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${codeStatus.valid ? 'text-emerald-700' : 'text-rose-600'}`} data-testid="code-status">
                {codeStatus.valid ? <Check className="h-3 w-3" /> : <span>✗</span>}
                {codeStatus.valid
                  ? (language === 'ar' ? `كود صالح — خصم ${codeStatus.discount}%` : `Valid — ${codeStatus.discount}% off`)
                  : (codeStatus.message || (language === 'ar' ? 'كود غير صالح' : 'Invalid'))}
              </div>
            )}
          </div>

          {/* Referral code */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <label className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {language === 'ar' ? 'كود إحالة — شهر مجاني!' : 'Referral Code — 1 Month Free!'}
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralCode}
                onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus(null); }}
                placeholder="REF-XXXXXX"
                className="flex-1 px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono"
                data-testid="referral-code-input"
              />
              <button
                onClick={validateReferral}
                disabled={!referralCode.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                data-testid="validate-referral-btn"
              >
                {language === 'ar' ? 'تحقق' : 'Apply'}
              </button>
            </div>
            {referralStatus && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${referralStatus.valid ? 'text-emerald-700' : 'text-rose-600'}`} data-testid="referral-status">
                {referralStatus.valid ? <Check className="h-3 w-3" /> : <span>✗</span>}
                {referralStatus.valid
                  ? (language === 'ar' ? `+ شهر مجاني من ${referralStatus.referrer_company}` : `+1 month free from ${referralStatus.referrer_company}`)
                  : (referralStatus.message || (language === 'ar' ? 'كود غير صالح' : 'Invalid'))}
              </div>
            )}
          </div>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            {language === 'ar' ? 'جاري تحميل الباقات...' : 'Loading plans...'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6" data-testid="plans-grid">
            {pricedPlans.map(({ planId, original, final, discount, pkg }) => {
              const meta = PLAN_META[planId];
              const Icon = meta.icon;
              const txt = language === 'ar' ? meta.ar : meta.en;
              const isPopular = meta.popular;
              return (
                <div
                  key={planId}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all hover:shadow-xl ${
                    isPopular
                      ? 'border-purple-500 shadow-xl bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                  data-testid={`plan-card-${planId}`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      {language === 'ar' ? 'الأكثر شعبية' : 'Most Popular'}
                    </span>
                  )}
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.color} text-white mb-4 shadow-md`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{txt.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{txt.tagline}</p>

                  <div className="mb-5">
                    {original != null ? (
                      <>
                        {discount > 0 && (
                          <div className="text-sm line-through text-slate-400">{fmtEGP(original)} EGP</div>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-slate-800 dark:text-slate-100">{fmtEGP(final)}</span>
                          <span className="text-sm text-slate-500">EGP</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {duration === 'lifetime'
                            ? (language === 'ar' ? 'دفعة واحدة • مدى الحياة' : 'one-time • lifetime')
                            : `/ ${DURATIONS.find((d) => d.key === duration)?.[language === 'ar' ? 'ar' : 'en']}`}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">{language === 'ar' ? 'غير متاح' : 'N/A'}</div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {txt.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(planId)}
                    disabled={!pkg || submittingPlan === planId}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    data-testid={`checkout-${planId}-btn`}
                  >
                    {submittingPlan === planId ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />{language === 'ar' ? 'جاري التحويل...' : 'Redirecting...'}</>
                    ) : (
                      <>{language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}<ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Trust strip */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-600" />{language === 'ar' ? 'دفع آمن SSL عبر Stripe' : 'Secure SSL via Stripe'}</div>
            <div className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-600" />{language === 'ar' ? 'ضمان استرداد 14 يوم' : '14-Day Money Back'}</div>
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />{language === 'ar' ? 'إلغاء أي وقت' : 'Cancel Anytime'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanPage;
