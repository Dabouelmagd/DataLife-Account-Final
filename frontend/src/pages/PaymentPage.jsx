import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { useCurrency } from '../hooks/useCurrency';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  CreditCard, Shield, CheckCircle, Loader2, ArrowRight, 
  Building2, Clock, Users, Star, Zap, Crown, DollarSign, Tag, X, Key, Copy
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// PayPal Icon Component
const PayPalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.013c-.496 0-.918.363-.993.852l-1.087 6.842-.148.94a.64.64 0 0 1-.633.74H7.08l-.004-.001zm6.609-14.837h-.792c-.3 0-.554.218-.597.514l-.396 2.492c.31-.026.635-.04.974-.04 1.89 0 3.07-.57 3.472-2.166.053-.21.079-.403.079-.572 0-.39-.085-.61-.338-.77-.29-.183-.785-.258-1.502-.258z"/>
  </svg>
);

const PaymentPage = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  const { currency, country, isEgypt, loading: currencyLoading, convertPrice, formatPrice } = useCurrency();
  const [packages, setPackages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('stripe');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Activation code states
  const [activationCode, setActivationCode] = useState('');
  const [activationSuccess, setActivationSuccess] = useState(null);
  
  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const t = {
    title: isRTL ? 'اختر خطة الاشتراك' : 'Choose Your Plan',
    subtitle: isRTL ? 'اختر الباقة المناسبة لاحتياجات عملك' : 'Select the package that fits your business needs',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    selectPlan: isRTL ? 'اختر الباقة' : 'Select Package',
    proceedPayment: isRTL ? 'المتابعة للدفع' : 'Proceed to Payment',
    processing: isRTL ? 'جاري المعالجة...' : 'Processing...',
    securePayment: isRTL ? 'دفع آمن ومشفر' : 'Secure & Encrypted Payment',
    testMode: isRTL ? 'وضع الاختبار' : 'Test Mode',
    sandboxMode: isRTL ? 'وضع التجربة' : 'Sandbox',
    perMonth: isRTL ? '/شهر' : '/month',
    months: isRTL ? 'أشهر' : 'months',
    year: isRTL ? 'سنة' : 'year',
    lifetime: isRTL ? 'مدى الحياة' : 'Lifetime',
    starter: isRTL ? 'المبتدئ' : 'Starter',
    professional: isRTL ? 'المحترف' : 'Professional',
    enterprise: isRTL ? 'المؤسسي' : 'Enterprise',
    employees: isRTL ? 'موظف' : 'employees',
    popular: isRTL ? 'الأكثر شيوعاً' : 'Most Popular',
    bestValue: isRTL ? 'أفضل قيمة' : 'Best Value',
    couponCode: isRTL ? 'كود الخصم' : 'Coupon Code',
    applyCoupon: isRTL ? 'تطبيق' : 'Apply',
    removeCoupon: isRTL ? 'إزالة' : 'Remove',
    couponApplied: isRTL ? 'تم تطبيق الكوبون' : 'Coupon Applied',
    discount: isRTL ? 'الخصم' : 'Discount',
    total: isRTL ? 'الإجمالي' : 'Total',
    enterCoupon: isRTL ? 'أدخل كود الخصم' : 'Enter coupon code'
  };

  const planIcons = {
    starter: <Building2 className="h-6 w-6" />,
    professional: <Zap className="h-6 w-6" />,
    enterprise: <Crown className="h-6 w-6" />
  };

  const planColors = {
    starter: 'from-blue-500 to-blue-600',
    professional: 'from-purple-500 to-purple-600',
    enterprise: 'from-amber-500 to-amber-600'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [packagesRes, methodsRes] = await Promise.all([
        axios.get(`${API_URL}/api/payments/packages`),
        axios.get(`${API_URL}/api/payments/payment-methods`)
      ]);
      
      setPackages(packagesRes.data);
      setPaymentMethods(methodsRes.data.methods);
      
      // Pre-select from URL params if any
      const params = new URLSearchParams(location.search);
      const preselectedPlan = params.get('plan');
      if (preselectedPlan) {
        const pkg = packagesRes.data.find(p => p.id.startsWith(preselectedPlan));
        if (pkg) setSelectedPackage(pkg.id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedPackage && selectedMethod !== 'activation_code') {
      toast.error(isRTL ? 'يرجى اختيار باقة' : 'Please select a package');
      return;
    }

    setProcessing(true);

    try {
      // Handle activation code
      if (selectedMethod === 'activation_code') {
        if (!activationCode.trim()) {
          toast.error(isRTL ? 'يرجى إدخال كود التفعيل' : 'Please enter activation code');
          setProcessing(false);
          return;
        }
        
        const response = await axios.post(
          `${API_URL}/api/subscriptions/redeem-code`,
          { code: activationCode.trim() },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        
        if (response.data.success) {
          setActivationSuccess(response.data);
          toast.success(isRTL ? response.data.message_ar : response.data.message_en);
        }
        setProcessing(false);
        return;
      }
      
      // Handle manual methods (bank transfer, instapay, vodafone cash)
      if (['bank_transfer', 'instapay', 'vodafone_cash'].includes(selectedMethod)) {
        toast.info(isRTL 
          ? 'يرجى إتمام التحويل ثم التواصل معنا لتأكيد الدفع' 
          : 'Please complete the transfer and contact us to confirm payment'
        );
        setProcessing(false);
        return;
      }

      const originUrl = window.location.origin;
      const requestBody = {
        package_id: selectedPackage,
        origin_url: originUrl,
        user_email: user?.email,
        company_id: user?.company_id,
        coupon_code: appliedCoupon?.code || null
      };

      let response;
      
      if (selectedMethod === 'stripe') {
        response = await axios.post(
          `${API_URL}/api/payments/create-checkout`,
          requestBody,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        
        if (response.data.url) {
          window.location.href = response.data.url;
        }
      } else if (selectedMethod === 'paypal') {
        response = await axios.post(
          `${API_URL}/api/payments/paypal/create-checkout`,
          requestBody,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        
        if (response.data.approval_url) {
          window.location.href = response.data.approval_url;
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object') {
        toast.error(isRTL ? detail.message_ar : detail.message_en);
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error(isRTL ? 'خطأ في العملية' : 'Error processing request');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error(isRTL ? 'يرجى إدخال كود الخصم' : 'Please enter a coupon code');
      return;
    }

    if (!selectedPackage) {
      toast.error(isRTL ? 'يرجى اختيار باقة أولاً' : 'Please select a package first');
      return;
    }

    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) return;

    setCouponLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/coupons/validate`, {
        code: couponCode.trim(),
        package_id: selectedPackage,
        amount_usd: pkg.price_usd
      });

      setAppliedCoupon(response.data.coupon);
      setDiscountAmount(response.data.discount_amount);
      toast.success(isRTL ? response.data.message_ar : response.data.message_en);
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object') {
        toast.error(isRTL ? detail.message_ar : detail.message_en);
      } else {
        toast.error(isRTL ? 'كود الخصم غير صالح' : 'Invalid coupon code');
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    toast.info(isRTL ? 'تم إزالة الكوبون' : 'Coupon removed');
  };

  const getSelectedPackagePrice = () => {
    if (!selectedPackage) return 0;
    const pkg = packages.find(p => p.id === selectedPackage);
    return pkg ? pkg.price_usd : 0;
  };

  const getFinalPrice = () => {
    const originalPrice = getSelectedPackagePrice();
    return Math.max(0, originalPrice - discountAmount);
  };

  const getDurationLabel = (duration) => {
    if (duration === 'lifetime') return t.lifetime;
    const months = parseInt(duration.split('_')[0]);
    if (months === 12) return `1 ${t.year}`;
    return `${months} ${t.months}`;
  };

  const groupedPackages = packages.reduce((acc, pkg) => {
    if (!acc[pkg.plan]) acc[pkg.plan] = [];
    acc[pkg.plan].push(pkg);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.title}</h1>
          <p className="text-lg text-gray-600">{t.subtitle}</p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {Object.entries(groupedPackages).map(([plan, planPackages]) => (
            <Card key={plan} className={`relative overflow-hidden ${selectedPackage?.startsWith(plan) ? 'ring-2 ring-[#28376B]' : ''}`}>
              {/* Header */}
              <div className={`bg-gradient-to-r ${planColors[plan]} text-white p-6`}>
                <div className="flex items-center justify-between mb-2">
                  {planIcons[plan]}
                  {plan === 'professional' && (
                    <Badge className="bg-white/20 text-white border-0">{t.popular}</Badge>
                  )}
                  {plan === 'enterprise' && (
                    <Badge className="bg-white/20 text-white border-0">{t.bestValue}</Badge>
                  )}
                </div>
                <h3 className="text-2xl font-bold">{t[plan]}</h3>
              </div>

              <CardContent className="p-6">
                {/* Duration Options */}
                <RadioGroup 
                  value={selectedPackage} 
                  onValueChange={setSelectedPackage}
                  className="space-y-3"
                >
                  {planPackages.map((pkg) => (
                    <div 
                      key={pkg.id}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPackage === pkg.id 
                          ? 'border-[#28376B] bg-[#28376B]/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPackage(pkg.id)}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={pkg.id} id={pkg.id} />
                        <Label htmlFor={pkg.id} className="cursor-pointer">
                          <span className="font-medium">{getDurationLabel(pkg.duration)}</span>
                        </Label>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#28376B]">${pkg.price_usd}</p>
                        <p className="text-xs text-gray-500">
                          {formatPrice(pkg.price_egp, language)}
                          {!isEgypt && <span className="text-gray-400 text-xs mr-1">(≈ {pkg.price_egp?.toLocaleString()} ج.م)</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Method Selection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t.paymentMethod}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedMethod === method.id 
                      ? 'border-[#28376B] bg-[#28376B]/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <RadioGroupItem value={method.id} id={method.id} />
                  <div className="flex items-center gap-3 flex-1">
                    {method.id === 'stripe' ? (
                      <CreditCard className="h-6 w-6 text-[#28376B]" />
                    ) : method.id === 'paypal' ? (
                      <PayPalIcon />
                    ) : method.icon && method.icon.length <= 2 ? (
                      <span className="text-2xl">{method.icon}</span>
                    ) : (
                      <CreditCard className="h-6 w-6 text-[#28376B]" />
                    )}
                    <div>
                      <Label htmlFor={method.id} className="font-medium cursor-pointer">
                        {isRTL ? method.name_ar : method.name_en}
                      </Label>
                      <p className="text-sm text-gray-500">
                        {isRTL ? method.description_ar : method.description_en}
                      </p>
                      {method.type === 'manual' && (
                        <span className="text-xs text-amber-600">{isRTL ? '(يتطلب تأكيد يدوي)' : '(Requires manual confirmation)'}</span>
                      )}
                    </div>
                  </div>
                  {(method.test_mode || method.sandbox_mode) && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      {t.sandboxMode}
                    </Badge>
                  )}
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Activation Code Success */}
        {activationSuccess && (
          <Card className="mb-8 border-2 border-green-400 bg-green-50">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">
                {isRTL ? 'تم التفعيل بنجاح!' : 'Activated Successfully!'}
              </h2>
              <p className="text-green-700 mb-4">
                {isRTL ? activationSuccess.message_ar : activationSuccess.message_en}
              </p>
              <div className="bg-white rounded-lg p-4 inline-block text-left mb-4">
                <p className="text-sm text-gray-600">{isRTL ? 'الباقة:' : 'Plan:'} <strong>{activationSuccess.plan}</strong></p>
                <p className="text-sm text-gray-600">{isRTL ? 'تاريخ الانتهاء:' : 'Expires:'} <strong>{new Date(activationSuccess.end_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}</strong></p>
                <p className="text-sm text-green-600 font-bold">{isRTL ? 'المبلغ: 0 ج.م (هدية مجانية)' : 'Amount: $0 (Free Gift)'}</p>
              </div>
              <br />
              <Button onClick={() => navigate('/dashboard')} className="bg-green-600 hover:bg-green-700 text-white">
                {isRTL ? 'الذهاب للوحة التحكم' : 'Go to Dashboard'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!activationSuccess && (
        <>
        {/* Activation Code Input - shown when activation_code method is selected */}
        {selectedMethod === 'activation_code' && (
          <Card className="mb-8 border-2 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-600" />
                {isRTL ? 'أدخل كود التفعيل' : 'Enter Activation Code'}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'أدخل كود التفعيل الذي حصلت عليه. الكود يفعّل الاشتراك مجاناً.' : 'Enter the activation code you received. The code activates your subscription for free.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder={isRTL ? 'مثال: DL-PRO-ABCD1234' : 'e.g. DL-PRO-ABCD1234'}
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  className="flex-1 text-lg font-mono tracking-wider"
                  data-testid="activation-code-input"
                  onKeyPress={(e) => e.key === 'Enter' && handlePayment()}
                />
              </div>
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {isRTL ? 'كود التفعيل = اشتراك مجاني (المبلغ = 0)' : 'Activation Code = Free Subscription (Amount = $0)'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Payment Instructions */}
        {['bank_transfer', 'instapay', 'vodafone_cash'].includes(selectedMethod) && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                {selectedMethod === 'bank_transfer' ? '🏦' : selectedMethod === 'instapay' ? '📱' : '📲'}
                {isRTL ? 'تعليمات الدفع' : 'Payment Instructions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMethod === 'instapay' && (
                <div className="space-y-3">
                  <p className="text-gray-700">{isRTL ? 'حول المبلغ عبر إنستاباي إلى الرقم:' : 'Transfer via InstaPay to:'}</p>
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                    <span className="font-mono text-xl font-bold">00201006008552</span>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText('00201006008552'); toast.success(isRTL ? 'تم النسخ' : 'Copied!'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {selectedMethod === 'vodafone_cash' && (
                <div className="space-y-3">
                  <p className="text-gray-700">{isRTL ? 'حول المبلغ عبر فودافون كاش إلى الرقم:' : 'Transfer via Vodafone Cash to:'}</p>
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                    <span className="font-mono text-xl font-bold">00201012625529</span>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText('00201012625529'); toast.success(isRTL ? 'تم النسخ' : 'Copied!'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <p className="text-gray-700">{isRTL ? 'حول المبلغ إلى الحساب البنكي التالي:' : 'Transfer to the following bank account:'}</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{isRTL ? 'تواصل معنا للحصول على بيانات الحساب البنكي' : 'Contact us for bank account details'}</p>
                    <p className="text-sm text-gray-500 mt-1">info@datalifeai.com</p>
                  </div>
                </div>
              )}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  {isRTL ? 'بعد التحويل، تواصل معنا على info@datalifeai.com لتأكيد الدفع وتفعيل اشتراكك.' : 'After transfer, contact us at info@datalifeai.com to confirm payment and activate your subscription.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coupon Code Section - only for online methods */}
        {['stripe', 'paypal'].includes(selectedMethod) && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t.couponCode}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">{t.couponApplied}: {appliedCoupon.code}</p>
                    <p className="text-sm text-green-600">
                      {appliedCoupon.discount_type === 'percentage' 
                        ? `${appliedCoupon.discount_value}% ${t.discount}`
                        : `$${appliedCoupon.discount_value} ${t.discount}`
                      }
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveCoupon} className="text-red-500 hover:text-red-700">
                  <X className="h-4 w-4 mr-1" />
                  {t.removeCoupon}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder={t.enterCoupon}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <Button 
                  onClick={handleApplyCoupon} 
                  disabled={couponLoading || !couponCode.trim()}
                  className="bg-[#28376B] hover:bg-[#1e2a52]"
                >
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.applyCoupon}
                </Button>
              </div>
            )}
            
            {/* Price Summary */}
            {selectedPackage && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{isRTL ? 'السعر الأصلي' : 'Original Price'}</span>
                  <span className="font-medium">${getSelectedPackagePrice().toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm mb-2 text-green-600">
                    <span>{t.discount}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>{t.total}</span>
                  <span className="text-[#28376B]">${getFinalPrice().toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Checkout Button */}
        <div className="flex flex-col items-center gap-4">
          <Button 
            size="lg" 
            className="w-full max-w-md bg-[#28376B] hover:bg-[#1e2a52] text-white py-6 text-lg"
            onClick={handlePayment}
            disabled={selectedMethod === 'activation_code' ? (!activationCode.trim() || processing) : (!selectedPackage || processing)}
            data-testid="proceed-payment-btn"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {t.processing}
              </>
            ) : selectedMethod === 'activation_code' ? (
              <>
                <Key className="h-5 w-5 mr-2" />
                {isRTL ? 'تفعيل الكود' : 'Activate Code'}
              </>
            ) : ['bank_transfer', 'instapay', 'vodafone_cash'].includes(selectedMethod) ? (
              <>
                {isRTL ? 'تم - سأتواصل بعد التحويل' : 'Done - I will contact after transfer'}
              </>
            ) : (
              <>
                {t.proceedPayment}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Shield className="h-4 w-4" />
            {t.securePayment}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
