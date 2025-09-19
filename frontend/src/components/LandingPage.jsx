import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CheckCircle, BarChart3, Users, DollarSign, Shield, Cloud, Bell, Calculator, PieChart, FileText, Database, Zap, Globe, TrendingUp, Lock, HeadphonesIcon, Workflow, Building2, ClipboardList, CreditCard, Timer, Target, Award } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import LanguageSwitcher from './LanguageSwitcher';
import DataLifeLogo from './DataLifeLogo';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { language, isRTL } = useLanguage();

  const t = (key) => getTranslation(language, key);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Users className="h-8 w-8" />,
      title: t('features.items.hr.title'),
      description: t('features.items.hr.description')
    },
    {
      icon: <Calculator className="h-8 w-8" />,
      title: t('features.items.financial.title'),
      description: t('features.items.financial.description')
    },
    {
      icon: <PieChart className="h-8 w-8" />,
      title: t('features.items.production.title'),
      description: t('features.items.production.description')
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: t('features.items.cost.title'),
      description: t('features.items.cost.description')
    },
    {
      icon: <Building2 className="h-8 w-8" />,
      title: t('features.items.banking.title'),
      description: t('features.items.banking.description')
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: t('features.items.analytics.title'),
      description: t('features.items.analytics.description')
    }
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t('benefits.items.easeOfUse.title'),
      description: t('benefits.items.easeOfUse.description')
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: t('benefits.items.integration.title'),
      description: t('benefits.items.integration.description')
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t('benefits.items.security.title'),
      description: t('benefits.items.security.description')
    },
    {
      icon: <HeadphonesIcon className="h-6 w-6" />,
      title: t('benefits.items.support.title'),
      description: t('benefits.items.support.description')
    },
    {
      icon: <Cloud className="h-6 w-6" />,
      title: t('benefits.items.cloud.title'),
      description: t('benefits.items.cloud.description')
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: t('benefits.items.notifications.title'),
      description: t('benefits.items.notifications.description')
    }
  ];

  const modules = [
    {
      title: t('modules.items.customization.title'),
      features: t('modules.items.customization.features')
    },
    {
      title: t('modules.items.hr.title'),
      features: t('modules.items.hr.features')
    },
    {
      title: t('modules.items.financial.title'),
      features: t('modules.items.financial.features')
    },
    {
      title: t('modules.items.analytics.title'),
      features: t('modules.items.analytics.features')
    }
  ];

  const testimonials = t('testimonials.items');

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${isRTL ? 'rtl' : ''}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="pt-8">
              <DataLifeLogo size="default" />
            </div>
            <div className={`hidden md:flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-8`}>
              <a href="#features" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.features')}</a>
              <a href="#modules" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.modules')}</a>
              <a href="#pricing" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.pricing')}</a>
              <LanguageSwitcher />
              <Button className="bg-[#28376B] hover:bg-[#1e2a5a] text-white">
                {t('nav.getStarted')}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <Badge className="mb-6 bg-[#28376B]/10 text-[#28376B] border-[#28376B]/20">
              {t('hero.badge')}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              {t('hero.title')}
              <span className="block text-[#28376B]">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              {t('hero.description')}
            </p>
            <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-12 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <Button size="lg" className="bg-[#28376B] hover:bg-[#1e2a5a] text-white px-8 py-4 text-lg">
                {t('hero.startTrial')}
              </Button>
              <Button size="lg" variant="outline" className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white px-8 py-4 text-lg">
                {t('hero.watchDemo')}
              </Button>
            </div>
            <div className={`flex flex-wrap justify-center gap-8 text-sm text-gray-500 ${isRTL ? 'space-x-reverse' : ''}`}>
              <div className="flex items-center">
                <CheckCircle className={`h-4 w-4 text-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('hero.noSetupFees')}
              </div>
              <div className="flex items-center">
                <CheckCircle className={`h-4 w-4 text-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('hero.support247')}
              </div>
              <div className="flex items-center">
                <CheckCircle className={`h-4 w-4 text-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('hero.cloudBased')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {t('features.title')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
                <CardHeader>
                  <div className="w-12 h-12 bg-[#28376B]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#28376B] transition-colors duration-300">
                    <div className="text-[#28376B] group-hover:text-white transition-colors duration-300">
                      {feature.icon}
                    </div>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#28376B] to-[#1e2a5a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              {t('benefits.title')}
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              {t('benefits.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-white">{benefit.icon}</div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                <p className="text-blue-100 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {t('modules.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('modules.description')}
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            {modules.map((module, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6 shadow-sm">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-[#28376B] py-6">
                  {module.title}
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {module.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {t('testimonials.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('testimonials.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-6 leading-relaxed">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#28376B] to-[#1e2a5a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {t('cta.title')}
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            {t('cta.description')}
          </p>
          <div className={`flex flex-col sm:flex-row gap-4 justify-center ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <Button size="lg" className="bg-white text-[#28376B] hover:bg-gray-100 px-8 py-4 text-lg">
              {t('cta.startTrial')}
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-[#28376B] px-8 py-4 text-lg">
              {t('cta.contactSales')}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <DataLifeLogo size="small" className="mb-4" />
              <p className="text-gray-400">
                {t('footer.description')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.features')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.demo')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.support')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.documentation')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.contact')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.about')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.careers')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.privacy')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;