import React, { useState, useRef, useEffect } from 'react';
import {
  Moon, Sun, Globe, ShieldCheck, CreditCard, Copy, Check,
  ChevronDown, Sparkles, Lock, Home, Users, Building2, FileText,
  Package, FolderKanban, ClipboardList, BarChart3, Boxes, Settings,
  UserCheck, CheckCircle2, MoreVertical,
} from 'lucide-react';
import { Badge } from './ui/badge';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePlan } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * TopHeaderBar — slim utility bar that frees up the sidebar.
 * Hosts dark-mode + language toggles, subscription code, plan badge,
 * permissions popover, and the user avatar.
 */
const TopHeaderBar = ({ company }) => {
  const { language, toggleLanguage } = useLanguage();
  const { darkMode, toggleDarkMode } = useTheme();
  const { planLabelAr, planLabelEn, plan, isUnlocked } = usePlan();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [copied, setCopied] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const permRef = useRef(null);
  const moreRef = useRef(null);

  const subscriptionCode =
    user?.subscription_code ||
    (user?.company_id ? user.company_id.slice(0, 8).toUpperCase() : '--------');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(subscriptionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  // Close popovers on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (permRef.current && !permRef.current.contains(e.target)) {
        setPermOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Plan badge color
  const planColor = {
    starter: 'from-blue-500 to-blue-600',
    professional: 'from-purple-500 to-fuchsia-600',
    enterprise: 'from-amber-500 to-orange-600',
    'hr-only': 'from-pink-500 to-rose-600',
    'financial-only': 'from-emerald-500 to-teal-600',
    'inventory-only': 'from-cyan-500 to-sky-600',
    lifetime: 'from-yellow-500 to-amber-600',
    trial: 'from-indigo-500 to-purple-600',
  }[plan] || 'from-indigo-500 to-purple-600';

  // All modules for permissions popover
  const allModules = [
    { id: 'dashboard', name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard', icon: <Home /> },
    { id: 'hr',        name: language === 'ar' ? 'الموارد البشرية' : 'HR', icon: <Users /> },
    { id: 'financial', name: language === 'ar' ? 'المالية' : 'Financial', icon: <Building2 /> },
    { id: 'invoices',  name: language === 'ar' ? 'الفواتير' : 'Invoices', icon: <FileText /> },
    { id: 'purchases', name: language === 'ar' ? 'المشتريات' : 'Purchases', icon: <Package /> },
    { id: 'projects',  name: language === 'ar' ? 'المشاريع' : 'Projects', icon: <FolderKanban /> },
    { id: 'reports',   name: language === 'ar' ? 'التقارير' : 'Reports', icon: <ClipboardList /> },
    { id: 'analytics', name: language === 'ar' ? 'التحليلات' : 'Analytics', icon: <BarChart3 /> },
    { id: 'inventory', name: language === 'ar' ? 'المخزون' : 'Inventory', icon: <Boxes /> },
    { id: 'settings',  name: language === 'ar' ? 'الإعدادات' : 'Settings', icon: <Settings /> },
    { id: 'users',     name: language === 'ar' ? 'إدارة المستخدمين' : 'Users', icon: <UserCheck /> },
    { id: 'approvals', name: language === 'ar' ? 'الموافقات' : 'Approvals', icon: <CheckCircle2 /> },
  ];

  const isTopManager = [
    'رئيس مجلس الإدارة', 'Board Chairman',
    'مدير عام', 'General Manager',
    'المدير التنفيذي', 'CEO', 'Super Admin',
  ].includes(user?.role);

  const hasModulePermission = (id) =>
    isTopManager ||
    (user?.permissions && user.permissions.includes(id));

  const allowedCount = allModules.filter((m) => hasModulePermission(m.id)).length;

  const getRoleBadgeStyle = (role) => {
    if (!role) return 'from-gray-500 to-gray-600';
    if (['رئيس مجلس الإدارة', 'Board Chairman', 'مدير عام', 'General Manager', 'المدير التنفيذي', 'CEO', 'Super Admin'].includes(role)) {
      return 'from-amber-500 to-orange-600';
    }
    if (role.includes('مدير') || role.toLowerCase().includes('manager')) return 'from-indigo-500 to-purple-600';
    return 'from-emerald-500 to-teal-600';
  };

  return (
    <header
      className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700 shadow-sm"
      data-testid="top-header-bar"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="px-3 sm:px-6 py-2 flex items-center gap-2 sm:gap-3">
        {/* Left: Company name + plan (company name hidden on mobile) */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {company?.name && (
            <span className="hidden xl:inline text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
              {company.name}
            </span>
          )}
          <div
            className={`inline-flex items-center gap-1 bg-gradient-to-r ${planColor} text-white text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-full shadow-sm`}
            data-testid="header-plan-badge"
            title={language === 'ar' ? 'نوع الحساب' : 'Account type'}
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline whitespace-nowrap">
              {language === 'ar' ? planLabelAr : planLabelEn}
            </span>
          </div>
        </div>

        {/* Center: Global Search (grows to fill) */}
        <div className="flex-1 flex justify-center min-w-0">
          <GlobalSearch />
        </div>

        {/* Right: utility buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Subscription code chip - hidden on small mobile, visible from sm */}
          <button
            onClick={copyCode}
            className="hidden sm:inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-2.5 py-1.5 rounded-lg transition-colors group"
            title={language === 'ar' ? 'انقر لنسخ كود الاشتراك' : 'Click to copy subscription code'}
            data-testid="header-subscription-code"
          >
            <CreditCard className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
            <code className="text-xs font-mono font-bold text-amber-700 dark:text-amber-200 tracking-wider">
              {subscriptionCode}
            </code>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 opacity-60 group-hover:opacity-100" />
            )}
          </button>

          {/* Permissions popover - hidden on mobile, in More menu */}
          <div className="relative hidden lg:block" ref={permRef}>
            <button
              onClick={() => setPermOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors"
              title={language === 'ar' ? 'صلاحياتي' : 'My permissions'}
              data-testid="header-permissions-btn"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                {allowedCount}/{allModules.length}
              </span>
              <ChevronDown className={`h-3 w-3 text-emerald-600 dark:text-emerald-400 transition-transform ${permOpen ? 'rotate-180' : ''}`} />
            </button>
            {permOpen && (
              <div
                className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3 z-40`}
                data-testid="permissions-popover"
              >
                <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">
                  {language === 'ar' ? 'الصلاحيات والوحدات' : 'Permissions & Modules'}
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {allModules.map((m) => {
                    const allowed = hasModulePermission(m.id);
                    const locked = !isUnlocked(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
                          locked
                            ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                            : allowed
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                        }`}
                        title={locked
                          ? (language === 'ar' ? 'مقفولة بالباقة' : 'Locked by plan')
                          : allowed ? (language === 'ar' ? 'مسموح' : 'Allowed') : (language === 'ar' ? 'غير مسموح' : 'Not allowed')
                        }
                      >
                        {React.cloneElement(m.icon, { className: 'h-3.5 w-3.5 shrink-0' })}
                        <span className="truncate flex-1">{m.name}</span>
                        {locked ? (
                          <Lock className="h-3 w-3 shrink-0" />
                        ) : allowed ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Dark mode - always visible */}
          <button
            onClick={toggleDarkMode}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={language === 'ar' ? 'الوضع الليلي/النهاري' : 'Toggle dark mode'}
            data-testid="header-dark-mode"
          >
            {darkMode
              ? <Sun className="h-4 w-4 text-amber-500" />
              : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {/* Language - always visible */}
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={language === 'ar' ? 'Switch language' : 'تبديل اللغة'}
            data-testid="header-language"
          >
            <Globe className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {language === 'ar' ? 'EN' : 'عربي'}
            </span>
          </button>

          {/* Notifications */}
          <div className="flex items-center">
            <NotificationCenter />
          </div>

          {/* User chip (compact on mobile) */}
          <div className="flex items-center gap-2 px-1.5 sm:px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(user?.profile_photo_url || user?.profile_photo) ? (
              <img
                src={user.profile_photo_url || user.profile_photo}
                alt={user.full_name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-600"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </div>
            )}
            <div className="hidden xl:flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                {user?.full_name || 'User'}
              </span>
              <Badge className={`text-[9px] px-1.5 py-0 bg-gradient-to-r ${getRoleBadgeStyle(user?.role)} text-white border-0 w-fit`}>
                {user?.role || 'N/A'}
              </Badge>
            </div>
          </div>

          {/* "More" menu — visible only on mobile to expose hidden controls */}
          <div className="relative lg:hidden" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
              title={language === 'ar' ? 'المزيد' : 'More'}
              data-testid="header-more-btn"
            >
              <MoreVertical className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>
            {moreOpen && (
              <div
                className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3 z-40`}
                data-testid="more-menu"
              >
                {/* Subscription code (mobile) */}
                <button
                  onClick={() => { copyCode(); }}
                  className="w-full flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-lg mb-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CreditCard className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      {language === 'ar' ? 'كود الاشتراك' : 'Code'}
                    </span>
                  </div>
                  <code className="text-xs font-mono font-bold text-amber-700 dark:text-amber-200">
                    {subscriptionCode}
                  </code>
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-amber-600" />}
                </button>

                {/* Permissions (mobile) */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-2 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
                    </span>
                    <span className="ml-auto text-xs font-bold text-emerald-700">{allowedCount}/{allModules.length}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {allModules.map((m) => {
                      const allowed = hasModulePermission(m.id);
                      const locked = !isUnlocked(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-center p-1.5 rounded ${
                            locked ? 'bg-gray-200 dark:bg-slate-700 text-gray-400' :
                            allowed ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'
                          }`}
                          title={m.name}
                        >
                          {React.cloneElement(m.icon, { className: 'h-3 w-3' })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeaderBar;
