import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { 
  Shield, Search, Save, RotateCcw, CheckCircle, X, ChevronDown, ChevronUp,
  Users, Home, Building2, FileText, Package, FolderKanban, BarChart3, 
  Settings, Layers, FileBarChart, UserCog, Check, Square, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Permission definitions with icons and colors (21 permissions)
const PERMISSIONS_CONFIG = [
  { id: 'dashboard', name_en: 'Dashboard', name_ar: 'لوحة التحكم', icon: Home, color: 'bg-slate-500', emoji: '🏠' },
  { id: 'hr', name_en: 'Human Resources', name_ar: 'الموارد البشرية', icon: Users, color: 'bg-cyan-600', emoji: '👥', desc_en: 'Full HR Access', desc_ar: 'وصول كامل للموارد البشرية' },
  { id: 'hr_admin', name_en: 'HR - Administrative', name_ar: 'الموارد البشرية - إداري', icon: Users, color: 'bg-cyan-500', emoji: '👥', desc_en: 'Attendance, Leaves, Shifts', desc_ar: 'حضور، إجازات، ورديات' },
  { id: 'hr_financial', name_en: 'HR - Financial', name_ar: 'الموارد البشرية - مالي', icon: Building2, color: 'bg-teal-500', emoji: '💵', desc_en: 'Payroll, Allowances, Deductions', desc_ar: 'رواتب، بدلات، خصومات' },
  { id: 'financial', name_en: 'Financial Management', name_ar: 'الإدارة المالية', icon: Building2, color: 'bg-emerald-500', emoji: '💰' },
  { id: 'invoices', name_en: 'Invoices', name_ar: 'الفواتير', icon: FileText, color: 'bg-amber-500', emoji: '📄' },
  { id: 'purchases', name_en: 'Purchases', name_ar: 'المشتريات', icon: Package, color: 'bg-rose-500', emoji: '🛒' },
  { id: 'projects', name_en: 'Projects & Tasks', name_ar: 'المشاريع والمهام', icon: FolderKanban, color: 'bg-indigo-500', emoji: '📊' },
  { id: 'reports', name_en: 'Reports', name_ar: 'التقارير', icon: FileBarChart, color: 'bg-violet-500', emoji: '📑' },
  { id: 'analytics', name_en: 'Analytics', name_ar: 'التحليلات', icon: BarChart3, color: 'bg-blue-500', emoji: '📈' },
  { id: 'inventory', name_en: 'Inventory', name_ar: 'المخزون', icon: Layers, color: 'bg-teal-500', emoji: '📦' },
  { id: 'settings', name_en: 'Settings', name_ar: 'الإعدادات', icon: Settings, color: 'bg-gray-500', emoji: '⚙️' },
  { id: 'users', name_en: 'User Management', name_ar: 'إدارة المستخدمين', icon: UserCog, color: 'bg-blue-600', emoji: '👤' },
  { id: 'approvals', name_en: 'Approvals', name_ar: 'الموافقات', icon: CheckCircle, color: 'bg-green-500', emoji: '✅' },
  { id: 'admin', name_en: 'Administration', name_ar: 'الإدارة', icon: Settings, color: 'bg-red-500', emoji: '🔧' },
  { id: 'subscriptions', name_en: 'Subscriptions', name_ar: 'الاشتراكات', icon: FileText, color: 'bg-purple-500', emoji: '📋' },
  { id: 'companies', name_en: 'Companies', name_ar: 'الشركات', icon: Building2, color: 'bg-orange-500', emoji: '🏢' },
  { id: 'audit_logs', name_en: 'Audit Logs', name_ar: 'سجل التدقيق', icon: FileBarChart, color: 'bg-gray-600', emoji: '📝' },
  { id: 'system_settings', name_en: 'System Settings', name_ar: 'إعدادات النظام', icon: Settings, color: 'bg-slate-600', emoji: '🔩' },
  { id: 'billing', name_en: 'Billing', name_ar: 'الفوترة', icon: FileText, color: 'bg-yellow-500', emoji: '💳' },
  { id: 'support', name_en: 'Support', name_ar: 'الدعم الفني', icon: UserCog, color: 'bg-sky-500', emoji: '🎧' },
];

// Pre-defined role templates
const ROLE_TEMPLATES = {
  admin: {
    name_en: 'Administrator',
    name_ar: 'مدير النظام',
    permissions: ['dashboard', 'hr', 'hr_admin', 'hr_financial', 'financial', 'invoices', 'purchases', 'projects', 'reports', 'analytics', 'inventory', 'settings', 'users', 'approvals', 'admin', 'subscriptions', 'companies', 'audit_logs', 'system_settings', 'billing', 'support'],
    color: 'bg-red-500'
  },
  financial_manager: {
    name_en: 'Financial Manager',
    name_ar: 'المدير المالي',
    permissions: ['dashboard', 'hr_admin', 'hr_financial', 'financial', 'invoices', 'reports', 'analytics', 'approvals', 'billing'],
    color: 'bg-emerald-500'
  },
  accountant: {
    name_en: 'Accountant',
    name_ar: 'محاسب',
    permissions: ['dashboard', 'hr_financial', 'financial', 'invoices', 'reports', 'analytics'],
    color: 'bg-green-500'
  },
  hr_manager: {
    name_en: 'HR Manager',
    name_ar: 'مدير الموارد البشرية',
    permissions: ['dashboard', 'hr', 'hr_admin', 'hr_financial', 'reports', 'approvals'],
    color: 'bg-cyan-500'
  },
  viewer: {
    name_en: 'Viewer Only',
    name_ar: 'مشاهد فقط',
    permissions: ['dashboard', 'reports'],
    color: 'bg-gray-500'
  },
};

const PermissionsTab = ({ language = 'ar', currentUserId }) => {
  const isRTL = language === 'ar';
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser?.is_platform_admin || currentUser?.role === 'Super Admin';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [permissionChanges, setPermissionChanges] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/api/users/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const users = response.data || [];
      // Filter out current user (Super Admin)
      const filtered = users.filter(u => u.id !== currentUserId);
      // Sort: group by company_id
      filtered.sort((a, b) => {
        const cA = a.company_id || '';
        const cB = b.company_id || '';
        return cA.localeCompare(cB);
      });
      setEmployees(filtered);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error(language === 'ar' ? 'خطأ في جلب الموظفين' : 'Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.role?.toLowerCase().includes(query)
    );
  });

  // Toggle permission for employee
  const togglePermission = (employeeId, permissionId) => {
    setPermissionChanges(prev => {
      const empChanges = prev[employeeId] || {};
      const employee = employees.find(e => e.id === employeeId);
      const currentPerms = employee?.permissions || [];
      const hasPermission = empChanges[permissionId] !== undefined 
        ? empChanges[permissionId] 
        : currentPerms.includes(permissionId);
      
      return {
        ...prev,
        [employeeId]: {
          ...empChanges,
          [permissionId]: !hasPermission
        }
      };
    });
  };

  // Check if permission is enabled
  const isPermissionEnabled = (employeeId, permissionId) => {
    const employee = employees.find(e => e.id === employeeId);
    const currentPerms = employee?.permissions || [];
    const changes = permissionChanges[employeeId] || {};
    
    if (changes[permissionId] !== undefined) {
      return changes[permissionId];
    }
    return currentPerms.includes(permissionId);
  };

  // Get enabled permissions count for employee
  const getEnabledPermissionsCount = (employeeId) => {
    return PERMISSIONS_CONFIG.filter(perm => isPermissionEnabled(employeeId, perm.id)).length;
  };

  // Select all permissions for employee
  const selectAllPermissions = (employeeId) => {
    const newChanges = {};
    PERMISSIONS_CONFIG.forEach(perm => {
      newChanges[perm.id] = true;
    });
    setPermissionChanges(prev => ({
      ...prev,
      [employeeId]: newChanges
    }));
    toast.success(language === 'ar' ? 'تم تحديد جميع الصلاحيات' : 'All permissions selected');
  };

  // Deselect all permissions for employee (except dashboard)
  const deselectAllPermissions = (employeeId) => {
    const newChanges = {};
    PERMISSIONS_CONFIG.forEach(perm => {
      // Keep dashboard as minimum required permission
      newChanges[perm.id] = perm.id === 'dashboard';
    });
    setPermissionChanges(prev => ({
      ...prev,
      [employeeId]: newChanges
    }));
    toast.success(language === 'ar' ? 'تم إلغاء تحديد جميع الصلاحيات' : 'All permissions deselected');
  };

  // Apply template to employee
  const applyTemplate = (employeeId, templateKey) => {
    const template = ROLE_TEMPLATES[templateKey];
    if (!template) return;

    const newChanges = {};
    PERMISSIONS_CONFIG.forEach(perm => {
      newChanges[perm.id] = template.permissions.includes(perm.id);
    });

    setPermissionChanges(prev => ({
      ...prev,
      [employeeId]: newChanges
    }));

    toast.success(
      language === 'ar' 
        ? `تم تطبيق قالب "${template.name_ar}"` 
        : `Applied "${template.name_en}" template`
    );
  };

  // Save changes for single employee
  const saveEmployeeChanges = async (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    const changes = permissionChanges[employeeId];
    
    if (!changes || Object.keys(changes).length === 0) {
      toast.info(language === 'ar' ? 'لا توجد تغييرات للحفظ' : 'No changes to save');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const currentPerms = employee?.permissions || [];
      
      // Calculate new permissions
      const newPermissions = PERMISSIONS_CONFIG.map(perm => perm.id).filter(permId => {
        if (changes[permId] !== undefined) {
          return changes[permId];
        }
        return currentPerms.includes(permId);
      });

      // Update via API
      await axios.put(
        `${API_URL}/api/users/${employeeId}/permissions`,
        { permissions: newPermissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(
        language === 'ar' 
          ? `تم حفظ صلاحيات ${employee.full_name}` 
          : `Saved permissions for ${employee.full_name}`
      );
      
      // Clear changes for this employee
      setPermissionChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[employeeId];
        return newChanges;
      });
      
      fetchEmployees();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(language === 'ar' ? 'خطأ في حفظ الصلاحيات' : 'Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  // Reset changes for employee
  const resetEmployeeChanges = (employeeId) => {
    setPermissionChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[employeeId];
      return newChanges;
    });
    toast.info(language === 'ar' ? 'تم إلغاء التغييرات' : 'Changes reset');
  };

  // Check if employee has unsaved changes
  const hasEmployeeChanges = (employeeId) => {
    return permissionChanges[employeeId] && Object.keys(permissionChanges[employeeId]).length > 0;
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#28376B]" />
            {language === 'ar' ? 'إدارة صلاحيات الموظفين' : 'Employee Permissions Management'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'حدد صلاحيات كل موظف بشكل منفصل مع إمكانية تحديد الكل أو إلغاء التحديد' 
              : 'Set permissions for each employee individually with select/deselect all options'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={language === 'ar' ? 'بحث عن موظف...' : 'Search employee...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </CardContent>
        </Card>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            {language === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEmployees.map((emp, index) => {
            const isExpanded = expandedEmployee === emp.id;
            const hasChanges = hasEmployeeChanges(emp.id);
            const enabledCount = getEnabledPermissionsCount(emp.id);
            const prevEmp = filteredEmployees[index - 1];
            const showCompanyHeader = isOwner && (index === 0 || emp.company_id !== prevEmp?.company_id);
            const companyLabel = emp.company_id
              ? (emp.company_name || (language === 'ar' ? `شركة (${emp.company_id?.slice(0,8)})` : `Company (${emp.company_id?.slice(0,8)})`))
              : (language === 'ar' ? '🛡️ مستخدمو المنصة' : '🛡️ Platform Users');
            
            return (
              <div key={emp.id}>
                {showCompanyHeader && (
                  <div className="flex items-center gap-2 px-2 py-1 mb-2 mt-3">
                    <span className="text-xs font-bold text-[#28376B] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                      {companyLabel}
                    </span>
                    <div className="flex-1 h-px bg-blue-100"></div>
                  </div>
                )}
              <Card 
                className={`transition-all ${hasChanges ? 'ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
              >
                <CardContent className="p-0">
                  {/* Employee Header */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#28376B] to-blue-600 flex items-center justify-center text-white font-bold">
                        {emp.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </div>
                      
                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{emp.full_name}</h3>
                          {hasChanges && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              {language === 'ar' ? 'غير محفوظ' : 'Unsaved'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {emp.role}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {enabledCount}/{PERMISSIONS_CONFIG.length} {language === 'ar' ? 'صلاحية' : 'permissions'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expand Button */}
                    <div className="flex items-center gap-2">
                      {hasChanges && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); saveEmployeeChanges(emp.id); }}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={saving}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'حفظ' : 'Save'}
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Permissions */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50 dark:bg-gray-900/50 p-4 space-y-4">
                      {/* Quick Actions */}
                      <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
                        {/* Select All / Deselect All */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectAllPermissions(emp.id)}
                          className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                        >
                          <CheckSquare className="h-4 w-4" />
                          {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deselectAllPermissions(emp.id)}
                          className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Square className="h-4 w-4" />
                          {language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All'}
                        </Button>
                        
                        {/* Divider */}
                        <div className="h-6 w-px bg-gray-300 mx-2" />
                        
                        {/* Templates */}
                        <span className="text-sm text-gray-500">
                          {language === 'ar' ? 'قوالب جاهزة:' : 'Quick templates:'}
                        </span>
                        {Object.entries(ROLE_TEMPLATES).slice(0, 4).map(([key, template]) => (
                          <Button
                            key={key}
                            variant="outline"
                            size="sm"
                            onClick={() => applyTemplate(emp.id, key)}
                            className="text-xs"
                          >
                            {language === 'ar' ? template.name_ar : template.name_en}
                          </Button>
                        ))}
                      </div>

                      {/* Permissions Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {PERMISSIONS_CONFIG.map((perm) => {
                          const isEnabled = isPermissionEnabled(emp.id, perm.id);
                          const Icon = perm.icon;
                          
                          return (
                            <div
                              key={perm.id}
                              onClick={() => togglePermission(emp.id, perm.id)}
                              className={`
                                flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all
                                ${isEnabled 
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }
                              `}
                            >
                              {/* Checkbox */}
                              <div className={`
                                w-5 h-5 rounded flex items-center justify-center
                                ${isEnabled ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 border-2 border-gray-300'}
                              `}>
                                {isEnabled && <Check className="h-3 w-3" />}
                              </div>
                              
                              {/* Icon */}
                              <div className={`w-8 h-8 rounded-lg ${perm.color} flex items-center justify-center`}>
                                <span className="text-white text-sm">{perm.emoji}</span>
                              </div>
                              
                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isEnabled ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {language === 'ar' ? perm.name_ar : perm.name_en}
                                </p>
                                {perm.desc_ar && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {language === 'ar' ? perm.desc_ar : perm.desc_en}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer Actions */}
                      {hasChanges && (
                        <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resetEmployeeChanges(emp.id)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {language === 'ar' ? 'إلغاء التغييرات' : 'Reset Changes'}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEmployeeChanges(emp.id)}
                            className="bg-[#28376B] hover:bg-[#1e2a4a]"
                            disabled={saving}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {saving 
                              ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                              : (language === 'ar' ? 'حفظ الصلاحيات' : 'Save Permissions')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionsTab;
