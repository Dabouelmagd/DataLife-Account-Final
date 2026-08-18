import React, { useState } from 'react';
import { CheckCircle, X, Zap, Building2, Crown, Key } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../hooks/useCurrency';
import { toast } from 'sonner';
import PaymentModal from './PaymentModal';
import { Input } from './ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PricingSection = () => {
  const { language } = useLanguage();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const { currency: detectedCurrency } = useCurrency();
  const [currency, setCurrency] = useState('EGP');
  React.useEffect(() => { setCurrency(detectedCurrency); }, [detectedCurrency]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subCode, setSubCode] = useState('');
  const [subDuration, setSubDuration] = useState('');
  const [activating, setActivating] = useState(false);
  const [activeTab, setActiveTab] = useState('plans'); // plans | compare | faq

  const ar = language === 'ar';
  const exchangeRate = 30;

  const plans = [
    {
      id: 'starter',
      name: ar ? 'المبتدئ' : 'Starter',
      tagline: ar ? 'للشركات الصغيرة والناشئة' : 'For small & startup businesses',
      employees: ar ? 'حتى 10 موظفين' : 'Up to 10 employees',
      monthlyEGP: 299, annualEGP: 2390,
      monthlyUSD: 10,  annualUSD: 80,
      icon: <Zap className="h-6 w-6" />,
      iconBg: 'linear-gradient(135deg,#3b82f6,#6366f1)',
      border: 'rgba(99,102,241,0.3)',
      badge: null,
      popular: false,
      highlight: [],
      features: {
        [ar?'الموارد البشرية':'HR']: [
          ar?'إدارة الموظفين الأساسية':'Basic employee management',
          ar?'الحضور والانصراف (يدوي)':'Manual attendance',
          ar?'الإجازات العارضة والسنوية':'Leave management',
          ar?'كشف مرتبات يدوي':'Manual payroll',
          ar?'ملف موظف + صورة + مستندات':'Employee profile + docs',
        ],
        [ar?'المحاسبة':'Accounting']: [
          ar?'108 حساب وفق الدليل المصري':'108 Egyptian standard accounts',
          ar?'القيود اليومية والأستاذ العام':'Journal entries & general ledger',
          ar?'ميزان المراجعة':'Trial balance',
          ar?'قائمة الدخل والميزانية العمومية':'P&L & balance sheet',
        ],
        [ar?'المبيعات والفواتير':'Sales']: [
          ar?'الفواتير الأساسية':'Basic invoicing',
          ar?'إدارة العملاء والموردين':'Customers & suppliers',
          ar?'المخزون الأساسي':'Basic inventory',
        ],
        [ar?'الدعم':'Support']: [
          ar?'دعم بريد إلكتروني':'Email support',
          ar?'5 جيجا تخزين':'5 GB storage',
          ar?'فاتورة بعد الدفع (PDF)':'Invoice after payment (PDF)',
        ],
      },
      notIncluded: [
        ar?'كشف المرتبات التلقائي (قانون 148/2019)':'Auto payroll (Law 148/2019)',
        ar?'حضور GPS':'GPS attendance',
        ar?'قسيمة راتب بالإيميل':'Email payslips',
        ar?'الفاتورة الإلكترونية ETA':'E-Invoice (ETA)',
        ar?'إدارة المشاريع والمقاولات':'Projects & contracting',
        ar?'بنوك وتسويات':'Banking & reconciliation',
        ar?'فروع متعددة':'Multi-branch',
      ],
    },
    {
      id: 'professional',
      name: ar ? 'المحترف' : 'Professional',
      tagline: ar ? 'للشركات المتوسطة والنامية' : 'For growing medium businesses',
      employees: ar ? '11 – 100 موظف' : '11 – 100 employees',
      monthlyEGP: 799, annualEGP: 6392,
      monthlyUSD: 27,  annualUSD: 213,
      icon: <Building2 className="h-6 w-6" />,
      iconBg: 'linear-gradient(135deg,#0f1729,#28376B)',
      border: '#28376B',
      badge: ar ? '⭐ الأكثر مبيعاً' : '⭐ Best Seller',
      popular: true,
      highlight: [
        ar?'كشف مرتبات تلقائي قانون 148/2019':'Auto payroll Law 148/2019',
        ar?'حضور GPS مع نطاق جيوفنسينج':'GPS geofencing attendance',
        ar?'قسيمة راتب PDF بالإيميل':'PDF payslip via email',
        ar?'صرف مرتبات للبنك / InstaPay / Vodafone':'Salary disbursement: Bank / InstaPay',
        ar?'الفاتورة الإلكترونية ETA':'E-Invoice ETA',
      ],
      features: {
        [ar?'الموارد البشرية':'HR']: [
          ar?'كل مميزات المبتدئ':'All Starter HR features',
          ar?'كشف مرتبات تلقائي (قانون 148/2019 + قانون 91/2005)':'Auto payroll (Law 148/2019 + 91/2005)',
          ar?'7 صناديق تأمينات اجتماعية':'7 social insurance funds',
          ar?'ضريبة كسب العمل 7 شرائح تصاعدية':'Income tax 7 progressive brackets',
          ar?'حضور GPS مع جيوفنسينج':'GPS attendance + geofencing',
          ar?'قسيمة راتب HTML/PDF بالإيميل':'HTML/PDF payslip by email',
          ar?'صرف مرتبات: بنك / InstaPay / فودافون / نقدي':'Disbursement: Bank / InstaPay / Vodafone / Cash',
          ar?'تقرير التحويلات البنكية (CSV)':'Bank transfer report (CSV)',
          ar?'الورديات وجدول الحضور':'Shifts & attendance schedule',
          ar?'إنهاء الخدمة والمكافآت':'End of service & gratuity',
          ar?'تتبع جلسات الموظفين (دخول/خروج)':'Employee session tracking',
          ar?'دعوة موظف بصلاحيات تلقائية':'Employee invite with auto-permissions',
        ],
        [ar?'المحاسبة المالية':'Accounting']: [
          ar?'كل مميزات المبتدئ المحاسبية':'All Starter accounting',
          ar?'VAT (ضريبة القيمة المضافة)':'VAT management',
          ar?'خصم وتحصيل ضريبي 1%':'Withholding tax 1%',
          ar?'الأصول الثابتة والإهلاك':'Fixed assets & depreciation',
          ar?'التسويات البنكية':'Bank reconciliation',
          ar?'متعدد العملات (6 عملات)':'Multi-currency (6)',
          ar?'محاسبة Immutable Ledger (قيود لا تُحذف)':'Immutable Ledger accounting',
        ],
        [ar?'المبيعات والفواتير':'Sales']: [
          ar?'الفاتورة الإلكترونية ETA':'E-Invoice (ETA)',
          ar?'إدارة المبيعات CRM':'Sales CRM',
          ar?'عروض الأسعار والاشتراكات':'Quotations & subscriptions',
          ar?'المشتريات وأوامر التوريد':'Purchases & supply orders',
          ar?'المخزون المتقدم':'Advanced inventory',
        ],
        [ar?'الدعم والأدوات':'Support']: [
          ar?'دعم أولوية (بريد + تذاكر)':'Priority support (email + tickets)',
          ar?'25 جيجا تخزين':'25 GB storage',
          ar?'الموافقات والتفويضات':'Approvals & delegation',
          ar?'إشعارات Push Real-time':'Real-time push notifications',
        ],
      },
      notIncluded: [
        ar?'إدارة المشاريع والمقاولات':'Projects & contracting',
        ar?'مستخلصات المقاولات (معيار 8)':'Progress claims (Std 8)',
        ar?'قطاع طبي وأتعاب أطباء':'Medical sector',
        ar?'مراكز التكلفة':'Cost centers',
        ar?'فروع متعددة':'Multi-branch',
        ar?'مدير حساب مخصص':'Dedicated account manager',
      ],
    },
    {
      id: 'enterprise',
      name: ar ? 'المؤسسي' : 'Enterprise',
      tagline: ar ? 'للمؤسسات والشركات الكبيرة' : 'For large organizations',
      employees: ar ? 'موظفون غير محدودون' : 'Unlimited employees',
      monthlyEGP: 1499, annualEGP: 11992,
      monthlyUSD: 50,   annualUSD: 400,
      icon: <Crown className="h-6 w-6" />,
      iconBg: 'linear-gradient(135deg,#92400e,#f59e0b)',
      border: '#f59e0b',
      badge: ar ? '👑 المميز' : '👑 Premium',
      popular: false,
      highlight: [
        ar?'المشاريع والمقاولات (معيار محاسبي 8)':'Projects & contracting (Std 8)',
        ar?'مستخلصات المقاولات وجداول الكميات BOQ':'Progress claims & BOQ',
        ar?'قطاع طبي — فصل أتعاب الأطباء':'Medical sector — Doctor fee split',
        ar?'فروع متعددة ومراكز التكلفة':'Multi-branch & cost centers',
        ar?'مدير حساب مخصص + تدريب الفريق':'Dedicated account manager + training',
      ],
      features: {
        [ar?'كل مميزات المحترف +':'All Professional +']: [
          ar?'موظفون وحسابات غير محدودة':'Unlimited employees & accounts',
          ar?'إدارة المشاريع والمقاولات':'Projects & contracting management',
          ar?'مستخلصات المقاولات (معيار محاسبي مصري 8)':'Progress claims (Egyptian Std 8)',
          ar?'جداول الكميات (BOQ)':'Bill of Quantities (BOQ)',
          ar?'قطاع طبي — فصل أتعاب الأطباء':'Medical sector — Doctor fee split',
          ar?'مراكز التكلفة المتعددة':'Multiple cost centers',
          ar?'فروع متعددة':'Multi-branch',
          ar?'تكامل محاسبي Enterprise (SAP Level)':'Enterprise accounting (SAP level)',
          ar?'مراجعة ضريبية متقدمة':'Advanced tax review',
          ar?'ربط API للتكامل الخارجي':'External API integration',
        ],
        [ar?'الدعم المميز':'Premium Support']: [
          ar?'مدير حساب مخصص':'Dedicated account manager',
          ar?'تدريب الفريق on-site أو عبر الإنترنت':'Team training (on-site or online)',
          ar?'دعم هاتفي 24/7':'Phone support 24/7',
          ar?'SLA مضمون خلال 4 ساعات':'SLA guaranteed within 4 hours',
          ar?'تخزين غير محدود':'Unlimited storage',
        ],
      },
      notIncluded: [],
    },
  ];

  const comparisonFeatures = [
    { category: ar?'الأساسيات':'Basics' },
    { name: ar?'عدد الموظفين':'Employees',                               starter:'1-10',   professional:'11-100', enterprise:ar?'غير محدود':'Unlimited' },
    { name: ar?'المساحة التخزينية':'Storage',                            starter:'5 GB',   professional:'25 GB',  enterprise:ar?'غير محدود':'Unlimited' },
    { name: ar?'الدعم الفني':'Support',                                  starter:ar?'بريد':'Email', professional:ar?'أولوية':'Priority', enterprise:ar?'هاتف 24/7':'Phone 24/7' },
    { name: ar?'إشعارات Push Real-time':'Push Notifications',            starter:false,    professional:true,     enterprise:true },
    { name: ar?'متعدد العملات (6)':'Multi-currency',                     starter:false,    professional:true,     enterprise:true },

    { category: ar?'الموارد البشرية':'Human Resources' },
    { name: ar?'إدارة الموظفين + ملف + صورة':'Employee Management',     starter:true,     professional:true,     enterprise:true },
    { name: ar?'الحضور والانصراف':'Attendance',                          starter:ar?'يدوي':'Manual', professional:ar?'يدوي + GPS':'Manual + GPS', enterprise:ar?'يدوي + GPS':'Manual + GPS' },
    { name: ar?'حضور GPS مع جيوفنسينج':'GPS Geofencing Attendance',     starter:false,    professional:true,     enterprise:true },
    { name: ar?'الإجازات العارضة والسنوية':'Leave Management',           starter:true,     professional:true,     enterprise:true },
    { name: ar?'كشف مرتبات يدوي':'Manual Payroll',                       starter:true,     professional:true,     enterprise:true },
    { name: ar?'كشف مرتبات تلقائي (قانون 148/2019)':'Auto Payroll',     starter:false,    professional:true,     enterprise:true },
    { name: ar?'7 صناديق تأمينات اجتماعية':'7 Insurance Funds',         starter:false,    professional:true,     enterprise:true },
    { name: ar?'ضريبة كسب العمل (7 شرائح)':'Income Tax (7 brackets)',   starter:false,    professional:true,     enterprise:true },
    { name: ar?'قسيمة راتب PDF بالإيميل':'Email Payslips (PDF)',         starter:false,    professional:true,     enterprise:true },
    { name: ar?'صرف مرتبات: بنك / InstaPay / Vodafone':'Salary Disbursement', starter:false, professional:true,  enterprise:true },
    { name: ar?'تقرير تحويلات بنكية CSV':'Bank Transfer Report (CSV)',   starter:false,    professional:true,     enterprise:true },
    { name: ar?'تتبع جلسات الموظفين':'Employee Session Tracking',        starter:false,    professional:true,     enterprise:true },
    { name: ar?'الورديات':'Shifts',                                       starter:false,    professional:true,     enterprise:true },
    { name: ar?'إنهاء الخدمة والمكافآت':'End of Service & Gratuity',    starter:false,    professional:true,     enterprise:true },

    { category: ar?'المحاسبة المالية':'Financial Accounting' },
    { name: ar?'108 حساب (الدليل المصري)':'108 Accounts (Egyptian Std)', starter:true,    professional:true,     enterprise:true },
    { name: ar?'القيود اليومية والأستاذ العام':'Journal & General Ledger',starter:true,    professional:true,     enterprise:true },
    { name: ar?'ميزان المراجعة':'Trial Balance',                          starter:true,    professional:true,     enterprise:true },
    { name: ar?'قوائم مالية كاملة':'Full Financial Statements',           starter:true,    professional:true,     enterprise:true },
    { name: ar?'VAT وضريبة القيمة المضافة':'VAT',                        starter:false,   professional:true,     enterprise:true },
    { name: ar?'خصم وتحصيل ضريبي 1%':'Withholding Tax 1%',              starter:false,   professional:true,     enterprise:true },
    { name: ar?'الأصول الثابتة والإهلاك':'Fixed Assets & Depreciation',  starter:false,   professional:true,     enterprise:true },
    { name: ar?'التسويات البنكية':'Bank Reconciliation',                   starter:false,   professional:true,     enterprise:true },
    { name: ar?'Immutable Ledger (قيود لا تُحذف)':'Immutable Ledger',    starter:false,   professional:true,     enterprise:true },
    { name: ar?'مراكز التكلفة':'Cost Centers',                            starter:false,   professional:false,    enterprise:true },

    { category: ar?'المبيعات والفواتير':'Sales & Invoicing' },
    { name: ar?'الفواتير الأساسية':'Basic Invoicing',                     starter:true,    professional:true,     enterprise:true },
    { name: ar?'إدارة العملاء والموردين':'Customers & Suppliers',         starter:true,    professional:true,     enterprise:true },
    { name: ar?'إدارة المبيعات CRM':'Sales CRM',                          starter:false,   professional:true,     enterprise:true },
    { name: ar?'عروض الأسعار والاشتراكات':'Quotations & Subscriptions',   starter:false,   professional:true,     enterprise:true },
    { name: ar?'الفاتورة الإلكترونية ETA':'E-Invoice (ETA)',              starter:false,   professional:true,     enterprise:true },
    { name: ar?'المشتريات وأوامر التوريد':'Purchases & Supply Orders',    starter:false,   professional:true,     enterprise:true },
    { name: ar?'المخزون المتقدم':'Advanced Inventory',                    starter:'أساسي', professional:true,     enterprise:true },

    { category: ar?'المشاريع والمقاولات':'Projects & Contracting' },
    { name: ar?'إدارة المشاريع':'Project Management',                     starter:false,   professional:false,    enterprise:true },
    { name: ar?'مستخلصات المقاولات (معيار 8)':'Progress Claims (Std 8)', starter:false,   professional:false,    enterprise:true },
    { name: ar?'جداول الكميات BOQ':'Bill of Quantities (BOQ)',            starter:false,   professional:false,    enterprise:true },
    { name: ar?'قطاع طبي — أتعاب الأطباء':'Medical — Doctor Fees',       starter:false,   professional:false,    enterprise:true },

    { category: ar?'الأدوات المتقدمة':'Advanced Tools' },
    { name: ar?'الموافقات والتفويضات':'Approvals & Delegation',           starter:false,   professional:true,     enterprise:true },
    { name: ar?'استيراد بيانات Excel':'Excel Data Import',                starter:true,    professional:true,     enterprise:true },
    { name: ar?'فروع متعددة':'Multi-branch',                              starter:false,   professional:false,    enterprise:true },
    { name: ar?'ربط API':'API Integration',                               starter:false,   professional:false,    enterprise:true },
    { name: ar?'مدير حساب مخصص':'Dedicated Account Manager',             starter:false,   professional:false,    enterprise:true },
    { name: ar?'تدريب الفريق':'Team Training',                            starter:false,   professional:false,    enterprise:true },
    { name: ar?'SLA مضمون':'Guaranteed SLA',                              starter:false,   professional:false,    enterprise:true },
  ];

  const faqs = [
    { q: ar?'هل يمكنني تغيير خطتي لاحقاً؟':'Can I change my plan later?',
      a: ar?'نعم، يمكنك الترقية أو التخفيض في أي وقت. عند الترقية تدفع الفرق فقط.':'Yes, upgrade or downgrade anytime. On upgrade you only pay the difference.' },
    { q: ar?'ماذا يحدث بعد انتهاء 14 يوم التجربة؟':'What happens after the 14-day trial?',
      a: ar?'لن تُحذف بياناتك. ستحتاج فقط إلى اختيار خطة للاستمرار.':'Your data is safe. You just need to choose a plan to continue.' },
    { q: ar?'هل الأسعار شاملة ضريبة القيمة المضافة؟':'Are prices VAT inclusive?',
      a: ar?'نعم، جميع الأسعار المعروضة شاملة ضريبة القيمة المضافة (14%).':'Yes, all displayed prices include 14% VAT.' },
    { q: ar?'ما هي طرق الدفع المتاحة؟':'What payment methods are available?',
      a: ar?'فيزا / ماستركارد، InstaPay، فودافون كاش، تحويل بنكي، أو كود تفعيل.':'Visa/Mastercard, InstaPay, Vodafone Cash, bank transfer, or activation code.' },
    { q: ar?'هل بياناتي آمنة؟':'Is my data secure?',
      a: ar?'نعم، نستخدم تشفير SSL/TLS 1.3 وقواعد بيانات معزولة لكل شركة.':'Yes, we use SSL/TLS 1.3 encryption and isolated databases per company.' },
    { q: ar?'كيف يعمل نظام الرواتب وفق القانون المصري؟':'How does payroll work with Egyptian law?',
      a: ar?'النظام يطبق قانون 148/2019 (تأمينات) و91/2005 (ضريبة الدخل) تلقائياً مع 7 صناديق تأمين وضريبة تصاعدية.':'System auto-applies Law 148/2019 (insurance) & 91/2005 (income tax) with 7 funds and progressive tax.' },
  ];

  const getPrice = (plan) => {
    if (currency === 'USD') {
      return billingCycle === 'monthly' ? plan.monthlyUSD : plan.annualUSD;
    }
    return billingCycle === 'monthly' ? plan.monthlyEGP : plan.annualEGP;
  };

  const getSavings = (plan) => {
    if (currency === 'USD') return (plan.monthlyUSD * 12) - plan.annualUSD;
    return (plan.monthlyEGP * 12) - plan.annualEGP;
  };

  const handleSelect = (plan) => {
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  const handleActivateCode = async () => {
    if (!subCode.trim()) { toast.error(ar ? 'أدخل الكود' : 'Enter code'); return; }
    if (!subDuration) { toast.error(ar ? 'اختر مدة الاشتراك' : 'Choose duration'); return; }
    setActivating(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_URL}/api/subscriptions/activate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code: subCode.trim(), duration_months: parseInt(subDuration) }),
      });
      const data = await r.json();
      if (r.ok) {
        toast.success(ar ? `✅ تم تفعيل الكود! ${data.message || ''}` : `✅ Code activated! ${data.message || ''}`);
        setSubCode(''); setSubDuration('');
      } else {
        toast.error(data.detail || (ar ? 'كود غير صالح' : 'Invalid code'));
      }
    } catch { toast.error(ar ? 'خطأ في الاتصال' : 'Connection error'); }
    setActivating(false);
  };

  const renderCheck = (val) => {
    if (val === true) return <span className="text-emerald-500 text-lg">✓</span>;
    if (val === false) return <span className="text-gray-300 text-sm">—</span>;
    return <span className="text-xs text-gray-600 font-medium">{val}</span>;
  };

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="pricing-section">
      <style>{`
        .pricing-section { font-family: 'Cairo', 'Segoe UI', sans-serif; }
        .plan-card { transition: transform .2s, box-shadow .2s; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,.15); }
        .tab-btn { padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; }
        .tab-active { background: #28376B; color: #fff; }
        .tab-inactive { background: transparent; color: #64748b; }
        .tab-inactive:hover { background: #f1f5f9; }
        .feature-row:nth-child(even) { background: #f8fafc; }
        .cat-row { background: #0f1729; color: #fff; }
        @media(max-width:768px) { .plans-grid { grid-template-columns: 1fr !important; } .compare-table { font-size: 11px; } }
      `}</style>

      {/* ── Section header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(40,55,107,.08)', border:'1px solid rgba(40,55,107,.15)', borderRadius:20, padding:'4px 16px', marginBottom:16 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#28376B', letterSpacing:'.05em', textTransform:'uppercase' }}>{ar?'الأسعار والخطط':'Pricing & Plans'}</span>
        </div>
        <h2 style={{ fontSize:'clamp(24px,4vw,36px)', fontWeight:800, color:'#0f1729', marginBottom:10 }}>
          {ar ? 'خطة تناسب كل شركة' : 'A Plan for Every Business'}
        </h2>
        <p style={{ color:'#64748b', fontSize:15, maxWidth:520, margin:'0 auto' }}>
          {ar ? '14 يوم تجربة مجانية — بدون بطاقة ائتمان — تفعيل فوري' : '14-day free trial · No credit card · Instant activation'}
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:32, background:'#f1f5f9', borderRadius:12, padding:4, width:'fit-content', margin:'0 auto 32px' }}>
        {[['plans', ar?'خطط التسعير':'Pricing Plans'], ['compare', ar?'مقارنة تفصيلية':'Feature Comparison'], ['faq', ar?'الأسئلة الشائعة':'FAQ']].map(([id, label]) => (
          <button key={id} className={`tab-btn ${activeTab===id?'tab-active':'tab-inactive'}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ══════════════════ PLANS TAB ══════════════════ */}
      {activeTab === 'plans' && (
        <>
          {/* Billing toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:28 }}>
            <button onClick={() => setBillingCycle('monthly')} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid', fontSize:13, fontWeight:600, cursor:'pointer', background: billingCycle==='monthly'?'#0f1729':'transparent', color: billingCycle==='monthly'?'#fff':'#64748b', borderColor: billingCycle==='monthly'?'#0f1729':'#cbd5e1' }}>
              {ar?'شهري':'Monthly'}
            </button>
            <button onClick={() => setBillingCycle('annual')} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid', fontSize:13, fontWeight:600, cursor:'pointer', background: billingCycle==='annual'?'#0f1729':'transparent', color: billingCycle==='annual'?'#fff':'#64748b', borderColor: billingCycle==='annual'?'#0f1729':'#cbd5e1' }}>
              {ar?'سنوي':'Annual'} <span style={{ fontSize:11, color:'#10b981', fontWeight:700, marginRight:4 }}>-20%</span>
            </button>
            <div style={{ display:'flex', gap:6 }}>
              {['EGP','USD'].map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid', fontSize:12, fontWeight:700, cursor:'pointer', background: currency===c?'#f0c060':'transparent', color: currency===c?'#78350f':'#94a3b8', borderColor: currency===c?'#f0c060':'#e2e8f0' }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Plan cards */}
          <div className="plans-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, maxWidth:1100, margin:'0 auto 40px' }}>
            {plans.map(plan => (
              <div key={plan.id} className="plan-card" style={{ border:`2px solid ${plan.popular?plan.border:'#e2e8f0'}`, borderRadius:20, overflow:'hidden', background:'#fff', position:'relative' }}>
                {plan.badge && (
                  <div style={{ background: plan.popular?'#0f1729':'linear-gradient(135deg,#92400e,#f59e0b)', color:'#fff', textAlign:'center', fontSize:12, fontWeight:700, padding:'6px 0' }}>{plan.badge}</div>
                )}

                {/* Card header */}
                <div style={{ padding:'24px 24px 16px', background: plan.popular?'linear-gradient(135deg,#0f1729,#28376B)':'#fafafa', color: plan.popular?'#fff':'#0f1729' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:plan.iconBg, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>{plan.icon}</div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:800 }}>{plan.name}</div>
                      <div style={{ fontSize:11, opacity:.7 }}>{plan.employees}</div>
                    </div>
                  </div>
                  <p style={{ fontSize:12, opacity:.7, marginBottom:16, lineHeight:1.5 }}>{plan.tagline}</p>

                  {/* Price */}
                  <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                    <span style={{ fontSize:38, fontWeight:900 }}>{getPrice(plan).toLocaleString()}</span>
                    <span style={{ fontSize:13, opacity:.7 }}>{currency === 'USD' ? '$' : 'ج.م'} / {ar?'شهر':'mo'}</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <div style={{ fontSize:11, color:'#10b981', fontWeight:700, marginTop:4 }}>
                      {ar?`وفر ${getSavings(plan).toLocaleString()} ${currency==='USD'?'$':'ج.م'} سنوياً`:`Save ${getSavings(plan).toLocaleString()} ${currency==='USD'?'USD':'EGP'}/year`}
                    </div>
                  )}
                </div>

                {/* Highlights (professional & enterprise) */}
                {plan.highlight?.length > 0 && (
                  <div style={{ padding:'14px 20px', background:'#f0fdf4', borderBottom:'1px solid #bbf7d0' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#065f46', marginBottom:8 }}>⚡ {ar?'المميزات الرئيسية':'Key Highlights'}</div>
                    {plan.highlight.map((h,i) => (
                      <div key={i} style={{ fontSize:12, color:'#047857', display:'flex', gap:6, marginBottom:4 }}>
                        <span>✓</span><span>{h}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Features by category */}
                <div style={{ padding:'16px 20px 0' }}>
                  {Object.entries(plan.features).map(([cat, items]) => (
                    <div key={cat} style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#28376B', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{cat}</div>
                      {items.map((feat, i) => (
                        <div key={i} style={{ display:'flex', gap:8, marginBottom:5, fontSize:12.5, color:'#374151', lineHeight:1.4 }}>
                          <CheckCircle style={{ width:14, height:14, color:'#10b981', flexShrink:0, marginTop:2 }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {plan.notIncluded?.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{ar?'غير متاح':'Not Included'}</div>
                      {plan.notIncluded.map((feat, i) => (
                        <div key={i} style={{ display:'flex', gap:8, marginBottom:5, fontSize:12, color:'#94a3b8' }}>
                          <X style={{ width:13, height:13, flexShrink:0, marginTop:2 }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div style={{ padding:'16px 20px 24px' }}>
                  <button
                    onClick={() => handleSelect(plan)}
                    style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', fontSize:14, fontWeight:700, cursor:'pointer',
                      background: plan.popular ? 'linear-gradient(135deg,#0f1729,#28376B)' : plan.id==='enterprise' ? 'linear-gradient(135deg,#92400e,#f59e0b)' : '#f1f5f9',
                      color: plan.id==='starter' ? '#0f1729' : '#fff',
                      boxShadow: plan.popular ? '0 4px 16px rgba(40,55,107,.3)' : 'none' }}
                  >
                    {ar ? 'ابدأ تجربتك المجانية ←' : 'Start Free Trial →'}
                  </button>
                  <p style={{ textAlign:'center', fontSize:11, color:'#94a3b8', marginTop:8 }}>
                    {ar?'14 يوم مجاناً — بدون بطاقة':'14 days free · No card required'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Activation code */}
          <div style={{ maxWidth:480, margin:'0 auto', background:'linear-gradient(135deg,#f0fdf4,#ecfdf5)', border:'1px solid #bbf7d0', borderRadius:16, padding:24 }}>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <Key style={{ width:24, height:24, color:'#047857', margin:'0 auto 8px' }} />
              <h4 style={{ fontWeight:700, color:'#065f46', marginBottom:4 }}>{ar?'لديك كود تفعيل؟':'Have an activation code?'}</h4>
              <p style={{ fontSize:12, color:'#059669' }}>{ar?'فعّل اشتراكك مباشرة بكود مجاني':'Activate your subscription instantly with a free code'}</p>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <Input value={subCode} onChange={e=>setSubCode(e.target.value.toUpperCase())} placeholder={ar?'XXXX-XXXX-XXXX':'XXXX-XXXX-XXXX'} style={{ flex:1, fontFamily:'monospace', textAlign:'center', letterSpacing:2 }} />
              <select value={subDuration} onChange={e=>setSubDuration(e.target.value)} style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px', fontSize:13, background:'#fff', color:'#374151' }}>
                <option value="">{ar?'المدة':'Duration'}</option>
                <option value="1">{ar?'1 شهر':'1 month'}</option>
                <option value="3">{ar?'3 أشهر':'3 months'}</option>
                <option value="6">{ar?'6 أشهر':'6 months'}</option>
                <option value="12">{ar?'سنة':'1 year'}</option>
              </select>
            </div>
            <button onClick={handleActivateCode} disabled={activating} style={{ width:'100%', padding:'10px 0', background:'#059669', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
              {activating ? (ar?'جاري التفعيل...':'Activating...') : (ar?'تفعيل الكود':'Activate Code')}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════ COMPARE TAB ══════════════════ */}
      {activeTab === 'compare' && (
        <div style={{ maxWidth:900, margin:'0 auto', overflowX:'auto' }}>
          <table className="compare-table" style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#0f1729', color:'#fff' }}>
                <th style={{ padding:'14px 16px', textAlign:'start', fontWeight:700, width:'40%' }}>{ar?'الميزة':'Feature'}</th>
                {plans.map(p => (
                  <th key={p.id} style={{ padding:'14px 12px', textAlign:'center', fontWeight:800, color: p.popular?'#f0c060':'#fff' }}>
                    {p.name}
                    {p.badge && <div style={{ fontSize:10, fontWeight:600, opacity:.7 }}>{p.badge}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feat, i) => (
                feat.category ? (
                  <tr key={i} className="cat-row">
                    <td colSpan={4} style={{ padding:'10px 16px', fontWeight:700, fontSize:12, letterSpacing:'.05em', textTransform:'uppercase', color:'#f0c060' }}>{feat.category}</td>
                  </tr>
                ) : (
                  <tr key={i} className="feature-row">
                    <td style={{ padding:'10px 16px', color:'#374151', fontWeight:500 }}>{feat.name}</td>
                    <td style={{ textAlign:'center', padding:'10px 12px' }}>{renderCheck(feat.starter)}</td>
                    <td style={{ textAlign:'center', padding:'10px 12px' }}>{renderCheck(feat.professional)}</td>
                    <td style={{ textAlign:'center', padding:'10px 12px' }}>{renderCheck(feat.enterprise)}</td>
                  </tr>
                )
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f8fafc', borderTop:'2px solid #e2e8f0' }}>
                <td style={{ padding:'16px' }}></td>
                {plans.map(plan => (
                  <td key={plan.id} style={{ textAlign:'center', padding:'16px 12px' }}>
                    <button onClick={() => { handleSelect(plan); setActiveTab('plans'); }}
                      style={{ padding:'10px 20px', borderRadius:10, border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
                        background: plan.popular?'#0f1729':plan.id==='enterprise'?'#92400e':'#f1f5f9',
                        color: plan.id==='starter'?'#0f1729':'#fff' }}>
                      {ar ? 'اختر الخطة' : 'Choose Plan'}
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ══════════════════ FAQ TAB ══════════════════ */}
      {activeTab === 'faq' && (
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          {faqs.map((faq, i) => (
            <details key={i} style={{ marginBottom:12, border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
              <summary style={{ padding:'16px 20px', cursor:'pointer', fontWeight:700, fontSize:14, color:'#0f1729', listStyle:'none', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff' }}>
                {faq.q}
                <span style={{ fontSize:18, color:'#94a3b8', flexShrink:0, marginRight:ar?0:0 }}>+</span>
              </summary>
              <div style={{ padding:'0 20px 16px', fontSize:13.5, color:'#374151', lineHeight:1.7, background:'#fafafa' }}>{faq.a}</div>
            </details>
          ))}

          {/* CTA bottom */}
          <div style={{ textAlign:'center', marginTop:32, padding:28, background:'linear-gradient(135deg,#0f1729,#28376B)', borderRadius:20, color:'#fff' }}>
            <h3 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>{ar?'جاهز للبداية؟':'Ready to get started?'}</h3>
            <p style={{ fontSize:13, opacity:.7, marginBottom:20 }}>{ar?'14 يوم تجربة مجانية — لا حاجة لبطاقة ائتمان':'14-day free trial — no credit card required'}</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => setActiveTab('plans')} style={{ padding:'12px 28px', background:'#f0c060', color:'#0f1729', border:'none', borderRadius:12, fontWeight:800, fontSize:14, cursor:'pointer' }}>
                {ar?'ابدأ تجربتك المجانية ←':'Start Free Trial →'}
              </button>
              <a href="mailto:info@datalifeai.com" style={{ padding:'12px 24px', background:'rgba(255,255,255,.1)', color:'#fff', border:'1px solid rgba(255,255,255,.25)', borderRadius:12, fontWeight:600, fontSize:14, textDecoration:'none' }}>
                {ar?'تواصل معنا':'Contact Us'}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedPlan={selectedPlan}
          billingCycle={billingCycle}
        />
      )}
    </div>
  );
};

export default PricingSection;
