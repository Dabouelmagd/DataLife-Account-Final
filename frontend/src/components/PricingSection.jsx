import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, X, Zap, Building2, Crown, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import PaymentModal from './PaymentModal';

const PricingSection = () => {
  const { language, isRTL } = useLanguage();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [currency, setCurrency] = useState('EGP');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const ar = language === 'ar';

  const exchangeRate = 50; // 1 USD ≈ 50 EGP

  const plans = [
    {
      id: 'starter',
      name: ar ? 'المبتدئ' : 'Starter',
      desc: ar ? 'للشركات الصغيرة والناشئة' : 'For small & startup businesses',
      monthlyEGP: 299, annualEGP: 2390,
      monthlyUSD: 6, annualUSD: 48,
      employees: ar ? '1-10 موظفين' : '1-10 Employees',
      icon: <Zap className="h-6 w-6" />,
      color: 'border-gray-200',
      popular: false,
      features: [
        ar ? 'إدارة الموظفين الأساسية' : 'Basic employee management',
        ar ? 'الحضور والانصراف' : 'Attendance tracking',
        ar ? 'الإجازات العارضة والسنوية' : 'Casual & annual leave',
        ar ? 'الإدارة المالية الأساسية' : 'Basic financial management',
        ar ? 'القيود اليومية' : 'Journal entries',
        ar ? 'الفواتير' : 'Invoicing',
        ar ? 'العملاء والموردين' : 'Customers & suppliers',
        ar ? 'المنتجات' : 'Products',
        ar ? 'التقارير الأساسية' : 'Basic reports',
        ar ? 'دعم عبر البريد' : 'Email support',
        ar ? '5 جيجا تخزين' : '5 GB storage',
      ],
      notIncluded: [
        ar ? 'كشف المرتبات التلقائي' : 'Auto payroll',
        ar ? 'البدلات والخصومات' : 'Allowances & deductions',
        ar ? 'الورديات' : 'Shifts management',
        ar ? 'إنهاء الخدمة' : 'Termination',
        ar ? 'دفتر الأستاذ العام' : 'General ledger',
        ar ? 'ميزان المراجعة' : 'Trial balance',
        ar ? 'الفاتورة الإلكترونية (ETA)' : 'E-Invoicing (ETA)',
        ar ? 'المشتريات' : 'Purchases',
        ar ? 'المخزون' : 'Inventory',
        ar ? 'البنوك' : 'Banking',
        ar ? 'إشعارات Push' : 'Push notifications',
        ar ? 'المشاريع والمهام' : 'Projects & tasks',
        ar ? 'فروع متعددة' : 'Multi-location',
        ar ? 'ربط API' : 'API integration',
      ],
    },
    {
      id: 'professional',
      name: ar ? 'المحترف' : 'Professional',
      desc: ar ? 'للشركات المتوسطة والنامية' : 'For growing medium businesses',
      monthlyEGP: 799, annualEGP: 6392,
      monthlyUSD: 16, annualUSD: 128,
      employees: ar ? '11-100 موظف' : '11-100 Employees',
      icon: <Building2 className="h-6 w-6" />,
      color: 'border-[#28376B]',
      popular: true,
      features: [
        ar ? 'إدارة الموظفين' : 'Employee management',
        ar ? 'الحضور والانصراف' : 'Attendance tracking',
        ar ? 'الإجازات العارضة والسنوية' : 'Casual & annual leave',
        ar ? 'كشف المرتبات التلقائي' : 'Automatic payroll',
        ar ? 'الرواتب والمرتبات' : 'Salaries management',
        ar ? 'البدلات والخصومات' : 'Allowances & deductions',
        ar ? 'الورديات' : 'Shifts management',
        ar ? 'إنهاء الخدمة' : 'Termination',
        ar ? 'الإدارة المالية الكاملة' : 'Full financial management',
        ar ? 'القيود اليومية' : 'Journal entries',
        ar ? 'دفتر الأستاذ العام' : 'General ledger',
        ar ? 'ميزان المراجعة' : 'Trial balance',
        ar ? 'قائمة الدخل والميزانية' : 'Income statement & balance sheet',
        ar ? 'الفواتير' : 'Invoicing',
        ar ? 'الفاتورة الإلكترونية (ETA)' : 'E-Invoicing (ETA)',
        ar ? 'العملاء والموردين' : 'Customers & suppliers',
        ar ? 'المنتجات والعملات' : 'Products & currencies',
        ar ? 'المشتريات' : 'Purchases',
        ar ? 'المخزون' : 'Inventory management',
        ar ? 'البنوك والتسويات' : 'Banking & reconciliation',
        ar ? 'إشعارات Push' : 'Push notifications',
        ar ? 'تقارير متقدمة' : 'Advanced reports',
        ar ? 'الموافقات' : 'Approvals',
        ar ? 'استيراد البيانات' : 'Data import',
        ar ? 'دعم أولوية' : 'Priority support',
        ar ? '25 جيجا تخزين' : '25 GB storage',
      ],
      notIncluded: [
        ar ? 'فروع متعددة' : 'Multi-location',
        ar ? 'المشاريع والمهام' : 'Projects & tasks',
        ar ? 'مدير حساب مخصص' : 'Dedicated account manager',
        ar ? 'ربط API' : 'API integration',
        ar ? 'تخصيص كامل' : 'Full customization',
      ],
    },
    {
      id: 'enterprise',
      name: ar ? 'المؤسسي' : 'Enterprise',
      desc: ar ? 'للمؤسسات والشركات الكبيرة' : 'For large organizations',
      monthlyEGP: 1499, annualEGP: 11992,
      monthlyUSD: 30, annualUSD: 240,
      employees: ar ? 'غير محدود' : 'Unlimited',
      icon: <Crown className="h-6 w-6" />,
      color: 'border-gray-200',
      popular: false,
      features: [
        ar ? 'موظفين غير محدودين' : 'Unlimited employees',
        ar ? 'إدارة الموظفين الكاملة' : 'Full employee management',
        ar ? 'الحضور والانصراف' : 'Attendance tracking',
        ar ? 'الإجازات العارضة والسنوية' : 'Casual & annual leave',
        ar ? 'كشف المرتبات التلقائي' : 'Automatic payroll',
        ar ? 'الرواتب والمرتبات' : 'Salaries management',
        ar ? 'البدلات والخصومات' : 'Allowances & deductions',
        ar ? 'الورديات' : 'Shifts management',
        ar ? 'إنهاء الخدمة' : 'Termination',
        ar ? 'الإدارة المالية الكاملة' : 'Full financial management',
        ar ? 'القيود اليومية' : 'Journal entries',
        ar ? 'دفتر الأستاذ العام' : 'General ledger',
        ar ? 'ميزان المراجعة' : 'Trial balance',
        ar ? 'قائمة الدخل والميزانية' : 'Income statement & balance sheet',
        ar ? 'الفواتير' : 'Invoicing',
        ar ? 'الفاتورة الإلكترونية (ETA)' : 'E-Invoicing (ETA)',
        ar ? 'العملاء والموردين' : 'Customers & suppliers',
        ar ? 'المنتجات والعملات' : 'Products & currencies',
        ar ? 'المشتريات' : 'Purchases',
        ar ? 'المخزون' : 'Inventory management',
        ar ? 'البنوك والتسويات' : 'Banking & reconciliation',
        ar ? 'المشاريع والمهام' : 'Projects & tasks',
        ar ? 'إشعارات Push' : 'Push notifications',
        ar ? 'تقارير متقدمة' : 'Advanced reports',
        ar ? 'الموافقات' : 'Approvals',
        ar ? 'استيراد البيانات' : 'Data import',
        ar ? 'فروع متعددة' : 'Multi-location support',
        ar ? 'لوحة تحكم المدير' : 'Admin dashboard',
        ar ? 'تخصيص كامل' : 'Full customization',
        ar ? 'ربط API' : 'API integration',
        ar ? 'مدير حساب مخصص' : 'Dedicated account manager',
        ar ? 'دعم هاتفي' : 'Phone support',
        ar ? 'تخزين غير محدود' : 'Unlimited storage',
        ar ? 'تدريب الفريق' : 'Team training',
        ar ? 'SLA مضمون' : 'Guaranteed SLA',
      ],
      notIncluded: [],
    },
  ];

  // Module packages
  const modules = [
    { id: 'hr-only', name: ar ? 'حزمة الموارد البشرية' : 'HR Package', monthlyEGP: 199, monthlyUSD: 4,
      features: ar ? ['إدارة الموظفين','الحضور والانصراف','كشف المرتبات','الإجازات','التأمينات'] : ['Employee management','Attendance','Payroll','Leave management','Insurance'] },
    { id: 'finance-only', name: ar ? 'حزمة المالية' : 'Finance Package', monthlyEGP: 249, monthlyUSD: 5,
      features: ar ? ['المحاسبة العامة','الفواتير','المصروفات','البنوك','التقارير المالية'] : ['General accounting','Invoicing','Expenses','Banking','Financial reports'] },
    { id: 'inventory-only', name: ar ? 'حزمة المخزون' : 'Inventory Package', monthlyEGP: 179, monthlyUSD: 4,
      features: ar ? ['تتبع المخزون','أوامر الشراء','إدارة الموردين','تحليلات المخزون','تنبيهات النفاد'] : ['Stock tracking','Purchase orders','Supplier management','Inventory analytics','Low stock alerts'] },
  ];

  // Comparison features
  const comparisonFeatures = [
    { name: ar ? 'عدد الموظفين' : 'Employees', starter: ar ? '1-10' : '1-10', professional: ar ? '11-100' : '11-100', enterprise: ar ? 'غير محدود' : 'Unlimited' },
    { name: ar ? 'إدارة الموظفين' : 'Employee Management', starter: true, professional: true, enterprise: true },
    { name: ar ? 'الحضور والانصراف' : 'Attendance', starter: true, professional: true, enterprise: true },
    { name: ar ? 'كشف المرتبات' : 'Payroll', starter: false, professional: true, enterprise: true },
    { name: ar ? 'البدلات والخصومات' : 'Allowances & Deductions', starter: false, professional: true, enterprise: true },
    { name: ar ? 'الورديات' : 'Shifts', starter: false, professional: true, enterprise: true },
    { name: ar ? 'الإجازات' : 'Leave Management', starter: true, professional: true, enterprise: true },
    { name: ar ? 'إنهاء الخدمة' : 'Termination', starter: false, professional: true, enterprise: true },
    { name: ar ? 'الإدارة المالية' : 'Financial Management', starter: true, professional: true, enterprise: true },
    { name: ar ? 'القيود اليومية' : 'Journal Entries', starter: true, professional: true, enterprise: true },
    { name: ar ? 'دفتر الأستاذ' : 'General Ledger', starter: false, professional: true, enterprise: true },
    { name: ar ? 'ميزان المراجعة' : 'Trial Balance', starter: false, professional: true, enterprise: true },
    { name: ar ? 'الفواتير' : 'Invoicing', starter: true, professional: true, enterprise: true },
    { name: ar ? 'الفاتورة الإلكترونية (ETA)' : 'E-Invoicing (ETA)', starter: false, professional: true, enterprise: true },
    { name: ar ? 'المشتريات' : 'Purchases', starter: false, professional: true, enterprise: true },
    { name: ar ? 'المخزون' : 'Inventory', starter: false, professional: true, enterprise: true },
    { name: ar ? 'البنوك' : 'Banking', starter: false, professional: true, enterprise: true },
    { name: ar ? 'المشاريع والمهام' : 'Projects & Tasks', starter: false, professional: false, enterprise: true },
    { name: ar ? 'إشعارات Push' : 'Push Notifications', starter: false, professional: true, enterprise: true },
    { name: ar ? 'التقارير المتقدمة' : 'Advanced Reports', starter: false, professional: true, enterprise: true },
    { name: ar ? 'فروع متعددة' : 'Multi-Location', starter: false, professional: false, enterprise: true },
    { name: ar ? 'ربط API' : 'API Integration', starter: false, professional: false, enterprise: true },
    { name: ar ? 'مدير حساب مخصص' : 'Dedicated Manager', starter: false, professional: false, enterprise: true },
    { name: ar ? 'التخزين' : 'Storage', starter: '5 GB', professional: '25 GB', enterprise: ar ? 'غير محدود' : 'Unlimited' },
    { name: ar ? 'الدعم' : 'Support', starter: ar ? 'بريد' : 'Email', professional: ar ? 'أولوية' : 'Priority', enterprise: ar ? 'هاتف + مدير' : 'Phone + Manager' },
  ];

  const getPrice = (plan) => {
    if (currency === 'USD') {
      return billingCycle === 'monthly' ? plan.monthlyUSD : plan.annualUSD;
    }
    return billingCycle === 'monthly' ? plan.monthlyEGP : plan.annualEGP;
  };

  const currencySymbol = currency === 'USD' ? '$' : (ar ? 'ج.م' : 'EGP');
  const periodLabel = billingCycle === 'monthly' ? (ar ? '/شهر' : '/mo') : (ar ? '/سنة' : '/yr');

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  const renderCell = (val) => {
    if (val === true) return <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />;
    if (val === false) return <X className="h-5 w-5 text-gray-300 mx-auto" />;
    return <span className="text-sm font-medium text-gray-700">{val}</span>;
  };

  return (
    <div className="container mx-auto max-w-6xl" dir={isRTL ? 'rtl' : 'ltr'} data-testid="pricing-section-inner">
      {/* Header */}
      <div className="text-center mb-10">
        <Badge className="mb-4 bg-purple-50 text-purple-700 hover:bg-purple-50 border-0">
          {ar ? 'الأسعار والباقات' : 'Pricing & Plans'}
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
          {ar ? 'اختر الباقة المناسبة لك' : 'Choose the Right Plan for You'}
        </h2>
        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
          {ar ? 'جميع الباقات تشمل تجربة مجانية. يمكنك الترقية في أي وقت.' : 'All plans include a free trial. Upgrade anytime.'}
        </p>
      </div>

      {/* Controls: Billing + Currency */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
        {/* Billing Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button onClick={() => setBillingCycle('monthly')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'شهري' : 'Monthly'}
          </button>
          <button onClick={() => setBillingCycle('annual')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'annual' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'سنوي' : 'Annual'}
            <span className="text-xs ms-1 text-green-400 font-bold">{ar ? '(وفر 20%)' : '(Save 20%)'}</span>
          </button>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button onClick={() => setCurrency('EGP')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'EGP' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'ج.م (EGP)' : 'EGP (£)'}
          </button>
          <button onClick={() => setCurrency('USD')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'USD' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'دولار ($)' : 'USD ($)'}
          </button>
        </div>
      </div>

      {/* ── Plan Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative overflow-hidden border-2 ${plan.popular ? 'border-[#28376B] shadow-xl scale-[1.02]' : 'border-gray-100'} hover:shadow-lg transition-all`} data-testid={`plan-${plan.id}`}>
            {plan.popular && (
              <div className="absolute top-0 inset-x-0 bg-[#28376B] text-white text-center text-xs font-bold py-1.5">
                {ar ? 'الأكثر شعبية' : 'Most Popular'}
              </div>
            )}
            <CardContent className={`p-6 ${plan.popular ? 'pt-10' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${plan.popular ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {plan.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500">{plan.desc}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#0f172a]">{getPrice(plan)}</span>
                  <span className="text-sm text-gray-500">{currencySymbol} {periodLabel}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{plan.employees}</p>
              </div>

              <Button onClick={() => handleSelectPlan(plan)} className={`w-full mb-5 ${plan.popular ? 'bg-[#28376B] hover:bg-[#1e2a5a] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>
                {ar ? 'ابدأ الآن' : 'Get Started'}
              </Button>

              {/* Features */}
              <div className="space-y-2.5">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{f}</span>
                  </div>
                ))}
                {plan.notIncluded.map((f, i) => (
                  <div key={`no-${i}`} className="flex items-start gap-2 text-sm">
                    <X className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-400 line-through">{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Full Comparison Table ── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-[#0f172a]">{ar ? 'مقارنة شاملة للخطط' : 'Full Plan Comparison'}</h3>
          <p className="text-gray-500 text-sm mt-2">{ar ? 'قارن بين جميع الخدمات في كل باقة' : 'Compare all services across every plan'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full max-w-4xl mx-auto border-collapse" data-testid="comparison-table">
            <thead>
              <tr className="bg-[#28376B] text-white">
                <th className="p-3 text-start text-sm font-semibold rounded-ts-xl">{ar ? 'الخدمة' : 'Feature'}</th>
                <th className="p-3 text-center text-sm font-semibold">{ar ? 'المبتدئ' : 'Starter'}</th>
                <th className="p-3 text-center text-sm font-semibold bg-[#1e2a5a]">{ar ? 'المحترف' : 'Professional'}</th>
                <th className="p-3 text-center text-sm font-semibold rounded-te-xl">{ar ? 'المؤسسي' : 'Enterprise'}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feat, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                  <td className="p-3 text-sm font-medium text-gray-800">{feat.name}</td>
                  <td className="p-3 text-center">{renderCell(feat.starter)}</td>
                  <td className="p-3 text-center bg-[#28376B]/5">{renderCell(feat.professional)}</td>
                  <td className="p-3 text-center">{renderCell(feat.enterprise)}</td>
                </tr>
              ))}
              {/* Price row */}
              <tr className="bg-[#28376B]/10 font-bold">
                <td className="p-3 text-sm text-gray-900">{ar ? 'السعر الشهري' : 'Monthly Price'}</td>
                <td className="p-3 text-center text-sm text-[#28376B]">{currency === 'USD' ? '$6' : (ar ? '299 ج.م' : '299 EGP')}</td>
                <td className="p-3 text-center text-sm text-[#28376B] bg-[#28376B]/10">{currency === 'USD' ? '$16' : (ar ? '799 ج.م' : '799 EGP')}</td>
                <td className="p-3 text-center text-sm text-[#28376B]">{currency === 'USD' ? '$30' : (ar ? '1,499 ج.م' : '1,499 EGP')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedPlan={{
            ...selectedPlan,
            price: getPrice(selectedPlan),
            currency: currencySymbol,
            billingCycle
          }}
        />
      )}
    </div>
  );
};

export default PricingSection;
