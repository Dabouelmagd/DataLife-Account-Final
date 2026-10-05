/**
 * الدفع والاسترداد وحماية البيانات — one page, four sections.
 *
 * Every sentence here describes what the system actually does, checked
 * against the code when this was written:
 *   - card and PayPal checkouts return 503 "coming soon", so the only working
 *     methods are InstaPay, Vodafone Cash, bank transfer and activation codes;
 *   - a subscription or sector add-on is activated only after the platform
 *     confirms the transfer, and a tax invoice is issued for it;
 *   - nothing renews or charges automatically, and expiry reminders are a
 *     manual admin action, not a schedule — so none is promised;
 *   - no job deletes data after a fixed period, so no such period is promised;
 *   - attendance keeps distance-from-office and inside/outside only — exact
 *     coordinates are discarded after the check.
 * A payment provider reviewing this page compares it with how the site
 * behaves. Change the code and this page together, never one of them.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, ArrowLeft, Phone, MapPin, Mail } from 'lucide-react';

const ADDRESS_AR = '٥٩ لبنان المهندسين الجيزة مصر';
const ADDRESS_EN = '59 Lebanon Mohandessein Giza Egypt';
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=59%20Lebanon%20Mohandessein%20Giza%20Egypt';
const PHONE_TEL = 'tel:+201006008552';
const PHONE_SHOWN = '+20 100 600 8552';
const SUPPORT_EMAIL = 'info@datalifeai.com';

export default function PoliciesPage() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const navigate = useNavigate();
  const Back = ar ? ArrowRight : ArrowLeft;

  // a section linked directly (/policies#refund) opens on that section
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  const nav = [
    ['payment', ar ? 'الدفع' : 'Payment'],
    ['data', ar ? 'حماية البيانات' : 'Data protection'],
    ['refund', ar ? 'الاسترداد' : 'Refunds'],
    ['contact', ar ? 'التواصل' : 'Contact'],
  ];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1e3a8a] font-semibold [@media(pointer:coarse)]:min-h-[44px]">
          <Back className="w-4 h-4" aria-hidden />{ar ? 'الرئيسية' : 'Home'}
        </button>

        <h1 className="text-2xl sm:text-3xl font-extrabold">
          {ar ? 'الدفع والاسترداد وحماية البيانات' : 'Payment, Refund & Data Protection'}
        </h1>
        <p className="mt-3 text-slate-600 leading-8">
          {ar
            ? 'توضح هذه الصفحة كيف تدفع اشتراكك في داتا لايف أكونت، وكيف نتعامل مع بياناتك وبيانات موظفيك، ومتى يمكن استرداد ما دفعته. وتُقرأ مع شروط الاستخدام وسياسة الخصوصية.'
            : 'This page explains how to pay for your DataLife Account subscription, how we handle your data and your employees’ data, and when a payment can be refunded. Please read it together with the Terms and the Privacy Policy.'}
        </p>

        <nav className="mt-6 flex flex-wrap gap-2" aria-label={ar ? 'أقسام الصفحة' : 'Sections'}>
          {nav.map(([id, label]) => (
            <button key={id} onClick={() => go(id)}
              className="px-4 py-2 [@media(pointer:coarse)]:min-h-[44px] rounded-full border border-slate-300 bg-white text-sm font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a]">
              {label}
            </button>
          ))}
        </nav>

        {/* ── الدفع ─────────────────────────────────────────── */}
        <Section id="payment" title={ar ? 'أولاً: سياسة الدفع' : 'First: Payment Policy'}>
          <H>{ar ? 'ما الذي تدفع مقابله' : 'What you pay for'}</H>
          <P>{ar
            ? 'داتا لايف أكونت نظام محاسبة وموارد بشرية يُقدَّم باشتراك. تدفع مقابل باقة أساسية لمدة تختارها، ويمكنك أن تضيف إليها تخصصاً قطاعياً (مثل المقاولات أو التجزئة) باشتراك مستقل يُضاف فوق باقتك.'
            : 'DataLife Account is an accounting and HR system offered by subscription. You pay for a base plan for a period you choose, and you may add a sector add-on (such as construction or retail) as a separate subscription on top of it.'}</P>

          <H>{ar ? 'طرق الدفع المتاحة حالياً' : 'Payment methods available now'}</H>
          <Ul items={ar ? [
            'إنستاباي (InstaPay).',
            'فودافون كاش.',
            'تحويل بنكي.',
            'كود تفعيل، إن حصلت عليه من فريقنا.',
          ] : [
            'InstaPay.',
            'Vodafone Cash.',
            'Bank transfer.',
            'An activation code, if you received one from our team.',
          ]} />
          <P>{ar
            ? 'الدفع بالبطاقة غير متاح حالياً، وسيُضاف قريباً. ولا نجمع أو نخزّن أي بيانات بطاقات.'
            : 'Card payment is not available at present and will be added soon. We do not collect or store any card data.'}</P>

          <H>{ar ? 'التفعيل' : 'Activation'}</H>
          <P>{ar
            ? 'بعد التحويل ترفع إيصال الدفع من صفحة الاشتراك، ويتحقق فريقنا من وصول المبلغ، ثم يُفعَّل الاشتراك. ولا يُفعَّل أي اشتراك أو تخصص قطاعي قبل تأكيد استلام المبلغ. أما كود التفعيل فيُفعّل الاشتراك عند إدخاله.'
            : 'After transferring, you upload the payment receipt from the subscription page; our team verifies that the amount has arrived and then activates the subscription. No subscription or sector add-on is activated before receipt of the amount is confirmed. An activation code activates the subscription when it is entered.'}</P>

          <H>{ar ? 'الفاتورة الضريبية' : 'Tax invoice'}</H>
          <P>{ar
            ? 'عن كل دفعة مؤكدة تصدر لك فاتورة ضريبية برقم متسلسل، تُبيَّن فيها قيمة الضريبة منفصلة، وتصلك بالبريد الإلكتروني وتجدها في صفحة الاشتراك.'
            : 'For every confirmed payment you receive a tax invoice with a sequential number, showing the tax separately. It is emailed to you and available on the subscription page.'}</P>

          <H>{ar ? 'التجديد' : 'Renewal'}</H>
          <P>{ar
            ? 'لا يتجدد الاشتراك تلقائياً ولا نسحب أي مبلغ دون طلبك. التجديد دفعة جديدة تقوم بها أنت، ويظهر تاريخ انتهاء اشتراكك في صفحة الاشتراك.'
            : 'Subscriptions do not renew automatically and we never take a payment without your request. Renewal is a new payment you make, and your subscription’s end date is shown on the subscription page.'}</P>

          <H>{ar ? 'العملة' : 'Currency'}</H>
          <P>{ar ? 'جميع الأسعار والمدفوعات بالجنيه المصري.' : 'All prices and payments are in Egyptian pounds.'}</P>
        </Section>

        {/* ── حماية البيانات ────────────────────────────────── */}
        <Section id="data" title={ar ? 'ثانياً: حماية البيانات' : 'Second: Data Protection'}>
          <P>{ar
            ? 'لا نبيع بياناتك ولا نستخدمها في الإعلان أو التسويق لأي طرف.'
            : 'We do not sell your data or use it for advertising or marketing to anyone.'}</P>

          <H>{ar ? 'بيانات شركتك وبيانات موظفيك' : 'Your company’s data and your employees’ data'}</H>
          <P>{ar
            ? 'الشركة المشتركة هي صاحبة البيانات التي تُدخلها عن موظفيها وعملائها وحساباتها، ونحن نعالجها نيابةً عنها لتشغيل الخدمة فقط.'
            : 'The subscribing company owns the data it enters about its employees, customers and accounts; we process it on the company’s behalf, only to run the service.'}</P>

          <H>{ar ? 'البيانات التي نجمعها' : 'Data we collect'}</H>
          <Ul items={ar ? [
            'بيانات الشركة: الاسم والبريد الإلكتروني والهاتف والرقم الضريبي وبيانات السجل التجاري.',
            'بيانات المستخدمين: الاسم والبريد الإلكتروني والدور والصلاحيات.',
            'بيانات الموظفين كما تُدخلها الشركة: الاسم والرقم القومي والمرتب والبدلات والخصومات وبيانات الحساب البنكي والحضور والمستندات.',
            'البيانات المحاسبية: القيود والفواتير والمصروفات وما يُرفع من مستندات.',
            'بيانات الاستخدام والأمان: أوقات تسجيل الدخول، وعنوان IP ومعرّف الجهاز عند تسجيل الحضور.',
            'الحضور بالموقع: نحتفظ فقط بالمسافة من مقر العمل وبكونها داخل النطاق المسموح أو خارجه، ولا نحتفظ بإحداثيات موقعك.',
          ] : [
            'Company data: name, email, phone, tax number and commercial registration details.',
            'User data: name, email, role and permissions.',
            'Employee data as entered by the company: name, national ID, salary, allowances, deductions, bank account details, attendance and documents.',
            'Accounting data: journal entries, invoices, expenses and uploaded documents.',
            'Usage and security data: sign-in times, and IP address and device identifier at attendance check-in.',
            'Location attendance: we keep only the distance from the workplace and whether it was inside or outside the permitted area — not your coordinates.',
          ]} />

          <H>{ar ? 'الجهات التي تستلم بيانات' : 'Who receives data'}</H>
          <P>{ar ? 'نشارك البيانات بالقدر اللازم فقط مع:' : 'We share data only as much as necessary with:'}</P>
          <Ul items={ar ? [
            'مزود الاستضافة: خوادم Hetzner في ألمانيا.',
            'مزود البريد الإلكتروني لإرسال رسائل الخدمة ورموز التحقق والفواتير.',
            'مزودي الذكاء الاصطناعي، عند استخدامك لميزاته فقط (مثل اقتراح أسئلة المقابلات وملخص المرشح)، وبالقدر الذي تتطلبه الميزة.',
            'مصلحة الضرائب المصرية، عند تفعيل شركتك لمنظومة الفاتورة الإلكترونية.',
            'مزودي الرسائل النصية وواتساب، إذا فعّلت شركتك هذه الإشعارات.',
            'خدمة Google Fonts لعرض الخطوط في الموقع.',
            'الجهات الرسمية عند وجود التزام قانوني.',
          ] : [
            'Our hosting provider: Hetzner servers in Germany.',
            'Our email provider, to send service messages, verification codes and invoices.',
            'AI providers, only when you use AI features (such as suggested interview questions and candidate summaries), and only as much as the feature needs.',
            'The Egyptian Tax Authority, when your company enables e-invoicing.',
            'SMS and WhatsApp providers, if your company enables those notifications.',
            'Google Fonts, to display fonts on the site.',
            'Official authorities where there is a legal obligation.',
          ]} />

          <H>{ar ? 'أمان البيانات' : 'Data security'}</H>
          <Ul items={ar ? [
            'تُشفَّر الاتصالات بالموقع باستخدام HTTPS.',
            'كلمات المرور تُخزَّن مشفّرة ولا يمكن قراءتها.',
            'يتوفر التحقق بخطوتين برمز يصلك بالبريد الإلكتروني.',
            'الوصول إلى البيانات مقيد بصلاحيات كل مستخدم، وبيانات كل شركة معزولة عن غيرها.',
            'الملفات المرفوعة لا تُفتح إلا لمستخدم مسجّل الدخول من الشركة صاحبتها.',
            'العمليات المالية تُسجَّل في سجل مراجعة، والقيد المرحّل لا يُعدَّل وإنما يُصحَّح بقيد.',
          ] : [
            'Connections to the site are encrypted with HTTPS.',
            'Passwords are stored hashed and cannot be read.',
            'Two-step verification is available, with a code sent to your email.',
            'Access to data is limited by each user’s permissions, and each company’s data is isolated from every other.',
            'Uploaded files open only for a signed-in user of the company that owns them.',
            'Financial operations are recorded in an audit log, and a posted entry is never edited — it is corrected by another entry.',
          ]} />

          <H>{ar ? 'الاحتفاظ بالبيانات' : 'Data retention'}</H>
          <P>{ar
            ? 'نحتفظ بالبيانات طوال مدة نشاط حساب الشركة. بعد انتهاء الاشتراك يمكنك طلب نسخة من بياناتك أو حذفها، مع مراعاة السجلات المحاسبية والضريبية التي يلزم القانون الاحتفاظ بها.'
            : 'We keep data for as long as the company’s account is active. After a subscription ends you may request a copy of your data or its deletion, subject to the accounting and tax records the law requires us to keep.'}</P>

          <H>{ar ? 'حقوقك' : 'Your rights'}</H>
          <P>{ar
            ? `يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بمراسلتنا على ${SUPPORT_EMAIL}، وسنراجع طلبك ونرد عليك في أقرب وقت ممكن.`
            : `You may request access to your data, its correction or its deletion by writing to ${SUPPORT_EMAIL}. We will review your request and reply as soon as possible.`}</P>
        </Section>

        {/* ── الاسترداد ─────────────────────────────────────── */}
        <Section id="refund" title={ar ? 'ثالثاً: سياسة الاسترداد' : 'Third: Refund Policy'}>
          <H>{ar ? 'الاشتراكات والتخصصات القطاعية' : 'Subscriptions and sector add-ons'}</H>
          <Ul items={ar ? [
            'لا يُسترد مقابل فترة اشتراك بدأت بالفعل.',
            'يُرد المبلغ كاملاً في حالة الدفع الخاطئ أو المكرر.',
            'إذا تعذّر علينا تقديم الخدمة، يُرد المبلغ بما يتناسب مع المدة المتبقية.',
          ] : [
            'No refund is given for a subscription period that has already started.',
            'Mistaken or duplicate payments are refunded in full.',
            'If we are unable to provide the service, the amount is refunded in proportion to the remaining period.',
          ]} />

          <H>{ar ? 'طريقة الرد' : 'How refunds are made'}</H>
          <P>{ar
            ? 'يُرد المبلغ بالطريقة نفسها التي دُفع بها: إلى المحفظة أو الحساب البنكي الذي حُوِّل منه، مع تسجيل مرجع التحويل.'
            : 'Refunds are made the same way the payment was made: to the wallet or bank account it was transferred from, with the transfer reference recorded.'}</P>

          <H>{ar ? 'كيف تطلب الاسترداد' : 'How to request a refund'}</H>
          <P>{ar
            ? `أرسل طلبك إلى ${SUPPORT_EMAIL} مع اسم الشركة ورقم الفاتورة الضريبية ومرجع التحويل وسبب الطلب، وسنراجعه ونرد عليك في أقرب وقت ممكن.`
            : `Send your request to ${SUPPORT_EMAIL} with the company name, the tax invoice number, the transfer reference and the reason. We will review it and reply as soon as possible.`}</P>
        </Section>

        {/* ── التواصل ───────────────────────────────────────── */}
        <Section id="contact" title={ar ? 'التواصل معنا' : 'Contact us'}>
          <div className="space-y-2">
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 [@media(pointer:coarse)]:min-h-[44px] text-slate-700 hover:text-[#1e3a8a]">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden />{ar ? ADDRESS_AR : ADDRESS_EN}
            </a>
            <a href={PHONE_TEL} dir="ltr"
              className="flex items-center gap-2 [@media(pointer:coarse)]:min-h-[44px] text-slate-700 hover:text-[#1e3a8a] w-fit">
              <Phone className="w-4 h-4 shrink-0" aria-hidden />{PHONE_SHOWN}
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr"
              className="flex items-center gap-2 [@media(pointer:coarse)]:min-h-[44px] text-slate-700 hover:text-[#1e3a8a] w-fit">
              <Mail className="w-4 h-4 shrink-0" aria-hidden />{SUPPORT_EMAIL}
            </a>
          </div>
        </Section>

        <p className="mt-10 text-xs text-slate-400">
          {ar ? 'المحتوى القانوني قيد المراجعة القانونية النهائية.' : 'Legal content pending final legal review.'}
        </p>
      </div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
      <h2 className="text-xl font-extrabold text-[#1e3a8a] mb-2">{title}</h2>
      {children}
    </section>
  );
}

function H({ children }) {
  return <h3 className="mt-5 font-bold text-slate-900">{children}</h3>;
}

function P({ children }) {
  return <p className="mt-2 text-slate-700 leading-8">{children}</p>;
}

function Ul({ items }) {
  return (
    <ul className="mt-2 space-y-1.5 text-slate-700 leading-8 list-disc ps-5">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
