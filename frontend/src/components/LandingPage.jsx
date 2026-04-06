import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CheckCircle, BarChart3, Users, DollarSign, Shield, Cloud, Bell, Calculator, PieChart, FileText, Database, Zap, Globe, TrendingUp, Lock, HeadphonesIcon, Workflow, Building2, ClipboardList, CreditCard, Timer, Target, Award, MapPin, Phone, Mail, Play, X, HelpCircle, ChevronDown, Search, Loader2, BookOpen, Key, UserCheck, Settings, FolderKanban, Package } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';
import LanguageSwitcher from './LanguageSwitcher';
import DataLifeLogo from './DataLifeLogo';
import CompanyLogo from './CompanyLogo';
import PricingSection from './PricingSection';
import ContactSection from './ContactSection';
import FreeTrialModal from './FreeTrialModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');
  const [heroSearchQuery, setHeroSearchQuery] = useState('');
  const [showHeroSearchResults, setShowHeroSearchResults] = useState(false);
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  const t = (key) => getTranslation(language, key);

  // Handle contact form submission
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError(language === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    
    setContactLoading(true);
    setContactError('');
    
    try {
      const response = await axios.post(`${API_URL}/api/contact/send`, contactForm);
      if (response.data.success) {
        setContactSuccess(true);
        setContactForm({ name: '', email: '', message: '' });
        setTimeout(() => setContactSuccess(false), 5000);
      }
    } catch (error) {
      setContactError(language === 'ar' ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'An error occurred, please try again');
    } finally {
      setContactLoading(false);
    }
  };

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

  // Search data for hero section
  const heroSearchData = useMemo(() => {
    const items = [];
    
    // Add features
    features.forEach((feature) => {
      items.push({
        type: 'feature',
        title: feature.title,
        description: feature.description,
        icon: feature.icon,
        section: 'features',
        color: 'from-blue-500 to-indigo-600'
      });
    });
    
    // Add modules
    modules.forEach((module) => {
      items.push({
        type: 'module',
        title: module.title,
        description: Array.isArray(module.features) ? module.features.join(' • ') : module.features,
        icon: <Workflow className="h-8 w-8" />,
        section: 'modules',
        color: 'from-purple-500 to-violet-600'
      });
    });
    
    // Add benefits
    benefits.forEach((benefit) => {
      items.push({
        type: 'benefit',
        title: benefit.title,
        description: benefit.description,
        icon: benefit.icon,
        section: 'benefits',
        color: 'from-green-500 to-emerald-600'
      });
    });
    
    // Add new features (Banking, Notifications, Admin Dashboard)
    items.push({
      type: 'new',
      title: language === 'ar' ? 'إدارة البنوك والخزينة' : 'Bank & Treasury Management',
      description: language === 'ar' ? 'حسابات بنكية متعددة • قيود تلقائية • ترحيل فوري' : 'Multiple bank accounts • Auto journal entries • Auto-posting',
      icon: <CreditCard className="h-8 w-8" />,
      section: 'features',
      color: 'from-teal-500 to-cyan-600',
      isNew: true
    });
    
    items.push({
      type: 'new',
      title: language === 'ar' ? 'نظام الإشعارات الذكية' : 'Smart Notification System',
      description: language === 'ar' ? 'إشعارات البريد • تنبيهات المعاملات • انتهاء العقود' : 'Email notifications • Transaction alerts • Contract expiry',
      icon: <Bell className="h-8 w-8" />,
      section: 'features',
      color: 'from-yellow-500 to-orange-500',
      isNew: true
    });
    
    items.push({
      type: 'new',
      title: language === 'ar' ? 'لوحة التحكم الإدارية المتقدمة' : 'Advanced Admin Dashboard',
      description: language === 'ar' ? 'إحصائيات • رسوم بيانية • تحليلات متقدمة' : 'Statistics • Charts • Advanced analytics',
      icon: <BarChart3 className="h-8 w-8" />,
      section: 'features',
      color: 'from-indigo-500 to-blue-600',
      isNew: true
    });
    
    return items;
  }, [features, modules, benefits, language]);

  // Filter hero search results
  const heroSearchResults = useMemo(() => {
    if (!heroSearchQuery.trim()) return [];
    
    const query = heroSearchQuery.toLowerCase();
    return heroSearchData.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(query);
      const descMatch = item.description?.toLowerCase().includes(query);
      return titleMatch || descMatch;
    }).slice(0, 8);
  }, [heroSearchQuery, heroSearchData]);

  // Handle hero search result click
  const handleHeroResultClick = (section) => {
    setHeroSearchQuery('');
    setShowHeroSearchResults(false);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
                onClick={() => navigate('/admin-login')}
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-[#28376B] hover:bg-[#28376B]/10"
                title={language === 'ar' ? 'دخول المدير' : 'Admin Login'}
              >
                <Shield className="h-5 w-5" />
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

            {/* Smart Search Bar */}
            <div className="max-w-2xl mx-auto mb-8 relative">
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} h-5 w-5 text-gray-400`} />
                <Input
                  type="text"
                  placeholder={language === 'ar' ? 'ابحث عن أي ميزة... (البنوك، الإشعارات، التحليلات...)' : 'Search for any feature... (Banking, Notifications, Analytics...)'}
                  value={heroSearchQuery}
                  onChange={(e) => {
                    setHeroSearchQuery(e.target.value);
                    setShowHeroSearchResults(e.target.value.length > 0);
                  }}
                  onFocus={() => heroSearchQuery && setShowHeroSearchResults(true)}
                  className={`w-full ${isRTL ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-6 text-lg rounded-2xl bg-white border-2 border-gray-200 shadow-lg focus:ring-2 focus:ring-[#28376B] focus:border-[#28376B] transition-all`}
                />
                {heroSearchQuery && (
                  <button
                    onClick={() => {
                      setHeroSearchQuery('');
                      setShowHeroSearchResults(false);
                    }}
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} p-1 hover:bg-gray-100 rounded-full transition-colors`}
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showHeroSearchResults && heroSearchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-96 overflow-y-auto">
                  <div className={`p-3 bg-gray-50 border-b text-${isRTL ? 'right' : 'left'}`}>
                    <span className="text-sm text-gray-500">
                      {language === 'ar' ? `${heroSearchResults.length} نتيجة` : `${heroSearchResults.length} results`}
                    </span>
                  </div>
                  {heroSearchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHeroResultClick(result.section)}
                      className={`w-full p-4 hover:bg-blue-50 transition-colors border-b border-gray-50 text-${isRTL ? 'right' : 'left'} flex items-start gap-3`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${result.color} flex items-center justify-center flex-shrink-0 text-white`}>
                        {React.cloneElement(result.icon, { className: 'h-5 w-5' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">{result.title}</h4>
                          {result.isNew && (
                            <Badge className="bg-green-500 text-white text-xs">
                              {language === 'ar' ? 'جديد' : 'New'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {result.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* No Results */}
              {showHeroSearchResults && heroSearchQuery && heroSearchResults.length === 0 && (
                <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 text-center z-50">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {language === 'ar' ? 'لا توجد نتائج لـ' : 'No results for'} "{heroSearchQuery}"
                  </p>
                  <button
                    onClick={() => navigate('/features')}
                    className="mt-4 text-[#28376B] font-semibold hover:underline"
                  >
                    {language === 'ar' ? 'استكشف الدليل الشامل' : 'Explore Full Guide'}
                  </button>
                </div>
              )}
            </div>

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
            
            {/* Guide Button */}
            <div className="mb-12">
              <button
                onClick={() => setIsGuideModalOpen(true)}
                className="group inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold">
                  {language === 'ar' ? 'الدليل الشامل للبرنامج' : 'Complete Program Guide'}
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

      {/* Comprehensive Guide Modal */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl overflow-hidden shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setIsGuideModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-[#28376B] to-[#1e2a5a] text-white p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <BookOpen className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">
                    {language === 'ar' ? 'الدليل الشامل للبرنامج' : 'Complete Program Guide'}
                  </h2>
                  <p className="text-white/80">
                    {language === 'ar' ? 'كل ما تحتاج معرفته عن DataLife ERP' : 'Everything you need to know about DataLife ERP'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-8">
              
              {/* Overview Section */}
              <section>
                <h3 className="text-2xl font-bold text-[#28376B] mb-4 flex items-center gap-2">
                  <Globe className="h-6 w-6" />
                  {language === 'ar' ? 'نظرة عامة' : 'Overview'}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {language === 'ar' 
                    ? 'DataLife Account هو نظام ERP (تخطيط موارد المؤسسات) متكامل ومتعدد المستأجرين مصمم للشركات العربية. يوفر النظام إدارة شاملة للموارد البشرية، المالية، المشتريات، الفواتير، المشاريع، والتحليلات مع دعم كامل للغة العربية والإنجليزية.'
                    : 'DataLife Account is a comprehensive multi-tenant ERP (Enterprise Resource Planning) system designed for businesses. It provides complete management of Human Resources, Finance, Purchases, Invoices, Projects, and Analytics with full support for Arabic and English languages.'}
                </p>
              </section>

              {/* Key Features */}
              <section>
                <h3 className="text-2xl font-bold text-[#28376B] mb-4 flex items-center gap-2">
                  <Zap className="h-6 w-6" />
                  {language === 'ar' ? 'المميزات الرئيسية' : 'Key Features'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: Users, title: language === 'ar' ? 'دخول متعدد المستخدمين' : 'Multi-user Login', desc: language === 'ar' ? 'دخول متزامن لموظفي نفس الشركة' : 'Concurrent login for same company employees' },
                    { icon: Key, title: language === 'ar' ? 'كود اشتراك فريد' : 'Unique Subscription Code', desc: language === 'ar' ? 'كل شركة لها كود خاص' : 'Each company has its own code' },
                    { icon: Shield, title: language === 'ar' ? 'صلاحيات متقدمة' : 'Advanced Permissions', desc: language === 'ar' ? '10 صلاحيات و9 أدوار وظيفية' : '10 permissions and 9 job roles' },
                    { icon: Globe, title: language === 'ar' ? 'ثنائي اللغة' : 'Bilingual', desc: language === 'ar' ? 'دعم كامل للعربية والإنجليزية' : 'Full Arabic and English support' },
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-[#28376B]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-5 w-5 text-[#28376B]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">{feature.title}</h4>
                        <p className="text-sm text-gray-600">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Available Modules */}
              <section>
                <h3 className="text-2xl font-bold text-[#28376B] mb-4 flex items-center gap-2">
                  <FolderKanban className="h-6 w-6" />
                  {language === 'ar' ? 'الوحدات المتاحة (10 وحدات)' : 'Available Modules (10 Modules)'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', icon: BarChart3 },
                    { name: language === 'ar' ? 'الموارد البشرية' : 'HR', icon: Users },
                    { name: language === 'ar' ? 'المالية' : 'Financial', icon: DollarSign },
                    { name: language === 'ar' ? 'الفواتير' : 'Invoices', icon: FileText },
                    { name: language === 'ar' ? 'المشتريات' : 'Purchases', icon: CreditCard },
                    { name: language === 'ar' ? 'المشاريع' : 'Projects', icon: FolderKanban },
                    { name: language === 'ar' ? 'التقارير' : 'Reports', icon: ClipboardList },
                    { name: language === 'ar' ? 'التحليلات' : 'Analytics', icon: PieChart },
                    { name: language === 'ar' ? 'المخزون' : 'Inventory', icon: Package },
                    { name: language === 'ar' ? 'الموافقات' : 'Approvals', icon: CheckCircle },
                  ].map((module, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                      <module.icon className="h-6 w-6 text-green-600" />
                      <span className="text-sm font-medium text-green-700">{module.name}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Roles */}
              <section>
                <h3 className="text-2xl font-bold text-[#28376B] mb-4 flex items-center gap-2">
                  <UserCheck className="h-6 w-6" />
                  {language === 'ar' ? 'الأدوار الوظيفية (9 أدوار)' : 'Job Roles (9 Roles)'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Top Management */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <h4 className="font-bold text-purple-700 mb-3">{language === 'ar' ? 'الإدارة العليا' : 'Top Management'}</h4>
                    <ul className="space-y-2 text-sm text-purple-600">
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'رئيس مجلس الإدارة' : 'Board Chairman'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'المدير العام' : 'General Manager'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'المدير التنفيذي' : 'CEO'}</li>
                    </ul>
                  </div>
                  {/* Middle Management */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h4 className="font-bold text-blue-700 mb-3">{language === 'ar' ? 'الإدارة الوسطى' : 'Middle Management'}</h4>
                    <ul className="space-y-2 text-sm text-blue-600">
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'المدير المالي' : 'Finance Director'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'رئيس الحسابات' : 'Chief Accountant'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'مدير المشاريع' : 'Project Manager'}</li>
                    </ul>
                  </div>
                  {/* Staff */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <h4 className="font-bold text-gray-700 mb-3">{language === 'ar' ? 'الموظفين' : 'Staff'}</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'محاسب' : 'Accountant'}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {language === 'ar' ? 'موظف' : 'Employee'}</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* How to Use */}
              <section>
                <h3 className="text-2xl font-bold text-[#28376B] mb-4 flex items-center gap-2">
                  <Settings className="h-6 w-6" />
                  {language === 'ar' ? 'كيفية الاستخدام' : 'How to Use'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <h4 className="font-bold text-blue-700 mb-2">{language === 'ar' ? 'تسجيل الدخول' : 'Login'}</h4>
                    <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
                      <li>{language === 'ar' ? 'أدخل البريد الإلكتروني وكلمة المرور' : 'Enter email and password'}</li>
                      <li>{language === 'ar' ? 'اضغط "دخول"' : 'Click "Login"'}</li>
                      <li>{language === 'ar' ? 'اضغط "Continue to Application"' : 'Click "Continue to Application"'}</li>
                    </ol>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <h4 className="font-bold text-green-700 mb-2">{language === 'ar' ? 'إضافة موظف' : 'Add Employee'}</h4>
                    <ol className="text-sm text-green-600 space-y-1 list-decimal list-inside">
                      <li>{language === 'ar' ? 'اذهب إلى الإعدادات > الموظفين' : 'Go to Settings > Employees'}</li>
                      <li>{language === 'ar' ? 'اضغط "دعوة موظف جديد"' : 'Click "Invite Employee"'}</li>
                      <li>{language === 'ar' ? 'أدخل البيانات والصلاحيات' : 'Enter details and permissions'}</li>
                    </ol>
                  </div>
                </div>
              </section>

            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 p-6 flex flex-wrap justify-center gap-4">
              <Button
                onClick={() => {
                  setIsGuideModalOpen(false);
                  navigate('/login');
                }}
                className="bg-[#28376B] hover:bg-[#1e2a5a]"
              >
                {language === 'ar' ? 'تسجيل الدخول' : 'Login Now'}
              </Button>
              <Button
                onClick={() => {
                  setIsGuideModalOpen(false);
                  setIsTrialModalOpen(true);
                }}
                variant="outline"
                className="border-[#28376B] text-[#28376B]"
              >
                {language === 'ar' ? 'ابدأ تجربتك المجانية' : 'Start Free Trial'}
              </Button>
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
                    language === 'ar' ? '13 صلاحية قابلة للتخصيص' : '13 customizable permissions',
                    language === 'ar' ? 'HR مقسم إلى إداري ومالي' : 'HR split into Admin & Financial',
                    language === 'ar' ? 'صلاحيات حسب الدور الوظيفي' : 'Role-based access control',
                    language === 'ar' ? 'صفحة إعدادات صلاحيات مخصصة' : 'Dedicated permissions settings page'
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

            {/* HR Split - NEW */}
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-cyan-500 to-teal-600" />
              <CardHeader>
                <Badge className="w-fit mb-2 bg-cyan-100 text-cyan-700 border-0">
                  {language === 'ar' ? 'جديد' : 'NEW'}
                </Badge>
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-xl">
                  {language === 'ar' ? 'تقسيم الموارد البشرية' : 'HR Module Split'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    language === 'ar' ? 'قسم إداري: حضور، إجازات، ورديات' : 'Admin: Attendance, Leaves, Shifts',
                    language === 'ar' ? 'قسم مالي: رواتب، بدلات، خصومات' : 'Financial: Payroll, Allowances, Deductions',
                    language === 'ar' ? 'مدير HR يرى الإداري فقط' : 'HR Manager sees Admin only',
                    language === 'ar' ? 'المدير المالي يرى الكل' : 'Finance Manager sees all'
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

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#28376B]/10 text-[#28376B] border-[#28376B]/20">
              {language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {language === 'ar' ? 'الأسئلة الأكثر شيوعاً' : 'Frequently Asked Questions'}
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              {language === 'ar' 
                ? 'إجابات على الأسئلة الشائعة حول نظام DataLife ERP'
                : 'Answers to common questions about DataLife ERP system'}
            </p>
            
            {/* Search Box */}
            <div className="max-w-xl mx-auto relative">
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} />
                <input
                  type="text"
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحث في الأسئلة الشائعة...' : 'Search FAQ...'}
                  className={`w-full py-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28376B]/20 focus:border-[#28376B] transition-all text-gray-700`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                {faqSearchQuery && (
                  <button
                    onClick={() => setFaqSearchQuery('')}
                    className={`absolute top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors ${isRTL ? 'left-3' : 'right-3'}`}
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {(() => {
            const faqData = language === 'ar' ? [
              {
                q: 'ما هو نظام DataLife ERP؟',
                a: 'DataLife ERP هو نظام متكامل لإدارة موارد المؤسسات، يشمل إدارة الموارد البشرية، المحاسبة المالية، إدارة المشاريع، الفواتير، والمشتريات. مصمم خصيصاً للشركات العربية مع دعم كامل للغة العربية والإنجليزية.'
              },
              {
                q: 'هل يمكنني تجربة النظام قبل الشراء؟',
                a: 'نعم! نوفر فترة تجريبية مجانية لمدة 14 يوماً يمكنك خلالها تجربة جميع مميزات النظام. لا تحتاج لإدخال بيانات بطاقة ائتمان للبدء.'
              },
              {
                q: 'كيف يتم تخزين البيانات وهل هي آمنة؟',
                a: 'نستخدم تقنية السحابة مع تشفير SSL/TLS لجميع الاتصالات. بياناتك مخزنة على خوادم MongoDB Atlas المؤمنة مع نسخ احتياطي يومي تلقائي. كل شركة لديها بيانات منفصلة تماماً.'
              },
              {
                q: 'هل يمكنني إضافة مستخدمين متعددين؟',
                a: 'نعم، يمكنك إضافة عدد غير محدود من المستخدمين (حسب الباقة المختارة) وتحديد صلاحيات مخصصة لكل مستخدم. يدعم النظام 10 أنواع مختلفة من الصلاحيات.'
              },
              {
                q: 'هل يدعم النظام اللغة العربية؟',
                a: 'نعم، النظام مصمم خصيصاً لدعم اللغة العربية والإنجليزية مع واجهة RTL كاملة. يمكنك التبديل بين اللغتين بسهولة من أي صفحة.'
              },
              {
                q: 'كيف يمكنني الحصول على الدعم الفني؟',
                a: 'نوفر دعم فني على مدار الساعة عبر البريد الإلكتروني والهاتف. كما يتوفر دليل شامل للمستخدم ومقاطع فيديو تعليمية داخل النظام.'
              },
              {
                q: 'هل يمكنني تصدير البيانات والتقارير؟',
                a: 'نعم، يمكنك تصدير جميع التقارير بصيغة PDF للأرشفة أو CSV للتحليل في Excel. كما يمكنك طباعة التقارير مباشرة بتنسيق احترافي.'
              },
              {
                q: 'ما هي طرق الدفع المتاحة؟',
                a: 'نقبل الدفع عبر البطاقات الائتمانية (Visa, MasterCard)، التحويل البنكي، وبعض المحافظ الإلكترونية. جميع المعاملات مشفرة وآمنة.'
              }
            ] : [
              {
                q: 'What is DataLife ERP?',
                a: 'DataLife ERP is a comprehensive enterprise resource management system that includes HR management, financial accounting, project management, invoicing, and purchases. It is designed specifically for businesses with full support for Arabic and English languages.'
              },
              {
                q: 'Can I try the system before purchasing?',
                a: 'Yes! We offer a free 14-day trial period during which you can test all system features. No credit card required to get started.'
              },
              {
                q: 'How is data stored and is it secure?',
                a: 'We use cloud technology with SSL/TLS encryption for all connections. Your data is stored on secure MongoDB Atlas servers with automatic daily backups. Each company has completely separate data.'
              },
              {
                q: 'Can I add multiple users?',
                a: 'Yes, you can add unlimited users (depending on your plan) and set custom permissions for each user. The system supports 10 different permission types.'
              },
              {
                q: 'Does the system support Arabic?',
                a: 'Yes, the system is specifically designed to support Arabic and English with a full RTL interface. You can easily switch between languages from any page.'
              },
              {
                q: 'How can I get technical support?',
                a: 'We provide 24/7 technical support via email and phone. A comprehensive user guide and tutorial videos are also available within the system.'
              },
              {
                q: 'Can I export data and reports?',
                a: 'Yes, you can export all reports in PDF format for archiving or CSV for Excel analysis. You can also print reports directly in a professional format.'
              },
              {
                q: 'What payment methods are available?',
                a: 'We accept payment via credit cards (Visa, MasterCard), bank transfer, and some e-wallets. All transactions are encrypted and secure.'
              }
            ];
            
            const filteredFaqs = faqSearchQuery.trim() 
              ? faqData.filter(faq => 
                  faq.q.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
                  faq.a.toLowerCase().includes(faqSearchQuery.toLowerCase())
                )
              : faqData;
            
            return (
              <>
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">
                      {language === 'ar' 
                        ? 'لم يتم العثور على نتائج. جرب كلمات بحث مختلفة.'
                        : 'No results found. Try different search terms.'}
                    </p>
                    <Button 
                      variant="link" 
                      onClick={() => setFaqSearchQuery('')}
                      className="mt-2 text-[#28376B]"
                    >
                      {language === 'ar' ? 'مسح البحث' : 'Clear search'}
                    </Button>
                  </div>
                ) : (
                  <>
                    {faqSearchQuery && (
                      <p className="text-sm text-gray-500 mb-4 text-center">
                        {language === 'ar' 
                          ? `تم العثور على ${filteredFaqs.length} نتيجة`
                          : `Found ${filteredFaqs.length} result${filteredFaqs.length !== 1 ? 's' : ''}`}
                      </p>
                    )}
                    <Accordion type="single" collapsible className="space-y-4">
                      {filteredFaqs.map((faq, index) => (
                        <AccordionItem 
                          key={index} 
                          value={`faq-${index}`} 
                          className="bg-white border rounded-xl px-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-[#28376B] py-5">
                            <div className="flex items-center gap-3 text-start">
                              <div className="w-8 h-8 bg-[#28376B]/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <HelpCircle className="h-4 w-4 text-[#28376B]" />
                              </div>
                              <span>{faq.q}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-5 text-gray-600 leading-relaxed">
                            <div className={`${isRTL ? 'pr-11' : 'pl-11'}`}>
                              {faq.a}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </>
                )}
              </>
            );
          })()}

          {/* Contact CTA */}
          <div className="mt-12 text-center p-8 bg-gradient-to-r from-[#28376B] to-[#1e2a5a] rounded-2xl text-white">
            <h3 className="text-xl font-bold mb-3">
              {language === 'ar' ? 'لم تجد إجابة لسؤالك؟' : "Didn't find your answer?"}
            </h3>
            <p className="text-blue-100 mb-6">
              {language === 'ar' 
                ? 'فريق الدعم الفني جاهز لمساعدتك على مدار الساعة'
                : 'Our support team is ready to help you 24/7'}
            </p>
            <Button 
              variant="secondary"
              className="bg-white text-[#28376B] hover:bg-gray-100"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Mail className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* Contact Section */}
      <ContactSection />

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#28376B]/10 text-[#28376B]">
              {language === 'ar' ? 'من نحن' : 'About Us'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'شريكك في التحول الرقمي' : 'Your Digital Transformation Partner'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {language === 'ar' 
                ? 'نحن شركة رائدة في تطوير حلول إدارة الأعمال المتكاملة، نساعد الشركات على التحول الرقمي وتحقيق أقصى كفاءة تشغيلية.'
                : 'We are a leading company in developing integrated business management solutions, helping businesses achieve digital transformation and maximum operational efficiency.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center p-6 border-2 hover:border-[#28376B]/50 transition-all">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-[#28376B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-[#28376B]" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {language === 'ar' ? 'رؤيتنا' : 'Our Vision'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'أن نكون الخيار الأول للشركات في المنطقة العربية لحلول إدارة الأعمال الذكية.'
                    : 'To be the first choice for companies in the Arab region for smart business management solutions.'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center p-6 border-2 hover:border-[#28376B]/50 transition-all">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {language === 'ar' ? 'مهمتنا' : 'Our Mission'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'تمكين الشركات من إدارة عملياتها بكفاءة عالية من خلال تقنيات حديثة وسهلة الاستخدام.'
                    : 'Empowering companies to manage their operations efficiently through modern and easy-to-use technologies.'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center p-6 border-2 hover:border-[#28376B]/50 transition-all">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {language === 'ar' ? 'إنجازاتنا' : 'Our Achievements'}
                </h3>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? '+500 شركة تستخدم حلولنا، +10,000 مستخدم نشط، +5 سنوات خبرة في السوق.'
                    : '500+ companies use our solutions, 10,000+ active users, 5+ years of market experience.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="documentation" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700">
              {language === 'ar' ? 'التوثيق والدعم' : 'Documentation & Support'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'كل ما تحتاجه للبدء' : 'Everything You Need to Get Started'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {language === 'ar' 
                ? 'وثائق شاملة، دروس تعليمية، ودعم فني متواصل لمساعدتك في كل خطوة.'
                : 'Comprehensive documentation, tutorials, and continuous technical support to help you every step of the way.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate('/features')}>
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  {language === 'ar' ? 'دليل المستخدم' : 'User Guide'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {language === 'ar' ? 'شرح تفصيلي لجميع المميزات' : 'Detailed explanation of all features'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-all cursor-pointer group">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Play className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  {language === 'ar' ? 'فيديوهات تعليمية' : 'Video Tutorials'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {language === 'ar' ? 'تعلم بسهولة من خلال الفيديو' : 'Learn easily through video'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-all cursor-pointer group">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Database className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  {language === 'ar' ? 'API للمطورين' : 'Developer API'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {language === 'ar' ? 'وثائق API للتكامل' : 'API documentation for integration'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-all cursor-pointer group">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Workflow className="h-7 w-7 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  {language === 'ar' ? 'سيناريوهات العمل' : 'Workflows'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {language === 'ar' ? 'أمثلة عملية للاستخدام' : 'Practical usage examples'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Help Center Section */}
      <section id="help-center" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-green-100 text-green-700">
                {language === 'ar' ? 'مركز المساعدة' : 'Help Center'}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {language === 'ar' ? 'نحن هنا لمساعدتك' : 'We Are Here to Help'}
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                {language === 'ar' 
                  ? 'فريق الدعم الفني متاح على مدار الساعة للإجابة على استفساراتك وحل مشاكلك.'
                  : 'Our technical support team is available 24/7 to answer your questions and solve your problems.'}
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <HeadphonesIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{language === 'ar' ? 'دعم فني مباشر' : 'Live Support'}</h4>
                    <p className="text-gray-600 text-sm">
                      {language === 'ar' ? 'تحدث مع فريقنا مباشرة عبر الدردشة' : 'Chat directly with our team'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{language === 'ar' ? 'بريد الدعم' : 'Support Email'}</h4>
                    <p className="text-gray-600 text-sm">support@datalife.com</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{language === 'ar' ? 'خط المساعدة' : 'Help Line'}</h4>
                    <p className="text-gray-600 text-sm">{t('contact.phone')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-[#28376B] to-[#1e2a5a] rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">
                {language === 'ar' ? 'أرسل استفسارك' : 'Send Your Inquiry'}
              </h3>
              
              {contactSuccess && (
                <div className="mb-4 p-4 bg-green-500/20 border border-green-400 rounded-xl flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span>{language === 'ar' ? 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.' : 'Your message was sent successfully! We will contact you soon.'}</span>
                </div>
              )}
              
              {contactError && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-400 rounded-xl">
                  <span>{contactError}</span>
                </div>
              )}
              
              <form className="space-y-4" onSubmit={handleContactSubmit}>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                  placeholder={language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/50"
                  data-testid="contact-name-input"
                />
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/50"
                  data-testid="contact-email-input"
                />
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                  placeholder={language === 'ar' ? 'رسالتك...' : 'Your message...'}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/50 resize-none"
                  data-testid="contact-message-input"
                />
                <Button 
                  type="submit"
                  disabled={contactLoading}
                  className="w-full bg-white text-[#28376B] hover:bg-gray-100 h-12 font-semibold disabled:opacity-50"
                  data-testid="contact-submit-btn"
                >
                  {contactLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}
                    </>
                  ) : (
                    language === 'ar' ? 'إرسال' : 'Send Message'
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section id="careers" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700">
              {language === 'ar' ? 'الوظائف' : 'Careers'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'انضم إلى فريقنا' : 'Join Our Team'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {language === 'ar' 
                ? 'نبحث دائماً عن مواهب متميزة للانضمام إلى فريقنا وبناء مستقبل التقنية معاً.'
                : 'We are always looking for exceptional talents to join our team and build the future of technology together.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-all border-2 hover:border-purple-300">
              <CardHeader>
                <Badge className="w-fit mb-2 bg-green-100 text-green-700">
                  {language === 'ar' ? 'متاح' : 'Open'}
                </Badge>
                <CardTitle>{language === 'ar' ? 'مطور Full Stack' : 'Full Stack Developer'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'القاهرة - دوام كامل' : 'Cairo - Full Time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  {language === 'ar' 
                    ? 'نبحث عن مطور متمرس في React و Python لتطوير منتجاتنا.'
                    : 'Looking for an experienced developer in React and Python to develop our products.'}
                </p>
                <Button variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50">
                  {language === 'ar' ? 'تقدم الآن' : 'Apply Now'}
                </Button>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-all border-2 hover:border-purple-300">
              <CardHeader>
                <Badge className="w-fit mb-2 bg-green-100 text-green-700">
                  {language === 'ar' ? 'متاح' : 'Open'}
                </Badge>
                <CardTitle>{language === 'ar' ? 'مصمم UI/UX' : 'UI/UX Designer'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'عن بُعد - دوام كامل' : 'Remote - Full Time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  {language === 'ar' 
                    ? 'نبحث عن مصمم مبدع لتحسين تجربة المستخدم في منتجاتنا.'
                    : 'Looking for a creative designer to improve user experience in our products.'}
                </p>
                <Button variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50">
                  {language === 'ar' ? 'تقدم الآن' : 'Apply Now'}
                </Button>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-all border-2 hover:border-purple-300">
              <CardHeader>
                <Badge className="w-fit mb-2 bg-green-100 text-green-700">
                  {language === 'ar' ? 'متاح' : 'Open'}
                </Badge>
                <CardTitle>{language === 'ar' ? 'مدير مبيعات' : 'Sales Manager'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'الرياض - دوام كامل' : 'Riyadh - Full Time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  {language === 'ar' 
                    ? 'نبحث عن مدير مبيعات لتوسيع قاعدة عملائنا في السعودية.'
                    : 'Looking for a sales manager to expand our customer base in Saudi Arabia.'}
                </p>
                <Button variant="outline" className="w-full border-purple-300 text-purple-700 hover:bg-purple-50">
                  {language === 'ar' ? 'تقدم الآن' : 'Apply Now'}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-gray-600 mb-4">
              {language === 'ar' 
                ? 'لم تجد الوظيفة المناسبة؟ أرسل سيرتك الذاتية إلى:'
                : "Didn't find the right position? Send your CV to:"}
            </p>
            <a href="mailto:careers@datalife.com" className="text-[#28376B] font-semibold hover:underline">
              careers@datalife.com
            </a>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section id="privacy" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gray-100 text-gray-700">
              {language === 'ar' ? 'الخصوصية والأمان' : 'Privacy & Security'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </h2>
            <p className="text-xl text-gray-600">
              {language === 'ar' 
                ? 'نلتزم بحماية بياناتك وخصوصيتك'
                : 'We are committed to protecting your data and privacy'}
            </p>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  {language === 'ar' ? 'حماية البيانات' : 'Data Protection'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'نستخدم تشفير SSL متقدم لحماية جميع البيانات المنقولة. بياناتك مخزنة بشكل آمن في خوادم محمية بأحدث تقنيات الأمان.'
                    : 'We use advanced SSL encryption to protect all transmitted data. Your data is securely stored on servers protected with the latest security technologies.'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  {language === 'ar' ? 'جمع البيانات' : 'Data Collection'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'نجمع فقط البيانات الضرورية لتقديم خدماتنا. لن نشارك معلوماتك الشخصية مع أي طرف ثالث دون موافقتك الصريحة.'
                    : 'We only collect data necessary to provide our services. We will not share your personal information with any third party without your explicit consent.'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-600" />
                  {language === 'ar' ? 'ملفات تعريف الارتباط' : 'Cookies'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {language === 'ar' 
                    ? 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك تعطيلها من إعدادات المتصفح، لكن قد يؤثر ذلك على بعض الوظائف.'
                    : 'We use cookies to improve your experience. You can disable them from browser settings, but this may affect some functionality.'}
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-8 p-6 bg-gray-50 rounded-xl text-center">
            <p className="text-gray-600 mb-4">
              {language === 'ar' 
                ? 'لأي استفسارات حول الخصوصية، تواصل معنا:'
                : 'For any privacy inquiries, contact us:'}
            </p>
            <a href="mailto:privacy@datalife.com" className="text-[#28376B] font-semibold hover:underline">
              privacy@datalife.com
            </a>
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
                <li><a href="#features" className="hover:text-white transition-colors">{t('footer.features')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">{t('footer.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate('/demo')}>{t('footer.demo')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.support')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#documentation" className="hover:text-white transition-colors">{t('footer.documentation')}</a></li>
                <li><a href="#help-center" className="hover:text-white transition-colors">{t('footer.helpCenter')}</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">{t('footer.contact')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">{t('footer.about')}</a></li>
                <li><a href="#careers" className="hover:text-white transition-colors">{t('footer.careers')}</a></li>
                <li><a href="#privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</a></li>
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