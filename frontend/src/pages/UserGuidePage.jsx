import React, { useState } from 'react';
import {
  LogIn, Home, Users, Calculator, FileText, Settings,
  Bell, CreditCard, ChevronDown, ChevronUp, Search,
  Shield, Building2, Sparkles, BookOpen, Layers,
  BarChart3, ClipboardList, Banknote, Package, FolderOpen,
  Scale, AlertTriangle, RefreshCw, Globe, TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';

export default function UserGuidePage() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [searchQuery, setSearchQuery]   = useState('');
  const [expandedSections, setExpandedSections] = useState({ login: true });

  const toggleSection = (id) =>
    setExpandedSections(p => ({ ...p, [id]: !p[id] }));

  const sections = [
    // ─── تسجيل الدخول ────────────────────────────────
    {
      id: 'login', icon: LogIn, color: 'bg-blue-600',
      badge: null,
      title: ar ? 'تسجيل الدخول والحساب' : 'Login & Account',
      items: [
        { q: ar ? 'كيف أسجل شركة جديدة؟' : 'How to register a new company?',
          a: ar ? '1. افتح datalifeaccount.com\n2. اضغط "تسجيل شركة جديدة"\n3. أدخل: اسم الشركة، البريد الإلكتروني، كلمة المرور، رقم الهاتف\n4. اضغط "إنشاء حساب"\n5. احتفظ بكود الاشتراك الذي سيظهر لك' : '1. Go to datalifeaccount.com\n2. Click "Register Company"\n3. Enter company name, email, password, phone\n4. Click "Create Account"\n5. Save the subscription code shown to you' },
        { q: ar ? 'كيف أسجل الدخول؟' : 'How to login?',
          a: ar ? '1. افتح datalifeaccount.com/login\n2. أدخل البريد الإلكتروني وكلمة المرور\n3. اضغط "تسجيل الدخول"\n\n⚠️ تنبيه أمني: سيتم تسجيل خروجك تلقائياً بعد 30 دقيقة من عدم النشاط حماية لبياناتك المالية' : '1. Go to datalifeaccount.com/login\n2. Enter email and password\n3. Click "Login"\n\n⚠️ Security: You will be automatically logged out after 30 minutes of inactivity to protect your financial data' },
        { q: ar ? 'نسيت كلمة المرور' : 'Forgot password?',
          a: ar ? 'صفحة الدخول ← اضغط "نسيت كلمة المرور؟" ← أدخل بريدك الإلكتروني ← ستصلك رسالة لإعادة التعيين\n\nلم تصلك الرسالة؟ تحقق من مجلد Spam أو تواصل معنا على info@datalifeai.com' : 'Login page → Click "Forgot Password?" → Enter email → Check inbox for reset link\n\nNo email? Check Spam folder or contact info@datalifeai.com' },
        { q: ar ? 'كيف أغير اللغة؟' : 'How to change language?',
          a: ar ? 'في أسفل الشريط الجانبي، اضغط "EN" للإنجليزية أو "عربي" للعربية\nالنظام يدعم العربية بالكامل مع واجهة RTL' : 'At the bottom of sidebar, click "EN" for English or "عربي" for Arabic\nFull RTL support for Arabic' },
        { q: ar ? 'كيف أضيف موظفين إلى النظام؟' : 'How to invite employees to the system?',
          a: ar ? 'الإعدادات ← إدارة المستخدمين ← "دعوة موظف"\n► سيصله بريد إلكتروني بكلمة مرور مؤقتة\n► يمكنك متابعة: هل دخل؟ متى آخر دخول؟ كم مرة أُرسلت الدعوة؟\n► زر "إعادة إرسال" لإعادة الدعوة في أي وقت' : 'Settings → User Management → "Invite Employee"\n► They receive email with temporary password\n► Track: Did they login? When? How many invites sent?\n► "Resend" button to re-invite anytime' },
      ]
    },

    // ─── لوحة التحكم ────────────────────────────────
    {
      id: 'dashboard', icon: Home, color: 'bg-slate-700',
      badge: ar ? 'محدّث' : 'Updated',
      title: ar ? 'لوحة التحكم الرئيسية' : 'Main Dashboard',
      items: [
        { q: ar ? 'ماذا تعرض لوحة التحكم؟' : 'What does the dashboard show?',
          a: ar ? 'لوحة التحكم تعرض بيانات حقيقية من قاعدة البيانات:\n\n📊 مؤشرات رئيسية:\n• عدد الموظفين الفعليين\n• إجمالي الإيرادات (من الفواتير والمشاريع)\n• إجمالي المصروفات (من القيود المحاسبية)\n• عدد المشاريع النشطة\n• عدد الفواتير\n\n⚡ الإجراءات السريعة:\n• + إضافة موظف ← يفتح صفحة HR مباشرة\n• + قيد جديد ← يفتح صفحة القيود\n• + فاتورة جديدة ← يفتح صفحة الفواتير\n• التقارير ← يفتح التقارير المالية\n\n🔔 التحديثات الفورية: إذا وافق أحد على طلب ستظهر لك فوراً دون تحديث الصفحة' : 'Dashboard shows real data from the database:\n\n📊 KPIs:\n• Actual employee count\n• Total revenue (from invoices & projects)\n• Total expenses (from journal entries)\n• Active projects count\n• Invoice count\n\n⚡ Quick Actions:\n• + Add Employee → opens HR\n• + New Entry → opens Journal Entries\n• + New Invoice → opens Invoices\n• Reports → opens Financial Reports\n\n🔔 Real-time updates: approvals and changes appear instantly without page refresh' },
        { q: ar ? 'زر الرجوع — كيف يعمل؟' : 'Back button — how does it work?',
          a: ar ? 'في كل صفحة داخل النظام يظهر زر "رجوع للرئيسية" في أعلى يمين المحتوى\nيعيدك مباشرة للوحة التحكم الرئيسية بنقرة واحدة' : 'Every page inside the system shows a "Back to Dashboard" button at top\nReturns you directly to dashboard in one click' },
      ]
    },

    // ─── الموارد البشرية ────────────────────────────────
    {
      id: 'hr', icon: Users, color: 'bg-cyan-600',
      badge: ar ? 'قانون 148/2019' : 'Law 148/2019',
      title: ar ? 'الموارد البشرية والمرتبات' : 'HR & Payroll',
      items: [
        { q: ar ? 'كيف أضيف موظف جديد مع صورته ومستنداته؟' : 'How to add employee with photo & documents?',
          a: ar ? 'الموارد البشرية ← نظرة عامة ← "إضافة موظف"\n\n📸 الصورة الشخصية:\n• اضغط منطقة الصورة أو اسحب الملف\n• يُقبل: JPG, PNG, WEBP\n\n📋 أوراق التعيين (اختياري عند الإضافة، يمكن رفعها لاحقاً):\n• خطاب التعيين (PDF/DOC)\n• صورة البطاقة الشخصية (JPG/PNG)\n• عقد العمل (PDF)\n\nيمكن إضافة المزيد من المستندات لاحقاً من ملف الموظف:\n► بطاقة شخصية / جواز سفر / شهادات علمية\n► كارنيه التأمين / تقرير طبي\n► بيانات الحساب البنكي / صحيفة الحالة الجنائية' : 'HR → Overview → "Add Employee"\n\n📸 Profile Photo:\n• Click photo area or drag file\n• Accepts: JPG, PNG, WEBP\n\n📋 Appointment Documents (optional at add, can upload later):\n• Appointment Letter (PDF/DOC)\n• National ID Copy (JPG/PNG)\n• Employment Contract (PDF)\n\nMore documents can be added from employee profile:\n► National ID / Passport / Certificates\n► Insurance Card / Medical Report\n► Bank Account Info / Criminal Record' },
        { q: ar ? 'كيف يعمل كشف المرتبات وفق القانون المصري؟' : 'How does Egyptian law payroll work?',
          a: ar ? 'النظام يطبق قانون 148/2019 للتأمينات الاجتماعية وقانون 91/2005 لضريبة كسب العمل:\n\n📊 مكونات المرتب:\n• الراتب الأساسي + البدلات = الأجر الشامل\n\n📉 الاستقطاعات التلقائية:\n• ضريبة كسب العمل (7 شرائح تصاعدية سنوياً)\n• تأمينات اجتماعية - حصة الموظف: 11%\n• صندوق إعانة الطوارئ: 1% من الأجر الأساسي\n• صندوق تكريم الشهداء: 0.05%\n• السلف والجزاءات\n\n📈 التزامات الشركة (تُضاف لتكلفة العمالة):\n• تأمينات حصة الشركة: 18.75%\n• التأمين الصحي الشامل: 0.25%\n\n📧 عند صرف المرتبات:\nاضغط "إرسال القسائم" → يصل كل موظف بريد إلكتروني بقسيمة راتب مفصّلة' : 'System applies Law 148/2019 (Social Insurance) and Law 91/2005 (Income Tax):\n\n📊 Salary Components:\n• Basic + Allowances = Gross\n\n📉 Automatic Deductions:\n• Income Tax (7 progressive annual brackets)\n• Social Insurance employee share: 11%\n• Emergency Workers Fund: 1%\n• Martyrs Fund: 0.05%\n• Loans & penalties\n\n📈 Company Obligations (added to labor cost):\n• Social Insurance company share: 18.75%\n• Universal Health Insurance: 0.25%\n\n📧 When paying salaries:\nClick "Send Payslips" → each employee receives detailed email payslip' },
        { q: ar ? 'كيف أرسل قسيمة الراتب بالبريد؟' : 'How to email payslips?',
          a: ar ? 'الموارد البشرية ← كشف المرتبات ← اختر الشهر ← "إرسال القسائم"\n\n📧 القسيمة تحتوي:\n✓ بيانات الموظف (الاسم، القسم، الوظيفة، كود الموظف)\n✓ الراتب الأساسي + البدلات مفصّلة\n✓ الخصومات: التأمينات + الضريبة + الدمغة + السلف\n✓ صافي الراتب المستحق بشكل بارز\n✓ اعتُمد بواسطة: اسم المسؤول المالي\n✓ طريقة الصرف (بنك/نقدي/شيك)' : 'HR → Payroll → Select month → "Send Payslips"\n\n📧 Payslip contains:\n✓ Employee details (name, department, position, ID)\n✓ Basic salary + itemized allowances\n✓ Deductions: insurance + tax + stamp + loans\n✓ Net salary prominently displayed\n✓ Approved by: financial manager name\n✓ Payment method (bank/cash/check)' },
        { q: ar ? 'كيف أسجل الحضور والانصراف؟' : 'How to record attendance?',
          a: ar ? 'الموارد البشرية ← الحضور ← اختر التاريخ\nلكل موظف: وقت الحضور / الانصراف / الحالة (حاضر/غائب/إجازة/مأمورية)\n← "حفظ"\n\nملاحظة: الورديات تؤثر تلقائياً على احتساب التأخير والأوفر تايم' : 'HR → Attendance → Select date\nFor each employee: check-in / check-out / status (present/absent/leave/mission)\n← "Save"\n\nNote: Shifts automatically affect late arrival and overtime calculation' },
        { q: ar ? 'إدارة الورديات' : 'Shifts management',
          a: ar ? 'الموارد البشرية ← الورديات ← "+ إضافة وردية"\n• اسم الوردية، وقت البداية والنهاية، أيام العمل\n← "حفظ" ثم عيّن الوردية للموظفين من ملف كل موظف' : 'HR → Shifts → "+ Add Shift"\n• Shift name, start/end time, work days\n← "Save" then assign shift to employees from each employee profile' },
        { q: ar ? 'طلب إجازة وإدارة الإجازات' : 'Leave requests and management',
          a: ar ? 'الموارد البشرية ← الإجازات العارضة / السنوية ← "+ طلب إجازة"\nاختر الموظف والتاريخ والسبب ← "إرسال"\n\nالمدير يوافق من صفحة الموافقات (الإشعار يصله فوراً)' : 'HR → Casual/Annual Leave → "+ Request Leave"\nSelect employee, dates, reason ← "Submit"\n\nManager approves from Approvals page (they get instant notification)' },
        { q: ar ? 'كيف أحسب مكافأة نهاية الخدمة؟' : 'How to calculate end-of-service?',
          a: ar ? 'الموارد البشرية ← إنهاء الخدمة ← "+ إنهاء خدمة"\nاختر الموظف والتاريخ والسبب (استقالة/فصل/تقاعد)\nالنظام يحسب تلقائياً:\n• مكافأة نهاية الخدمة\n• الإجازات غير المستهلكة\n• المستحقات الأخرى\n← "تأكيد"' : 'HR → Termination → "+ Terminate"\nSelect employee, date, reason (resignation/dismissal/retirement)\nSystem auto-calculates:\n• End-of-service gratuity\n• Unused leave balance\n• Other dues\n← "Confirm"' },
      ]
    },

    // ─── المحاسبة ────────────────────────────────
    {
      id: 'financial', icon: Calculator, color: 'bg-emerald-600',
      badge: ar ? 'Enterprise Grade' : 'Enterprise Grade',
      title: ar ? 'المحاسبة المالية' : 'Financial Accounting',
      items: [
        { q: ar ? 'ما هو دليل الحسابات المصري المتاح؟' : 'What Egyptian chart of accounts is available?',
          a: ar ? 'النظام يحتوي على 108 حساب وفق الدليل المصري المعياري:\n\n📂 الأصول (1xx):\n111-116: أصول ثابتة | 131 عملاء | 134 سلف موظفين\n137 VAT مدخلات | 138 خصم وتحصيل | 141 ضمانات محتجزة\n161 خزينة | 162 بنك\n\n📂 الالتزامات (2xx):\n251 موردون | 253 رواتب مستحقة | 254 ضرائب | 255 تأمينات\n258 صندوق الطوارئ | 259 صندوق الشهداء | 260 VAT مخرجات\n261 خصم وتحصيل | 262 تأمين صحي شامل\n\n📂 المصروفات (3xx):\n311 تكلفة مواد | 315 مقاولو باطن | 331 رواتب إدارية\n332 مصروفات خدمية | 333 إهلاك | 335-338 إيجار/قانوني/سفر/تأمين\n339-340 صناديق إجبارية\n\n📂 الإيرادات (4xx):\n411 مبيعات | 412 خدمات | 414 مقاولات | 415 طبي | 416 استشارات' : 'System contains 108 accounts per Egyptian standard chart:\n\n📂 Assets (1xx):\n111-116: Fixed assets | 131 Customers | 134 Employee loans\n137 VAT input | 138 WHT retained | 141 Retention asset\n161 Cash | 162 Bank\n\n📂 Liabilities (2xx):\n251 Suppliers | 253 Accrued salaries | 254 Taxes | 255 Insurance\n258 Emergency fund | 259 Martyrs fund | 260 VAT output\n261 WHT payable | 262 UHI\n\n📂 Expenses (3xx):\n311 Materials cost | 315 Subcontractors | 331 Admin salaries\n332 Utilities | 333 Depreciation | 335-338 Rent/Legal/Travel/Insurance\n339-340 Mandatory funds\n\n📂 Revenue (4xx):\n411 Sales | 412 Services | 414 Contracting | 415 Medical | 416 Consulting' },
        { q: ar ? 'كيف أنشئ قيد يومي؟' : 'How to create a journal entry?',
          a: ar ? '1. الإدارة المالية ← القيود اليومية ← "+ قيد جديد"\n2. أدخل: التاريخ، الوصف، نوع المستند المصدر\n3. أضف سطور القيد:\n   • الحساب (ابحث بالكود أو الاسم)\n   • مدين / دائن\n   • مركز التكلفة / المشروع (اختياري)\n4. تأكد: إجمالي المدين = إجمالي الدائن\n5. "حفظ" ← يُرحّل تلقائياً ويظهر في الأستاذ العام\n\n⚠️ مبدأ الثبات: القيود المرحّلة لا تُحذف ولا تُعدّل\nللتصحيح: استخدم "قيد عكسي" من نفس الصفحة' : '1. Financial → Journal Entries → "+ New Entry"\n2. Enter: date, description, source document type\n3. Add lines:\n   • Account (search by code or name)\n   • Debit / Credit\n   • Cost center / Project (optional)\n4. Verify: total debit = total credit\n5. "Save" → auto-posted to General Ledger\n\n⚠️ Immutability: Posted entries cannot be deleted or edited\nTo correct: use "Reverse Entry" from the same page' },
        { q: ar ? 'ما هي القيود التلقائية في النظام؟' : 'What are the automatic journal entries?',
          a: ar ? 'النظام ينشئ قيوداً محاسبية تلقائياً عند:\n\n💰 الفواتير:\n• فاتورة بيع → مدين: العملاء (131) | دائن: إيراد مبيعات (411) + VAT مخرجات (260)\n• فاتورة شراء → مدين: تكلفة (311) + VAT مدخلات (137) | دائن: موردون (251)\n\n👥 الرواتب (عند الاعتماد):\n• مدين: رواتب (331) + تأمينات الشركة + صناديق\n• دائن: تأمينات مستحقة + ضريبة + صافي رواتب (253)\n\n👥 صرف الرواتب:\n• مدين: رواتب مستحقة (253) | دائن: بنك (162)\n\n🔨 الأصول الثابتة:\n• مدين: الأصل (111-116) | دائن: بنك (162)\n• الإهلاك → مدين: إهلاك (333) | دائن: مجمع إهلاك (222)\n\n📋 المشاريع:\n• إيراد مشروع → مدين: بنك/خزينة | دائن: إيرادات مشاريع (412)\n• مصروف مشروع → مدين: المصروف | دائن: بنك/خزينة\n\n🏗️ المستخلصات (مقاولات):\n• مدين: عملاء (131) + ضمان (141) + خصم (138)\n• دائن: إيرادات مقاولات (414) + VAT (260)' : 'System creates automatic entries when:\n\n💰 Invoices:\n• Sales invoice → Dr: Customers (131) | Cr: Revenue (411) + VAT out (260)\n• Purchase invoice → Dr: Cost (311) + VAT in (137) | Cr: Suppliers (251)\n\n👥 Payroll (on approval):\n• Dr: Salaries (331) + company insurance + funds\n• Cr: Insurance payable + tax + net salaries (253)\n\n👥 Paying salaries:\n• Dr: Accrued salaries (253) | Cr: Bank (162)\n\n🔨 Fixed Assets:\n• Dr: Asset (111-116) | Cr: Bank (162)\n• Depreciation → Dr: Depreciation (333) | Cr: Accumulated (222)\n\n📋 Projects:\n• Revenue → Dr: Bank/Cash | Cr: Project revenue (412)\n• Expense → Dr: Expense | Cr: Bank/Cash\n\n🏗️ Progress Claims (Contracting):\n• Dr: Customers (131) + Retention (141) + WHT (138)\n• Cr: Contracting revenue (414) + VAT (260)' },
        { q: ar ? 'كيف أقرأ التقارير المالية؟' : 'How to read financial reports?',
          a: ar ? '📊 ميزان المراجعة:\nيعرض كل الحسابات مع أرصدتها المدينة والدائنة\n← تأكد أن مجموع المدين = مجموع الدائن\n\n📈 قائمة الدخل:\nالإيرادات - تكلفة المبيعات = مجمل الربح\nمجمل الربح - المصروفات التشغيلية = صافي الربح\n\n📋 الميزانية العمومية:\nالأصول = الالتزامات + حقوق الملكية\n\n📁 دفتر الأستاذ العام:\nكل الحركات مرتبة حساباً حساباً مع الرصيد التراكمي\n\n💡 نصيحة: استخدم التصفية بالتاريخ لمقارنة الفترات' : '📊 Trial Balance:\nShows all accounts with debit/credit balances\n← Total debit must equal total credit\n\n📈 Income Statement:\nRevenue - Cost of Sales = Gross Profit\nGross Profit - Operating Expenses = Net Profit\n\n📋 Balance Sheet:\nAssets = Liabilities + Equity\n\n📁 General Ledger:\nAll transactions sorted by account with running balance\n\n💡 Tip: Use date filter to compare periods' },
        { q: ar ? 'كيف أدير البنوك والتسويات؟' : 'How to manage banks and reconciliation?',
          a: ar ? 'الإدارة المالية ← إدارة البنوك\n• أضف حساباتك البنكية مع كودها المحاسبي\n• سجّل الإيداعات والسحوبات والشيكات\n• كل معاملة تولّد قيداً تلقائياً\n• تقرير التسوية البنكية متاح للتحقق' : 'Financial → Bank Management\n• Add your bank accounts with accounting codes\n• Record deposits, withdrawals, checks\n• Each transaction generates automatic entry\n• Bank reconciliation report available' },
        { q: ar ? 'كيف أدير الأصول الثابتة؟' : 'How to manage fixed assets?',
          a: ar ? 'الإدارة المالية ← الأصول والضرائب ← "إضافة أصل"\n\n10 فئات وفق القانون المصري مع نسب إهلاك مختلفة:\n• مباني 5% | آلات 10% | سيارات 25%\n• أثاث 20% | كمبيوتر 50%\n\nعند الإضافة:\n• يُنشأ قيد شراء تلقائياً\n• الإهلاك يُحتسب ويُقيّد دورياً\n• كل الأصول تظهر في الميزانية' : 'Financial → Assets & Tax → "Add Asset"\n\n10 categories per Egyptian law with different depreciation rates:\n• Buildings 5% | Machinery 10% | Vehicles 25%\n• Furniture 20% | Computers 50%\n\nOn adding:\n• Purchase entry created automatically\n• Depreciation calculated and posted periodically\n• All assets shown in Balance Sheet' },
      ]
    },

    // ─── الفواتير ────────────────────────────────
    {
      id: 'invoices', icon: FileText, color: 'bg-amber-500',
      badge: ar ? 'ETA مدمج' : 'ETA Integrated',
      title: ar ? 'الفواتير والمشتريات' : 'Invoices & Purchases',
      items: [
        { q: ar ? 'كيف أنشئ فاتورة بيع؟' : 'How to create a sales invoice?',
          a: ar ? '1. الفواتير ← "+ فاتورة جديدة"\n2. اختر العميل (أو أضفه مباشرة)\n3. حدد تاريخ الفاتورة والاستحقاق\n4. أضف البنود: المنتج، الكمية، السعر\n5. أضف ضريبة القيمة المضافة 14% والخصم\n6. "حفظ" أو "حفظ وطباعة PDF"\n\nالقيد المحاسبي يُنشأ تلقائياً:\n► مدين: العملاء 131 | دائن: إيراد 411 + VAT مخرجات 260' : '1. Invoices → "+ New Invoice"\n2. Select/add customer\n3. Set invoice and due dates\n4. Add items: product, quantity, price\n5. Add VAT 14% and discount\n6. "Save" or "Save & Print PDF"\n\nJournal entry created automatically:\n► Dr: Customers 131 | Cr: Revenue 411 + VAT out 260' },
        { q: ar ? 'الفاتورة الإلكترونية المصرية (ETA)' : 'Egyptian E-Invoice (ETA)',
          a: ar ? 'النظام مرتبط بمنظومة الفاتورة الإلكترونية لمصلحة الضرائب المصرية:\n\n📋 بيانات مطلوبة:\n• رقم تسجيل ضريبي للشركة\n• كود GS1 أو EGS للمنتج/الخدمة\n• بيانات المشتري مكتملة\n\n📊 حالات الفاتورة:\n• Pending: في انتظار الإرسال\n• Valid: معتمدة من مصلحة الضرائب\n• Invalid: فيها خطأ يحتاج تصحيح\n• Cancelled: ملغاة\n\nالإعداد: الإعدادات ← إعدادات ETA ← أدخل بيانات شركتك الضريبية' : 'System is integrated with Egyptian Tax Authority e-invoice system:\n\n📋 Required data:\n• Company tax registration number\n• GS1 or EGS code for product/service\n• Complete buyer details\n\n📊 Invoice statuses:\n• Pending: awaiting submission\n• Valid: approved by ETA\n• Invalid: has error needing correction\n• Cancelled: cancelled\n\nSetup: Settings → ETA Settings → Enter your tax data' },
        { q: ar ? 'كيف أتابع المشتريات؟' : 'How to track purchases?',
          a: ar ? 'الإدارة المالية ← المشتريات\n• أنشئ أمر شراء ← حدد المورد والبنود\n• تتبع حالة الطلب: قيد / معتمد / مستلم\n• عند الاستلام: القيد يُنشأ تلقائياً (تكلفة + VAT مدخلات)' : 'Financial → Purchases\n• Create PO → select supplier and items\n• Track status: draft / approved / received\n• On receipt: entry created automatically (cost + VAT input)' },
      ]
    },

    // ─── المشاريع ────────────────────────────────
    {
      id: 'projects', icon: FolderOpen, color: 'bg-violet-600',
      badge: ar ? 'معيار 8' : 'Standard 8',
      title: ar ? 'المشاريع والمقاولات' : 'Projects & Contracting',
      items: [
        { q: ar ? 'كيف أدير مشروع مع ربطه بالمحاسبة؟' : 'How to manage a project with accounting?',
          a: ar ? 'الإدارة المالية ← المشاريع ← "+ مشروع جديد"\n\nكل حركة في المشروع تولّد قيداً محاسبياً:\n• إضافة إيراد للمشروع → مدين: بنك/خزينة | دائن: إيراد مشاريع 412\n• إضافة مصروف → مدين: المصروف | دائن: بنك/خزينة\n\nالمشاريع تظهر في:\n► قائمة الدخل (إيرادات ومصروفات)\n► دفتر الأستاذ العام\n► ميزان المراجعة' : 'Financial → Projects → "+ New Project"\n\nEvery project transaction generates a journal entry:\n• Add revenue → Dr: Bank/Cash | Cr: Project revenue 412\n• Add expense → Dr: Expense | Cr: Bank/Cash\n\nProjects appear in:\n► Income Statement\n► General Ledger\n► Trial Balance' },
        { q: ar ? 'المستخلصات والتأمينات المحتجزة (قطاع المقاولات)' : 'Progress Claims & Retention (Contracting)',
          a: ar ? 'الإدارة المالية ← المشاريع المتقدمة ← المستخلصات\n\nوفق المعيار المحاسبي المصري رقم 8:\n• إجمالي المستخلص\n• خصم التأمين المحتجز (5-10%)\n• خصم الدفعة المقدمة\n• ضريبة القيمة المضافة (5% أو 14%)\n• ضريبة الخصم والتحصيل 1%\n• صافي المستحق\n\nالقيد ينشأ تلقائياً:\n► 131 عملاء + 141 ضمان + 138 خصم → 414 إيرادات + 260 VAT' : 'Financial → Advanced Projects → Progress Claims\n\nPer Egyptian Accounting Standard 8:\n• Gross claim amount\n• Retention deduction (5-10%)\n• Advance payment deduction\n• VAT (5% or 14%)\n• Withholding tax 1%\n• Net payable\n\nEntry created automatically:\n► 131 Customers + 141 Retention + 138 WHT → 414 Revenue + 260 VAT' },
      ]
    },

    // ─── المبيعات CRM ────────────────────────────────
    {
      id: 'sales', icon: TrendingUp, color: 'bg-orange-500',
      badge: ar ? 'جديد' : 'New',
      title: ar ? 'المبيعات وإدارة العملاء CRM' : 'Sales & CRM',
      items: [
        { q: ar ? 'كيف أضيف عميل جديد في CRM؟' : 'How to add a new customer in CRM?',
          a: ar ? 'المبيعات CRM ← العملاء ← "+ عميل جديد"\n\nالبيانات الأساسية:\n• الاسم (عربي + إنجليزي)\n• النوع: فرد / شركة / حكومي\n• المرحلة: عميل محتمل → مرتقب → عميل → VIP\n• الهاتف والبريد الإلكتروني والعنوان\n• الرقم الضريبي والسجل التجاري\n• حد الائتمان وشروط الدفع (أيام)\n• خصم خاص بالعميل\n\nالعميل يحصل على كود تلقائي (CUS-0001)' : 'Sales CRM → Customers → "+ New Customer"\n\nBasic data:\n• Name (Arabic + English)\n• Type: Individual / Company / Government\n• Stage: Lead → Prospect → Customer → VIP\n• Phone, email, address\n• Tax number, commercial registration\n• Credit limit and payment terms (days)\n• Customer-specific discount\n\nAuto-generated code (CUS-0001)' },
        { q: ar ? 'كيف أنشئ عرض سعر؟' : 'How to create a quotation?',
          a: ar ? 'المبيعات CRM ← عروض الأسعار ← "+ عرض سعر جديد"\n\n1. اختر اسم العميل\n2. حدد تاريخ العرض ومدة الصلاحية (أيام)\n3. أضف الأصناف:\n   • وصف الصنف | الكمية | الوحدة | سعر الوحدة\n4. حدد الخصم % وضريبة القيمة المضافة %\n5. النظام يحسب تلقائياً: إجمالي + خصم + ضريبة + صافي\n6. "حفظ عرض السعر"\n\nحالات العرض:\n• مسودة → مرسل → مقبول / مرفوض / منتهي\n\nتحويل لفاتورة:\nاضغط "تحويل" ← تنشأ فاتورة مبيعات مباشرة بنفس البيانات' : 'Sales CRM → Quotations → "+ New Quote"\n\n1. Enter customer name\n2. Set quote date and validity period (days)\n3. Add items:\n   • Description | Qty | Unit | Unit Price\n4. Set discount % and VAT %\n5. System auto-calculates: subtotal + discount + tax + total\n6. "Save Quotation"\n\nQuote statuses:\n• Draft → Sent → Accepted / Rejected / Expired\n\nConvert to invoice:\nClick "Convert" → Sales invoice created with same data' },
        { q: ar ? 'كيف أنشئ فاتورة مبيعات وأسجل دفعة؟' : 'How to create sales invoice and record payment?',
          a: ar ? 'المبيعات CRM ← فواتير المبيعات\n\nإنشاء فاتورة:\n• مباشرة "+ فاتورة جديدة" أو من تحويل عرض سعر\n• رقم الفاتورة يُولَّد تلقائياً (INV-2026-0001)\n• تاريخ الفاتورة وتاريخ الاستحقاق\n\nتسجيل دفعة:\n1. اضغط "تسجيل دفعة" على الفاتورة\n2. أدخل المبلغ (جزئي أو كامل)\n3. طريقة الدفع: نقدي / تحويل بنكي / InstaPay / شيك\n4. المرجع والتاريخ\n\nحالات الدفع:\n• غير مدفوعة → جزئية (شريط تقدم) → مدفوعة بالكامل\n\nقيود محاسبية تلقائية:\n► فاتورة: مدين: عملاء 131 | دائن: إيراد 411 + VAT 260\n► دفعة: مدين: بنك 162 | دائن: عملاء 131' : 'Sales CRM → Sales Invoices\n\nCreate invoice:\n• Directly "+ New Invoice" or convert from quotation\n• Invoice number auto-generated (INV-2026-0001)\n• Invoice date and due date\n\nRecord payment:\n1. Click "Record Payment" on invoice\n2. Enter amount (partial or full)\n3. Payment method: Cash / Bank Transfer / InstaPay / Check\n4. Reference and date\n\nPayment statuses:\n• Unpaid → Partial (progress bar) → Fully Paid\n\nAutomatic journal entries:\n► Invoice: Dr: Customers 131 | Cr: Revenue 411 + VAT 260\n► Payment: Dr: Bank 162 | Cr: Customers 131' },
        { q: ar ? 'كيف أدير اشتراكات العملاء الدورية؟' : 'How to manage recurring customer subscriptions?',
          a: ar ? 'المبيعات CRM ← الاشتراكات ← "+ اشتراك جديد"\n\n• اسم العميل، اسم الخدمة، الوصف\n• دورة الفوترة: شهري / ربع سنوي / نصف سنوي / سنوي\n• المبلغ والعملة\n• تاريخ البداية\n• تجديد تلقائي (تفعيل/تعطيل)\n\nإدارة الاشتراكات:\n• إيقاف مؤقت / استئناف / إلغاء\n• توليد فاتورة تلقائية من الاشتراك بضغطة واحدة\n• تتبع تاريخ الفوترة القادم' : 'Sales CRM → Subscriptions → "+ New Subscription"\n\n• Customer name, service name, description\n• Billing cycle: Monthly / Quarterly / Semi-annual / Annual\n• Amount and currency\n• Start date\n• Auto-renew (on/off)\n\nManage subscriptions:\n• Pause / Resume / Cancel\n• Generate invoice from subscription in one click\n• Track next billing date' },
        { q: ar ? 'تقارير ومؤشرات المبيعات' : 'Sales reports and KPIs',
          a: ar ? 'المبيعات CRM ← نظرة عامة:\n\n📊 المؤشرات الرئيسية:\n• إجمالي العملاء / الفواتير / عروض الأسعار\n• إيرادات الشهر الحالي\n• الرصيد المستحق (غير مدفوع)\n• نسبة تحويل عروض الأسعار لفواتير\n• الفواتير المتأخرة\n\n⚡ وصول سريع:\n• 4 أزرار للانتقال لكل قسم مباشرة\n• عميل جديد | عرض سعر | فاتورة | اشتراك' : 'Sales CRM → Overview:\n\n📊 Key Metrics:\n• Total customers / invoices / quotations\n• Current month revenue\n• Outstanding balance (unpaid)\n• Quote-to-invoice conversion rate\n• Overdue invoices\n\n⚡ Quick Access:\n• 4 buttons for direct section navigation\n• New Customer | Quote | Invoice | Subscription' },
      ]
    },

    // ─── المخزون ────────────────────────────────
    {
      id: 'inventory', icon: Package, color: 'bg-orange-500',
      badge: null,
      title: ar ? 'المخزون والمنتجات' : 'Inventory & Products',
      items: [
        { q: ar ? 'كيف أضيف منتجاً؟' : 'How to add a product?',
          a: ar ? 'المخزون ← "+ منتج جديد"\n• اسم المنتج، الكود، الوحدة، السعر الافتراضي\n• رمز ضريبي (GS1/EGS) للربط بالفاتورة الإلكترونية\n• حد التنبيه للمخزون' : 'Inventory → "+ New Product"\n• Product name, code, unit, default price\n• Tax code (GS1/EGS) for e-invoice\n• Stock alert threshold' },
        { q: ar ? 'تقارير المخزون' : 'Inventory reports',
          a: ar ? 'المخزون ← التقارير:\n• كشف المخزون الحالي\n• حركة الأصناف (داخل/خارج)\n• الأصناف تحت الحد الأدنى' : 'Inventory → Reports:\n• Current stock report\n• Item movement (in/out)\n• Items below minimum stock' },
      ]
    },

    // ─── التقارير ────────────────────────────────
    {
      id: 'reports', icon: BarChart3, color: 'bg-teal-600',
      badge: ar ? 'PDF + Excel' : 'PDF + Excel',
      title: ar ? 'التقارير والتصدير' : 'Reports & Export',
      items: [
        { q: ar ? 'ما هي التقارير المالية المتاحة؟' : 'What financial reports are available?',
          a: ar ? '📊 تقارير محاسبية:\n• ميزان المراجعة ← تصدير Excel\n• قائمة الدخل ← تصدير Excel\n• الميزانية العمومية ← تصدير Excel\n• دفتر الأستاذ العام ← بالحساب والتاريخ\n• القيود اليومية ← بالفترة والنوع\n\n👥 تقارير HR:\n• كشف مرتبات ← تصدير PDF\n• تقرير الحضور والغياب\n• تقرير الإجازات والرصيد\n• سجل إنهاء الخدمة\n\n📋 تقارير المبيعات:\n• تقرير الفواتير ← بالعميل والفترة\n• تقرير المشتريات\n• تقرير المخزون' : '📊 Accounting Reports:\n• Trial Balance ← Excel export\n• Income Statement ← Excel export\n• Balance Sheet ← Excel export\n• General Ledger ← by account and date\n• Journal Entries ← by period and type\n\n👥 HR Reports:\n• Payroll report ← PDF export\n• Attendance & absence report\n• Leave balance report\n• Termination record\n\n📋 Sales Reports:\n• Invoice report ← by customer & period\n• Purchase report\n• Inventory report' },
        { q: ar ? 'كيف أصدّر تقرير؟' : 'How to export a report?',
          a: ar ? 'في كل صفحة تقارير:\n1. حدد نطاق التاريخ\n2. اختر الفلاتر المطلوبة\n3. اضغط "تصدير Excel" أو "طباعة/PDF"\n\nالملف يُنزَّل مباشرة على جهازك' : 'On any report page:\n1. Set date range\n2. Choose filters\n3. Click "Export Excel" or "Print/PDF"\n\nFile downloads directly to your device' },
      ]
    },

    // ─── الموافقات ────────────────────────────────
    {
      id: 'approvals', icon: ClipboardList, color: 'bg-rose-600',
      badge: ar ? 'Real-time' : 'Real-time',
      title: ar ? 'نظام الموافقات' : 'Approvals System',
      items: [
        { q: ar ? 'كيف يعمل نظام الموافقات؟' : 'How does the approval system work?',
          a: ar ? 'يوجد تدفق موافقات للعمليات المهمة:\n• طلبات الإجازة\n• أوامر الشراء\n• صرف الرواتب\n• القيود اليومية الكبيرة\n\n🔔 عند إنشاء طلب:\n← المسؤول يتلقى إشعاراً فورياً (WebSocket)\n← يوافق أو يرفض من صفحة الموافقات\n← مقدم الطلب يتلقى إشعاراً بالقرار فوراً' : 'Approval flow exists for important operations:\n• Leave requests\n• Purchase orders\n• Payroll processing\n• Large journal entries\n\n🔔 When request created:\n← Manager receives instant notification (WebSocket)\n← Approves or rejects from Approvals page\n← Requester receives instant decision notification' },
      ]
    },

    // ─── الإشعارات والتحديثات ────────────────────────────────
    {
      id: 'notifications', icon: Bell, color: 'bg-red-500',
      badge: ar ? 'تحديث تلقائي' : 'Auto-update',
      title: ar ? 'الإشعارات والتحديثات' : 'Notifications & Updates',
      items: [
        { q: ar ? 'كيف أفعّل إشعارات الـ Push؟' : 'How to enable Push notifications?',
          a: ar ? '1. اضغط أيقونة الجرس في الشريط الجانبي\n2. اضغط "تفعيل" في أسفل القائمة\n3. اسمح للمتصفح بالإشعارات\n4. ستصلك إشعارات حتى عند إغلاق الموقع\n\nأنواع الإشعارات:\n• موافقات وردود\n• تحديثات المشاريع\n• تنبيهات المخزون\n• تواريخ استحقاق الفواتير' : '1. Click bell icon in sidebar\n2. Click "Enable" at bottom\n3. Allow browser notifications\n4. Get notifications even when site is closed\n\nNotification types:\n• Approval responses\n• Project updates\n• Stock alerts\n• Invoice due dates' },
        { q: ar ? 'إشعارات تحديث النظام' : 'System update notifications',
          a: ar ? 'عند صدور تحديث جديد للنظام:\n← تظهر رسالة أنيقة في أسفل الشاشة\n← تعرض: رقم الإصدار، الوصف، قائمة المميزات الجديدة\n← اضغط "تحديث الآن" لتطبيق التحديث (إعادة تحميل الصفحة)\n← أو "لاحقاً" للتأجيل' : 'When a new system update is released:\n← A notification slides up from bottom of screen\n← Shows: version number, description, new features list\n← Click "Update Now" to apply (page reload)\n← Or "Later" to postpone' },
      ]
    },

    // ─── الصلاحيات والأمان ────────────────────────────────
    {
      id: 'security', icon: Shield, color: 'bg-gray-700',
      badge: ar ? 'Enterprise Security' : 'Enterprise Security',
      title: ar ? 'الصلاحيات والأمان' : 'Permissions & Security',
      items: [
        { q: ar ? 'كيف أدير صلاحيات المستخدمين؟' : 'How to manage user permissions?',
          a: ar ? 'الإعدادات ← الصلاحيات ← اختر المستخدم\n\nالصلاحيات تشمل:\n• HR, المالية, الفواتير, المخزون, المشاريع, التقارير...\n\nقوالب جاهزة:\n• مدير النظام (كل الصلاحيات)\n• مدير مالي | محاسب | مدير HR | مشاهد فقط\n\nمالك النظام (Owner) يستطيع:\n• مشاهدة وتعديل صلاحيات كل المستخدمين في كل الشركات\n• إضافة/حذف المستخدمين\n• مشاهدة كل الشركات المشتركة' : 'Settings → Permissions → Select user\n\nPermissions include:\n• HR, Financial, Invoices, Inventory, Projects, Reports...\n\nReady templates:\n• System Admin (all permissions)\n• Financial Manager | Accountant | HR Manager | Viewer only\n\nSystem Owner can:\n• View/edit permissions for all users in all companies\n• Add/remove users\n• See all subscribed companies' },
        { q: ar ? 'الأمان وحماية البيانات' : 'Security and data protection',
          a: ar ? '🔒 حماية متعددة الطبقات:\n\n• HTTPS: كل البيانات مشفرة أثناء النقل (SSL/TLS 1.3)\n• JWT Token: صلاحية 8 ساعات\n• تسجيل خروج تلقائي: بعد 30 دقيقة خمول (مع تحذير قبل دقيقتين)\n• Rate Limiting: 120 طلب/دقيقة / 20 طلب/دقيقة لتسجيل الدخول\n• سجل المراجعة: كل عملية مالية مسجّلة بالتوقيت والمستخدم\n• الثبات المحاسبي: القيود المرحّلة لا تُحذف نهائياً\n• MongoDB معزول مع كلمة مرور قوية' : '🔒 Multi-layer protection:\n\n• HTTPS: all data encrypted in transit (SSL/TLS 1.3)\n• JWT Token: 8-hour validity\n• Auto logout: after 30 min idle (2-min warning before)\n• Rate Limiting: 120 req/min / 20 req/min for login\n• Audit Log: every financial operation logged with time and user\n• Accounting immutability: posted entries cannot be deleted\n• MongoDB isolated with strong password' },
      ]
    },

    // ─── الدفع والاشتراك ────────────────────────────────
    {
      id: 'payment', icon: CreditCard, color: 'bg-purple-600',
      badge: null,
      title: ar ? 'الدفع والاشتراك' : 'Payment & Subscription',
      items: [
        { q: ar ? 'الخطط والأسعار' : 'Plans and pricing',
          a: ar ? '📦 المبتدئ — 299 ج.م / شهر\n• 1-10 موظفين | HR أساسي | محاسبة أساسية | فواتير\n\n📦 المحترف — 799 ج.م / شهر (الأكثر شيوعاً)\n• 11-100 موظف | كل مميزات المبتدئ +\n• مسير رواتب كامل | ضرائب مصرية | ETA | مخزون | بنوك | موافقات\n\n📦 المؤسسي — 1499 ج.م / شهر\n• غير محدود | كل المميزات + مشاريع وفروع ومدير حساب\n\n💡 خصم 20% عند الدفع السنوي' : '📦 Starter — 299 EGP / month\n• 1-10 employees | Basic HR | Basic accounting | Invoices\n\n📦 Professional — 799 EGP / month (Most popular)\n• 11-100 employees | All Starter features +\n• Full payroll | Egyptian taxes | ETA | Inventory | Banks | Approvals\n\n📦 Enterprise — 1,499 EGP / month\n• Unlimited | All features + projects, branches, account manager\n\n💡 20% discount on annual payment' },
        { q: ar ? 'طرق الدفع المتاحة' : 'Available payment methods',
          a: ar ? '• بطاقة ائتمان (Visa/Mastercard)\n• PayPal\n• تحويل بنكي\n• InstaPay: 00201006008552\n• فودافون كاش: 00201012625529\n• كود تفعيل مجاني' : '• Credit/Debit Card (Visa/Mastercard)\n• PayPal\n• Bank Transfer\n• InstaPay: 00201006008552\n• Vodafone Cash: 00201012625529\n• Free activation code' },
        { q: ar ? 'كيف أستخدم كود التفعيل؟' : 'How to use activation code?',
          a: ar ? '1. افتح صفحة الدفع (الإعدادات ← الاشتراك)\n2. اختر "كود تفعيل"\n3. أدخل الكود ← "تفعيل"\n4. اشتراكك يتفعّل فوراً بمبلغ = 0' : '1. Go to payment page (Settings → Subscription)\n2. Select "Activation Code"\n3. Enter code ← "Activate"\n4. Subscription activates instantly for free' },
      ]
    },
  ];

  const filtered = searchQuery
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(i =>
          i.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(s => s.items.length > 0)
    : sections;

  return (
    <div className="space-y-5 p-2" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F1729] to-[#28376B] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{ar ? 'دليل المستخدم الشامل' : 'Complete User Guide'}</h1>
            <p className="text-white/60 text-xs mt-0.5">
              {ar ? 'DataLife Account — v3.0 | 108 حساب | 14 وحدة | قانون 148/2019 و91/2005' : 'DataLife Account — v3.0 | 108 Accounts | 14 Modules | Law 148/2019 & 91/2005'}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute top-3 right-3 w-4 h-4 text-white/50" />
          <input
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pr-9 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder={ar ? 'ابحث في الدليل...' : 'Search the guide...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: '108', l: ar ? 'حساب محاسبي' : 'Accounts' },
          { n: '14', l: ar ? 'وحدة رئيسية' : 'Modules' },
          { n: '24/7', l: ar ? 'متاح دائماً' : 'Available' },
          { n: '🔒', l: ar ? 'بيانات آمنة' : 'Secure Data' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-[#1e3a8a]">{s.n}</p>
            <p className="text-xs text-gray-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {filtered.map(section => {
        const Icon = section.icon;
        const isOpen = expandedSections[section.id] || !!searchQuery;
        return (
          <Card key={section.id} className="border overflow-hidden shadow-sm">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-start"
            >
              <div className={`w-10 h-10 ${section.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{section.title}</span>
                  {section.badge && (
                    <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-medium">
                      {section.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-gray-400">{section.items.length} {ar ? 'سؤال' : 'topics'}</span>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {isOpen && (
              <CardContent className="p-0 border-t border-gray-100">
                {section.items.map((item, idx) => (
                  <div key={idx} className={`p-4 ${idx < section.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <p className="font-medium text-gray-800 text-sm mb-2 flex items-start gap-2">
                      <span className="text-[#1e3a8a] mt-0.5 flex-shrink-0">▸</span>
                      {item.q}
                    </p>
                    <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3">
                      {item.a}
                    </pre>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Footer */}
      <div className="text-center py-4 text-xs text-gray-400 space-y-1">
        <p>{ar ? 'DataLife Account — دليل المستخدم v2.1' : 'DataLife Account — User Guide v2.1'}</p>
        <p>{ar ? 'للدعم: info@datalifeai.com | datalifeaccount.com' : 'Support: info@datalifeai.com | datalifeaccount.com'}</p>
      </div>
    </div>
  );
}
