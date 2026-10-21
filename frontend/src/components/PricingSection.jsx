import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileText, RefreshCw, CreditCard, Building2, Zap, Crown, Upload, Users, Calculator, Package } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

/*
 * صفحة الأسعار — 4 خطوات:
 *   1) الباقة الأساسية + المدة   2) المجالات المتخصصة (اختياري)
 *   3) الإجمالي + التجديد التلقائي   4) الفاتورة المبدئية ← الدفع
 * Prices, totals and the VAT contained in them come from the server
 * (/api/payments/catalog and /quote); the payment request is priced there too.
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

// what each base plan adds on top of the system (every plan runs the whole system)
const PLAN_META = {
  starter: { icon: Zap, ar: { tag: 'للشركات الصغيرة والناشئة', emp: 'حتى 10 موظفين', extra: ['تخزين 5 جيجا', 'دعم بالإيميل والتذاكر', 'شرح فيديو وأدلة استخدام'] },
             en: { tag: 'Small & new businesses', emp: 'Up to 10 employees', extra: ['5 GB storage', 'Email & ticket support', 'Video guides'] } },
  professional: { icon: Building2, popular: true, ar: { tag: 'للشركات المتوسطة والنامية', emp: 'من 11 لـ 100 موظف', extra: ['تخزين 25 جيجا', 'دعم أولوية', 'جلسة تهيئة أونلاين لنقل بياناتك'] },
                  en: { tag: 'Growing businesses', emp: '11 – 100 employees', extra: ['25 GB storage', 'Priority support', 'Online onboarding session'] } },
  enterprise: { icon: Crown, ar: { tag: 'للمؤسسات والشركات الكبيرة', emp: 'موظفين بلا حد', extra: ['تخزين بلا حد', 'دعم بالهاتف ومدير حساب', 'تدريب فريقك ومراجعة الإعداد'] },
                en: { tag: 'Large organisations', emp: 'Unlimited employees', extra: ['Unlimited storage', 'Phone support & account manager', 'Team training & setup review'] } },
  'hr-only': { icon: Users, mod: 'hr', ar: { tag: 'لو محتاج الموارد البشرية والرواتب بس', emp: 'موظفين بلا حد', extra: ['دعم بالإيميل والتذاكر'] },
               en: { tag: 'HR & payroll only', emp: 'Unlimited employees', extra: ['Email & ticket support'] } },
  'financial-only': { icon: Calculator, mod: 'fin', ar: { tag: 'لو محتاج الحسابات والضرائب والفواتير بس', emp: 'من غير الموارد البشرية', extra: ['دعم بالإيميل والتذاكر'] },
                      en: { tag: 'Accounting, tax & invoicing only', emp: 'No HR module', extra: ['Email & ticket support'] } },
  'inventory-only': { icon: Package, mod: 'inv', ar: { tag: 'لو محتاج المخازن والمشتريات بس', emp: 'من غير الحسابات والرواتب', extra: ['دعم بالإيميل والتذاكر'] },
                      en: { tag: 'Stock & purchasing only', emp: 'No accounting or HR', extra: ['Email & ticket support'] } },
};

// every feature, and which single-module plan covers it ('all' = every plan)
const FEATURES = [
  { g: 'المحاسبة والمالية', ge: 'Accounting', mods: ['fin'], items: [
    ['دليل حسابات مصري جاهز', 'Egyptian chart of accounts'], ['قيود يومية وأستاذ عام وميزان مراجعة', 'Journals, ledger, trial balance'],
    ['قائمة الدخل والمركز المالي والتدفقات النقدية', 'P&L, balance sheet, cash flow'], ['إقفال السنة المالية وإعادة الفتح', 'Year-end close & reopen'],
    ['مراكز التكلفة', 'Cost centres'], ['الأصول الثابتة — إهلاك محاسبي وضريبي واستبعاد', 'Fixed assets — book & tax depreciation'],
    ['عملات أجنبية وفروق العملة وإعادة التقييم', 'Foreign currency & revaluation'], ['البنوك والشيكات والتسوية البنكية', 'Banks, cheques, bank reconciliation'],
    ['الخزينة والعهد', 'Treasury & petty cash'], ['المشاريع وإيراداتها ومصروفاتها', 'Projects with revenue & costs']] },
  { g: 'الضرائب والفاتورة الإلكترونية', ge: 'Tax & e-invoicing', mods: ['fin'], items: [
    ['ضريبة القيمة المضافة وإقرارها الشهري', 'VAT and the monthly return'], ['الخصم والتحصيل ونموذج 41', 'Withholding tax & form 41'],
    ['ضريبة الدمغة وضريبة الجدول', 'Stamp & table tax'], ['ربط الفاتورة الإلكترونية ETA', 'ETA e-invoice link'],
    ['الإيصال الإلكتروني لنقاط البيع', 'POS e-receipt'], ['إشعارات دائنة ومدينة مرتبطة بالفاتورة الأصلية', 'Credit/debit notes linked to the original']] },
  { g: 'المبيعات والعملاء', ge: 'Sales & customers', mods: ['fin'], items: [
    ['عروض أسعار وفواتير وتحصيل', 'Quotes, invoices, collections'], ['كشف حساب عميل بفترة وحد ائتمان', 'Customer statement & credit limit'],
    ['إدارة العملاء والمبيعات CRM', 'Customers & sales CRM']] },
  { g: 'المخزون والمشتريات', ge: 'Stock & purchasing', mods: ['fin', 'inv'], items: [
    ['الأصناف والمخازن المتعددة', 'Items & multiple warehouses'], ['الجرد والتحويل بين المخازن', 'Counts & transfers'],
    ['المشتريات وأوامر التوريد والموردين', 'Purchases, supply orders, suppliers'], ['تكاليف الاستيراد على الأصناف', 'Import landed costs'],
    ['المرتجعات للمخزن أو الحجر أو الإعدام', 'Returns to stock, quarantine or scrap'], ['نقاط بيع تشتغل من غير إنترنت', 'Offline POS'],
    ['ربط متجر إلكتروني (سلة)', 'Online store link (Salla)']] },
  { g: 'الموارد البشرية والرواتب', ge: 'HR & payroll', mods: ['hr'], items: [
    ['ملف موظف بمستنداته وصورته', 'Employee file & documents'], ['حضور بالبصمة واليدوي والموقع GPS', 'Fingerprint, manual & GPS attendance'],
    ['العمل عن بُعد لموظفين محددين', 'Remote work for chosen staff'], ['الورديات والإجازات', 'Shifts & leave'],
    ['الإضافي بنسب قانون العمل', 'Overtime by Labour Law rates'], ['رواتب الشهر بضريبة كسب العمل والتأمينات (حدود 2026)', 'Monthly payroll with salary tax & insurance (2026 limits)'],
    ['كشف رواتب كامل بفلتر الإدارة والفرع وتصدير Excel', 'Full payroll sheet by department/branch, Excel'], ['ملفات تحويل الرواتب للبنوك وقسائم PDF', 'Bank salary files & PDF payslips'],
    ['السلف والجزاءات ونهاية الخدمة', 'Loans, penalties, end of service'], ['الصناديق والمساهمات — اختيارية لكل شركة', 'Payroll funds — optional per company'],
    ['بيانات نماذج التأمينات 1 و6', 'Insurance forms 1 & 6 data'], ['تقييم الأداء ومؤشرات KPI', 'Appraisals & KPIs'],
    ['التوظيف ودليل المقابلات والاختبارات', 'Recruitment guide & tests']] },
  { g: 'بوابة الموظف', ge: 'Employee portal', mods: ['hr'], items: [
    ['دخول لكل موظف يشوف بياناته بس', 'Each employee sees only their own data'], ['تسجيل الحضور من الموبايل بالموقع', 'Check in from the phone'],
    ['طلب إجازة وسلفة وشوف القسيمة والتقييم', 'Leave & loan requests, payslips, appraisals'], ['تثبيت البرنامج على الموبايل كتطبيق', 'Installs on the phone like an app']] },
  { g: 'الإدارة والأمان', ge: 'Admin & security', mods: ['all'], items: [
    ['صلاحيات حسب الدور', 'Role permissions'], ['موافقات بحدود مبالغ وإشعارات', 'Approval limits & notifications'],
    ['سجل مراجعة لكل العمليات', 'Audit trail'], ['استيراد Excel بيرفض الملف الغلط ويقول الصف', 'Excel import that names the wrong row'],
    ['تصدير كل بيانات شركتك في أي وقت', 'Export all your data any time'], ['نسخ احتياطي يومي مشفّر', 'Daily encrypted backup'],
    ['مساعد ذكي يجاوب من داخل البرنامج', 'In-app assistant'], ['عربي وإنجليزي', 'Arabic & English']] },
];
const covers = (planKey, mods) => {
  const m = (PLAN_META[planKey] || {}).mod;
  return !m || mods.includes('all') || mods.includes(m);
};
const featuresFor = (planKey) => FEATURES.filter((g) => covers(planKey, g.mods));

const COMPARE = [
  ['employees', 'عدد الموظفين', 'Employees', { starter: ['حتى 10', 'Up to 10'], professional: ['من 11 لـ 100', '11 – 100'], enterprise: ['بلا حد', 'Unlimited'], 'hr-only': ['بلا حد', 'Unlimited'], 'financial-only': ['—', '—'], 'inventory-only': ['—', '—'] }],
  ['storage', 'مساحة التخزين', 'Storage', { starter: ['5 جيجا', '5 GB'], professional: ['25 جيجا', '25 GB'], enterprise: ['بلا حد', 'Unlimited'], 'hr-only': ['5 جيجا', '5 GB'], 'financial-only': ['5 جيجا', '5 GB'], 'inventory-only': ['5 جيجا', '5 GB'] }],
  ['support', 'الدعم', 'Support', { starter: ['إيميل وتذاكر', 'Email & tickets'], professional: ['أولوية', 'Priority'], enterprise: ['هاتف + مدير حساب', 'Phone + account manager'], 'hr-only': ['إيميل وتذاكر', 'Email & tickets'], 'financial-only': ['إيميل وتذاكر', 'Email & tickets'], 'inventory-only': ['إيميل وتذاكر', 'Email & tickets'] }],
  ['onboarding', 'التهيئة', 'Onboarding', { starter: ['أدلة وفيديو', 'Guides & video'], professional: ['جلسة أونلاين', 'Online session'], enterprise: ['تدريب الفريق', 'Team training'], 'hr-only': ['أدلة وفيديو', 'Guides & video'], 'financial-only': ['أدلة وفيديو', 'Guides & video'], 'inventory-only': ['أدلة وفيديو', 'Guides & video'] }],
];

function FeatureList({ ar, planKey, compact }) {
  return (
    <div className="grid gap-3 text-sm">
      {featuresFor(planKey).map((g) => (
        <div key={g.g}>
          <p className="text-xs font-bold text-amber-300 mb-1">{ar ? g.g : g.ge}</p>
          <ul className="grid gap-1">
            {g.items.map(([a, e]) => <li key={a} className="flex gap-2"><Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden />{ar ? a : e}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

const card = 'rounded-2xl border border-white/10 bg-white/[0.04]';

export default function PricingSection({ onStartTrial }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [tab, setTab] = useState('build');
  const [catalog, setCatalog] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(1);
  // a choice made on the public page before signing up is picked up here
  const saved = (() => { try { return JSON.parse(localStorage.getItem('dl_pricing_choice') || 'null') || {}; } catch { return {}; } })();
  const [duration, setDuration] = useState(saved.duration || 'yearly');
  const [plan, setPlan] = useState(saved.plan || 'professional');
  const [packs, setPacks] = useState(Array.isArray(saved.packs) ? saved.packs : []);
  const [autoRenew, setAutoRenew] = useState(saved.auto_renew !== undefined ? !!saved.auto_renew : true);
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState('');
  const loggedIn = (() => { try { return !!localStorage.getItem('token'); } catch { return false; } })();

  useEffect(() => {
    fetch(`${API_URL}/api/payments/catalog`).then((r) => r.ok ? r.json() : Promise.reject())
      .then(setCatalog).catch(() => setLoadErr(ar ? 'تعذّر تحميل الأسعار — اعمل تحديث للصفحة' : 'Could not load prices — refresh the page'));
  }, []);

  useEffect(() => {
    if (!catalog) return;
    let off = false;
    setQuoteErr('');
    fetch(`${API_URL}/api/payments/quote`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, duration, packs, auto_renew: autoRenew }) })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : ''); return d; })
      .then((q) => { if (!off) setQuote(q); })
      .catch((e) => { if (!off) setQuoteErr(e.message || (ar ? 'تعذّر حساب الإجمالي' : 'Could not compute the total')); });
    return () => { off = true; };
  }, [catalog, plan, duration, packs, autoRenew]);

  const planObj = useMemo(() => catalog?.plans.find((p) => p.key === plan), [catalog, plan]);
  const factor = planObj ? planObj.prices[duration] / planObj.prices.monthly : 1;
  const durLabel = (d) => (ar ? catalog?.durations[d]?.label : catalog?.durations[d]?.label_en) || d;
  const togglePack = (k) => setPacks((ps) => (ps.includes(k) ? ps.filter((x) => x !== k) : [...ps, k]));

  const Steps = () => (
    <ol className="flex flex-wrap justify-center gap-2 mb-8 text-sm" aria-label={ar ? 'الخطوات' : 'Steps'}>
      {[ar ? 'الباقة الأساسية' : 'Base plan', ar ? 'المجالات المتخصصة' : 'Sector add-ons', ar ? 'الإجمالي والتجديد' : 'Total & renewal', ar ? 'الفاتورة' : 'Invoice'].map((l, i) => (
        <li key={l}>
          <button type="button" onClick={() => setStep(i + 1)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${step === i + 1 ? 'bg-amber-500 text-black border-amber-500 font-bold' : step > i + 1 ? 'border-teal-500/40 text-teal-300' : 'border-white/15 text-gray-300'}`}
            aria-current={step === i + 1 ? 'step' : undefined}>
            <span className="tabular-nums">{i + 1}</span>{l}
          </button>
        </li>
      ))}
    </ol>
  );

  const Nav = ({ next, back, nextLabel }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
      {back ? <button type="button" onClick={back} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-white/15 text-gray-200 hover:bg-white/5">
        {ar ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}{ar ? 'رجوع' : 'Back'}</button> : <span />}
      {next && <button type="button" onClick={next} className="inline-flex items-center gap-1 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold">
        {nextLabel}{ar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>}
    </div>
  );

  const Total = () => quote ? (
    <div className="text-sm text-gray-300">
      {ar ? 'الإجمالي' : 'Total'} <b className="text-white text-lg tabular-nums">{fmt(quote.total)}</b> {ar ? 'ج.م — شامل ضريبة القيمة المضافة' : 'EGP incl. VAT'}
    </div>
  ) : null;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="text-gray-200">
      <div className="flex justify-center gap-1 mb-8 bg-white/5 rounded-xl p-1 w-fit mx-auto" role="tablist">
        {[['build', ar ? 'احسب اشتراكك' : 'Build your plan'], ['compare', ar ? 'المقارنة وكل المميزات' : 'Compare & all features'], ['faq', ar ? 'أسئلة شائعة' : 'FAQ']].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === id ? 'bg-white text-[#0f1729]' : 'text-gray-300 hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {loadErr && <p className="text-center text-red-300">{loadErr}</p>}
      {!catalog && !loadErr && <p className="text-center text-gray-400">{ar ? 'بنحمّل الأسعار…' : 'Loading prices…'}</p>}

      {catalog && tab === 'build' && (
        <div className="max-w-5xl mx-auto">
          <Steps />

          {step === 1 && (
            <section aria-labelledby="st1">
              <h3 id="st1" className="sr-only">{ar ? 'اختار الباقة الأساسية' : 'Choose a base plan'}</h3>
              <p className="text-center text-gray-300 mb-5">{ar ? 'الباقات الكاملة فيها البرنامج كله — الفرق في عدد الموظفين والتخزين والدعم. ولو محتاج وحدة واحدة بس فيه باقات الوحدة الواحدة تحت.' : 'Full plans include the whole system — they differ in employees, storage and support. Single-module plans are below.'}</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {Object.keys(catalog.durations).map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(d)} aria-pressed={duration === d}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border ${duration === d ? 'bg-white text-[#0f1729] border-white' : 'border-white/15 text-gray-200'}`}>
                    {durLabel(d)}{d !== 'monthly' && planObj?.savings?.[d] > 0 && <span className="ms-1 text-emerald-500 text-xs">{ar ? `وفّر ${fmt(planObj.savings[d])}` : `save ${fmt(planObj.savings[d])}`}</span>}
                  </button>
                ))}
              </div>
              {[['full', ar ? 'الباقات الكاملة — البرنامج كله' : 'Full plans — the whole system'], ['module', ar ? 'أو باقة وحدة واحدة' : 'Or a single-module plan']].map(([kind, head]) => (
              <div key={kind} className="mb-8">
              <h4 className="text-white font-bold text-lg mb-3">{head}</h4>
              <div className="grid gap-4 md:grid-cols-3 items-start">
                {catalog.plans.filter((p) => (p.kind || 'full') === kind).map((p) => {
                  const meta = PLAN_META[p.key] || {}; const t = meta[ar ? 'ar' : 'en'] || {}; const Icon = meta.icon || Zap;
                  const chosen = plan === p.key;
                  return (
                    <button key={p.key} type="button" onClick={() => { setPlan(p.key); if (p.packs_allowed === false) setPacks([]); }} aria-pressed={chosen}
                      className={`text-start ${card} p-5 grid gap-3 transition-colors ${chosen ? 'ring-2 ring-amber-400 bg-white/[0.08]' : 'hover:bg-white/[0.06]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-bold text-white text-lg"><Icon className="w-5 h-5 text-amber-400" aria-hidden />{ar ? p.name_ar : p.name_en}</span>
                        {meta.popular && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{ar ? 'الأكثر اختياراً' : 'Most chosen'}</span>}
                      </div>
                      <span className="text-sm text-gray-300">{t.tag} · {t.emp}</span>
                      <span><b className="text-3xl text-white tabular-nums">{fmt(p.prices[duration])}</b> <span className="text-sm text-gray-300">{ar ? 'ج.م' : 'EGP'} / {durLabel(duration)}</span></span>
                      {duration !== 'monthly' && <span className="text-xs text-gray-400 tabular-nums">{ar ? `يعني ${fmt(p.prices[duration] / catalog.durations[duration].months)} ج.م في الشهر` : `${fmt(p.prices[duration] / catalog.durations[duration].months)} EGP a month`}</span>}
                      <span className={`text-center rounded-lg py-2 text-sm font-bold ${chosen ? 'bg-amber-500 text-black' : 'bg-white/10 text-white'}`}>{chosen ? (ar ? 'مختارة' : 'Selected') : (ar ? 'اختار' : 'Choose')}</span>
                      <ul className="grid gap-1 text-sm border-t border-white/10 pt-3">
                        {(t.extra || []).map((x) => <li key={x} className="flex gap-2 font-semibold text-white"><Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />{x}</li>)}
                      </ul>
                      <FeatureList ar={ar} planKey={p.key} />
                    </button>
                  );
                })}
              </div>
              </div>
              ))}
              <Nav next={() => setStep(2)} nextLabel={ar ? 'التالي: المجالات المتخصصة' : 'Next: sector add-ons'} />
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="st2">
              <h3 id="st2" className="text-center text-white font-bold text-xl mb-2">{ar ? 'نشاطك محتاج مجال متخصص؟' : 'Does your sector need an add-on?'}</h3>
              <p className="text-center text-gray-300 mb-6">{ar ? 'اختياري — كل مجال بيضيف حساباته وشاشاته فوق الباقة الأساسية، وتقدر تضيفه أو توقفه بعدين.' : 'Optional — each adds its accounts and screens on top of the base plan; add or stop it later.'}</p>
              {planObj && planObj.packs_allowed === false ? (
                <p className={`${card} p-5 text-center text-gray-300`}>{ar ? 'المجالات المتخصصة بتضيف حسابات، فبتتضاف على الباقات الكاملة أو «المالية فقط». الباقة اللي اختارتها مالهاش مجالات — كمّل للإجمالي.' : 'Sector add-ons add accounts, so they go with full plans or Finance only. Continue to the total.'}</p>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.packs.map((k) => {
                  const on = packs.includes(k.key);
                  return (
                    <label key={k.key} className={`${card} p-4 grid gap-1 cursor-pointer ${on ? 'ring-2 ring-teal-400 bg-white/[0.08]' : 'hover:bg-white/[0.06]'}`}>
                      <span className="flex items-start gap-2">
                        <input type="checkbox" checked={on} onChange={() => togglePack(k.key)} className="mt-1 w-4 h-4 accent-teal-500" />
                        <span className="font-semibold text-white">{ar ? k.name_ar : k.name_en}</span>
                      </span>
                      {k.note_ar && ar && <span className="text-xs text-gray-300 ps-6">{k.note_ar}</span>}
                      {(k.adds || []).length > 0 && <ul className="text-xs text-gray-400 ps-6 list-disc ms-4">{k.adds.map((x) => <li key={x}>{x}</li>)}</ul>}
                      <span className="text-sm ps-6 tabular-nums"><b className="text-white">{fmt(Math.round(k.monthly * factor))}</b> {ar ? 'ج.م' : 'EGP'} / {durLabel(duration)}</span>
                    </label>
                  );
                })}
              </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Total />{quoteErr && <span className="text-red-300 text-sm">{quoteErr}</span>}</div>
              <Nav back={() => setStep(1)} next={() => setStep(3)} nextLabel={ar ? 'التالي: الإجمالي' : 'Next: total'} />
            </section>
          )}

          {step === 3 && quote && (
            <section aria-labelledby="st3" className="max-w-2xl mx-auto">
              <h3 id="st3" className="text-white font-bold text-xl mb-4">{ar ? 'الإجمالي' : 'Your total'}</h3>
              <div className={`${card} p-5 grid gap-2`}>
                {quote.lines.map((l) => (
                  <div key={l.kind + l.key} className="flex justify-between gap-3 text-sm"><span>{l.label}</span><span className="tabular-nums text-white">{fmt(l.amount)}</span></div>
                ))}
                <div className="border-t border-white/10 pt-3 mt-1 flex justify-between font-bold text-white text-lg"><span>{ar ? 'الإجمالي (شامل الضريبة)' : 'Total (incl. VAT)'}</span><span className="tabular-nums">{fmt(quote.total)} {ar ? 'ج.م' : 'EGP'}</span></div>
                <div className="flex justify-between text-xs text-gray-400"><span>{ar ? `منها ضريبة القيمة المضافة ${quote.vat_rate}%` : `of which VAT ${quote.vat_rate}%`}</span><span className="tabular-nums">{fmt(quote.vat_included)}</span></div>
              </div>
              <div className={`${card} p-5 mt-4 grid gap-3`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="mt-1 w-4 h-4 accent-amber-500" />
                  <span><span className="font-semibold text-white flex items-center gap-2"><RefreshCw className="w-4 h-4" aria-hidden />{ar ? 'تجديد تلقائي' : 'Auto-renew'}</span>
                    <span className="block text-sm text-gray-300 mt-1">{ar ? quote.renewal_note : (autoRenew ? 'A renewal invoice is raised 7 days before the end date; card auto-charge arrives once the bank link is ready.' : 'The subscription ends on its date; renew manually from the subscription page.')}</span>
                    <span className="block text-xs text-gray-400 mt-1">{ar ? 'ميعاد التجديد: ' : 'Renews on '}<bdi dir="ltr">{quote.renews_on}</bdi></span></span>
                </label>
                <p className="flex items-center gap-2 text-xs text-gray-400"><CreditCard className="w-4 h-4" aria-hidden />{ar ? 'الخصم التلقائي من الكارت — قريباً' : 'Card auto-charge — coming soon'}</p>
              </div>
              <Nav back={() => setStep(2)} next={() => setStep(4)} nextLabel={ar ? 'اعرض الفاتورة' : 'Show the invoice'} />
            </section>
          )}

          {step === 4 && quote && <InvoiceStep ar={ar} quote={quote} planName={ar ? planObj?.name_ar : planObj?.name_en} durLabel={durLabel(duration)}
            loggedIn={loggedIn} onBack={() => setStep(3)} onStartTrial={onStartTrial} />}
        </div>
      )}

      {catalog && tab === 'compare' && <Compare ar={ar} catalog={catalog} />}
      {tab === 'faq' && <Faq ar={ar} />}
    </div>
  );
}

function InvoiceStep({ ar, quote, planName, durLabel, loggedIn, onBack, onStartTrial }) {
  const [pay, setPay] = useState(false);
  const [method, setMethod] = useState('instapay');
  const [ref, setRef] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const saveChoice = () => { try { localStorage.setItem('dl_pricing_choice', JSON.stringify({ plan: quote.plan, duration: quote.duration, packs: quote.packs, auto_renew: quote.auto_renew })); } catch { /* ignore */ } };

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!ref.trim()) { setErr(ar ? 'اكتب رقم العملية من رسالة التحويل' : 'Enter the transfer reference'); return; }
    setBusy(true);
    try {
      const token = localStorage.getItem('token');
      let receipt_url = '';
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('type', 'payment_receipt');
        const up = await fetch(`${API_URL}/api/payments/upload-receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const ud = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(typeof ud.detail === 'string' ? ud.detail : (ar ? 'الإيصال ماترفعش' : 'Receipt upload failed'));
        receipt_url = ud.url || '';
      }
      const r = await fetch(`${API_URL}/api/payments/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: quote.plan, duration: quote.duration, packs: quote.packs, auto_renew: quote.auto_renew, payment_method: method, reference_number: ref.trim(), receipt_url }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : (ar ? 'الطلب ماتسجلش' : 'Request not recorded'));
      setDone(d); toast.success(ar ? 'اتسجل طلب الدفع' : 'Payment request recorded');
      try { localStorage.removeItem('dl_pricing_choice'); } catch { /* ignore */ }
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const METHODS = [['instapay', 'InstaPay', '00201006008552'], ['vodafone_cash', ar ? 'فودافون كاش' : 'Vodafone Cash', '00201012625529'], ['bank_transfer', ar ? 'تحويل بنكي' : 'Bank transfer', ar ? 'بيانات الحساب بتوصلك مع تأكيد الطلب' : 'Account details are sent with the confirmation']];

  return (
    <section aria-labelledby="st4" className="max-w-2xl mx-auto grid gap-5">
      <h3 id="st4" className="text-white font-bold text-xl flex items-center gap-2"><FileText className="w-5 h-5" aria-hidden />{ar ? 'الفاتورة المبدئية' : 'Pro-forma invoice'}</h3>
      <div className="rounded-2xl bg-white text-slate-800 p-6 grid gap-4 shadow-xl">
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <div><p className="font-bold text-[#1e3a8a]">{ar ? 'داتا لايف لخدمات الذكاء الصناعي' : 'DataLife AI Services'}</p><p className="text-slate-500">DataLife Account</p></div>
          <div className="text-end"><p>{ar ? 'التاريخ' : 'Date'}: <bdi dir="ltr" className="tabular-nums">{today}</bdi></p><p>{ar ? 'المدة' : 'Period'}: {durLabel}</p></div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-slate-500 border-b"><th className="text-start py-2">{ar ? 'البند' : 'Item'}</th><th className="text-end py-2">{ar ? 'المبلغ (ج.م)' : 'Amount (EGP)'}</th></tr></thead>
          <tbody>
            {quote.lines.map((l) => <tr key={l.kind + l.key} className="border-b border-slate-100"><td className="py-2">{l.label}</td><td className="py-2 text-end tabular-nums">{fmt(l.amount)}</td></tr>)}
          </tbody>
          <tfoot>
            <tr><td className="pt-3 text-slate-500">{ar ? 'القيمة قبل الضريبة' : 'Net before VAT'}</td><td className="pt-3 text-end tabular-nums">{fmt(quote.net_before_vat)}</td></tr>
            <tr><td className="text-slate-500">{ar ? `ضريبة القيمة المضافة ${quote.vat_rate}% (داخل السعر)` : `VAT ${quote.vat_rate}% (included)`}</td><td className="text-end tabular-nums">{fmt(quote.vat_included)}</td></tr>
            <tr className="font-bold text-lg"><td className="pt-2">{ar ? 'الإجمالي المطلوب' : 'Total due'}</td><td className="pt-2 text-end tabular-nums">{fmt(quote.total)}</td></tr>
          </tfoot>
        </table>
        <p className="text-xs text-slate-500">{ar ? `الباقة: ${planName} · ${quote.auto_renew ? 'تجديد تلقائي يوم ' : 'بدون تجديد تلقائي — ينتهي '}` : `Plan: ${planName} · ${quote.auto_renew ? 'auto-renews on ' : 'ends '}`}<bdi dir="ltr">{quote.renews_on}</bdi>{ar ? '. الفاتورة الضريبية النهائية بتتعمل بعد تأكيد الدفع.' : '. The final tax invoice is issued once payment is confirmed.'}</p>
      </div>

      {done ? (
        <div className={`${card} p-5 text-emerald-300`} role="status">{done.message} — {ar ? 'المبلغ المسجل' : 'amount'} <b className="tabular-nums">{fmt(done.amount_egp)}</b> {ar ? 'ج.م' : 'EGP'}</div>
      ) : !loggedIn ? (
        <div className={`${card} p-5 grid gap-3`}>
          <p>{ar ? 'ابدأ تجربة مجانية 14 يوم، وبعدها ادفع الفاتورة دي من صفحة الاشتراك — اختيارك هيتحفظ.' : 'Start a 14-day free trial, then pay this invoice from the subscription page — your choice is kept.'}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { saveChoice(); onStartTrial ? onStartTrial() : (window.location.href = '/register-company'); }} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold">{ar ? 'ابدأ التجربة المجانية' : 'Start the free trial'}</button>
            <a href="/login" onClick={saveChoice} className="px-5 py-2.5 rounded-lg border border-white/15 text-white">{ar ? 'عندي حساب — دخول' : 'I have an account — sign in'}</a>
          </div>
        </div>
      ) : !pay ? (
        <button type="button" onClick={() => setPay(true)} className="px-5 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold justify-self-start">{ar ? 'ادفع الفاتورة' : 'Pay this invoice'}</button>
      ) : (
        <form onSubmit={submit} className={`${card} p-5 grid gap-4`} noValidate>
          <fieldset className="grid gap-2">
            <legend className="font-semibold text-white mb-2">{ar ? 'طريقة الدفع' : 'Payment method'}</legend>
            {METHODS.map(([k, l, d]) => (
              <label key={k} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${method === k ? 'border-amber-400 bg-white/[0.06]' : 'border-white/10'}`}>
                <input type="radio" name="pm" value={k} checked={method === k} onChange={() => setMethod(k)} className="mt-1" />
                <span><span className="font-semibold text-white">{l}</span><span className="block text-sm text-gray-300 tabular-nums" dir="ltr">{d}</span></span>
              </label>
            ))}
            <p className="flex items-center gap-2 text-xs text-gray-400 border border-dashed border-white/10 rounded-lg p-3"><CreditCard className="w-4 h-4" aria-hidden />{ar ? 'الدفع بالكارت — قريباً' : 'Card payment — coming soon'}</p>
          </fieldset>
          <p className="text-sm text-gray-300">{ar ? `حوّل ${fmt(quote.total)} ج.م، واكتب رقم العملية وارفع صورة الإيصال.` : `Transfer ${fmt(quote.total)} EGP, then enter the reference and upload the receipt.`}</p>
          <label className="grid gap-1 text-sm" htmlFor="pay-ref">{ar ? 'رقم العملية' : 'Reference number'}
            <input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white" />
          </label>
          <label className="grid gap-1 text-sm" htmlFor="pay-rec"><span className="flex items-center gap-2"><Upload className="w-4 h-4" aria-hidden />{ar ? 'صورة الإيصال (اختياري)' : 'Receipt image (optional)'}</span>
            <input id="pay-rec" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-gray-300" />
          </label>
          {err && <p className="text-red-300 text-sm" role="alert">{err}</p>}
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold justify-self-start disabled:opacity-50">{busy ? '…' : (ar ? 'أرسل طلب الدفع' : 'Send payment request')}</button>
        </form>
      )}
      <div><button type="button" onClick={onBack} className="text-sm text-gray-300 underline">{ar ? 'رجوع للإجمالي' : 'Back to the total'}</button></div>
    </section>
  );
}

function Compare({ ar, catalog }) {
  const plans = catalog.plans;
  const mark = (ok) => ok ? <Check className="inline w-4 h-4 text-teal-400" aria-label={ar ? 'متضمن' : 'included'} /> : <span className="text-gray-500" aria-label={ar ? 'غير متضمن' : 'not included'}>—</span>;
  return (
    <div className="max-w-6xl mx-auto grid gap-8">
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="sticky top-0"><tr className="bg-[#0b1426]"><th className="text-start p-3 w-[32%]">{ar ? 'الخدمة' : 'Service'}</th>
            {plans.map((p) => <th key={p.key} className="p-3 text-center text-white align-bottom">{ar ? p.name_ar : p.name_en}<span className="block text-xs text-gray-400 font-normal tabular-nums">{fmt(p.prices.monthly)} {ar ? 'ج.م / شهر' : 'EGP / mo'}</span></th>)}</tr></thead>
          <tbody>
            {COMPARE.map(([k, la, le, vals]) => (
              <tr key={k} className="border-t border-white/10"><td className="p-3 text-gray-300">{ar ? la : le}</td>{plans.map((p) => <td key={p.key} className="p-3 text-center text-white">{(vals[p.key] || ['—', '—'])[ar ? 0 : 1]}</td>)}</tr>
            ))}
            {FEATURES.map((g) => (
              <React.Fragment key={g.g}>
                <tr className="bg-white/5"><td colSpan={plans.length + 1} className="p-2 px-3 font-bold text-amber-300">{ar ? g.g : g.ge}</td></tr>
                {g.items.map(([a, e]) => (
                  <tr key={a} className="border-t border-white/5"><td className="p-2.5 px-3 text-gray-200">{ar ? a : e}</td>{plans.map((p) => <td key={p.key} className="p-2.5 text-center">{mark(covers(p.key, g.mods))}</td>)}</tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="border-t border-white/10"><td className="p-3 text-gray-300">{ar ? 'المجالات المتخصصة (تحت)' : 'Sector add-ons (below)'}</td>{plans.map((p) => <td key={p.key} className="p-3 text-center text-gray-300">{p.packs_allowed ? (ar ? 'إضافة اختيارية' : 'optional') : '—'}</td>)}</tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-white font-bold text-xl mb-4">{ar ? 'المجالات المتخصصة — كل مجال بيعمل إيه' : 'Sector add-ons — what each adds'}</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.packs.map((k) => (
            <div key={k.key} className={`${card} p-5 grid gap-2`}>
              <div className="flex items-baseline justify-between gap-2"><h4 className="font-bold text-white">{ar ? k.name_ar : k.name_en}</h4><span className="tabular-nums text-white text-sm">{fmt(k.monthly)} {ar ? 'ج.م/شهر' : 'EGP/mo'}</span></div>
              {ar && k.note_ar && <p className="text-sm text-gray-300">{k.note_ar}</p>}
              {(k.adds || []).length > 0 && (<>
                <p className="text-xs text-gray-400">{ar ? 'بيضيف للدليل المحاسبي:' : 'Adds these accounts:'}</p>
                <ul className="grid gap-1 text-sm">{k.adds.map((x) => <li key={x} className="flex gap-2"><Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden />{x}</li>)}</ul>
              </>)}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">{ar ? 'كل الأسعار بالجنيه المصري وشاملة ضريبة القيمة المضافة. المجال اللي بتشتريه مع مدة بياخد نفس خصم المدة، وبيتضاف على الباقات الكاملة أو «المالية فقط».' : 'All prices in EGP, VAT included. An add-on bought for a period gets the same discount; it goes with full plans or Finance only.'}</p>
      </div>
    </div>
  );
}

function Faq({ ar }) {
  const items = ar ? [
    ['إيه الفرق بين الباقات؟', 'الباقات الكاملة (المبتدئ والمحترف والمؤسسي) فيها البرنامج كله، والفرق في عدد الموظفين والتخزين والدعم. باقات الوحدة الواحدة فيها وحدة واحدة بس: الموارد البشرية، أو المالية، أو المخزون.'],
    ['إيه هي المجالات المتخصصة؟', 'إضافات لأنشطة معينة (مقاولات، تصنيع، عقارات، طبي، مطاعم…) بتضيف حساباتها وشاشاتها. اختيارية وتضيفها أو توقفها في أي وقت.'],
    ['الأسعار شاملة الضريبة؟', 'أيوه، كل الأسعار شاملة ضريبة القيمة المضافة 14%، والفاتورة بتوضح الضريبة اللي جوه السعر.'],
    ['التجديد التلقائي بيشتغل إزاي؟', 'قبل نهاية الاشتراك بـ 7 أيام بتتعمل فاتورة التجديد وتوصلك في البرنامج، وتدفعها بنفس طرق الدفع. الخصم التلقائي من الكارت هيتفعّل أول ما ربط البنك يخلص.'],
    ['طرق الدفع إيه؟', 'إنستاباي، فودافون كاش، تحويل بنكي، أو كود تفعيل. الدفع بالكارت قريباً.'],
    ['أقدر أغيّر الباقة؟', 'أيوه، تقدر ترقّي في أي وقت من صفحة الاشتراك.'],
    ['بعد التجربة المجانية بياناتي هتروح؟', 'لأ، بياناتك بتفضل محفوظة، ومحتاج بس تختار باقة عشان تكمّل.'],
    ['أقدر آخد بياناتي معايا؟', 'أيوه، من الإعدادات تقدر تصدّر كل بيانات شركتك في أي وقت.'],
  ] : [
    ['What differs between plans?', 'Every plan has the whole system; they differ in employees, storage, support and onboarding.'],
    ['What are sector add-ons?', 'Optional extras for specific activities that add their accounts and screens; add or stop them any time.'],
    ['Are prices VAT-inclusive?', 'Yes, all prices include 14% VAT and the invoice shows the VAT inside the price.'],
    ['How does auto-renew work?', 'A renewal invoice is raised 7 days before the end date and paid the usual way; card auto-charge comes once the bank link is ready.'],
    ['Payment methods?', 'InstaPay, Vodafone Cash, bank transfer or an activation code. Card payment is coming soon.'],
    ['Can I change plans?', 'Yes, upgrade any time from the subscription page.'],
    ['What happens after the trial?', 'Your data is kept; choose a plan to continue.'],
    ['Can I take my data?', 'Yes, export all your company data from Settings at any time.'],
  ];
  return (
    <div className="max-w-3xl mx-auto grid gap-3">
      {items.map(([q, a]) => (
        <details key={q} className={`${card} p-4`}>
          <summary className="cursor-pointer font-semibold text-white">{q}</summary>
          <p className="mt-2 text-sm text-gray-300">{a}</p>
        </details>
      ))}
    </div>
  );
}


/** فواتير التجديد المستنية الدفع — في صفحة الاشتراك جوه البرنامج. */
export function RenewalInvoices({ ar = true }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [method, setMethod] = useState('instapay');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/payments/my-transactions`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => setItems((d.requests || []).filter((x) => x.status === 'awaiting_payment')))
      .catch(() => {});
  };
  useEffect(load, []);
  if (!items.length) return null;
  const pay = async (id) => {
    setMsg('');
    const r = await fetch(`${API_URL}/api/payments/requests/${id}/pay`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ payment_method: method, reference_number: ref }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(typeof d.detail === 'string' ? d.detail : (ar ? 'ماتسجلش' : 'Not recorded')); return; }
    setOpen(null); setRef(''); load(); toast.success(d.message || (ar ? 'اتسجل الدفع' : 'Recorded'));
  };
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 grid gap-3" dir={ar ? 'rtl' : 'ltr'}>
      <p className="font-bold">{ar ? 'فواتير تجديد مستنية الدفع' : 'Renewal invoices awaiting payment'}</p>
      {items.map((x) => (
        <div key={x.id} className="grid gap-2 bg-white rounded-lg p-3 text-slate-800">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>{(x.quote?.lines || []).map((l) => l.label).join('، ')}</span>
            <span className="font-bold tabular-nums">{fmt(x.amount_egp)} {ar ? 'ج.م' : 'EGP'} · {ar ? 'تستحق' : 'due'} <bdi dir="ltr">{x.due_date}</bdi></span>
          </div>
          {open === x.id ? (
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-2 py-1.5 border rounded-lg">
                <option value="instapay">InstaPay — 00201006008552</option>
                <option value="vodafone_cash">{ar ? 'فودافون كاش' : 'Vodafone Cash'} — 00201012625529</option>
                <option value="bank_transfer">{ar ? 'تحويل بنكي' : 'Bank transfer'}</option>
              </select>
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={ar ? 'رقم العملية' : 'Reference'} dir="ltr" className="px-2 py-1.5 border rounded-lg" />
              <button type="button" onClick={() => pay(x.id)} className="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white font-semibold">{ar ? 'سجّل الدفع' : 'Record payment'}</button>
              {msg && <span className="text-red-700">{msg}</span>}
            </div>
          ) : (
            <button type="button" onClick={() => setOpen(x.id)} className="justify-self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold">{ar ? 'ادفع الفاتورة' : 'Pay invoice'}</button>
          )}
        </div>
      ))}
    </div>
  );
}
