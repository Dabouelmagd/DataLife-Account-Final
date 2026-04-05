import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { 
  Plus, Download, Eye, Trash2, Calendar, CheckCircle, Edit,
  AlertCircle, Filter, Search, ArrowUp
} from 'lucide-react';
import { 
  CalendarBlank, CheckCircle as CheckIcon, HourglassMedium,
  Warning, Airplane
} from '@phosphor-icons/react';

const AnnualLeavePage = ({ language }) => {
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newLeave, setNewLeave] = useState({
    employee_id: '',
    employee_name: '',
    start_date: '',
    end_date: '',
    days: 0,
    reason: '',
    status: 'pending'
  });

  // Fetch data
  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/annual-leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLeaves(data);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      // Mock data
      setLeaves([
        { id: 'AL001', employee_code: 'EMP001', employee_name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', start_date: '2024-10-15', end_date: '2024-10-22', days: 7, balance: 21, used: 7, reason: language === 'ar' ? 'إجازة سنوية' : 'Annual vacation', status: 'approved' },
        { id: 'AL002', employee_code: 'EMP002', employee_name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', start_date: '2024-11-01', end_date: '2024-11-05', days: 5, balance: 21, used: 5, reason: language === 'ar' ? 'سفر عائلي' : 'Family trip', status: 'pending' },
        { id: 'AL003', employee_code: 'EMP003', employee_name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', start_date: '2024-12-20', end_date: '2024-12-31', days: 10, balance: 21, used: 14, reason: language === 'ar' ? 'إجازة نهاية العام' : 'Year-end holiday', status: 'approved' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async () => {
    // Calculate days
    const start = new Date(newLeave.start_date);
    const end = new Date(newLeave.end_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/annual-leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newLeave, days })
      });
      
      if (response.ok) {
        fetchLeaves();
        setShowAddModal(false);
        setNewLeave({ employee_id: '', employee_name: '', start_date: '', end_date: '', days: 0, reason: '', status: 'pending' });
      }
    } catch (error) {
      console.error('Error adding leave:', error);
      // Mock add
      const id = 'AL' + String(leaves.length + 1).padStart(3, '0');
      setLeaves([...leaves, { ...newLeave, id, days, balance: 21, used: days }]);
      setShowAddModal(false);
      setNewLeave({ employee_id: '', employee_name: '', start_date: '', end_date: '', days: 0, reason: '', status: 'pending' });
    }
  };

  const handleDeleteLeave = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/annual-leaves/${selectedLeave.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLeaves();
    } catch (error) {
      setLeaves(leaves.filter(l => l.id !== selectedLeave.id));
    }
    setShowDeleteModal(false);
  };

  const handleStatusChange = async (leaveId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/annual-leaves/${leaveId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchLeaves();
    } catch (error) {
      setLeaves(leaves.map(l => l.id === leaveId ? { ...l, status: newStatus } : l));
    }
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'من', 'إلى', 'الأيام', 'السبب', 'الحالة']
      : ['ID', 'Emp Code', 'Employee', 'From', 'To', 'Days', 'Reason', 'Status'];
    
    const csvData = filteredLeaves.map(leave => [
      leave.id,
      leave.employee_code || 'N/A',
      leave.employee_name,
      leave.start_date,
      leave.end_date,
      leave.days,
      leave.reason,
      getStatusLabel(leave.status)
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `annual_leave_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: language === 'ar' ? 'قيد المراجعة' : 'Pending',
      approved: language === 'ar' ? 'موافق عليها' : 'Approved',
      rejected: language === 'ar' ? 'مرفوضة' : 'Rejected'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return <Badge className={`${styles[status]} hover:${styles[status]}`}>{getStatusLabel(status)}</Badge>;
  };

  const filteredLeaves = leaves.filter(leave => {
    const matchesStatus = filterStatus === 'all' || leave.status === filterStatus;
    const matchesSearch = leave.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         leave.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: leaves.length,
    totalDays: leaves.reduce((sum, l) => sum + (l.days || 0), 0),
    approved: leaves.filter(l => l.status === 'approved').length,
    pending: leaves.filter(l => l.status === 'pending').length
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الطلبات' : 'Total Requests',
      value: stats.total,
      icon: CalendarBlank,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500',
      textColor: 'text-violet-600 dark:text-violet-400'
    },
    {
      title: language === 'ar' ? 'إجمالي الأيام' : 'Total Days',
      value: stats.totalDays,
      icon: Airplane,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: language === 'ar' ? 'موافق عليها' : 'Approved',
      value: stats.approved,
      icon: CheckIcon,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: language === 'ar' ? 'قيد المراجعة' : 'Pending',
      value: stats.pending,
      icon: HourglassMedium,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="annual-leave-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Airplane weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave'}
              </h1>
              <p className="text-violet-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة طلبات الإجازات السنوية ورصيد الإجازات'
                  : 'Manage annual leave requests and balances'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              onClick={exportToExcel}
            >
              <Download className="w-4 h-4 me-2" />
              {language === 'ar' ? 'تصدير' : 'Export'}
            </Button>
            <Button 
              className="bg-white text-violet-700 hover:bg-violet-50"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'طلب إجازة' : 'Request Leave'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className={`border-0 shadow-sm ${card.bgColor}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.iconColor}`}></div>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                    <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.iconColor} flex items-center justify-center`}>
                    <Icon weight="fill" className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  <SelectItem value="pending">{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</SelectItem>
                  <SelectItem value="approved">{language === 'ar' ? 'موافق عليها' : 'Approved'}</SelectItem>
                  <SelectItem value="rejected">{language === 'ar' ? 'مرفوضة' : 'Rejected'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="font-semibold">{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'كود الموظف' : 'Emp Code'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الفترة' : 'Period'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الأيام' : 'Days'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length > 0 ? filteredLeaves.map((leave) => (
                <TableRow key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="font-medium text-violet-600">{leave.id}</TableCell>
                  <TableCell className="font-mono text-sm">{leave.employee_code || 'N/A'}</TableCell>
                  <TableCell className="font-medium">{leave.employee_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{leave.start_date}</div>
                      <div className="text-slate-400">→ {leave.end_date}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-bold">{leave.days}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-20">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{leave.used || 0}</span>
                        <span>{leave.balance || 21}</span>
                      </div>
                      <Progress value={((leave.used || 0) / (leave.balance || 21)) * 100} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(leave.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-violet-600"
                        onClick={() => { setSelectedLeave(leave); setShowViewModal(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {leave.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-600"
                            onClick={() => handleStatusChange(leave.id, 'approved')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => handleStatusChange(leave.id, 'rejected')}
                          >
                            <AlertCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => { setSelectedLeave(leave); setShowDeleteModal(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {language === 'ar' ? 'لا توجد إجازات' : 'No leaves found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Airplane weight="fill" className="w-5 h-5 text-violet-500" />
              {language === 'ar' ? 'طلب إجازة سنوية' : 'Request Annual Leave'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'الموظف' : 'Employee'}</Label>
              <Input
                value={newLeave.employee_name}
                onChange={(e) => setNewLeave({ ...newLeave, employee_name: e.target.value })}
                placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee name'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'من' : 'From'}</Label>
                <Input
                  type="date"
                  value={newLeave.start_date}
                  onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'إلى' : 'To'}</Label>
                <Input
                  type="date"
                  value={newLeave.end_date}
                  onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{language === 'ar' ? 'السبب' : 'Reason'}</Label>
              <Textarea
                value={newLeave.reason}
                onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                placeholder={language === 'ar' ? 'سبب الإجازة' : 'Leave reason'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-violet-500 hover:bg-violet-600" onClick={handleAddLeave}>
              {language === 'ar' ? 'تقديم الطلب' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تفاصيل الإجازة' : 'Leave Details'}</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'الكود' : 'ID'}</Label>
                  <p className="font-medium">{selectedLeave.id}</p>
                </div>
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'كود الموظف' : 'Employee Code'}</Label>
                  <p className="font-medium font-mono">{selectedLeave.employee_code || 'N/A'}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'الموظف' : 'Employee'}</Label>
                <p className="font-medium">{selectedLeave.employee_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'من' : 'From'}</Label>
                  <p className="font-medium">{selectedLeave.start_date}</p>
                </div>
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'إلى' : 'To'}</Label>
                  <p className="font-medium">{selectedLeave.end_date}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'عدد الأيام' : 'Days'}</Label>
                <p className="font-medium">{selectedLeave.days}</p>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'السبب' : 'Reason'}</Label>
                <p className="font-medium">{selectedLeave.reason}</p>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</Label>
                <div className="mt-1">{getStatusBadge(selectedLeave.status)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">
            {language === 'ar' 
              ? 'هل أنت متأكد من حذف هذا الطلب؟'
              : 'Are you sure you want to delete this request?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDeleteLeave}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnnualLeavePage;
