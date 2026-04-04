import React, { useState } from 'react';
import { 
  House, Users, Wallet, FileText, Gear, SignOut, CaretDown, CaretRight,
  ChartBar, ShieldCheck, Bell, Clock, Folders, Package, CreditCard, 
  UserCheck, FileCheck, Buildings, PieChart, TrendingUp, Globe, ClipboardText,
  Cube, CheckCircle, Moon, Sun, Lock, Copy
} from '@phosphor-icons/react';
import { Badge } from './ui/badge';
import NotificationCenter from './NotificationCenter';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const ModernSidebar = ({ 
  user, 
  language, 
  modules, 
  activeModule, 
  setActiveModule, 
  activeHRSubModule,
  setActiveHRSubModule,
  activeFinancialSubModule,
  setActiveFinancialSubModule,
  activeInvoiceSubModule,
  setActiveInvoiceSubModule,
  onLogout,
  navigate,
  company
}) => {
  const isRTL = language === 'ar';
  const [expandedMenus, setExpandedMenus] = useState({});
  const { toggleLanguage } = useLanguage();
  const { darkMode, toggleDarkMode } = useTheme();
  const [copied, setCopied] = useState(false);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const copyCode = () => {
    const code = user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase();
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Role badge colors - Earthy tones
  const getRoleBadgeStyle = (role) => {
    const roleStyles = {
      'CEO': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      'المدير التنفيذي': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      'Board Chairman': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      'رئيس مجلس الإدارة': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      'General Manager': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      'مدير عام': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      'Financial Manager': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      'المدير المالي': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      'HR Manager': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
      'مدير الموارد البشرية': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    };
    return roleStyles[role] || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
  };

  // Module icons mapping
  const getModuleIcon = (moduleId, isActive) => {
    const weight = isActive ? 'fill' : 'regular';
    const iconMap = {
      'dashboard': <House weight={weight} />,
      'hr': <Users weight={weight} />,
      'financial': <Wallet weight={weight} />,
      'invoices': <FileText weight={weight} />,
      'purchases': <Package weight={weight} />,
      'projects': <Folders weight={weight} />,
      'reports': <ClipboardText weight={weight} />,
      'analytics': <ChartBar weight={weight} />,
      'inventory': <Cube weight={weight} />,
      'settings': <Gear weight={weight} />,
      'users': <UserCheck weight={weight} />,
      'approvals': <CheckCircle weight={weight} />,
    };
    return iconMap[moduleId] || <House weight={weight} />;
  };

  // Permission modules
  const allPermissionModules = [
    { id: 'dashboard', name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard' },
    { id: 'hr', name: language === 'ar' ? 'الموارد البشرية' : 'HR' },
    { id: 'financial', name: language === 'ar' ? 'المالية' : 'Financial' },
    { id: 'invoices', name: language === 'ar' ? 'الفواتير' : 'Invoices' },
    { id: 'purchases', name: language === 'ar' ? 'المشتريات' : 'Purchases' },
    { id: 'projects', name: language === 'ar' ? 'المشاريع' : 'Projects' },
    { id: 'reports', name: language === 'ar' ? 'التقارير' : 'Reports' },
    { id: 'analytics', name: language === 'ar' ? 'التحليلات' : 'Analytics' },
    { id: 'inventory', name: language === 'ar' ? 'المخزون' : 'Inventory' },
    { id: 'settings', name: language === 'ar' ? 'الإعدادات' : 'Settings' },
    { id: 'users', name: language === 'ar' ? 'المستخدمين' : 'Users' },
    { id: 'approvals', name: language === 'ar' ? 'الموافقات' : 'Approvals' },
  ];

  const hasAccess = (moduleId) => {
    return modules.some(m => m.id === moduleId) || 
           (user?.permissions && user.permissions.includes(moduleId)) ||
           ['رئيس مجلس الإدارة', 'Board Chairman', 'مدير عام', 'General Manager', 'المدير التنفيذي', 'CEO'].includes(user?.role);
  };

  return (
    <aside 
      className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-screen w-[280px] lg:w-[300px] z-50 transition-colors duration-300`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#F7F7F5] dark:bg-[#141514] border-e border-[#E5E5E0] dark:border-[#2C2D2C]" />

      {/* Content */}
      <div className="relative h-full flex flex-col z-10">
        
        {/* Company Logo Section */}
        <div className="p-6 border-b border-[#E5E5E0]/60 dark:border-[#2C2D2C]/60">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1E1F1E] border border-[#E5E5E0] dark:border-[#2C2D2C] flex items-center justify-center overflow-hidden shadow-sm">
              {company?.logo_url ? (
                <img 
                  src={company.logo_url}
                  alt={company.name || "Company"} 
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <Buildings weight="duotone" className="w-6 h-6 text-[#B65A46] dark:text-[#D2705A]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[#1C1C1A] dark:text-[#F1F1F0] font-semibold text-base tracking-tight truncate">
                {company?.name || (language === 'ar' ? 'شركتك' : 'Your Company')}
              </h1>
              <p className="text-[#686865] dark:text-[#8A8B8A] text-xs mt-0.5">
                {language === 'ar' ? 'نظام إدارة الأعمال' : 'ERP System'}
              </p>
            </div>
          </div>
          
          {/* Subscription Code */}
          <div className="mt-4 flex items-center justify-between bg-[#B65A46]/10 dark:bg-[#D2705A]/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <CreditCard weight="duotone" className="w-4 h-4 text-[#B65A46] dark:text-[#D2705A]" />
              <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#B65A46] dark:text-[#D2705A]">
                {language === 'ar' ? 'كود' : 'Code'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-bold text-[#B65A46] dark:text-[#D2705A] tracking-wider">
                {user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase() || '--------'}
              </code>
              <button
                onClick={copyCode}
                className="p-1.5 rounded-md hover:bg-[#B65A46]/20 dark:hover:bg-[#D2705A]/20 transition-colors"
                title={language === 'ar' ? 'نسخ' : 'Copy'}
              >
                {copied ? (
                  <CheckCircle weight="fill" className="w-3.5 h-3.5 text-[#4A6B53] dark:text-[#628C6E]" />
                ) : (
                  <Copy weight="regular" className="w-3.5 h-3.5 text-[#B65A46] dark:text-[#D2705A]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="px-4 py-4">
          <div className="bg-white dark:bg-[#1E1F1E] border border-[#E5E5E0] dark:border-[#2C2D2C] rounded-xl p-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {(user?.profile_photo_url || user?.profile_photo) ? (
                <img
                  src={user.profile_photo_url || user.profile_photo}
                  alt={user.full_name}
                  className="w-11 h-11 rounded-lg object-cover border border-[#E5E5E0] dark:border-[#2C2D2C]"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#B65A46] to-[#8B4513] dark:from-[#D2705A] dark:to-[#A0522D] flex items-center justify-center text-white font-semibold text-sm">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-[#1C1C1A] dark:text-[#F1F1F0] font-medium text-sm truncate">
                  {user?.full_name || 'User'}
                </p>
                <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-sm font-medium ${getRoleBadgeStyle(user?.role)}`}>
                  {user?.role || 'N/A'}
                </span>
              </div>
              
              {/* Notifications */}
              <NotificationCenter />
            </div>
            
            {/* Permissions */}
            <div className="mt-3 pt-3 border-t border-[#E5E5E0] dark:border-[#2C2D2C]">
              <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#686865] dark:text-[#8A8B8A] mb-2">
                {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
              </p>
              <div className="flex flex-wrap gap-1">
                {allPermissionModules.map((mod) => {
                  const allowed = hasAccess(mod.id);
                  return (
                    <span 
                      key={mod.id}
                      className={`p-1.5 rounded-md transition-colors cursor-default ${
                        allowed 
                          ? 'bg-[#4A6B53]/15 text-[#4A6B53] dark:bg-[#628C6E]/20 dark:text-[#628C6E]' 
                          : 'bg-[#9D4343]/15 text-[#9D4343] dark:bg-[#C65858]/20 dark:text-[#C65858]'
                      }`}
                      title={`${mod.name} - ${allowed ? (language === 'ar' ? 'مسموح' : 'Allowed') : (language === 'ar' ? 'غير مسموح' : 'Denied')}`}
                    >
                      {allowed ? (
                        <CheckCircle weight="fill" className="w-3.5 h-3.5" />
                      ) : (
                        <Lock weight="fill" className="w-3.5 h-3.5" />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {modules.map((module) => {
            const isActive = activeModule === module.id;
            const hasSubModules = module.hasSubModules && module.subModules?.length > 0;
            const isExpanded = expandedMenus[module.id];

            return (
              <div key={module.id}>
                <button
                  onClick={() => {
                    setActiveModule(module.id);
                    if (hasSubModules) {
                      toggleMenu(module.id);
                    }
                    if (module.id === 'hr') {
                      setActiveHRSubModule?.(null);
                      setActiveFinancialSubModule?.(null);
                      setActiveInvoiceSubModule?.(null);
                    } else if (module.id === 'financial') {
                      setActiveFinancialSubModule?.(null);
                      setActiveHRSubModule?.(null);
                      setActiveInvoiceSubModule?.(null);
                    } else if (module.id === 'invoices') {
                      setActiveInvoiceSubModule?.('invoices');
                      setActiveHRSubModule?.(null);
                      setActiveFinancialSubModule?.(null);
                    }
                  }}
                  data-testid={`nav-${module.id}-module`}
                  className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 group
                    ${isActive 
                      ? 'bg-[#B65A46]/10 dark:bg-[#D2705A]/15 border-s-2 border-[#B65A46] dark:border-[#D2705A] text-[#B65A46] dark:text-[#D2705A]' 
                      : 'text-[#1C1C1A] dark:text-[#F1F1F0] hover:bg-black/5 dark:hover:bg-white/5'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                      isActive 
                        ? 'bg-[#B65A46] dark:bg-[#D2705A] text-white' 
                        : 'bg-[#E5E5E0]/50 dark:bg-[#2C2D2C] text-[#686865] dark:text-[#8A8B8A] group-hover:bg-[#E5E5E0] dark:group-hover:bg-[#3C3D3C]'
                    }`}>
                      {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-4 h-4' })}
                    </span>
                    <span className="text-sm font-medium">{module.name}</span>
                  </div>
                  
                  {hasSubModules && (
                    <span className="text-[#686865] dark:text-[#8A8B8A]">
                      {isExpanded ? <CaretDown weight="bold" className="w-4 h-4" /> : <CaretRight weight="bold" className="w-4 h-4" />}
                    </span>
                  )}
                </button>

                {/* Sub-modules */}
                {hasSubModules && isExpanded && module.subModules && (
                  <div className="mt-1 ms-6 space-y-0.5 border-s border-[#E5E5E0] dark:border-[#2C2D2C]">
                    {module.subModules.map((subModule) => {
                      const isSubActive = module.id === 'hr' 
                        ? activeHRSubModule === subModule.id 
                        : module.id === 'invoices'
                        ? activeInvoiceSubModule === subModule.id
                        : activeFinancialSubModule === subModule.id;
                      
                      return (
                        <button
                          key={subModule.id}
                          onClick={() => {
                            if (module.id === 'hr') {
                              setActiveHRSubModule?.(subModule.id);
                            } else if (module.id === 'invoices') {
                              setActiveInvoiceSubModule?.(subModule.id);
                            } else {
                              setActiveFinancialSubModule?.(subModule.id);
                            }
                          }}
                          data-testid={`nav-${module.id}-${subModule.id}`}
                          className={`w-full flex items-center gap-2.5 ps-4 pe-3 py-2 text-sm transition-all rounded-e-lg
                            ${isSubActive 
                              ? 'bg-[#B65A46]/10 dark:bg-[#D2705A]/10 text-[#B65A46] dark:text-[#D2705A] font-medium border-s-2 border-[#B65A46] dark:border-[#D2705A] -ms-px' 
                              : 'text-[#686865] dark:text-[#8A8B8A] hover:text-[#1C1C1A] dark:hover:text-[#F1F1F0] hover:bg-black/5 dark:hover:bg-white/5'
                            }
                          `}
                        >
                          {subModule.icon && React.cloneElement(subModule.icon, { className: 'w-4 h-4' })}
                          <span>{subModule.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-[#E5E5E0]/60 dark:border-[#2C2D2C]/60">
          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Dark Mode */}
            <button
              onClick={toggleDarkMode}
              data-testid="dark-mode-toggle"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#E5E5E0]/50 dark:bg-[#2C2D2C] text-[#1C1C1A] dark:text-[#F1F1F0] hover:bg-[#E5E5E0] dark:hover:bg-[#3C3D3C] transition-colors"
              title={darkMode ? (language === 'ar' ? 'الوضع النهاري' : 'Light Mode') : (language === 'ar' ? 'الوضع الليلي' : 'Dark Mode')}
            >
              {darkMode ? <Sun weight="duotone" className="w-5 h-5" /> : <Moon weight="duotone" className="w-5 h-5" />}
            </button>
            
            {/* Language */}
            <button
              onClick={toggleLanguage}
              data-testid="lang-switcher-btn"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#E5E5E0]/50 dark:bg-[#2C2D2C] text-[#1C1C1A] dark:text-[#F1F1F0] hover:bg-[#E5E5E0] dark:hover:bg-[#3C3D3C] transition-colors"
              title={language === 'ar' ? 'English' : 'عربي'}
            >
              <Globe weight="duotone" className="w-5 h-5" />
              <span className="text-xs font-semibold">{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            
            {/* Settings */}
            <button
              onClick={() => setActiveModule?.('settings')}
              data-testid="nav-settings-btn"
              className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-lg transition-colors ${
                activeModule === 'settings'
                  ? 'bg-[#B65A46]/10 dark:bg-[#D2705A]/15 text-[#B65A46] dark:text-[#D2705A]'
                  : 'bg-[#E5E5E0]/50 dark:bg-[#2C2D2C] text-[#1C1C1A] dark:text-[#F1F1F0] hover:bg-[#E5E5E0] dark:hover:bg-[#3C3D3C]'
              }`}
              title={language === 'ar' ? 'الإعدادات' : 'Settings'}
            >
              <Gear weight={activeModule === 'settings' ? 'fill' : 'duotone'} className="w-5 h-5" />
            </button>
          </div>
          
          {/* Admin Dashboard - Only for Super Admin */}
          {(user?.role === 'Super Admin' || user?.role === 'مدير النظام') && (
            <button
              onClick={() => navigate('/admin')}
              data-testid="admin-dashboard-link"
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#9D4343]/10 dark:bg-[#C65858]/15 text-[#9D4343] dark:text-[#C65858] hover:bg-[#9D4343]/20 dark:hover:bg-[#C65858]/25 transition-colors"
            >
              <ShieldCheck weight="duotone" className="w-5 h-5" />
              <span className="text-sm font-medium">{language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}</span>
            </button>
          )}
          
          {/* Logout */}
          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[#9D4343] dark:text-[#C65858] hover:bg-[#9D4343]/10 dark:hover:bg-[#C65858]/15 transition-colors"
          >
            <SignOut weight="duotone" className="w-5 h-5" />
            <span className="text-sm font-medium">{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ModernSidebar;
