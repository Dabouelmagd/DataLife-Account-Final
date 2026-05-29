import React, { useState } from 'react';
import { 
  Home, Users, Wallet, FileText, Settings, LogOut, ChevronDown, ChevronRight,
  BarChart3, Shield, Bell, Clock, FolderKanban, Package, CreditCard, 
  UserCheck, FileCheck, Building2, PieChart, TrendingUp, Globe, ClipboardList,
  Boxes, CheckCircle2, Moon, Sun, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import NotificationCenter from './NotificationCenter';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePlan } from '../contexts/PlanContext';

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
  onLogout,
  navigate,
  company
}) => {
  const isRTL = language === 'ar';
  const [expandedMenus, setExpandedMenus] = useState({});
  const { toggleLanguage } = useLanguage();
  const { darkMode, toggleDarkMode } = useTheme();
  const { isUnlocked, planLabelAr, planLabelEn } = usePlan();

  const showLockedToast = (moduleName) => {
    toast.error(
      language === 'ar'
        ? `🔒 ${moduleName} غير متاحة في باقتك الحالية. يرجى الترقية للوصول لهذه الميزة.`
        : `🔒 ${moduleName} is not available in your current plan. Please upgrade to access it.`,
      {
        duration: 4000,
        action: {
          label: language === 'ar' ? 'ترقية الباقة' : 'Upgrade Plan',
          onClick: () => { navigate?.('/subscription'); },
        },
      }
    );
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  // Role-based styling
  const getRoleBadgeStyle = (role) => {
    const roleStyles = {
      'CEO': 'from-amber-400 to-orange-500',
      'المدير التنفيذي': 'from-amber-400 to-orange-500',
      'Board Chairman': 'from-amber-400 to-orange-500',
      'رئيس مجلس الإدارة': 'from-amber-400 to-orange-500',
      'General Manager': 'from-violet-400 to-purple-500',
      'مدير عام': 'from-violet-400 to-purple-500',
      'Financial Manager': 'from-emerald-400 to-teal-500',
      'المدير المالي': 'from-emerald-400 to-teal-500',
      'HR Manager': 'from-blue-400 to-cyan-500',
      'مدير الموارد البشرية': 'from-blue-400 to-cyan-500',
    };
    return roleStyles[role] || 'from-slate-400 to-slate-500';
  };

  return (
    <aside className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-screen w-72 z-50`}>
      {/* Modern Glassmorphism Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col z-10">
        {/* Company Logo Section - At Top (slim) */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Company Logo */}
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg overflow-hidden">
              {company?.logo_url ? (
                <img 
                  src={company.logo_url}
                  alt={company.name || "Company Logo"} 
                  className="w-9 h-9 object-contain"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-bold text-sm tracking-tight truncate">
                {company?.name || (language === 'ar' ? 'شركتك' : 'Your Company')}
              </h1>
              <p className="text-slate-400 text-[10px]">ERP System</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {modules.map((module) => {
            const isActive = activeModule === module.id;
            const hasSubModules = module.hasSubModules && module.subModules?.length > 0;
            const isExpanded = expandedMenus[module.id];
            const moduleUnlocked = isUnlocked(module.id);

            return (
              <div key={module.id}>
                <button
                  data-testid={`sidebar-module-${module.id}`}
                  onClick={() => {
                    if (!moduleUnlocked) {
                      showLockedToast(module.name);
                      return;
                    }
                    setActiveModule(module.id);
                    if (hasSubModules) {
                      toggleMenu(module.id);
                    }
                    if (module.id === 'hr') {
                      setActiveHRSubModule?.(null);
                      setActiveFinancialSubModule?.(null);
                    } else if (module.id === 'financial') {
                      setActiveFinancialSubModule?.(null);
                      setActiveHRSubModule?.(null);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group
                    ${!moduleUnlocked
                      ? 'text-slate-500 opacity-60 cursor-not-allowed hover:bg-white/5'
                      : isActive
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <span className={`p-2 rounded-lg transition-all ${
                    !moduleUnlocked
                      ? 'bg-white/5 text-slate-500'
                      : isActive
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-white/10 text-slate-400 group-hover:bg-white/15'
                  }`}>
                    {React.cloneElement(module.icon, { className: 'h-4 w-4' })}
                  </span>
                  
                  <span className="flex-1 text-sm text-start">{module.name}</span>

                  {!moduleUnlocked && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-300/80" data-testid={`locked-${module.id}`}>
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                  
                  {moduleUnlocked && hasSubModules && (
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  )}
                </button>

                {/* Sub-modules */}
                {moduleUnlocked && hasSubModules && isExpanded && module.subModules && (
                  <div className={`mt-1 ${isRTL ? 'mr-4' : 'ml-4'} space-y-1`}>
                    {module.subModules.map((subModule) => {
                      const isSubActive = (module.id === 'hr' ? activeHRSubModule : activeFinancialSubModule) === subModule.id;
                      
                      return (
                        <button
                          key={subModule.id}
                          onClick={() => {
                            if (module.id === 'hr') {
                              setActiveHRSubModule?.(subModule.id);
                            } else {
                              setActiveFinancialSubModule?.(subModule.id);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all
                            ${isSubActive 
                              ? 'bg-blue-500/20 text-blue-300 border-l-2 border-blue-500' 
                              : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }
                          `}
                        >
                          {React.cloneElement(subModule.icon, { className: 'h-4 w-4' })}
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

        {/* Bottom Section */}
        <div className="p-3 border-t border-white/10 space-y-1.5">
          {/* Admin Dashboard Link - Only for Super Admin */}
          {(user?.role === 'Super Admin' || user?.role === 'مدير النظام') && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 text-red-300 hover:from-red-500/30 hover:to-pink-500/30 transition-all"
              data-testid="admin-dashboard-link"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">{language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setActiveModule?.('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all
              ${activeModule === 'settings'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ModernSidebar;
