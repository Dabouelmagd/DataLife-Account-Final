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
  Plus, Download, Eye, Search, Filter, Trash2, Clock
} from 'lucide-react';
import { 
  ArrowUp, Money, Clock as ClockIcon, Gift, CurrencyDollar
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

const AllowancesPage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAllowance, setSelectedAllowance] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [newAllowance, setNewAllowance] = useState({
    employee_id: '',
    employee_name: '',
    category: 'overtime',
    amount: '',
    hours: '',
    rate: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const categories = [
    { value: 'overtime', label: language === 'ar' ? 'إضافي' : 'Overtime' },
    { value: 'housing', label: language === 'ar' ? 'بدل سكن' : 'Housing Allowance' },
    { value: 'transport', label: language === 'ar' ? 'بدل انتقال' : 'Transport Allowance' },
    { value: 'phone', label: language === 'ar' ? 'بدل هاتف' : 'Phone Allowance' },
    { value: 'meal', label: language === 'ar' ? 'بدل وجبات' : 'Meal Allowance' },
    { value: 'bonus', label: language === 'ar' ? 'مكافأة' : 'Bonus' },
    { value: 'commission', label: language === 'ar' ? 'عمولة' : 'Commission' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' }
  ];

  useEffect(() => {
    fetchAllowances();
  }, [selectedMonth]);

  const fetchAllowances = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/allowances?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        // Handle both array and {data: [...]} responses
        const data = Array.isArray(result) ? result : (result.data || []);
        setAllowances(data);
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock data
      setAllowances([
        { id: 'ALW001', employee_code: 'EMP001', employee_name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', category: 'overtime', amount: 1500, hours: 10, rate: 150, date: '2024-12-15', notes: language === 'ar' ? 'عمل إضافي يوم الجمعة' : 'Friday overtime work' },
        { id: 'ALW002', employee_code: 'EMP002', employee_name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', category: 'housing', amount: 2000, date: '2024-12-01', notes: language === 'ar' ? 'بدل سكن شهري' : 'Monthly housing allowance' },
        { id: 'ALW003', employee_code: 'EMP003', employee_name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', category: 'bonus', amount: 3000, date: '2024-12-10', notes: language === 'ar' ? 'مكافأة أداء متميز' : 'Outstanding performance bonus' },
        { id: 'ALW004', employee_code: 'EMP004', employee_name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', category: 'transport', amount: 500, date: '2024-12-01', notes: language === 'ar' ? 'بدل انتقال شهري' : 'Monthly transport allowance' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllowance = async () => {
    // Calculate amount for overtime
    let amount = newAllowance.amount;
    if (newAllowance.category === 'overtime' && newAllowance.hours && newAllowance.rate) {
      amount = parseFloat(newAllowance.hours) * parseFloat(newAllowance.rate);
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/allowances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newAllowance, amount })
      });
      
      if (response.ok) {
        fetchAllowances();
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock add
      const id = 'ALW' + String(allowances.length + 1).padStart(3, '0');
      setAllowances([...allowances, { ...newAllowance, id, amount, employee_code: 'EMP00X' }]);
      setShowAddModal(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setNewAllowance({
      employee_id: '', employee_name: '', category: 'overtime',
      amount: '', hours: '', rate: '', date: new Date().toISOString().split('T')[0], notes: ''
    });
  };

  const handleDeleteAllowance = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/allowances/${selectedAllowance.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllowances();
    } catch (error) {
      setAllowances(allowances.filter(a => a.id !== selectedAllowance.id));
    }
    setShowDeleteModal(false);
  };

  const exportToExcel = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'كود الموظف', 'الموظف', 'النوع', 'المبلغ', 'الساعات', 'التاريخ', 'ملاحظات']
      : ['ID', 'Emp Code', 'Employee', 'Category', 'Amount', 'Hours', 'Date', 'Notes'];
    
    const csvData = filteredAllowances.map(a => [
      a.id, a.employee_code, a.employee_name, getCategoryLabel(a.category),
      a.amount, a.hours || '-', a.date, a.notes
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `allowances_${selectedMonth}.csv`;
    link.click();
  };

  const getCategoryLabel = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const getCategoryBadge = (category) => {
    const styles = {
      overtime: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      housing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      transport: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      phone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      meal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      bonus: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      commission: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    };
    return <Badge className={`${styles[category]} hover:${styles[category]}`}>{getCategoryLabel(category)}</Badge>;
  };

  const filteredAllowances = allowances.filter(a => {
    const matchesCategory = filterCategory === 'all' || a.category === filterCategory;
    const matchesSearch = a.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const stats = {
    total: allowances.length,
    totalAmount: allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0),
    overtimeCount: allowances.filter(a => a.category === 'overtime').length,
    overtimeAmount: allowances.filter(a => a.category === 'overtime').reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances',
      value: stats.total,
      icon: ArrowUp,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: language === 'ar' ? 'إجمالي المبالغ' : 'Total Amount',
      value: stats.totalAmount.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      icon: CurrencyDollar,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: language === 'ar' ? 'ساعات الإضافي' : 'Overtime Records',
      value: stats.overtimeCount,
      icon: ClockIcon,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      title: language === 'ar' ? 'مبلغ الإضافي' : 'Overtime Amount',
      value: stats.overtimeAmount.toLocaleString(),
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      icon: Gift,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500',
      textColor: 'text-violet-600 dark:text-violet-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="allowances-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ArrowUp weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime'}
              </h1>
              <p className="text-blue-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة بدلات الموظفين وساعات العمل الإضافي'
                  : 'Manage employee allowances and overtime hours'
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
              className="bg-white text-blue-700 hover:bg-blue-50"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة بدل' : 'Add Allowance'}
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
                <SelectTrigger className="w-[160px]">
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
                <TableHead className="font-semibold">{language === 'ar' ? 'الساعات' : 'Hours'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAllowances.length > 0 ? filteredAllowances.map((allowance) => (
                <TableRow key={allowance.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {allowance.employee_name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{allowance.employee_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{allowance.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(allowance.category)}</TableCell>
                  <TableCell>
                    {allowance.hours ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{allowance.hours}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-emerald-600">+{parseFloat(allowance.amount).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ms-1">{language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </TableCell>
                  <TableCell>{allowance.date}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                        onClick={() => { setSelectedAllowance(allowance); setShowViewModal(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        onClick={() => { setSelectedAllowance(allowance); setShowDeleteModal(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {language === 'ar' ? 'لا توجد بدلات' : 'No allowances found'}
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
              <ArrowUp weight="fill" className="w-5 h-5 text-blue-500" />
              {language === 'ar' ? 'إضافة بدل جديد' : 'Add New Allowance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'الموظف' : 'Employee'}</Label>
              <Input
                value={newAllowance.employee_name}
                onChange={(e) => setNewAllowance({ ...newAllowance, employee_name: e.target.value })}
                placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee name'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'النوع' : 'Category'}</Label>
              <Select value={newAllowance.category} onValueChange={(value) => setNewAllowance({ ...newAllowance, category: value })}>
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
            
            {newAllowance.category === 'overtime' && (
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <div>
                  <Label>{language === 'ar' ? 'عدد الساعات' : 'Hours'}</Label>
                  <Input
                    type="number"
                    value={newAllowance.hours}
                    onChange={(e) => setNewAllowance({ ...newAllowance, hours: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>{language === 'ar' ? 'سعر الساعة' : 'Hourly Rate'}</Label>
                  <Input
                    type="number"
                    value={newAllowance.rate}
                    onChange={(e) => setNewAllowance({ ...newAllowance, rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                {newAllowance.hours && newAllowance.rate && (
                  <div className="col-span-2 text-center p-2 rounded bg-blue-100 dark:bg-blue-900/50">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{language === 'ar' ? 'المبلغ:' : 'Total:'}</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400 ms-2">
                      {(parseFloat(newAllowance.hours) * parseFloat(newAllowance.rate)).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {newAllowance.category !== 'overtime' && (
              <div>
                <Label>{language === 'ar' ? 'المبلغ' : 'Amount'}</Label>
                <Input
                  type="number"
                  value={newAllowance.amount}
                  onChange={(e) => setNewAllowance({ ...newAllowance, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}
            
            <div>
              <Label>{language === 'ar' ? 'التاريخ' : 'Date'}</Label>
              <Input
                type="date"
                value={newAllowance.date}
                onChange={(e) => setNewAllowance({ ...newAllowance, date: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
              <Input
                value={newAllowance.notes}
                onChange={(e) => setNewAllowance({ ...newAllowance, notes: e.target.value })}
                placeholder={language === 'ar' ? 'ملاحظات إضافية' : 'Additional notes'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleAddAllowance}>
              {language === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تفاصيل البدل' : 'Allowance Details'}</DialogTitle>
          </DialogHeader>
          {selectedAllowance && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-blue-200 text-blue-700 text-lg">
                    {selectedAllowance.employee_name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedAllowance.employee_name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{selectedAllowance.employee_code}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{language === 'ar' ? 'النوع' : 'Category'}</span>
                  {getCategoryBadge(selectedAllowance.category)}
                </div>
                {selectedAllowance.hours && (
                  <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span>{language === 'ar' ? 'الساعات' : 'Hours'}</span>
                    <span className="font-medium">{selectedAllowance.hours} {language === 'ar' ? 'ساعة' : 'hrs'}</span>
                  </div>
                )}
                <div className="flex justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <span>{language === 'ar' ? 'المبلغ' : 'Amount'}</span>
                  <span className="font-bold text-emerald-700">+{parseFloat(selectedAllowance.amount).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{language === 'ar' ? 'التاريخ' : 'Date'}</span>
                  <span className="font-medium">{selectedAllowance.date}</span>
                </div>
                {selectedAllowance.notes && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-slate-500">{language === 'ar' ? 'ملاحظات' : 'Notes'}</span>
                    <p className="font-medium mt-1">{selectedAllowance.notes}</p>
                  </div>
                )}
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
              ? 'هل أنت متأكد من حذف هذا البدل؟'
              : 'Are you sure you want to delete this allowance?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllowance}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllowancesPage;
