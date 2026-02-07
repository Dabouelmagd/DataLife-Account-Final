import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  ArrowRight, ArrowLeft, CheckCircle, Users, Building2, FileText,
  DollarSign, Package, FolderKanban, BarChart3, Shield, Settings,
  Printer, Download, Bell, Calendar, Clock, Globe, Lock, 
  Smartphone, Cloud, Zap, HeadphonesIcon, CreditCard, 
  UserCheck, FileSearch, PieChart, TrendingUp, Layers,
  Database, RefreshCw, Mail, MessageSquare, BookOpen,
  Monitor, Palette, Languages, ChevronDown, ChevronUp,
  Play, Star, Award, Target, Briefcase, Receipt
} from 'lucide-react';

const FeaturesPage = () => {
  const { language: globalLang } = useLanguage();
  const navigate = useNavigate();
  const [pageLang, setPageLang] = useState(globalLang || 'ar');
  const isRTL = pageLang === 'ar';
  const [expandedSection, setExpandedSection] = useState(null);

  // Logo source based on language
  const logoSrc = pageLang === 'ar' ? '/datalife-logo-arabic.svg' : '/datalife-logo-english.svg';
  const logoAlt = pageLang === 'ar' ? 'داتا لايف أكونت' : 'DataLife Account';

  const toggleLanguage = () => {
    setPageLang(pageLang === 'ar' ? 'en' : 'ar');
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Translations object
  const t = {
    ar: {
      // Header
      systemName: 'نظام إدارة الموارد المؤسسية',
      backToHome: 'العودة للرئيسية',
      login: 'تسجيل الدخول',
      
      // Hero
      badge: 'الدليل الشامل',
      heroTitle: 'دليل مميزات نظام DataLife ERP',
      heroDesc: 'نظام متكامل لإدارة موارد المؤسسات يدعم اللغة العربية والإنجليزية، مصمم خصيصاً لتلبية احتياجات الشركات العربية',
      bilingual: 'دعم ثنائي اللغة',
      cloudBased: 'سحابي 100%',
      advancedSecurity: 'حماية متقدمة',
      
      // Quick Navigation
      quickNav: 'الانتقال السريع',
      navItems: {
        overview: 'نظرة عامة',
        modules: 'الوحدات الرئيسية',
        hr: 'الموارد البشرية',
        finance: 'الإدارة المالية',
        projects: 'المشاريع',
        reports: 'التقارير',
        admin: 'لوحة الإدارة',
        howto: 'طريقة التشغيل',
      },
      
      // Section 1: Overview
      overviewBadge: 'مقدمة',
      overviewTitle: 'نظرة عامة على النظام',
      overviewDesc: 'DataLife ERP هو نظام متكامل لإدارة موارد المؤسسات، مصمم بأحدث التقنيات لتوفير حلول شاملة للشركات',
      overviewCards: [
        { title: 'متعدد الشركات', desc: 'إدارة عدة شركات من حساب واحد مع فصل كامل للبيانات' },
        { title: 'متعدد المستخدمين', desc: 'صلاحيات مخصصة لكل مستخدم حسب دوره الوظيفي' },
        { title: 'ثنائي اللغة', desc: 'دعم كامل للعربية والإنجليزية مع واجهة RTL' },
        { title: 'سحابي آمن', desc: 'الوصول من أي مكان مع حماية متقدمة للبيانات' },
      ],
      
      // Section 2: Modules
      modulesBadge: 'الوحدات',
      modulesTitle: 'الوحدات الرئيسية للنظام',
      modulesData: [
        { 
          title: 'إدارة الموارد البشرية', 
          features: ['إدارة بيانات الموظفين', 'نظام الرواتب والمستحقات', 'الحضور والانصراف', 'الإجازات والغياب', 'تقارير HR متقدمة']
        },
        { 
          title: 'الإدارة المالية', 
          features: ['دليل الحسابات', 'القيود المحاسبية', 'الميزانية العمومية', 'قائمة الدخل', 'التقارير المالية']
        },
        { 
          title: 'الفواتير والمبيعات', 
          features: ['إنشاء الفواتير', 'إدارة العملاء', 'تتبع المدفوعات', 'تقارير المبيعات', 'الفواتير المتكررة']
        },
        { 
          title: 'إدارة المشتريات', 
          features: ['أوامر الشراء', 'إدارة الموردين', 'متابعة الطلبات', 'تقارير المشتريات', 'إدارة المخزون']
        },
        { 
          title: 'إدارة المشاريع', 
          features: ['إنشاء المشاريع', 'إدارة المهام', 'تتبع التقدم', 'الجدول الزمني', 'فريق العمل']
        },
        { 
          title: 'التحليلات والتقارير', 
          features: ['لوحات بيانية', 'تقارير تفاعلية', 'تصدير PDF/CSV', 'رسوم بيانية', 'مؤشرات الأداء']
        },
      ],
      
      // Section 3: HR
      hrTitle: 'وحدة الموارد البشرية',
      hrDesc: 'إدارة شاملة للموظفين والرواتب والحضور',
      employeeMgmt: 'إدارة الموظفين',
      employeeFeatures: [
        'إضافة وتعديل بيانات الموظفين',
        'رفع صور الموظفين والمستندات',
        'تتبع تاريخ التوظيف',
        'إدارة الأقسام والإدارات',
        'بطاقات تعريف الموظفين',
        'سجل البيانات الشخصية والمهنية',
      ],
      salarySystem: 'نظام الرواتب',
      salaryFeatures: [
        'حساب الرواتب الشهرية تلقائياً',
        'إدارة البدلات والعلاوات',
        'حساب الخصومات والاستقطاعات',
        'تقارير الرواتب التفصيلية',
        'كشوفات المرتبات',
        'تصدير بيانات الرواتب',
      ],
      attendance: 'الحضور والانصراف',
      attendanceFeatures: [
        'تسجيل الحضور والانصراف',
        'حساب ساعات العمل الإضافي',
        'تتبع التأخير والغياب',
        'تقارير الحضور الشهرية',
        'ربط مع أجهزة البصمة',
        'تقويم العمل المخصص',
      ],
      leaves: 'الإجازات',
      leaveFeatures: [
        'طلبات الإجازة الإلكترونية',
        'أنواع إجازات متعددة',
        'رصيد الإجازات التلقائي',
        'موافقات الإجازات',
        'تقارير الإجازات السنوية',
        'إشعارات الإجازات',
      ],
      
      // Section 4: Finance
      financeTitle: 'وحدة الإدارة المالية',
      financeDesc: 'نظام محاسبي متكامل لإدارة الشؤون المالية',
      financeModules: [
        { title: 'دليل الحسابات', items: ['شجرة حسابات متعددة المستويات', 'أنواع الحسابات المختلفة', 'أرصدة افتتاحية', 'تصنيف الحسابات'] },
        { title: 'القيود المحاسبية', items: ['قيود يومية', 'قيود آلية', 'قيود التسوية', 'مراجعة القيود'] },
        { title: 'التقارير المالية', items: ['الميزانية العمومية', 'قائمة الدخل', 'التدفقات النقدية', 'ميزان المراجعة'] },
        { title: 'إدارة العملاء', items: ['سجل العملاء', 'كشف حساب العميل', 'أعمار الديون', 'المتابعة والتحصيل'] },
        { title: 'إدارة الموردين', items: ['سجل الموردين', 'كشف حساب المورد', 'المستحقات للموردين', 'تقارير الموردين'] },
        { title: 'الفواتير', items: ['فواتير المبيعات', 'فواتير المشتريات', 'إشعارات دائنة/مدينة', 'تقارير الفواتير'] },
      ],
      
      // Section 5: Projects
      projectsTitle: 'وحدة إدارة المشاريع',
      projectsDesc: 'تخطيط وتنفيذ ومتابعة المشاريع بكفاءة',
      projectMgmt: 'إدارة المشاريع',
      projectFeatures: [
        'إنشاء مشاريع جديدة مع تفاصيل كاملة',
        'تحديد الميزانية والجدول الزمني',
        'تعيين مدير المشروع وفريق العمل',
        'تتبع حالة المشروع (قيد التنفيذ/مكتمل/معلق)',
        'نسبة الإنجاز التلقائية',
        'مؤشرات الأداء الرئيسية KPIs',
      ],
      taskMgmt: 'إدارة المهام',
      taskFeatures: [
        'إنشاء وتعيين المهام للموظفين',
        'تحديد الأولويات (عاجل/عالي/متوسط/منخفض)',
        'تواريخ البدء والانتهاء',
        'التعليقات والملاحظات على المهام',
        'إشعارات المهام التلقائية',
        'تقارير إنتاجية الفريق',
      ],
      
      // Section 6: Reports
      reportsBadge: 'التقارير',
      reportsTitle: 'التقارير والتصدير',
      reportsDesc: 'نظام تقارير متقدم مع إمكانية الطباعة والتصدير بصيغ متعددة',
      printing: 'الطباعة',
      printingDesc: 'طباعة التقارير مباشرة بتنسيق احترافي مع إخفاء القوائم',
      pdfExport: 'تصدير PDF',
      pdfExportDesc: 'تصدير التقارير بصيغة PDF للأرشفة والمشاركة',
      excelExport: 'تصدير Excel',
      excelExportDesc: 'تصدير البيانات بصيغة CSV للتحليل في Excel',
      reportTypes: 'أنواع التقارير المتوفرة',
      reportList: [
        'تقارير الموظفين', 'تقارير الرواتب', 'تقارير الحضور', 'تقارير الإجازات',
        'التقارير المالية', 'تقارير المبيعات', 'تقارير المشتريات', 'تقارير المخزون',
        'تقارير المشاريع', 'تقارير المهام', 'تقارير الأداء', 'تقارير مخصصة'
      ],
      
      // Section 7: Admin
      adminTitle: 'لوحة تحكم المسؤول',
      adminDesc: 'إدارة شاملة للنظام والشركات والمستخدمين',
      adminCards: [
        { title: 'إدارة الشركات', desc: 'عرض جميع الشركات المسجلة وتفعيلها أو تعطيلها' },
        { title: 'إدارة المستخدمين', desc: 'التحكم في المستخدمين وصلاحياتهم' },
        { title: 'أكواد التفعيل', desc: 'إنشاء وإدارة أكواد الاشتراك' },
        { title: 'الإشعارات', desc: 'إرسال إشعارات للشركات والمستخدمين' },
        { title: 'الإحصائيات', desc: 'عرض إحصائيات النظام والإيرادات' },
        { title: 'الأمان', desc: 'صلاحيات متقدمة للمسؤولين فقط' },
      ],
      adminNote: 'ملاحظة: لوحة تحكم المسؤول متاحة فقط لـ: المدير العام، المدير التنفيذي (CEO)، رئيس مجلس الإدارة',
      
      // Section 8: Permissions
      permissionsTitle: 'نظام الصلاحيات',
      permissionsDesc: 'تحكم دقيق في صلاحيات كل مستخدم',
      availablePermissions: 'الصلاحيات المتاحة',
      permissionsList: [
        { name: 'لوحة التحكم', required: true },
        { name: 'الموارد البشرية', required: false },
        { name: 'الإدارة المالية', required: false },
        { name: 'الفواتير', required: false },
        { name: 'المشتريات', required: false },
        { name: 'المشاريع', required: false },
        { name: 'التحليلات', required: false },
        { name: 'الإعدادات', required: false },
        { name: 'إدارة المستخدمين', required: false },
        { name: 'الموافقات', required: false },
      ],
      displayMethod: 'طريقة العرض',
      greenColor: 'اللون الأخضر',
      greenDesc: 'صلاحية متاحة للمستخدم',
      redColor: 'اللون الأحمر',
      redDesc: 'صلاحية غير متاحة للمستخدم',
      required: 'إلزامي',
      
      // Section 9: How to Use
      howtoBadge: 'دليل الاستخدام',
      howtoTitle: 'طريقة تشغيل النظام',
      steps: [
        {
          title: 'تسجيل الشركة',
          desc: 'قم بتسجيل شركتك من خلال صفحة التسجيل مع إدخال بيانات الشركة والمستخدم الرئيسي',
          details: ['أدخل اسم الشركة ونوع النشاط', 'أدخل بيانات المستخدم الرئيسي (المدير العام)', 'اختر كلمة مرور قوية', 'ستحصل على كود اشتراك فريد']
        },
        {
          title: 'تسجيل الدخول',
          desc: 'سجل دخولك باستخدام البريد الإلكتروني وكلمة المرور',
          details: ['أدخل البريد الإلكتروني المسجل', 'أدخل كلمة المرور', 'سيظهر كود الاشتراك بعد الدخول', 'احتفظ بكود الاشتراك في مكان آمن']
        },
        {
          title: 'إضافة المستخدمين',
          desc: 'أضف مستخدمين جدد وحدد صلاحياتهم',
          details: ['اذهب إلى إدارة المستخدمين', 'أضف مستخدم جديد مع تحديد الدور', 'حدد الصلاحيات المناسبة لكل مستخدم', 'أرسل دعوة للمستخدم عبر البريد الإلكتروني']
        },
        {
          title: 'إدخال البيانات الأساسية',
          desc: 'أدخل بيانات الموظفين والعملاء والموردين',
          details: ['أضف بيانات الموظفين في وحدة الموارد البشرية', 'أضف العملاء والموردين في الوحدة المالية', 'أنشئ دليل الحسابات المناسب لشركتك', 'حدد إعدادات الرواتب والبدلات']
        },
        {
          title: 'البدء بالعمل اليومي',
          desc: 'استخدم النظام للعمليات اليومية',
          details: ['سجل الحضور والانصراف يومياً', 'أنشئ الفواتير وأوامر الشراء', 'تابع المشاريع والمهام', 'استخرج التقارير المطلوبة']
        },
      ],
      
      // Section 10: Technical
      techBadge: 'المواصفات التقنية',
      techTitle: 'البنية التقنية للنظام',
      techSpecs: [
        { title: 'الواجهة الأمامية', desc: 'React.js مع Tailwind CSS', tech: 'Frontend' },
        { title: 'الخادم', desc: 'Python FastAPI', tech: 'Backend' },
        { title: 'قاعدة البيانات', desc: 'MongoDB Atlas', tech: 'Database' },
        { title: 'الاستضافة', desc: 'سحابية مع SSL', tech: 'Hosting' },
      ],
      techFeatures: [
        'تشفير SSL/TLS لجميع الاتصالات',
        'نسخ احتياطي يومي تلقائي',
        'متوافق مع جميع المتصفحات',
        'تصميم متجاوب للجوال',
        'دعم RTL للعربية',
        'تحديثات مستمرة ومجانية'
      ],
      
      // CTA
      ctaTitle: 'جاهز للبدء؟',
      ctaDesc: 'انضم إلى مئات الشركات التي تستخدم DataLife ERP لإدارة أعمالها بكفاءة',
      registerNow: 'سجل شركتك الآن',
      tryDemo: 'جرب النسخة التجريبية',
      
      // Footer
      copyright: 'جميع الحقوق محفوظة © 2025 DataLife ERP',
    },
    en: {
      // Header
      systemName: 'Enterprise Resource Management System',
      backToHome: 'Back to Home',
      login: 'Sign In',
      
      // Hero
      badge: 'Complete Guide',
      heroTitle: 'DataLife ERP Features Guide',
      heroDesc: 'A comprehensive enterprise resource management system supporting Arabic and English, designed specifically to meet the needs of businesses',
      bilingual: 'Bilingual Support',
      cloudBased: '100% Cloud-Based',
      advancedSecurity: 'Advanced Security',
      
      // Quick Navigation
      quickNav: 'Quick Navigation',
      navItems: {
        overview: 'Overview',
        modules: 'Main Modules',
        hr: 'Human Resources',
        finance: 'Financial Management',
        projects: 'Projects',
        reports: 'Reports',
        admin: 'Admin Panel',
        howto: 'How to Use',
      },
      
      // Section 1: Overview
      overviewBadge: 'Introduction',
      overviewTitle: 'System Overview',
      overviewDesc: 'DataLife ERP is a comprehensive enterprise resource management system, designed with the latest technologies to provide complete solutions for businesses',
      overviewCards: [
        { title: 'Multi-Company', desc: 'Manage multiple companies from one account with complete data separation' },
        { title: 'Multi-User', desc: 'Custom permissions for each user based on their role' },
        { title: 'Bilingual', desc: 'Full support for Arabic and English with RTL interface' },
        { title: 'Secure Cloud', desc: 'Access from anywhere with advanced data protection' },
      ],
      
      // Section 2: Modules
      modulesBadge: 'Modules',
      modulesTitle: 'Main System Modules',
      modulesData: [
        { 
          title: 'Human Resources Management', 
          features: ['Employee data management', 'Payroll system', 'Attendance tracking', 'Leave management', 'Advanced HR reports']
        },
        { 
          title: 'Financial Management', 
          features: ['Chart of accounts', 'Journal entries', 'Balance sheet', 'Income statement', 'Financial reports']
        },
        { 
          title: 'Invoices & Sales', 
          features: ['Invoice creation', 'Customer management', 'Payment tracking', 'Sales reports', 'Recurring invoices']
        },
        { 
          title: 'Purchases Management', 
          features: ['Purchase orders', 'Supplier management', 'Order tracking', 'Purchase reports', 'Inventory management']
        },
        { 
          title: 'Project Management', 
          features: ['Create projects', 'Task management', 'Progress tracking', 'Timeline', 'Team management']
        },
        { 
          title: 'Analytics & Reports', 
          features: ['Dashboards', 'Interactive reports', 'PDF/CSV export', 'Charts', 'KPIs']
        },
      ],
      
      // Section 3: HR
      hrTitle: 'Human Resources Module',
      hrDesc: 'Comprehensive management of employees, payroll, and attendance',
      employeeMgmt: 'Employee Management',
      employeeFeatures: [
        'Add and edit employee data',
        'Upload employee photos and documents',
        'Track employment history',
        'Manage departments',
        'Employee ID cards',
        'Personal and professional records',
      ],
      salarySystem: 'Payroll System',
      salaryFeatures: [
        'Automatic monthly salary calculation',
        'Manage allowances and bonuses',
        'Calculate deductions',
        'Detailed salary reports',
        'Payslips',
        'Export salary data',
      ],
      attendance: 'Attendance & Time',
      attendanceFeatures: [
        'Record attendance',
        'Calculate overtime hours',
        'Track tardiness and absences',
        'Monthly attendance reports',
        'Biometric device integration',
        'Custom work calendar',
      ],
      leaves: 'Leave Management',
      leaveFeatures: [
        'Electronic leave requests',
        'Multiple leave types',
        'Automatic leave balance',
        'Leave approvals',
        'Annual leave reports',
        'Leave notifications',
      ],
      
      // Section 4: Finance
      financeTitle: 'Financial Management Module',
      financeDesc: 'Comprehensive accounting system for financial management',
      financeModules: [
        { title: 'Chart of Accounts', items: ['Multi-level account tree', 'Different account types', 'Opening balances', 'Account classification'] },
        { title: 'Journal Entries', items: ['Daily entries', 'Automatic entries', 'Adjustment entries', 'Entry review'] },
        { title: 'Financial Reports', items: ['Balance sheet', 'Income statement', 'Cash flows', 'Trial balance'] },
        { title: 'Customer Management', items: ['Customer records', 'Customer statements', 'Aging receivables', 'Collection follow-up'] },
        { title: 'Supplier Management', items: ['Supplier records', 'Supplier statements', 'Payables', 'Supplier reports'] },
        { title: 'Invoices', items: ['Sales invoices', 'Purchase invoices', 'Credit/debit notes', 'Invoice reports'] },
      ],
      
      // Section 5: Projects
      projectsTitle: 'Project Management Module',
      projectsDesc: 'Efficient project planning, execution, and tracking',
      projectMgmt: 'Project Management',
      projectFeatures: [
        'Create new projects with full details',
        'Set budget and timeline',
        'Assign project manager and team',
        'Track project status (in progress/completed/on hold)',
        'Automatic progress percentage',
        'Key Performance Indicators (KPIs)',
      ],
      taskMgmt: 'Task Management',
      taskFeatures: [
        'Create and assign tasks to employees',
        'Set priorities (urgent/high/medium/low)',
        'Start and end dates',
        'Task comments and notes',
        'Automatic task notifications',
        'Team productivity reports',
      ],
      
      // Section 6: Reports
      reportsBadge: 'Reports',
      reportsTitle: 'Reports & Export',
      reportsDesc: 'Advanced reporting system with printing and multi-format export capabilities',
      printing: 'Printing',
      printingDesc: 'Print reports directly in professional format without menus',
      pdfExport: 'PDF Export',
      pdfExportDesc: 'Export reports in PDF format for archiving and sharing',
      excelExport: 'Excel Export',
      excelExportDesc: 'Export data in CSV format for Excel analysis',
      reportTypes: 'Available Report Types',
      reportList: [
        'Employee reports', 'Salary reports', 'Attendance reports', 'Leave reports',
        'Financial reports', 'Sales reports', 'Purchase reports', 'Inventory reports',
        'Project reports', 'Task reports', 'Performance reports', 'Custom reports'
      ],
      
      // Section 7: Admin
      adminTitle: 'Admin Control Panel',
      adminDesc: 'Comprehensive management of system, companies, and users',
      adminCards: [
        { title: 'Company Management', desc: 'View all registered companies and enable/disable them' },
        { title: 'User Management', desc: 'Control users and their permissions' },
        { title: 'Activation Codes', desc: 'Create and manage subscription codes' },
        { title: 'Notifications', desc: 'Send notifications to companies and users' },
        { title: 'Statistics', desc: 'View system statistics and revenue' },
        { title: 'Security', desc: 'Advanced permissions for admins only' },
      ],
      adminNote: 'Note: Admin control panel is only available to: General Manager, CEO, Board Chairman',
      
      // Section 8: Permissions
      permissionsTitle: 'Permissions System',
      permissionsDesc: 'Precise control over each user\'s permissions',
      availablePermissions: 'Available Permissions',
      permissionsList: [
        { name: 'Dashboard', required: true },
        { name: 'Human Resources', required: false },
        { name: 'Financial Management', required: false },
        { name: 'Invoices', required: false },
        { name: 'Purchases', required: false },
        { name: 'Projects', required: false },
        { name: 'Analytics', required: false },
        { name: 'Settings', required: false },
        { name: 'User Management', required: false },
        { name: 'Approvals', required: false },
      ],
      displayMethod: 'Display Method',
      greenColor: 'Green Color',
      greenDesc: 'Permission available to user',
      redColor: 'Red Color',
      redDesc: 'Permission not available to user',
      required: 'Required',
      
      // Section 9: How to Use
      howtoBadge: 'User Guide',
      howtoTitle: 'How to Operate the System',
      steps: [
        {
          title: 'Register Company',
          desc: 'Register your company through the registration page with company and main user details',
          details: ['Enter company name and business type', 'Enter main user details (General Manager)', 'Choose a strong password', 'You will receive a unique subscription code']
        },
        {
          title: 'Sign In',
          desc: 'Log in using your email and password',
          details: ['Enter registered email', 'Enter password', 'Subscription code will appear after login', 'Keep subscription code in a safe place']
        },
        {
          title: 'Add Users',
          desc: 'Add new users and set their permissions',
          details: ['Go to User Management', 'Add new user with role', 'Set appropriate permissions for each user', 'Send invitation via email']
        },
        {
          title: 'Enter Basic Data',
          desc: 'Enter employee, customer, and supplier data',
          details: ['Add employee data in HR module', 'Add customers and suppliers in Financial module', 'Create chart of accounts suitable for your company', 'Set salary and allowance settings']
        },
        {
          title: 'Start Daily Operations',
          desc: 'Use the system for daily operations',
          details: ['Record daily attendance', 'Create invoices and purchase orders', 'Track projects and tasks', 'Generate required reports']
        },
      ],
      
      // Section 10: Technical
      techBadge: 'Technical Specifications',
      techTitle: 'System Technical Architecture',
      techSpecs: [
        { title: 'Frontend', desc: 'React.js with Tailwind CSS', tech: 'Frontend' },
        { title: 'Server', desc: 'Python FastAPI', tech: 'Backend' },
        { title: 'Database', desc: 'MongoDB Atlas', tech: 'Database' },
        { title: 'Hosting', desc: 'Cloud with SSL', tech: 'Hosting' },
      ],
      techFeatures: [
        'SSL/TLS encryption for all connections',
        'Automatic daily backup',
        'Compatible with all browsers',
        'Mobile responsive design',
        'RTL support for Arabic',
        'Continuous free updates'
      ],
      
      // CTA
      ctaTitle: 'Ready to Start?',
      ctaDesc: 'Join hundreds of companies using DataLife ERP to manage their business efficiently',
      registerNow: 'Register Your Company Now',
      tryDemo: 'Try Demo Version',
      
      // Footer
      copyright: 'All Rights Reserved © 2025 DataLife ERP',
    }
  };

  const content = t[pageLang];

  const moduleIcons = [Users, DollarSign, FileText, Package, FolderKanban, BarChart3];
  const moduleColors = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-emerald-600',
    'from-purple-500 to-violet-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-teal-600'
  ];
  const adminIcons = [Building2, Users, CreditCard, Bell, BarChart3, Lock];
  const techIcons = [Monitor, Database, Layers, Cloud];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="DataLife" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold text-[#1e3a5f]">DataLife ERP</h1>
                <p className="text-sm text-gray-500">{content.systemName}</p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {/* Language Toggle Button */}
              <Button 
                variant="outline" 
                onClick={toggleLanguage}
                className="flex items-center gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <Languages className="h-4 w-4" />
                {pageLang === 'ar' ? 'English' : 'العربية'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                {content.backToHome}
              </Button>
              <Button onClick={() => navigate('/login')} className="bg-[#1e3a5f]">
                {content.login}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a87] text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="bg-amber-500 text-white mb-4">{content.badge}</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {content.heroTitle}
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-8">
            {content.heroDesc}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <Globe className="h-5 w-5" />
              <span>{content.bilingual}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <Cloud className="h-5 w-5" />
              <span>{content.cloudBased}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <Shield className="h-5 w-5" />
              <span>{content.advancedSecurity}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-8 bg-white border-b">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold text-center mb-6 text-gray-700">{content.quickNav}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { id: 'overview', label: content.navItems.overview, icon: BookOpen },
              { id: 'modules', label: content.navItems.modules, icon: Layers },
              { id: 'hr', label: content.navItems.hr, icon: Users },
              { id: 'finance', label: content.navItems.finance, icon: DollarSign },
              { id: 'projects', label: content.navItems.projects, icon: FolderKanban },
              { id: 'reports', label: content.navItems.reports, icon: BarChart3 },
              { id: 'admin', label: content.navItems.admin, icon: Shield },
              { id: 'howto', label: content.navItems.howto, icon: Play },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-blue-100 rounded-full transition-colors"
              >
                <item.icon className="h-4 w-4 text-[#1e3a5f]" />
                <span className="text-sm font-medium">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 space-y-16">
        
        {/* Section 1: Overview */}
        <section id="overview" className="scroll-mt-24">
          <div className="text-center mb-10">
            <Badge className="bg-blue-100 text-blue-800 mb-3">{content.overviewBadge}</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.overviewTitle}</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {content.overviewDesc}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[Building2, Users, Languages, Cloud].map((Icon, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{content.overviewCards[idx].title}</h3>
                  <p className="text-gray-600 text-sm">{content.overviewCards[idx].desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 2: Main Modules */}
        <section id="modules" className="scroll-mt-24">
          <div className="text-center mb-10">
            <Badge className="bg-green-100 text-green-800 mb-3">{content.modulesBadge}</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.modulesTitle}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.modulesData.map((module, idx) => {
              const Icon = moduleIcons[idx];
              return (
                <Card key={idx} className="hover:shadow-xl transition-all duration-300 overflow-hidden group">
                  <CardHeader className={`bg-gradient-to-r ${moduleColors[idx]} text-white`}>
                    <CardTitle className="flex items-center gap-3">
                      <Icon className="h-6 w-6" />
                      {module.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-2">
                      {module.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-gray-700">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Section 3: HR Module Details */}
        <section id="hr" className="scroll-mt-24 bg-white rounded-3xl p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{content.hrTitle}</h2>
              <p className="text-gray-600">{content.hrDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Employees Management */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#1e3a5f]">
                <UserCheck className="h-5 w-5" />
                {content.employeeMgmt}
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {content.employeeFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Salaries */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#1e3a5f]">
                <DollarSign className="h-5 w-5" />
                {content.salarySystem}
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {content.salaryFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#1e3a5f]">
                <Clock className="h-5 w-5" />
                {content.attendance}
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {content.attendanceFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leaves */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#1e3a5f]">
                <Calendar className="h-5 w-5" />
                {content.leaves}
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {content.leaveFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Finance Module Details */}
        <section id="finance" className="scroll-mt-24 bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{content.financeTitle}</h2>
              <p className="text-gray-600">{content.financeDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {content.financeModules.map((section, idx) => {
              const icons = [Layers, FileText, PieChart, Users, Package, Receipt];
              const Icon = icons[idx];
              return (
                <Card key={idx} className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 text-green-600" />
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Section 5: Projects Module */}
        <section id="projects" className="scroll-mt-24 bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center">
              <FolderKanban className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{content.projectsTitle}</h2>
              <p className="text-gray-600">{content.projectsDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-pink-600" />
                {content.projectMgmt}
              </h3>
              <ul className="space-y-3">
                {content.projectFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-pink-600" />
                {content.taskMgmt}
              </h3>
              <ul className="space-y-3">
                {content.taskFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: Reports & Export */}
        <section id="reports" className="scroll-mt-24">
          <div className="text-center mb-10">
            <Badge className="bg-cyan-100 text-cyan-800 mb-3">{content.reportsBadge}</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.reportsTitle}</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {content.reportsDesc}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6 text-center">
                <Printer className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">{content.printing}</h3>
                <p className="text-blue-100">{content.printingDesc}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">{content.pdfExport}</h3>
                <p className="text-red-100">{content.pdfExportDesc}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6 text-center">
                <Download className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">{content.excelExport}</h3>
                <p className="text-green-100">{content.excelExportDesc}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">{content.reportTypes}</h3>
            <div className="grid md:grid-cols-4 gap-4">
              {content.reportList.map((report, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <FileSearch className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{report}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7: Admin Panel */}
        <section id="admin" className="scroll-mt-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">{content.adminTitle}</h2>
              <p className="text-gray-400">{content.adminDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.adminCards.map((item, idx) => {
              const Icon = adminIcons[idx];
              return (
                <div key={idx} className="bg-white/10 backdrop-blur rounded-xl p-5">
                  <Icon className="h-8 w-8 text-amber-400 mb-3" />
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-amber-500/20 rounded-xl border border-amber-500/30">
            <p className="text-amber-200 text-sm">
              <strong>{pageLang === 'ar' ? 'ملاحظة:' : 'Note:'}</strong> {content.adminNote}
            </p>
          </div>
        </section>

        {/* Section 8: Permissions System */}
        <section className="bg-white rounded-3xl p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{content.permissionsTitle}</h2>
              <p className="text-gray-600">{content.permissionsDesc}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">{content.availablePermissions}</h3>
              <div className="grid grid-cols-2 gap-3">
                {content.permissionsList.map((perm, i) => (
                  <div key={i} className={`flex items-center gap-2 p-3 rounded-lg ${perm.required ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <CheckCircle className={`h-4 w-4 ${perm.required ? 'text-green-600' : 'text-gray-500'}`} />
                    <span className="text-sm">{perm.name}</span>
                    {perm.required && <Badge className="bg-green-500 text-white text-xs">{content.required}</Badge>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">{content.displayMethod}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-800">{content.greenColor}</p>
                    <p className="text-green-600 text-sm">{content.greenDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-red-800">{content.redColor}</p>
                    <p className="text-red-600 text-sm">{content.redDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: How to Use */}
        <section id="howto" className="scroll-mt-24">
          <div className="text-center mb-10">
            <Badge className="bg-amber-100 text-amber-800 mb-3">{content.howtoBadge}</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.howtoTitle}</h2>
          </div>

          <div className="space-y-6">
            {content.steps.map((item, stepIdx) => (
              <Card key={stepIdx} className="overflow-hidden">
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection(stepIdx + 1)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {stepIdx + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{item.title}</h3>
                        <p className="text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                    {expandedSection === stepIdx + 1 ? 
                      <ChevronUp className="h-6 w-6 text-gray-400" /> : 
                      <ChevronDown className="h-6 w-6 text-gray-400" />
                    }
                  </div>
                </div>
                {expandedSection === stepIdx + 1 && (
                  <div className="px-6 pb-6 pt-0">
                    <div className={`${isRTL ? 'mr-16' : 'ml-16'} bg-blue-50 rounded-xl p-4`}>
                      <ul className="space-y-2">
                        {item.details.map((detail, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                              {i + 1}
                            </div>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Section 10: Technical Specs */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white">
          <div className="text-center mb-10">
            <Badge className="bg-gray-700 text-white mb-3">{content.techBadge}</Badge>
            <h2 className="text-3xl font-bold mb-4">{content.techTitle}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.techSpecs.map((item, idx) => {
              const Icon = techIcons[idx];
              return (
                <div key={idx} className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-8 w-8 text-blue-400" />
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-300 mb-2">{item.tech}</Badge>
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {content.techFeatures.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4">{content.ctaTitle}</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            {content.ctaDesc}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button size="lg" onClick={() => navigate('/register')} className="bg-[#1e3a5f] hover:bg-[#2d5a87]">
              <Star className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {content.registerNow}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/demo')}>
              <Play className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {content.tryDemo}
            </Button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <img src="/logo.png" alt="DataLife" className="h-10 mx-auto mb-4 brightness-0 invert" />
          <p className="text-gray-400">{content.copyright}</p>
        </div>
      </footer>
    </div>
  );
};

export default FeaturesPage;
