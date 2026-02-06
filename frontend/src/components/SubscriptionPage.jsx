import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  CreditCard, Check, Gift, Clock, Calendar, ArrowLeft, 
  Star, Sparkles, Crown, Building2, Users, Calculator,
  Package, Loader2, AlertCircle, CheckCircle2, ArrowRight
} from 'lucide-react';
import axios from 'axios';

const SubscriptionPage = () => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('12_months');
  const [activationCode, setActivationCode] = useState('');
  const [codeValidation, setCodeValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Translations
  const t = {
    title: isRTL ? 'الاشتراكات' : 'Subscriptions',
    currentPlan: isRTL ? 'خطتك الحالية' : 'Your Current Plan',
    noPlan: isRTL ? 'لا يوجد اشتراك حالي' : 'No Active Subscription',
    choosePlan: isRTL ? 'اختر خطة' : 'Choose a Plan',
    daysRemaining: isRTL ? 'يوم متبقي' : 'days remaining',
    expiresOn: isRTL ? 'ينتهي في' : 'Expires on',
    activationCode: isRTL ? 'كود التفعيل' : 'Activation Code',
    enterCode: isRTL ? 'أدخل كود التفعيل' : 'Enter activation code',
    validateCode: isRTL ? 'تحقق من الكود' : 'Validate Code',
    subscribe: isRTL ? 'اشترك الآن' : 'Subscribe Now',
    upgradeNow: isRTL ? 'ترقية الآن' : 'Upgrade Now',
    monthlyPrice: isRTL ? 'شهرياً' : '/month',
    duration: {
      '3_months': isRTL ? '3 أشهر' : '3 Months',
      '6_months': isRTL ? '6 أشهر' : '6 Months',
      '9_months': isRTL ? '9 أشهر' : '9 Months',
      '12_months': isRTL ? 'سنة' : '1 Year',
      'lifetime': isRTL ? 'مدى الحياة' : 'Lifetime'
    },
    plans: {
      starter: {
        name: isRTL ? 'المبتدئ' : 'Starter',
        desc: isRTL ? 'مثالي للشركات الصغيرة' : 'Perfect for small businesses'
      },
      professional: {
        name: isRTL ? 'المحترف' : 'Professional',
        desc: isRTL ? 'للشركات النامية' : 'For growing businesses'
      },
      enterprise: {
        name: isRTL ? 'المؤسسي' : 'Enterprise',
        desc: isRTL ? 'للمؤسسات الكبيرة' : 'For large organizations'
      },
      'hr-only': {
        name: isRTL ? 'الموارد البشرية فقط' : 'HR Only',
        desc: isRTL ? 'إدارة الموارد البشرية' : 'HR Management only'
      },
      'financial-only': {
        name: isRTL ? 'المالية فقط' : 'Financial Only',
        desc: isRTL ? 'الإدارة المالية' : 'Financial Management only'
      },
      'inventory-only': {
        name: isRTL ? 'المخزون فقط' : 'Inventory Only',
        desc: isRTL ? 'إدارة المخزون' : 'Inventory Management only'
      }
    },
    features: {
      starter: [
        isRTL ? 'حتى 10 موظفين' : 'Up to 10 employees',
        isRTL ? 'إدارة أساسية للموارد البشرية' : 'Basic HR management',
        isRTL ? 'تتبع مالي بسيط' : 'Simple financial tracking',
        isRTL ? 'دعم عبر البريد' : 'Email support'
      ],
      professional: [
        isRTL ? 'حتى 100 موظف' : 'Up to 100 employees',
        isRTL ? 'إدارة كاملة للموارد البشرية والرواتب' : 'Full HR & payroll',
        isRTL ? 'إدارة مالية متقدمة' : 'Advanced financial management',
        isRTL ? 'تتبع المخزون' : 'Inventory tracking',
        isRTL ? 'دعم أولوية' : 'Priority support'
      ],
      enterprise: [
        isRTL ? 'موظفين غير محدودين' : 'Unlimited employees',
        isRTL ? 'جميع الميزات' : 'All features included',
        isRTL ? 'إدارة فروع متعددة' : 'Multi-branch management',
        isRTL ? 'مدير حساب مخصص' : 'Dedicated account manager',
        isRTL ? 'دعم على مدار الساعة' : '24/7 support'
      ]
    },
    validCode: isRTL ? 'كود صالح!' : 'Valid code!',
    invalidCode: isRTL ? 'كود غير صالح' : 'Invalid code',
    discount: isRTL ? 'خصم' : 'discount',
    back: isRTL ? 'رجوع' : 'Back',
    currency: isRTL ? 'ج.م' : 'EGP',
    popular: isRTL ? 'الأكثر شعبية' : 'Most Popular',
    recommended: isRTL ? 'موصى به' : 'Recommended'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [subscriptionRes, plansRes] = await Promise.all([
        axios.get(`${API_URL}/api/subscriptions/current`, config).catch(() => ({ data: { status: 'no_subscription' } })),
        axios.get(`${API_URL}/api/subscriptions/plans`, config)
      ]);
      
      setCurrentSubscription(subscriptionRes.data);
      setPlans(plansRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateActivationCode = async () => {
    if (!activationCode.trim()) return;
    
    try {
      const response = await axios.post(
        `${API_URL}/api/subscriptions/validate-code?code=${activationCode}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCodeValidation(response.data);
      if (response.data.valid) {
        setSelectedPlan(response.data.plan);
        setSelectedDuration(response.data.duration);
      }
    } catch (error) {
      setCodeValidation({ valid: false, message: 'Error validating code' });
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      setError(isRTL ? 'يرجى اختيار خطة' : 'Please select a plan');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const response = await axios.post(
        `${API_URL}/api/subscriptions/create`,
        {
          plan: selectedPlan,
          duration: selectedDuration,
          payment_method: 'manual',
          activation_code: activationCode || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(isRTL ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.detail || (isRTL ? 'فشل الاشتراك' : 'Subscription failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'starter': return <Star className="h-6 w-6" />;
      case 'professional': return <Sparkles className="h-6 w-6" />;
      case 'enterprise': return <Crown className="h-6 w-6" />;
      case 'hr-only': return <Users className="h-6 w-6" />;
      case 'financial-only': return <Calculator className="h-6 w-6" />;
      case 'inventory-only': return <Package className="h-6 w-6" />;
      default: return <Building2 className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planId) => {
    switch (planId) {
      case 'starter': return 'from-blue-500 to-blue-600';
      case 'professional': return 'from-purple-500 to-purple-600';
      case 'enterprise': return 'from-amber-500 to-amber-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getPrice = (planId, duration) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return 0;
    const durationData = plan.durations.find(d => d.duration === duration);
    return durationData ? durationData.price : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
            data-testid="back-button"
          >
            {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            {t.back}
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
        </div>

        {/* Current Subscription */}
        {currentSubscription && currentSubscription.status !== 'no_subscription' && (
          <Card className="mb-8 border-2 border-green-200 bg-green-50" data-testid="current-subscription-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-6 w-6" />
                  {t.currentPlan}
                </CardTitle>
                <Badge className="bg-green-600 text-white">
                  {currentSubscription.days_remaining} {t.daysRemaining}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">{isRTL ? 'الخطة' : 'Plan'}</p>
                  <p className="font-semibold text-lg capitalize">{currentSubscription.plan?.replace('-', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{isRTL ? 'المدة' : 'Duration'}</p>
                  <p className="font-semibold text-lg">{t.duration[currentSubscription.duration] || currentSubscription.duration}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{isRTL ? 'الحالة' : 'Status'}</p>
                  <p className="font-semibold text-lg capitalize text-green-600">{currentSubscription.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t.expiresOn}</p>
                  <p className="font-semibold text-lg">
                    {currentSubscription.end_date ? new Date(currentSubscription.end_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activation Code Section */}
        <Card className="mb-8" data-testid="activation-code-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              {t.activationCode}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'هل لديك كود تفعيل؟ أدخله هنا' : 'Have an activation code? Enter it here'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder={t.enterCode}
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="max-w-xs font-mono"
                data-testid="activation-code-input"
              />
              <Button 
                onClick={validateActivationCode}
                variant="outline"
                data-testid="validate-code-button"
              >
                {t.validateCode}
              </Button>
            </div>
            {codeValidation && (
              <div className={`mt-4 p-4 rounded-lg ${codeValidation.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {codeValidation.valid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{t.validCode}</span>
                    {codeValidation.discount > 0 && (
                      <Badge className="bg-green-600">{codeValidation.discount}% {t.discount}</Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>{codeValidation.message || t.invalidCode}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duration Selector */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">{isRTL ? 'اختر المدة' : 'Select Duration'}</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(t.duration).map(([key, label]) => (
              <Button
                key={key}
                variant={selectedDuration === key ? 'default' : 'outline'}
                onClick={() => setSelectedDuration(key)}
                className={selectedDuration === key ? 'bg-blue-600' : ''}
                data-testid={`duration-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Plans */}
          {['starter', 'professional', 'enterprise'].map((planId) => {
            const plan = plans.find(p => p.id === planId);
            const price = getPrice(planId, selectedDuration);
            const isSelected = selectedPlan === planId;
            const isProfessional = planId === 'professional';
            
            return (
              <Card 
                key={planId}
                className={`relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-lg scale-105' : ''
                } ${isProfessional ? 'border-2 border-purple-400' : ''}`}
                onClick={() => setSelectedPlan(planId)}
                data-testid={`plan-${planId}`}
              >
                {isProfessional && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-center py-1 text-sm font-semibold">
                    {t.popular}
                  </div>
                )}
                <div className={`h-2 bg-gradient-to-r ${getPlanColor(planId)}`} />
                <CardHeader className={isProfessional ? 'mt-4' : ''}>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${getPlanColor(planId)} text-white`}>
                      {getPlanIcon(planId)}
                    </div>
                    {isSelected && (
                      <Badge className="bg-blue-600 text-white">
                        <Check className="h-4 w-4" />
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl mt-4">{t.plans[planId]?.name}</CardTitle>
                  <CardDescription>{t.plans[planId]?.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{price.toLocaleString()}</span>
                    <span className="text-gray-500 ml-1">{t.currency}</span>
                    <span className="text-gray-400 text-sm block">
                      {t.duration[selectedDuration]}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {t.features[planId]?.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Module-only Plans */}
        <h3 className="text-lg font-semibold mb-4">{isRTL ? 'حزم الوحدات الفردية' : 'Individual Module Packages'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {['hr-only', 'financial-only', 'inventory-only'].map((planId) => {
            const price = getPrice(planId, selectedDuration);
            const isSelected = selectedPlan === planId;
            
            return (
              <Card 
                key={planId}
                className={`transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
                }`}
                onClick={() => setSelectedPlan(planId)}
                data-testid={`plan-${planId}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-gray-100 text-gray-600">
                      {getPlanIcon(planId)}
                    </div>
                    {isSelected && (
                      <Badge className="bg-blue-600 text-white">
                        <Check className="h-4 w-4" />
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-4">{t.plans[planId]?.name}</CardTitle>
                  <CardDescription>{t.plans[planId]?.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <span className="text-3xl font-bold">{price.toLocaleString()}</span>
                    <span className="text-gray-500 ml-1">{t.currency}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Subscribe Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-lg"
            onClick={handleSubscribe}
            disabled={!selectedPlan || submitting}
            data-testid="subscribe-button"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {isRTL ? 'جاري المعالجة...' : 'Processing...'}
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                {currentSubscription?.status !== 'no_subscription' ? t.upgradeNow : t.subscribe}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
