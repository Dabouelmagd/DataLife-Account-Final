/**
 * GuideWebPage — صفحة دليل الاستخدام العامة على الموقع
 * Public page at /guide — no login required
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronDown, ChevronUp, ArrowRight, Home,
  Users, Calculator, FileText, Folder, TrendingUp,
  Package, BarChart, Shield, CreditCard, Bell, Book,
  CheckCircle, AlertTriangle, Clock, Mail,
  Phone, Star
} from 'lucide-react';

const SECTIONS = (ar) => [
  {
    id: 'getting-started', icon: '🚀', color: 'from-blue-600 to-indigo-700',
    title: ar ? 'البداية السريعة' : 'Quick Start',
    desc: ar ? 'كيف تبدأ باستخدام النظام' : 'Get up and running fast',
    items: [
      {
        q: ar ? 'كيف أسجل شركتي؟' : 'How to register my company?',
        a: ar ? `1. افتح datalifeaccount.com
2. اضغط "تجربة مجانية 14 يوم"
3. أدخل: اسم الشركة | البريد الإلكتروني | كلمة المرور | الهاتف
4. اضغط "إنشاء حساب"
5. ستصلك رسالة ترحيب على بريدك

✅ التجربة المجانية: 14 يوم كاملة بدون بطاقة ائتمان
✅ تفعيل فوري — تبدأ العمل خلال دقيقتين` : `1. Open datalifeaccount.com
2. Click "Start 14-Day Free Trial"
3. Enter: company name | email | password | phone
4. Click "Create Account"
5. Welcome email sent to your inbox

✅ Free Trial: 14 full days, no credit card needed
✅ Instant activation — start working in 2 minutes`
      },
      {
        q: ar ? 'كيف أسجل الدخول؟' : 'How to login?',
        a: ar ? `datalifeaccount.com/login ← أدخل البريد وكلمة المرور

نسيت كلمة المرور؟
← اضغط "نسيت كلمة المرور؟"
← أدخل بريدك
← ستصلك رسالة لإعادة التعيين

🔒 أمان: تسجيل خروج تلقائي بعد 30 دقيقة خمول` : `datalifeaccount.com/login ← Enter email and password

Forgot password?
← Click "Forgot Password?"
← Enter your email
← Reset link sent to your inbox

🔒 Security: Auto-logout after 30 min idle`
      },
      {
        q: ar ? 'كيف أضيف موظفين للنظام؟' : 'How to add team members?',
        a: ar ? `الإعدادات ← إدارة المستخدمين ← "دعوة موظف"

← يصله بريد بكلمة مرور مؤقتة
← تحدد صلاحياته: HR / مالية / فواتير / مشاريع / ...
← يدخل ويغير كلمة المرور من أول تسجيل دخول

💡 يمكنك دعوة عدد غير محدود من المستخدمين` : `Settings ← User Management ← "Invite Employee"

← They receive email with temporary password
← You set permissions: HR / Finance / Invoices / Projects / ...
← They login and change password on first login

💡 You can invite unlimited users`
      },
      {
        q: ar ? 'ما هي الوحدات المتاحة في النظام؟' : 'What modules are available?',
        a: ar ? `النظام يحتوي على 14 وحدة متكاملة:

👥 الموارد البشرية — رواتب | حضور | إجازات | ورديات | إنهاء خدمة
💰 الإدارة المالية — قيود | أستاذ عام | ميزان مراجعة | ميزانية | دخل
📈 المبيعات CRM — عملاء | عروض أسعار | فواتير | اشتراكات
🧾 الفواتير الإلكترونية — ETA | فواتير مبيعات وشراء
🛒 المشتريات — موردون | أوامر شراء | استلام
📁 المشاريع — مهام | مصروفات | إيرادات | مستخلصات
🏦 الأصول والضرائب — أصول ثابتة | إهلاك
📊 التقارير والتحليلات — كل التقارير المالية وHR
✅ الموافقات — workflow مدمج
⬆️ استيراد البيانات — Excel → النظام
⚙️ الإعدادات — شركتك | مستخدمين | صلاحيات` : `System has 14 integrated modules:

👥 Human Resources — Payroll | Attendance | Leaves | Shifts | Termination
💰 Financial — Journal Entries | Ledger | Trial Balance | Income | Balance Sheet
📈 Sales CRM — Customers | Quotations | Invoices | Subscriptions
🧾 E-Invoicing — ETA | Sales & Purchase Invoices
🛒 Purchases — Suppliers | POs | Receiving
📁 Projects — Tasks | Expenses | Revenue | Progress Claims
🏦 Assets & Taxes — Fixed Assets | Depreciation
📊 Reports & Analytics — Full financial & HR reports
✅ Approvals — Built-in workflow
⬆️ Data Import — Excel → System
⚙️ Settings — Company | Users | Permissions`
      },
    ]
  },
  {
    id: 'hr', icon: '👥', color: 'from-cyan-600 to-blue-600',
    title: ar ? 'الموارد البشرية والمرتبات' : 'HR & Payroll',
    desc: ar ? 'إدارة الموظفين وفق القانون المصري' : 'Egyptian law compliant HR',
    items: [
      {
        q: ar ? 'كيف أضيف موظف جديد؟' : 'How to add an employee?',
        a: ar ? `الموارد البشرية ← نظرة عامة ← "إضافة موظف"

البيانات الأساسية:
• الاسم | القسم | الوظيفة | تاريخ التعيين
• الراتب الأساسي | البدلات

صورة شخصية: اسحب أي صورة JPG/PNG

المستندات (اختياري عند الإضافة):
• خطاب التعيين | البطاقة الشخصية | عقد العمل
• شهادات علمية | تقرير طبي | بيانات بنكية

💡 كل المستندات محفوظة بأمان مشفرة على السيرفر` : `HR → Overview → "Add Employee"

Basic data:
• Name | Department | Position | Hire date
• Basic salary | Allowances

Profile photo: drag any JPG/PNG

Documents (optional at add):
• Appointment letter | National ID | Contract
• Certificates | Medical report | Bank details

💡 All documents stored securely encrypted on server`
      },
      {
        q: ar ? 'كيف يعمل كشف المرتبات؟' : 'How does payroll work?',
        a: ar ? `الموارد البشرية ← كشف المرتبات ← اختر الشهر

النظام يطبق قانون 148/2019 و91/2005 تلقائياً:

📉 الاستقطاعات:
• ضريبة كسب العمل (7 شرائح تصاعدية)
• تأمينات اجتماعية - حصة الموظف: 11%
• صندوق إعانة الطوارئ: 1%
• صندوق تكريم الشهداء: 0.05%
• السلف والجزاءات

📈 التزامات الشركة:
• تأمينات حصة الشركة: 18.75%
• التأمين الصحي الشامل: 0.25%

📧 بعد المراجعة:
← "إرسال القسائم" → يصل كل موظف قسيمة راتب PDF` : `HR → Payroll → Select month

System auto-applies Law 148/2019 & 91/2005:

📉 Deductions:
• Income Tax (7 progressive brackets)
• Social Insurance employee: 11%
• Emergency Fund: 1%
• Martyrs Fund: 0.05%
• Loans & penalties

📈 Company obligations:
• Social Insurance company: 18.75%
• Universal Health Insurance: 0.25%

📧 After review:
← "Send Payslips" → each employee gets PDF payslip by email`
      },
      {
        q: ar ? 'إدارة الحضور والإجازات' : 'Attendance & Leave management',
        a: ar ? `الحضور:
HR ← الحضور ← اختر التاريخ ← سجل لكل موظف
حالات: حاضر | غائب | إجازة | مأمورية | تأخير

الإجازات:
HR ← الإجازات العارضة/السنوية ← "+ طلب إجازة"
← المدير يوافق من صفحة الموافقات
← الموظف يتلقى إشعاراً بالقرار فوراً

الورديات:
HR ← الورديات ← "+ إضافة وردية"
← تأثير تلقائي على التأخير والأوفر تايم` : `Attendance:
HR ← Attendance ← Select date ← Record for each employee
Statuses: Present | Absent | Leave | Mission | Late

Leaves:
HR ← Casual/Annual Leave ← "+ Request Leave"
← Manager approves from Approvals page
← Employee gets instant notification

Shifts:
HR ← Shifts ← "+ Add Shift"
← Auto affects late arrivals and overtime`
      },
      {
        q: ar ? 'حساب مكافأة نهاية الخدمة' : 'End of service calculation',
        a: ar ? `HR ← إنهاء الخدمة ← "+ إنهاء خدمة"

اختر الموظف والتاريخ والسبب:
• استقالة | فصل | تقاعد | وفاة

النظام يحسب تلقائياً:
✓ مكافأة نهاية الخدمة (وفق سنوات الخدمة)
✓ الإجازات السنوية غير المستهلكة
✓ الراتب المتبقي حتى تاريخ الإنهاء
✓ أي مبالغ مستحقة أخرى

القيد المحاسبي يُنشأ تلقائياً` : `HR ← Termination ← "+ Terminate"

Select employee, date, and reason:
• Resignation | Dismissal | Retirement | Death

System auto-calculates:
✓ End-of-service gratuity (based on years of service)
✓ Unused annual leave balance
✓ Remaining salary to termination date
✓ Any other outstanding amounts

Journal entry created automatically`
      },
    ]
  },
  {
    id: 'financial', icon: '💰', color: 'from-emerald-600 to-green-700',
    title: ar ? 'المحاسبة المالية' : 'Financial Accounting',
    desc: ar ? '108 حساب وفق الدليل المصري' : '108 accounts — Egyptian standard',
    items: [
      {
        q: ar ? 'دليل الحسابات المصري (108 حساب)' : 'Egyptian Chart of Accounts (108 accounts)',
        a: ar ? `الأصول (1xx): أصول ثابتة 111-116 | عملاء 131 | VAT مدخلات 137
                  خصم وتحصيل 138 | ضمانات 141 | خزينة 161 | بنك 162

الالتزامات (2xx): موردون 251 | رواتب مستحقة 253 | ضرائب 254
                   تأمينات 255 | طوارئ 258 | شهداء 259 | VAT مخرجات 260
                   خصم وتحصيل 261 | تأمين صحي 262

المصروفات (3xx): مواد 311 | مقاولو باطن 315 | رواتب إدارة 331
                  مصروفات خدمية 332 | إهلاك 333 | إيجار 335

الإيرادات (4xx): مبيعات 411 | خدمات 412 | مقاولات 414
                  طبي 415 | استشارات 416` : `Assets (1xx): Fixed assets 111-116 | Customers 131 | VAT input 137
               WHT retained 138 | Retention 141 | Cash 161 | Bank 162

Liabilities (2xx): Suppliers 251 | Accrued salaries 253 | Taxes 254
                   Insurance 255 | Emergency 258 | Martyrs 259 | VAT out 260
                   WHT payable 261 | Health ins 262

Expenses (3xx): Materials 311 | Subcontractors 315 | Admin salaries 331
                Utilities 332 | Depreciation 333 | Rent 335

Revenue (4xx): Sales 411 | Services 412 | Contracting 414
               Medical 415 | Consulting 416`
      },
      {
        q: ar ? 'كيف أنشئ قيد يومي؟' : 'How to create a journal entry?',
        a: ar ? `الإدارة المالية ← القيود اليومية ← "+ قيد جديد"

1. التاريخ والوصف ونوع المستند
2. أضف سطور:
   • ابحث بكود أو اسم الحساب
   • أدخل مدين أو دائن
   • أضف مركز التكلفة/المشروع (اختياري)
3. تأكد: ∑مدين = ∑دائن
4. "حفظ" ← يُرحَّل فوراً للأستاذ العام

⚠️ مبدأ الثبات: القيود المرحلة لا تُحذف
للتصحيح: استخدم "قيد عكسي"` : `Financial → Journal Entries → "+ New Entry"

1. Date, description, document type
2. Add lines:
   • Search by account code or name
   • Enter debit or credit amount
   • Add cost center/project (optional)
3. Verify: ∑debit = ∑credit
4. "Save" → instantly posted to General Ledger

⚠️ Immutability: Posted entries cannot be deleted
To correct: use "Reverse Entry"`
      },
      {
        q: ar ? 'القيود المحاسبية التلقائية' : 'Automatic journal entries',
        a: ar ? `النظام ينشئ قيوداً تلقائياً عند:

💼 الفواتير:
فاتورة بيع → مدين: عملاء 131 | دائن: إيراد 411 + VAT 260
فاتورة شراء → مدين: تكلفة + VAT 137 | دائن: موردون 251

👥 الرواتب:
مدين: رواتب 331 + تأمينات شركة | دائن: تأمينات + ضريبة + رواتب 253

🏗️ المشاريع:
إيراد → مدين: بنك 162 | دائن: إيرادات 412
مصروف → مدين: المصروف | دائن: بنك 162

📈 المبيعات CRM:
فاتورة → مدين: عملاء 131 | دائن: إيراد 411 + VAT 260
دفعة → مدين: بنك 162 | دائن: عملاء 131` : `System creates entries automatically when:

💼 Invoices:
Sales → Dr: Customers 131 | Cr: Revenue 411 + VAT 260
Purchase → Dr: Cost + VAT 137 | Cr: Suppliers 251

👥 Payroll:
Dr: Salaries 331 + company insurance | Cr: Insurance + tax + salaries 253

🏗️ Projects:
Revenue → Dr: Bank 162 | Cr: Revenue 412
Expense → Dr: Expense | Cr: Bank 162

📈 Sales CRM:
Invoice → Dr: Customers 131 | Cr: Revenue 411 + VAT 260
Payment → Dr: Bank 162 | Cr: Customers 131`
      },
      {
        q: ar ? 'كيف أقرأ التقارير المالية؟' : 'How to read financial reports?',
        a: ar ? `ميزان المراجعة: ∑مدين = ∑دائن ← يؤكد صحة القيود

قائمة الدخل:
الإيرادات - التكاليف = مجمل الربح
مجمل الربح - المصروفات = صافي الربح/(خسارة)

الميزانية العمومية:
الأصول = الالتزامات + حقوق الملكية

دفتر الأستاذ العام:
حركات كل حساب مع الرصيد التراكمي

💡 استخدم فلتر التاريخ لمقارنة الأشهر والسنوات` : `Trial Balance: ∑debit = ∑credit ← confirms entries accuracy

Income Statement:
Revenue - Costs = Gross Profit
Gross Profit - Expenses = Net Profit/(Loss)

Balance Sheet:
Assets = Liabilities + Equity

General Ledger:
All movements per account with running balance

💡 Use date filter to compare months and years`
      },
    ]
  },
  {
    id: 'sales', icon: '📈', color: 'from-orange-500 to-amber-600',
    title: ar ? 'المبيعات وإدارة العملاء CRM' : 'Sales & CRM',
    desc: ar ? 'عملاء | عروض | فواتير | اشتراكات' : 'Customers | Quotes | Invoices | Subscriptions',
    items: [
      {
        q: ar ? 'إدارة العملاء CRM' : 'Customer CRM management',
        a: ar ? `المبيعات CRM ← العملاء

مراحل العميل:
🔍 عميل محتمل (Lead) ← تواصل أولي
👀 مرتقب (Prospect) ← في مرحلة التفاوض
✅ عميل (Customer) ← مشتري فعلي
⭐ VIP ← عميل مميز بمعاملة خاصة

بيانات كل عميل:
• كود تلقائي (CUS-0001)
• نوع: فرد / شركة / حكومي
• حد ائتمان | شروط دفع | خصم خاص
• الرقم الضريبي والسجل التجاري
• تاريخ آخر شراء والرصيد المستحق` : `Sales CRM ← Customers

Customer stages:
🔍 Lead ← Initial contact
👀 Prospect ← In negotiation
✅ Customer ← Actual buyer
⭐ VIP ← Premium customer

Per customer data:
• Auto code (CUS-0001)
• Type: Individual / Company / Government
• Credit limit | Payment terms | Special discount
• Tax number & commercial reg
• Last purchase date & outstanding balance`
      },
      {
        q: ar ? 'عروض الأسعار وتحويلها لفواتير' : 'Quotations and converting to invoices',
        a: ar ? `إنشاء عرض سعر:
1. المبيعات CRM ← عروض الأسعار ← "+ عرض سعر"
2. أضف الأصناف مع الكمية والسعر
3. حدد الخصم % والضريبة %
4. النظام يحسب الإجمالي تلقائياً
5. "حفظ" ← رقم تلقائي (QUO-2026-0001)

تدفق الحالات:
مسودة → مرسل → مقبول ✅ / مرفوض ❌ / منتهي ⏰

تحويل لفاتورة بنقرة:
← اضغط "تحويل"
← تنشأ فاتورة مبيعات بنفس البيانات تلقائياً
← عرض السعر يُعلَّم "محوَّل"` : `Create quotation:
1. Sales CRM ← Quotations ← "+ New Quote"
2. Add items with quantity and price
3. Set discount % and tax %
4. System auto-calculates total
5. "Save" ← Auto number (QUO-2026-0001)

Status flow:
Draft → Sent → Accepted ✅ / Rejected ❌ / Expired ⏰

Convert to invoice in one click:
← Click "Convert"
← Sales invoice created with same data
← Quote marked as "Converted"`
      },
      {
        q: ar ? 'تسجيل الدفعات (جزئية وكاملة)' : 'Recording payments (partial & full)',
        a: ar ? `فاتورة المبيعات ← "تسجيل دفعة"

• المبلغ (جزئي أو كامل)
• طريقة الدفع: نقدي | بنك | InstaPay | شيك
• رقم المرجع والتاريخ

شريط التقدم يُظهر نسبة السداد:
⬛⬛⬛⬜⬜ 60% مدفوع | 40% متبقي

الحالات:
🔴 غير مدفوعة → 🟡 جزئية → 🟢 مدفوعة بالكامل

قيد تلقائي عند كل دفعة:
مدين: بنك/خزينة | دائن: عملاء` : `Sales Invoice ← "Record Payment"

• Amount (partial or full)
• Payment method: Cash | Bank | InstaPay | Check
• Reference number and date

Progress bar shows payment percentage:
⬛⬛⬛⬜⬜ 60% paid | 40% remaining

Statuses:
🔴 Unpaid → 🟡 Partial → 🟢 Fully Paid

Auto entry on each payment:
Dr: Bank/Cash | Cr: Customers`
      },
      {
        q: ar ? 'الاشتراكات الدورية للعملاء' : 'Recurring customer subscriptions',
        a: ar ? `المبيعات CRM ← الاشتراكات ← "+ اشتراك جديد"

دورات الفوترة:
📅 شهري | ربع سنوي | نصف سنوي | سنوي

الإدارة:
▶️ تفعيل | ⏸️ إيقاف مؤقت | ❌ إلغاء

توليد فاتورة بنقرة:
← اضغط "فاتورة" على أي اشتراك
← تنشأ فاتورة تلقائية مع حساب تاريخ الفوترة القادم

🔔 تتبع: تاريخ الفوترة القادم + عدد الفواتير المُولَّدة` : `Sales CRM ← Subscriptions ← "+ New Subscription"

Billing cycles:
📅 Monthly | Quarterly | Semi-annual | Annual

Manage:
▶️ Activate | ⏸️ Pause | ❌ Cancel

Generate invoice in one click:
← Click "Invoice" on any subscription
← Auto-creates invoice and updates next billing date

🔔 Track: next billing date + invoices generated count`
      },
    ]
  },
  {
    id: 'invoices', icon: '🧾', color: 'from-amber-500 to-orange-600',
    title: ar ? 'الفواتير الإلكترونية ETA' : 'E-Invoicing (ETA)',
    desc: ar ? 'مرتبط بمصلحة الضرائب المصرية' : 'Integrated with Egyptian Tax Authority',
    items: [
      {
        q: ar ? 'إعداد الفاتورة الإلكترونية' : 'E-Invoice setup',
        a: ar ? `الإعدادات ← إعدادات ETA ← أدخل:
• الرقم الضريبي للشركة
• كود الفاتورة الإلكترونية
• نوع النشاط التجاري

للمنتجات والخدمات:
• أضف رمز GS1 أو EGS لكل صنف
• الفاتورة الإلكترونية تتطلب كود لكل بند

✅ بعد الإعداد: كل فاتورة ترسل تلقائياً لمصلحة الضرائب` : `Settings ← ETA Settings ← Enter:
• Company tax registration number
• E-Invoice code
• Business activity type

For products/services:
• Add GS1 or EGS code for each item
• E-Invoice requires code for each line

✅ After setup: every invoice auto-submitted to Tax Authority`
      },
      {
        q: ar ? 'حالات الفاتورة الإلكترونية' : 'E-Invoice statuses',
        a: ar ? `⏳ Pending: في انتظار الإرسال لمصلحة الضرائب
✅ Valid: معتمدة من مصلحة الضرائب المصرية
❌ Invalid: فيها خطأ — تحقق من البيانات وأعد الإرسال
🚫 Cancelled: ملغاة (قبل اعتمادها)

إلغاء فاتورة معتمدة:
← لا يمكن الحذف، فقط الإلغاء عبر المنظومة
← تُنشأ إشعار دائن (Credit Note) تلقائياً` : `⏳ Pending: Awaiting submission to Tax Authority
✅ Valid: Approved by Egyptian Tax Authority
❌ Invalid: Has error — verify data and resubmit
🚫 Cancelled: Cancelled (before approval)

Cancel approved invoice:
← Cannot delete, only cancel via system
← Credit Note automatically created`
      },
    ]
  },
  {
    id: 'projects', icon: '📁', color: 'from-indigo-600 to-purple-700',
    title: ar ? 'المشاريع والمقاولات' : 'Projects & Contracting',
    desc: ar ? 'مشاريع | مهام | مستخلصات | تقارير مالية' : 'Projects | Tasks | Claims | Financial Reports',
    items: [
      {
        q: ar ? 'إنشاء مشروع وربطه بالمحاسبة' : 'Create project with accounting integration',
        a: ar ? `المشاريع ← "+ مشروع جديد"

• اسم المشروع | الوصف | العميل
• تاريخ البداية والنهاية | الميزانية المعتمدة
• فريق العمل | المسؤول

كل حركة مالية في المشروع → قيد تلقائي:
إيراد: مدين بنك | دائن إيرادات مشاريع 412
مصروف: مدين المصروف | دائن بنك

التقرير المالي للمشروع:
← الطباعة/التصدير يشمل:
  ✓ 4 بطاقات KPI (إيرادات/مصروفات/ربح/ميزانية)
  ✓ جدول إيرادات مفصل
  ✓ جدول مصروفات مفصل
  ✓ ملخص الربح والخسارة
  ✓ جدول المهام` : `Projects → "+ New Project"

• Project name | Description | Client
• Start/end date | Approved budget
• Team | Responsible person

Every financial movement → auto journal entry:
Revenue: Dr Bank | Cr Project revenue 412
Expense: Dr Expense | Cr Bank

Project financial report:
← Print/Export includes:
  ✓ 4 KPI cards (Revenue/Expenses/Profit/Budget)
  ✓ Detailed revenue table
  ✓ Detailed expenses table
  ✓ Profit & Loss summary
  ✓ Tasks table`
      },
      {
        q: ar ? 'المستخلصات (قطاع المقاولات — معيار 8)' : 'Progress Claims (Contracting — Standard 8)',
        a: ar ? `المشاريع المتقدمة ← المستخلصات

وفق المعيار المحاسبي المصري رقم 8:
• إجمالي المستخلص
• (-) خصم التأمين المحتجز 5-10%
• (-) خصم الدفعة المقدمة
• (+) ضريبة القيمة المضافة 5% أو 14%
• (-) ضريبة الخصم والتحصيل 1%
= صافي المستحق

القيد التلقائي:
مدين: عملاء 131 + ضمان 141 + خصم 138
دائن: إيرادات مقاولات 414 + VAT 260` : `Advanced Projects ← Progress Claims

Per Egyptian Accounting Standard 8:
• Gross claim amount
• (-) Retention deduction 5-10%
• (-) Advance payment deduction
• (+) VAT 5% or 14%
• (-) Withholding tax 1%
= Net payable

Auto journal entry:
Dr: Customers 131 + Retention 141 + WHT 138
Cr: Contracting revenue 414 + VAT 260`
      },
    ]
  },
  {
    id: 'security', icon: '🔒', color: 'from-slate-600 to-gray-700',
    title: ar ? 'الأمان والصلاحيات' : 'Security & Permissions',
    desc: ar ? 'حماية متعددة الطبقات' : 'Multi-layer protection',
    items: [
      {
        q: ar ? 'نظام الصلاحيات' : 'Permissions system',
        a: ar ? `الإعدادات ← الصلاحيات ← اختر المستخدم

الصلاحيات المتاحة (21 صلاحية مقسمة لمجموعات):
👥 HR: موظفون | رواتب | حضور | إجازات | ورديات | إنهاء خدمة
💰 مالية: قيود | أستاذ عام | بنوك | أصول | تقارير
📈 مبيعات: عملاء CRM | عروض | فواتير | اشتراكات
🧾 فواتير: إنشاء | اعتماد | ETA
🛒 مشتريات | 📁 مشاريع | ⚙️ إعدادات | 👤 مستخدمون

قوالب جاهزة:
• مدير عام (كل شيء)
• مدير مالي | محاسب | مدير HR | مشاهد فقط` : `Settings ← Permissions ← Select user

Available permissions (21 grouped):
👥 HR: Employees | Payroll | Attendance | Leaves | Shifts | Termination
💰 Finance: Entries | Ledger | Banks | Assets | Reports
📈 Sales: Customer CRM | Quotes | Invoices | Subscriptions
🧾 Invoicing: Create | Approve | ETA
🛒 Purchases | 📁 Projects | ⚙️ Settings | 👤 Users

Ready templates:
• General Manager (everything)
• Financial Manager | Accountant | HR Manager | Viewer only`
      },
      {
        q: ar ? 'أمان البيانات' : 'Data security',
        a: ar ? `🔒 حماية متعددة الطبقات:

HTTPS: تشفير SSL/TLS 1.3 لكل البيانات
JWT: توكن مشفر صلاحية 8 ساعات
خروج تلقائي: 30 دقيقة خمول (تحذير قبل دقيقتين)
Rate Limiting: حماية من الاختراق والـ brute force
سجل المراجعة: كل عملية مسجلة بالتوقيت والمستخدم

المحاسبة الثابتة:
← القيود المرحلة لا تُحذف نهائياً
← للتصحيح: قيد عكسي فقط
← سجل لا يمكن التلاعب به (Immutable Ledger)

البيانات: MongoDB مشفر | نسخ احتياطية يومية
الاستضافة: Hetzner Europe | HTTPS على datalifeaccount.com` : `🔒 Multi-layer protection:

HTTPS: SSL/TLS 1.3 encryption for all data
JWT: Encrypted token, 8-hour validity
Auto logout: 30 min idle (2-min warning)
Rate Limiting: Protection against hacking & brute force
Audit Log: Every operation logged with time and user

Accounting immutability:
← Posted entries cannot be deleted
← To correct: reverse entry only
← Tamper-proof ledger (Immutable Ledger)

Data: Encrypted MongoDB | Daily backups
Hosting: Hetzner Europe | HTTPS on datalifeaccount.com`
      },
    ]
  },

  {
    id: 'gps-attendance', icon: '📍', color: 'from-green-600 to-emerald-600',
    title: ar ? 'الحضور بالـ GPS' : 'GPS Attendance',
    desc: ar ? 'تسجيل حضور الموظفين بالموقع الجغرافي' : 'Location-based attendance check-in',
    items: [
      {
        q: ar ? 'كيف أُعِد نظام الحضور بالـ GPS؟ (للمدير)' : 'How to setup GPS attendance? (Admin)',
        a: ar ? `الإعدادات ← إعدادات GPS

1. اضغط "📍 تحديد موقع الشركة"
   ← المتصفح سيطلب إذن الموقع → اضغط "سماح"
   ← ستظهر الإحداثيات تلقائياً

2. أو أدخل الإحداثيات يدوياً:
   خط العرض (Latitude) | خط الطول (Longitude)

3. حدد نطاق الحضور المسموح (بالمتر):
   مثال: 200 متر حول مقر الشركة

4. فعّل خيار "تفعيل GPS"

5. اضغط "حفظ الإعدادات"

💡 يمكن السماح بالعمل عن بُعد بتعطيل التحقق من GPS` : `Settings → GPS Settings

1. Click "📍 Detect Company Location"
   ← Browser asks location permission → click "Allow"
   ← Coordinates filled automatically

2. Or enter manually: Latitude | Longitude

3. Set allowed radius in meters:
   e.g., 200 meters around the office

4. Enable "GPS Attendance" toggle

5. Click "Save Settings"

💡 Allow remote work by disabling GPS verification`
      },
      {
        q: ar ? 'كيف يسجل الموظف حضوره بالـ GPS؟' : 'How does an employee check in via GPS?',
        a: ar ? `الموارد البشرية ← الحضور ← "+ تسجيل حضور"

في نافذة تسجيل الحضور:
← اختر الموظف
← اضغط "📍 حضور GPS"

المتصفح سيطلب إذن الموقع:
• داخل النطاق المسموح ✅ → يُسجَّل الحضور فوراً
• خارج النطاق ❌ → رسالة خطأ بالمسافة

رسالة الخطأ مثال:
"أنت خارج نطاق العمل المسموح به.
المسافة: 450م | النطاق المسموح: 200م"

الموظف يمكنه أيضاً:
← اضغط "تأكيد" (حضور يدوي بدون GPS)

🔒 GPS لا يمكن التلاعب به — الإحداثيات مُسجَّلة بالتوقيت` : `HR → Attendance → "+ Add Attendance"

In the check-in dialog:
← Select employee
← Click "📍 GPS Check-in"

Browser requests location:
• Within radius ✅ → check-in recorded instantly
• Outside radius ❌ → error with distance shown

Error example:
"You are outside the allowed work zone.
Distance: 450m | Allowed: 200m"

Employee can also:
← Click "Confirm" for manual check-in (no GPS)

🔒 GPS cannot be faked — coordinates stored with timestamp`
      },
      {
        q: ar ? 'كيف أتابع تقارير الحضور والغياب؟' : 'How to track attendance reports?',
        a: ar ? `الموارد البشرية ← الحضور ← تقرير الحضور

فلتر حسب:
• الموظف | القسم | الفترة الزمنية

كل سجل يُظهر:
• وقت الحضور (check-in) وطريقته (GPS / يدوي)
• وقت الانصراف (check-out)
• مدة العمل الفعلية
• الإحداثيات (إن كان GPS)
• المسافة من المكتب

📊 تقرير مسير الرواتب يستند إلى بيانات الحضور تلقائياً` : `HR → Attendance → Attendance Report

Filter by:
• Employee | Department | Date range

Each record shows:
• Check-in time and method (GPS / Manual)
• Check-out time
• Actual work duration
• Coordinates (if GPS)
• Distance from office

📊 Payroll automatically uses attendance data`
      },
    ]
  },
  {
    id: 'salary-disbursement', icon: '🏦', color: 'from-blue-700 to-indigo-700',
    title: ar ? 'صرف المرتبات للبنك' : 'Salary Disbursement',
    desc: ar ? 'تحويل المرتبات للبنك / InstaPay / Vodafone / نقدي' : 'Pay salaries: Bank / InstaPay / Vodafone / Cash',
    items: [
      {
        q: ar ? 'كيف أُعِد بيانات البنك لكل موظف؟' : 'How to set up bank data for each employee?',
        a: ar ? `الموارد البشرية ← بيانات الموظف ← تعديل

في قسم "البيانات البنكية":
• اسم البنك
• رقم الحساب البنكي
• IBAN (اختياري)
• رقم المحفظة (للـ InstaPay / فودافون كاش)
• طريقة الاستلام الافتراضية

طرق الاستلام المتاحة:
🏦 تحويل بنكي — يتطلب رقم حساب أو IBAN
💵 نقدي — لا يتطلب بيانات
📱 InstaPay — يتطلب رقم المحفظة
📲 Vodafone Cash — يتطلب رقم المحفظة

💡 يمكن تغيير الطريقة لكل موظف عند كل صرف` : `HR → Employee Profile → Edit

In "Banking Data" section:
• Bank name
• Account number
• IBAN (optional)
• Wallet number (for InstaPay / Vodafone Cash)
• Default payment method

Available payment methods:
🏦 Bank Transfer — requires account or IBAN
💵 Cash — no data needed
📱 InstaPay — requires wallet number
📲 Vodafone Cash — requires wallet number

💡 Method can be changed per employee at each payroll`
      },
      {
        q: ar ? 'كيف أصرف المرتبات مع اختيار طريقة الدفع؟' : 'How to pay salaries with payment methods?',
        a: ar ? `الموارد البشرية ← مسير الرواتب ← الشهر المطلوب

1. بعد اعتماد المسير ← اضغط "🏦 صرف الرواتب"

2. تفتح نافذة "إدارة التحويلات" تُظهر:
   • ملخص لكل طريقة (عدد الموظفين + الإجمالي)
   • جدول بكل موظف: بنكه | رقم حسابه | IBAN | محفظته

3. يمكنك تغيير طريقة أي موظف من القائمة المنسدلة

4. اضغط "⬇️ تحميل CSV للبنك"
   ← ملف جاهز برفعه على بوابة البنك مباشرة
   (يحتوي: اسم الموظف | رقم الحساب | IBAN | المبلغ)

5. اضغط "✅ تأكيد الصرف وتحديث المحاسبة"
   ← قيد محاسبي تلقائي: دائن البنك | مدين الرواتب
   ← حالة المسير تصبح "مصروف"` : `HR → Payroll Runs → Select month

1. After approving run → click "🏦 Pay Salaries"

2. "Transfer Management" modal opens showing:
   • Summary by method (employee count + total)
   • Table: each employee's bank | account | IBAN | wallet

3. Change any employee's method from the dropdown

4. Click "⬇️ Download CSV for Bank"
   ← Ready file to upload directly to bank portal
   (contains: employee name | account | IBAN | amount)

5. Click "✅ Confirm & Post Accounting"
   ← Auto journal entry: credit bank | debit salaries
   ← Run status becomes "Paid"`
      },
      {
        q: ar ? 'كيف أُرسل قسائم الراتب بالإيميل؟' : 'How to send payslips by email?',
        a: ar ? `بعد تنفيذ مسير الرواتب:

الموارد البشرية ← مسير الرواتب ← "📧 إرسال قسائم الرواتب"

← رسالة تأكيد "إرسال لجميع الموظفين؟"
← اضغط موافق

كل موظف يستلم بريداً يحتوي:
• قسيمة راتب HTML مفصلة (أو PDF)
• الراتب الأساسي + البدلات
• الاستقطاعات: تأمينات + ضريبة
• صافي الراتب المستحق

المتطلبات على السيرفر:
RESEND_API_KEY=re_VbrSsejP_...
SENDER_EMAIL=noreply@datalifeaccount.com` : `After running payroll:

HR → Payroll Runs → "📧 Send Payslips"

← Confirmation "Send to all employees?"
← Click OK

Each employee receives an email containing:
• Detailed HTML payslip (or PDF)
• Basic salary + allowances
• Deductions: insurance + tax
• Net salary

Server requirements:
RESEND_API_KEY=re_VbrSsejP_...
SENDER_EMAIL=noreply@datalifeaccount.com`
      },
    ]
  },
  {
    id: 'employee-management', icon: '👤', color: 'from-violet-600 to-purple-700',
    title: ar ? 'إدارة الموظفين المتقدمة' : 'Advanced Employee Management',
    desc: ar ? 'الدعوة | الصلاحيات | تتبع الجلسات | الصورة' : 'Invites | Permissions | Sessions | Photos',
    items: [
      {
        q: ar ? 'كيف أدعو موظف بصلاحيات تلقائية حسب وظيفته؟' : 'How to invite employee with auto-permissions by role?',
        a: ar ? `الإعدادات ← إدارة المستخدمين ← "دعوة موظف"

1. أدخل اسم الموظف والبريد الإلكتروني

2. اختر الدور الوظيفي من القائمة:
   • مدير عام / CEO ← كل الصلاحيات تلقائياً
   • مدير مالي ← مالية | مبيعات | فواتير | مشتريات
   • مدير HR ← موارد بشرية | تقارير
   • محاسب ← مالية | فواتير
   • مشاهد ← تقارير فقط

3. الصلاحيات تُضبط تلقائياً ← يمكنك التعديل يدوياً

4. اضغط "إرسال الدعوة"

5. ✅ شاشة تأكيد تُظهر:
   • البريد المُرسل إليه
   • الصلاحيات المُرسلة
   • زر "إعادة إرسال البريد" إذا لم يصله

📧 البريد يحتوي: اسم المستخدم + كلمة مرور مؤقتة + رابط الدخول` : `Settings → User Management → "Invite Employee"

1. Enter employee name and email

2. Choose job role from dropdown:
   • General Manager / CEO ← all permissions auto-set
   • Financial Manager ← finance | sales | invoices | purchases
   • HR Manager ← HR | reports
   • Accountant ← finance | invoices
   • Viewer ← reports only

3. Permissions auto-set ← can still edit manually

4. Click "Send Invitation"

5. ✅ Confirmation screen shows:
   • Email sent to address
   • Permissions included
   • "Resend Email" button if not received

📧 Email contains: username + temp password + login link`
      },
      {
        q: ar ? 'كيف أتابع جلسات عمل الموظفين (دخول وخروج)؟' : 'How to track employee work sessions?',
        a: ar ? `الإعدادات ← إدارة المستخدمين

في جدول الموظفين (مدير عام / رئيس مجلس الإدارة فقط):

لكل موظف يُظهر:
• 🟢 متصل الآن (نقطة خضراء مضيئة)
• آخر دخول: التاريخ والوقت
• آخر خروج: التاريخ والوقت
• مدة آخر جلسة (ساعات:دقائق)

لعرض تاريخ الجلسات الكاملة:
← اضغط على عدد الجلسات (مثال: "12 جلسة")
← يظهر جدول بآخر 10 جلسات

الأمان:
• تسجيل خروج تلقائي بعد 30 دقيقة خمول
• كل جلسة مُسجَّلة بالتاريخ والوقت والمدة

💡 هذه البيانات للمدراء فقط — الموظف العادي لا يراها` : `Settings → User Management

In employee table (General Manager / Chairman only):

Per employee shows:
• 🟢 Online now (pulsing green dot)
• Last login: date and time
• Last logout: date and time
• Last session duration (hours:minutes)

To see full session history:
← Click session count (e.g., "12 sessions")
← Table showing last 10 sessions appears

Security:
• Auto-logout after 30 minutes idle
• Every session logged with date, time, and duration

💡 Only visible to managers — regular employees cannot see this`
      },
      {
        q: ar ? 'كيف أضيف صورة الموظف وأُعيد إرسال الدعوة؟' : 'How to add employee photo and resend invite?',
        a: ar ? `إضافة صورة الموظف:
الموارد البشرية ← بيانات الموظف ← تعديل
← اسحب صورة JPG/PNG أو اضغط لاختيار ملف
← الصورة تظهر في جدول الموظفين وملفه الشخصي

إعادة إرسال الدعوة:
في جدول إدارة المستخدمين:
← إذا الموظف لم يسجل الدخول بعد:
  • يظهر تحذير "⚠️ لم يدخل بعد"
  • زر "📧 إعادة إرسال" يظهر بجانبه
  • اضغطه ← يُرسَل بريد جديد بنفس بيانات الدخول

حالات الموظفين:
🟢 نشط — يمكنه الدخول
⚠️ لم يدخل بعد — أُرسلت له دعوة لم يستجب
🔴 معطل — تم إيقاف حسابه` : `Add employee photo:
HR → Employee Profile → Edit
← Drag JPG/PNG or click to select file
← Photo appears in employee table and profile

Resend invitation:
In User Management table:
← If employee never logged in:
  • Warning "⚠️ Never logged in" shown
  • "📧 Resend" button appears next to them
  • Click it ← New email sent with same credentials

Employee statuses:
🟢 Active — can login
⚠️ Never logged in — invite sent, not yet accepted
🔴 Disabled — account deactivated`
      },
    ]
  },
  {
    id: 'pricing', icon: '💳', color: 'from-amber-600 to-orange-600',
    title: ar ? 'الأسعار والخطط' : 'Pricing & Plans',
    desc: ar ? '3 خطط + كود تفعيل مجاني + 14 يوم تجربة' : '3 plans + free activation code + 14-day trial',
    items: [
      {
        q: ar ? 'ما هي الخطط المتاحة وأسعارها؟' : 'What plans are available and their prices?',
        a: ar ? `3 خطط تناسب كل شركة:

🔵 المبتدئ — 299 ج.م / شهر (أو 2,390 سنوياً)
   • 1-10 موظفين
   • HR أساسي + محاسبة كاملة + فواتير + مخزون
   • 108 حساب وفق الدليل المصري المعياري
   • دعم بريد إلكتروني + 5 جيجا تخزين

⭐ المحترف — 799 ج.م / شهر (أو 6,392 سنوياً)
   • 11-100 موظف
   • كل مميزات المبتدئ +
   • كشف مرتبات تلقائي (قانون 148/2019 + 91/2005)
   • حضور GPS مع جيوفنسينج
   • قسيمة راتب PDF بالإيميل
   • صرف مرتبات: بنك / InstaPay / Vodafone / نقدي
   • تقرير تحويلات بنكية CSV
   • الفاتورة الإلكترونية ETA
   • المبيعات CRM + مشتريات + مخزون متقدم
   • بنوك وتسويات بنكية + VAT
   • أصول ثابتة وإهلاك
   • دعم أولوية + 25 جيجا تخزين

👑 المؤسسي — 1,499 ج.م / شهر (أو 11,992 سنوياً)
   • موظفون غير محدودون
   • كل مميزات المحترف +
   • المشاريع والمقاولات (معيار 8)
   • مستخلصات وجداول كميات BOQ
   • قطاع طبي — أتعاب أطباء
   • مراكز التكلفة + فروع متعددة
   • مدير حساب مخصص + تدريب
   • دعم هاتفي 24/7 + SLA مضمون

💡 خصم 20% عند الدفع السنوي` : `3 plans for every business:

🔵 Starter — 299 EGP/month (or 2,390/year)
   • 1-10 employees
   • Basic HR + full accounting + invoices + inventory
   • 108 accounts (Egyptian standard)
   • Email support + 5 GB storage

⭐ Professional — 799 EGP/month (or 6,392/year)
   • 11-100 employees
   • All Starter features +
   • Auto payroll (Law 148/2019 + 91/2005)
   • GPS attendance with geofencing
   • PDF payslip by email
   • Salary disbursement: Bank / InstaPay / Vodafone / Cash
   • Bank transfer CSV report
   • E-Invoice ETA
   • Sales CRM + purchases + advanced inventory
   • Banking & reconciliation + VAT
   • Fixed assets & depreciation
   • Priority support + 25 GB storage

👑 Enterprise — 1,499 EGP/month (or 11,992/year)
   • Unlimited employees
   • All Professional features +
   • Projects & contracting (Standard 8)
   • Progress claims + BOQ
   • Medical sector — doctor fees
   • Cost centers + multi-branch
   • Dedicated account manager + training
   • Phone support 24/7 + guaranteed SLA

💡 20% discount on annual billing`
      },
      {
        q: ar ? 'كيف أدفع وما هي طرق الدفع؟' : 'How to pay and what are payment methods?',
        a: ar ? `datalifeaccount.com ← الأسعار ← اختر خطتك

طرق الدفع المتاحة:
💳 فيزا / ماستركارد
📱 InstaPay: 00201006008552
📲 فودافون كاش: 00201012625529
🏦 تحويل بنكي (بيانات التحويل في صفحة الدفع)
🔑 كود تفعيل مجاني

بعد الدفع:
← ارفع صورة الإيصال في صفحة الدفع
← فاتورة PDF ترسل تلقائياً لبريدك
← الحساب يُفعَّل فور التأكيد` : `datalifeaccount.com → Pricing → Choose plan

Available payment methods:
💳 Visa / Mastercard
📱 InstaPay: 00201006008552
📲 Vodafone Cash: 00201012625529
🏦 Bank transfer (details on payment page)
🔑 Free activation code

After payment:
← Upload receipt screenshot on payment page
← PDF invoice auto-sent to your email
← Account activated upon confirmation`
      },
    ]
  },

];

// ── Section Card ──────────────────────────────────────────────
function SectionCard({ section, ar, isRTL }) {
  const [open, setOpen] = useState(false);
  const [openItems, setOpenItems] = useState({});

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-start"
      >
        <div className={`w-12 h-12 bg-gradient-to-br ${section.color} rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base">{section.title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{section.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {section.items.length} {ar ? 'موضوع' : 'topics'}
          </span>
          {open
            ? <ChevronUp className="w-5 h-5 text-gray-400" />
            : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {/* Items */}
      {open && (
        <div className="border-t border-gray-100">
          {section.items.map((item, idx) => (
            <div key={idx} className="border-b border-gray-50 last:border-0">
              <button
                onClick={() => setOpenItems(p => ({ ...p, [idx]: !p[idx] }))}
                className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-start"
              >
                <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">▸</span>
                <span className="font-medium text-gray-800 text-sm flex-1">{item.q}</span>
                {openItems[idx]
                  ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
              </button>
              {openItems[idx] && (
                <div className="px-4 pb-4 ps-8">
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {item.a}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function GuideWebPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('ar');
  const ar = lang === 'ar';
  const isRTL = ar;
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState(null);

  const sections = SECTIONS(ar);

  const filtered = search
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(i =>
          i.q.toLowerCase().includes(search.toLowerCase()) ||
          i.a.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(s => s.items.length > 0)
    : sections;

  const scrollTo = (id) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50">

      {/* ── NAV ── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <span className="font-black text-[#1e3a8a] text-lg">DataLife</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Account</span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors">
              {ar ? 'EN' : 'عربي'}
            </button>
            <button onClick={() => navigate('/login')}
              className="text-xs bg-[#1e3a8a] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-800 transition-colors">
              {ar ? 'تسجيل الدخول' : 'Login'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="bg-gradient-to-br from-[#0f1729] via-[#1e3a8a] to-[#0f1729] text-white">
        <div className="max-w-5xl mx-auto px-4 py-12">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <Book className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black">
                {ar ? 'دليل الاستخدام الشامل' : 'Complete User Guide'}
              </h1>
              <p className="text-blue-200 text-sm mt-0.5">
                {ar ? 'DataLife Account — نظام ERP المصري الأول' : 'DataLife Account — Egypt\'s First ERP Platform'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { n:'14', l: ar?'وحدة متكاملة':'Integrated Modules' },
              { n:'108', l: ar?'حساب محاسبي':'Chart Accounts' },
              { n:'24/7', l: ar?'متاح دائماً':'Always Available' },
              { n:'🔒', l: ar?'بيانات آمنة':'Secure Data' },
            ].map((s,i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                <p className="text-xl font-black">{s.n}</p>
                <p className="text-blue-200 text-xs mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute top-3.5 right-3 w-4 h-4 text-white/50 rtl:right-3 ltr:left-3" />
            <input
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
              placeholder={ar ? 'ابحث في الدليل... (مثال: كيف أضيف موظف)' : 'Search the guide... (e.g. how to add employee)'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
        </div>
      </div>

      {/* ── QUICK NAV ── */}
      {!search && (
        <div className="bg-white border-b border-gray-100 sticky top-[57px] z-40">
          <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {sections.map(s => (
              <button key={s.id}
                onClick={() => scrollTo(s.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
                <span>{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">

        {search && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{ar ? 'لم يُوجد نتائج لـ "' + search + '"' : `No results for "${search}"`}</p>
            <button onClick={() => setSearch('')} className="mt-4 text-sm text-blue-600 underline">
              {ar ? 'مسح البحث' : 'Clear search'}
            </button>
          </div>
        )}

        {filtered.map(section => (
          <div key={section.id} id={`section-${section.id}`}>
            <SectionCard section={section} ar={ar} isRTL={isRTL} />
          </div>
        ))}

        {/* CTA */}
        {!search && (
          <div className="bg-gradient-to-r from-[#0f1729] to-[#1e3a8a] rounded-2xl p-6 text-white text-center mt-8">
            <h2 className="text-xl font-black mb-2">
              {ar ? 'جاهز للبدء؟' : 'Ready to get started?'}
            </h2>
            <p className="text-blue-200 text-sm mb-5">
              {ar ? '14 يوم تجربة مجانية — بدون بطاقة ائتمان — تفعيل فوري' : '14-day free trial — no credit card — instant activation'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate('/')}
                className="flex items-center gap-2 bg-white text-[#1e3a8a] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                {ar ? 'ابدأ التجربة المجانية' : 'Start Free Trial'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/contact')}
                className="flex items-center gap-2 bg-white/10 text-white border border-white/20 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-white/20 transition-colors">
                <Mail className="w-4 h-4" />
                {ar ? 'تواصل معنا' : 'Contact Us'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0f172a] text-gray-500 text-center py-6 text-sm mt-8">
        <p className="mb-1 font-medium text-gray-400">DataLife Account — {ar ? 'دليل الاستخدام' : 'User Guide'} v3.0</p>
        <p>
          <a href="mailto:info@datalifeai.com" className="hover:text-white transition-colors">info@datalifeai.com</a>
          {' · '}
          <a href="https://datalifeaccount.com" className="hover:text-white transition-colors">datalifeaccount.com</a>
        </p>
      </footer>

    </div>
  );
}
