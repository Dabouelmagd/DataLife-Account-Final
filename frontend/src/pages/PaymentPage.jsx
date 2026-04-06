import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  CreditCard, Shield, CheckCircle, Loader2, ArrowRight, 
  Building2, Clock, Users, Star, Zap, Crown, DollarSign
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

  const [packages, setPackages] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('stripe');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const t = {
    title: isRTL ? 'اختر خطة الاشتراك' : 'Choose Your Plan',
    subtitle: isRTL ? 'اختر الباقة المناسبة لاحتياجات عملك' : 'Select the package that fits your business needs',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    selectPlan: isRTL ? 'اختر الباقة' : 'Select Package',
    proceedPayment: isRTL ? 'المتابعة للدفع' : 'Proceed to Payment',
    processing: isRTL ? 'جاري المعالجة...' : 'Processing...',
    securePayment: isRTL ? 'دفع آمن ومشفر' : 'Secure & Encrypted Payment',
    testMode: isRTL ? 'وضع الاختبار' : 'Test Mode',
    perMonth: isRTL ? '/شهر' : '/month',
    months: isRTL ? 'أشهر' : 'months',
    year: isRTL ? 'سنة' : 'year',
    lifetime: isRTL ? 'مدى الحياة' : 'Lifetime',
    starter: isRTL ? 'المبتدئ' : 'Starter',
    professional: isRTL ? 'المحترف' : 'Professional',
    enterprise: isRTL ? 'المؤسسي' : 'Enterprise',
    employees: isRTL ? 'موظف' : 'employees',
    popular: isRTL ? 'الأكثر شيوعاً' : 'Most Popular',
    bestValue: isRTL ? 'أفضل قيمة' : 'Best Value'
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
    if (!selectedPackage) {
      toast.error(isRTL ? 'يرجى اختيار باقة' : 'Please select a package');
      return;
    }

    setProcessing(true);

    try {
      const originUrl = window.location.origin;
      const requestBody = {
        package_id: selectedPackage,
        origin_url: originUrl,
        user_email: user?.email,
        company_id: user?.company_id
      };

      let response;
      
      if (selectedMethod === 'stripe') {
        response = await axios.post(
          `${API_URL}/api/payments/create-checkout`,
          requestBody,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        
        // Redirect to Stripe checkout
        if (response.data.url) {
          window.location.href = response.data.url;
        }
      } else if (selectedMethod === 'paypal') {
        response = await axios.post(
          `${API_URL}/api/payments/paypal/create-checkout`,
          requestBody,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        
        // Redirect to PayPal approval URL
        if (response.data.approval_url) {
          window.location.href = response.data.approval_url;
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(isRTL ? 'خطأ في إنشاء جلسة الدفع' : 'Error creating checkout session');
    } finally {
      setProcessing(false);
    }
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
                        <p className="text-xs text-gray-500">{pkg.price_egp} EGP</p>
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
                    ) : (
                      <PayPalIcon />
                    )}
                    <div>
                      <Label htmlFor={method.id} className="font-medium cursor-pointer">
                        {isRTL ? method.name_ar : method.name_en}
                      </Label>
                      <p className="text-sm text-gray-500">
                        {isRTL ? method.description_ar : method.description_en}
                      </p>
                    </div>
                  </div>
                  {method.test_mode && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      {t.testMode}
                    </Badge>
                  )}
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Checkout Button */}
        <div className="flex flex-col items-center gap-4">
          <Button 
            size="lg" 
            className="w-full max-w-md bg-[#28376B] hover:bg-[#1e2a52] text-white py-6 text-lg"
            onClick={handlePayment}
            disabled={!selectedPackage || processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {t.processing}
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
      </div>
    </div>
  );
};

export default PaymentPage;
