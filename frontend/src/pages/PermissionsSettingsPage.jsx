import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  Users, Shield, Search, Save, RotateCcw, CheckCircle, 
  X, ChevronDown, ChevronUp, History, Copy, UserCog,
  Home, Building2, FileText, Package, FolderKanban, 
  BarChart3, Settings, Lock, Bell, Layers, FileBarChart
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Permission definitions with icons and colors
const PERMISSIONS_CONFIG = [
  { id: 'dashboard', name_en: 'Dashboard', name_ar: 'لوحة التحكم', icon: Home, color: 'bg-slate-500', emoji: '🏠' },
  { id: 'hr', name_en: 'Human Resources', name_ar: 'الموارد البشرية', icon: Users, color: 'bg-cyan-500', emoji: '👥' },
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
];

// Pre-defined role templates
const ROLE_TEMPLATES = {
  admin: {
    name_en: 'Administrator',
    name_ar: 'مدير النظام',
    permissions: ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'reports', 'analytics', 'inventory', 'settings', 'users', 'approvals'],
    color: 'bg-red-500'
  },
  accountant: {
    name_en: 'Accountant',
    name_ar: 'محاسب',
    permissions: ['dashboard', 'financial', 'invoices', 'reports', 'analytics'],
    color: 'bg-green-500'
  },
  hr_manager: {
    name_en: 'HR Manager',
    name_ar: 'مدير الموارد البشرية',
    permissions: ['dashboard', 'hr', 'reports', 'approvals'],
    color: 'bg-cyan-500'
  },
  sales: {
    name_en: 'Sales',
    name_ar: 'مبيعات',
    permissions: ['dashboard', 'invoices', 'reports', 'inventory'],
    color: 'bg-amber-500'
  },
  viewer: {
    name_en: 'Viewer Only',
    name_ar: 'مشاهد فقط',
    permissions: ['dashboard', 'reports'],
    color: 'bg-gray-500'
  },
  inventory_manager: {
    name_en: 'Inventory Manager',
    name_ar: 'مدير المخزون',
    permissions: ['dashboard', 'inventory', 'purchases', 'reports'],
    color: 'bg-teal-500'
  },
  project_manager: {
    name_en: 'Project Manager',
    name_ar: 'مدير المشاريع',
    permissions: ['dashboard', 'projects', 'reports', 'approvals'],
    color: 'bg-indigo-500'
  }
};

const PermissionsSettingsPage = ({ language = 'en' }) => {
  const isRTL = language === 'ar';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [permissionChanges, setPermissionChanges] = useState({});
  const [changeHistory, setChangeHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch employees
  useEffect(() => {
    fetchEmployees();
    loadChangeHistory();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const companyId = user.company_id;
      
      // Try company-specific endpoint first
      let response;
      try {
        response = await axios.get(`${API_URL}/api/admin/companies/${companyId}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        // Fallback to all-users endpoint
        response = await axios.get(`${API_URL}/api/admin/all-users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      const users = response.data || [];
      // Filter out current user and format data
      setEmployees(users.filter(u => u._id !== user.id && u.id !== user.id));
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error(language === 'ar' ? 'خطأ في جلب الموظفين' : 'Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  const loadChangeHistory = () => {
    const history = JSON.parse(localStorage.getItem('permissionChangeHistory') || '[]');
    setChangeHistory(history.slice(0, 20)); // Keep last 20 changes
  };

  const saveChangeHistory = (change) => {
    const history = JSON.parse(localStorage.getItem('permissionChangeHistory') || '[]');
    history.unshift(change);
    localStorage.setItem('permissionChangeHistory', JSON.stringify(history.slice(0, 50)));
    setChangeHistory(history.slice(0, 20));
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.role?.toLowerCase().includes(query)
    );
  });

  // Toggle permission for employee
  const togglePermission = (employeeId, permissionId) => {
    setPermissionChanges(prev => {
      const empChanges = prev[employeeId] || {};
      const employee = employees.find(e => e._id === employeeId);
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
    const employee = employees.find(e => e._id === employeeId);
    const currentPerms = employee?.permissions || [];
    const changes = permissionChanges[employeeId] || {};
    
    if (changes[permissionId] !== undefined) {
      return changes[permissionId];
    }
    return currentPerms.includes(permissionId);
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

  // Apply template to selected employees
  const applyTemplateToSelected = (templateKey) => {
    if (selectedEmployees.length === 0) {
      toast.error(language === 'ar' ? 'اختر موظفين أولاً' : 'Select employees first');
      return;
    }

    const template = ROLE_TEMPLATES[templateKey];
    if (!template) return;

    const newChanges = { ...permissionChanges };
    selectedEmployees.forEach(empId => {
      const empChanges = {};
      PERMISSIONS_CONFIG.forEach(perm => {
        empChanges[perm.id] = template.permissions.includes(perm.id);
      });
      newChanges[empId] = empChanges;
    });

    setPermissionChanges(newChanges);
    toast.success(
      language === 'ar' 
        ? `تم تطبيق القالب على ${selectedEmployees.length} موظف` 
        : `Applied template to ${selectedEmployees.length} employees`
    );
  };

  // Save changes
  const saveChanges = async () => {
    const changedEmployees = Object.keys(permissionChanges);
    if (changedEmployees.length === 0) {
      toast.info(language === 'ar' ? 'لا توجد تغييرات للحفظ' : 'No changes to save');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      for (const empId of changedEmployees) {
        const employee = employees.find(e => e._id === empId);
        const changes = permissionChanges[empId];
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
          `${API_URL}/api/admin/users/${empId}/permissions`,
          { permissions: newPermissions },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Save to history
        saveChangeHistory({
          timestamp: new Date().toISOString(),
          employeeName: employee?.name,
          employeeId: empId,
          oldPermissions: currentPerms,
          newPermissions: newPermissions,
          changedBy: 'Admin'
        });
      }

      toast.success(
        language === 'ar' 
          ? `تم حفظ التغييرات لـ ${changedEmployees.length} موظف` 
          : `Saved changes for ${changedEmployees.length} employees`
      );
      
      setPermissionChanges({});
      fetchEmployees();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(language === 'ar' ? 'خطأ في حفظ الصلاحيات' : 'Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  // Reset changes
  const resetChanges = () => {
    setPermissionChanges({});
    toast.info(language === 'ar' ? 'تم إلغاء التغييرات' : 'Changes reset');
  };

  // Toggle employee selection
  const toggleEmployeeSelection = (empId) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  // Select all employees
  const selectAllEmployees = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e._id));
    }
  };

  const hasChanges = Object.keys(permissionChanges).length > 0;

  return (
    <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-7 w-7 text-[#28376B]" />
            {language === 'ar' ? 'إعدادات الصلاحيات' : 'Permissions Settings'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' 
              ? 'إدارة صلاحيات الموظفين والوصول للوحدات' 
              : 'Manage employee permissions and module access'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {language === 'ar' ? 'سجل التغييرات' : 'Change History'}
          </Button>
          
          {hasChanges && (
            <>
              <Button variant="outline" onClick={resetChanges} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {language === 'ar' ? 'إلغاء' : 'Reset'}
              </Button>
              <Button 
                onClick={saveChanges} 
                disabled={saving}
                className="gap-2 bg-[#28376B] hover:bg-[#1e2a4a]"
              >
                <Save className="h-4 w-4" />
                {saving 
                  ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                  : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Change History Modal */}
      {showHistory && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                {language === 'ar' ? 'سجل التغييرات الأخيرة' : 'Recent Change History'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {changeHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                {language === 'ar' ? 'لا توجد تغييرات مسجلة' : 'No changes recorded'}
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {changeHistory.map((change, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 text-sm border">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{change.employeeName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(change.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {language === 'ar' ? 'الصلاحيات:' : 'Permissions:'} {change.oldPermissions?.length || 0} → {change.newPermissions?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Copy className="h-5 w-5 text-purple-600" />
            {language === 'ar' ? 'قوالب الصلاحيات الجاهزة' : 'Permission Templates'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'اختر قالب لتطبيقه على الموظفين المحددين' 
              : 'Select a template to apply to selected employees'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => applyTemplateToSelected(key)}
                className={`gap-2 hover:${template.color} hover:text-white transition-all`}
              >
                <span className={`w-2 h-2 rounded-full ${template.color}`}></span>
                {language === 'ar' ? template.name_ar : template.name_en}
                <Badge variant="secondary" className="text-xs">
                  {template.permissions.length}
                </Badge>
              </Button>
            ))}
          </div>
          {selectedEmployees.length > 0 && (
            <p className="text-sm text-blue-600 mt-2">
              {language === 'ar' 
                ? `${selectedEmployees.length} موظف محدد` 
                : `${selectedEmployees.length} employees selected`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Search and Select All */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} h-4 w-4 text-gray-400`} />
          <Input
            placeholder={language === 'ar' ? 'بحث عن موظف...' : 'Search employees...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${isRTL ? 'pr-10' : 'pl-10'}`}
          />
        </div>
        <Button
          variant="outline"
          onClick={selectAllEmployees}
          className="gap-2"
        >
          {selectedEmployees.length === filteredEmployees.length ? (
            <>
              <X className="h-4 w-4" />
              {language === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              {language === 'ar' ? 'تحديد الكل' : 'Select All'}
            </>
          )}
        </Button>
      </div>

      {/* Employees List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-[#28376B] border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{language === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}</p>
          </div>
        ) : (
          filteredEmployees.map(employee => {
            const isExpanded = expandedEmployee === employee._id;
            const isSelected = selectedEmployees.includes(employee._id);
            const employeeChanges = permissionChanges[employee._id];
            const hasEmployeeChanges = employeeChanges && Object.keys(employeeChanges).length > 0;
            const currentPermCount = (employee.permissions || []).length;
            const newPermCount = PERMISSIONS_CONFIG.filter(p => isPermissionEnabled(employee._id, p.id)).length;

            return (
              <Card 
                key={employee._id} 
                className={`transition-all ${isSelected ? 'ring-2 ring-[#28376B]' : ''} ${hasEmployeeChanges ? 'border-amber-400 bg-amber-50/30' : ''}`}
              >
                <CardContent className="p-4">
                  {/* Employee Header */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEmployeeSelection(employee._id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#28376B] focus:ring-[#28376B]"
                    />
                    
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#28376B] to-[#3d4f8a] flex items-center justify-center text-white font-bold">
                      {employee.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {employee.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{employee.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={employee.role === 'company_manager' ? 'default' : 'secondary'}>
                        {employee.role === 'company_manager' 
                          ? (language === 'ar' ? 'مدير' : 'Manager')
                          : (language === 'ar' ? 'موظف' : 'Employee')}
                      </Badge>
                      
                      <Badge variant="outline" className={hasEmployeeChanges ? 'bg-amber-100 text-amber-700' : ''}>
                        {hasEmployeeChanges ? `${currentPermCount} → ${newPermCount}` : newPermCount} / {PERMISSIONS_CONFIG.length}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedEmployee(isExpanded ? null : employee._id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Permissions */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      {/* Quick Templates */}
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600 mb-2">
                          {language === 'ar' ? 'تطبيق قالب سريع:' : 'Quick apply template:'}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
                            <Button
                              key={key}
                              variant="outline"
                              size="sm"
                              onClick={() => applyTemplate(employee._id, key)}
                              className="text-xs h-7"
                            >
                              {language === 'ar' ? template.name_ar : template.name_en}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Permissions Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {PERMISSIONS_CONFIG.map(perm => {
                          const Icon = perm.icon;
                          const enabled = isPermissionEnabled(employee._id, perm.id);
                          const changed = employeeChanges?.[perm.id] !== undefined;
                          
                          return (
                            <button
                              key={perm.id}
                              onClick={() => togglePermission(employee._id, perm.id)}
                              className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                                enabled 
                                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20' 
                                  : 'border-gray-200 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                              } ${changed ? 'ring-2 ring-amber-400' : ''} hover:scale-[1.02]`}
                            >
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${enabled ? perm.color : 'bg-gray-400'}`}>
                                {perm.emoji}
                              </span>
                              <div className={`flex-1 text-${isRTL ? 'right' : 'left'}`}>
                                <span className={`text-xs font-medium block ${enabled ? 'text-gray-800' : 'text-gray-500'}`}>
                                  {language === 'ar' ? perm.name_ar : perm.name_en}
                                </span>
                              </div>
                              {enabled ? (
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-auto">
          <Card className="bg-[#28376B] text-white shadow-2xl">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {language === 'ar' 
                    ? `${Object.keys(permissionChanges).length} موظف لديه تغييرات` 
                    : `${Object.keys(permissionChanges).length} employees have changes`}
                </p>
                <p className="text-sm text-blue-200">
                  {language === 'ar' ? 'احفظ التغييرات لتطبيقها' : 'Save to apply changes'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetChanges} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {language === 'ar' ? 'إلغاء' : 'Reset'}
                </Button>
                <Button onClick={saveChanges} disabled={saving} className="gap-2 bg-green-500 hover:bg-green-600">
                  <Save className="h-4 w-4" />
                  {saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PermissionsSettingsPage;
