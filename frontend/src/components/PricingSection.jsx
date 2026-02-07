import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle, X, Star, Zap, Building2, Crown, Users, Calculator, PieChart, FileText, Shield, Cloud, Bell, HeadphonesIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import PaymentModal from './PaymentModal';

const PricingSection = () => {
  const { language, isRTL } = useLanguage();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
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
          <TabsList className={`grid w-full grid-cols-3 mb-12 ${isRTL ? 'text-right' : ''}`}>
            <TabsTrigger value="subscription">{t('pricing.tabs.subscription')}</TabsTrigger>
            <TabsTrigger value="modules">{t('pricing.tabs.modules')}</TabsTrigger>
            <TabsTrigger value="onetime">{t('pricing.tabs.onetime')}</TabsTrigger>
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
              {modulePackages.map((module, index) => (
                <Card key={module.id} className="border-gray-200 hover:shadow-lg transition-all duration-300">
                  <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                      <div className="p-4 bg-[#28376B]/10 rounded-full">
                        <div className="text-[#28376B]">{module.icon}</div>
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold">{module.name}</CardTitle>
                    <CardDescription className="text-gray-600 mt-2">
                      {module.description}
                    </CardDescription>
                    
                    <div className="mt-6">
                      <div className="text-3xl font-bold text-gray-900">
                        {billingCycle === 'monthly' ? module.monthlyPrice : module.annualPrice}
                        <span className="text-sm text-gray-500 font-normal ml-1">
                          {module.currency}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        /{billingCycle === 'monthly' ? t('pricing.billing.month') : t('pricing.billing.year')}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <Button 
                      onClick={() => handlePlanSelect({...module, type: 'module'})}
                      className="w-full mb-6 bg-[#28376B] hover:bg-[#1e2a5a]"
                    >
                      {t('pricing.modules.button')}
                    </Button>

                    <div className="space-y-3">
                      {module.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

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
              {oneTimePackages.map((pkg, index) => (
                <Card 
                  key={pkg.id} 
                  className={`border-gray-200 hover:shadow-lg transition-all duration-300 ${
                    pkg.popular ? 'border-[#28376B] border-2' : ''
                  }`}
                >
                  {pkg.popular && (
                    <div className="bg-[#28376B] text-white text-center py-2 rounded-t-lg">
                      <Badge className="bg-white text-[#28376B]">
                        {t('pricing.recommended')}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                    <CardDescription className="text-gray-600 mt-2">
                      {pkg.description}
                    </CardDescription>
                    
                    <div className="mt-6">
                      <div className="text-4xl font-bold text-gray-900">
                        {pkg.price}
                        <span className="text-sm text-gray-500 font-normal ml-1">
                          {pkg.currency}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {t('pricing.oneTime.onetime')}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <Button 
                      onClick={() => handlePlanSelect({...pkg, type: 'onetime', monthlyPrice: pkg.price, annualPrice: pkg.price})}
                      className={`w-full mb-6 ${
                        pkg.popular 
                          ? 'bg-[#28376B] hover:bg-[#1e2a5a]' 
                          : 'bg-gray-900 hover:bg-gray-800'
                      }`}
                    >
                      {t('pricing.oneTime.button')}
                    </Button>

                    <div className="space-y-3">
                      {pkg.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

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

export default PricingSection;