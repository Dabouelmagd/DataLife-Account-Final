// Settings module constants - re-exported from PermissionsContext
// This file provides backward compatibility while using the unified permissions system

// Static fallback for cases where context is not available
export const getAvailableRoles = (language) => [
  { value: 'رئيس مجلس الإدارة', label: language === 'ar' ? 'رئيس مجلس الإدارة' : 'Board Chairman' },
  { value: 'مدير عام', label: language === 'ar' ? 'المدير العام' : 'General Manager' },
  { value: 'المدير التنفيذي', label: language === 'ar' ? 'المدير التنفيذي' : 'CEO' },
  { value: 'المدير المالي', label: language === 'ar' ? 'المدير المالي' : 'Finance Director' },
  { value: 'رئيس الحسابات', label: language === 'ar' ? 'رئيس الحسابات' : 'Chief Accountant' },
  { value: 'مدير الموارد البشرية', label: language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager' },
  { value: 'مدير المشاريع', label: language === 'ar' ? 'مدير المشاريع' : 'Project Manager' },
  { value: 'محاسب', label: language === 'ar' ? 'محاسب' : 'Accountant' },
  { value: 'موظف', label: language === 'ar' ? 'موظف' : 'Employee' },
];

export const getAvailablePermissions = (language) => [
  { id: 'dashboard', label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', icon: '🏠' },
  { id: 'hr_admin', label: language === 'ar' ? 'الموارد البشرية - إداري' : 'HR - Administrative', icon: '👥', category: 'hr' },
  { id: 'hr_financial', label: language === 'ar' ? 'الموارد البشرية - مالي' : 'HR - Financial', icon: '💵', category: 'hr' },
  { id: 'financial', label: language === 'ar' ? 'المالية' : 'Financial', icon: '💰' },
  { id: 'invoices', label: language === 'ar' ? 'الفواتير' : 'Invoices', icon: '📄' },
  { id: 'purchases', label: language === 'ar' ? 'المشتريات' : 'Purchases', icon: '🛒' },
  { id: 'projects', label: language === 'ar' ? 'المشاريع' : 'Projects', icon: '📊' },
  { id: 'reports', label: language === 'ar' ? 'التقارير' : 'Reports', icon: '📑' },
  { id: 'analytics', label: language === 'ar' ? 'التحليلات' : 'Analytics', icon: '📈' },
  { id: 'inventory', label: language === 'ar' ? 'المخزون' : 'Inventory', icon: '📦' },
  { id: 'settings', label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: '⚙️' },
  { id: 'users', label: language === 'ar' ? 'إدارة المستخدمين' : 'User Management', icon: '👤' },
  { id: 'approvals', label: language === 'ar' ? 'الموافقات' : 'Approvals', icon: '✅' },
];

// HR Admin SubModules - الأقسام الإدارية
export const HR_ADMIN_SUBMODULES = [
  'hr-overview',      // نظرة عامة
  'shifts',           // الورديات
  'attendance',       // الحضور والانصراف
  'casual-leave',     // الإجازات العارضة
  'annual-leave',     // الإجازات السنوية
  'termination',      // إنهاء الخدمة
  'hr-settings',      // إعدادات HR
];

// HR Financial SubModules - الأقسام المالية
export const HR_FINANCIAL_SUBMODULES = [
  'payroll',          // الرواتب والأجور
  'salaries',         // المرتبات
  'allowances',       // البدلات والإضافي
  'deductions',       // الخصومات
  'hr-reports',       // التقارير
  'hr-comprehensive-reports', // التقارير الشاملة
];

// Top management roles that have full access - synced with backend
export const MANAGEMENT_ROLES = [
  'General Manager', 'CEO', 'Board Chairman', 
  'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'
];

// Financial management roles - have access to HR Financial
export const FINANCIAL_MANAGEMENT_ROLES = [
  'Financial Manager', 'Chief Accountant',
  'المدير المالي', 'رئيس الحسابات'
];

// HR only roles - have access to HR Admin only
export const HR_ONLY_ROLES = [
  'HR Manager', 'مدير الموارد البشرية'
];

// Check if a role is top management
export const isTopManagement = (role) => MANAGEMENT_ROLES.includes(role);

// Check if a role has full HR access (both admin and financial)
export const hasFullHRAccess = (role) => 
  MANAGEMENT_ROLES.includes(role) || FINANCIAL_MANAGEMENT_ROLES.includes(role);

// Check if a role has HR Admin access
export const hasHRAdminAccess = (role, permissions = []) => 
  MANAGEMENT_ROLES.includes(role) || 
  HR_ONLY_ROLES.includes(role) || 
  permissions.includes('hr_admin');

// Check if a role has HR Financial access
export const hasHRFinancialAccess = (role, permissions = []) => 
  MANAGEMENT_ROLES.includes(role) || 
  FINANCIAL_MANAGEMENT_ROLES.includes(role) || 
  permissions.includes('hr_financial');
