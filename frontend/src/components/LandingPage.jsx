import React, { useState, useEffect } from 'react';
import { LogoImg, LogoImgSmall } from '../assets/logos';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { 
  Users, DollarSign, Shield, Cloud, Bell, Calculator, FileText, Zap, Globe, MapPin, 
  Lock, HeadphonesIcon, Building2, CreditCard, ChevronRight, Check,
  BarChart3, FolderKanban, Package, Upload, CheckCircle, Settings,
  Clock, Calendar, Layers, ArrowRight, Play, Star, Menu, X, Gift, Phone, Key
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import DataLifeLogo from './DataLifeLogo';
import PricingSection from './PricingSection';
import ContactSection from './ContactSection';
import FreeTrialModal from './FreeTrialModal';
import CompanyLogo from './CompanyLogo';

/* ── AdSense Banner Component ── */
const AdBanner = ({ className = '' }) => (
  <div className={`w-full flex justify-center py-4 ${className}`} data-testid="adsense-banner">
    <ins className="adsbygoogle"
      style={{ display: 'block', width: '100%', maxWidth: 728, height: 90 }}
      data-ad-client="ca-pub-5928973437129941"
      data-ad-slot="auto"
      data-ad-format="horizontal"
      data-full-width-responsive="true" />
  </div>
);

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Try to push ads after render
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
  }, []);

  const ar = language === 'ar';

  const navLinks = [
    { label: ar ? 'الخدمات' : 'Services', href: '#services' },
    { label: ar ? 'المميزات' : 'Features', href: '#features' },
    { label: ar ? 'الأسعار' : 'Pricing', href: '#pricing' },
    { label: ar ? 'الأسئلة' : 'FAQ', href: '#faq' },
    { label: ar ? 'تواصل' : 'Contact', href: '#contact' },
  ];

  /* ── Data ── */
  const services = [
    { icon: Users, color: 'bg-cyan-500', title: ar ? 'إدارة الموارد البشرية' : 'HR Management',
      desc: ar ? 'كشف المرتبات وفق قانون 148/2019، تسجيل الحضور بالـ GPS، إرسال قسائم الرواتب بالبريد، البدلات والخصومات، الورديات، الإجازات، إنهاء الخدمة' : 'Payroll per Law 148/2019, GPS attendance, email payslips, allowances, deductions, shifts, leaves, termination',
      features: ar ? ['كشف المرتبات التلقائي','حضور GPS تلقائي','قسيمة راتب بالإيميل','البدلات والخصومات','الورديات','الإجازات','إنهاء الخدمة','ملف الموظف + صورة + مستندات','تتبع الدعوات'] : ['Auto Payroll','GPS Attendance','Email Payslips','Allowances & Deductions','Shifts','Leaves','Termination','Employee Profile + Photo + Docs','Invitation Tracking'] },
    { icon: Calculator, color: 'bg-emerald-500', title: ar ? 'المحاسبة المالية' : 'Financial Accounting',
      desc: ar ? '108 حساب وفق الدليل المصري المعياري، قيود تلقائية للرواتب والفواتير والأصول، نظام غير قابل للتعديل (Immutable Ledger) على مستوى SAP' : '108 accounts per Egyptian standard chart, automatic entries for payroll/invoices/assets, SAP-level immutable ledger',
      features: ar ? ['108 حساب مصري معياري','قيود تلقائية كاملة','دفتر الأستاذ Enterprise','ميزان المراجعة','قائمة الدخل','الميزانية العمومية','VAT 137/260','خصم وتحصيل 261','تأمينات 255/258/259','مراكز التكلفة','متعدد العملات'] : ['108 Egyptian Accounts','Full Auto Journal Entries','Enterprise General Ledger','Trial Balance','Income Statement','Balance Sheet','VAT Input/Output','Withholding Tax','Insurance Funds','Cost Centers','Multi-currency'] },
    { icon: FileText, color: 'bg-amber-500', title: ar ? 'الفواتير الإلكترونية' : 'E-Invoicing',
      desc: ar ? 'إنشاء وإدارة الفواتير مع دعم منظومة الفاتورة الإلكترونية المصرية (ETA)' : 'Create & manage invoices with Egyptian e-invoicing (ETA) support',
      features: ar ? ['إنشاء الفواتير','طباعة PDF','ربط ETA','تقارير الفواتير'] : ['Create Invoices','PDF Export','ETA Integration','Invoice Reports'] },
    { icon: Package, color: 'bg-rose-500', title: ar ? 'المشتريات' : 'Purchases',
      desc: ar ? 'إدارة أوامر الشراء ومتابعة الطلبات وتسجيل استلام البضاعة' : 'Purchase orders, order tracking, goods receipt',
      features: ar ? ['أوامر الشراء','متابعة الطلبات','استلام البضاعة'] : ['Purchase Orders','Order Tracking','Goods Receipt'] },
    { icon: FolderKanban, color: 'bg-indigo-500', title: ar ? 'المشاريع والمقاولات' : 'Projects & Contracting',
      desc: ar ? 'إدارة المشاريع مع ربط المحاسبة تلقائياً، مستخلصات المقاولات وفق المعيار المصري 8، تأمينات محتجزة، BOQ' : 'Project management with auto accounting, progress claims per Egyptian Standard 8, retention, BOQ',
      features: ar ? ['إدارة المشاريع','مصروفات وإيرادات ← قيود تلقائية','مستخلصات المقاولات','تأمين محتجز Retention','جداول كميات BOQ','قطاع طبي ← فصل أتعاب الأطباء','قطاع استشارات هندسية'] : ['Project Management','Expenses & Revenue → Auto Entries','Progress Claims','Retention Tracking','BOQ Items','Medical sector → Doctor fee split','Engineering Consulting'] },
    { icon: BarChart3, color: 'bg-violet-500', title: ar ? 'التحليلات والتقارير' : 'Analytics & Reports',
      desc: ar ? 'تقارير شاملة للموارد البشرية والمالية والمبيعات والمخزون مع رسوم بيانية' : 'Comprehensive HR, financial, sales & inventory reports with charts',
      features: ar ? ['تقارير HR','التقارير المالية','تقارير المبيعات','رسوم بيانية'] : ['HR Reports','Financial Reports','Sales Reports','Charts'] },
    { icon: CheckCircle, color: 'bg-green-500', title: ar ? 'الموافقات' : 'Approvals',
      desc: ar ? 'نظام موافقات متكامل للإجازات والمشتريات والمصروفات' : 'Complete approval system for leaves, purchases & expenses',
      features: ar ? ['موافقات الإجازات','موافقات المشتريات','سجل الموافقات'] : ['Leave Approvals','Purchase Approvals','Approval History'] },
    { icon: Upload, color: 'bg-sky-500', title: ar ? 'استيراد البيانات' : 'Data Import',
      desc: ar ? 'استيراد بيانات الموظفين والعملاء والمنتجات من ملفات Excel' : 'Import employees, customers & products from Excel files',
      features: ar ? ['استيراد الموظفين','استيراد العملاء','استيراد المنتجات'] : ['Import Employees','Import Customers','Import Products'] },
  ];

  const benefits = [
    { icon: Globe, title: ar ? 'دعم عربي كامل + RTL' : 'Full Arabic + RTL', desc: ar ? 'واجهة عربية كاملة مع دعم RTL وقانون مصري' : 'Complete Arabic interface with RTL and Egyptian law' },
    { icon: Cloud, title: ar ? 'سحابي 100%' : '100% Cloud-Based', desc: ar ? 'لا حاجة لتثبيت — يعمل من أي متصفح أو هاتف' : 'No installation — works from any browser or phone' },
    { icon: Shield, title: ar ? 'أمان Enterprise' : 'Enterprise Security', desc: ar ? 'HTTPS + JWT 8h + خروج تلقائي 30 د + Rate Limiting + Audit Log' : 'HTTPS + JWT 8h + Auto-logout 30min + Rate Limiting + Audit Log' },
    { icon: Bell, title: ar ? 'Real-time WebSocket' : 'Real-time WebSocket', desc: ar ? 'موافقات وتحديثات فورية بدون تحديث الصفحة' : 'Instant approvals and updates without page refresh' },
    { icon: MapPin, title: ar ? 'حضور GPS تلقائي' : 'GPS Auto Attendance', desc: ar ? 'تسجيل الحضور بالموقع الجغرافي مع نطاق مسموح قابل للضبط' : 'GPS location-based attendance with configurable geofence radius' },
    { icon: Lock, title: ar ? 'صلاحيات متقدمة' : 'Advanced Permissions', desc: ar ? 'تحكم كامل في صلاحيات كل موظف + Super Admin يدير كل الشركات' : 'Full employee permission control + Super Admin manages all companies' },
    { icon: CreditCard, title: ar ? 'طرق دفع متعددة' : 'Multiple Payments', desc: ar ? 'بطاقة، PayPal، InstaPay، فودافون كاش، كود تفعيل' : 'Card, PayPal, InstaPay, Vodafone Cash, Activation Code' },
    { icon: Zap, title: ar ? 'تحديثات تلقائية' : 'Auto Updates', desc: ar ? 'إشعار بكل تحديث جديد — اضغط زر واحد للتحديث' : 'Notification for every new update — one-tap to update' },
  ];

  const faqs = [
    { q: ar ? 'ما هو DataLife Account؟' : 'What is DataLife Account?', a: ar ? 'نظام متكامل لإدارة موارد المؤسسات (ERP) يعمل عبر الإنترنت، يشمل إدارة الموارد البشرية، الإدارة المالية، الفواتير، المشتريات، المشاريع، والتقارير.' : 'A comprehensive cloud-based ERP system including HR, financial management, invoicing, purchases, projects, and reports.' },
    { q: ar ? 'هل النظام يدعم اللغة العربية؟' : 'Does it support Arabic?', a: ar ? 'نعم، النظام يدعم اللغتين العربية والإنجليزية بالكامل مع دعم الكتابة من اليمين لليسار (RTL).' : 'Yes, full Arabic and English support with RTL layout.' },
    { q: ar ? 'هل يمكنني تجربة النظام مجاناً؟' : 'Can I try it for free?', a: ar ? 'نعم، يمكنك البدء بتجربة مجانية أو استخدام كود تفعيل للحصول على اشتراك مجاني.' : 'Yes, you can start a free trial or use an activation code for a free subscription.' },
    { q: ar ? 'كيف أضيف موظفين في النظام؟' : 'How to add employees?', a: ar ? 'من الإعدادات ← الموظفين ← دعوة موظف جديد عبر البريد الإلكتروني. أو من صفحة الموارد البشرية ← إضافة موظف.' : 'From Settings → Employees → Invite via email. Or from HR page → Add Employee.' },
    { q: ar ? 'هل يدعم الفاتورة الإلكترونية المصرية؟' : 'Does it support Egyptian e-invoicing?', a: ar ? 'نعم، يدعم النظام ربط الفاتورة الإلكترونية المصرية (ETA) مع إعدادات مخصصة.' : 'Yes, it supports Egyptian e-invoicing (ETA) with custom settings.' },
    { q: ar ? 'ما هي طرق الدفع المتاحة؟' : 'What payment methods are available?', a: ar ? 'بطاقة ائتمان (Stripe)، PayPal، تحويل بنكي، InstaPay، فودافون كاش، كود تفعيل مجاني.' : 'Credit card (Stripe), PayPal, bank transfer, InstaPay, Vodafone Cash, free activation code.' },
    { q: ar ? 'هل بياناتي آمنة؟' : 'Is my data secure?', a: ar ? 'نعم، جميع البيانات مشفرة ومحمية بنظام صلاحيات متعدد المستويات (21 صلاحية).' : 'Yes, all data is encrypted and protected with a multi-level permission system (21 permissions).' },
  ];

  const fontClass = ar ? 'font-[Cairo]' : 'font-[Outfit]';

  return (
    <div className={`min-h-screen bg-white ${fontClass}`} dir={isRTL ? 'rtl' : 'ltr'} data-testid="landing-page">

      {/* ══════════ NAVBAR ══════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-white/50 backdrop-blur-sm'}`} data-testid="navbar">
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>
            <DataLifeLogo size="small" className="h-10" />
          </div>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-[#28376B] transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin-login')} className="hidden sm:inline-flex text-gray-400 hover:text-[#28376B]" title={ar ? 'دخول المدير' : 'Admin Login'}>
              <Shield className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex text-[#28376B]">
              {ar ? 'تسجيل الدخول' : 'Login'}
            </Button>
            <Button size="sm" onClick={() => setIsTrialModalOpen(true)} className="bg-[#28376B] hover:bg-[#1e2a5a] text-white">
              {ar ? 'ابدأ مجاناً' : 'Start Free'}
            </Button>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t px-4 py-3 space-y-2">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenu(false)} className="block py-2 text-sm font-medium text-gray-700">{l.label}</a>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => { navigate('/login'); setMobileMenu(false); }}>
              {ar ? 'تسجيل الدخول' : 'Login'}
            </Button>
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="pt-28 pb-20 px-4 md:px-8 bg-gradient-to-b from-slate-50 to-white" data-testid="hero-section">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-6 bg-[#28376B]/10 text-[#28376B] hover:bg-[#28376B]/10 border-0 text-sm px-4 py-1.5">
              {ar ? 'نظام ERP متكامل للشركات العربية' : 'Complete ERP System for Businesses'}
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0f172a] tracking-tight leading-tight">
              {ar ? (
                <><span className="text-[#28376B]">داتا لايف أكونت</span><br/>نظام إدارة أعمالك الشامل</>
              ) : (
                <><span className="text-[#28376B]">DataLife Account</span><br/>Complete Business Management</>
              )}
            </h1>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              {ar 
                ? 'نظام متكامل لإدارة الموارد البشرية، الإدارة المالية، الفواتير، المشتريات، المشاريع والتقارير — يدعم العربية والإنجليزية بالكامل'
                : 'Integrated HR, Financial, Invoicing, Purchasing, Projects & Reporting system — with full Arabic and English support'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => setIsTrialModalOpen(true)} className="bg-[#28376B] hover:bg-[#1e2a5a] text-white h-12 px-8 text-base">
                {ar ? 'ابدأ تجربة مجانية' : 'Start Free Trial'}
                <ArrowRight className="h-4 w-4 ms-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="h-12 px-8 text-base border-gray-300">
                {ar ? 'تسجيل الدخول' : 'Login'}
              </Button>
            </div>
          </div>

          {/* Stats - replaced with value props */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, value: ar ? '21 صلاحية' : '21 Permissions', label: ar ? 'تحكم كامل' : 'Full Control' },
              { icon: Globe, value: ar ? 'عربي + EN' : 'AR + EN', label: ar ? 'ثنائي اللغة' : 'Bilingual' },
              { icon: Cloud, value: ar ? 'سحابي' : 'Cloud', label: ar ? 'بدون تثبيت' : 'No Install' },
              { icon: Lock, value: ar ? 'مشفّر' : 'Encrypted', label: ar ? 'أمان عالي' : 'High Security' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="text-center p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <Icon className="h-6 w-6 text-[#28376B] mx-auto mb-2" />
                  <div className="text-lg font-bold text-[#28376B]">{s.value}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ AD BANNER 1 ══════════ */}
      <AdBanner className="bg-gray-50" />

      {/* ══════════ SERVICES (Bento Grid) ══════════ */}
      <section id="services" className="py-20 md:py-28 px-4 md:px-8" data-testid="services-section">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-cyan-50 text-cyan-700 hover:bg-cyan-50 border-0">{ar ? 'خدماتنا' : 'Our Services'}</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
              {ar ? 'كل ما تحتاجه لإدارة أعمالك' : 'Everything You Need to Run Your Business'}
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              {ar ? '8 وحدات متكاملة تغطي جميع احتياجات شركتك' : '8 integrated modules covering all your business needs'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <Card key={i} className={`border border-gray-100 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${i < 2 ? 'lg:col-span-2' : ''}`} data-testid={`service-card-${i}`}>
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 ${svc.color} rounded-xl flex items-center justify-center text-white mb-4`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{svc.title}</h3>
                    <p className="text-sm text-gray-500 mb-4 leading-relaxed">{svc.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {svc.features.map((f, j) => (
                        <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ AD BANNER 2 ══════════ */}
      <AdBanner className="bg-white" />

      {/* ══════════ BENEFITS ══════════ */}
      <section id="features" className="py-20 md:py-28 px-4 md:px-8 bg-slate-50" data-testid="features-section">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-0">{ar ? 'لماذا DataLife؟' : 'Why DataLife?'}</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
              {ar ? 'مميزات تجعلنا الخيار الأفضل' : 'Features That Make Us the Best Choice'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-testid={`benefit-${i}`}>
                  <div className="w-11 h-11 bg-[#28376B]/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#28376B]" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{b.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="py-20 md:py-28 px-4 md:px-8" data-testid="how-it-works">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-purple-50 text-purple-700 hover:bg-purple-50 border-0">{ar ? 'كيف تبدأ؟' : 'How to Start?'}</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
              {ar ? 'ابدأ في 3 خطوات بسيطة' : 'Start in 3 Simple Steps'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { num: '1', title: ar ? 'سجّل شركتك' : 'Register', desc: ar ? 'أنشئ حساب شركتك مجاناً في أقل من دقيقة' : 'Create your company account free in under a minute', icon: Building2 },
              { num: '2', title: ar ? 'أضف فريقك' : 'Add Team', desc: ar ? 'أضف الموظفين وعيّن الصلاحيات لكل منهم' : 'Add employees and assign permissions to each', icon: Users },
              { num: '3', title: ar ? 'ابدأ العمل' : 'Start Working', desc: ar ? 'ابدأ إدارة الموارد البشرية والمالية والفواتير' : 'Start managing HR, finances, and invoices', icon: Zap },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="text-center group">
                  <div className="w-16 h-16 bg-[#28376B] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold group-hover:scale-110 transition-transform">
                    {step.num}
                  </div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ AD BANNER 3 ══════════ */}
      <AdBanner className="bg-slate-50" />

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="py-20 md:py-28 px-4 md:px-8" data-testid="pricing-section">
        <PricingSection />
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" className="py-20 md:py-28 px-4 md:px-8 bg-slate-50" data-testid="faq-section">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-amber-50 text-amber-700 hover:bg-amber-50 border-0">{ar ? 'الأسئلة الشائعة' : 'FAQ'}</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
              {ar ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-white rounded-xl border border-gray-100 px-5">
                <AccordionTrigger className="text-start font-semibold text-gray-800 hover:no-underline py-4">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-gray-500 pb-4 leading-relaxed">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ══════════ CONTACT ══════════ */}
      <section id="contact" className="py-20 md:py-28 px-4 md:px-8" data-testid="contact-section">
        <ContactSection />
      </section>

      {/* ══════════ PAYMENT METHODS ══════════ */}
      <section className="py-16 px-4 md:px-8 bg-slate-50" data-testid="payment-methods">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-8">
            {ar ? 'طرق الدفع والاشتراك' : 'Payment & Subscription Methods'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { name: ar ? 'بطاقة ائتمان' : 'Credit Card', icon: CreditCard, color: 'bg-blue-500' },
              { name: 'PayPal', icon: DollarSign, color: 'bg-indigo-500' },
              { name: 'InstaPay', icon: Zap, color: 'bg-orange-500' },
              { name: ar ? 'فودافون كاش' : 'Vodafone Cash', icon: Phone, color: 'bg-red-500' },
              { name: ar ? 'تحويل بنكي' : 'Bank Transfer', icon: Building2, color: 'bg-emerald-500' },
              { name: ar ? 'كود تفعيل' : 'Activation Code', icon: Key, color: 'bg-purple-500' },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex flex-col items-center gap-2 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 ${m.color} rounded-lg flex items-center justify-center text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">{m.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ REFERRAL PROGRAM ══════════ */}
      <section className="py-16 px-4 md:px-8 bg-gradient-to-r from-[#28376B] to-indigo-700" data-testid="referral-section">
        <div className="container mx-auto max-w-3xl text-center text-white">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gift className="h-8 w-8 text-yellow-300" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {ar ? 'ادعُ 5 أصدقاء واحصل على شهر مجاني!' : 'Invite 5 Friends & Get 1 Month Free!'}
          </h2>
          <p className="text-white/70 text-lg mb-6">
            {ar ? 'شارك رابط الدعوة الخاص بك. عند تسجيل 5 أشخاص عبر رابطك، ستحصل على كوبون هدية لشهر اشتراك مجاني.' : 'Share your invite link. When 5 people register through your link, you get a free month coupon.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <div className="bg-white/10 backdrop-blur rounded-xl px-6 py-3 border border-white/20">
              <p className="text-sm text-white/60 mb-1">{ar ? 'كيف يعمل؟' : 'How it works?'}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                <span>{ar ? 'شارك الرابط' : 'Share link'}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                <span>{ar ? '5 يسجلون' : '5 sign up'}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                <span>{ar ? 'شهر مجاني' : 'Free month'}</span>
              </div>
            </div>
          </div>
          <Button size="lg" onClick={() => setIsTrialModalOpen(true)} className="mt-6 bg-yellow-400 hover:bg-yellow-500 text-[#28376B] font-bold h-12 px-8">
            {ar ? 'ابدأ الآن وادعُ أصدقاءك' : 'Start Now & Invite Friends'}
          </Button>
        </div>
      </section>

      {/* ══════════ AD BANNER 4 ══════════ */}
      <AdBanner className="bg-white" />

      {/* ══════════ CTA ══════════ */}
      <section className="py-20 px-4 md:px-8 bg-[#28376B]" data-testid="cta-section">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {ar ? 'جاهز لإدارة أعمالك بذكاء؟' : 'Ready to Manage Smarter?'}
          </h2>
          <p className="mt-4 text-white/70 text-lg">
            {ar ? 'ابدأ تجربتك المجانية اليوم — بدون بطاقة ائتمان' : 'Start your free trial today — no credit card required'}
          </p>
          <Button size="lg" onClick={() => setIsTrialModalOpen(true)} className="mt-8 bg-white text-[#28376B] hover:bg-gray-100 h-12 px-8 text-base font-semibold">
            {ar ? 'ابدأ الآن مجاناً' : 'Start Free Now'}
            <ArrowRight className="h-4 w-4 ms-2" />
          </Button>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="bg-[#0f172a] text-gray-400 py-14 px-4 md:px-8" data-testid="footer">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <DataLifeLogo size="small" className="h-8 brightness-0 invert" />
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                {ar ? 'نظام متكامل لإدارة موارد المؤسسات — الموارد البشرية، الإدارة المالية، الفواتير، المشتريات، المشاريع والتقارير.' : 'Complete ERP system — HR, Finance, Invoicing, Purchases, Projects & Reports.'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">{ar ? 'روابط سريعة' : 'Quick Links'}</h4>
              <ul className="space-y-2 text-sm">
                {navLinks.map(l => <li key={l.href}><a href={l.href} className="hover:text-white transition-colors">{l.label}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">{ar ? 'تواصل معنا' : 'Contact'}</h4>
              <ul className="space-y-2 text-sm">
                <li>info@datalifeai.com</li>
                <li>{ar ? 'القاهرة، مصر' : 'Cairo, Egypt'}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-14 flex flex-col items-center">
            <CompanyLogo size="large" />
            <div className="mt-16">
              <p className="text-sm text-center">{ar ? '© 2026 دانا لايف لخدمات الذكاء الاصطناعي - جميع الحقوق محفوظة' : '© 2026 DataLife AI Services - All Rights Reserved'}</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Free Trial Modal */}
      <FreeTrialModal isOpen={isTrialModalOpen} onClose={() => setIsTrialModalOpen(false)} />
    </div>
  );
};

export default LandingPage;
