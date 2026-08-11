import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function TermsPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const [open, setOpen] = useState(null);

  const sections = [
    { icon: '✅', title: ar ? 'الموافقة على الشروط' : 'Agreement to Terms',
      content: ar
        ? 'باستخدامك DataLife Account، فأنت توافق على هذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، يرجى عدم استخدام النظام.\n\nهذه الشروط سارية المفعول اعتباراً من تاريخ إنشاء حسابك وتنطبق على جميع مستخدمي النظام بما فيهم المسؤولون والموظفون.'
        : 'By using DataLife Account, you agree to these Terms and Conditions. If you do not agree with any part, please do not use the system.\n\nThese terms are effective from the date of your account creation and apply to all users including administrators and employees.' },

    { icon: '📄', title: ar ? 'وصف الخدمة والاشتراك' : 'Service Description & Subscription',
      content: ar
        ? 'DataLife Account هو نظام SaaS (برمجيات كخدمة) لإدارة الموارد البشرية والمحاسبة المالية وفق القانون المصري.\n\nالمميزات الرئيسية:\n• إدارة الموارد البشرية وكشف المرتبات وفق قانون 148/2019\n• نظام محاسبي بـ 108 حساب وفق الدليل المصري المعياري\n• تسجيل الحضور بالـ GPS مع نطاق جغرافي قابل للضبط\n• إرسال قسائم الرواتب بالبريد الإلكتروني\n• الفاتورة الإلكترونية المصرية (ETA)\n• مستخلصات المقاولات وفق المعيار المحاسبي 8\n• نظام موافقات Real-time بالـ WebSocket\n• تحديثات تلقائية مع إشعار للمستخدمين\n\nتحصل على ترخيص استخدام غير حصري وغير قابل للتحويل بناءً على خطة اشتراكك.'
        : 'DataLife Account is a SaaS system for HR management and financial accounting per Egyptian law.\n\nKey features:\n• HR and payroll management per Law 148/2019\n• 108-account accounting system per Egyptian standard chart\n• GPS attendance with configurable geofence radius\n• Email payslips with full salary details\n• Egyptian E-Invoice (ETA)\n• Progress claims per Accounting Standard 8\n• Real-time approval system via WebSocket\n• Automatic updates with user notifications\n\nYou receive a non-exclusive, non-transferable license based on your subscription plan.' },

    { icon: '📋', title: ar ? 'خطط الاشتراك والأسعار' : 'Subscription Plans & Pricing',
      content: ar
        ? 'الخطط المتاحة:\n\n🔹 المبتدئ — 299 ج.م / شهر (أو 2,390 ج.م / سنة)\n• 1-10 موظفين | HR أساسي | محاسبة | فواتير\n\n🔹 المحترف — 799 ج.م / شهر (أو 6,392 ج.م / سنة)\n• 11-100 موظف | مسير رواتب كامل | GPS حضور | ETA | مخزون | بنوك\n\n🔹 المؤسسي — 1,499 ج.م / شهر (أو 11,992 ج.م / سنة)\n• موظفون غير محدودون | كل المميزات | مشاريع | فروع | مدير حساب\n\nجميع الأسعار شاملة ضريبة القيمة المضافة. خصم 20% على الاشتراك السنوي.'
        : 'Available plans:\n\n🔹 Starter — 299 EGP / month (or 2,390 EGP / year)\n• 1-10 employees | Basic HR | Accounting | Invoicing\n\n🔹 Professional — 799 EGP / month (or 6,392 EGP / year)\n• 11-100 employees | Full payroll | GPS attendance | ETA | Inventory | Banks\n\n🔹 Enterprise — 1,499 EGP / month (or 11,992 EGP / year)\n• Unlimited employees | All features | Projects | Branches | Account manager\n\nAll prices include VAT. 20% discount on annual subscription.' },

    { icon: '⚠️', title: ar ? 'الاستخدام المقبول' : 'Acceptable Use',
      content: ar
        ? 'يجب استخدام النظام للأغراض التجارية المشروعة فقط.\n\nيُحظر:\n• محاولة اختراق النظام أو الوصول لبيانات شركات أخرى\n• مشاركة بيانات الدخول مع أطراف غير مصرح لها\n• استخدام النظام لأنشطة مخالفة للقانون المصري\n• محاولة تعطيل أو إبطاء خوادم النظام\n• نسخ أو إعادة بيع النظام أو أجزاء منه\n\nيحق للنظام تعليق أي حساب يخالف هذه الشروط فوراً دون إشعار مسبق في حالات الانتهاك الجسيم.'
        : 'The system must be used for legitimate business purposes only.\n\nProhibited:\n• Attempting to breach the system or access other companies\' data\n• Sharing login credentials with unauthorized parties\n• Using the system for activities violating Egyptian law\n• Attempting to disrupt or slow down system servers\n• Copying or reselling the system or any part thereof\n\nThe system reserves the right to suspend any account violating these terms immediately without prior notice in cases of serious violation.' },

    { icon: '🔒', title: ar ? 'أمان البيانات وحمايتها' : 'Data Security & Protection',
      content: ar
        ? 'نلتزم بحماية بياناتك بأعلى معايير الأمان:\n\n✅ التشفير:\n• HTTPS / SSL/TLS 1.3 لكل الاتصالات\n• كلمات المرور مشفّرة بـ bcrypt\n• JWT Tokens صالحة 8 ساعات فقط\n\n✅ الحماية التشغيلية:\n• تسجيل خروج تلقائي بعد 30 دقيقة خمول\n• Rate Limiting: 120 طلب/دقيقة / 20 للدخول\n• سجل مراجعة (Audit Log) لكل العمليات المالية\n• نظام محاسبي غير قابل للتعديل (Immutable Ledger)\n\n✅ البنية التحتية:\n• خوادم Hetzner في أوروبا\n• MongoDB معزول مع كلمة مرور قوية\n• نسخ احتياطية دورية'
        : 'We are committed to protecting your data with the highest security standards:\n\n✅ Encryption:\n• HTTPS / SSL/TLS 1.3 for all communications\n• Passwords encrypted with bcrypt\n• JWT Tokens valid for 8 hours only\n\n✅ Operational protection:\n• Auto logout after 30 minutes of inactivity\n• Rate Limiting: 120 req/min / 20 for login\n• Audit Log for all financial operations\n• Immutable Ledger (no modification of posted entries)\n\n✅ Infrastructure:\n• Hetzner servers in Europe\n• Isolated MongoDB with strong password\n• Regular backups' },

    { icon: '📍', title: ar ? 'بيانات الموقع الجغرافي (GPS)' : 'Location Data (GPS)',
      content: ar
        ? 'نظام تسجيل الحضور بالـ GPS:\n\n• الموقع الجغرافي يُستخدم فقط للتحقق من حضور الموظف\n• لا يُخزَّن الموقع الدقيق — يُخزَّن فقط: داخل النطاق أم لا + المسافة من المكتب\n• بيانات الموقع لا تُشارك مع أي طرف ثالث\n• يمكن تعطيل التحقق من الموقع من إعدادات الشركة\n• الإذن يُطلب من المتصفح مرة واحدة عند تفعيل الميزة'
        : 'GPS attendance system:\n\n• Location is used only to verify employee attendance\n• Exact location is not stored — only stored: within geofence or not + distance from office\n• Location data is not shared with any third party\n• Location verification can be disabled from company settings\n• Browser permission is requested once when activating the feature' },

    { icon: '📧', title: ar ? 'البريد الإلكتروني والاتصالات' : 'Email & Communications',
      content: ar
        ? 'قسائم الرواتب:\n• ترسل قسيمة الراتب الشهرية بالبريد عند إضافة الموظف ببريد إلكتروني صحيح\n• تحتوي على: بيانات الموظف، المستحقات، الخصومات، صافي الراتب\n• مُرسَلة من: noreply@datalifeaccount.com\n\nإشعارات النظام:\n• إشعارات تحديث النظام عند صدور إصدارات جديدة\n• إشعارات الموافقات والطلبات بالـ WebSocket\n• تنبيهات تجديد الاشتراك قبل 7 أيام من الانتهاء'
        : 'Payslips:\n• Monthly payslip sent by email when employee has valid email address\n• Contains: employee data, earnings, deductions, net salary\n• Sent from: noreply@datalifeaccount.com\n\nSystem notifications:\n• System update notifications when new versions are released\n• Approval and request notifications via WebSocket\n• Subscription renewal alerts 7 days before expiry' },

    { icon: '❌', title: ar ? 'إنهاء الخدمة وتصدير البيانات' : 'Service Termination & Data Export',
      content: ar
        ? 'يحق لنا إنهاء حسابك عند:\n• انتهاك هذه الشروط بشكل جسيم\n• عدم سداد رسوم الاشتراك خلال 14 يوم من تاريخ الاستحقاق\n• طلبك الصريح لإلغاء الاشتراك\n\nحقوقك عند الإنهاء:\n• يمكنك تصدير جميع بياناتك (موظفين، قيود محاسبية، فواتير) خلال 30 يوم من تاريخ الإلغاء\n• بعد 30 يوم يتم حذف البيانات نهائياً من الخوادم'
        : 'We reserve the right to terminate your account in case of:\n• Serious violation of these terms\n• Failure to pay subscription fees within 14 days of due date\n• Your explicit request to cancel the subscription\n\nYour rights upon termination:\n• You can export all your data (employees, journal entries, invoices) within 30 days of cancellation\n• After 30 days, data is permanently deleted from servers' },

    { icon: '⚖️', title: ar ? 'القانون المطبق والنزاعات' : 'Applicable Law & Disputes',
      content: ar
        ? 'تخضع هذه الشروط لقوانين جمهورية مصر العربية.\n\nفي حالة أي نزاع:\n• نتعهد بمحاولة الحل الودي خلال 30 يوم\n• عند تعذّر الحل الودي، يُحال النزاع إلى محاكم القاهرة المختصة\n\nللتواصل:\n• البريد: info@datalifeai.com\n• الموقع: datalifeaccount.com/contact\n\nآخر تحديث: أغسطس 2026'
        : 'These terms are governed by the laws of the Arab Republic of Egypt.\n\nIn case of any dispute:\n• We commit to attempting amicable resolution within 30 days\n• If amicable resolution fails, the dispute is referred to competent Cairo courts\n\nContact:\n• Email: info@datalifeai.com\n• Website: datalifeaccount.com/contact\n\nLast updated: August 2026' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white">D</div>
          <span className="font-bold text-white">DataLife Account</span>
        </button>
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {ar ? 'رجوع' : 'Back'}</button>
      </nav>

      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-2">{ar ? 'شروط الاستخدام' : 'Terms of Service'}</h1>
          <p className="text-gray-400 text-sm">{ar ? 'آخر تحديث: أغسطس 2026' : 'Last updated: August 2026'}</p>
        </div>

        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-3 p-5 text-start hover:bg-white/5 transition-colors"
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="flex-1 font-semibold text-white">{s.title}</span>
                {open === i ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{s.content}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
