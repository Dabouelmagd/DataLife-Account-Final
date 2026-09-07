import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import DataLifeLogo from './DataLifeLogo';
import PricingSection from './PricingSection';
import ContactSection from './ContactSection';
import FreeTrialModal from './FreeTrialModal';
import {
  Users, Shield, Zap, Globe, Lock, Building2, CreditCard,
  Check, Menu, X, Gift, Phone, Key, TrendingUp, RefreshCw,
  FileText, ChevronDown, ChevronUp, Star, ArrowLeft, ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [activeVertical, setActiveVertical] = useState('co');
  const [faqOpen, setFaqOpen] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: ar ? 'المميزات' : 'Features', href: '#features' },
    { label: ar ? 'بوابة الموظف' : 'ESS Portal', href: '#ess' },
    { label: ar ? 'القطاعات' : 'Verticals', href: '#verticals' },
    { label: ar ? 'الأسعار' : 'Pricing', href: '#pricing' },
    { label: ar ? 'المقارنة' : 'Compare', href: '#compare' },
    { label: ar ? 'الأسئلة' : 'FAQ', href: '#faq' },
  ];

  const features = [
    { icon: '🧾', title: ar ? 'فاتورة إلكترونية ETA' : 'ETA E-Invoice', desc: ar ? 'B2B وB2C · CAdES-BES · TLV QR · نماذج 10 و41 تلقائياً' : 'B2B & B2C · CAdES-BES · TLV QR · Forms 10 & 41 auto', tags: ['ETA API', 'CAdES-BES'], color: 'from-amber-500 to-orange-500' },
    { icon: '👥', title: ar ? 'مسير رواتب — قانون 148/2019' : 'Payroll — Law 148/2019', desc: ar ? '7 شرائح ضريبية + تأمينات 11%+18.75% + نهاية خدمة + سُلف + قيد تلقائي' : '7 tax brackets + 11%+18.75% insurance + end of service + loans + auto entry', tags: [ar?'7 شرائح':'7 Brackets', ar?'تأمين اجتماعي':'Social Insurance'], color: 'from-teal-500 to-teal-600' },
    { icon: '👤', title: ar ? 'بوابة الموظف ESS' : 'Employee Self-Service ESS', desc: ar ? 'الموظف يرى بياناته فقط: راتب + بدلات + إجازات + حضور GPS. عزل كامل.' : 'Employee sees own data only: salary + leaves + GPS attendance. Full isolation.', tags: ['GPS', ar?'قسيمة PDF':'PDF Payslip', ar?'عزل تام':'Isolated'], color: 'from-purple-600 to-violet-500', isNew: true },
    { icon: '🔐', title: ar ? 'صلاحيات متدرجة' : 'Role-Based Permissions', desc: ar ? 'كل مستخدم يرى ما يخصه فقط. منح/سحب فوري. الموظف معزول في ESS.' : 'Each user sees only their data. Grant/revoke instantly. Employee isolated in ESS.', tags: ['Role-Based', 'HR Manager'], color: 'from-green-600 to-emerald-500' },
    { icon: '🤖', title: ar ? 'مساعد AI محاسبي' : 'AI Accounting Assistant', desc: ar ? 'Claude Sonnet 4.6 — يجيب عن الضرائب والمحاسبة المصرية ويصلح أخطاء ETA' : 'Claude Sonnet 4.6 — answers Egyptian tax & accounting questions, fixes ETA errors', tags: ['Claude AI', 'SSE Streaming'], color: 'from-indigo-600 to-purple-500' },
    { icon: '🔍', title: ar ? 'كشف الاحتيال Benford' : "Fraud Detection — Benford's Law", desc: ar ? 'تحليل χ² للأرقام المحاسبية. ينبه عند اكتشاف تلاعب في البيانات.' : 'χ² analysis of accounting numbers. Alerts on detected manipulation.', tags: ["Benford χ²", ar?'تنبيه':'Alert'], color: 'from-red-600 to-rose-500' },
    { icon: '📊', title: ar ? 'Treasury + Cash Runway' : 'Treasury + Cash Runway', desc: ar ? 'نقدية حرة/مقيدة + Runway بالشهور + رادار موازنة. يُحسَب كل ساعة.' : 'Free/restricted cash + Runway in months + budget radar. Calculated hourly.', tags: [ar?'كل ساعة':'Hourly', 'Cash Runway'], color: 'from-amber-600 to-yellow-500' },
    { icon: '🏗️', title: ar ? 'محرك المقاولات' : 'Contracting Engine', desc: ar ? 'مستخلصات + تأمين 5% + LGs + مقاولو الباطن + ضريبة جدول 2% + BOQ variance' : 'Claims + 5% retention + LGs + subcontractors + 2% table tax + BOQ variance', tags: [ar?'مستخلصات':'Claims', 'LGs', 'BOQ'], color: 'from-blue-600 to-blue-500' },
    { icon: '📥', title: ar ? 'استيراد Excel ذكي' : 'Smart Excel Import', desc: ar ? 'شجرة حسابات + أرصدة + موظفين + مخزون. تحقق Dr=Cr تلقائي.' : 'Chart of accounts + balances + employees + inventory. Auto Dr=Cr check.', tags: ['Dry-Run', 'Dr=Cr'], color: 'from-teal-600 to-cyan-500' },
  ];

  const verticals = [
    { id: 'co', icon: '🏗️', label: ar ? 'مقاولات' : 'Contracting', price: 150,
      items: ar
        ? ['مستخلصات الملاك مع خصم تأمين 5%','مقاولو الباطن + ضريبة جدول 2%','خطابات ضمان LGs مع تنبيه انتهاء','ربحية فعلي vs BOQ','استرداد الدفعات المقدمة','ESS: مقاولو الباطن يتابعون مستحقاتهم']
        : ['Owner claims with 5% retention','Subcontractors + 2% table tax','LGs with expiry alerts','Actual vs BOQ profitability','Advance recovery','ESS: subcontractors track dues'] },
    { id: 'med', icon: '🏥', label: ar ? 'طبي' : 'Medical', price: 120,
      items: ar
        ? ['تقسيم إيراد العيادة: نسبة المستشفى / أمانة طبيب','خصم مهن حرة 5% تلقائياً','مطالبات التأمين مع تتبع الرفض','ESS: أطباء وممرضون يتابعون بدلاتهم']
        : ['Clinic revenue split: hospital % / doctor trust','5% liberal profession deduction auto','Insurance claims with rejection tracking','ESS: doctors track their allowances'] },
    { id: 'mfg', icon: '🏭', label: ar ? 'تصنيع' : 'Manufacturing', price: 200,
      items: ar
        ? ['خامات → WIP → منتج تام مع Landed Cost','فارق التكلفة: فعلي vs تقديري','معدل الهدر Scrap Rate%','ESS: ورديات عمال الإنتاج GPS']
        : ['Raw → WIP → finished with Landed Cost','Cost variance: actual vs estimated','Scrap Rate%','ESS: production workers GPS shifts'] },
    { id: 'trd', icon: '🛒', label: ar ? 'تجاري' : 'Trading', price: 180,
      items: ar
        ? ['اعتماد مستندي LC — 4 مراحل مع Landed Cost','جمارك ACI/ACID تلقائياً','مخزون FIFO / AVCO / LIFO','ESS: مندوبي المبيعات يتابعون عمولاتهم']
        : ['LC documentary credit — 4 stages with Landed Cost','ACI/ACID customs auto','FIFO / AVCO / LIFO inventory','ESS: sales reps track commissions'] },
    { id: 're', icon: '🏠', label: ar ? 'عقاري' : 'Real Estate', price: 160,
      items: ar
        ? ['إيراد مؤجل EAS 48 بنسبة الإنجاز','جدول تحصيل الأقساط مع تنبيه التأخر','ربحية كل مشروع/برج منفصلة','ESS: فريق المبيعات يتابع عمولاتهم']
        : ['Deferred revenue EAS 48 by completion %','Installment schedule with delay alerts','Per-project/tower profitability','ESS: sales team tracks commissions'] },
  ];

  const compareRows = [
    { feat: ar?'فاتورة إلكترونية ETA':'ETA E-Invoice', dl: ar?'✓ مكتمل':'✓ Complete', qb:'✗', od:ar?'جزئي':'Partial', sap:ar?'بإضافة':'Add-on', local:ar?'متفاوت':'Varies' },
    { feat: ar?'مسير رواتب قانون 148/2019':'Payroll Law 148/2019', dl:ar?'✓ 7 شرائح':'✓ 7 Brackets', qb:'✗', od:ar?'جزئي':'Partial', sap:ar?'بإضافة':'Add-on', local:'✓' },
    { feat: ar?'بوابة ESS للموظفين + GPS':'ESS Portal + GPS', dl:ar?'✓ متكامل':'✓ Integrated', qb:'✗', od:ar?'محدود':'Limited', sap:ar?'Enterprise فقط':'Enterprise Only', local:'✗' },
    { feat: ar?'صلاحيات متدرجة':'Role-Based Permissions', dl:ar?'✓ مرن':'✓ Flexible', qb:ar?'محدود':'Limited', od:'✓', sap:'✓', local:ar?'متفاوت':'Varies' },
    { feat: ar?'مساعد AI محاسبي':'AI Accounting Assistant', dl:'✓ Claude AI', qb:'✗', od:'✗', sap:'✗', local:'✗' },
    { feat: ar?'كشف الاحتيال Benford':'Benford Fraud Detection', dl:'✓', qb:'✗', od:'✗', sap:ar?'Enterprise فقط':'Enterprise', local:'✗' },
    { feat: ar?'Treasury + Cash Runway':'Treasury + Cash Runway', dl:'✓', qb:'✗', od:'✗', sap:'✓', local:'✗' },
    { feat: ar?'محركات القطاعات المصرية':'Egyptian Sector Engines', dl:ar?'✓ 5 قطاعات':'✓ 5 Sectors', qb:'✗', od:ar?'محدود':'Limited', sap:ar?'بإضافة':'Add-on', local:ar?'متفاوت':'Varies' },
    { feat: ar?'نسخ احتياطي 3-2-1 مشفر':'Encrypted 3-2-1 Backup', dl:ar?'✓ تلقائي':'✓ Auto', qb:ar?'سحابي':'Cloud', od:ar?'يدوي':'Manual', sap:'✓', local:'✗' },
    { feat: ar?'سعر الشركة الصغيرة':'SME Price', dl:ar?'299 ج.م/شهر':'EGP 299/mo', qb:ar?'1,200+ ج.م':'EGP 1,200+', od:ar?'900+ ج.م':'EGP 900+', sap:ar?'3,000+ ج.م':'EGP 3,000+', local:ar?'500-800 ج.م':'EGP 500-800' },
    { feat: ar?'وقت التهيئة':'Setup Time', dl:ar?'30 دقيقة':'30 Minutes', qb:ar?'يومان':'2 Days', od:ar?'أسبوع+':'Week+', sap:ar?'شهر+':'Month+', local:ar?'3-7 أيام':'3-7 Days' },
  ];

  const faqs = [
    { q: ar?'هل الموظف يرى رواتب زملائه؟':'Can employees see each other\'s salaries?', a: ar?'لا إطلاقاً. الموظف معزول في بوابة ESS ولا يرى أي بيانات الشركة أو الزملاء. الرقم القومي والـ IBAN مخفيان جزئياً.':'Absolutely not. The employee is isolated in ESS and cannot see any company or colleague data. National ID and IBAN are partially hidden.' },
    { q: ar?'كيف أمنح موظفاً صلاحية إضافية؟':'How to grant an employee additional permission?', a: ar?'إدارة المستخدمين → اختر الموظف → صلاحيات → فعّل الوحدة. تُطبَّق فوراً. HR Manager والمدير المالي يملكان هذه الصلاحية أيضاً.':'User Management → Select employee → Permissions → Activate module. Applied immediately. HR Manager and Financial Manager can also grant permissions.' },
    { q: ar?'هل النظام معتمد من هيئة الضرائب المصرية؟':'Is the system certified by the Egyptian Tax Authority?', a: ar?'نعم — يرسل الفواتير مباشرة لمنظومة ETA بتوقيع CAdES-BES ويولد نماذج 41 و10 جاهزة للتقديم.':'Yes — sends invoices directly to ETA with CAdES-BES signature and generates forms 41 & 10 ready for submission.' },
    { q: ar?'كيف يعمل تسجيل الحضور GPS؟':'How does GPS attendance work?', a: ar?'الموظف يضغط "تسجيل حضور" من بوابة ESS → النظام يحدد موقعه ويتحقق من المسافة من مقر العمل → يسجل مع الإحداثيات والوقت الفعلي.':'Employee taps "Check In" from ESS portal → System detects location and verifies distance from workplace → Records with coordinates and real time.' },
    { q: ar?'هل يمكن الترقية أو الإلغاء في أي وقت؟':'Can I upgrade or cancel anytime?', a: ar?'نعم من داخل التطبيق. الترقية فورية. الإلغاء يحفظ بياناتك 90 يوماً مع تصدير كامل JSON/Excel/CSV.':'Yes, from inside the app. Upgrade is immediate. Cancellation keeps your data for 90 days with full JSON/Excel/CSV export.' },
    { q: ar?'ما طرق الدفع المتاحة؟':'What payment methods are available?', a: ar?'InstaPay (01006008552) · فودافون كاش (01012625529) · PayPal (dalia_abouelmagd@hotmail.com) · تحويل بنكي. الفاتورة الضريبية مع VAT 14% تُرسَل تلقائياً.':'InstaPay (01006008552) · Vodafone Cash (01012625529) · PayPal (dalia_abouelmagd@hotmail.com) · Bank transfer. Tax invoice with 14% VAT sent automatically.' },
  ];

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="font-sans bg-[#060c1a] text-gray-200 overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060c1a]/95 backdrop-blur shadow-lg border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <DataLifeLogo className="h-10" />
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button onClick={() => navigate('/login')}
              className="hidden sm:block text-sm font-semibold text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all">
              {ar ? 'تسجيل الدخول' : 'Login'}
            </button>
            <button onClick={() => setTrialOpen(true)}
              className="text-sm font-bold px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/25">
              {ar ? 'ابدأ مجاناً' : 'Start Free'}
            </button>
            <button className="md:hidden text-gray-300" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-[#0a1020] border-t border-white/5 px-4 py-4 space-y-2">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)}
                className="block w-full text-start text-sm text-gray-300 hover:text-white py-2">
                {l.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center justify-center text-center px-4 pt-16 relative overflow-hidden"
        style={{background:'radial-gradient(ellipse 80% 60% at 50% -5%, rgba(30,64,175,.5), transparent 65%), #060c1a'}}>
        <div className="absolute inset-0 opacity-20"
          style={{backgroundImage:'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)',backgroundSize:'52px 52px'}}/>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
            {ar ? 'مُطابق لهيئة الضرائب المصرية ETA 2024' : 'Certified — Egyptian Tax Authority ETA 2024'}
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            {ar ? (<>نظام ERP المحاسبي<br className="hidden md:block"/><span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"> المصري الأكثر اكتمالاً</span></>) : (<>Egypt&apos;s Most Complete<br/><span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Accounting ERP</span></>)}
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {ar ? 'فاتورة ETA · رواتب قانون 148/2019 · بوابة موظف ESS · مساعد AI محاسبي · تنبيهات ذكية تُصلح نفسها تلقائياً' : 'ETA Invoice · Payroll Law 148/2019 · ESS Employee Portal · AI Accounting Assistant · Smart self-healing alerts'}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-14">
            <button onClick={() => setTrialOpen(true)}
              className="px-8 py-4 rounded-xl font-bold text-base bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-xl shadow-amber-500/30 hover:from-amber-400 hover:to-orange-400 transition-all hover:-translate-y-0.5">
              {ar ? 'ابدأ التجربة المجانية' : 'Start Free Trial'}
            </button>
            <button onClick={() => scrollTo('#features')}
              className="px-8 py-4 rounded-xl font-bold text-base bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              {ar ? '🎬 استعرض المميزات' : '🎬 Explore Features'}
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-8 pt-8 border-t border-white/5">
            {[{n:'946+',l:ar?'نقطة API':'API Points'},{n:'89+',l:ar?'محرك متخصص':'Engines'},{n:'99.5%',l:'SLA'},{n:'100%',l:ar?'امتثال ETA':'ETA Compliant'}].map((s,i)=>(
              <div key={i} className="text-center">
                <div className="text-2xl md:text-3xl font-black text-white">{s.n}</div>
                <div className="text-xs text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div className="bg-[#0a1020]/80 border-y border-white/5 py-3">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-6">
          {[ar?'🔒 AES-256 تشفير':'🔒 AES-256 Encryption', ar?'📋 قانون 151/2020':'📋 Law 151/2020', ar?'🧾 فاتورة ETA معتمدة':'🧾 ETA Certified', ar?'🤖 مساعد AI 24/7':'🤖 AI Assistant 24/7', ar?'👤 بوابة ESS للموظفين':'👤 ESS Employee Portal', ar?'⚡ نسخ احتياطي 3-2-1':'⚡ 3-2-1 Backup'].map((t,i)=>(
            <span key={i} className="text-xs font-semibold text-gray-500">{t}</span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">{ar?'المحركات والميزات':'Engines & Features'}</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{ar?'89 محرك — 946 نقطة API':'89 Engines — 946 API Points'}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{ar?'مبني من الأساس للبيئة المصرية. لا حلول مستوردة تحتاج تكييف.':'Built from scratch for the Egyptian environment. No imported solutions needing adaptation.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f,i)=>(
              <div key={i} className="bg-white/3 border border-white/7 rounded-2xl p-6 hover:border-white/15 hover:-translate-y-1 transition-all relative overflow-hidden group">
                <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${f.color} opacity-0 group-hover:opacity-100 transition-opacity`}/>
                {f.isNew && <span className="absolute top-3 left-3 text-xs font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-black">{ar?'جديد':'New'}</span>}
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{f.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.tags.map((t,j)=><span key={j} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-gray-500 font-medium">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ESS SECTION ── */}
      <section id="ess" className="py-24 px-4 bg-gradient-to-br from-purple-950/40 to-[#060c1a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">{ar?'جديد — بوابة الموظف الذاتية':'New — Employee Self-Service'}</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">{ar?'كل موظف يرى بياناته فقط':'Every Employee Sees Their Own Data Only'}</h2>
            <p className="text-gray-400 max-w-xl mx-auto">{ar?'عند تسجيل الدخول يُوجَّه الموظف تلقائياً لبوابته الخاصة — عزل كامل وأمان تام':'Employee is automatically directed to their personal portal — complete isolation and full security'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-purple-500/8 border border-purple-500/20 rounded-2xl p-6">
                <h3 className="font-bold text-purple-200 mb-4 flex items-center gap-2"><span>📱</span>{ar?'ما يراه الموظف':'What the Employee Sees'}</h3>
                <ul className="space-y-2.5">
                  {(ar?['بياناته الشخصية + صورة قابلة للتحديث','راتبه الأساسي + البدلات + الخصومات + الصافي','سجل مسيرات الرواتب + تحميل قسيمة PDF','أرصدة الإجازات: سنوية / عارضة / مرضية','تسجيل حضور وانصراف بالموقع الجغرافي GPS','رفع مستندات + عرض وثائقه الشخصية','تقديم طلبات: إجازة · سلفة · وقت إضافي']:['Personal data + updatable photo','Base salary + allowances + deductions + net','Payroll history + PDF payslip download','Leave balances: annual / casual / sick','GPS check-in/check-out attendance','Upload documents + view personal files','Submit requests: leave · advance · overtime']).map((item,i)=>(
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-teal-400 font-bold flex-shrink-0 mt-0.5">✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
                <h3 className="font-bold text-red-400 mb-3 text-sm flex items-center gap-2"><span>🔒</span>{ar?'ما لا يستطيع رؤيته':'What They Cannot See'}</h3>
                <ul className="space-y-1.5">
                  {(ar?['رواتب أو بيانات أي موظف آخر','الحسابات المالية أو الفواتير','بيانات العملاء أو الموردين','لوحة التحكم الرئيسية بأي حال']:['Salaries or data of other employees','Financial accounts or invoices','Customer or supplier data','Main dashboard under any circumstance']).map((item,i)=>(
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">✗</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-white/3 border border-purple-500/15 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-5 flex items-center gap-2"><span>🛡️</span>{ar?'منظومة الصلاحيات':'Permissions System'}</h3>
              <div className="space-y-4">
                {[
                  {icon:'👑',role:ar?'المدير العام / CEO':'General Manager / CEO',desc:ar?'وصول كامل + منح/سحب صلاحيات أي مستخدم':'Full access + grant/revoke any user permissions',color:'border-amber-500/25 bg-amber-500/5'},
                  {icon:'🧑‍💼',role:ar?'مدير HR / المالي':'HR / Financial Manager',desc:ar?'يمنح صلاحيات إضافية للموظفين من لوحة المستخدمين':'Grants additional permissions from user management',color:'border-teal-500/25 bg-teal-500/5'},
                  {icon:'👤',role:ar?'الموظف العادي':'Regular Employee',desc:ar?'ESS فقط — بوابته الذاتية. منح صلاحية يفتح الوحدة':'ESS only — personal portal. Permission opens module',color:'border-blue-500/25 bg-blue-500/5'},
                ].map((p,i)=>(
                  <div key={i} className={`flex gap-3 p-4 rounded-xl border ${p.color}`}>
                    <div className="text-2xl flex-shrink-0">{p.icon}</div>
                    <div><div className="font-bold text-white text-sm">{p.role}</div><div className="text-gray-500 text-xs mt-1">{p.desc}</div></div>
                  </div>
                ))}
                <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3 mt-2">
                  <p className="text-green-400 text-xs font-semibold">✅ {ar?'الموظف يرى وحدة إضافية فقط لو منحه المدير صلاحيتها — إلغاء الصلاحية يُعيده لـ ESS فوراً':'Employee sees extra module only if granted by manager — revoking returns them to ESS instantly'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERTICALS ── */}
      <section id="verticals" className="py-24 px-4 bg-[#0a1020]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">{ar?'القطاعات المدعومة':'Supported Sectors'}</div>
            <h2 className="text-4xl font-black text-white mb-4">{ar?'محرك مخصص لكل قطاع':'Dedicated Engine for Each Sector'}</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {verticals.map(v=>(
              <button key={v.id} onClick={()=>setActiveVertical(v.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeVertical===v.id?'bg-blue-600 text-white':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          {verticals.filter(v=>v.id===activeVertical).map(v=>(
            <div key={v.id} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div>
                <ul className="space-y-3">
                  {v.items.map((item,i)=>(
                    <li key={i} className="flex items-start gap-3 text-gray-400">
                      <span className="text-teal-400 font-black flex-shrink-0 mt-0.5">✓</span>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 px-4 py-3 rounded-xl bg-teal-500/8 border border-teal-500/20 text-teal-400 text-sm font-semibold">
                  💡 {ar?`إضافة ${v.label}: ${v.price} ج.م/شهر — مدمجة في الاحترافي`:`${v.label} Add-on: EGP ${v.price}/mo — included in Professional`}
                </div>
              </div>
              <div className="bg-white/3 border border-white/7 rounded-2xl p-6">
                <div className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">{ar?'مؤشرات نموذجية':'Sample KPIs'}</div>
                {[
                  {l:ar?'إيراد الشهر':'Monthly Revenue', v:ar?'٢.٨٥ م ج.م':'EGP 2.85M', c:'text-amber-400'},
                  {l:ar?'معدل الاسترداد':'Recovery Rate', v:'94.2%', c:'text-green-400'},
                  {l:ar?'مشاريع نشطة':'Active Projects', v:'12', c:'text-blue-400'},
                  {l:ar?'تنبيهات معلقة':'Pending Alerts', v:'3 ⚠️', c:'text-red-400'},
                ].map((s,i)=>(
                  <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <span className="text-sm text-gray-500">{s.l}</span>
                    <span className={`text-sm font-bold ${s.c}`}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">{ar?'الأسعار والخطط':'Pricing Plans'}</div>
            <h2 className="text-4xl font-black text-white mb-4">{ar?'شفافية كاملة — تُناسب السوق المصري':'Full Transparency — Tailored for Egyptian Market'}</h2>
          </div>
          <PricingSection />
        </div>
      </section>

      {/* ── COMPARE ── */}
      <section id="compare" className="py-24 px-4 bg-[#0a1020]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">{ar?'مقارنة شاملة':'Full Comparison'}</div>
            <h2 className="text-4xl font-black text-white mb-4">{ar?'DataLife مقابل البدائل':'DataLife vs Alternatives'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right py-3 px-4 text-gray-500 font-semibold w-1/3">{ar?'الميزة':'Feature'}</th>
                  <th className="py-3 px-4 text-amber-400 font-bold bg-amber-500/5 rounded-t-lg">DataLife ⭐</th>
                  <th className="py-3 px-4 text-gray-500">QuickBooks</th>
                  <th className="py-3 px-4 text-gray-500">Odoo</th>
                  <th className="py-3 px-4 text-gray-500">SAP B1</th>
                  <th className="py-3 px-4 text-gray-500">{ar?'برامج محلية':'Local SW'}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r,i)=>(
                  <tr key={i} className={`border-b border-white/5 ${i%2===0?'bg-white/1':''}`}>
                    <td className="py-3 px-4 text-gray-300 font-medium">{r.feat}</td>
                    <td className="py-3 px-4 text-center text-green-400 font-semibold bg-amber-500/3">{r.dl}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{r.qb}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{r.od}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{r.sap}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{r.local}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 p-4 rounded-xl bg-green-500/8 border border-green-500/20 text-green-400 text-sm font-semibold text-center">
            🏆 {ar?'DataLife الوحيد في السوق المصري يجمع: ETA كامل + AI محاسبي + ESS موظفين + Benford + Cash Runway + تنبيهات ذكية — في منصة واحدة':'DataLife is the only platform in the Egyptian market combining: full ETA + AI accounting + ESS + Benford + Cash Runway + smart alerts — in one platform'}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">{ar?'أسئلة شائعة':'FAQ'}</div>
            <h2 className="text-4xl font-black text-white">{ar?'إجابات واضحة بدون تعقيد':'Clear Answers Without Complexity'}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f,i)=>(
              <div key={i} className="bg-white/3 border border-white/7 rounded-xl overflow-hidden">
                <button onClick={()=>setFaqOpen(faqOpen===i?null:i)}
                  className="w-full flex items-center justify-between p-5 text-start">
                  <span className="font-semibold text-white text-sm">{f.q}</span>
                  {faqOpen===i ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
                </button>
                {faqOpen===i && <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 text-center"
        style={{background:'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(30,64,175,.3), transparent 68%), #0a1020'}}>
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/>
            {ar?'جاهز للتشغيل التجاري الآن':'Ready for Commercial Operation Now'}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            {ar?<>ابدأ اليوم — التجربة <span className="text-amber-400">مجانية 30 يوماً</span></>:<>Start Today — <span className="text-amber-400">30 Days Free</span></>}
          </h2>
          <p className="text-gray-400 mb-10">{ar?'إعداد في 30 دقيقة، صلاحيات مرنة لكل فريقك، مساعد AI يجيب على أسئلتك فوراً.':'Setup in 30 minutes, flexible permissions for your team, AI assistant answers instantly.'}</p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <button onClick={()=>setTrialOpen(true)}
              className="px-8 py-4 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-xl shadow-amber-500/30 hover:-translate-y-0.5 transition-all">
              {ar?'ابدأ التجربة المجانية':'Start Free Trial'}
            </button>
            <a href="mailto:sales@datalifeai.com"
              className="px-8 py-4 rounded-xl font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              📞 {ar?'تواصل مع المبيعات':'Contact Sales'}
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
            {[ar?'🔒 بدون بطاقة ائتمان':'🔒 No credit card',ar?'⚡ إعداد 30 دقيقة':'⚡ 30 min setup',ar?'👤 ESS للموظفين فوراً':'👤 ESS instantly',ar?'🤖 AI 24/7':'🤖 AI 24/7',ar?'📤 تصدير بياناتك دائماً':'📤 Export anytime'].map((t,i)=><span key={i}>{t}</span>)}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-24 px-4 bg-[#0a1020]">
        <ContactSection />
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#060c1a] border-t border-white/5 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 pb-10 border-b border-white/5">
            <div className="col-span-2 md:col-span-1">
              <DataLifeLogo className="h-10 mb-4"/>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">{ar?'نظام ERP المحاسبي المصري المتكامل — فاتورة ETA · رواتب · ESS · AI · تنبيهات ذكية':'Egyptian integrated accounting ERP — ETA · Payroll · ESS · AI · Smart alerts'}</p>
              <div className="flex flex-wrap gap-2">
                {['InstaPay','Vodafone Cash','PayPal',ar?'تحويل بنكي':'Bank Transfer'].map((p,i)=>(
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/4 text-gray-600 border border-white/5">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">{ar?'المنتج':'Product'}</div>
              <ul className="space-y-2.5">
                {[{l:ar?'المميزات':'Features',h:'#features'},{l:ar?'بوابة ESS':'ESS Portal',h:'#ess'},{l:ar?'القطاعات':'Verticals',h:'#verticals'},{l:ar?'الأسعار':'Pricing',h:'#pricing'},{l:ar?'المقارنة':'Compare',h:'#compare'}].map((l,i)=>(
                  <li key={i}><button onClick={()=>scrollTo(l.h)} className="text-xs text-gray-600 hover:text-white transition-colors">{l.l}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">{ar?'قانوني':'Legal'}</div>
              <ul className="space-y-2.5">
                {[ar?'سياسة الخصوصية':'Privacy Policy',ar?'سياسة الموقع':'Terms',ar?'شروط الاشتراك':'Subscription Terms','SLA',ar?'الأمان':'Security'].map((l,i)=>(
                  <li key={i}><a href="#" className="text-xs text-gray-600 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">{ar?'للتواصل':'Contact'}</div>
              <ul className="space-y-2.5">
                {['info@datalifeai.com','support@datalifeai.com','01006008552 واتساب','datalifeaccount.com'].map((l,i)=>(
                  <li key={i}><span className="text-xs text-gray-600">{l}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-gray-700">© 2026 DataLife AI — {ar?'جميع الحقوق محفوظة | القاهرة، مصر':'All rights reserved | Cairo, Egypt'}</p>
            <p className="text-xs text-gray-700">{ar?'المحتوى القانوني قيد المراجعة القانونية النهائية':'Legal content pending final legal review'}</p>
          </div>
        </div>
      </footer>

      {trialOpen && <FreeTrialModal onClose={() => setTrialOpen(false)} />}
    </div>
  );
}
