import React, { useState } from 'react';
import { useCurrency } from '../hooks/useCurrency';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { CheckCircle, X, Zap, Building2, Crown, Check, Key, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import PaymentModal from './PaymentModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PricingSection = () => {
  const { language, isRTL } = useLanguage();
  const [billingCycle, setBillingCycle] = useState('monthly');
  // Auto-detect currency: Egypt → EGP, Outside → USD (1 USD = 30 EGP)
  const { currency: detectedCurrency, isEgypt, country } = useCurrency();
  const [currency, setCurrency] = useState('EGP');
  // Sync with detected currency on load
  React.useEffect(() => { setCurrency(detectedCurrency); }, [detectedCurrency]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subCode, setSubCode] = useState('');
  const [subDuration, setSubDuration] = useState('');
  const [activating, setActivating] = useState(false);

  const ar = language === 'ar';

  const exchangeRate = 30; // 1 USD = 30 EGP (سعر الصرف الرسمي)

  const plans = [
    {
      id: 'starter',
      name: ar ? 'المبتدئ' : 'Starter',
      desc: ar ? 'للشركات الصغيرة والناشئة حتى 10 موظفين' : 'For small & startup businesses up to 10 employees',
      monthlyEGP: 299, annualEGP: 2390,
      monthlyUSD: 10, annualUSD: 80,
      employees: ar ? '1-10 موظفين' : '1-10 Employees',
      badge: null,
      vatNote: ar ? 'شامل ضريبة القيمة المضافة' : 'VAT Included',
      icon: <Zap className="h-6 w-6" />,
      color: 'border-gray-200',
      popular: false,
      features: [
        ar ? '✅ إدارة الموظفين الأساسية' : '✅ Basic employee management',
        ar ? '✅ الحضور والانصراف' : '✅ Attendance tracking',
        ar ? '✅ الإجازات العارضة والسنوية' : '✅ Leave management',
        ar ? '✅ كشف المرتبات (يدوي)' : '✅ Manual payroll',
        ar ? '✅ 108 حساب وفق الدليل المصري' : '✅ 108 accounts (Egyptian standard)',
        ar ? '✅ القيود اليومية والأستاذ العام' : '✅ Journal entries & general ledger',
        ar ? '✅ ميزان المراجعة' : '✅ Trial balance',
        ar ? '✅ قائمة الدخل والميزانية' : '✅ Income statement & balance sheet',
        ar ? '✅ الفواتير الأساسية' : '✅ Basic invoicing',
        ar ? '✅ العملاء والموردين' : '✅ Customers & suppliers',
        ar ? '✅ المنتجات والمخزون الأساسي' : '✅ Products & basic inventory',
        ar ? '✅ فاتورة بعد الدفع (PDF)' : '✅ Invoice after payment (PDF)',
        ar ? '✅ دعم عبر البريد الإلكتروني' : '✅ Email support',
        ar ? '✅ 5 جيجا تخزين' : '✅ 5 GB storage',
      ],
      notIncluded: [
        ar ? 'كشف المرتبات التلقائي (قانون 148/2019)' : 'Auto payroll (Law 148/2019)',
        ar ? 'تسجيل الحضور بالـ GPS' : 'GPS attendance',
        ar ? 'قسيمة راتب بالإيميل' : 'Email payslips',
        ar ? 'الفاتورة الإلكترونية (ETA)' : 'E-Invoicing (ETA)',
        ar ? 'المشتريات المتقدمة' : 'Advanced purchases',
        ar ? 'البنوك والتسويات البنكية' : 'Banking & reconciliation',
        ar ? 'المشاريع والمقاولات' : 'Projects & contracting',
        ar ? 'مستخلصات المقاولات (معيار 8)' : 'Progress claims (Standard 8)',
        ar ? 'مراكز التكلفة' : 'Cost centers',
        ar ? 'إشعارات Push' : 'Push notifications',
        ar ? 'فروع متعددة' : 'Multi-branch',
        ar ? 'ربط API' : 'API integration',
      ],
    },
    {
      id: 'professional',
      name: ar ? 'المحترف' : 'Professional',
      desc: ar ? 'للشركات المتوسطة والنامية — الأكثر مبيعاً' : 'For growing businesses — Best seller',
      monthlyEGP: 799, annualEGP: 6392,
      monthlyUSD: 27, annualUSD: 213,
      employees: ar ? '11-100 موظف' : '11-100 Employees',
      badge: ar ? '⭐ الأكثر مبيعاً' : '⭐ Best Seller',
      vatNote: ar ? 'شامل ضريبة القيمة المضافة' : 'VAT Included',
      icon: <Building2 className="h-6 w-6" />,
      color: 'border-[#28376B]',
      popular: true,
      features: [
        ar ? '✅ كل مميزات المبتدئ' : '✅ All Starter features',
        ar ? '✅ كشف المرتبات التلقائي (قانون 148/2019)' : '✅ Auto payroll (Law 148/2019)',
        ar ? '✅ تأمينات اجتماعية 7 صناديق' : '✅ Social insurance 7 funds',
        ar ? '✅ تسجيل الحضور بالـ GPS' : '✅ GPS attendance check-in',
        ar ? '✅ قسيمة راتب بالإيميل (HTML)' : '✅ Email payslips (HTML)',
        ar ? '✅ الورديات وإنهاء الخدمة' : '✅ Shifts & termination',
        ar ? '✅ الفاتورة الإلكترونية (ETA)' : '✅ E-Invoicing (ETA)',
        ar ? '✅ المشتريات وأوامر التوريد' : '✅ Purchases & supply orders',
        ar ? '✅ المخزون المتقدم' : '✅ Advanced inventory',
        ar ? '✅ البنوك والتسويات البنكية' : '✅ Banking & reconciliation',
        ar ? '✅ الأصول الثابتة والإهلاك' : '✅ Fixed assets & depreciation',
        ar ? '✅ VAT + خصم وتحصيل ضريبي' : '✅ VAT + withholding tax',
        ar ? '✅ الموافقات والتفويضات' : '✅ Approvals & delegation',
        ar ? '✅ إشعارات Push Real-time' : '✅ Real-time Push notifications',
        ar ? '✅ تسجيل الحضور بالـ GPS' : '✅ GPS attendance',
        ar ? '✅ متعدد العملات (6 عملات)' : '✅ Multi-currency (6 currencies)',
        ar ? '✅ فاتورة بعد الدفع (PDF)' : '✅ Invoice after payment (PDF)',
        ar ? '✅ رفع إيصال الدفع' : '✅ Payment receipt upload',
        ar ? '✅ دعم أولوية' : '✅ Priority support',
        ar ? '✅ 25 جيجا تخزين' : '✅ 25 GB storage',
      ],
      notIncluded: [
        ar ? 'المشاريع والمقاولات' : 'Projects & contracting',
        ar ? 'مستخلصات المقاولات (معيار 8)' : 'Progress claims (Standard 8)',
        ar ? 'قطاع طبي وأتعاب أطباء' : 'Medical sector & doctor fees',
        ar ? 'مراكز التكلفة' : 'Cost centers',
        ar ? 'فروع متعددة' : 'Multi-branch',
        ar ? 'مدير حساب مخصص' : 'Dedicated account manager',
        ar ? 'ربط API' : 'API integration',
      ],
    },
    {
      id: 'enterprise',
      name: ar ? 'المؤسسي' : 'Enterprise',
      desc: ar ? 'للمؤسسات والشركات الكبيرة — كل شيء بلا حدود' : 'For large organizations — Everything unlimited',
      monthlyEGP: 1499, annualEGP: 11992,
      monthlyUSD: 50, annualUSD: 400,
      employees: ar ? 'موظفون غير محدودون' : 'Unlimited Employees',
      badge: ar ? '👑 المميز' : '👑 Premium',
      vatNote: ar ? 'شامل ضريبة القيمة المضافة' : 'VAT Included',
      icon: <Crown className="h-6 w-6" />,
      color: 'border-amber-400',
      popular: false,
      features: [
        ar ? '✅ كل مميزات المحترف' : '✅ All Professional features',
        ar ? '✅ موظفون غير محدودون' : '✅ Unlimited employees',
        ar ? '✅ المشاريع والمقاولات' : '✅ Projects & contracting',
        ar ? '✅ مستخلصات المقاولات (معيار مصري 8)' : '✅ Progress claims (Egyptian Standard 8)',
        ar ? '✅ جداول الكميات (BOQ)' : '✅ Bill of Quantities (BOQ)',
        ar ? '✅ قطاع طبي — فصل أتعاب الأطباء' : '✅ Medical sector — Doctor fee split',
        ar ? '✅ مراكز التكلفة المتعددة' : '✅ Multiple cost centers',
        ar ? '✅ فروع متعددة' : '✅ Multi-branch',
        ar ? '✅ تكامل محاسبي Enterprise (SAP Level)' : '✅ Enterprise accounting (SAP Level)',
        ar ? '✅ محاسبة Immutable Ledger' : '✅ Immutable Ledger accounting',
        ar ? '✅ قانون التأمينات 148/2019 كامل' : '✅ Full Social Insurance Law 148/2019',
        ar ? '✅ مراجعة ضريبية متقدمة' : '✅ Advanced tax review',
        ar ? '✅ ربط API' : '✅ API integration',
        ar ? '✅ تخزين غير محدود' : '✅ Unlimited storage',
        ar ? '✅ تدريب الفريق' : '✅ Team training',
        ar ? '✅ مدير حساب مخصص' : '✅ Dedicated account manager',
        ar ? '✅ SLA مضمون' : '✅ Guaranteed SLA',
        ar ? '✅ دعم هاتفي 24/7' : '✅ Phone support 24/7',
        ar ? '✅ فاتورة بعد الدفع (PDF)' : '✅ Invoice after payment (PDF)',
        ar ? '✅ رفع إيصال الدفع' : '✅ Payment receipt upload',
        ar ? '✅ إشعارات تحديثات النظام' : '✅ System update notifications',
        ar ? '✅ أمان متعدد الطبقات' : '✅ Multi-layer security',
      ],
      notIncluded: [],
    },
  ];

  // Module packages
  const modules = [
    { id: 'hr-only', name: ar ? 'حزمة الموارد البشرية' : 'HR Package', monthlyEGP: 199, monthlyUSD: 4,
      features: ar ? ['إدارة الموظفين','الحضور والانصراف','كشف المرتبات','الإجازات','التأمينات'] : ['Employee management','Attendance','Payroll','Leave management','Insurance'] },
    { id: 'finance-only', name: ar ? 'حزمة المالية' : 'Finance Package', monthlyEGP: 249, monthlyUSD: 5,
      features: ar ? ['المحاسبة العامة','الفواتير','المصروفات','البنوك','التقارير المالية'] : ['General accounting','Invoicing','Expenses','Banking','Financial reports'] },
    { id: 'inventory-only', name: ar ? 'حزمة المخزون' : 'Inventory Package', monthlyEGP: 179, monthlyUSD: 4,
      features: ar ? ['تتبع المخزون','أوامر الشراء','إدارة الموردين','تحليلات المخزون','تنبيهات النفاد'] : ['Stock tracking','Purchase orders','Supplier management','Inventory analytics','Low stock alerts'] },
  ];

  // Comparison features
  const comparisonFeatures = [
    // ── الأساسيات ─────────────────────────────────
    { category: ar?'الأساسيات':'Basics' },
    { name: ar?'عدد الموظفين':'Employees',                      starter:'1-10',      professional:'11-100',   enterprise:ar?'غير محدود':'Unlimited' },
    { name: ar?'المساحة التخزينية':'Storage',                   starter:'5 GB',      professional:'25 GB',    enterprise:ar?'غير محدود':'Unlimited' },
    { name: ar?'الدعم الفني':'Support',                         starter:ar?'بريد':'Email', professional:ar?'أولوية':'Priority', enterprise:ar?'هاتف 24/7':'Phone 24/7' },
    { name: ar?'فاتورة بعد الدفع (PDF)':'Invoice after payment', starter:true,       professional:true,        enterprise:true },
    { name: ar?'إشعارات Push':'Push Notifications',             starter:false,       professional:true,        enterprise:true },
    { name: ar?'متعدد العملات':'Multi-currency',                starter:false,       professional:true,        enterprise:true },

    // ── الموارد البشرية ────────────────────────────
    { category: ar?'الموارد البشرية':'Human Resources' },
    { name: ar?'إدارة الموظفين':'Employee Management',          starter:true,        professional:true,        enterprise:true },
    { name: ar?'الحضور والانصراف':'Attendance',                 starter:true,        professional:true,        enterprise:true },
    { name: ar?'الإجازات العارضة والسنوية':'Leave Management',  starter:true,        professional:true,        enterprise:true },
    { name: ar?'كشف مرتبات يدوي':'Manual Payroll',              starter:true,        professional:true,        enterprise:true },
    { name: ar?'كشف مرتبات تلقائي (قانون 148/2019)':'Auto Payroll (Law 148/2019)', starter:false, professional:true, enterprise:true },
    { name: ar?'7 صناديق تأمينات اجتماعية':'7 Insurance Funds', starter:false,      professional:true,        enterprise:true },
    { name: ar?'حضور GPS تلقائي':'GPS Auto Attendance',         starter:false,       professional:true,        enterprise:true },
    { name: ar?'قسيمة راتب بالإيميل':'Email Payslips',          starter:false,       professional:true,        enterprise:true },
    { name: ar?'الورديات':'Shifts Management',                   starter:false,       professional:true,        enterprise:true },
    { name: ar?'إنهاء الخدمة':'End of Service',                 starter:false,       professional:true,        enterprise:true },
    { name: ar?'ملف موظف + صورة + مستندات':'Employee Profile + Docs', starter:true, professional:true,        enterprise:true },

    // ── المحاسبة المالية ───────────────────────────
    { category: ar?'المحاسبة المالية':'Financial Accounting' },
    { name: ar?'108 حساب وفق الدليل المصري':'108 Egyptian Standard Accounts', starter:true, professional:true, enterprise:true },
    { name: ar?'القيود اليومية والأستاذ العام':'Journal Entries & Ledger', starter:true, professional:true, enterprise:true },
    { name: ar?'ميزان المراجعة':'Trial Balance',                starter:true,        professional:true,        enterprise:true },
    { name: ar?'قائمة الدخل':'Income Statement',                starter:true,        professional:true,        enterprise:true },
    { name: ar?'الميزانية العمومية':'Balance Sheet',             starter:true,        professional:true,        enterprise:true },
    { name: ar?'VAT (ضريبة القيمة المضافة)':'VAT',              starter:false,       professional:true,        enterprise:true },
    { name: ar?'خصم وتحصيل ضريبي':'Withholding Tax',            starter:false,       professional:true,        enterprise:true },
    { name: ar?'الأصول الثابتة والإهلاك':'Fixed Assets & Depreciation', starter:false, professional:true,     enterprise:true },
    { name: ar?'التسويات البنكية':'Bank Reconciliation',         starter:false,       professional:true,        enterprise:true },
    { name: ar?'مراكز التكلفة':'Cost Centers',                  starter:false,       professional:false,       enterprise:true },
    { name: ar?'محاسبة Immutable Ledger':'Immutable Ledger',     starter:false,       professional:false,       enterprise:true },

    // ── الفواتير والمبيعات ─────────────────────────
    { category: ar?'الفواتير والمبيعات':'Invoicing & Sales' },
    { name: ar?'الفواتير الأساسية':'Basic Invoicing',           starter:true,        professional:true,        enterprise:true },
    { name: ar?'الفاتورة الإلكترونية (ETA)':'E-Invoicing (ETA)', starter:false,     professional:true,        enterprise:true },
    { name: ar?'إدارة العملاء CRM':'Customer CRM',               starter:false,       professional:true,        enterprise:true },
    { name: ar?'عروض الأسعار':'Quotations',                      starter:false,       professional:true,        enterprise:true },
    { name: ar?'فواتير المبيعات':'Sales Invoices',               starter:false,       professional:true,        enterprise:true },
    { name: ar?'اشتراكات العملاء الدورية':'Recurring Subscriptions', starter:false,  professional:true,        enterprise:true },
    { name: ar?'العملاء والموردين':'Customers & Suppliers',       starter:true,        professional:true,        enterprise:true },
    { name: ar?'المنتجات والمخزون':'Products & Inventory',       starter:true,        professional:true,        enterprise:true },
    { name: ar?'المشتريات وأوامر التوريد':'Purchases & PO',      starter:false,       professional:true,        enterprise:true },

    // ── المشاريع ───────────────────────────────────
    { category: ar?'المشاريع':'Projects' },
    { name: ar?'إدارة المشاريع':'Project Management',            starter:false,       professional:false,       enterprise:true },
    { name: ar?'مصروفات وإيرادات المشاريع':'Project Financials', starter:false,      professional:false,       enterprise:true },
    { name: ar?'مستخلصات المقاولات (معيار 8)':'Progress Claims (Std 8)', starter:false, professional:false,   enterprise:true },
    { name: ar?'جداول الكميات BOQ':'BOQ',                        starter:false,       professional:false,       enterprise:true },
    { name: ar?'قطاع طبي — أتعاب الأطباء':'Medical Sector',     starter:false,       professional:false,       enterprise:true },
    { name: ar?'فروع متعددة':'Multi-branch',                     starter:false,       professional:false,       enterprise:true },
    { name: ar?'ربط API':'API Integration',                      starter:false,       professional:false,       enterprise:true },

    // ── الأمان والصلاحيات ──────────────────────────
    { category: ar?'الأمان والصلاحيات':'Security & Permissions' },
    { name: ar?'نظام صلاحيات متقدم (21 صلاحية)':'Advanced Permissions (21)', starter:true, professional:true, enterprise:true },
    { name: ar?'Super Admin يدير كل الشركات':'Super Admin',      starter:false,       professional:false,       enterprise:true },
    { name: ar?'سجل التدقيق':'Audit Log',                        starter:true,        professional:true,        enterprise:true },
    { name: ar?'تسجيل الدخول بالـ OTP':'OTP Login',              starter:true,        professional:true,        enterprise:true },
    { name: ar?'إشعارات أمان (دخول من جهاز جديد)':'Security Alerts', starter:true,  professional:true,        enterprise:true },
    { name: ar?'تشفير HTTPS':'HTTPS Encryption',                 starter:true,        professional:true,        enterprise:true },
    { name: ar?'SLA مضمون':'Guaranteed SLA',                     starter:false,       professional:false,       enterprise:true },
    { name: ar?'مدير حساب مخصص':'Dedicated Account Manager',    starter:false,       professional:false,       enterprise:true },
  ];

  const getPrice = (plan) => {
    if (currency === 'USD') {
      return billingCycle === 'monthly' ? plan.monthlyUSD : plan.annualUSD;
    }
    return billingCycle === 'monthly' ? plan.monthlyEGP : plan.annualEGP;
  };

  const currencySymbol = currency === 'USD' ? '$' : (ar ? 'ج.م' : 'EGP');
  const periodLabel = billingCycle === 'monthly' ? (ar ? '/شهر' : '/mo') : (ar ? '/سنة' : '/yr');

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  const renderCell = (val) => {
    if (val === true) return <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />;
    if (val === false) return <X className="h-5 w-5 text-gray-300 mx-auto" />;
    return <span className="text-sm font-medium text-gray-700">{val}</span>;
  };

  const handleActivateCode = async () => {
    if (!subCode.trim()) {
      toast.error(ar ? 'يرجى إدخال كود الاشتراك' : 'Please enter subscription code');
      return;
    }
    setActivating(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(ar ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`${API_URL}/api/subscriptions/redeem-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: subCode.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(ar ? data.message_ar : data.message_en);
        setSubCode('');
      } else {
        const detail = data.detail;
        toast.error(typeof detail === 'object' ? (ar ? detail.message_ar : detail.message_en) : (detail || (ar ? 'كود غير صالح' : 'Invalid code')));
      }
    } catch (e) {
      toast.error(ar ? 'خطأ في تفعيل الكود' : 'Error activating code');
    } finally {
      setActivating(false);
    }
  };

  const durations = [
    { id: '3m', label: ar ? '3 أشهر' : '3 Months', short: '3m' },
    { id: '6m', label: ar ? '6 أشهر' : '6 Months', short: '6m' },
    { id: '9m', label: ar ? '9 أشهر' : '9 Months', short: '9m' },
    { id: '1y', label: ar ? 'سنة' : 'Year', short: '1Y' },
    { id: 'lifetime', label: ar ? 'مدى الحياة' : 'Lifetime', short: '\u221E' },
  ];

  return (
    <div className="container mx-auto max-w-6xl" dir={isRTL ? 'rtl' : 'ltr'} data-testid="pricing-section-inner">
      {/* Header */}
      <div className="text-center mb-10">
        <Badge className="mb-4 bg-purple-50 text-purple-700 hover:bg-purple-50 border-0">
          {ar ? 'الأسعار والباقات' : 'Pricing & Plans'}
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">
          {ar ? 'اختر الباقة المناسبة لك' : 'Choose the Right Plan for You'}
        </h2>
        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
          {ar ? 'جميع الباقات تشمل تجربة مجانية. يمكنك الترقية في أي وقت.' : 'All plans include a free trial. Upgrade anytime.'}
        </p>
      </div>

      {/* Controls: Billing + Currency */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
        {/* Billing Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button onClick={() => setBillingCycle('monthly')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'شهري' : 'Monthly'}
          </button>
          <button onClick={() => setBillingCycle('annual')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'annual' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'سنوي' : 'Annual'}
            <span className="text-xs ms-1 text-green-400 font-bold">{ar ? '(وفر 20%)' : '(Save 20%)'}</span>
          </button>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button onClick={() => setCurrency('EGP')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'EGP' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'ج.م (EGP)' : 'EGP (£)'}
          </button>
          <button onClick={() => setCurrency('USD')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${currency === 'USD' ? 'bg-[#28376B] text-white shadow' : 'text-gray-600'}`}>
            {ar ? 'دولار ($)' : 'USD ($)'}
          </button>
        </div>
      </div>

      {/* ── Plan Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative overflow-hidden border-2 ${plan.popular ? 'border-[#28376B] shadow-xl scale-[1.02]' : 'border-gray-100'} hover:shadow-lg transition-all`} data-testid={`plan-${plan.id}`}>
            {plan.popular && (
              <div className="absolute top-0 inset-x-0 bg-[#28376B] text-white text-center text-xs font-bold py-1.5">
                {ar ? 'الأكثر شعبية' : 'Most Popular'}
              </div>
            )}
            <CardContent className={`p-6 ${plan.popular ? 'pt-10' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${plan.popular ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {plan.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    {plan.badge && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">{plan.badge}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.desc}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#0f172a]">{getPrice(plan).toLocaleString()}</span>
                  <span className="text-sm text-gray-500">{currencySymbol} {periodLabel}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{plan.employees}</p>
                <p className="text-xs text-green-600 font-medium mt-0.5">✅ {plan.vatNote}</p>
              </div>

              <Button onClick={() => handleSelectPlan(plan)} className={`w-full mb-5 ${plan.popular ? 'bg-[#28376B] hover:bg-[#1e2a5a] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}>
                {ar ? 'ابدأ الآن' : 'Get Started'}
              </Button>

              {/* Features */}
              <div className="space-y-2.5">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{f}</span>
                  </div>
                ))}
                {plan.notIncluded.map((f, i) => (
                  <div key={`no-${i}`} className="flex items-start gap-2 text-sm">
                    <X className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-400 line-through">{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Subscription Codes ── */}
      <div className="mb-16">
        <Card className="border-2 border-dashed border-[#28376B]/30 bg-gradient-to-br from-[#28376B]/5 to-indigo-50">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#28376B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Key className="h-7 w-7 text-[#28376B]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a]">
                {ar ? 'أكواد الاشتراك' : 'Subscription Codes'}
              </h3>
              <p className="text-gray-500 text-sm mt-2">
                {ar ? 'هل لديك كود اشتراك مسبق الدفع؟ يمكنك تفعيل اشتراكك بكود لمدة 3 أو 6 أو 9 أشهر أو سنة أو مدى الحياة' : 'Have a subscription code? You can activate your subscription with a prepaid code for 3, 6, 9 months, 1 year, or lifetime'}
              </p>
            </div>

            {/* Duration badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {durations.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSubDuration(d.id)}
                  className={`flex flex-col items-center px-5 py-3 rounded-xl border-2 transition-all min-w-[80px] ${
                    subDuration === d.id 
                      ? 'border-[#28376B] bg-[#28376B] text-white shadow-lg scale-105' 
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#28376B]/50 hover:shadow-sm'
                  }`}
                  data-testid={`duration-${d.id}`}
                >
                  <span className="text-lg font-bold">{d.short}</span>
                  <span className="text-xs mt-0.5 opacity-80">{d.label}</span>
                </button>
              ))}
            </div>

            {/* Code input */}
            <div className="max-w-md mx-auto flex gap-2">
              <Input
                placeholder={ar ? 'أدخل كود الاشتراك هنا...' : 'Enter subscription code here...'}
                value={subCode}
                onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                className="flex-1 h-12 text-center font-mono text-lg tracking-widest border-2 border-gray-200 focus:border-[#28376B]"
                data-testid="subscription-code-input"
                onKeyPress={(e) => e.key === 'Enter' && handleActivateCode()}
              />
              <Button
                onClick={handleActivateCode}
                disabled={!subCode.trim() || activating}
                className="h-12 px-6 bg-[#28376B] hover:bg-[#1e2a5a] text-white font-semibold"
                data-testid="activate-code-btn"
              >
                {activating ? <Loader2 className="h-5 w-5 animate-spin" /> : (ar ? 'تفعيل الكود' : 'Activate Code')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Full Comparison Table ── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-[#0f172a]">{ar ? 'مقارنة شاملة للخطط' : 'Full Plan Comparison'}</h3>
          <p className="text-gray-500 text-sm mt-2">{ar ? 'قارن بين جميع الخدمات في كل باقة' : 'Compare all services across every plan'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full max-w-4xl mx-auto border-collapse" data-testid="comparison-table">
            <thead>
              <tr className="bg-[#28376B] text-white">
                <th className="p-3 text-start text-sm font-semibold rounded-ts-xl">{ar ? 'الخدمة' : 'Feature'}</th>
                <th className="p-3 text-center text-sm font-semibold">{ar ? 'المبتدئ' : 'Starter'}</th>
                <th className="p-3 text-center text-sm font-semibold bg-[#1e2a5a]">{ar ? 'المحترف' : 'Professional'}</th>
                <th className="p-3 text-center text-sm font-semibold rounded-te-xl">{ar ? 'المؤسسي' : 'Enterprise'}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feat, i) => (
                feat.category ? (
                  <tr key={i} className="bg-[#1e3a8a]">
                    <td colSpan={4} className="p-3 text-xs font-bold text-white uppercase tracking-wider">
                      {feat.category}
                    </td>
                  </tr>
                ) : (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                  <td className="p-3 text-sm font-medium text-gray-800">{feat.name}</td>
                  <td className="p-3 text-center">{renderCell(feat.starter)}</td>
                  <td className="p-3 text-center bg-[#28376B]/5">{renderCell(feat.professional)}</td>
                  <td className="p-3 text-center">{renderCell(feat.enterprise)}</td>
                </tr>
                )
              ))}
              {/* Price row */}
              <tr className="bg-[#28376B]/10 font-bold">
                <td className="p-3 text-sm text-gray-900">{ar ? 'السعر الشهري' : 'Monthly Price'}</td>
                <td className="p-3 text-center text-sm text-[#28376B]">{currency === 'USD' ? '$6' : (ar ? '299 ج.م' : '299 EGP')}</td>
                <td className="p-3 text-center text-sm text-[#28376B] bg-[#28376B]/10">{currency === 'USD' ? '$16' : (ar ? '799 ج.م' : '799 EGP')}</td>
                <td className="p-3 text-center text-sm text-[#28376B]">{currency === 'USD' ? '$30' : (ar ? '1,499 ج.م' : '1,499 EGP')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          selectedPlan={{
            ...selectedPlan,
            price: getPrice(selectedPlan),
            currency: currencySymbol,
            billingCycle
          }}
        />
      )}
    </div>
  );
};

export default PricingSection;
