import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CheckCircle, BarChart3, Users, DollarSign, Shield, Cloud, Bell, Calculator, PieChart, FileText, Database, Zap, Globe, TrendingUp, Lock, HeadphonesIcon, Workflow, Building2, ClipboardList, CreditCard, Timer, Target, Award, MapPin, Phone, Mail, Play, X, HelpCircle, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import LanguageSwitcher from './LanguageSwitcher';
import DataLifeLogo from './DataLifeLogo';
import CompanyLogo from './CompanyLogo';
import PricingSection from './PricingSection';
import ContactSection from './ContactSection';
import FreeTrialModal from './FreeTrialModal';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

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
          <div className="flex justify-between items-center h-20">
            <div className="mt-1">
              <DataLifeLogo size="default" />
            </div>
            <div className={`hidden md:flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-8`}>
              <a href="#features" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.features')}</a>
              <a href="#modules" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.modules')}</a>
              <a href="#pricing" className="text-gray-600 hover:text-[#28376B] transition-colors">{t('nav.pricing')}</a>
              <button 
                onClick={() => navigate('/features')}
                className="text-[#28376B] font-semibold hover:text-[#1e2a5a] transition-colors flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                {language === 'ar' ? 'الدليل الشامل' : 'Full Guide'}
              </button>
              <LanguageSwitcher />
              <Button 
                onClick={() => navigate('/login')}
                variant="outline" 
                className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white"
              >
                {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
              </Button>
              <Button 
                onClick={() => setIsTrialModalOpen(true)}
                className="bg-[#28376B] hover:bg-[#1e2a5a] text-white"
              >
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
            <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-8 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <Button 
                size="lg" 
                className="bg-[#28376B] hover:bg-[#1e2a5a] text-white px-8 py-4 text-lg"
                onClick={() => setIsTrialModalOpen(true)}
              >
                {t('hero.startTrial')}
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white px-8 py-4 text-lg"
                onClick={() => navigate('/demo')}
              >
                {t('hero.watchDemo')}
              </Button>
            </div>
            
            {/* Video Button */}
            <div className="mb-12">
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="group inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-full hover:from-red-600 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="h-5 w-5 text-white fill-white" />
                </div>
                <span className="font-semibold">
                  {language === 'ar' ? 'شاهد الفيديو التعريفي' : 'Watch Introduction Video'}
                </span>
                <span className="text-white/80 text-sm">
                  {language === 'ar' ? '(3 دقائق)' : '(3 min)'}
                </span>
              </button>
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

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            
            {/* Video Container */}
            <div className="aspect-video bg-gradient-to-br from-[#28376B] to-[#1e2a5a] flex flex-col items-center justify-center text-white p-8">
              {/* Animated Play Icon */}
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                    <Play className="h-10 w-10 text-white fill-white ml-1" />
                  </div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold mb-4">
                {language === 'ar' ? 'فيديو تعريفي بنظام DataLife ERP' : 'DataLife ERP Introduction Video'}
              </h3>
              
              <div className="max-w-2xl text-center space-y-4 text-white/80">
                <p>
                  {language === 'ar' 
                    ? 'اكتشف كيف يمكن لنظام DataLife ERP أن يحول طريقة إدارة أعمالك'
                    : 'Discover how DataLife ERP can transform the way you manage your business'}
                </p>
                
                <div className="grid grid-cols-3 gap-4 mt-8">
                  {[
                    { icon: Users, label: language === 'ar' ? 'إدارة الموظفين' : 'HR Management' },
                    { icon: DollarSign, label: language === 'ar' ? 'المحاسبة المالية' : 'Financial Accounting' },
                    { icon: BarChart3, label: language === 'ar' ? 'التقارير الذكية' : 'Smart Reports' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-xl">
                      <item.icon className="h-8 w-8" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-8 flex gap-4">
                <Button
                  onClick={() => {
                    setIsVideoModalOpen(false);
                    setIsTrialModalOpen(true);
                  }}
                  className="bg-white text-[#28376B] hover:bg-gray-100"
                >
                  {language === 'ar' ? 'ابدأ تجربتك المجانية' : 'Start Free Trial'}
                </Button>
                <Button
                  onClick={() => {
                    setIsVideoModalOpen(false);
                    navigate('/features');
                  }}
                  variant="outline"
                  className="border-white text-white hover:bg-white/20"
                >
                  {language === 'ar' ? 'اكتشف المميزات' : 'Explore Features'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Section */}
      <section className="py-12 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '27+', label: language === 'ar' ? 'شركة مسجلة' : 'Registered Companies', icon: Building2 },
              { value: '68+', label: language === 'ar' ? 'مستخدم نشط' : 'Active Users', icon: Users },
              { value: '10', label: language === 'ar' ? 'وحدات متكاملة' : 'Integrated Modules', icon: Database },
              { value: '24/7', label: language === 'ar' ? 'دعم فني' : 'Technical Support', icon: HeadphonesIcon },
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="w-12 h-12 bg-[#28376B]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="h-6 w-6 text-[#28376B]" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-[#28376B] mb-1">{stat.value}</div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </div>
            ))}
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

      {/* NEW: Advanced Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-amber-500 text-white mb-4">
              {language === 'ar' ? 'جديد' : 'NEW'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {language === 'ar' ? 'المميزات الاحترافية الجديدة' : 'New Professional Features'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {language === 'ar' 
                ? 'تحديثات جديدة تجعل إدارة أعمالك أسهل وأكثر احترافية'
                : 'New updates that make managing your business easier and more professional'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Permissions System */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-purple-500 to-violet-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'نظام الصلاحيات المتقدم' : 'Advanced Permissions System'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? '10 صلاحيات قابلة للتخصيص' : '10 customizable permissions',
                    language === 'ar' ? 'تحكم كامل لكل مستخدم' : 'Full control for each user',
                    language === 'ar' ? 'ألوان مميزة (أخضر/أحمر)' : 'Color indicators (green/red)',
                    language === 'ar' ? 'صلاحية Dashboard إلزامية' : 'Dashboard permission required'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Admin Panel */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'لوحة تحكم المسؤول' : 'Super Admin Panel'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'إدارة جميع الشركات' : 'Manage all companies',
                    language === 'ar' ? 'تعطيل/تفعيل المستخدمين' : 'Enable/disable users',
                    language === 'ar' ? 'إرسال الإشعارات' : 'Send notifications',
                    language === 'ar' ? 'إنشاء أكواد الاشتراك' : 'Generate subscription codes'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Subscription Code */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                  <CreditCard className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'كود الاشتراك الفريد' : 'Unique Subscription Code'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'يظهر بعد تسجيل الدخول' : 'Appears after login',
                    language === 'ar' ? 'متاح في الشريط الجانبي' : 'Available in sidebar',
                    language === 'ar' ? 'صفحة إعدادات مخصصة' : 'Dedicated settings page',
                    language === 'ar' ? 'نسخ بضغطة واحدة' : 'One-click copy'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Print & Export */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'الطباعة والتصدير' : 'Print & Export'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'طباعة احترافية بدون القوائم' : 'Professional print without menus',
                    language === 'ar' ? 'تصدير PDF عالي الجودة' : 'High-quality PDF export',
                    language === 'ar' ? 'تصدير CSV للتحليل' : 'CSV export for analysis',
                    language === 'ar' ? 'متاح في جميع الوحدات' : 'Available in all modules'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Modern Sidebar */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-pink-500 to-rose-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center mb-4">
                  <Workflow className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'واجهة مستخدم حديثة' : 'Modern User Interface'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'شريط جانبي عصري' : 'Modern sidebar design',
                    language === 'ar' ? 'أيقونات صلاحيات ملونة' : 'Colored permission icons',
                    language === 'ar' ? 'تنقل سلس وسريع' : 'Smooth navigation',
                    language === 'ar' ? 'دعم كامل للعربية RTL' : 'Full Arabic RTL support'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Settings Page */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <Database className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'إعدادات شاملة' : 'Comprehensive Settings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'إعدادات الشركة' : 'Company settings',
                    language === 'ar' ? 'الملف الشخصي' : 'Profile management',
                    language === 'ar' ? 'تفاصيل الاشتراك' : 'Subscription details',
                    language === 'ar' ? 'قائمة الصلاحيات' : 'Permissions list'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <Button 
              onClick={() => navigate('/features')}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8 py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <FileText className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'ar' ? 'اكتشف الدليل الشامل' : 'Explore Full Guide'}
            </Button>
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

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* Contact Section */}
      <ContactSection />

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
            <Button 
              size="lg" 
              className="bg-white text-[#28376B] hover:bg-gray-100 px-8 py-4 text-lg"
              onClick={() => setIsTrialModalOpen(true)}
            >
              {t('cta.startTrial')}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-[#28376B] px-8 py-4 text-lg"
              onClick={() => window.open(`tel:${t('contact.phone').replace(/\s/g, '')}`, '_self')}
            >
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
              <p className="text-gray-400 mb-4">
                {t('footer.description')}
              </p>
              <div className="space-y-2 text-sm text-gray-400">
                <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2`}>
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{t('contact.address')}</span>
                </div>
                <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2`}>
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <a href={`tel:${t('contact.phone').replace(/\s/g, '')}`} className="hover:text-white transition-colors">
                    {t('contact.phone')}
                  </a>
                </div>
                <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2`}>
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <a href={`mailto:${t('contact.email')}`} className="hover:text-white transition-colors">
                    {t('contact.email')}
                  </a>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.features')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/demo')}>{t('footer.demo')}</a></li>
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
          <div className="border-t border-gray-800 mt-8 pt-8">
            {/* Company Logo Section */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-gray-400 text-sm mb-3">
                {language === 'ar' ? 'تم التطوير بواسطة' : 'Developed by'}
              </p>
              <CompanyLogo size="large" />
            </div>
            
            {/* Copyright */}
            <div className="text-center text-gray-400">
              <p>{t('footer.copyright')}</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Free Trial Modal */}
      <FreeTrialModal
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
      />
    </div>
  );
};

export default LandingPage;