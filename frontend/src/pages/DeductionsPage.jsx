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
  Plus, Download, Eye, Search, Filter, Trash2, Edit
} from 'lucide-react';
import { 
  ArrowDown, Minus, Warning, Receipt, CurrencyDollar
} from '@phosphor-icons/react';

const DeductionsPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeduction, setSelectedDeduction] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [newDeduction, setNewDeduction] = useState({
    employee_id: '',
    employee_name: '',
    category: 'absence',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const categories = [
    { value: 'absence', label: language === 'ar' ? 'غياب' : 'Absence' },
    { value: 'late', label: language === 'ar' ? 'تأخير' : 'Late Arrival' },
    { value: 'penalty', label: language === 'ar' ? 'جزاء' : 'Penalty' },
    { value: 'loan', label: language === 'ar' ? 'قسط سلفة' : 'Loan Installment' },
    { value: 'insurance', label: language === 'ar' ? 'تأمينات' : 'Insurance' },
    { value: 'tax', label: language === 'ar' ? 'ضرائب' : 'Tax' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' }
  ];

  useEffect(() => {
    fetchDeductions();
  }, [selectedMonth]);

  const fetchDeductions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/deductions?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDeductions(data);
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock data
      setDeductions([
        { id: 'DED001', employee_code: 'EMP001', employee_name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', category: 'late', amount: 150, date: '2024-12-15', reason: language === 'ar' ? 'تأخير 30 دقيقة' : '30 min late' },
        { id: 'DED002', employee_code: 'EMP002', employee_name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', category: 'absence', amount: 500, date: '2024-12-10', reason: language === 'ar' ? 'غياب بدون إذن' : 'Absence without notice' },
        { id: 'DED003', employee_code: 'EMP003', employee_name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', category: 'loan', amount: 1000, date: '2024-12-01', reason: language === 'ar' ? 'قسط سلفة شهر ديسمبر' : 'December loan installment' },
        { id: 'DED004', employee_code: 'EMP004', employee_name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', category: 'insurance', amount: 800, date: '2024-12-01', reason: language === 'ar' ? 'تأمينات اجتماعية' : 'Social insurance' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDeduction = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/deductions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newDeduction)
      });
      
      if (response.ok) {
        fetchDeductions();
        setShowAddModal(false);
        setNewDeduction({ employee_id: '', employee_name: '', category: 'absence', amount: '', date: new Date().toISOString().split('T')[0], reason: '' });
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock add
      const id = 'DED' + String(deductions.length + 1).padStart(3, '0');
      setDeductions([...deductions, { ...newDeduction, id, employee_code: 'EMP00X' }]);
      setShowAddModal(false);
      setNewDeduction({ employee_id: '', employee_name: '', category: 'absence', amount: '', date: new Date().toISOString().split('T')[0], reason: '' });
    }
  };

  const handleDeleteDeduction = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/deductions/${selectedDeduction.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDeductions();
    } catch (error) {
      setDeductions(deductions.filter(d => d.id !== selectedDeduction.id));
    }
    setShowDeleteModal(false);
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'النوع', 'المبلغ', 'التاريخ', 'السبب']
      : ['ID', 'Emp Code', 'Employee', 'Category', 'Amount', 'Date', 'Reason'];
    
    const csvData = filteredDeductions.map(d => [
      d.id, d.employee_code, d.employee_name, getCategoryLabel(d.category),
      d.amount, d.date, d.reason
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `deductions_${selectedMonth}.csv`;
    link.click();
  };

  const getCategoryLabel = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const getCategoryBadge = (category) => {
    const styles = {
      absence: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      penalty: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      loan: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      insurance: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      tax: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
      other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    };
    return <Badge className={`${styles[category]} hover:${styles[category]}`}>{getCategoryLabel(category)}</Badge>;
  };

  const filteredDeductions = deductions.filter(d => {
    const matchesCategory = filterCategory === 'all' || d.category === filterCategory;
    const matchesSearch = d.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const stats = {
    total: deductions.length,
    totalAmount: deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0),
    absenceCount: deductions.filter(d => d.category === 'absence').length,
    lateCount: deductions.filter(d => d.category === 'late').length
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions',
      value: stats.total,
      icon: ArrowDown,
      bgColor: 'bg-red-50 dark:bg-red-950/50',
      iconColor: 'bg-red-500',
      textColor: 'text-red-600 dark:text-red-400'
    },
    {
      title: language === 'ar' ? 'إجمالي المبالغ' : 'Total Amount',
      value: stats.totalAmount.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      icon: CurrencyDollar,
      bgColor: 'bg-rose-50 dark:bg-rose-950/50',
      iconColor: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      title: language === 'ar' ? 'خصومات الغياب' : 'Absence Deductions',
      value: stats.absenceCount,
      icon: Warning,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      title: language === 'ar' ? 'خصومات التأخير' : 'Late Deductions',
      value: stats.lateCount,
      icon: Receipt,
      bgColor: 'bg-orange-50 dark:bg-orange-950/50',
      iconColor: 'bg-orange-500',
      textColor: 'text-orange-600 dark:text-orange-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="deductions-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-rose-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ArrowDown weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'الخصومات' : 'Deductions'}
              </h1>
              <p className="text-red-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة خصومات الموظفين والجزاءات'
                  : 'Manage employee deductions and penalties'
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
              className="bg-white text-red-700 hover:bg-red-50"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة خصم' : 'Add Deduction'}
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
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
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
                <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'النوع' : 'Category'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeductions.length > 0 ? filteredDeductions.map((deduction) => (
                <TableRow key={deduction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-red-100 text-red-700">
                          {deduction.employee_name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{deduction.employee_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{deduction.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(deduction.category)}</TableCell>
                  <TableCell>
                    <span className="font-bold text-red-600">-{parseFloat(deduction.amount).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </TableCell>
                  <TableCell>{deduction.date}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{deduction.reason}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                        onClick={() => { setSelectedDeduction(deduction); setShowViewModal(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => { setSelectedDeduction(deduction); setShowDeleteModal(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {language === 'ar' ? 'لا توجد خصومات' : 'No deductions found'}
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
              <ArrowDown weight="fill" className="w-5 h-5 text-red-500" />
              {language === 'ar' ? 'إضافة خصم جديد' : 'Add New Deduction'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'الموظف' : 'Employee'}</Label>
              <Input
                value={newDeduction.employee_name}
                onChange={(e) => setNewDeduction({ ...newDeduction, employee_name: e.target.value })}
                placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee name'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'النوع' : 'Category'}</Label>
              <Select value={newDeduction.category} onValueChange={(value) => setNewDeduction({ ...newDeduction, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'المبلغ' : 'Amount'}</Label>
                <Input
                  type="number"
                  value={newDeduction.amount}
                  onChange={(e) => setNewDeduction({ ...newDeduction, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{language === 'ar' ? 'التاريخ' : 'Date'}</Label>
                <Input
                  type="date"
                  value={newDeduction.date}
                  onChange={(e) => setNewDeduction({ ...newDeduction, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{language === 'ar' ? 'السبب' : 'Reason'}</Label>
              <Input
                value={newDeduction.reason}
                onChange={(e) => setNewDeduction({ ...newDeduction, reason: e.target.value })}
                placeholder={language === 'ar' ? 'سبب الخصم' : 'Deduction reason'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleAddDeduction}>
              {language === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تفاصيل الخصم' : 'Deduction Details'}</DialogTitle>
          </DialogHeader>
          {selectedDeduction && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-red-200 text-red-700 text-lg">
                    {selectedDeduction.employee_name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedDeduction.employee_name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{selectedDeduction.employee_code}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{language === 'ar' ? 'النوع' : 'Category'}</span>
                  {getCategoryBadge(selectedDeduction.category)}
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                  <span>{language === 'ar' ? 'المبلغ' : 'Amount'}</span>
                  <span className="font-bold text-red-700">-{parseFloat(selectedDeduction.amount).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{language === 'ar' ? 'التاريخ' : 'Date'}</span>
                  <span className="font-medium">{selectedDeduction.date}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500">{language === 'ar' ? 'السبب' : 'Reason'}</span>
                  <p className="font-medium mt-1">{selectedDeduction.reason}</p>
                </div>
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
              ? 'هل أنت متأكد من حذف هذا الخصم؟'
              : 'Are you sure you want to delete this deduction?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDeleteDeduction}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeductionsPage;
