import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Activity, UserPlus, UserMinus, Key, Shield, FileText,
  Users, Clock, Filter, ChevronLeft, ChevronRight, Loader2,
  Download, RefreshCw
} from 'lucide-react';
import { 
  ClockCounterClockwise, User, UserCirclePlus, UserCircleMinus,
  LockKey, ShieldCheck, FileDoc, Receipt
} from '@phosphor-icons/react';

const ActivityLogTab = ({ language }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [stats, setStats] = useState(null);
  const limit = 20;

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [offset, filterType]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/activity/logs?limit=${limit}&offset=${offset}`;
      if (filterType) {
        url += `&entity_type=${filterType}`;
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/activity/stats?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'user_invited':
        return <UserCirclePlus weight="fill" className="w-5 h-5 text-green-500" />;
      case 'user_deleted':
        return <UserCircleMinus weight="fill" className="w-5 h-5 text-red-500" />;
      case 'user_role_changed':
        return <ShieldCheck weight="fill" className="w-5 h-5 text-purple-500" />;
      case 'user_permissions_changed':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'password_changed':
        return <LockKey weight="fill" className="w-5 h-5 text-amber-500" />;
      case 'employee_added':
        return <UserPlus className="w-5 h-5 text-emerald-500" />;
      case 'employee_deleted':
        return <UserMinus className="w-5 h-5 text-red-500" />;
      case 'invoice_created':
        return <Receipt weight="fill" className="w-5 h-5 text-cyan-500" />;
      case 'login':
        return <User weight="fill" className="w-5 h-5 text-slate-500" />;
      default:
        return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      user_invited: language === 'ar' ? 'دعوة مستخدم جديد' : 'Invited new user',
      user_deleted: language === 'ar' ? 'حذف مستخدم' : 'Deleted user',
      user_role_changed: language === 'ar' ? 'تغيير دور المستخدم' : 'Changed user role',
      user_permissions_changed: language === 'ar' ? 'تغيير صلاحيات المستخدم' : 'Changed permissions',
      password_changed: language === 'ar' ? 'تغيير كلمة المرور' : 'Changed password',
      employee_added: language === 'ar' ? 'إضافة موظف' : 'Added employee',
      employee_deleted: language === 'ar' ? 'حذف موظف' : 'Deleted employee',
      invoice_created: language === 'ar' ? 'إنشاء فاتورة' : 'Created invoice',
      payroll_created: language === 'ar' ? 'إنشاء كشف رواتب' : 'Created payroll',
      login: language === 'ar' ? 'تسجيل دخول' : 'Logged in',
      logout: language === 'ar' ? 'تسجيل خروج' : 'Logged out',
    };
    return labels[action] || action;
  };

  const getEntityBadge = (type) => {
    const colors = {
      user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      employee: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      invoice: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      payroll: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      settings: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    };
    
    const labels = {
      user: language === 'ar' ? 'مستخدم' : 'User',
      employee: language === 'ar' ? 'موظف' : 'Employee',
      invoice: language === 'ar' ? 'فاتورة' : 'Invoice',
      payroll: language === 'ar' ? 'رواتب' : 'Payroll',
      settings: language === 'ar' ? 'إعدادات' : 'Settings',
    };

    return (
      <Badge className={`${colors[type] || colors.settings} font-medium text-xs`}>
        {labels[type] || type}
      </Badge>
    );
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return language === 'ar' ? 'الآن' : 'Just now';
    if (diffMins < 60) return language === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    if (diffHours < 24) return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    if (diffDays < 7) return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filterOptions = [
    { value: '', label: language === 'ar' ? 'الكل' : 'All' },
    { value: 'user', label: language === 'ar' ? 'المستخدمين' : 'Users' },
    { value: 'employee', label: language === 'ar' ? 'الموظفين' : 'Employees' },
    { value: 'invoice', label: language === 'ar' ? 'الفواتير' : 'Invoices' },
    { value: 'payroll', label: language === 'ar' ? 'الرواتب' : 'Payroll' },
  ];

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <ClockCounterClockwise weight="fill" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {language === 'ar' ? 'سجل النشاطات' : 'Activity Log'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  {language === 'ar' 
                    ? 'متابعة جميع العمليات والتغييرات في النظام'
                    : 'Track all operations and changes in the system'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => { fetchLogs(); fetchStats(); }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'إجمالي النشاطات' : 'Total Activities'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'عمليات اليوم' : "Today's Actions"}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.by_day?.length > 0 ? stats.by_day[stats.by_day.length - 1]?.count || 0 : 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'مستخدمين نشطين' : 'Active Users'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.by_user?.length || 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'أنواع العمليات' : 'Action Types'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.by_action?.length || 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'تصفية:' : 'Filter:'}
              </span>
            </div>
            <div className="flex gap-2">
              {filterOptions.map(option => (
                <Button
                  key={option.value}
                  variant={filterType === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setFilterType(option.value); setOffset(0); }}
                  className={filterType === option.value ? 'bg-violet-600 hover:bg-violet-700' : ''}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-violet-600" />
            {language === 'ar' ? 'سجل العمليات' : 'Activity Feed'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ClockCounterClockwise weight="light" className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'لا توجد نشاطات مسجلة' : 'No activities recorded yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center flex-shrink-0">
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.user_name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {getActionLabel(log.action)}
                      </span>
                      {log.entity_name && (
                        <span className="font-medium text-violet-600 dark:text-violet-400">
                          "{log.entity_name}"
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      {getEntityBadge(log.entity_type)}
                      <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        {Object.entries(log.details).map(([key, value]) => (
                          <span key={key} className="inline-block me-3">
                            <span className="text-slate-400">{key}:</span> {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {language === 'ar' 
                  ? `صفحة ${currentPage} من ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`
                }
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setOffset(offset + limit)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogTab;
