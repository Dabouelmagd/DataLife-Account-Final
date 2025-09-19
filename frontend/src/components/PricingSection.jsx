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
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative ${
                      plan.popular 
                        ? 'border-[#28376B] border-2 shadow-xl scale-105' 
                        : 'border-gray-200 hover:shadow-lg'
                    } transition-all duration-300`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#28376B] text-white px-4 py-1">
                          <Star className="h-3 w-3 mr-1" />
                          {t('pricing.popular')}
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-4">
                        <div className={`p-3 rounded-full ${
                          plan.popular ? 'bg-[#28376B]' : 'bg-gray-100'
                        }`}>
                          <div className={plan.popular ? 'text-white' : 'text-gray-600'}>
                            {plan.icon}
                          </div>
                        </div>
                      </div>
                      <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                      <CardDescription className="text-gray-600 mt-2">
                        {plan.description}
                      </CardDescription>
                      
                      <div className="mt-6">
                        {discount > 0 && (
                          <div className="text-sm text-gray-500 line-through">
                            {plan.monthlyPrice * 12} {plan.currency}/{t('pricing.billing.year')}
                          </div>
                        )}
                        <div className="text-4xl font-bold text-gray-900">
                          {getCurrentPrice(plan)}
                          <span className="text-sm text-gray-500 font-normal ml-1">
                            {plan.currency}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          /{billingCycle === 'monthly' ? t('pricing.billing.month') : t('pricing.billing.year')}
                        </div>
                        {discount > 0 && (
                          <Badge className="mt-2 bg-green-100 text-green-800">
                            {t('pricing.billing.savePercent').replace('%d', discount)}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 text-sm text-gray-600">
                        {plan.employees} {t('pricing.employees')}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <Button 
                        onClick={() => handlePlanSelect(plan)}
                        className={`w-full mb-6 ${
                          plan.popular 
                            ? 'bg-[#28376B] hover:bg-[#1e2a5a]' 
                            : 'bg-gray-900 hover:bg-gray-800'
                        }`}
                      >
                        {plan.buttonText}
                      </Button>

                      <div className="space-y-3">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-gray-600">{feature}</span>
                          </div>
                        ))}
                        {plan.notIncluded.map((feature, featureIndex) => (
                          <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 opacity-50`}>
                            <X className="h-5 w-5 text-gray-400 flex-shrink-0" />
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
                    <Button className="w-full mb-6 bg-[#28376B] hover:bg-[#1e2a5a]">
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
                    <Button className={`w-full mb-6 ${
                      pkg.popular 
                        ? 'bg-[#28376B] hover:bg-[#1e2a5a]' 
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}>
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
            <Button size="lg" className="bg-[#28376B] hover:bg-[#1e2a5a]">
              {t('pricing.contact.demo')}
            </Button>
            <Button size="lg" variant="outline" className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white">
              {t('pricing.contact.sales')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;