import React, { useState } from 'react';
import { 
  Home, Users, Wallet, FileText, Settings, LogOut, ChevronDown, ChevronRight,
  BarChart3, Shield, Bell, Clock, FolderKanban, Package, CreditCard, 
  UserCheck, FileCheck, Building2, PieChart, TrendingUp
} from 'lucide-react';
import { Badge } from './ui/badge';
import NotificationCenter from './NotificationCenter';

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
  navigate
}) => {
  const isRTL = language === 'ar';
  const [expandedMenus, setExpandedMenus] = useState({});

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
        {/* Logo Section */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">DataLife</h1>
              <p className="text-slate-400 text-xs">ERP System</p>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-4">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={user.full_name}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {user?.full_name || 'User'}
                </p>
                <Badge className={`mt-1 text-[10px] px-2 py-0 bg-gradient-to-r ${getRoleBadgeStyle(user?.role)} text-white border-0`}>
                  {user?.role || 'N/A'}
                </Badge>
              </div>
              
              {/* Notifications */}
              <NotificationCenter />
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
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
                    } else if (module.id === 'financial') {
                      setActiveFinancialSubModule?.(null);
                      setActiveHRSubModule?.(null);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <span className={`p-2 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
                      : 'bg-white/10 text-slate-400 group-hover:bg-white/15'
                  }`}>
                    {React.cloneElement(module.icon, { className: 'h-4 w-4' })}
                  </span>
                  
                  <span className="flex-1 text-sm text-start">{module.name}</span>
                  
                  {hasSubModules && (
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  )}
                </button>

                {/* Sub-modules */}
                {hasSubModules && isExpanded && module.subModules && (
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
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Subscription Status */}
          <button
            onClick={() => navigate?.('/subscription')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            <CreditCard className="h-4 w-4" />
            <span className="text-sm">{language === 'ar' ? 'الاشتراك' : 'Subscription'}</span>
          </button>
          
          {/* Settings */}
          <button
            onClick={() => setActiveModule?.('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
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
