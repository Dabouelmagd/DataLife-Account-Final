import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const PermissionsContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export const PermissionsProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPermissionsConfig();
  }, []);

  const fetchPermissionsConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/permissions/config`
      );
      setConfig(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching permissions config:', err);
      setError(err.message);
      // Use fallback config if API fails
      setConfig(getFallbackConfig());
    } finally {
      setLoading(false);
    }
  };

  // Get available roles with localized labels
  const getAvailableRoles = (language = 'ar') => {
    if (!config?.roles) return [];
    return config.roles.map(role => ({
      value: role.value,
      label: language === 'ar' ? role.label_ar : role.label_en,
      category: role.category
    }));
  };

  // Get available modules with localized labels
  const getAvailableModules = (language = 'ar') => {
    if (!config?.modules) return [];
    return config.modules.map(module => ({
      id: module.id,
      label: language === 'ar' ? module.name_ar : module.name_en,
      icon: module.icon
    }));
  };

  // Get permissions for a specific role
  const getRolePermissions = (role) => {
    if (!config?.role_permissions || !role) return { modules: [], permissions: {} };
    return config.role_permissions[role] || { modules: [], permissions: {} };
  };

  // Check if a role is top management
  const isTopManagement = (role) => {
    if (!config?.top_management_roles) return false;
    return config.top_management_roles.includes(role);
  };

  // Check if a role has a specific permission
  const hasPermission = (role, module, action) => {
    const rolePerms = getRolePermissions(role);
    const modulePerms = rolePerms.permissions?.[module] || [];
    return modulePerms.includes(action);
  };

  // Check if a role can access a module
  const canAccessModule = (role, module) => {
    const rolePerms = getRolePermissions(role);
    return rolePerms.modules?.includes(module) || false;
  };

  // Get modules a role can access
  const getAccessibleModules = (role) => {
    const rolePerms = getRolePermissions(role);
    return rolePerms.modules || [];
  };

  // Refresh config from server
  const refreshConfig = () => {
    fetchPermissionsConfig();
  };

  const value = {
    config,
    loading,
    error,
    getAvailableRoles,
    getAvailableModules,
    getRolePermissions,
    isTopManagement,
    hasPermission,
    canAccessModule,
    getAccessibleModules,
    refreshConfig,
    // Quick access to top management roles
    topManagementRoles: config?.top_management_roles || []
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

// Fallback config in case the API fails
const getFallbackConfig = () => ({
  modules: [
    { id: 'dashboard', name_ar: 'لوحة التحكم', name_en: 'Dashboard', icon: 'Home' },
    { id: 'hr', name_ar: 'الموارد البشرية', name_en: 'Human Resources', icon: 'Users' },
    { id: 'financial', name_ar: 'المالية', name_en: 'Financial', icon: 'DollarSign' },
    { id: 'invoices', name_ar: 'الفواتير', name_en: 'Invoices', icon: 'FileText' },
    { id: 'purchases', name_ar: 'المشتريات', name_en: 'Purchases', icon: 'ShoppingCart' },
    { id: 'projects', name_ar: 'المشاريع والمهام', name_en: 'Projects & Tasks', icon: 'FolderKanban' },
    { id: 'analytics', name_ar: 'التحليلات', name_en: 'Analytics', icon: 'BarChart3' },
    { id: 'settings', name_ar: 'الإعدادات', name_en: 'Settings', icon: 'Settings' },
    { id: 'users', name_ar: 'إدارة المستخدمين', name_en: 'User Management', icon: 'UserCog' },
    { id: 'approvals', name_ar: 'الموافقات', name_en: 'Approvals', icon: 'CheckCircle' }
  ],
  roles: [
    { value: 'رئيس مجلس الإدارة', label_ar: 'رئيس مجلس الإدارة', label_en: 'Board Chairman', category: 'top_management' },
    { value: 'مدير عام', label_ar: 'المدير العام', label_en: 'General Manager', category: 'top_management' },
    { value: 'المدير التنفيذي', label_ar: 'المدير التنفيذي', label_en: 'CEO', category: 'top_management' },
    { value: 'المدير المالي', label_ar: 'المدير المالي', label_en: 'Finance Director', category: 'middle_management' },
    { value: 'مدير الموارد البشرية', label_ar: 'مدير الموارد البشرية', label_en: 'HR Manager', category: 'middle_management' },
    { value: 'محاسب', label_ar: 'محاسب', label_en: 'Accountant', category: 'staff' },
    { value: 'موظف', label_ar: 'موظف', label_en: 'Employee', category: 'staff' }
  ],
  top_management_roles: [
    'رئيس مجلس الإدارة', 'Board Chairman',
    'مدير عام', 'General Manager',
    'المدير التنفيذي', 'CEO'
  ],
  role_permissions: {}
});

export default PermissionsContext;
