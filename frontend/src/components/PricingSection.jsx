import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, X, Star, Zap, Building2, Crown, Users, Calculator, PieChart, FileText, Shield, Cloud, Bell, HeadphonesIcon, Minus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import PaymentModal from './PaymentModal';

const PricingSection = () => {
  const { language, isRTL } = useLanguage();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showComparison, setShowComparison] = useState(true); // Always show comparison
  
  const t = (key) => getTranslation(language, key);

  const subscriptionPlans = [
    {
      id: 'starter',
      name: t('pricing.plans.starter.name'),
      description: t('pricing.plans.starter.description'),
      monthlyPrice: 299,
      annualPrice: 2390, // 20% discount
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      popular: false,
      employees: '1-10',
      features: [
        t('pricing.plans.starter.features.employees'),
        t('pricing.plans.starter.features.basicHR'),
        t('pricing.plans.starter.features.financial'),
        t('pricing.plans.starter.features.reports'),
        t('pricing.plans.starter.features.emailSupport'),
        t('pricing.plans.starter.features.storage'),
      ],
      notIncluded: [
        t('pricing.plans.starter.notIncluded.payroll'),
        t('pricing.plans.starter.notIncluded.advanced'),
        t('pricing.plans.starter.notIncluded.api'),
      ],
      buttonText: t('pricing.plans.starter.button'),
      icon: <Zap className="h-6 w-6" />
    },
    {
      id: 'professional',
      name: t('pricing.plans.professional.name'),
      description: t('pricing.plans.professional.description'),
      monthlyPrice: 799,
      annualPrice: 6392, // 33% discount
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      popular: true,
      employees: '11-100',
      features: [
        t('pricing.plans.professional.features.employees'),
        t('pricing.plans.professional.features.fullHR'),
        t('pricing.plans.professional.features.advanced'),
        t('pricing.plans.professional.features.inventory'),
        t('pricing.plans.professional.features.cost'),
        t('pricing.plans.professional.features.banking'),
        t('pricing.plans.professional.features.notifications'),
        t('pricing.plans.professional.features.priority'),
        t('pricing.plans.professional.features.storage'),
        t('pricing.plans.professional.features.reports'),
        t('pricing.plans.professional.features.integrations'),
      ],
      notIncluded: [
        t('pricing.plans.professional.notIncluded.multiLocation'),
        t('pricing.plans.professional.notIncluded.dedicated'),
      ],
      buttonText: t('pricing.plans.professional.button'),
      icon: <Building2 className="h-6 w-6" />
    },
    {
      id: 'enterprise',
      name: t('pricing.plans.enterprise.name'),
      description: t('pricing.plans.enterprise.description'),
      monthlyPrice: 1499,
      annualPrice: 11992, // 33% discount
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      popular: false,
      employees: t('pricing.plans.enterprise.unlimited'),
      features: [
        t('pricing.plans.enterprise.features.unlimited'),
        t('pricing.plans.enterprise.features.everything'),
        t('pricing.plans.enterprise.features.multiLocation'),
        t('pricing.plans.enterprise.features.adminDashboard'),
        t('pricing.plans.enterprise.features.autoPosting'),
        t('pricing.plans.enterprise.features.customization'),
        t('pricing.plans.enterprise.features.dedicated'),
        t('pricing.plans.enterprise.features.phone'),
        t('pricing.plans.enterprise.features.storage'),
        t('pricing.plans.enterprise.features.training'),
        t('pricing.plans.enterprise.features.sla'),
      ],
      notIncluded: [],
      buttonText: t('pricing.plans.enterprise.button'),
      icon: <Crown className="h-6 w-6" />
    }
  ];

  const modulePackages = [
    {
      id: 'hr-only',
      name: t('pricing.modules.hr.name'),
      description: t('pricing.modules.hr.description'),
      monthlyPrice: 199,
      annualPrice: 1592,
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      icon: <Users className="h-8 w-8" />,
      features: [
        t('pricing.modules.hr.features.employee'),
        t('pricing.modules.hr.features.attendance'),
        t('pricing.modules.hr.features.payroll'),
        t('pricing.modules.hr.features.leave'),
        t('pricing.modules.hr.features.insurance'),
      ]
    },
    {
      id: 'finance-only',
      name: t('pricing.modules.finance.name'),
      description: t('pricing.modules.finance.description'),
      monthlyPrice: 249,
      annualPrice: 1992,
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      icon: <Calculator className="h-8 w-8" />,
      features: [
        t('pricing.modules.finance.features.accounting'),
        t('pricing.modules.finance.features.invoicing'),
        t('pricing.modules.finance.features.expenses'),
        t('pricing.modules.finance.features.banking'),
        t('pricing.modules.finance.features.reports'),
      ]
    },
    {
      id: 'inventory-only',
      name: t('pricing.modules.inventory.name'),
      description: t('pricing.modules.inventory.description'),
      monthlyPrice: 179,
      annualPrice: 1432,
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      icon: <PieChart className="h-8 w-8" />,
      features: [
        t('pricing.modules.inventory.features.tracking'),
        t('pricing.modules.inventory.features.orders'),
        t('pricing.modules.inventory.features.suppliers'),
        t('pricing.modules.inventory.features.analytics'),
        t('pricing.modules.inventory.features.alerts'),
      ]
    }
  ];

  const oneTimePackages = [
    {
      id: 'basic-setup',
      name: t('pricing.oneTime.basic.name'),
      description: t('pricing.oneTime.basic.description'),
      price: 4999,
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      features: [
        t('pricing.oneTime.basic.features.installation'),
        t('pricing.oneTime.basic.features.training'),
        t('pricing.oneTime.basic.features.data'),
        t('pricing.oneTime.basic.features.support'),
      ]
    },
    {
      id: 'premium-setup',
      name: t('pricing.oneTime.premium.name'),
      description: t('pricing.oneTime.premium.description'),
      price: 9999,
      currency: language === 'ar' ? 'ج.م' : 'EGP',
      popular: true,
      features: [
        t('pricing.oneTime.premium.features.everything'),
        t('pricing.oneTime.premium.features.custom'),
        t('pricing.oneTime.premium.features.integration'),
        t('pricing.oneTime.premium.features.training'),
        t('pricing.oneTime.premium.features.support'),
      ]
    }
  ];

  const getCurrentPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
  };

  const getDiscountPercentage = (plan) => {
    if (billingCycle === 'annual') {
      const monthlyTotal = plan.monthlyPrice * 12;
      const discount = ((monthlyTotal - plan.annualPrice) / monthlyTotal) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-[#28376B]/10 text-[#28376B] border-[#28376B]/20">
            {t('pricing.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            {t('pricing.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            {t('pricing.description')}
          </p>
        </div>

        {/* Pricing Tabs */}
        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className={`grid w-full grid-cols-3 mb-12 bg-gray-100 p-1 rounded-xl ${isRTL ? 'text-right' : ''}`}>
            <TabsTrigger 
              value="subscription"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
            >
              {t('pricing.tabs.subscription')}
            </TabsTrigger>
            <TabsTrigger 
              value="modules"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
            >
              {t('pricing.tabs.modules')}
            </TabsTrigger>
            <TabsTrigger 
              value="onetime"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-700 data-[state=active]:text-white rounded-lg transition-all duration-300"
            >
              {t('pricing.tabs.onetime')}
            </TabsTrigger>
          </TabsList>

          {/* Subscription Plans */}
          <TabsContent value="subscription">
            {/* Billing Toggle */}
            <div className="flex justify-center mb-12">
              <div className="bg-white rounded-xl p-2 shadow-sm border">
                <div className="flex">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-[#28376B] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('pricing.billing.monthly')}
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all relative ${
                      billingCycle === 'annual'
                        ? 'bg-[#28376B] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('pricing.billing.annual')}
                    <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs">
                      {t('pricing.billing.save')}
                    </Badge>
                  </button>
                </div>
              </div>
            </div>

            {/* Subscription Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {subscriptionPlans.map((plan, index) => {
                const discount = getDiscountPercentage(plan);
                // Different colors for each plan
                const planColors = [
                  { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
                  { bg: 'from-purple-500 to-indigo-600', light: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
                  { bg: 'from-amber-500 to-orange-600', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' }
                ];
                const colors = planColors[index];
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative overflow-hidden ${
                      plan.popular 
                        ? `border-2 ${colors.border} shadow-2xl scale-105` 
                        : 'border-gray-200 hover:shadow-xl'
                    } transition-all duration-300 hover:-translate-y-1`}
                  >
                    {/* Colored Header */}
                    <div className={`bg-gradient-to-r ${colors.bg} p-6 text-white`}>
                      {plan.popular && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                            <Star className="h-3 w-3 mr-1" />
                            {t('pricing.popular')}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                          {plan.icon}
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-white">{plan.name}</CardTitle>
                          <p className="text-white/80 text-sm">{plan.employees} {t('pricing.employees')}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        {discount > 0 && (
                          <div className="text-sm text-white/60 line-through">
                            {plan.monthlyPrice * 12} {plan.currency}/{t('pricing.billing.year')}
                          </div>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">{getCurrentPrice(plan)}</span>
                          <span className="text-lg text-white/80">{plan.currency}</span>
                          <span className="text-sm text-white/60">
                            /{billingCycle === 'monthly' ? t('pricing.billing.month') : t('pricing.billing.year')}
                          </span>
                        </div>
                        {discount > 0 && (
                          <Badge className="mt-2 bg-white/20 text-white border-0">
                            {t('pricing.billing.savePercent').replace('%d', discount)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm mb-6">{plan.description}</p>
                      
                      <Button 
                        onClick={() => handlePlanSelect(plan)}
                        className={`w-full mb-6 bg-gradient-to-r ${colors.bg} hover:opacity-90 transition-opacity`}
                      >
                        {plan.buttonText}
                      </Button>

                      <div className="space-y-3">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                            <div className={`w-5 h-5 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                              <CheckCircle className={`h-3.5 w-3.5 ${colors.text}`} />
                            </div>
                            <span className="text-sm text-gray-700">{feature}</span>
                          </div>
                        ))}
                        {plan.notIncluded.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 opacity-50`}>
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <X className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <span className="text-sm text-gray-400">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Module Packages */}
          <TabsContent value="modules">
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t('pricing.modules.title')}
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {t('pricing.modules.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {modulePackages.map((module, index) => {
                // Different colors for each module
                const moduleColors = [
                  { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500' },
                  { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', iconBg: 'bg-gradient-to-br from-rose-400 to-pink-500' },
                  { bg: 'from-cyan-500 to-blue-600', light: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', iconBg: 'bg-gradient-to-br from-cyan-400 to-blue-500' }
                ];
                const colors = moduleColors[index];
                
                return (
                  <Card key={module.id} className={`${colors.border} border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                    {/* Colored Top Bar */}
                    <div className={`h-2 bg-gradient-to-r ${colors.bg}`}></div>
                    
                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-4">
                        <div className={`p-4 ${colors.iconBg} rounded-2xl shadow-lg`}>
                          <div className="text-white">{module.icon}</div>
                        </div>
                      </div>
                      <CardTitle className="text-xl font-bold text-gray-900">{module.name}</CardTitle>
                      <CardDescription className="text-gray-600 mt-2">
                        {module.description}
                      </CardDescription>
                      
                      <div className="mt-6 p-4 rounded-xl bg-gray-50">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className={`text-3xl font-bold ${colors.text}`}>
                            {billingCycle === 'monthly' ? module.monthlyPrice : module.annualPrice}
                          </span>
                          <span className="text-sm text-gray-500">
                            {module.currency}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          /{billingCycle === 'monthly' ? t('pricing.billing.month') : t('pricing.billing.year')}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <Button 
                        onClick={() => handlePlanSelect({...module, type: 'module'})}
                        className={`w-full mb-6 bg-gradient-to-r ${colors.bg} hover:opacity-90 transition-opacity shadow-md`}
                      >
                        {t('pricing.modules.button')}
                      </Button>

                      <div className="space-y-3">
                        {module.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                            <div className={`w-5 h-5 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                              <CheckCircle className={`h-3.5 w-3.5 ${colors.text}`} />
                            </div>
                            <span className="text-sm text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* One-time Packages */}
          {/* One-time Packages */}
          <TabsContent value="onetime">
            <div className="text-center mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t('pricing.oneTime.title')}
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {t('pricing.oneTime.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {oneTimePackages.map((pkg, index) => {
                // Different colors for each package
                const packageColors = [
                  { bg: 'from-slate-600 to-slate-800', light: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', iconBg: 'bg-gradient-to-br from-slate-500 to-slate-700' },
                  { bg: 'from-violet-500 to-purple-700', light: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-600', iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600' }
                ];
                const colors = packageColors[index];
                
                return (
                  <Card 
                    key={pkg.id} 
                    className={`overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                      pkg.popular ? `border-2 ${colors.border} shadow-xl` : 'border-gray-200'
                    }`}
                  >
                    {/* Colored Header */}
                    <div className={`bg-gradient-to-r ${colors.bg} p-6 text-white relative`}>
                      {pkg.popular && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-3">
                            <Star className="h-3 w-3 mr-1" />
                            {t('pricing.recommended')}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 ${colors.iconBg} rounded-xl shadow-lg`}>
                          {index === 0 ? <Zap className="h-6 w-6 text-white" /> : <Crown className="h-6 w-6 text-white" />}
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-white">{pkg.name}</CardTitle>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">{pkg.price}</span>
                          <span className="text-lg text-white/80">{pkg.currency}</span>
                        </div>
                        <div className="text-sm text-white/70 mt-1">
                          {t('pricing.oneTime.onetime')}
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <p className="text-gray-600 text-sm mb-6">{pkg.description}</p>
                      
                      <Button 
                        onClick={() => handlePlanSelect({...pkg, type: 'onetime', monthlyPrice: pkg.price, annualPrice: pkg.price})}
                        className={`w-full mb-6 bg-gradient-to-r ${colors.bg} hover:opacity-90 transition-opacity shadow-md`}
                      >
                        {t('pricing.oneTime.button')}
                      </Button>

                      <div className="space-y-3">
                        {pkg.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                            <div className={`w-5 h-5 rounded-full ${colors.light} flex items-center justify-center flex-shrink-0`}>
                              <CheckCircle className={`h-3.5 w-3.5 ${colors.text}`} />
                            </div>
                            <span className="text-sm text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Compare Plans Button */}
        <div className="text-center mt-12">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowComparison(!showComparison)}
            className="border-2 border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white px-8"
          >
            {showComparison 
              ? (language === 'ar' ? 'إخفاء المقارنة' : 'Hide Comparison')
              : t('pricing.comparison.title')
            }
          </Button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div className="mt-12 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-[#28376B] to-[#3d4f8a] text-white p-6 text-center">
              <h3 className="text-2xl font-bold mb-2">{t('pricing.comparison.title')}</h3>
              <p className="text-blue-100">{t('pricing.comparison.subtitle')}</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table Head */}
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className={`p-4 text-${isRTL ? 'right' : 'left'} font-semibold text-gray-700 min-w-[200px]`}>
                      {t('pricing.comparison.feature')}
                    </th>
                    <th className="p-4 text-center min-w-[140px]">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-gray-900">{t('pricing.comparison.starter')}</span>
                        <span className="text-sm text-gray-500">299 {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </th>
                    <th className="p-4 text-center min-w-[140px] bg-purple-50">
                      <div className="flex flex-col items-center">
                        <Badge className="mb-2 bg-purple-100 text-purple-700 border-0">
                          <Star className="w-3 h-3 mr-1" />
                          {t('pricing.popular')}
                        </Badge>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-2">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-gray-900">{t('pricing.comparison.professional')}</span>
                        <span className="text-sm text-gray-500">799 {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </th>
                    <th className="p-4 text-center min-w-[140px]">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-2">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-gray-900">{t('pricing.comparison.enterprise')}</span>
                        <span className="text-sm text-gray-500">1499 {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* General Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.general')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.employees')} starter={t('pricing.comparison.values.upTo10')} professional={t('pricing.comparison.values.upTo100')} enterprise={t('pricing.comparison.values.unlimited')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.multiTenant')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.arabicSupport')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.darkMode')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />

                  {/* HR Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.hr')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.employeeManagement')} starter={t('pricing.comparison.values.basic')} professional={t('pricing.comparison.values.full')} enterprise={t('pricing.comparison.values.full')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.attendance')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.payroll')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.leaveManagement')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.performance')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />

                  {/* Finance Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.finance')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.accounting')} starter={t('pricing.comparison.values.basic')} professional={t('pricing.comparison.values.advanced')} enterprise={t('pricing.comparison.values.full')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.chartOfAccounts')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.journalEntries')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.financialReports')} starter={t('pricing.comparison.values.basic')} professional={t('pricing.comparison.values.advanced')} enterprise={t('pricing.comparison.values.full')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.invoicing')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.multiCurrency')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />

                  {/* Banking Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.banking')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.bankManagement')} starter={t('pricing.comparison.values.basic')} professional={t('pricing.comparison.values.advanced')} enterprise={t('pricing.comparison.values.full')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.multiBankAccounts')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.autoJournalEntries')} starter={false} professional={true} enterprise={true} isRTL={isRTL} highlight />
                  <ComparisonRow feature={t('pricing.comparison.features.autoPosting')} starter={false} professional={false} enterprise={true} isRTL={isRTL} highlight />

                  {/* Notifications Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.notifications')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.emailNotifications')} starter={false} professional={true} enterprise={true} isRTL={isRTL} highlight />
                  <ComparisonRow feature={t('pricing.comparison.features.largeTransactionAlerts')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.adminDashboard')} starter={false} professional={false} enterprise={true} isRTL={isRTL} highlight />

                  {/* Support Category */}
                  <tr className="bg-gray-100">
                    <td colSpan="4" className={`p-3 font-bold text-gray-800 text-${isRTL ? 'right' : 'left'}`}>
                      {t('pricing.comparison.categories.support')}
                    </td>
                  </tr>
                  <ComparisonRow feature={t('pricing.comparison.features.emailSupport')} starter={true} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.prioritySupport')} starter={false} professional={true} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.phoneSupport')} starter={false} professional={false} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.dedicatedManager')} starter={false} professional={false} enterprise={true} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.cloudStorage')} starter={t('pricing.comparison.values.storage5gb')} professional={t('pricing.comparison.values.storage50gb')} enterprise={t('pricing.comparison.values.storageUnlimited')} isRTL={isRTL} />
                  <ComparisonRow feature={t('pricing.comparison.features.apiAccess')} starter={false} professional={t('pricing.comparison.values.basic')} enterprise={t('pricing.comparison.values.full')} isRTL={isRTL} />
                </tbody>
              </table>
            </div>

            {/* Table Footer with CTAs */}
            <div className="bg-gray-50 p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => handlePlanSelect(subscriptionPlans[0])}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90"
                >
                  {t('pricing.plans.starter.button')}
                </Button>
                <Button 
                  onClick={() => handlePlanSelect(subscriptionPlans[1])}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90"
                >
                  {t('pricing.plans.professional.button')}
                </Button>
                <Button 
                  onClick={() => handlePlanSelect(subscriptionPlans[2])}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90"
                >
                  {t('pricing.plans.enterprise.button')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Contact Section */}
        <div className="text-center mt-16 p-8 bg-white rounded-2xl shadow-lg">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {t('pricing.contact.title')}
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            {t('pricing.contact.description')}
          </p>
          <div className={`flex flex-col sm:flex-row gap-4 justify-center ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <Button 
              size="lg" 
              className="bg-[#28376B] hover:bg-[#1e2a5a]"
              onClick={() => window.open(`mailto:${t('contact.email')}?subject=Schedule DataLife Account Demo`, '_blank')}
            >
              {t('pricing.contact.demo')}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white"
              onClick={() => window.open(`tel:${t('contact.phone').replace(/\s/g, '')}`, '_self')}
            >
              {t('pricing.contact.sales')}
            </Button>
          </div>
        </div>

        {/* Payment Modal */}
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedPlan={selectedPlan}
          billingCycle={billingCycle}
        />
      </div>
    </section>
  );
};

// Comparison Row Component
const ComparisonRow = ({ feature, starter, professional, enterprise, isRTL, highlight }) => {
  const renderValue = (value) => {
    if (value === true) {
      return (
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-4 h-4 text-green-600" />
        </div>
      );
    }
    if (value === false) {
      return (
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
          <Minus className="w-4 h-4 text-gray-400" />
        </div>
      );
    }
    return <span className="text-sm font-medium text-gray-700">{value}</span>;
  };

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${highlight ? 'bg-yellow-50/50' : ''}`}>
      <td className={`p-4 text-${isRTL ? 'right' : 'left'} text-gray-700`}>
        {highlight && <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>}
        {feature}
      </td>
      <td className="p-4 text-center">{renderValue(starter)}</td>
      <td className="p-4 text-center bg-purple-50/30">{renderValue(professional)}</td>
      <td className="p-4 text-center">{renderValue(enterprise)}</td>
    </tr>
  );
};

export default PricingSection;