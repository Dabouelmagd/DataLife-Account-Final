import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import {
  History, Search, RefreshCw, User, Shield, Trash2, Edit, Eye, LogIn,
  AlertCircle, CheckCircle, XCircle, Clock, Activity, FileText, ChevronLeft, ChevronRight, Lock,
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const PER_PAGE = 20;

/*
 * سجل التدقيق — reads ONE endpoint (/api/audit/logs) that returns rows from
 * the chained trail, the older audit_logs store and security events in one
 * shape: time, user_name, action, module, entity, ip, details. Always limited
 * to the user's company on the server. The «تسجيل الدخول» tab reads
 * /api/audit/security-events (successful / failed sign-ins with IP).
 */

const ACTIONS = {
  create: ['إنشاء', 'Create'], update: ['تعديل', 'Update'], delete: ['حذف', 'Delete'],
  approve: ['موافقة', 'Approve'], reject: ['رفض', 'Reject'], export: ['تصدير', 'Export'],
  login_ok: ['دخول ناجح', 'Login OK'], login_failed: ['دخول فاشل', 'Login failed'],
  pii_viewed: ['اطلاع على بيانات شخصية', 'Personal data viewed'],
  change_role: ['تغيير الدور', 'Change role'], change_permissions: ['تغيير الصلاحيات', 'Change permissions'],
  activate: ['تفعيل', 'Activate'], deactivate: ['إلغاء تفعيل', 'Deactivate'],
};
const MODULES = {
  auth: ['الدخول', 'Sign-in'], data_protection: ['حماية البيانات', 'Data protection'],
  payroll: ['الرواتب', 'Payroll'], invoices: ['الفواتير', 'Invoices'], sales: ['المبيعات', 'Sales'],
  purchases: ['المشتريات', 'Purchases'], accounting: ['الحسابات', 'Accounting'],
  user: ['المستخدمون', 'Users'], employee: ['الموظفون', 'Employees'],
};
const ACTION_COLOR = (a) => {
  const s = String(a || '');
  if (s.includes('delete') || s.includes('failed') || s.includes('reject')) return 'bg-red-600';
  if (s.includes('pii')) return 'bg-amber-600';
  if (s.includes('create') || s.includes('_ok') || s.includes('approve')) return 'bg-green-600';
  if (s.includes('update') || s.includes('change')) return 'bg-blue-600';
  return 'bg-slate-500';
};
const ACTION_ICON = (a) => {
  const s = String(a || '');
  if (s.startsWith('login')) return LogIn;
  if (s.includes('delete')) return Trash2;
  if (s.includes('update') || s.includes('change')) return Edit;
  if (s.includes('pii')) return Lock;
  return Activity;
};
const sinceDate = (days) => {
  if (days === 'all') return '';
  const d = new Date(Date.now() - Number(days) * 86400000);
  return d.toISOString().slice(0, 10);
};
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

function Pager({ page, total, onPage, isRTL }) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t">
      <p className="text-sm text-gray-500">{isRTL ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
          aria-label={isRTL ? 'السابق' : 'Previous'}>
          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}
          aria-label={isRTL ? 'التالي' : 'Next'}>
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

const AuditLogPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const L = (pair) => (pair ? (isRTL ? pair[0] : pair[1]) : '');

  const [tab, setTab] = useState('activity');

  // activity
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [userText, setUserText] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [statistics, setStatistics] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  // logins
  const [events, setEvents] = useState([]);
  const [evTotal, setEvTotal] = useState(0);
  const [evFailed24, setEvFailed24] = useState(0);
  const [evPage, setEvPage] = useState(1);
  const [evStatus, setEvStatus] = useState('all');
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState('');

  const t = {
    title: isRTL ? 'سجل التدقيق' : 'Audit Log',
    subtitle: isRTL ? 'العمليات والتغييرات وعمليات الدخول في شركتك' : "Operations, changes and sign-ins in your company",
    activity: isRTL ? 'سجل العمليات' : 'Activity',
    logins: isRTL ? 'تسجيل الدخول' : 'Sign-ins',
    searchUser: isRTL ? 'بحث بالمستخدم (الاسم أو البريد)...' : 'Search by user (name or email)...',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    time: isRTL ? 'الوقت' : 'Time',
    user: isRTL ? 'المستخدم' : 'User',
    action: isRTL ? 'العملية' : 'Action',
    module: isRTL ? 'الموديول' : 'Module',
    entity: isRTL ? 'الكيان' : 'Entity',
    details: isRTL ? 'التفاصيل' : 'Details',
    allActions: isRTL ? 'كل العمليات' : 'All actions',
    allModules: isRTL ? 'كل الموديولات' : 'All modules',
    noLogs: isRTL ? 'لا توجد سجلات' : 'No records',
    totalLogs: isRTL ? 'أحداث الفترة' : 'Events in period',
    oldValues: isRTL ? 'القيم السابقة' : 'Old values',
    newValues: isRTL ? 'القيم الجديدة' : 'New values',
    viewDetails: isRTL ? 'تفاصيل الحدث' : 'Event details',
    result: isRTL ? 'النتيجة' : 'Result',
    ok: isRTL ? 'ناجح' : 'Success',
    failed: isRTL ? 'فاشل' : 'Failed',
    all: isRTL ? 'الكل' : 'All',
    failed24: isRTL ? 'محاولات فاشلة آخر 24 ساعة' : 'Failed attempts, last 24h',
    loadError: isRTL ? 'تعذّر تحميل السجل' : 'Could not load the log',
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { limit: PER_PAGE, skip: (page - 1) * PER_PAGE };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (moduleFilter !== 'all') params.module = moduleFilter;
      if (userFilter) params.user = userFilter;
      const since = sinceDate(dateRange);
      if (since) params.start_date = since;
      const { data } = await axios.get(`${API_URL}/api/audit/logs`, { ...authHeaders(), params });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      setLogs([]); setTotal(0);
      setError(e?.response?.data?.detail && typeof e.response.data.detail === 'string' ? e.response.data.detail : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, moduleFilter, userFilter, dateRange, t.loadError]);

  const fetchStatistics = useCallback(async () => {
    try {
      const days = dateRange === 'all' ? 3650 : dateRange;
      const { data } = await axios.get(`${API_URL}/api/audit/statistics`, { ...authHeaders(), params: { days } });
      setStatistics(data);
    } catch {
      setStatistics(null);
    }
  }, [dateRange]);

  const fetchEvents = useCallback(async () => {
    setEvLoading(true); setEvError('');
    try {
      const params = { limit: PER_PAGE, skip: (evPage - 1) * PER_PAGE };
      if (evStatus !== 'all') params.status = evStatus;
      if (userFilter) params.user = userFilter;
      const since = sinceDate(dateRange);
      if (since) params.start_date = since;
      const { data } = await axios.get(`${API_URL}/api/audit/security-events`, { ...authHeaders(), params });
      setEvents(data.events || []);
      setEvTotal(data.total || 0);
      setEvFailed24(data.failed_last_24h || 0);
    } catch (e) {
      setEvents([]); setEvTotal(0);
      setEvError(t.loadError);
    } finally {
      setEvLoading(false);
    }
  }, [evPage, evStatus, userFilter, dateRange, t.loadError]);

  useEffect(() => { if (tab === 'activity') fetchLogs(); }, [tab, fetchLogs]);
  useEffect(() => { if (tab === 'activity') fetchStatistics(); }, [tab, fetchStatistics]);
  useEffect(() => { if (tab === 'logins') fetchEvents(); }, [tab, fetchEvents]);

  const applyUser = (e) => {
    e.preventDefault();
    setPage(1); setEvPage(1);
    setUserFilter(userText.trim());
  };

  const formatDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return new Intl.DateTimeFormat(isRTL ? 'ar-EG' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d);
  };

  const actionBadge = (a) => {
    const Icon = ACTION_ICON(a);
    return (
      <Badge className={`${ACTION_COLOR(a)} text-white inline-flex items-center gap-1 whitespace-nowrap`}>
        <Icon className="h-3 w-3" aria-hidden />
        {ACTIONS[a] ? L(ACTIONS[a]) : <bdi dir="ltr">{a || '—'}</bdi>}
      </Badge>
    );
  };
  const moduleLabel = (m) => (MODULES[m] ? L(MODULES[m]) : (m || '—'));
  const show = (v) => (v === null || v === undefined || (typeof v === 'object' && Object.keys(v).length === 0) ? null : v);

  const tabBtn = (key, label, Icon) => (
    <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tab === key
        ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
      <Icon className="h-4 w-4" aria-hidden />{label}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="h-7 w-7 text-indigo-600" aria-hidden />
            {t.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
        </div>
        <Button onClick={() => (tab === 'activity' ? (fetchLogs(), fetchStatistics()) : fetchEvents())} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t.refresh}
        </Button>
      </div>

      <div role="tablist" className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabBtn('activity', t.activity, FileText)}
        {tabBtn('logins', t.logins, LogIn)}
      </div>

      {/* shared filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <form onSubmit={applyUser} className="flex-1 min-w-[220px] relative">
              <Search className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} h-4 w-4 text-gray-400`} aria-hidden />
              <Input placeholder={t.searchUser} value={userText} onChange={(e) => setUserText(e.target.value)}
                onBlur={() => { if (userText.trim() !== userFilter) { setPage(1); setEvPage(1); setUserFilter(userText.trim()); } }}
                className={isRTL ? 'pr-10' : 'pl-10'} aria-label={t.searchUser} />
            </form>

            {tab === 'activity' && (
              <>
                <Select value={actionFilter} onValueChange={(v) => { setPage(1); setActionFilter(v); }}>
                  <SelectTrigger className="w-[190px]" aria-label={t.action}><SelectValue placeholder={t.allActions} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allActions}</SelectItem>
                    {Object.entries(ACTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{L(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={moduleFilter} onValueChange={(v) => { setPage(1); setModuleFilter(v); }}>
                  <SelectTrigger className="w-[170px]" aria-label={t.module}><SelectValue placeholder={t.allModules} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allModules}</SelectItem>
                    {Object.entries(MODULES).map(([k, v]) => <SelectItem key={k} value={k}>{L(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {tab === 'logins' && (
              <Select value={evStatus} onValueChange={(v) => { setEvPage(1); setEvStatus(v); }}>
                <SelectTrigger className="w-[150px]" aria-label={t.result}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  <SelectItem value="ok">{t.ok}</SelectItem>
                  <SelectItem value="failed">{t.failed}</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={dateRange} onValueChange={(v) => { setPage(1); setEvPage(1); setDateRange(v); }}>
              <SelectTrigger className="w-[150px]" aria-label={isRTL ? 'الفترة' : 'Period'}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{isRTL ? 'آخر 24 ساعة' : 'Last 24 hours'}</SelectItem>
                <SelectItem value="7">{isRTL ? 'آخر 7 أيام' : 'Last 7 days'}</SelectItem>
                <SelectItem value="30">{isRTL ? 'آخر 30 يوم' : 'Last 30 days'}</SelectItem>
                <SelectItem value="90">{isRTL ? 'آخر 90 يوم' : 'Last 90 days'}</SelectItem>
                <SelectItem value="365">{isRTL ? 'آخر سنة' : 'Last year'}</SelectItem>
                <SelectItem value="all">{isRTL ? 'كل الوقت' : 'All time'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {tab === 'activity' && (
        <>
          {statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                [t.totalLogs, statistics.total_logs, Activity],
                [isRTL ? 'عمليات الحذف' : 'Deletions', Object.entries(statistics.actions_by_type || {}).filter(([k]) => String(k).includes('delete')).reduce((s, [, v]) => s + v, 0), Trash2],
                [isRTL ? 'اطلاع على بيانات شخصية' : 'Personal data views', statistics.actions_by_type?.pii_viewed || 0, Lock],
                [isRTL ? 'تغييرات الصلاحيات' : 'Permission changes', (statistics.actions_by_type?.change_permissions || 0) + (statistics.actions_by_type?.change_role || 0), Shield],
              ].map(([label, value, Icon]) => (
                <Card key={label}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{label}</p>
                      <p className="text-2xl font-bold tabular-nums"><bdi dir="ltr">{Number(value || 0).toLocaleString('en-US')}</bdi></p>
                    </div>
                    <Icon className="h-8 w-8 text-indigo-500 opacity-70" aria-hidden />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" aria-hidden />{t.activity}</CardTitle>
              <CardDescription>{isRTL ? `إجمالي ${total} سجل` : `${total} records`}</CardDescription>
            </CardHeader>
            <CardContent>
              {error && <p className="text-sm text-red-700 mb-3" role="alert">{error}</p>}
              {loading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-indigo-600" aria-hidden /></div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden /><p>{t.noLogs}</p></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.time}</TableHead>
                          <TableHead>{t.user}</TableHead>
                          <TableHead>{t.action}</TableHead>
                          <TableHead>{t.module}</TableHead>
                          <TableHead className="hidden lg:table-cell">{t.entity}</TableHead>
                          <TableHead className="hidden md:table-cell">IP</TableHead>
                          <TableHead>{t.details}</TableHead>
                          <TableHead><span className="sr-only">{t.viewDetails}</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={`${log.source}-${log.id}`}>
                            <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{formatDate(log.time)}</span>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{log.user_name || '—'}</p>
                              {log.user_email && <p className="text-xs text-gray-500"><bdi dir="ltr">{log.user_email}</bdi></p>}
                            </TableCell>
                            <TableCell>{actionBadge(log.action)}</TableCell>
                            <TableCell className="text-sm">{moduleLabel(log.module)}</TableCell>
                            <TableCell className="text-sm hidden lg:table-cell">{log.entity || '—'}</TableCell>
                            <TableCell className="text-sm hidden md:table-cell"><bdi dir="ltr">{log.ip || '—'}</bdi></TableCell>
                            <TableCell className="max-w-[260px] truncate text-sm" title={log.details || ''}>{log.details || '—'}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} aria-label={t.viewDetails}
                                data-testid={`view-log-${log.id}`}>
                                <Eye className="h-4 w-4" aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Pager page={page} total={total} onPage={setPage} isRTL={isRTL} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'logins' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5" aria-hidden />{t.logins}</CardTitle>
            <CardDescription>
              {isRTL ? `إجمالي ${evTotal} محاولة — ` : `${evTotal} attempts — `}
              <span className={evFailed24 ? 'text-red-700 font-medium' : ''}>{t.failed24}: <bdi dir="ltr">{evFailed24}</bdi></span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {evError && <p className="text-sm text-red-700 mb-3" role="alert">{evError}</p>}
            {evLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-indigo-600" aria-hidden /></div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden /><p>{t.noLogs}</p></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.time}</TableHead>
                        <TableHead>{t.user}</TableHead>
                        <TableHead>{t.result}</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="hidden md:table-cell">{t.details}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((ev, i) => (
                        <TableRow key={`${ev.time}-${i}`}>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(ev.time)}</TableCell>
                          <TableCell className="text-sm"><bdi dir="ltr">{ev.email || '—'}</bdi></TableCell>
                          <TableCell>
                            {ev.ok ? (
                              <Badge className="bg-green-600 text-white inline-flex items-center gap-1"><CheckCircle className="h-3 w-3" aria-hidden />{t.ok}</Badge>
                            ) : (
                              <Badge className="bg-red-600 text-white inline-flex items-center gap-1"><XCircle className="h-3 w-3" aria-hidden />{t.failed}</Badge>
                            )}
                            <span className="sr-only"> ({ev.kind})</span>
                          </TableCell>
                          <TableCell className="text-sm"><bdi dir="ltr">{ev.ip || '—'}</bdi></TableCell>
                          <TableCell className="text-sm hidden md:table-cell">{ev.detail || <bdi dir="ltr">{ev.kind}</bdi>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pager page={evPage} total={evTotal} onPage={setEvPage} isRTL={isRTL} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(o) => { if (!o) setSelectedLog(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" aria-hidden />{t.viewDetails}</DialogTitle>
            <DialogDescription>{selectedLog && formatDate(selectedLog.time)}</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 mb-1">{t.action}</p>{actionBadge(selectedLog.action)}</div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 mb-1">{t.module}</p>{moduleLabel(selectedLog.module)}</div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-500 mb-1">{t.user}</p>
                  <span className="inline-flex items-center gap-1"><User className="h-4 w-4" aria-hidden />{selectedLog.user_name || '—'}</span>
                  {selectedLog.user_email && <p className="text-xs text-gray-500"><bdi dir="ltr">{selectedLog.user_email}</bdi></p>}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 mb-1">IP</p><bdi dir="ltr">{selectedLog.ip || '—'}</bdi></div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
                  <p className="text-gray-500 mb-1">{t.entity}</p>
                  {selectedLog.entity || '—'} {selectedLog.entity_id && <bdi dir="ltr" className="text-xs text-gray-500">({selectedLog.entity_id})</bdi>}
                </div>
              </div>
              {selectedLog.details && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"><p className="text-gray-500 mb-1">{t.details}</p><p>{selectedLog.details}</p></div>
              )}
              {show(selectedLog.old_value) && (
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-red-700 dark:text-red-400 mb-2 font-medium">{t.oldValues}</p>
                  <pre dir="ltr" className="text-xs overflow-auto max-h-40 bg-white dark:bg-gray-900 p-2 rounded">{JSON.stringify(selectedLog.old_value, null, 2)}</pre>
                </div>
              )}
              {show(selectedLog.new_value) && (
                <div className="p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-green-700 dark:text-green-400 mb-2 font-medium">{t.newValues}</p>
                  <pre dir="ltr" className="text-xs overflow-auto max-h-40 bg-white dark:bg-gray-900 p-2 rounded">{JSON.stringify(selectedLog.new_value, null, 2)}</pre>
                </div>
              )}
              <p className="text-xs text-gray-500">
                {selectedLog.chained
                  ? (isRTL ? `حدث مربوط بسلسلة البصمات${selectedLog.seq ? ` — رقم ${selectedLog.seq}` : ''}` : `Chained event${selectedLog.seq ? ` #${selectedLog.seq}` : ''}`)
                  : (isRTL ? 'سجل قديم غير مربوط بسلسلة البصمات' : 'Older record, not hash-chained')}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogPage;
