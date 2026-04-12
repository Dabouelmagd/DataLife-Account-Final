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
import { 
  Plus, Download, Eye, Trash2, Calendar, Clock, CheckCircle,
  AlertCircle, Filter, Search, ChevronRight, ArrowUp, ArrowDown,
  CalendarDays, FileText
} from 'lucide-react';
import { 
  CalendarCheck, ClockCountdown, CheckCircle as CheckIcon,
  Warning, HourglassMedium
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

const CasualLeavePage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newLeave, setNewLeave] = useState({
    employee_id: '',
    employee_name: '',
    date: '',
    reason: '',
    status: 'pending'
  });

  // Fetch data
  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/casual-leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLeaves(data);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
      // Mock data for demo
      setLeaves([
        { id: 'CL001', employee_code: 'EMP001', employee_name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', date: '2024-10-05', reason: language === 'ar' ? 'ظروف عائلية' : 'Family emergency', status: 'approved' },
        { id: 'CL002', employee_code: 'EMP002', employee_name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', date: '2024-10-08', reason: language === 'ar' ? 'ظروف صحية' : 'Medical', status: 'pending' },
        { id: 'CL003', employee_code: 'EMP003', employee_name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', date: '2024-10-10', reason: language === 'ar' ? 'ظروف طارئة' : 'Emergency', status: 'approved' },
        { id: 'CL004', employee_code: 'EMP004', employee_name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', date: '2024-10-12', reason: language === 'ar' ? 'موعد طبي' : 'Medical appointment', status: 'rejected' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(Array.isArray(data) ? data : (data.data || data.employees || []));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAddLeave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/casual-leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newLeave)
      });
      
      if (response.ok) {
        fetchLeaves();
        setShowAddModal(false);
        setNewLeave({ employee_id: '', employee_name: '', date: '', reason: '', status: 'pending' });
      }
    } catch (error) {
      console.error('Error adding leave:', error);
      // Mock add for demo
      const id = 'CL' + String(leaves.length + 1).padStart(3, '0');
      setLeaves([...leaves, { ...newLeave, id }]);
      setShowAddModal(false);
      setNewLeave({ employee_id: '', employee_name: '', date: '', reason: '', status: 'pending' });
    }
  };

  const handleDeleteLeave = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/casual-leaves/${selectedLeave.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error deleting leave:', error);
      setLeaves(leaves.filter(l => l.id !== selectedLeave.id));
    }
    setShowDeleteModal(false);
  };

  const handleStatusChange = async (leaveId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/casual-leaves/${leaveId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error updating status:', error);
      setLeaves(leaves.map(l => l.id === leaveId ? { ...l, status: newStatus } : l));
    }
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'التاريخ', 'السبب', 'الحالة']
      : ['ID', 'Employee Code', 'Employee', 'Date', 'Reason', 'Status'];
    
    const csvData = filteredLeaves.map(leave => [
      leave.id,
      leave.employee_code || 'N/A',
      leave.employee_name,
      leave.date,
      leave.reason,
      getStatusLabel(leave.status)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casual_leave_${new Date().toISOString().split('T')[0]}.csv`;
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
    return (
      <Badge className={`${styles[status]} hover:${styles[status]}`}>
        {getStatusLabel(status)}
      </Badge>
    );
  };

  // Filter leaves
  const filteredLeaves = leaves.filter(leave => {
    const matchesStatus = filterStatus === 'all' || leave.status === filterStatus;
    const matchesSearch = leave.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         leave.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats
  const stats = {
    total: leaves.length,
    approved: leaves.filter(l => l.status === 'approved').length,
    pending: leaves.filter(l => l.status === 'pending').length,
    rejected: leaves.filter(l => l.status === 'rejected').length
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الإجازات' : 'Total Leaves',
      value: stats.total,
      icon: CalendarCheck,
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/50',
      iconColor: 'bg-cyan-500',
      textColor: 'text-cyan-600 dark:text-cyan-400'
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
    },
    {
      title: language === 'ar' ? 'مرفوضة' : 'Rejected',
      value: stats.rejected,
      icon: Warning,
      bgColor: 'bg-red-50 dark:bg-red-950/50',
      iconColor: 'bg-red-500',
      textColor: 'text-red-600 dark:text-red-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="casual-leave-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-teal-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <CalendarCheck weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave'}
              </h1>
              <p className="text-cyan-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة طلبات الإجازات العارضة للموظفين'
                  : 'Manage employee casual leave requests'
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
              className="bg-white text-cyan-700 hover:bg-cyan-50"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة إجازة' : 'Add Leave'}
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
                <TableHead className="font-semibold">{language === 'ar' ? 'كود الموظف' : 'Emp. Code'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length > 0 ? filteredLeaves.map((leave) => (
                <TableRow key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="font-medium text-cyan-600">{leave.id}</TableCell>
                  <TableCell className="font-mono text-sm">{leave.employee_code || 'N/A'}</TableCell>
                  <TableCell className="font-medium">{leave.employee_name}</TableCell>
                  <TableCell>{leave.date}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                  <TableCell>{getStatusBadge(leave.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-cyan-600"
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
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
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
              <CalendarCheck weight="fill" className="w-5 h-5 text-cyan-500" />
              {language === 'ar' ? 'إضافة إجازة عارضة' : 'Add Casual Leave'}
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
            <div>
              <Label>{language === 'ar' ? 'التاريخ' : 'Date'}</Label>
              <Input
                type="date"
                value={newLeave.date}
                onChange={(e) => setNewLeave({ ...newLeave, date: e.target.value })}
              />
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
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={handleAddLeave}>
              {language === 'ar' ? 'إضافة' : 'Add'}
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
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'التاريخ' : 'Date'}</Label>
                <p className="font-medium">{selectedLeave.date}</p>
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

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">
            {language === 'ar' 
              ? 'هل أنت متأكد من حذف هذه الإجازة؟'
              : 'Are you sure you want to delete this leave?'
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

export default CasualLeavePage;
