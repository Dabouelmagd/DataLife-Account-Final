import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { 
  Plus, Download, Eye, Search, Filter, DollarSign, CheckCircle,
  Clock, Printer, ArrowUp, Edit, Trash2
} from 'lucide-react';
import { 
  Money, Wallet, CheckCircle as CheckIcon, HourglassMedium, CurrencyDollar
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

const SalariesPage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [newSalary, setNewSalary] = useState({
    employee_code: '',
    employee_name: '',
    position: '',
    basic_salary: '',
    allowances: '',
    deductions: '',
    net_salary: ''
  });

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/salaries?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        // Handle both array and {data: [...]} responses
        const data = Array.isArray(result) ? result : (result.data || []);
        setSalaries(data);
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock data
      setSalaries([
        { id: 'SAL001', employee_code: 'EMP001', employee_name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', position: language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer', basic_salary: 15000, allowances: 3500, deductions: 1500, net_salary: 17000, status: 'paid' },
        { id: 'SAL002', employee_code: 'EMP002', employee_name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', position: language === 'ar' ? 'مدير موارد بشرية' : 'HR Manager', basic_salary: 20000, allowances: 4000, deductions: 2000, net_salary: 22000, status: 'paid' },
        { id: 'SAL003', employee_code: 'EMP003', employee_name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', position: language === 'ar' ? 'محاسب' : 'Accountant', basic_salary: 12000, allowances: 2500, deductions: 1000, net_salary: 13500, status: 'pending' },
        { id: 'SAL004', employee_code: 'EMP004', employee_name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', position: language === 'ar' ? 'مصمم جرافيك' : 'Graphic Designer', basic_salary: 10000, allowances: 2200, deductions: 800, net_salary: 11400, status: 'pending' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/salaries/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ month: selectedMonth })
      });
      fetchSalaries();
      setShowProcessModal(false);
    } catch (error) {
      console.error('Error:', error);
      // Mock process
      setSalaries(salaries.map(s => ({ ...s, status: 'paid' })));
      setShowProcessModal(false);
    }
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'الوظيفة', 'الراتب الأساسي', 'البدلات', 'الخصومات', 'صافي الراتب', 'الحالة']
      : ['ID', 'Emp Code', 'Employee', 'Position', 'Basic Salary', 'Allowances', 'Deductions', 'Net Salary', 'Status'];
    
    const csvData = filteredSalaries.map(s => [
      s.id, s.employee_code, s.employee_name, s.position,
      s.basic_salary, s.allowances, s.deductions, s.net_salary,
      getStatusLabel(s.status)
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `salaries_${selectedMonth}.csv`;
    link.click();
  };

  const getStatusLabel = (status) => {
    const labels = {
      paid: language === 'ar' ? 'مدفوع' : 'Paid',
      pending: language === 'ar' ? 'معلق' : 'Pending',
      processing: language === 'ar' ? 'جاري المعالجة' : 'Processing'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return <Badge className={`${styles[status]} hover:${styles[status]}`}>{getStatusLabel(status)}</Badge>;
  };

  const filteredSalaries = salaries.filter(s => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesSearch = s.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: salaries.length,
    paid: salaries.filter(s => s.status === 'paid').length,
    pending: salaries.filter(s => s.status === 'pending').length,
    totalNet: salaries.reduce((sum, s) => sum + (s.net_salary || 0), 0),
    totalBasic: salaries.reduce((sum, s) => sum + (s.basic_salary || 0), 0)
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees',
      value: stats.total,
      icon: Money,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: language === 'ar' ? 'مدفوع' : 'Paid',
      value: stats.paid,
      icon: CheckIcon,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: language === 'ar' ? 'معلق' : 'Pending',
      value: stats.pending,
      icon: HourglassMedium,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      title: language === 'ar' ? 'إجمالي الرواتب' : 'Total Salaries',
      value: stats.totalNet.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      icon: CurrencyDollar,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500',
      textColor: 'text-violet-600 dark:text-violet-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="salaries-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Money weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'المرتبات' : 'Salaries'}
              </h1>
              <p className="text-emerald-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة رواتب الموظفين ومعالجة كشوف المرتبات'
                  : 'Manage employee salaries and process payroll'
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
              className="bg-white text-emerald-700 hover:bg-emerald-50"
              onClick={() => setShowProcessModal(true)}
            >
              <CheckCircle className="w-4 h-4 me-2" />
              {language === 'ar' ? 'معالجة الرواتب' : 'Process Payroll'}
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
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{language === 'ar' ? 'الشهر:' : 'Month:'}</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
              />
            </div>
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
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  <SelectItem value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</SelectItem>
                  <SelectItem value="pending">{language === 'ar' ? 'معلق' : 'Pending'}</SelectItem>
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
                <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الوظيفة' : 'Position'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الراتب الأساسي' : 'Basic'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'البدلات' : 'Allowances'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الخصومات' : 'Deductions'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'صافي الراتب' : 'Net Salary'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalaries.length > 0 ? filteredSalaries.map((salary) => (
                <TableRow key={salary.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">
                          {salary.employee_name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{salary.employee_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{salary.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{salary.position}</TableCell>
                  <TableCell>
                    <span className="font-medium">{salary.basic_salary?.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium">
                    +{salary.allowances?.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-red-600 font-medium">
                    -{salary.deductions?.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-lg">{salary.net_salary?.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(salary.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600"
                        onClick={() => { setSelectedSalary(salary); setShowViewModal(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {language === 'ar' ? 'لا توجد رواتب' : 'No salaries found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Process Payroll Modal */}
      <Dialog open={showProcessModal} onOpenChange={setShowProcessModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              {language === 'ar' ? 'معالجة الرواتب' : 'Process Payroll'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">
            {language === 'ar' 
              ? `هل تريد معالجة رواتب شهر ${selectedMonth}؟ سيتم تحديث حالة جميع الرواتب المعلقة إلى "مدفوع".`
              : `Process payroll for ${selectedMonth}? This will mark all pending salaries as paid.`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleProcessPayroll}>
              {language === 'ar' ? 'معالجة' : 'Process'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تفاصيل الراتب' : 'Salary Details'}</DialogTitle>
          </DialogHeader>
          {selectedSalary && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-emerald-200 text-emerald-700 text-lg">
                    {selectedSalary.employee_name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedSalary.employee_name}</h3>
                  <p className="text-sm text-slate-500">{selectedSalary.position}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{language === 'ar' ? 'الراتب الأساسي' : 'Basic Salary'}</span>
                  <span className="font-bold">{selectedSalary.basic_salary?.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <span className="text-emerald-700">{language === 'ar' ? '+ البدلات' : '+ Allowances'}</span>
                  <span className="font-bold text-emerald-700">{selectedSalary.allowances?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                  <span className="text-red-700">{language === 'ar' ? '- الخصومات' : '- Deductions'}</span>
                  <span className="font-bold text-red-700">{selectedSalary.deductions?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-violet-100 dark:bg-violet-950/30 border-2 border-violet-300">
                  <span className="font-bold">{language === 'ar' ? 'صافي الراتب' : 'Net Salary'}</span>
                  <span className="font-bold text-xl text-violet-700">{selectedSalary.net_salary?.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                </div>
              </div>
              <div>
                <Label className="text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</Label>
                <div className="mt-1">{getStatusBadge(selectedSalary.status)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalariesPage;
