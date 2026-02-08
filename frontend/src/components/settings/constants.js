// Settings module constants - roles and permissions

export const getAvailableRoles = (language) => [
  { value: 'رئيس مجلس الإدارة', label: language === 'ar' ? 'رئيس مجلس الإدارة' : 'Board Chairman' },
  { value: 'مدير عام', label: language === 'ar' ? 'المدير العام' : 'General Manager' },
  { value: 'المدير التنفيذي', label: language === 'ar' ? 'المدير التنفيذي' : 'CEO' },
  { value: 'المدير المالي', label: language === 'ar' ? 'المدير المالي' : 'Finance Director' },
  { value: 'مدير الموارد البشرية', label: language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager' },
  { value: 'محاسب', label: language === 'ar' ? 'محاسب' : 'Accountant' },
  { value: 'مدير المشاريع', label: language === 'ar' ? 'مدير المشاريع' : 'Project Manager' },
  { value: 'موظف', label: language === 'ar' ? 'موظف' : 'Employee' },
];

export const getAvailablePermissions = (language) => [
  { id: 'dashboard', label: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', icon: '🏠' },
  { id: 'hr', label: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', icon: '👥' },
  { id: 'financial', label: language === 'ar' ? 'المالية' : 'Financial', icon: '💰' },
  { id: 'invoices', label: language === 'ar' ? 'الفواتير' : 'Invoices', icon: '📄' },
  { id: 'purchases', label: language === 'ar' ? 'المشتريات' : 'Purchases', icon: '🛒' },
  { id: 'projects', label: language === 'ar' ? 'المشاريع' : 'Projects', icon: '📊' },
  { id: 'analytics', label: language === 'ar' ? 'التحليلات' : 'Analytics', icon: '📈' },
  { id: 'settings', label: language === 'ar' ? 'الإعدادات' : 'Settings', icon: '⚙️' },
  { id: 'users', label: language === 'ar' ? 'إدارة المستخدمين' : 'User Management', icon: '👤' },
  { id: 'approvals', label: language === 'ar' ? 'الموافقات' : 'Approvals', icon: '✅' },
];

export const MANAGEMENT_ROLES = [
  'General Manager', 'CEO', 'Board Chairman', 
  'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'
];
