import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function PrivacyPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ar = language === 'ar';
  const [open, setOpen] = useState(0);

  const sections = [
    { icon: '📋', title: ar ? 'ما البيانات التي نجمعها؟' : 'What data do we collect?',
      content: ar
        ? 'بيانات الشركة:\n• اسم الشركة، البريد الإلكتروني، رقم الهاتف\n• الرقم الضريبي وبيانات التسجيل التجاري\n\nبيانات الموظفين (تُدخلها الشركة):\n• الاسم، الرقم القومي، البريد الإلكتروني، رقم الهاتف\n• المرتب والبدلات والخصومات\n• الحضور والانصراف\n• الصور الشخصية وأوراق التعيين\n• بيانات الحساب البنكي (IBAN)\n\nبيانات الاستخدام:\n• سجلات الدخول وأوقاتها\n• العمليات المالية (محمية بـ Audit Log)\n• بيانات الموقع (GPS) للحضور فقط'
        : 'Company data:\n• Company name, email, phone\n• Tax number and commercial registration data\n\nEmployee data (entered by company):\n• Name, national ID, email, phone\n• Salary, allowances, deductions\n• Attendance and check-in/out\n• Profile photos and appointment documents\n• Bank account data (IBAN)\n\nUsage data:\n• Login records and timestamps\n• Financial operations (protected by Audit Log)\n• Location data (GPS) for attendance only' },

    { icon: '🎯', title: ar ? 'لماذا نستخدم بياناتك؟' : 'Why do we use your data?',
      content: ar
        ? '✅ تشغيل الخدمة:\n• حساب الرواتب والتأمينات والضرائب وفق القانون المصري\n• تسجيل الحضور والتحقق من الموقع (GPS)\n• إرسال قسائم الرواتب بالبريد الإلكتروني\n• إصدار الفواتير الإلكترونية (ETA)\n\n✅ الأمان والمراجعة:\n• حماية الحسابات من الاختراق\n• سجل مراجعة العمليات المالية\n• إشعارات أمان تسجيل الدخول\n\n❌ لا نستخدم بياناتك لـ:\n• الإعلانات أو التسويق لطرف ثالث\n• بيع أو تبادل البيانات مع أي جهة\n• أي غرض خارج نطاق الخدمة'
        : '✅ Service operation:\n• Calculate salaries, insurance, taxes per Egyptian law\n• Record attendance and verify location (GPS)\n• Send payslips by email\n• Issue electronic invoices (ETA)\n\n✅ Security and auditing:\n• Protect accounts from breaches\n• Financial operations audit log\n• Login security notifications\n\n❌ We do NOT use your data for:\n• Advertising or marketing to third parties\n• Selling or exchanging data with any entity\n• Any purpose outside the service scope' },

    { icon: '📍', title: ar ? 'بيانات الموقع الجغرافي (GPS)' : 'Location Data (GPS)',
      content: ar
        ? 'نظام الحضور بالـ GPS:\n\n• الموقع يُطلب فقط عند ضغط زر "تسجيل الحضور"\n• يُستخدم للتحقق من أن الموظف داخل النطاق المسموح للشركة\n• لا نخزّن إحداثيات الموقع الدقيقة\n• نخزّن فقط: (داخل النطاق ✅ / خارجه ❌) + المسافة من المكتب بالأمتار\n• بيانات الموقع لا تُستخدم خارج عملية تسجيل الحضور\n• لا تُشارك مع أي طرف ثالث\n• يمكن تعطيل الميزة من إعدادات الشركة'
        : 'GPS attendance system:\n\n• Location is requested only when pressing "Check In" button\n• Used to verify employee is within the company\'s allowed geofence\n• We do not store exact GPS coordinates\n• We only store: (within geofence ✅ / outside ❌) + distance from office in meters\n• Location data is not used outside the attendance process\n• Not shared with any third party\n• Feature can be disabled from company settings' },

    { icon: '🔒', title: ar ? 'كيف نحمي بياناتك؟' : 'How do we protect your data?',
      content: ar
        ? 'طبقات الحماية:\n\n🔐 التشفير:\n• HTTPS + SSL/TLS 1.3 لكل الاتصالات\n• كلمات المرور بـ bcrypt (لا تُخزَّن كنص عادي)\n• JWT Tokens لمدة 8 ساعات فقط\n\n🔐 التحكم في الوصول:\n• تسجيل خروج تلقائي بعد 30 دقيقة خمول\n• Rate Limiting لمنع هجمات القوة الغاشمة\n• نظام صلاحيات متعدد المستويات لكل موظف\n\n🔐 سلامة البيانات المالية:\n• Immutable Ledger: القيود المحاسبية لا تُحذف أو تُعدَّل بعد الترحيل\n• Audit Log: كل عملية مسجّلة بالتوقيت والمستخدم والنتيجة\n\n🔐 البنية التحتية:\n• خوادم Hetzner في ألمانيا (EU GDPR compliant)\n• قاعدة بيانات MongoDB معزولة\n• نسخ احتياطية دورية'
        : 'Protection layers:\n\n🔐 Encryption:\n• HTTPS + SSL/TLS 1.3 for all communications\n• Passwords with bcrypt (not stored as plain text)\n• JWT Tokens for 8 hours only\n\n🔐 Access control:\n• Auto logout after 30 minutes of inactivity\n• Rate Limiting to prevent brute force attacks\n• Multi-level permission system per employee\n\n🔐 Financial data integrity:\n• Immutable Ledger: accounting entries cannot be deleted or modified after posting\n• Audit Log: every operation recorded with timestamp, user, and result\n\n🔐 Infrastructure:\n• Hetzner servers in Germany (EU GDPR compliant)\n• Isolated MongoDB database\n• Regular backups' },

    { icon: '🤝', title: ar ? 'مشاركة البيانات مع أطراف ثالثة' : 'Data Sharing with Third Parties',
      content: ar
        ? 'نشارك بيانات محدودة فقط مع:\n\n📧 Resend (خدمة البريد):\n• إرسال قسائم الرواتب وإشعارات النظام فقط\n• لا يحتفظون بمحتوى الرسائل\n\n🏛️ مصلحة الضرائب المصرية (ETA):\n• بيانات الفواتير الإلكترونية المطلوبة قانوناً\n• يتم بموافقتك الصريحة عند إعداد منظومة ETA\n\n💳 بوابات الدفع (Stripe / PayPal):\n• بيانات الدفع فقط لإتمام عمليات الاشتراك\n• لا نخزّن بيانات البطاقات على خوادمنا\n\n❌ لا نشارك البيانات مع:\n• شركات تسويق أو إعلانات\n• أي طرف ثالث لأغراض تجارية'
        : 'We share limited data only with:\n\n📧 Resend (email service):\n• Sending payslips and system notifications only\n• They do not retain message content\n\n🏛️ Egyptian Tax Authority (ETA):\n• E-invoice data required by law\n• Done with your explicit consent when setting up ETA\n\n💳 Payment gateways (Stripe / PayPal):\n• Payment data only to complete subscription transactions\n• We do not store card data on our servers\n\n❌ We do NOT share data with:\n• Marketing or advertising companies\n• Any third party for commercial purposes' },

    { icon: '⏰', title: ar ? 'مدة الاحتفاظ بالبيانات' : 'Data Retention Period',
      content: ar
        ? 'بيانات الحساب النشط:\n• تُحفظ طوال فترة الاشتراك\n\nبعد إلغاء الاشتراك:\n• تبقى 30 يوم متاحة للتصدير\n• بعد 30 يوم تُحذف نهائياً من الخوادم\n\nسجلات Audit Log:\n• تُحفظ لمدة 7 سنوات وفق متطلبات المحاسبة المصرية\n\nسجلات الجلسات:\n• يُسجَّل تاريخ آخر دخول فقط (لأغراض الأمان)\n• لا تُحفظ سجلات النشاط التفصيلي بعد 90 يوم'
        : 'Active account data:\n• Stored throughout the subscription period\n\nAfter subscription cancellation:\n• Available for 30 days for export\n• After 30 days permanently deleted from servers\n\nAudit Log records:\n• Stored for 7 years per Egyptian accounting requirements\n\nSession records:\n• Only last login date is recorded (for security purposes)\n• Detailed activity logs not stored after 90 days' },

    { icon: '👤', title: ar ? 'حقوقك وكيفية التواصل' : 'Your Rights & Contact',
      content: ar
        ? 'لديك الحق في:\n• ✅ الاطلاع على بياناتك المخزّنة\n• ✅ تصحيح أي بيانات غير دقيقة\n• ✅ تصدير جميع بياناتك\n• ✅ طلب حذف حسابك وبياناتك\n• ✅ الاعتراض على معالجة معينة\n\nللتواصل بشأن الخصوصية:\n📧 info@datalifeai.com\n🌐 datalifeaccount.com/contact\n\nآخر تحديث: أغسطس 2026\nهذه السياسة تنطبق على إصدار DataLife Account v2.1+'
        : 'You have the right to:\n• ✅ Access your stored data\n• ✅ Correct any inaccurate data\n• ✅ Export all your data\n• ✅ Request deletion of your account and data\n• ✅ Object to certain processing\n\nTo contact us about privacy:\n📧 info@datalifeai.com\n🌐 datalifeaccount.com/contact\n\nLast updated: August 2026\nThis policy applies to DataLife Account v2.1+' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL ? 'rtl' : 'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white">D</div>
          <span className="font-bold text-white">DataLife Account</span>
        </button>
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {ar ? 'رجوع' : 'Back'}</button>
      </nav>

      <div className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-2">{ar ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
          <p className="text-gray-400 text-sm">{ar ? 'آخر تحديث: أغسطس 2026 | DataLife Account v2.1' : 'Last updated: August 2026 | DataLife Account v2.1'}</p>
        </div>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-3 p-5 text-start hover:bg-white/5 transition-colors">
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
