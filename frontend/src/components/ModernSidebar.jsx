import React, { useState } from 'react';
import { 
  House, Users, Wallet, FileText, Gear, SignOut, CaretDown, CaretRight,
  ChartBar, ShieldCheck, Bell, Clock, Folders, Package, CreditCard, 
  UserCheck, FileCheck, Buildings, PieChart, Globe, ClipboardText,
  Cube, CheckCircle, Moon, Sun, Lock, Copy, CaretUp, Tag,
  UploadSimple, Book, Gift
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
  const [showPermissions, setShowPermissions] = useState(false);
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

  // Module colors - different for each category
  const getModuleColor = (moduleId) => {
    const colors = {
      // HR - Blue/Cyan
      'hr': { 
        bg: 'bg-cyan-500/10 dark:bg-cyan-500/15', 
        border: 'border-cyan-500',
        text: 'text-cyan-600 dark:text-cyan-400',
        icon: 'bg-cyan-500 dark:bg-cyan-600'
      },
      // Financial - Green/Emerald
      'financial': { 
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', 
        border: 'border-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        icon: 'bg-emerald-500 dark:bg-emerald-600'
      },
      // Invoices - Orange/Amber
      'invoices': { 
        bg: 'bg-amber-500/10 dark:bg-amber-500/15', 
        border: 'border-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        icon: 'bg-amber-500 dark:bg-amber-600'
      },
      // Reports - Purple/Violet
      'reports': { 
        bg: 'bg-violet-500/10 dark:bg-violet-500/15', 
        border: 'border-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        icon: 'bg-violet-500 dark:bg-violet-600'
      },
      'report-management': { 
        bg: 'bg-violet-500/10 dark:bg-violet-500/15', 
        border: 'border-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        icon: 'bg-violet-500 dark:bg-violet-600'
      },
      'analytics': { 
        bg: 'bg-violet-500/10 dark:bg-violet-500/15', 
        border: 'border-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        icon: 'bg-violet-500 dark:bg-violet-600'
      },
      // Purchases - Rose/Pink
      'purchases': { 
        bg: 'bg-rose-500/10 dark:bg-rose-500/15', 
        border: 'border-rose-500',
        text: 'text-rose-600 dark:text-rose-400',
        icon: 'bg-rose-500 dark:bg-rose-600'
      },
      // Inventory - Teal
      'inventory': { 
        bg: 'bg-teal-500/10 dark:bg-teal-500/15', 
        border: 'border-teal-500',
        text: 'text-teal-600 dark:text-teal-400',
        icon: 'bg-teal-500 dark:bg-teal-600'
      },
      // Projects - Indigo
      'projects': { 
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/15', 
        border: 'border-indigo-500',
        text: 'text-indigo-600 dark:text-indigo-400',
        icon: 'bg-indigo-500 dark:bg-indigo-600'
      },
      // Sales CRM - Orange
      'sales': { 
        bg: 'bg-orange-500/10 dark:bg-orange-500/15', 
        border: 'border-orange-500',
        text: 'text-orange-600 dark:text-orange-400',
        icon: 'bg-orange-500 dark:bg-orange-600'
      },
      // Assets - Purple
      'assets': { 
        bg: 'bg-purple-500/10 dark:bg-purple-500/15', 
        border: 'border-purple-500',
        text: 'text-purple-600 dark:text-purple-400',
        icon: 'bg-purple-500 dark:bg-purple-600'
      },
      // Approvals - Green
      'approvals': { 
        bg: 'bg-green-500/10 dark:bg-green-500/15', 
        border: 'border-green-500',
        text: 'text-green-600 dark:text-green-400',
        icon: 'bg-green-500 dark:bg-green-600'
      },
      // User Guide - Sky
      'user-guide': { 
        bg: 'bg-sky-500/10 dark:bg-sky-500/15', 
        border: 'border-sky-500',
        text: 'text-sky-600 dark:text-sky-400',
        icon: 'bg-sky-500 dark:bg-sky-600'
      },
      // Referral - Violet
      'referral': { 
        bg: 'bg-violet-500/10 dark:bg-violet-500/15', 
        border: 'border-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        icon: 'bg-violet-500 dark:bg-violet-600'
      },
      // Import - Slate
      'import': { 
        bg: 'bg-slate-500/10 dark:bg-slate-500/15', 
        border: 'border-slate-400',
        text: 'text-slate-600 dark:text-slate-400',
        icon: 'bg-slate-400 dark:bg-slate-500'
      },
      // Default - Slate
      'default': { 
        bg: 'bg-slate-500/10 dark:bg-slate-500/15', 
        border: 'border-slate-500',
        text: 'text-slate-600 dark:text-slate-400',
        icon: 'bg-slate-500 dark:bg-slate-600'
      }
    };
    return colors[moduleId] || colors['default'];
  };

  // Role badge colors
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
      'HR Manager': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
      'مدير الموارد البشرية': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    };
    return roleStyles[role] || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
  };

  // Module icons
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
      'report-management': <ClipboardText weight={weight} />,
      'analytics': <ChartBar weight={weight} />,
      'inventory': <Cube weight={weight} />,
      'settings':    <Gear weight={weight} />,
      'coupons':     <Tag weight={weight} />,
      'users':       <UserCheck weight={weight} />,
      'approvals':   <CheckCircle weight={weight} />,
      'sales':       <ChartBar weight={weight} />,
      'assets':      <Buildings weight={weight} />,
      'import':      <UploadSimple weight={weight} />,
      'user-guide':  <Book weight={weight} />,
      'referral':    <Gift weight={weight} />,
      'super-admin': <ShieldCheck weight={weight} />,
    };
    return iconMap[moduleId] || <House weight={weight} />;
  };

  // Permission modules with colors and modern icons (13 permissions - HR split)
  const permissionModules = [
    { id: 'dashboard', name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', color: 'bg-gradient-to-r from-slate-500 to-slate-600', icon: '🏠' },
    { id: 'hr_admin', name: language === 'ar' ? 'الموارد البشرية - إداري' : 'HR - Administrative', color: 'bg-gradient-to-r from-cyan-500 to-blue-500', icon: '👥', desc: language === 'ar' ? 'حضور، إجازات' : 'Attendance, Leaves' },
    { id: 'hr_financial', name: language === 'ar' ? 'الموارد البشرية - مالي' : 'HR - Financial', color: 'bg-gradient-to-r from-teal-500 to-emerald-500', icon: '💵', desc: language === 'ar' ? 'رواتب، بدلات' : 'Payroll, Allowances' },
    { id: 'financial', name: language === 'ar' ? 'الإدارة المالية' : 'Financial Management', color: 'bg-gradient-to-r from-emerald-500 to-green-600', icon: '💰' },
    { id: 'invoices', name: language === 'ar' ? 'الفواتير' : 'Invoices', color: 'bg-gradient-to-r from-amber-500 to-orange-500', icon: '📄' },
    { id: 'purchases', name: language === 'ar' ? 'المشتريات' : 'Purchases', color: 'bg-gradient-to-r from-rose-500 to-pink-500', icon: '🛒' },
    { id: 'projects', name: language === 'ar' ? 'المشاريع والمهام' : 'Projects & Tasks', color: 'bg-gradient-to-r from-indigo-500 to-purple-500', icon: '📊' },
    { id: 'reports', name: language === 'ar' ? 'التقارير' : 'Reports', color: 'bg-gradient-to-r from-violet-500 to-purple-600', icon: '📑' },
    { id: 'analytics', name: language === 'ar' ? 'التحليلات' : 'Analytics', color: 'bg-gradient-to-r from-blue-500 to-indigo-600', icon: '📈' },
    { id: 'inventory', name: language === 'ar' ? 'المخزون' : 'Inventory', color: 'bg-gradient-to-r from-teal-500 to-cyan-600', icon: '📦' },
    { id: 'settings', name: language === 'ar' ? 'الإعدادات' : 'Settings', color: 'bg-gradient-to-r from-gray-500 to-gray-600', icon: '⚙️' },
    { id: 'coupons', name: language === 'ar' ? 'إدارة الكوبونات' : 'Coupon Management', color: 'bg-gradient-to-r from-amber-500 to-orange-500', icon: '🏷️' },
    { id: 'users', name: language === 'ar' ? 'إدارة المستخدمين' : 'User Management', color: 'bg-gradient-to-r from-blue-500 to-cyan-500', icon: '👤' },
    { id: 'approvals', name: language === 'ar' ? 'الموافقات' : 'Approvals', color: 'bg-gradient-to-r from-green-500 to-emerald-600', icon: '✅' },
  ];

  const hasAccess = (moduleId) => {
    // Check for legacy 'hr' permission and map to new hr_admin/hr_financial
    const userPermissions = user?.permissions || [];
    const hasLegacyHR = userPermissions.includes('hr');
    
    if ((moduleId === 'hr_admin' || moduleId === 'hr_financial') && hasLegacyHR) {
      return true;
    }
    
    return modules.some(m => m.id === moduleId) || 
           userPermissions.includes(moduleId) ||
           ['رئيس مجلس الإدارة', 'Board Chairman', 'مدير عام', 'General Manager', 'المدير التنفيذي', 'CEO'].includes(user?.role);
  };

  // Group modules - Main modules with sub-menus vs others
  // Modules with sub-menus (accordion style)
  const MAIN_MODULE_IDS = ['hr', 'financial', 'invoices'];
  const mainModules  = modules.filter(m => MAIN_MODULE_IDS.includes(m.id));
  const otherModules = modules.filter(m => !MAIN_MODULE_IDS.includes(m.id));

  return (
    <aside 
      className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-screen w-[260px] z-50 transition-colors duration-300`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[#FAFAFA] dark:bg-[#0F0F0F] border-e border-gray-200 dark:border-gray-800" />

      {/* Content */}
      <div className="relative h-full flex flex-col z-10">
        
        {/* Company Logo + User Section */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {/* Company Logo */}
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shadow-sm">
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company.name || "Company"} className="w-8 h-8 object-contain" />
              ) : (
                <Buildings weight="duotone" className="w-5 h-5 text-gray-500" />
              )}
            </div>
            
            {/* User Avatar */}
            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-cyan-500 dark:border-cyan-400">
              {(user?.profile_photo_url || user?.profile_photo) ? (
                <img src={user.profile_photo_url || user.profile_photo} alt={user.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-gray-100 font-semibold text-sm truncate">
                {user?.full_name || 'User'}
              </p>
              <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-medium ${getRoleBadgeStyle(user?.role)}`}>
                {user?.role || 'N/A'}
              </span>
            </div>
            
            <NotificationCenter />
          </div>
          
          {/* Subscription Code - Compact */}
          <div className="mt-2 flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded px-2 py-1.5">
            <code className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
              {user?.subscription_code || user?.company_id?.slice(0, 8).toUpperCase() || '--------'}
            </code>
            <button onClick={copyCode} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
              {copied ? <CheckCircle weight="fill" className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          </div>
          
          {/* Permissions - Collapsible */}
          <div className="mt-2">
            <button 
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <span>{language === 'ar' ? 'الصلاحيات' : 'Permissions'}</span>
              {showPermissions ? <CaretUp weight="bold" className="w-3 h-3" /> : <CaretDown weight="bold" className="w-3 h-3" />}
            </button>
            
            {showPermissions && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-2 max-h-72 overflow-y-auto">
                <div className="space-y-1">
                  {permissionModules.map((mod) => {
                    const allowed = hasAccess(mod.id);
                    return (
                      <div 
                        key={mod.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                          allowed 
                            ? 'bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700' 
                            : 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
                        }`}
                        title={`${mod.name} - ${allowed ? (language === 'ar' ? 'مفعّل' : 'Enabled') : (language === 'ar' ? 'غير مفعّل' : 'Disabled')}`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${allowed ? mod.color + ' text-white shadow-sm' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          {mod.icon}
                        </span>
                        <span className={`flex-1 text-xs font-medium ${allowed ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                          {mod.name}
                        </span>
                        {allowed ? (
                          <CheckCircle weight="fill" className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Lock weight="fill" className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-center">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    {language === 'ar' 
                      ? `${permissionModules.filter(m => hasAccess(m.id)).length} من ${permissionModules.length} صلاحية مفعّلة`
                      : `${permissionModules.filter(m => hasAccess(m.id)).length} of ${permissionModules.length} permissions enabled`
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
          {/* Dashboard and other simple modules */}
          {otherModules.filter(m => m.id === 'dashboard').map((module) => {
            const isActive = activeModule === module.id;
            const colors = getModuleColor(module.id);
            return (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                data-testid={`nav-${module.id}-module`}
                className={`w-full flex items-center gap-2 py-2 px-2.5 rounded-lg mb-1 transition-all
                  ${isActive ? `${colors.bg} border-s-2 ${colors.border} ${colors.text}` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-md ${isActive ? `${colors.icon} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                  {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-4 h-4' })}
                </span>
                <span className="text-sm font-medium">{module.name}</span>
              </button>
            );
          })}

          {/* Main Modules — with sub-menus */}
          {mainModules.length > 0 && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2.5 mt-3 mb-1">
              {language === 'ar' ? 'الوحدات الرئيسية' : 'MAIN MODULES'}
            </p>
          )}
          <div className="mt-0">
            {mainModules.map((module) => {
              const isActive = activeModule === module.id;
              const hasSubModules = module.hasSubModules && module.subModules?.length > 0;
              const isExpanded = expandedMenus[module.id];
              const colors = getModuleColor(module.id);

              return (
                <div key={module.id} className="mb-0.5">
                  <button
                    onClick={() => {
                      setActiveModule(module.id);
                      if (hasSubModules) toggleMenu(module.id);
                      if (module.id === 'hr') { setActiveHRSubModule?.(null); setActiveFinancialSubModule?.(null); setActiveInvoiceSubModule?.(null); }
                      else if (module.id === 'financial') { setActiveFinancialSubModule?.(null); setActiveHRSubModule?.(null); setActiveInvoiceSubModule?.(null); }
                      else if (module.id === 'invoices') { setActiveInvoiceSubModule?.('overview'); setActiveHRSubModule?.(null); setActiveFinancialSubModule?.(null); }
                    }}
                    data-testid={`nav-${module.id}-module`}
                    className={`w-full flex items-center justify-between py-2 px-2.5 rounded-lg transition-all
                      ${isActive ? `${colors.bg} border-s-2 ${colors.border} ${colors.text}` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-md ${isActive ? `${colors.icon} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-4 h-4' })}
                      </span>
                      <span className="text-sm font-bold">{module.name}</span>
                    </div>
                    {hasSubModules && (
                      <span className="text-gray-400">
                        {isExpanded ? <CaretDown weight="bold" className="w-3.5 h-3.5" /> : <CaretRight weight="bold" className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </button>

                  {/* Sub-modules - Not Bold - With Dividers */}
                  {hasSubModules && isExpanded && module.subModules && (
                    <div className="ms-4 mt-0.5 space-y-0 border-s border-gray-200 dark:border-gray-700">
                      {module.subModules.map((subModule) => {
                        // Handle dividers
                        if (subModule.isDivider) {
                          return (
                            <div 
                              key={subModule.id}
                              className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                            >
                              {subModule.name}
                            </div>
                          );
                        }
                        
                        const isSubActive = module.id === 'hr' ? activeHRSubModule === subModule.id 
                          : module.id === 'invoices' ? activeInvoiceSubModule === subModule.id
                          : activeFinancialSubModule === subModule.id;
                        
                        return (
                          <button
                            key={subModule.id}
                            onClick={() => {
                              if (module.id === 'hr') setActiveHRSubModule?.(subModule.id);
                              else if (module.id === 'invoices') setActiveInvoiceSubModule?.(subModule.id);
                              else setActiveFinancialSubModule?.(subModule.id);
                            }}
                            data-testid={`nav-${module.id}-${subModule.id}`}
                            className={`w-full flex items-center gap-2 ps-3 pe-2 py-1.5 text-[13px] rounded-e transition-all
                              ${isSubActive ? `${colors.bg} ${colors.text} border-s-2 ${colors.border} -ms-px font-medium` : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                            `}
                          >
                            {subModule.icon && React.cloneElement(subModule.icon, { className: 'w-3.5 h-3.5' })}
                            <span>{subModule.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Other Modules — grouped by category */}
          {otherModules.filter(m => m.id !== 'dashboard' && m.id !== 'settings').length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">

              {/* Section label: Business modules */}
              {otherModules.some(m => ['sales','purchases','projects','assets'].includes(m.id)) && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2.5 mt-1 mb-1">
                  {language === 'ar' ? 'الأعمال' : 'BUSINESS'}
                </p>
              )}
              {otherModules.filter(m => ['sales','purchases','projects','assets'].includes(m.id)).map((module) => {
                const isActive = activeModule === module.id;
                const colors = getModuleColor(module.id);
                return (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    data-testid={`nav-${module.id}-module`}
                    className={`w-full flex items-center gap-2 py-2 px-2.5 rounded-lg mb-0.5 transition-all
                      ${isActive ? `${colors.bg} border-s-2 ${colors.border} ${colors.text}` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    `}
                  >
                    <span className={`w-7 h-7 flex items-center justify-center rounded-md ${isActive ? `${colors.icon} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-4 h-4' })}
                    </span>
                    <span className="text-sm font-medium">{module.name}</span>
                  </button>
                );
              })}

              {/* Section label: Reports & Management */}
              {otherModules.some(m => ['analytics','system-reports','approvals'].includes(m.id)) && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2.5 mt-3 mb-1">
                  {language === 'ar' ? 'التقارير والإدارة' : 'REPORTS'}
                </p>
              )}
              {otherModules.filter(m => ['analytics','system-reports','approvals'].includes(m.id)).map((module) => {
                const isActive = activeModule === module.id;
                const colors = getModuleColor(module.id);
                return (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    data-testid={`nav-${module.id}-module`}
                    className={`w-full flex items-center gap-2 py-2 px-2.5 rounded-lg mb-0.5 transition-all
                      ${isActive ? `${colors.bg} border-s-2 ${colors.border} ${colors.text}` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    `}
                  >
                    <span className={`w-7 h-7 flex items-center justify-center rounded-md ${isActive ? `${colors.icon} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-4 h-4' })}
                    </span>
                    <span className="text-sm font-medium">{module.name}</span>
                  </button>
                );
              })}

              {/* Section label: Tools */}
              {otherModules.some(m => ['import','user-guide','super-admin','referral'].includes(m.id)) && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2.5 mt-3 mb-1">
                  {language === 'ar' ? 'أدوات' : 'TOOLS'}
                </p>
              )}
              {otherModules.filter(m => ['import','user-guide','super-admin','referral'].includes(m.id)).map((module) => {
                const isActive = activeModule === module.id;
                const colors = getModuleColor(module.id);
                return (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    data-testid={`nav-${module.id}-module`}
                    className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg mb-0.5 transition-all
                      ${isActive ? `${colors.bg} border-s-2 ${colors.border} ${colors.text}` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    `}
                  >
                    <span className={`w-6 h-6 flex items-center justify-center rounded-md ${isActive ? `${colors.icon} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {React.cloneElement(getModuleIcon(module.id, isActive), { className: 'w-3.5 h-3.5' })}
                    </span>
                    <span className="text-sm">{module.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Bottom Actions - Compact */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-1">
            {/* Dark Mode */}
            <button onClick={toggleDarkMode} data-testid="dark-mode-toggle"
              className="flex-1 flex items-center justify-center py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {darkMode ? <Sun weight="duotone" className="w-4 h-4 text-amber-500" /> : <Moon weight="duotone" className="w-4 h-4 text-indigo-500" />}
            </button>
            
            {/* Language */}
            <button onClick={toggleLanguage} data-testid="lang-switcher-btn"
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <Globe weight="duotone" className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            
            {/* Settings */}
            <button onClick={() => setActiveModule?.('settings')} data-testid="nav-settings-btn"
              className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-colors ${activeModule === 'settings' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              <Gear weight={activeModule === 'settings' ? 'fill' : 'duotone'} className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          {/* Admin + Logout */}
          <div className="flex items-center gap-1 mt-1">
            {(user?.role === 'Super Admin' || user?.role === 'مدير النظام') && (
              <button onClick={() => navigate('/admin')} data-testid="admin-dashboard-link"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <ShieldCheck weight="duotone" className="w-4 h-4" />
                <span className="text-xs font-medium">{language === 'ar' ? 'الإدارة' : 'Admin'}</span>
              </button>
            )}
            <button onClick={onLogout} data-testid="logout-btn"
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <SignOut weight="duotone" className="w-4 h-4" />
              <span className="text-xs font-medium">{language === 'ar' ? 'خروج' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ModernSidebar;
