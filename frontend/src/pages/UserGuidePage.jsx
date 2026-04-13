import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Book, Search, ChevronDown, ChevronRight, Home, Users, Calculator,
  FileText, ShoppingCart, FolderKanban, BarChart3, CheckCircle,
  Upload, Settings, Bell, Key, Lock, HelpCircle, LogIn,
  CreditCard, Mail, Clock, Layers
} from 'lucide-react';

const UserGuidePage = ({ language: propLanguage }) => {
  const language = propLanguage || 'ar';
  const isRTL = language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sections = [
    {
      id: 'login', icon: LogIn, color: 'bg-blue-500',
      title: isRTL ? 'تسجيل الدخول وإنشاء الحساب' : 'Login & Account Setup',
      items: [
        { q: isRTL ? 'كيف أسجل شركة جديدة؟' : 'How to register a new company?',
          a: isRTL ? '1. افتح الرابط datalifeaccount.com\n2. اضغط "تسجيل شركة جديدة"\n3. أدخل اسم الشركة، البريد الإلكتروني، كلمة المرور، رقم الهاتف\n4. اضغط "إنشاء حساب"\n5. احفظ كود الاشتراك الذي سيظهر لك' : '1. Open datalifeaccount.com\n2. Click "Register Company"\n3. Enter company name, email, password, phone\n4. Click "Create Account"\n5. Save the subscription code shown' },
        { q: isRTL ? 'كيف أسجل الدخول؟' : 'How to login?',
          a: isRTL ? '1. افتح datalifeaccount.com/login\n2. أدخل البريد الإلكتروني وكلمة المرور\n3. اضغط "تسجيل الدخول"' : '1. Open datalifeaccount.com/login\n2. Enter email and password\n3. Click "Login"' },
        { q: isRTL ? 'نسيت كلمة المرور' : 'Forgot password',
          a: isRTL ? 'من صفحة تسجيل الدخول ← اضغط "نسيت كلمة المرور؟" ← أدخل بريدك ← ستصلك رسالة لإعادة التعيين' : 'From login page → Click "Forgot Password?" → Enter email → You will receive a reset link' },
        { q: isRTL ? 'كيف أغير اللغة؟' : 'How to change language?',
          a: isRTL ? 'في أسفل الشريط الجانبي، اضغط "EN" للإنجليزية أو "عربي" للعربية' : 'At the bottom of sidebar, click "EN" for English or "عربي" for Arabic' },
      ]
    },
    {
      id: 'dashboard', icon: Home, color: 'bg-slate-600',
      title: isRTL ? 'لوحة التحكم الرئيسية' : 'Main Dashboard',
      items: [
        { q: isRTL ? 'ماذا تعرض لوحة التحكم؟' : 'What does the dashboard show?',
          a: isRTL ? 'تعرض ملخصاً شاملاً:\n- عدد الموظفين وإجمالي الإيرادات وعدد الفواتير والمنتجات\n- إجراءات سريعة: إضافة موظف، قيد جديد، فاتورة جديدة، التقارير\n- النشاط الأخير والمهام القادمة' : 'Shows summary:\n- Employee count, revenue, invoices, products\n- Quick actions: Add Employee, New Entry, New Invoice, Reports\n- Recent activity & upcoming tasks' },
      ]
    },
    {
      id: 'hr', icon: Users, color: 'bg-cyan-500',
      title: isRTL ? 'الموارد البشرية' : 'Human Resources',
      items: [
        { q: isRTL ? 'كيف أضيف موظف جديد؟' : 'How to add an employee?',
          a: isRTL ? 'الإعدادات ← الموظفين ← "+ دعوة موظف" ← أدخل الاسم والبريد والدور ← "إرسال الدعوة"\nأو من نظرة عامة HR ← "+ إضافة موظف"' : 'Settings → Employees → "+ Invite" → Enter name, email, role → "Send Invite"' },
        { q: isRTL ? 'كيف أعمل كشف مرتبات؟' : 'How to create payroll?',
          a: isRTL ? '1. الموارد البشرية ← كشف المرتبات\n2. اضغط "+ إنشاء كشف مرتبات"\n3. اختر الشهر\n4. النظام يحسب الرواتب تلقائياً (أساسي + بدلات - خصومات)\n5. راجع البيانات واضغط "حفظ"' : '1. HR → Payroll\n2. Click "+ Create Payroll"\n3. Select month\n4. System auto-calculates\n5. Review and "Save"' },
        { q: isRTL ? 'كيف أصرف الرواتب؟' : 'How to process salaries?',
          a: isRTL ? 'الموارد البشرية ← الرواتب ← اختر الشهر ← اضغط "صرف الرواتب"\nيمكنك أيضاً تصدير البيانات كملف CSV' : 'HR → Salaries → Select month → Click "Process Payroll"\nYou can also export data as CSV' },
        { q: isRTL ? 'كيف أسجل الحضور؟' : 'How to record attendance?',
          a: isRTL ? 'الموارد البشرية ← الحضور ← اختر التاريخ ← لكل موظف سجّل وقت الحضور والانصراف والحالة (حاضر/غائب/إجازة/مأمورية) ← "حفظ"' : 'HR → Attendance → Select date → Record check-in/out and status for each employee → "Save"' },
        { q: isRTL ? 'كيف أضيف بدل أو خصم؟' : 'How to add allowance/deduction?',
          a: isRTL ? 'البدلات: الموارد البشرية ← البدلات ← "+ إضافة بدل" ← اسم البدل والمبلغ والموظف ← "حفظ"\nالخصومات: نفس الخطوات من قائمة الخصومات' : 'Allowances: HR → Allowances → "+ Add" → Name, amount, employee → "Save"\nDeductions: Same from Deductions menu' },
        { q: isRTL ? 'كيف أطلب إجازة؟' : 'How to request leave?',
          a: isRTL ? 'الموارد البشرية ← الإجازات العارضة (أو السنوية) ← "+ طلب إجازة" ← اختر الموظف والتاريخ والسبب ← "إرسال"' : 'HR → Casual/Annual Leave → "+ Request" → Select employee, dates, reason → "Submit"' },
        { q: isRTL ? 'كيف أدير الورديات؟' : 'How to manage shifts?',
          a: isRTL ? 'الموارد البشرية ← الورديات ← "+ إضافة وردية" ← اسم الوردية ووقت البداية والنهاية وأيام العمل ← "حفظ"\nثم عيّن الوردية للموظفين' : 'HR → Shifts → "+ Add Shift" → Name, start/end time, work days → "Save"\nThen assign shift to employees' },
        { q: isRTL ? 'كيف أنهي خدمة موظف؟' : 'How to terminate employee?',
          a: isRTL ? 'الموارد البشرية ← إنهاء الخدمة ← "+ إنهاء خدمة" ← اختر الموظف والتاريخ والسبب (استقالة/فصل/تقاعد) ← النظام يحسب المستحقات ← "تأكيد"' : 'HR → Termination → "+ Terminate" → Select employee, date, reason → System calculates dues → "Confirm"' },
      ]
    },
    {
      id: 'financial', icon: Calculator, color: 'bg-emerald-500',
      title: isRTL ? 'الإدارة المالية' : 'Financial Management',
      items: [
        { q: isRTL ? 'كيف أنشئ قيد يومي؟' : 'How to create journal entry?',
          a: isRTL ? '1. الإدارة المالية ← القيود اليومية ← "+ قيد جديد"\n2. أدخل التاريخ والوصف\n3. أضف سطور القيد (حساب مدين / دائن / المبلغ)\n4. تأكد أن إجمالي المدين = الدائن\n5. "حفظ"' : '1. Financial → Journal Entries → "+ New"\n2. Enter date, description\n3. Add lines (debit/credit account, amount)\n4. Ensure debit = credit\n5. "Save"' },
        { q: isRTL ? 'كيف أضيف عميل أو مورد؟' : 'How to add customer/supplier?',
          a: isRTL ? 'الإدارة المالية ← العملاء والموردين ← "+ إضافة" ← اختر النوع (عميل/مورد) ← أدخل الاسم والهاتف والبريد والعنوان ← "حفظ"' : 'Financial → Parties → "+ Add" → Select type → Enter details → "Save"' },
        { q: isRTL ? 'كيف أضيف حساب بنكي؟' : 'How to add bank account?',
          a: isRTL ? 'الإدارة المالية ← البنوك ← "+ إضافة حساب" ← اسم البنك ورقم الحساب والعملة والرصيد الافتتاحي ← "حفظ"' : 'Financial → Banks → "+ Add Account" → Bank name, account number, currency, balance → "Save"' },
        { q: isRTL ? 'أين التقارير المالية؟' : 'Where are financial reports?',
          a: isRTL ? 'الإدارة المالية ← ميزان المراجعة (أرصدة الحسابات) / قائمة الدخل (الإيرادات والمصروفات) / الميزانية العمومية (الأصول والالتزامات)' : 'Financial → Trial Balance / Income Statement / Balance Sheet' },
      ]
    },
    {
      id: 'invoices', icon: FileText, color: 'bg-amber-500',
      title: isRTL ? 'الفواتير' : 'Invoices',
      items: [
        { q: isRTL ? 'كيف أنشئ فاتورة؟' : 'How to create invoice?',
          a: isRTL ? '1. الفواتير ← "+ فاتورة جديدة"\n2. اختر العميل\n3. أدخل تاريخ الفاتورة والاستحقاق\n4. أضف البنود (المنتج، الكمية، السعر)\n5. أضف الضريبة والخصم إن وجد\n6. "حفظ" أو "حفظ وطباعة"' : '1. Invoices → "+ New Invoice"\n2. Select customer\n3. Enter dates\n4. Add items\n5. Add tax/discount\n6. "Save" or "Save & Print"' },
      ]
    },
    {
      id: 'settings', icon: Settings, color: 'bg-gray-500',
      title: isRTL ? 'الإعدادات والصلاحيات' : 'Settings & Permissions',
      items: [
        { q: isRTL ? 'كيف أرفع صورتي الشخصية؟' : 'How to upload profile photo?',
          a: isRTL ? 'الإعدادات ← الملف الشخصي ← مرر الماوس على الصورة ← اختر ملف ← اقطع الصورة بالشكل المطلوب ← "حفظ"\nالصفحة لا تعيد التحميل — الصورة تتحدث مباشرة' : 'Settings → Profile → Hover over photo → Select file → Crop as needed → "Save"\nPage stays — photo updates instantly' },
        { q: isRTL ? 'كيف أغير صلاحيات موظف؟' : 'How to change employee permissions?',
          a: isRTL ? '1. الإعدادات ← الصلاحيات\n2. اضغط على اسم الموظف\n3. فعّل/ألغِ أي من الـ 21 صلاحية\n4. أو استخدم "قوالب جاهزة":\n   - مدير النظام (21 صلاحية كاملة)\n   - المدير المالي\n   - محاسب\n   - مدير HR\n   - مشاهد فقط\n5. "حفظ"' : '1. Settings → Permissions\n2. Click employee name\n3. Toggle any of 21 permissions\n4. Or use templates: Admin, Financial Manager, Accountant, HR Manager, Viewer\n5. "Save"' },
        { q: isRTL ? 'كيف أغير كلمة المرور؟' : 'How to change password?',
          a: isRTL ? 'الإعدادات ← الملف الشخصي ← "تغيير كلمة المرور" ← أدخل كلمة المرور الحالية والجديدة ← "تغيير"' : 'Settings → Profile → "Change Password" → Enter current and new → "Change"' },
        { q: isRTL ? 'أين كود الاشتراك؟' : 'Where is subscription code?',
          a: isRTL ? 'الإعدادات ← الملف الشخصي ← بطاقة "كود الاشتراك" — اضغط "نسخ" لنسخه' : 'Settings → Profile → "Subscription Code" card — Click "Copy" to copy it' },
      ]
    },
    {
      id: 'notifications', icon: Bell, color: 'bg-red-500',
      title: isRTL ? 'الإشعارات' : 'Notifications',
      items: [
        { q: isRTL ? 'كيف أفعّل إشعارات Push؟' : 'How to enable Push notifications?',
          a: isRTL ? '1. اضغط على أيقونة الجرس في الشريط الجانبي\n2. اضغط "تفعيل" في أسفل القائمة\n3. اسمح للمتصفح بالإشعارات\n4. ستصلك إشعارات حتى عند إغلاق الموقع' : '1. Click bell icon in sidebar\n2. Click "Enable" at bottom\n3. Allow browser notifications\n4. You will get notifications even when site is closed' },
      ]
    },
    {
      id: 'payment', icon: CreditCard, color: 'bg-purple-500',
      title: isRTL ? 'الدفع والاشتراك' : 'Payment & Subscription',
      items: [
        { q: isRTL ? 'طرق الدفع المتاحة' : 'Available payment methods',
          a: isRTL ? '- بطاقة ائتمان (Stripe)\n- PayPal\n- تحويل بنكي\n- InstaPay (رقم: 00201006008552)\n- فودافون كاش (رقم: 00201012625529)\n- كود تفعيل (مجاني - المبلغ = 0)' : '- Credit Card (Stripe)\n- PayPal\n- Bank Transfer\n- InstaPay\n- Vodafone Cash\n- Activation Code (Free)' },
        { q: isRTL ? 'كيف أستخدم كود التفعيل؟' : 'How to use activation code?',
          a: isRTL ? '1. افتح صفحة الدفع\n2. اختر "كود تفعيل" كطريقة دفع\n3. أدخل الكود في الخانة\n4. اضغط "تفعيل الكود"\n5. يتم تفعيل اشتراكك فوراً بمبلغ = 0 (هدية مجانية)' : '1. Open payment page\n2. Select "Activation Code"\n3. Enter the code\n4. Click "Activate"\n5. Subscription activated instantly for free' },
      ]
    },
  ];

  const filteredSections = searchQuery
    ? sections.map(s => ({ ...s, items: s.items.filter(item => item.q.toLowerCase().includes(searchQuery.toLowerCase()) || item.a.toLowerCase().includes(searchQuery.toLowerCase())) })).filter(s => s.items.length > 0)
    : sections;

  return (
    <div className="space-y-6 p-2" dir={isRTL ? 'rtl' : 'ltr'} data-testid="user-guide-page">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#28376B] via-[#1e2a52] to-[#0f1a3a] p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center"><Book className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'دليل المستخدم' : 'User Guide'}</h1>
            <p className="text-white/70 text-sm mt-1">{isRTL ? 'شرح كامل لجميع وظائف النظام وكيفية استخدامها' : 'Complete guide to all system features'}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute top-3 start-3 h-5 w-5 text-gray-400" />
        <Input placeholder={isRTL ? 'ابحث في الدليل...' : 'Search the guide...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ps-10 h-12 text-base" data-testid="guide-search" />
      </div>

      <div className="space-y-3">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections[section.id] || !!searchQuery;
          return (
            <Card key={section.id} className="border overflow-hidden">
              <button onClick={() => toggleSection(section.id)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-start" data-testid={`section-${section.id}`}>
                <div className={`w-10 h-10 ${section.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}><Icon className="h-5 w-5" /></div>
                <span className="flex-1 font-semibold text-gray-800">{section.title}</span>
                <span className="text-xs text-gray-400 me-2">{section.items.length}</span>
                {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
              </button>
              {isExpanded && (
                <div className="border-t divide-y">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="p-4 hover:bg-blue-50/30">
                      <div className="flex items-start gap-2">
                        <HelpCircle className="h-5 w-5 text-[#28376B] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{item.q}</p>
                          <div className="mt-2 text-sm text-gray-600 whitespace-pre-line leading-relaxed bg-gray-50 rounded-lg p-3">{item.a}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="bg-gradient-to-r from-[#28376B]/5 to-blue-50 border-[#28376B]/20">
        <CardContent className="p-6 text-center">
          <Mail className="h-8 w-8 text-[#28376B] mx-auto mb-2" />
          <p className="font-semibold text-gray-800">{isRTL ? 'تحتاج مساعدة؟' : 'Need help?'}</p>
          <p className="text-sm text-gray-500 mt-1">{isRTL ? 'تواصل معنا على' : 'Contact us at'} <a href="mailto:info@datalifeai.com" className="text-[#28376B] font-medium">info@datalifeai.com</a></p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserGuidePage;
