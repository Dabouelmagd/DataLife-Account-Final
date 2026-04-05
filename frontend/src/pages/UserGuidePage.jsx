import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Book, ChevronDown, ChevronRight, Search, Users, DollarSign, 
  FileText, Package, Building2, CreditCard, Bell, BarChart3,
  Settings, CheckCircle, ArrowRight, Wallet, Calculator, Receipt,
  Calendar, Clock, Briefcase, Shield, Database, Globe, Moon,
  Mail, TrendingUp, PieChart, Layers, HelpCircle
} from 'lucide-react';

const UserGuidePage = ({ language }) => {
  const isRTL = language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState(['getting-started']);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const sections = [
    {
      id: 'getting-started',
      icon: Book,
      title: language === 'ar' ? 'البدء السريع' : 'Getting Started',
      color: 'from-blue-500 to-indigo-600',
      items: [
        {
          title: language === 'ar' ? 'تسجيل الدخول' : 'Login',
          content: language === 'ar' 
            ? 'أدخل البريد الإلكتروني وكلمة المرور، ثم اضغط "تسجيل الدخول". بعد النجاح، أدخل كود الشركة للوصول للنظام.'
            : 'Enter your email and password, then click "Sign In". After success, enter the company code to access the system.'
        },
        {
          title: language === 'ar' ? 'لوحة التحكم الرئيسية' : 'Main Dashboard',
          content: language === 'ar'
            ? 'بعد تسجيل الدخول، ستظهر لوحة التحكم مع القائمة الجانبية. اختر الوحدة المطلوبة من القائمة.'
            : 'After login, the dashboard appears with a sidebar menu. Select the desired module from the menu.'
        },
        {
          title: language === 'ar' ? 'تغيير اللغة' : 'Change Language',
          content: language === 'ar'
            ? 'اضغط على أيقونة اللغة في أعلى الصفحة للتبديل بين العربية والإنجليزية.'
            : 'Click on the language icon at the top to switch between Arabic and English.'
        },
        {
          title: language === 'ar' ? 'الوضع الداكن' : 'Dark Mode',
          content: language === 'ar'
            ? 'اضغط على أيقونة القمر/الشمس في القائمة الجانبية للتبديل بين الوضع الفاتح والداكن.'
            : 'Click on the moon/sun icon in the sidebar to toggle between light and dark mode.'
        }
      ]
    },
    {
      id: 'accounting',
      icon: Calculator,
      title: language === 'ar' ? 'النظام المحاسبي' : 'Accounting System',
      color: 'from-emerald-500 to-teal-600',
      items: [
        {
          title: language === 'ar' ? 'دليل الحسابات' : 'Chart of Accounts',
          content: language === 'ar'
            ? 'يحتوي على 71 حساب وفق المعايير المصرية. الحسابات الرئيسية (Headers) لا تقبل قيود مباشرة. استخدم الحسابات الفرعية لإنشاء القيود.'
            : 'Contains 71 accounts according to Egyptian standards. Header accounts don\'t accept direct entries. Use sub-accounts for journal entries.'
        },
        {
          title: language === 'ar' ? 'القيود اليومية' : 'Journal Entries',
          content: language === 'ar'
            ? 'لإنشاء قيد: اضغط "قيد جديد" ← اختر الحسابات ← أدخل المبالغ (مدين/دائن) ← احفظ. القيد يُنشأ كمسودة ويحتاج ترحيل.'
            : 'To create an entry: Click "New Entry" → Select accounts → Enter amounts (debit/credit) → Save. Entry is created as draft and needs posting.'
        },
        {
          title: language === 'ar' ? 'ترحيل القيود' : 'Post Entries',
          content: language === 'ar'
            ? 'بعد مراجعة القيد، اضغط زر "ترحيل" ليؤثر على أرصدة الحسابات. القيود المرحّلة لا يمكن تعديلها (يمكن عكسها فقط).'
            : 'After reviewing, click "Post" for the entry to affect account balances. Posted entries can\'t be edited (only reversed).'
        },
        {
          title: language === 'ar' ? 'التقارير المالية' : 'Financial Reports',
          content: language === 'ar'
            ? 'ميزان المراجعة: يعرض أرصدة جميع الحسابات. قائمة الدخل: الإيرادات والمصروفات. الميزانية: الأصول والخصوم وحقوق الملكية.'
            : 'Trial Balance: Shows all account balances. Income Statement: Revenue and expenses. Balance Sheet: Assets, liabilities, and equity.'
        }
      ]
    },
    {
      id: 'bank',
      icon: Building2,
      title: language === 'ar' ? 'إدارة البنوك' : 'Bank Management',
      color: 'from-violet-500 to-purple-600',
      items: [
        {
          title: language === 'ar' ? 'إضافة حساب بنكي' : 'Add Bank Account',
          content: language === 'ar'
            ? 'من صفحة البنك ← "حساب جديد" ← أدخل اسم البنك ورقم الحساب وIBAN والرصيد الافتتاحي.'
            : 'From Bank page → "New Account" → Enter bank name, account number, IBAN, and opening balance.'
        },
        {
          title: language === 'ar' ? 'تسجيل حركة بنكية' : 'Record Transaction',
          content: language === 'ar'
            ? 'اختر نوع الحركة (إيداع/سحب/شيك) ← أدخل المبلغ والوصف ← اختر الحساب المقابل (اختياري) ← احفظ. سيُنشأ قيد محاسبي تلقائياً.'
            : 'Select transaction type (deposit/withdrawal/check) → Enter amount and description → Select counter account (optional) → Save. A journal entry is created automatically.'
        },
        {
          title: language === 'ar' ? 'القيد المحاسبي التلقائي' : 'Auto Journal Entry',
          content: language === 'ar'
            ? 'كل حركة بنكية تُنشئ قيد محاسبي تلقائياً. اضغط على رقم القيد في جدول الحركات لعرض التفاصيل.'
            : 'Every bank transaction creates an automatic journal entry. Click on the entry number in the transactions table to view details.'
        },
        {
          title: language === 'ar' ? 'إعدادات البنك' : 'Bank Settings',
          content: language === 'ar'
            ? 'من "إعدادات البنك": فعّل الترحيل التلقائي ليُرحّل القيد فوراً. حدد الحسابات الافتراضية لكل نوع عملية.'
            : 'From "Bank Settings": Enable auto-post for immediate posting. Set default accounts for each transaction type.'
        }
      ]
    },
    {
      id: 'invoicing',
      icon: Receipt,
      title: language === 'ar' ? 'الفواتير' : 'Invoicing',
      color: 'from-amber-500 to-orange-600',
      items: [
        {
          title: language === 'ar' ? 'إنشاء فاتورة مبيعات' : 'Create Sales Invoice',
          content: language === 'ar'
            ? 'المبيعات ← "فاتورة جديدة" ← اختر العميل ← أضف المنتجات/الخدمات ← راجع الضريبة والخصومات ← احفظ.'
            : 'Sales → "New Invoice" → Select customer → Add products/services → Review tax and discounts → Save.'
        },
        {
          title: language === 'ar' ? 'الخصومات والإضافات' : 'Discounts & Additions',
          content: language === 'ar'
            ? 'أثناء إنشاء الفاتورة، اضغط "إضافة خصم" أو "إضافة رسوم". اختر النوع (نسبة أو مبلغ ثابت) وأدخل القيمة.'
            : 'While creating invoice, click "Add Discount" or "Add Fee". Select type (percentage or fixed) and enter value.'
        },
        {
          title: language === 'ar' ? 'العملات المتعددة' : 'Multiple Currencies',
          content: language === 'ar'
            ? 'من إعدادات العملات، فعّل العملات المطلوبة. عند إنشاء فاتورة، اختر العملة من القائمة المنسدلة.'
            : 'From currency settings, enable required currencies. When creating invoice, select currency from dropdown.'
        },
        {
          title: language === 'ar' ? 'طباعة PDF' : 'Print PDF',
          content: language === 'ar'
            ? 'افتح الفاتورة ← اضغط "طباعة PDF". ستُنشأ نسخة PDF مع QR Code للتحقق.'
            : 'Open invoice → Click "Print PDF". A PDF copy with QR Code for verification will be generated.'
        }
      ]
    },
    {
      id: 'hr',
      icon: Users,
      title: language === 'ar' ? 'الموارد البشرية' : 'Human Resources',
      color: 'from-pink-500 to-rose-600',
      items: [
        {
          title: language === 'ar' ? 'إضافة موظف' : 'Add Employee',
          content: language === 'ar'
            ? 'الموظفون ← "موظف جديد" ← أدخل البيانات الأساسية (الاسم، البريد، الوظيفة، القسم، الراتب) ← احفظ.'
            : 'Employees → "New Employee" → Enter basic data (name, email, position, department, salary) → Save.'
        },
        {
          title: language === 'ar' ? 'الحضور والانصراف' : 'Attendance',
          content: language === 'ar'
            ? 'يمكن تسجيل الحضور يدوياً أو عبر جهاز البصمة. النظام يحسب ساعات العمل والتأخير والأوفرتايم تلقائياً.'
            : 'Attendance can be recorded manually or via fingerprint device. System calculates work hours, late time, and overtime automatically.'
        },
        {
          title: language === 'ar' ? 'طلبات الإجازات' : 'Leave Requests',
          content: language === 'ar'
            ? 'الموظف يقدم طلب إجازة ← المدير يراجع ويوافق/يرفض ← يُخصم من رصيد الإجازات تلقائياً.'
            : 'Employee submits leave request → Manager reviews and approves/rejects → Deducted from leave balance automatically.'
        },
        {
          title: language === 'ar' ? 'الرواتب' : 'Payroll',
          content: language === 'ar'
            ? 'في نهاية الشهر: الرواتب ← "حساب الرواتب" ← راجع البدلات والاستقطاعات ← اعتمد ← أرسل كشوف الرواتب بالبريد.'
            : 'At month end: Payroll → "Calculate Salaries" → Review allowances and deductions → Approve → Send payslips by email.'
        }
      ]
    },
    {
      id: 'notifications',
      icon: Bell,
      title: language === 'ar' ? 'الإشعارات' : 'Notifications',
      color: 'from-cyan-500 to-blue-600',
      items: [
        {
          title: language === 'ar' ? 'إعداد الإشعارات' : 'Setup Notifications',
          content: language === 'ar'
            ? 'إعدادات الإشعارات ← أضف عناوين البريد الإلكتروني للإدارة ← فعّل أنواع الإشعارات المطلوبة ← احفظ.'
            : 'Notification Settings → Add admin email addresses → Enable required notification types → Save.'
        },
        {
          title: language === 'ar' ? 'أنواع الإشعارات' : 'Notification Types',
          content: language === 'ar'
            ? 'معاملات بنكية كبيرة (> 100,000) • كشوف الرواتب • انتهاء العقود (قبل 30 يوم) • الفواتير المستحقة (قبل 7 أيام) • طلبات الموافقة'
            : 'Large bank transactions (> 100,000) • Payslips • Contract expiry (30 days before) • Due invoices (7 days before) • Approval requests'
        },
        {
          title: language === 'ar' ? 'اختبار الإشعارات' : 'Test Notifications',
          content: language === 'ar'
            ? 'بعد إضافة البريد الإلكتروني، اضغط "إرسال رسالة تجريبية" للتأكد من عمل الإشعارات.'
            : 'After adding email, click "Send Test Email" to verify notifications are working.'
        }
      ]
    },
    {
      id: 'dashboard',
      icon: BarChart3,
      title: language === 'ar' ? 'لوحة التحكم الإدارية' : 'Admin Dashboard',
      color: 'from-indigo-500 to-purple-600',
      items: [
        {
          title: language === 'ar' ? 'الإحصائيات' : 'Statistics',
          content: language === 'ar'
            ? 'تعرض 8 بطاقات: إجمالي الإيرادات، رصيد البنوك، الفواتير المعلقة، صافي الربح، الموظفين، العملاء، المنتجات، المشاريع.'
            : 'Displays 8 cards: Total Revenue, Bank Balance, Pending Invoices, Net Profit, Employees, Customers, Products, Projects.'
        },
        {
          title: language === 'ar' ? 'الرسوم البيانية' : 'Charts',
          content: language === 'ar'
            ? 'رسم بياني للإيرادات والمصروفات (6 أشهر) مع خط الربح. مخطط دائري لتوزيع المصروفات حسب الفئة.'
            : 'Revenue & Expenses chart (6 months) with profit line. Pie chart for expenses breakdown by category.'
        },
        {
          title: language === 'ar' ? 'التنبيهات' : 'Alerts',
          content: language === 'ar'
            ? 'تعرض التنبيهات المهمة: مخزون منخفض، فواتير متأخرة، عقود منتهية. انقر للتفاصيل.'
            : 'Shows important alerts: Low stock, overdue invoices, expiring contracts. Click for details.'
        }
      ]
    },
    {
      id: 'import',
      icon: Database,
      title: language === 'ar' ? 'استيراد البيانات' : 'Data Import',
      color: 'from-slate-500 to-gray-600',
      items: [
        {
          title: language === 'ar' ? 'تنسيق الملفات' : 'File Format',
          content: language === 'ar'
            ? 'يدعم ملفات Excel (.xlsx) و CSV. الصف الأول يجب أن يحتوي على أسماء الأعمدة المطابقة للنظام.'
            : 'Supports Excel (.xlsx) and CSV files. First row must contain column names matching the system.'
        },
        {
          title: language === 'ar' ? 'خطوات الاستيراد' : 'Import Steps',
          content: language === 'ar'
            ? 'استيراد البيانات ← اختر نوع البيانات (موظفين/عملاء/منتجات) ← ارفع الملف ← راجع الأخطاء ← أكد الاستيراد.'
            : 'Data Import → Select data type (employees/customers/products) → Upload file → Review errors → Confirm import.'
        },
        {
          title: language === 'ar' ? 'تصدير الأخطاء' : 'Export Errors',
          content: language === 'ar'
            ? 'إذا فشلت بعض الصفوف، يمكنك تحميل ملف بالصفوف الفاشلة مع سبب الفشل لتصحيحها وإعادة الاستيراد.'
            : 'If some rows fail, you can download a file with failed rows and error reasons to correct and re-import.'
        }
      ]
    }
  ];

  const filteredSections = sections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return section.title.toLowerCase().includes(query) ||
           section.items.some(item => 
             item.title.toLowerCase().includes(query) ||
             item.content.toLowerCase().includes(query)
           );
  });

  return (
    <div className={`p-6 space-y-6 bg-gray-50 dark:bg-slate-900 min-h-screen ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <Book className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ar' ? 'الدليل الشامل' : 'User Guide'}
            </h1>
            <p className="text-white/70 mt-1">
              {language === 'ar' 
                ? 'دليل استخدام نظام DataLife Account' 
                : 'DataLife Account System User Guide'}
            </p>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative max-w-xl">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 ${isRTL ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث في الدليل...' : 'Search in guide...'}
            className={`w-full py-3 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30`}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold dark:text-white">{sections.length}</p>
              <p className="text-xs text-gray-500">{language === 'ar' ? 'أقسام' : 'Sections'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold dark:text-white">{sections.reduce((acc, s) => acc + s.items.length, 0)}</p>
              <p className="text-xs text-gray-500">{language === 'ar' ? 'موضوع' : 'Topics'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold dark:text-white">2</p>
              <p className="text-xs text-gray-500">{language === 'ar' ? 'لغات' : 'Languages'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold dark:text-white">24/7</p>
              <p className="text-xs text-gray-500">{language === 'ar' ? 'دعم' : 'Support'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => (
          <Card key={section.id} className="border-0 shadow-lg dark:bg-slate-800 overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full p-5 flex items-center justify-between bg-gradient-to-r ${section.color} text-white hover:opacity-95 transition-opacity`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <section.icon className="w-6 h-6" />
                </div>
                <div className={`text-${isRTL ? 'right' : 'left'}`}>
                  <h2 className="text-xl font-bold">{section.title}</h2>
                  <p className="text-white/70 text-sm">{section.items.length} {language === 'ar' ? 'مواضيع' : 'topics'}</p>
                </div>
              </div>
              {expandedSections.includes(section.id) 
                ? <ChevronDown className="w-6 h-6" />
                : <ChevronRight className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
              }
            </button>
            
            {expandedSections.includes(section.id) && (
              <CardContent className="p-0">
                <div className="divide-y dark:divide-slate-700">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ArrowRight className={`w-4 h-4 text-slate-500 ${isRTL ? 'rotate-180' : ''}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Footer */}
      <Card className="border-0 shadow-lg dark:bg-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium dark:text-white">{language === 'ar' ? 'تحتاج مساعدة؟' : 'Need Help?'}</p>
                <p className="text-sm text-gray-500">support@datalifeai.com</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'ar' ? 'آخر تحديث: أبريل 2026' : 'Last updated: April 2026'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserGuidePage;
