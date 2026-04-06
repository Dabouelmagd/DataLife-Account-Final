import React, { useState, useEffect, useContext } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { 
  History, Search, Filter, RefreshCw, User, Building2, Shield, 
  Trash2, UserPlus, UserMinus, Edit, Eye, Download, Calendar,
  AlertCircle, CheckCircle, Clock, Activity, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuditLogPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const logsPerPage = 20;
  
  // Translations
  const t = {
    title: isRTL ? 'سجل التدقيق' : 'Audit Log',
    subtitle: isRTL ? 'تتبع جميع العمليات والتغييرات في النظام' : 'Track all operations and changes in the system',
    search: isRTL ? 'بحث...' : 'Search...',
    filter: isRTL ? 'تصفية' : 'Filter',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    export: isRTL ? 'تصدير' : 'Export',
    action: isRTL ? 'العملية' : 'Action',
    entityType: isRTL ? 'نوع الكيان' : 'Entity Type',
    user: isRTL ? 'المستخدم' : 'User',
    details: isRTL ? 'التفاصيل' : 'Details',
    timestamp: isRTL ? 'التاريخ والوقت' : 'Timestamp',
    allActions: isRTL ? 'جميع العمليات' : 'All Actions',
    allEntities: isRTL ? 'جميع الكيانات' : 'All Entities',
    days: isRTL ? 'يوم' : 'days',
    last30Days: isRTL ? 'آخر 30 يوم' : 'Last 30 days',
    last7Days: isRTL ? 'آخر 7 أيام' : 'Last 7 days',
    last90Days: isRTL ? 'آخر 90 يوم' : 'Last 90 days',
    allTime: isRTL ? 'كل الوقت' : 'All time',
    noLogs: isRTL ? 'لا توجد سجلات' : 'No logs found',
    totalLogs: isRTL ? 'إجمالي السجلات' : 'Total Logs',
    todayActivity: isRTL ? 'نشاط اليوم' : "Today's Activity",
    topUsers: isRTL ? 'أكثر المستخدمين نشاطاً' : 'Top Active Users',
    recentChanges: isRTL ? 'آخر التغييرات' : 'Recent Changes',
    viewDetails: isRTL ? 'عرض التفاصيل' : 'View Details',
    oldValues: isRTL ? 'القيم السابقة' : 'Old Values',
    newValues: isRTL ? 'القيم الجديدة' : 'New Values',
    performedBy: isRTL ? 'تم بواسطة' : 'Performed By',
    company: isRTL ? 'الشركة' : 'Company',
  };
  
  // Action translations
  const actionLabels = {
    create: { en: 'Create', ar: 'إنشاء', color: 'bg-green-500', icon: UserPlus },
    update: { en: 'Update', ar: 'تعديل', color: 'bg-blue-500', icon: Edit },
    delete: { en: 'Delete', ar: 'حذف', color: 'bg-red-500', icon: Trash2 },
    activate: { en: 'Activate', ar: 'تفعيل', color: 'bg-emerald-500', icon: CheckCircle },
    deactivate: { en: 'Deactivate', ar: 'إلغاء تفعيل', color: 'bg-orange-500', icon: UserMinus },
    login: { en: 'Login', ar: 'تسجيل دخول', color: 'bg-cyan-500', icon: User },
    logout: { en: 'Logout', ar: 'تسجيل خروج', color: 'bg-gray-500', icon: User },
    change_role: { en: 'Change Role', ar: 'تغيير الدور', color: 'bg-purple-500', icon: Shield },
    change_permissions: { en: 'Change Permissions', ar: 'تغيير الصلاحيات', color: 'bg-indigo-500', icon: Shield },
  };
  
  // Entity type translations
  const entityLabels = {
    user: { en: 'User', ar: 'مستخدم', icon: User },
    company: { en: 'Company', ar: 'شركة', icon: Building2 },
    invoice: { en: 'Invoice', ar: 'فاتورة', icon: FileText },
    permission: { en: 'Permission', ar: 'صلاحية', icon: Shield },
    settings: { en: 'Settings', ar: 'إعدادات', icon: Edit },
  };
  
  const getToken = () => localStorage.getItem('token');
  
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const skip = (currentPage - 1) * logsPerPage;
      
      let url = `${API_URL}/api/audit/logs?limit=${logsPerPage}&skip=${skip}`;
      
      if (actionFilter !== 'all') {
        url += `&action=${actionFilter}`;
      }
      if (entityFilter !== 'all') {
        url += `&entity_type=${entityFilter}`;
      }
      if (searchTerm) {
        url += `&performed_by=${encodeURIComponent(searchTerm)}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLogs(response.data.logs || []);
      setTotalLogs(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStatistics = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/api/audit/statistics?days=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };
  
  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter, entityFilter, searchTerm]);
  
  useEffect(() => {
    fetchStatistics();
  }, [dateRange]);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getActionBadge = (action) => {
    const actionInfo = actionLabels[action] || { en: action, ar: action, color: 'bg-gray-500', icon: Activity };
    const Icon = actionInfo.icon;
    return (
      <Badge className={`${actionInfo.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {isRTL ? actionInfo.ar : actionInfo.en}
      </Badge>
    );
  };
  
  const getEntityBadge = (entityType) => {
    const entityInfo = entityLabels[entityType] || { en: entityType, ar: entityType, icon: FileText };
    const Icon = entityInfo.icon;
    return (
      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {isRTL ? entityInfo.ar : entityInfo.en}
      </span>
    );
  };
  
  const totalPages = Math.ceil(totalLogs / logsPerPage);
  
  return (
    <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="h-7 w-7 text-indigo-600" />
            {t.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
        </div>
        <Button onClick={() => { fetchLogs(); fetchStatistics(); }} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t.refresh}
        </Button>
      </div>
      
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">{t.totalLogs}</p>
                  <p className="text-3xl font-bold">{statistics.total_logs}</p>
                </div>
                <Activity className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">{isRTL ? 'تفعيل الحسابات' : 'Activations'}</p>
                  <p className="text-3xl font-bold">{statistics.actions_by_type?.activate || 0}</p>
                </div>
                <CheckCircle className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">{isRTL ? 'عمليات الحذف' : 'Deletions'}</p>
                  <p className="text-3xl font-bold">{statistics.actions_by_type?.delete || 0}</p>
                </div>
                <Trash2 className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{isRTL ? 'تغييرات الصلاحيات' : 'Permission Changes'}</p>
                  <p className="text-3xl font-bold">{statistics.actions_by_type?.change_permissions || 0}</p>
                </div>
                <Shield className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} h-4 w-4 text-gray-400`} />
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={isRTL ? 'pr-10' : 'pl-10'}
                />
              </div>
            </div>
            
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.allActions} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allActions}</SelectItem>
                {Object.entries(actionLabels).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {isRTL ? value.ar : value.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.allEntities} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allEntities}</SelectItem>
                {Object.entries(entityLabels).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {isRTL ? value.ar : value.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t.last7Days}</SelectItem>
                <SelectItem value="30">{t.last30Days}</SelectItem>
                <SelectItem value="90">{t.last90Days}</SelectItem>
                <SelectItem value="365">{t.allTime}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t.recentChanges}
          </CardTitle>
          <CardDescription>
            {isRTL ? `إجمالي ${totalLogs} سجل` : `Total ${totalLogs} records`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t.noLogs}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.action}</TableHead>
                    <TableHead>{t.entityType}</TableHead>
                    <TableHead>{t.details}</TableHead>
                    <TableHead>{t.performedBy}</TableHead>
                    <TableHead>{t.timestamp}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{getEntityBadge(log.entity_type)}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        <span className="font-medium">{log.entity_name || '-'}</span>
                        {log.details && (
                          <p className="text-xs text-gray-500 truncate">{log.details}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                            <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.performed_by_name}</p>
                            <p className="text-xs text-gray-500">{log.performed_by_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailModal(true);
                          }}
                          data-testid={`view-log-${log.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {isRTL 
                      ? `صفحة ${currentPage} من ${totalPages}` 
                      : `Page ${currentPage} of ${totalPages}`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t.viewDetails}
            </DialogTitle>
            <DialogDescription>
              {selectedLog && formatDate(selectedLog.timestamp)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{t.action}</p>
                  {getActionBadge(selectedLog.action)}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{t.entityType}</p>
                  {getEntityBadge(selectedLog.entity_type)}
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">{t.performedBy}</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">{selectedLog.performed_by_name}</span>
                  <span className="text-gray-500">({selectedLog.performed_by_email})</span>
                </div>
              </div>
              
              {selectedLog.company_name && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{t.company}</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium">{selectedLog.company_name}</span>
                  </div>
                </div>
              )}
              
              {selectedLog.details && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">{t.details}</p>
                  <p>{selectedLog.details}</p>
                </div>
              )}
              
              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">{t.oldValues}</p>
                  <pre className="text-sm overflow-auto max-h-40 bg-white dark:bg-gray-900 p-2 rounded">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-2 font-medium">{t.newValues}</p>
                  <pre className="text-sm overflow-auto max-h-40 bg-white dark:bg-gray-900 p-2 rounded">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogPage;
