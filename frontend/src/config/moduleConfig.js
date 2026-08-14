/**
 * Module Configuration
 * تكوين الوحدات المتاحة لكل دور
 */

import { 
  Shield, Home, Users, Calculator, FileText, FolderKanban, 
  BarChart, Settings, Upload, Book, Building2, Bell, ShoppingCart
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

  // Super Admin Dashboard
  if (hasRole(role, 'SUPER_ADMIN')) {
    modules.push({ 
      id: 'super-admin', 
      name: isArabic ? 'إدارة المنصة' : 'Platform Admin', 
      icon: <Shield /> 
    });
  }

  // Dashboard - available to all
  modules.push({ 
    id: 'dashboard', 
    name: isArabic ? 'لوحة التحكم' : 'Dashboard', 
    icon: <Home /> 
  });

  // Full access roles
  const hasFullAccess = hasAnyRole(role, ['TOP_MANAGEMENT', 'SUPER_ADMIN']);
  
  // HR Module - check hr, hr_admin, or hr_financial
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

  // Financial Module
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || hasRole(role, 'EXECUTIVE') || permissions.includes('financial')) {
    modules.push({
      id: 'financial',
      name: isArabic ? 'الإدارة المالية' : 'Financial Management',
      icon: <Calculator />,
      hasSubModules: true,
      subModules: getFinancialSubModules(isArabic)
    });
  }

  // Invoices Module
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || permissions.includes('invoices')) {
    modules.push({
      id: 'invoices',
      name: isArabic ? 'الفواتير' : 'Invoices',
      icon: <FileText />,
      hasSubModules: true,
      subModules: getInvoiceSubModules(isArabic)
    });
  }

  // Sales Module
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || hasRole(role, 'SALES') || permissions.includes('sales') || permissions.includes('invoices')) {
    modules.push({
      id: 'sales',
      name: isArabic ? 'المبيعات CRM' : 'Sales CRM',
      icon: <TrendingUp />,
    });
  }

  // Purchases Module
  if (hasFullAccess || hasRole(role, 'FINANCIAL_MANAGER') || permissions.includes('purchases')) {
    modules.push({
      id: 'purchases',
      name: isArabic ? 'المشتريات' : 'Purchases',
      icon: <ShoppingCart />
    });
  }

  // Projects Module
  if (hasFullAccess || hasRole(role, 'PROJECT_ONLY') || permissions.includes('projects')) {
    modules.push({
      id: 'projects',
      name: isArabic ? 'المشاريع' : 'Projects',
      icon: <FolderKanban />
    });
  }

  // Analytics Module
  if (hasFullAccess || permissions.includes('analytics') || permissions.includes('reports')) {
    modules.push({
      id: 'analytics',
      name: isArabic ? 'التحليلات والتقارير' : 'Analytics & Reports',
      icon: <BarChart />
    });
  }

  // Approvals Module
  if (hasFullAccess || permissions.includes('approvals')) {
    modules.push({
      id: 'approvals',
      name: isArabic ? 'الموافقات' : 'Approvals',
      icon: <FileText />
    });
  }

  // Assets & Tax Module
  if (hasFullAccess || permissions.includes('financial')) {
    modules.push({
      id: 'assets',
      name: isArabic ? 'الأصول والضرائب' : 'Assets & Taxes',
      icon: <Building2 />
    });
  }

  // Import Data Module
  if (hasFullAccess || permissions.includes('settings') || permissions.includes('admin')) {
    modules.push({
      id: 'import',
      name: isArabic ? 'استيراد البيانات' : 'Import Data',
      icon: <Upload />
    });
  }

  // Settings Module
  if (hasFullAccess || permissions.includes('settings')) {
    modules.push({
      id: 'settings',
      name: isArabic ? 'الإعدادات' : 'Settings',
      icon: <Settings />
    });
  }

  // User Guide Module
  modules.push({
    id: 'user-guide',
    name: isArabic ? 'دليل المستخدم' : 'User Guide',
    icon: <Book />
  });

  return modules;
};

/**
 * HR Sub-modules
 */
export const getHRSubModules = (isArabic) => [
  { id: 'overview', name: isArabic ? 'نظرة عامة' : 'Overview' },
  { id: 'payroll', name: isArabic ? 'كشف المرتبات' : 'Payroll' },
  { id: 'salaries', name: isArabic ? 'الرواتب' : 'Salaries' },
  { id: 'allowances', name: isArabic ? 'البدلات' : 'Allowances' },
  { id: 'deductions', name: isArabic ? 'الخصومات' : 'Deductions' },
  { id: 'attendance', name: isArabic ? 'الحضور' : 'Attendance' },
  { id: 'shifts', name: isArabic ? 'الورديات' : 'Shifts' },
  { id: 'casual-leave', name: isArabic ? 'الإجازات العارضة' : 'Casual Leave' },
  { id: 'annual-leave', name: isArabic ? 'الإجازات السنوية' : 'Annual Leave' },
  { id: 'termination', name: isArabic ? 'إنهاء الخدمة' : 'Termination' },
  { id: 'reports', name: isArabic ? 'التقارير' : 'Reports' },
  { id: 'hr-settings', name: isArabic ? 'الإعدادات' : 'Settings' }
];

/**
 * Financial Sub-modules
 */
export const getFinancialSubModules = (isArabic) => [
  { id: 'overview', name: isArabic ? 'نظرة عامة' : 'Overview' },
  { id: 'journal-entries', name: isArabic ? 'القيود اليومية' : 'Journal Entries' },
  { id: 'general-ledger', name: isArabic ? 'دفتر الأستاذ' : 'General Ledger' },
  { id: 'parties', name: isArabic ? 'العملاء والموردين' : 'Parties' },
  { id: 'products', name: isArabic ? 'المنتجات' : 'Products' },
  { id: 'currencies', name: isArabic ? 'العملات' : 'Currencies' },
  { id: 'inventory', name: isArabic ? 'المخزون' : 'Inventory' },
  { id: 'bank', name: isArabic ? 'البنوك' : 'Banks' },
  { id: 'bank-settings', name: isArabic ? 'إعدادات البنوك' : 'Bank Settings' },
  { id: 'trial-balance', name: isArabic ? 'ميزان المراجعة' : 'Trial Balance' },
  { id: 'income-statement', name: isArabic ? 'قائمة الدخل' : 'Income Statement' },
  { id: 'balance-sheet', name: isArabic ? 'الميزانية' : 'Balance Sheet' },
  { id: 'reports', name: isArabic ? 'التقارير المالية' : 'Financial Reports' }
];

/**
 * Invoice Sub-modules
 */
export const getInvoiceSubModules = (isArabic) => [
  { id: 'overview', name: isArabic ? 'نظرة عامة' : 'Overview' },
  { id: 'invoices', name: isArabic ? 'الفواتير' : 'Invoices' },
  { id: 'reports', name: isArabic ? 'التقارير' : 'Reports' },
  { id: 'eta-settings', name: isArabic ? 'إعدادات ETA' : 'ETA Settings' }
];
