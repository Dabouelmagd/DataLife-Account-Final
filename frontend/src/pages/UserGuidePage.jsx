import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Book, ChevronDown, ChevronRight, Search, Users, DollarSign, 
  FileText, Package, Building2, CreditCard, Bell, BarChart3,
  Settings, CheckCircle, ArrowRight, Wallet, Calculator, Receipt,
  Calendar, Clock, Briefcase, Shield, Database, Globe, Moon,
  Mail, TrendingUp, PieChart, Layers, HelpCircle, Play, ArrowLeft,
  Cloud, Lock, Languages, Home, FolderKanban, Landmark, UserCheck,
  FileBarChart, Banknote, ClipboardList, Smartphone, Zap, Award,
  Target, Lightbulb, MessageSquare, Phone, MapPin, ChevronUp,
  Download, Upload, Printer, Eye, Star, Heart, ThumbsUp
} from 'lucide-react';

const UserGuidePage = ({ language }) => {
  const isRTL = language === 'ar';
  const [activeSection, setActiveSection] = useState('overview');
  
  // Refs for scrolling
  const overviewRef = useRef(null);
  const modulesRef = useRef(null);
  const hrRef = useRef(null);
  const financeRef = useRef(null);
  const projectsRef = useRef(null);
  const reportsRef = useRef(null);
  const dashboardRef = useRef(null);
  const howToRef = useRef(null);

  const scrollToSection = (ref, sectionId) => {
    setActiveSection(sectionId);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const quickNavItems = [
    { id: 'overview', icon: Layers, label: language === 'ar' ? 'نظرة عامة' : 'Overview', ref: overviewRef },
    { id: 'modules', icon: Package, label: language === 'ar' ? 'الوحدات الرئيسية' : 'Main Modules', ref: modulesRef },
    { id: 'hr', icon: Users, label: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', ref: hrRef },
    { id: 'finance', icon: DollarSign, label: language === 'ar' ? 'الإدارة المالية' : 'Financial Management', ref: financeRef },
    { id: 'projects', icon: FolderKanban, label: language === 'ar' ? 'المشاريع' : 'Projects', ref: projectsRef },
    { id: 'reports', icon: BarChart3, label: language === 'ar' ? 'التقارير' : 'Reports', ref: reportsRef },
    { id: 'dashboard', icon: Home, label: language === 'ar' ? 'لوحة الإدارة' : 'Dashboard', ref: dashboardRef },
    { id: 'howto', icon: Play, label: language === 'ar' ? 'طريقة التشغيل' : 'How to Use', ref: howToRef },
  ];

  const mainFeatures = [
    { icon: Languages, label: language === 'ar' ? 'دعم ثنائي اللغة' : 'Bilingual Support' },
    { icon: Cloud, label: language === 'ar' ? 'سحابي 100%' : '100% Cloud' },
    { icon: Shield, label: language === 'ar' ? 'حماية متقدمة' : 'Advanced Security' },
  ];

  const modules = [
    {
      icon: Users,
      title: language === 'ar' ? 'إدارة الموارد البشرية' : 'Human Resources',
      description: language === 'ar' 
        ? 'إدارة شاملة للموظفين تشمل الحضور والانصراف، الإجازات، الرواتب، وتقييم الأداء'
        : 'Comprehensive employee management including attendance, leaves, payroll, and performance evaluation',
      features: language === 'ar' 
        ? ['سجلات الموظفين', 'الحضور والانصراف', 'نظام الإجازات', 'كشوف الرواتب', 'تقييم الأداء']
        : ['Employee Records', 'Attendance Tracking', 'Leave Management', 'Payroll', 'Performance Evaluation'],
      color: 'from-pink-500 to-rose-600'
    },
    {
      icon: Calculator,
      title: language === 'ar' ? 'النظام المحاسبي' : 'Accounting System',
      description: language === 'ar'
        ? 'نظام محاسبي متكامل يتضمن دليل الحسابات المصري، القيود اليومية، والتقارير المالية'
        : 'Complete accounting system with Egyptian Chart of Accounts, journal entries, and financial reports',
      features: language === 'ar'
        ? ['دليل الحسابات (71 حساب)', 'القيود اليومية', 'ميزان المراجعة', 'قائمة الدخل', 'الميزانية العمومية']
        : ['Chart of Accounts (71 accounts)', 'Journal Entries', 'Trial Balance', 'Income Statement', 'Balance Sheet'],
      color: 'from-emerald-500 to-teal-600'
    },
    {
      icon: Landmark,
      title: language === 'ar' ? 'إدارة البنوك' : 'Bank Management',
      description: language === 'ar'
        ? 'إدارة متعددة البنوك مع تتبع الحركات وإنشاء قيود محاسبية تلقائية'
        : 'Multi-bank management with transaction tracking and automatic journal entry creation',
      features: language === 'ar'
        ? ['حسابات بنكية متعددة', 'إيداعات وسحوبات', 'شيكات واردة وصادرة', 'قيود تلقائية', 'إعدادات الترحيل']
        : ['Multiple Bank Accounts', 'Deposits & Withdrawals', 'Incoming & Outgoing Checks', 'Auto Journal Entries', 'Posting Settings'],
      color: 'from-violet-500 to-purple-600'
    },
    {
      icon: Receipt,
      title: language === 'ar' ? 'الفواتير الإلكترونية' : 'E-Invoicing',
      description: language === 'ar'
        ? 'نظام فوترة متكامل يدعم ضريبة القيمة المضافة والعملات المتعددة'
        : 'Complete invoicing system supporting VAT and multiple currencies',
      features: language === 'ar'
        ? ['فواتير مبيعات ومشتريات', 'عروض الأسعار', 'ضريبة القيمة المضافة', '11 عملة مدعومة', 'طباعة PDF']
        : ['Sales & Purchase Invoices', 'Quotations', 'VAT Support', '11 Currencies', 'PDF Export'],
      color: 'from-amber-500 to-orange-600'
    },
    {
      icon: Package,
      title: language === 'ar' ? 'إدارة المخزون' : 'Inventory Management',
      description: language === 'ar'
        ? 'تتبع المنتجات والمخزون مع تنبيهات المخزون المنخفض'
        : 'Product and inventory tracking with low stock alerts',
      features: language === 'ar'
        ? ['كتالوج المنتجات', 'تتبع المخزون', 'تنبيهات المخزون', 'حركات المخزون', 'تقارير المخزون']
        : ['Product Catalog', 'Stock Tracking', 'Stock Alerts', 'Stock Movements', 'Inventory Reports'],
      color: 'from-cyan-500 to-blue-600'
    },
    {
      icon: Bell,
      title: language === 'ar' ? 'نظام الإشعارات' : 'Notification System',
      description: language === 'ar'
        ? 'إشعارات بريد إلكتروني تلقائية للأحداث المهمة'
        : 'Automatic email notifications for important events',
      features: language === 'ar'
        ? ['معاملات بنكية كبيرة', 'كشوف الرواتب', 'انتهاء العقود', 'الفواتير المستحقة', 'طلبات الموافقة']
        : ['Large Transactions', 'Payslips', 'Contract Expiry', 'Due Invoices', 'Approval Requests'],
      color: 'from-red-500 to-pink-600'
    }
  ];

  const howToSteps = [
    {
      step: 1,
      title: language === 'ar' ? 'تسجيل الدخول' : 'Login',
      description: language === 'ar'
        ? 'أدخل البريد الإلكتروني وكلمة المرور ← اضغط "تسجيل الدخول" ← أدخل كود الشركة'
        : 'Enter email and password → Click "Sign In" → Enter company code',
      icon: UserCheck
    },
    {
      step: 2,
      title: language === 'ar' ? 'اختيار الوحدة' : 'Select Module',
      description: language === 'ar'
        ? 'من القائمة الجانبية، اختر الوحدة المطلوبة (الموارد البشرية، المالية، الفواتير، إلخ)'
        : 'From the sidebar, select the desired module (HR, Finance, Invoices, etc.)',
      icon: Layers
    },
    {
      step: 3,
      title: language === 'ar' ? 'إدخال البيانات' : 'Enter Data',
      description: language === 'ar'
        ? 'اضغط "جديد" أو "إضافة" ← املأ النموذج ← اضغط "حفظ"'
        : 'Click "New" or "Add" → Fill the form → Click "Save"',
      icon: ClipboardList
    },
    {
      step: 4,
      title: language === 'ar' ? 'المراجعة والاعتماد' : 'Review & Approve',
      description: language === 'ar'
        ? 'راجع البيانات ← اعتمد أو رحّل (للقيود المحاسبية) ← تابع التقارير'
        : 'Review data → Approve or Post (for journal entries) → Check reports',
      icon: CheckCircle
    }
  ];

  const stats = [
    { value: '71', label: language === 'ar' ? 'حساب محاسبي' : 'Accounts', icon: Calculator },
    { value: '11', label: language === 'ar' ? 'عملة مدعومة' : 'Currencies', icon: Banknote },
    { value: '6', label: language === 'ar' ? 'أنواع إشعارات' : 'Notification Types', icon: Bell },
    { value: '24/7', label: language === 'ar' ? 'دعم فني' : 'Support', icon: HelpCircle },
  ];

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-slate-900 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium flex items-center gap-2">
              <Book className="w-4 h-4" />
              {language === 'ar' ? 'الدليل الشامل' : 'Comprehensive Guide'}
            </span>
          </div>
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-6">
            {language === 'ar' 
              ? 'دليل مميزات نظام DataLife ERP'
              : 'DataLife ERP System Features Guide'}
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl text-slate-300 text-center max-w-3xl mx-auto mb-10">
            {language === 'ar'
              ? 'نظام متكامل لإدارة موارد المؤسسات يدعم اللغة العربية والإنجليزية، مصمم خصيصاً لتلبية احتياجات الشركات العربية'
              : 'A comprehensive enterprise resource management system supporting Arabic and English, specially designed to meet the needs of Arab companies'}
          </p>
          
          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {mainFeatures.map((feature, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20"
              >
                <feature.icon className="w-5 h-5" />
                <span className="font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h2 className="text-lg font-semibold text-center text-gray-600 dark:text-gray-300 mb-4">
            {language === 'ar' ? 'الانتقال السريع' : 'Quick Navigation'}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {quickNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.ref, item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25'
                    : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-20">
        
        {/* Overview Section */}
        <section ref={overviewRef} id="overview">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium mb-4">
              {language === 'ar' ? 'مقدمة' : 'Introduction'}
            </span>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'نظرة عامة على النظام' : 'System Overview'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              {language === 'ar'
                ? 'DataLife ERP هو نظام متكامل لإدارة موارد المؤسسات، مصمم بأحدث التقنيات لتوفير حلول شاملة لإدارة الأعمال. يدعم النظام اللغة العربية بشكل كامل مع واجهة RTL احترافية.'
                : 'DataLife ERP is a comprehensive enterprise resource management system, designed with the latest technologies to provide complete business management solutions. The system fully supports Arabic with a professional RTL interface.'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {stats.map((stat, idx) => (
              <Card key={idx} className="border-0 shadow-lg dark:bg-slate-800 text-center">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                    <stat.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Main Modules Section */}
        <section ref={modulesRef} id="modules">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-sm font-medium mb-4">
              {language === 'ar' ? 'الوحدات' : 'Modules'}
            </span>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'الوحدات الرئيسية' : 'Main Modules'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              {language === 'ar'
                ? 'يتضمن النظام مجموعة متكاملة من الوحدات المصممة لتغطية جميع احتياجات إدارة الأعمال'
                : 'The system includes a comprehensive set of modules designed to cover all business management needs'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, idx) => (
              <Card key={idx} className="border-0 shadow-lg dark:bg-slate-800 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className={`h-2 bg-gradient-to-r ${module.color}`}></div>
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
                    <module.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{module.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">{module.description}</p>
                  <div className="space-y-2">
                    {module.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* HR Section */}
        <section ref={hrRef} id="hr">
          <Card className="border-0 shadow-xl dark:bg-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-pink-500 to-rose-600"></div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {language === 'ar' ? 'إدارة الموارد البشرية' : 'Human Resources Management'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {language === 'ar'
                      ? 'نظام شامل لإدارة جميع جوانب الموارد البشرية من التوظيف حتى إنهاء الخدمة'
                      : 'A comprehensive system for managing all aspects of human resources from hiring to termination'}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { icon: UserCheck, title: language === 'ar' ? 'سجلات الموظفين' : 'Employee Records' },
                      { icon: Clock, title: language === 'ar' ? 'الحضور والانصراف' : 'Attendance' },
                      { icon: Calendar, title: language === 'ar' ? 'الإجازات' : 'Leave Management' },
                      { icon: Banknote, title: language === 'ar' ? 'الرواتب' : 'Payroll' },
                      { icon: Award, title: language === 'ar' ? 'تقييم الأداء' : 'Performance' },
                      { icon: FileText, title: language === 'ar' ? 'العقود' : 'Contracts' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                        <item.icon className="w-5 h-5 text-pink-600" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Finance Section */}
        <section ref={financeRef} id="finance">
          <Card className="border-0 shadow-xl dark:bg-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {language === 'ar' ? 'الإدارة المالية والمحاسبية' : 'Financial & Accounting Management'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {language === 'ar'
                      ? 'نظام محاسبي متكامل وفق المعايير المصرية مع دعم للعملات المتعددة والقيود التلقائية'
                      : 'A complete accounting system following Egyptian standards with multi-currency support and automatic entries'}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { icon: FileBarChart, title: language === 'ar' ? 'دليل الحسابات (71 حساب)' : 'Chart of Accounts (71)' },
                      { icon: FileText, title: language === 'ar' ? 'القيود اليومية' : 'Journal Entries' },
                      { icon: TrendingUp, title: language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance' },
                      { icon: PieChart, title: language === 'ar' ? 'قائمة الدخل' : 'Income Statement' },
                      { icon: BarChart3, title: language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet' },
                      { icon: Landmark, title: language === 'ar' ? 'إدارة البنوك' : 'Bank Management' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <item.icon className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Projects Section */}
        <section ref={projectsRef} id="projects">
          <Card className="border-0 shadow-xl dark:bg-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {language === 'ar' ? 'إدارة المشاريع والفواتير' : 'Projects & Invoices Management'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {language === 'ar'
                      ? 'تتبع المشاريع وإدارة الفواتير الإلكترونية مع دعم ضريبة القيمة المضافة'
                      : 'Track projects and manage e-invoices with VAT support'}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { icon: FolderKanban, title: language === 'ar' ? 'تتبع المشاريع' : 'Project Tracking' },
                      { icon: Receipt, title: language === 'ar' ? 'فواتير المبيعات' : 'Sales Invoices' },
                      { icon: FileText, title: language === 'ar' ? 'عروض الأسعار' : 'Quotations' },
                      { icon: DollarSign, title: language === 'ar' ? 'العملات المتعددة' : 'Multi-Currency' },
                      { icon: Printer, title: language === 'ar' ? 'طباعة PDF' : 'PDF Export' },
                      { icon: Target, title: language === 'ar' ? 'تتبع المدفوعات' : 'Payment Tracking' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <item.icon className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Reports Section */}
        <section ref={reportsRef} id="reports">
          <Card className="border-0 shadow-xl dark:bg-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600"></div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {language === 'ar' ? 'التقارير والتحليلات' : 'Reports & Analytics'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {language === 'ar'
                      ? 'تقارير شاملة ورسوم بيانية تفاعلية لمتابعة أداء الشركة'
                      : 'Comprehensive reports and interactive charts to monitor company performance'}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { icon: TrendingUp, title: language === 'ar' ? 'تقارير مالية' : 'Financial Reports' },
                      { icon: Users, title: language === 'ar' ? 'تقارير الموظفين' : 'HR Reports' },
                      { icon: Package, title: language === 'ar' ? 'تقارير المخزون' : 'Inventory Reports' },
                      { icon: Receipt, title: language === 'ar' ? 'تقارير المبيعات' : 'Sales Reports' },
                      { icon: PieChart, title: language === 'ar' ? 'رسوم بيانية' : 'Charts' },
                      { icon: Download, title: language === 'ar' ? 'تصدير Excel' : 'Excel Export' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <item.icon className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Section */}
        <section ref={dashboardRef} id="dashboard">
          <Card className="border-0 shadow-xl dark:bg-slate-800 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-600"></div>
            <CardContent className="p-8">
              <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Home className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {language === 'ar' ? 'لوحة التحكم الإدارية' : 'Admin Dashboard'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {language === 'ar'
                      ? 'لوحة تحكم متقدمة تعرض إحصائيات شاملة وتنبيهات مهمة'
                      : 'Advanced dashboard displaying comprehensive statistics and important alerts'}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { icon: TrendingUp, title: language === 'ar' ? 'إحصائيات الإيرادات' : 'Revenue Stats' },
                      { icon: Wallet, title: language === 'ar' ? 'أرصدة البنوك' : 'Bank Balances' },
                      { icon: Users, title: language === 'ar' ? 'إحصائيات الموظفين' : 'Employee Stats' },
                      { icon: Bell, title: language === 'ar' ? 'التنبيهات' : 'Alerts' },
                      { icon: BarChart3, title: language === 'ar' ? 'رسوم بيانية' : 'Charts' },
                      { icon: CreditCard, title: language === 'ar' ? 'آخر الحركات' : 'Recent Transactions' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                        <item.icon className="w-5 h-5 text-violet-600" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* How to Use Section */}
        <section ref={howToRef} id="howto">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium mb-4">
              {language === 'ar' ? 'البدء' : 'Getting Started'}
            </span>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'طريقة التشغيل' : 'How to Use'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              {language === 'ar'
                ? 'خطوات بسيطة للبدء في استخدام النظام'
                : 'Simple steps to get started with the system'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howToSteps.map((step, idx) => (
              <Card key={idx} className="border-0 shadow-lg dark:bg-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-bl-3xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{step.step}</span>
                </div>
                <CardContent className="p-6 pt-10">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <step.icon className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Contact/Support Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {language === 'ar' ? 'تحتاج مساعدة؟' : 'Need Help?'}
              </h2>
              <p className="text-blue-100">
                {language === 'ar'
                  ? 'فريق الدعم الفني متاح على مدار الساعة لمساعدتك'
                  : 'Our support team is available 24/7 to assist you'}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
                <Mail className="w-5 h-5" />
                <span>support@datalifeai.com</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg">
                <Phone className="w-5 h-5" />
                <span dir="ltr">+20 123 456 789</span>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="bg-slate-800 text-white py-6 text-center">
        <p className="text-slate-400">
          {language === 'ar' 
            ? '© 2026 DataLife AI Services - جميع الحقوق محفوظة'
            : '© 2026 DataLife AI Services - All Rights Reserved'}
        </p>
      </div>
    </div>
  );
};

export default UserGuidePage;
