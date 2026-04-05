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
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  Plus, Download, Eye, Search, Filter, UserMinus, Calendar,
  FileText, AlertTriangle, CheckCircle
} from 'lucide-react';
import { 
  UserCircleMinus, ClipboardText, Warning, CalendarX
} from '@phosphor-icons/react';

const TerminationPage = ({ language, employees = [] }) => {
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [terminations, setTerminations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTermination, setSelectedTermination] = useState(null);
  const [filterReason, setFilterReason] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newTermination, setNewTermination] = useState({
    employee_id: '',
    employee_code: '',
    employee_name: '',
    termination_date: '',
    reason: '',
    reason_details: '',
    notice_period: '30',
    final_settlement: '',
    notes: ''
  });

  // Termination reasons
  const terminationReasons = [
    { id: 'resignation', label: language === 'ar' ? 'استقالة' : 'Resignation', color: 'blue' },
    { id: 'end_of_contract', label: language === 'ar' ? 'انتهاء العقد' : 'End of Contract', color: 'amber' },
    { id: 'termination', label: language === 'ar' ? 'إنهاء خدمة' : 'Termination', color: 'red' },
    { id: 'retirement', label: language === 'ar' ? 'تقاعد' : 'Retirement', color: 'emerald' },
    { id: 'mutual_agreement', label: language === 'ar' ? 'اتفاق متبادل' : 'Mutual Agreement', color: 'violet' },
    { id: 'death', label: language === 'ar' ? 'وفاة' : 'Death', color: 'slate' },
    { id: 'disability', label: language === 'ar' ? 'عجز' : 'Disability', color: 'orange' }
  ];

  useEffect(() => {
    fetchTerminations();
  }, []);

  const fetchTerminations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/terminations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTerminations(data);
      }
    } catch (error) {
      console.error('Error fetching terminations:', error);
      // Mock data
      setTerminations([
        {
          id: 'TER001',
          employee_code: 'EMP005',
          employee_name: language === 'ar' ? 'علي حسن' : 'Ali Hassan',
          termination_date: '2024-09-30',
          reason: 'resignation',
          reason_details: language === 'ar' ? 'فرصة عمل أفضل' : 'Better job opportunity',
          notice_period: '30',
          final_settlement: 25000,
          status: 'completed'
        },
        {
          id: 'TER002',
          employee_code: 'EMP008',
          employee_name: language === 'ar' ? 'سمير أحمد' : 'Samir Ahmed',
          termination_date: '2024-10-15',
          reason: 'end_of_contract',
          reason_details: language === 'ar' ? 'انتهاء العقد المحدد المدة' : 'Fixed-term contract ended',
          notice_period: '15',
          final_settlement: 18000,
          status: 'in_progress'
        },
        {
          id: 'TER003',
          employee_code: 'EMP012',
          employee_name: language === 'ar' ? 'محمود سعيد' : 'Mahmoud Said',
          termination_date: '2024-11-01',
          reason: 'retirement',
          reason_details: language === 'ar' ? 'بلوغ سن التقاعد' : 'Reached retirement age',
          notice_period: '60',
          final_settlement: 85000,
          status: 'pending'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTermination = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/terminations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTermination)
      });
      
      if (response.ok) {
        fetchTerminations();
        setShowAddModal(false);
        setNewTermination({
          employee_id: '', employee_code: '', employee_name: '',
          termination_date: '', reason: '', reason_details: '',
          notice_period: '30', final_settlement: '', notes: ''
        });
      }
    } catch (error) {
      console.error('Error adding termination:', error);
      // Mock add
      const id = 'TER' + String(terminations.length + 1).padStart(3, '0');
      setTerminations([...terminations, { 
        ...newTermination, 
        id, 
        status: 'pending',
        final_settlement: parseFloat(newTermination.final_settlement) || 0
      }]);
      setShowAddModal(false);
      setNewTermination({
        employee_id: '', employee_code: '', employee_name: '',
        termination_date: '', reason: '', reason_details: '',
        notice_period: '30', final_settlement: '', notes: ''
      });
    }
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'تاريخ الإنهاء', 'السبب', 'التفاصيل', 'المستحقات', 'الحالة']
      : ['ID', 'Emp Code', 'Employee', 'Term. Date', 'Reason', 'Details', 'Settlement', 'Status'];
    
    const csvData = filteredTerminations.map(t => [
      t.id,
      t.employee_code,
      t.employee_name,
      t.termination_date,
      getReasonLabel(t.reason),
      t.reason_details,
      t.final_settlement,
      getStatusLabel(t.status)
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `terminations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getReasonLabel = (reason) => {
    const found = terminationReasons.find(r => r.id === reason);
    return found ? found.label : reason;
  };

  const getReasonBadge = (reason) => {
    const found = terminationReasons.find(r => r.id === reason);
    const colorStyles = {
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
      orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    };
    const style = found ? colorStyles[found.color] : colorStyles.slate;
    return <Badge className={`${style} hover:${style}`}>{getReasonLabel(reason)}</Badge>;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: language === 'ar' ? 'قيد المعالجة' : 'Pending',
      in_progress: language === 'ar' ? 'جاري التنفيذ' : 'In Progress',
      completed: language === 'ar' ? 'مكتمل' : 'Completed'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    };
    return <Badge className={`${styles[status]} hover:${styles[status]}`}>{getStatusLabel(status)}</Badge>;
  };

  const filteredTerminations = terminations.filter(t => {
    const matchesReason = filterReason === 'all' || t.reason === filterReason;
    const matchesSearch = t.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesReason && matchesSearch;
  });

  const stats = {
    total: terminations.length,
    completed: terminations.filter(t => t.status === 'completed').length,
    pending: terminations.filter(t => t.status === 'pending').length,
    totalSettlement: terminations.reduce((sum, t) => sum + (t.final_settlement || 0), 0)
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الحالات' : 'Total Cases',
      value: stats.total,
      icon: UserCircleMinus,
      bgColor: 'bg-rose-50 dark:bg-rose-950/50',
      iconColor: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      title: language === 'ar' ? 'مكتمل' : 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: language === 'ar' ? 'قيد المعالجة' : 'Pending',
      value: stats.pending,
      icon: Warning,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      title: language === 'ar' ? 'إجمالي المستحقات' : 'Total Settlement',
      value: stats.totalSettlement.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      icon: ClipboardText,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="termination-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <UserCircleMinus weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'إنهاء الخدمة' : 'Employment Termination'}
              </h1>
              <p className="text-rose-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة حالات إنهاء خدمة الموظفين والمستحقات'
                  : 'Manage employee terminations and settlements'
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
              className="bg-white text-rose-700 hover:bg-rose-50"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة إنهاء خدمة' : 'Add Termination'}
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
                    <div className="flex items-baseline gap-1">
                      <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                      {card.suffix && <span className="text-sm text-slate-500">{card.suffix}</span>}
                    </div>
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
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'جميع الأسباب' : 'All Reasons'}</SelectItem>
                  {terminationReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id}>{reason.label}</SelectItem>
                  ))}
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
                <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'تاريخ الإنهاء' : 'Term. Date'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'المستحقات' : 'Settlement'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTerminations.length > 0 ? filteredTerminations.map((termination) => (
                <TableRow key={termination.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="font-medium text-rose-600">{termination.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-rose-100 text-rose-700">
                          {termination.employee_name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{termination.employee_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{termination.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarX weight="fill" className="w-4 h-4 text-rose-500" />
                      {termination.termination_date}
                    </div>
                  </TableCell>
                  <TableCell>{getReasonBadge(termination.reason)}</TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {termination.final_settlement?.toLocaleString()} 
                      <span className="text-xs text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(termination.status)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600"
                      onClick={() => { setSelectedTermination(termination); setShowViewModal(true); }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    {language === 'ar' ? 'لا توجد حالات إنهاء خدمة' : 'No terminations found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircleMinus weight="fill" className="w-5 h-5 text-rose-500" />
              {language === 'ar' ? 'إضافة إنهاء خدمة' : 'Add Termination'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'كود الموظف' : 'Employee Code'}</Label>
                <Input
                  value={newTermination.employee_code}
                  onChange={(e) => setNewTermination({ ...newTermination, employee_code: e.target.value })}
                  placeholder="EMP001"
                  className="font-mono"
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'اسم الموظف' : 'Employee Name'}</Label>
                <Input
                  value={newTermination.employee_name}
                  onChange={(e) => setNewTermination({ ...newTermination, employee_name: e.target.value })}
                  placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee name'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'تاريخ إنهاء الخدمة' : 'Termination Date'}</Label>
                <Input
                  type="date"
                  value={newTermination.termination_date}
                  onChange={(e) => setNewTermination({ ...newTermination, termination_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'فترة الإشعار (أيام)' : 'Notice Period (days)'}</Label>
                <Input
                  type="number"
                  value={newTermination.notice_period}
                  onChange={(e) => setNewTermination({ ...newTermination, notice_period: e.target.value })}
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <Label>{language === 'ar' ? 'سبب إنهاء الخدمة' : 'Termination Reason'}</Label>
              <Select 
                value={newTermination.reason} 
                onValueChange={(v) => setNewTermination({ ...newTermination, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر السبب' : 'Select reason'} />
                </SelectTrigger>
                <SelectContent>
                  {terminationReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id}>{reason.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ar' ? 'تفاصيل السبب' : 'Reason Details'}</Label>
              <Textarea
                value={newTermination.reason_details}
                onChange={(e) => setNewTermination({ ...newTermination, reason_details: e.target.value })}
                placeholder={language === 'ar' ? 'تفاصيل إضافية...' : 'Additional details...'}
                rows={2}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'المستحقات النهائية' : 'Final Settlement'}</Label>
              <Input
                type="number"
                value={newTermination.final_settlement}
                onChange={(e) => setNewTermination({ ...newTermination, final_settlement: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea
                value={newTermination.notes}
                onChange={(e) => setNewTermination({ ...newTermination, notes: e.target.value })}
                placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-rose-500 hover:bg-rose-600" onClick={handleAddTermination}>
              {language === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تفاصيل إنهاء الخدمة' : 'Termination Details'}</DialogTitle>
          </DialogHeader>
          {selectedTermination && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-rose-200 text-rose-700 text-lg">
                    {selectedTermination.employee_name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedTermination.employee_name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{selectedTermination.employee_code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'رقم الحالة' : 'Case ID'}</Label>
                  <p className="font-medium">{selectedTermination.id}</p>
                </div>
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'تاريخ الإنهاء' : 'Term. Date'}</Label>
                  <p className="font-medium">{selectedTermination.termination_date}</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'السبب' : 'Reason'}</Label>
                <div className="mt-1">{getReasonBadge(selectedTermination.reason)}</div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'تفاصيل السبب' : 'Reason Details'}</Label>
                <p className="font-medium">{selectedTermination.reason_details}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'فترة الإشعار' : 'Notice Period'}</Label>
                  <p className="font-medium">{selectedTermination.notice_period} {language === 'ar' ? 'يوم' : 'days'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">{language === 'ar' ? 'المستحقات' : 'Settlement'}</Label>
                  <p className="font-medium text-lg">
                    {selectedTermination.final_settlement?.toLocaleString()} 
                    <span className="text-sm text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</Label>
                <div className="mt-1">{getStatusBadge(selectedTermination.status)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TerminationPage;
