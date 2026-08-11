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
// ════════════════════════════════════════════════════════
// PERMISSIONS — مقسّمة في 3 مجموعات
// ════════════════════════════════════════════════════════

const PERMISSION_GROUPS = [
  // ── Group 1: صلاحيات المستخدمين (User Permissions) ──
  {
    id: 'user_permissions',
    name_ar: '👤 صلاحيات المستخدمين',
    name_en: '👤 User Permissions',
    desc_ar: 'الصلاحيات التشغيلية اليومية للموظفين',
    desc_en: 'Daily operational permissions for employees',
    color: 'bg-blue-600',
    permissions: [
      { id: 'dashboard',    name_ar: 'لوحة التحكم',              name_en: 'Dashboard',              emoji: '🏠', icon: Home },
      { id: 'hr_admin',     name_ar: 'HR — حضور وإجازات وورديات', name_en: 'HR — Attendance & Leaves', emoji: '👥', icon: Users },
      { id: 'hr_financial', name_ar: 'HR — رواتب وبدلات وخصومات', name_en: 'HR — Payroll & Allowances', emoji: '💵', icon: Building2 },
      { id: 'invoices',     name_ar: 'الفواتير',                  name_en: 'Invoices',               emoji: '📄', icon: FileText },
      { id: 'purchases',    name_ar: 'المشتريات',                 name_en: 'Purchases',              emoji: '🛒', icon: Package },
      { id: 'inventory',    name_ar: 'المخزون',                   name_en: 'Inventory',              emoji: '📦', icon: Layers },
      { id: 'projects',     name_ar: 'المشاريع والمهام',           name_en: 'Projects & Tasks',       emoji: '📊', icon: FolderKanban },
      { id: 'approvals',    name_ar: 'الموافقات',                  name_en: 'Approvals',              emoji: '✅', icon: CheckCircle },
      { id: 'reports',      name_ar: 'التقارير',                  name_en: 'Reports',                emoji: '📑', icon: FileBarChart },
      { id: 'analytics',    name_ar: 'التحليلات',                 name_en: 'Analytics',              emoji: '📈', icon: BarChart3 },
    ]
  },

  // ── Group 2: صلاحيات الـ Owner (Company Owner Permissions) ──
  {
    id: 'owner_permissions',
    name_ar: '🏢 صلاحيات صاحب الشركة',
    name_en: '🏢 Company Owner Permissions',
    desc_ar: 'صلاحيات إدارة الشركة والإعدادات والمستخدمين',
    desc_en: 'Company management, settings and user control',
    color: 'bg-emerald-600',
    permissions: [
      { id: 'hr',             name_ar: 'HR — وصول كامل',          name_en: 'HR — Full Access',       emoji: '👥', icon: Users },
      { id: 'financial',      name_ar: 'الإدارة المالية الكاملة',   name_en: 'Full Financial Access',  emoji: '💰', icon: Building2 },
      { id: 'settings',       name_ar: 'إعدادات الشركة',           name_en: 'Company Settings',       emoji: '⚙️', icon: Settings },
      { id: 'users',          name_ar: 'إدارة المستخدمين',          name_en: 'User Management',        emoji: '👤', icon: UserCog },
      { id: 'admin',          name_ar: 'إدارة النظام',              name_en: 'System Administration',  emoji: '🔧', icon: Settings },
      { id: 'audit_logs',     name_ar: 'سجل التدقيق',              name_en: 'Audit Logs',             emoji: '📝', icon: FileBarChart },
      { id: 'billing',        name_ar: 'الفوترة والاشتراك',         name_en: 'Billing & Subscription', emoji: '💳', icon: FileText },
      { id: 'support',        name_ar: 'الدعم الفني',              name_en: 'Support',                emoji: '🎧', icon: UserCog },
    ]
  },

  // ── Group 3: صلاحيات السوبر ادمن (Super Admin / Platform Owner) ──
  {
    id: 'super_admin_permissions',
    name_ar: '👑 صلاحيات السوبر ادمن',
    name_en: '👑 Super Admin Permissions',
    desc_ar: 'صلاحيات المنصة الكاملة — لصاحب النظام فقط',
    desc_en: 'Full platform permissions — Platform owner only',
    color: 'bg-purple-700',
    permissions: [
      { id: 'companies',       name_ar: 'إدارة كل الشركات',         name_en: 'Manage All Companies',   emoji: '🏢', icon: Building2 },
      { id: 'subscriptions',   name_ar: 'إدارة الاشتراكات',          name_en: 'Manage Subscriptions',   emoji: '📋', icon: FileText },
      { id: 'system_settings', name_ar: 'إعدادات النظام الكاملة',    name_en: 'Full System Settings',   emoji: '🔩', icon: Settings },
    ]
  },
];

// Flatten for backward compatibility
const PERMISSIONS_CONFIG = PERMISSION_GROUPS.flatMap(g => g.permissions);

// Pre-defined role templates
const ROLE_TEMPLATES = {
  super_admin: {
    name_en: '👑 Super Admin (Platform Owner)',
    name_ar: '👑 سوبر ادمن (مالك المنصة)',
    permissions: PERMISSIONS_CONFIG.map(p => p.id),
    color: 'bg-purple-700'
  },
  owner: {
    name_en: '🏢 Company Owner',
    name_ar: '🏢 صاحب الشركة',
    permissions: ['dashboard','hr','hr_admin','hr_financial','financial','invoices','purchases','inventory','projects','approvals','reports','analytics','settings','users','admin','audit_logs','billing','support'],
    color: 'bg-emerald-600'
  },
  admin: {
    name_en: '🔧 Administrator',
    name_ar: '🔧 مدير النظام',
    permissions: ['dashboard','hr','hr_admin','hr_financial','financial','invoices','purchases','projects','reports','analytics','inventory','settings','users','approvals','admin'],
    color: 'bg-red-500'
  },
  financial_manager: {
    name_en: '💰 Financial Manager',
    name_ar: '💰 المدير المالي',
    permissions: ['dashboard','hr_admin','hr_financial','financial','invoices','reports','analytics','approvals','billing'],
    color: 'bg-emerald-500'
  },
  accountant: {
    name_en: '📊 Accountant',
    name_ar: '📊 محاسب',
    permissions: ['dashboard','hr_financial','financial','invoices','reports','analytics'],
    color: 'bg-green-500'
  },
  hr_manager: {
    name_en: '👥 HR Manager',
    name_ar: '👥 مدير الموارد البشرية',
    permissions: ['dashboard','hr','hr_admin','hr_financial','reports','approvals'],
    color: 'bg-cyan-500'
  },
  sales: {
    name_en: '📄 Sales',
    name_ar: '📄 مبيعات',
    permissions: ['dashboard','invoices','inventory','reports'],
    color: 'bg-amber-500'
  },
  viewer: {
    name_en: '👁️ Viewer Only',
    name_ar: '👁️ مشاهد فقط',
    permissions: ['dashboard','reports'],
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
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.id} className="border border-gray-100 rounded-xl overflow-hidden">
                            {/* Group Header */}
                            <div className={`${group.color} px-4 py-2.5 flex items-center justify-between`}>
                              <div>
                                <span className="text-white font-bold text-sm">{language === 'ar' ? group.name_ar : group.name_en}</span>
                                <p className="text-white/70 text-xs mt-0.5">{language === 'ar' ? group.desc_ar : group.desc_en}</p>
                              </div>
                              <span className="text-white/80 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                {group.permissions.filter(p => isPermissionEnabled(emp.id, p.id)).length}/{group.permissions.length}
                              </span>
                            </div>
                            {/* Group Permissions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-gray-50">
                              {group.permissions.map((perm) => {
                                const isEnabled = isPermissionEnabled(emp.id, perm.id);
                                const Icon = perm.icon;
                                return (
                                  <div
                                    key={perm.id}
                                    onClick={() => togglePermission(emp.id, perm.id)}
                                    className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border transition-all ${
                                      isEnabled
                                        ? 'bg-white border-blue-200 shadow-sm'
                                        : 'bg-gray-100 border-gray-200 opacity-60'
                                    }`}
                                  >
                                    <span className="text-base">{perm.emoji}</span>
                                    <span className={`text-xs font-medium flex-1 ${isEnabled ? 'text-gray-800' : 'text-gray-500'}`}>
                                      {language === 'ar' ? perm.name_ar : perm.name_en}
                                    </span>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                      isEnabled ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                    }`}>
                                      {isEnabled && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
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
