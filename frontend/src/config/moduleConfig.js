/**
 * Module Configuration
 * تكوين الوحدات المتاحة لكل دور
 */

import { 
  Shield, Home, Users, Calculator, FileText, FolderKanban, 
  BarChart, Settings, Upload, Book, Building2, Bell, ShoppingCart,
  TrendingUp
} from 'lucide-react';

// Role categories
export const ROLE_CATEGORIES = {
  SUPER_ADMIN: ['Super Admin', 'مدير النظام'],
  TOP_MANAGEMENT: ['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'],
  HR_ONLY: ['HR Manager', 'مدير الموارد البشرية'],
  FINANCIAL_MANAGER: ['Financial Manager', 'Chief Accountant', 'المدير المالي', 'رئيس الحسابات'],
  EXECUTIVE: ['Employee', 'موظف', 'Accountant', 'محاسب'],
  PROJECT_ONLY: ['Project Manager', 'مدير المشاريع']
};

// Helper function to check role
export const hasRole = (userRole, roleCategory) => {
  return ROLE_CATEGORIES[roleCategory]?.includes(userRole) || false;
};

// Helper function to check any of roles
export const hasAnyRole = (userRole, roleCategories) => {
  return roleCategories.some(cat => hasRole(userRole, cat));
};

/**
 * Get available modules based on user role and permissions
 */
export const getAvailableModules = (user, language) => {
  const role = user?.role;
  const permissions = user?.permissions || [];
  const modules = [];
  const isArabic = language === 'ar';

  const hasFullAccess = hasAnyRole(role, ['TOP_MANAGEMENT', 'SUPER_ADMIN']);

  // ── 1. Super Admin ────────────────────────────────────────
  if (hasRole(role, 'SUPER_ADMIN')) {
    modules.push({
      id: 'super-admin',
      name: isArabic ? '🛡️ إدارة المنصة' : '🛡️ Platform Admin',
      icon: <Shield />
    });
  }

  // ── 2. Dashboard ──────────────────────────────────────────
  modules.push({
    id: 'dashboard',
    name: isArabic ? 'الرئيسية' : 'Dashboard',
    icon: <Home />
  });

  // ── 3. HR ──────────────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'HR_ONLY') || hasRole(role, 'FINANCIAL_MANAGER') ||
      permissions.includes('hr') || permissions.includes('hr_admin') || permissions.includes('hr_financial')) {
    modules.push({
      id: 'hr',
      name: isArabic ? 'الموارد البشرية' : 'Human Resources',
      icon: <Users />,
      hasSubModules: true,
      subModules: getHRSubModules(isArabic)
    });
  }

  // ── 4. Financial ───────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || hasRole(role, 'EXECUTIVE') ||
      permissions.includes('financial')) {
    modules.push({
      id: 'financial',
      name: isArabic ? 'الإدارة المالية' : 'Financial Management',
      icon: <Calculator />,
      hasSubModules: true,
      subModules: getFinancialSubModules(isArabic)
    });
  }

  // ── 5. Sales CRM ───────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') ||
      permissions.includes('sales') || permissions.includes('invoices')) {
    modules.push({
      id: 'sales',
      name: isArabic ? 'المبيعات CRM' : 'Sales & CRM',
      icon: <TrendingUp />
    });
  }

  // ── 6. Invoices ────────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || permissions.includes('invoices')) {
    modules.push({
      id: 'invoices',
      name: isArabic ? 'الفواتير الإلكترونية' : 'E-Invoicing',
      icon: <FileText />,
      hasSubModules: true,
      subModules: getInvoiceSubModules(isArabic)
    });
  }

  // ── 7. Purchases ───────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || permissions.includes('purchases')) {
    modules.push({
      id: 'purchases',
      name: isArabic ? 'المشتريات' : 'Purchases',
      icon: <ShoppingCart />
    });
  }

  // ── 8. Projects ────────────────────────────────────────────
  if (hasFullAccess || hasRole(role, 'PROJECT_ONLY') || permissions.includes('projects')) {
    modules.push({
      id: 'projects',
      name: isArabic ? 'المشاريع' : 'Projects',
      icon: <FolderKanban />
    });
  }

  // ── 9. Assets & Taxes ─────────────────────────────────────
  if (hasFullAccess || permissions.includes('financial')) {
    modules.push({
      id: 'assets',
      name: isArabic ? 'الأصول والضرائب' : 'Assets & Taxes',
      icon: <Building2 />
    });
  }

  // ── 10. Analytics & Reports ────────────────────────────────
  if (hasFullAccess || permissions.includes('analytics') || permissions.includes('reports')) {
    modules.push({
      id: 'analytics',
      name: isArabic ? 'التقارير والتحليلات' : 'Reports & Analytics',
      icon: <BarChart />
    });
  }

  // ── 11. Approvals ──────────────────────────────────────────
  if (hasFullAccess || permissions.includes('approvals')) {
    modules.push({
      id: 'approvals',
      name: isArabic ? 'الموافقات' : 'Approvals',
      icon: <Users />
    });
  }

  // ── 12. Import Data ────────────────────────────────────────
  if (hasFullAccess || permissions.includes('settings') || permissions.includes('admin')) {
    modules.push({
      id: 'import',
      name: isArabic ? 'استيراد البيانات' : 'Import Data',
      icon: <Upload />
    });
  }

  // ── 13. Settings ───────────────────────────────────────────
  if (hasFullAccess || permissions.includes('settings')) {
    modules.push({
      id: 'settings',
      name: isArabic ? 'الإعدادات' : 'Settings',
      icon: <Settings />
    });
  }

  // ── 14. User Guide (always shown) ─────────────────────────
  modules.push({
    id: 'user-guide',
    name: isArabic ? 'دليل الاستخدام' : 'User Guide',
    icon: <Book />
  });

  return modules;
};

/**
 * HR Sub-modules
 */
export const getHRSubModules = (isArabic) => [
  { id: 'overview',      name: isArabic ? '🏠 نظرة عامة'         : '🏠 Overview' },
  { id: 'employees',     name: isArabic ? '👥 الموظفون'           : '👥 Employees' },
  { id: 'salaries',      name: isArabic ? '💵 الرواتب'            : '💵 Salaries' },
  { id: 'payroll',       name: isArabic ? '📋 كشف المرتبات'       : '📋 Payroll' },
  { id: 'allowances',    name: isArabic ? '➕ البدلات'            : '➕ Allowances' },
  { id: 'deductions',    name: isArabic ? '➖ الخصومات'           : '➖ Deductions' },
  { id: 'attendance',    name: isArabic ? '⏰ الحضور والانصراف'   : '⏰ Attendance' },
  { id: 'shifts',        name: isArabic ? '🔄 الورديات'           : '🔄 Shifts' },
  { id: 'casual-leave',  name: isArabic ? '🌴 إجازة عارضة'        : '🌴 Casual Leave' },
  { id: 'annual-leave',  name: isArabic ? '📅 إجازة سنوية'        : '📅 Annual Leave' },
  { id: 'termination',   name: isArabic ? '🔚 إنهاء الخدمة'       : '🔚 End of Service' },
  { id: 'reports',       name: isArabic ? '📊 تقارير HR'          : '📊 HR Reports' },
];

/**
 * Financial Sub-modules
 */
export const getFinancialSubModules = (isArabic) => [
  { id: 'overview',         name: isArabic ? '🏠 نظرة عامة'        : '🏠 Overview' },
  { id: 'journal-entries',  name: isArabic ? '📝 القيود اليومية'    : '📝 Journal Entries' },
  { id: 'general-ledger',   name: isArabic ? '📒 دفتر الأستاذ'      : '📒 General Ledger' },
  { id: 'trial-balance',    name: isArabic ? '⚖️ ميزان المراجعة'    : '⚖️ Trial Balance' },
  { id: 'income-statement', name: isArabic ? '📈 قائمة الدخل'       : '📈 Income Statement' },
  { id: 'balance-sheet',    name: isArabic ? '🏦 الميزانية العمومية' : '🏦 Balance Sheet' },
  { id: 'parties',          name: isArabic ? '🤝 العملاء والموردين' : '🤝 Parties' },
  { id: 'products',         name: isArabic ? '📦 المنتجات'          : '📦 Products' },
  { id: 'inventory',        name: isArabic ? '🗄️ المخزون'           : '🗄️ Inventory' },
  { id: 'bank',             name: isArabic ? '🏧 البنوك والخزائن'    : '🏧 Banks & Cash' },
  { id: 'currencies',       name: isArabic ? '💱 العملات'           : '💱 Currencies' },
  { id: 'reports',          name: isArabic ? '📊 التقارير المالية'  : '📊 Financial Reports' },
];

/**
 * Invoice Sub-modules
 */
export const getInvoiceSubModules = (isArabic) => [
  { id: 'overview',     name: isArabic ? '🏠 نظرة عامة'         : '🏠 Overview' },
  { id: 'invoices',     name: isArabic ? '📄 الفواتير'           : '📄 Invoices' },
  { id: 'reports',      name: isArabic ? '📊 التقارير'           : '📊 Reports' },
  { id: 'eta-settings', name: isArabic ? '⚙️ إعدادات ETA'        : '⚙️ ETA Settings' },
];
