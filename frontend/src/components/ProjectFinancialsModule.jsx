import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FolderKanban, Plus, DollarSign, TrendingUp, TrendingDown, 
  Receipt, CreditCard, Wallet, PieChart, BarChart3, 
  ArrowUpRight, ArrowDownRight, Trash2, Edit, Eye,
  Calendar, FileText, Building2, User, RefreshCw,
  ChevronRight, ChevronDown, Banknote, Calculator
} from 'lucide-react';

const ProjectFinancialsModule = ({ projectId, projectName, onClose }) => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [activeTab, setActiveTab] = useState('overview');
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingRevenue, setEditingRevenue] = useState(null);

  const [expenseForm, setExpenseForm] = useState({
    category: 'other',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    reference_number: '',
    payment_method: 'cash',
    notes: ''
  });

  const [revenueForm, setRevenueForm] = useState({
    category: 'payment',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    payment_method: 'bank',
    notes: ''
  });

  const t = {
    overview: isRTL ? 'نظرة عامة' : 'Overview',
    expenses: isRTL ? 'المصروفات' : 'Expenses',
    revenues: isRTL ? 'الإيرادات' : 'Revenues',
    addExpense: isRTL ? 'إضافة مصروف' : 'Add Expense',
    addRevenue: isRTL ? 'إضافة إيراد' : 'Add Revenue',
    totalExpenses: isRTL ? 'إجمالي المصروفات' : 'Total Expenses',
    totalRevenues: isRTL ? 'إجمالي الإيرادات' : 'Total Revenues',
    profitLoss: isRTL ? 'الربح/الخسارة' : 'Profit/Loss',
    budget: isRTL ? 'الميزانية' : 'Budget',
    budgetRemaining: isRTL ? 'المتبقي من الميزانية' : 'Budget Remaining',
    budgetUsage: isRTL ? 'نسبة استخدام الميزانية' : 'Budget Usage',
    category: isRTL ? 'الفئة' : 'Category',
    description: isRTL ? 'الوصف' : 'Description',
    amount: isRTL ? 'المبلغ' : 'Amount',
    date: isRTL ? 'التاريخ' : 'Date',
    vendor: isRTL ? 'المورد' : 'Vendor',
    reference: isRTL ? 'رقم المرجع' : 'Reference',
    invoice: isRTL ? 'رقم الفاتورة' : 'Invoice #',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    notes: isRTL ? 'ملاحظات' : 'Notes',
    save: isRTL ? 'حفظ' : 'Save',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    delete: isRTL ? 'حذف' : 'Delete',
    edit: isRTL ? 'تعديل' : 'Edit',
    cash: isRTL ? 'نقدي' : 'Cash',
    bank: isRTL ? 'تحويل بنكي' : 'Bank Transfer',
    check: isRTL ? 'شيك' : 'Check',
    noExpenses: isRTL ? 'لا توجد مصروفات' : 'No expenses yet',
    noRevenues: isRTL ? 'لا توجد إيرادات' : 'No revenues yet',
    profitMargin: isRTL ? 'هامش الربح' : 'Profit Margin',
    expensesByCategory: isRTL ? 'المصروفات حسب الفئة' : 'Expenses by Category',
    revenuesByCategory: isRTL ? 'الإيرادات حسب الفئة' : 'Revenues by Category',
    monthlyBreakdown: isRTL ? 'التفصيل الشهري' : 'Monthly Breakdown'
  };

  const expenseCategories = {
    materials: { name: isRTL ? 'مواد خام' : 'Raw Materials', color: 'bg-blue-500' },
    labor: { name: isRTL ? 'أجور عمالة' : 'Labor Costs', color: 'bg-green-500' },
    equipment: { name: isRTL ? 'معدات وأدوات' : 'Equipment & Tools', color: 'bg-purple-500' },
    administrative: { name: isRTL ? 'مصاريف إدارية' : 'Administrative', color: 'bg-amber-500' },
    transport: { name: isRTL ? 'نقل ومواصلات' : 'Transportation', color: 'bg-cyan-500' },
    subcontractor: { name: isRTL ? 'مقاول من الباطن' : 'Subcontractor', color: 'bg-pink-500' },
    utilities: { name: isRTL ? 'مرافق (كهرباء/ماء)' : 'Utilities', color: 'bg-indigo-500' },
    other: { name: isRTL ? 'مصاريف أخرى' : 'Other Expenses', color: 'bg-gray-500' }
  };

  const revenueCategories = {
    payment: { name: isRTL ? 'دفعة من العميل' : 'Client Payment', color: 'bg-green-500' },
    advance: { name: isRTL ? 'دفعة مقدمة' : 'Advance Payment', color: 'bg-blue-500' },
    milestone: { name: isRTL ? 'دفعة مستخلص' : 'Milestone Payment', color: 'bg-purple-500' },
    final: { name: isRTL ? 'دفعة ختامية' : 'Final Payment', color: 'bg-amber-500' },
    retention: { name: isRTL ? 'إفراج عن ضمان' : 'Retention Release', color: 'bg-cyan-500' },
    other: { name: isRTL ? 'إيرادات أخرى' : 'Other Revenue', color: 'bg-gray-500' }
  };

  useEffect(() => {
    if (projectId) {
      fetchFinancials();
    }
  }, [projectId]);

  const fetchFinancials = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/projects/${projectId}/financials`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFinancials(response.data);
    } catch (error) {
      console.error('Error fetching financials:', error);
      toast.error(isRTL ? 'خطأ في تحميل البيانات المالية' : 'Error loading financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    try {
      if (!expenseForm.amount || !expenseForm.description) {
        toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
        return;
      }

      if (editingExpense) {
        await axios.put(
          `${API_URL}/api/projects/${projectId}/expenses/${editingExpense.id}`,
          expenseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(isRTL ? 'تم تحديث المصروف' : 'Expense updated');
      } else {
        await axios.post(
          `${API_URL}/api/projects/${projectId}/expenses`,
          expenseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(isRTL ? 'تم إضافة المصروف' : 'Expense added');
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      resetExpenseForm();
      fetchFinancials();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(isRTL ? 'خطأ في حفظ المصروف' : 'Error saving expense');
    }
  };

  const handleAddRevenue = async () => {
    try {
      if (!revenueForm.amount || !revenueForm.description) {
        toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
        return;
      }

      if (editingRevenue) {
        await axios.put(
          `${API_URL}/api/projects/${projectId}/revenues/${editingRevenue.id}`,
          revenueForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(isRTL ? 'تم تحديث الإيراد' : 'Revenue updated');
      } else {
        await axios.post(
          `${API_URL}/api/projects/${projectId}/revenues`,
          revenueForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(isRTL ? 'تم إضافة الإيراد' : 'Revenue added');
      }

      setShowRevenueDialog(false);
      setEditingRevenue(null);
      resetRevenueForm();
      fetchFinancials();
    } catch (error) {
      console.error('Error saving revenue:', error);
      toast.error(isRTL ? 'خطأ في حفظ الإيراد' : 'Error saving revenue');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/projects/${projectId}/expenses/${expenseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف المصروف' : 'Expense deleted');
      fetchFinancials();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error(isRTL ? 'خطأ في حذف المصروف' : 'Error deleting expense');
    }
  };

  const handleDeleteRevenue = async (revenueId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/projects/${projectId}/revenues/${revenueId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف الإيراد' : 'Revenue deleted');
      fetchFinancials();
    } catch (error) {
      console.error('Error deleting revenue:', error);
      toast.error(isRTL ? 'خطأ في حذف الإيراد' : 'Error deleting revenue');
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      category: 'other',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      reference_number: '',
      payment_method: 'cash',
      notes: ''
    });
  };

  const resetRevenueForm = () => {
    setRevenueForm({
      category: 'payment',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      payment_method: 'bank',
      notes: ''
    });
  };

  const editExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      vendor: expense.vendor || '',
      reference_number: expense.reference_number || '',
      payment_method: expense.payment_method || 'cash',
      notes: expense.notes || ''
    });
    setShowExpenseDialog(true);
  };

  const editRevenue = (revenue) => {
    setEditingRevenue(revenue);
    setRevenueForm({
      category: revenue.category,
      description: revenue.description,
      amount: revenue.amount.toString(),
      date: revenue.date,
      invoice_number: revenue.invoice_number || '',
      payment_method: revenue.payment_method || 'bank',
      notes: revenue.notes || ''
    });
    setShowRevenueDialog(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  const summary = financials?.summary || {};
  const expenses = financials?.expenses?.items || [];
  const revenues = financials?.revenues?.items || [];

  return (
    <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-[#28376B]" />
            {isRTL ? 'الحسابات المالية' : 'Financial Accounts'}
          </h2>
          <p className="text-gray-500">{projectName}</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          {isRTL ? 'إغلاق' : 'Close'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.totalExpenses}</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_expenses)}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.totalRevenues}</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_revenues)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.profit_loss >= 0 ? 'border-l-emerald-500' : 'border-l-orange-500'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.profitLoss}</p>
                <p className={`text-2xl font-bold ${summary.profit_loss >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {formatCurrency(summary.profit_loss)}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${summary.profit_loss >= 0 ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                {summary.profit_loss >= 0 ? (
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-orange-600" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t.profitMargin}: {summary.profit_margin || 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.budgetRemaining}</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.budget_remaining)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Progress value={summary.budget_usage_percent || 0} className="mt-2 h-2" />
            <p className="text-xs text-gray-400 mt-1">
              {t.budgetUsage}: {summary.budget_usage_percent || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            {t.overview}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t.expenses}
          </TabsTrigger>
          <TabsTrigger value="revenues" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            {t.revenues}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.expensesByCategory}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(financials?.expenses?.by_category || {}).map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${expenseCategories[cat]?.color || 'bg-gray-500'}`} />
                        <span className="text-sm">{expenseCategories[cat]?.name || cat}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  {Object.keys(financials?.expenses?.by_category || {}).length === 0 && (
                    <p className="text-gray-400 text-center py-4">{t.noExpenses}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Revenues by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.revenuesByCategory}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(financials?.revenues?.by_category || {}).map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${revenueCategories[cat]?.color || 'bg-gray-500'}`} />
                        <span className="text-sm">{revenueCategories[cat]?.name || cat}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  {Object.keys(financials?.revenues?.by_category || {}).length === 0 && (
                    <p className="text-gray-400 text-center py-4">{t.noRevenues}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{t.expenses}</h3>
            <Button onClick={() => { resetExpenseForm(); setEditingExpense(null); setShowExpenseDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t.addExpense}
            </Button>
          </div>

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <Card className="p-8 text-center">
                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.noExpenses}</p>
              </Card>
            ) : (
              expenses.map((expense) => (
                <Card key={expense.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${expenseCategories[expense.category]?.color || 'bg-gray-500'} text-white`}>
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{expenseCategories[expense.category]?.name}</span>
                            <span>•</span>
                            <span>{expense.date}</span>
                            {expense.vendor && (
                              <>
                                <span>•</span>
                                <span>{expense.vendor}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-red-600">{formatCurrency(expense.amount)}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => editExpense(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteExpense(expense.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Revenues Tab */}
        <TabsContent value="revenues" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{t.revenues}</h3>
            <Button onClick={() => { resetRevenueForm(); setEditingRevenue(null); setShowRevenueDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t.addRevenue}
            </Button>
          </div>

          <div className="space-y-3">
            {revenues.length === 0 ? (
              <Card className="p-8 text-center">
                <Banknote className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.noRevenues}</p>
              </Card>
            ) : (
              revenues.map((revenue) => (
                <Card key={revenue.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${revenueCategories[revenue.category]?.color || 'bg-gray-500'} text-white`}>
                          <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{revenue.description}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{revenueCategories[revenue.category]?.name}</span>
                            <span>•</span>
                            <span>{revenue.date}</span>
                            {revenue.invoice_number && (
                              <>
                                <span>•</span>
                                <span>#{revenue.invoice_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-green-600">{formatCurrency(revenue.amount)}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => editRevenue(revenue)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRevenue(revenue.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? (isRTL ? 'تعديل مصروف' : 'Edit Expense') : t.addExpense}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.category}</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({...expenseForm, category: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseCategories).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.description} *</Label>
              <Input 
                value={expenseForm.description} 
                onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                placeholder={isRTL ? 'وصف المصروف...' : 'Expense description...'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.amount} *</Label>
                <Input 
                  type="number"
                  value={expenseForm.amount} 
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{t.date}</Label>
                <Input 
                  type="date"
                  value={expenseForm.date} 
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>{t.vendor}</Label>
              <Input 
                value={expenseForm.vendor} 
                onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})}
                placeholder={isRTL ? 'اسم المورد...' : 'Vendor name...'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.reference}</Label>
                <Input 
                  value={expenseForm.reference_number} 
                  onChange={(e) => setExpenseForm({...expenseForm, reference_number: e.target.value})}
                />
              </div>
              <div>
                <Label>{t.paymentMethod}</Label>
                <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm({...expenseForm, payment_method: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t.cash}</SelectItem>
                    <SelectItem value="bank">{t.bank}</SelectItem>
                    <SelectItem value="check">{t.check}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea 
                value={expenseForm.notes} 
                onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleAddExpense}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Revenue Dialog */}
      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRevenue ? (isRTL ? 'تعديل إيراد' : 'Edit Revenue') : t.addRevenue}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.category}</Label>
              <Select value={revenueForm.category} onValueChange={(v) => setRevenueForm({...revenueForm, category: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(revenueCategories).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.description} *</Label>
              <Input 
                value={revenueForm.description} 
                onChange={(e) => setRevenueForm({...revenueForm, description: e.target.value})}
                placeholder={isRTL ? 'وصف الإيراد...' : 'Revenue description...'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.amount} *</Label>
                <Input 
                  type="number"
                  value={revenueForm.amount} 
                  onChange={(e) => setRevenueForm({...revenueForm, amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{t.date}</Label>
                <Input 
                  type="date"
                  value={revenueForm.date} 
                  onChange={(e) => setRevenueForm({...revenueForm, date: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.invoice}</Label>
                <Input 
                  value={revenueForm.invoice_number} 
                  onChange={(e) => setRevenueForm({...revenueForm, invoice_number: e.target.value})}
                />
              </div>
              <div>
                <Label>{t.paymentMethod}</Label>
                <Select value={revenueForm.payment_method} onValueChange={(v) => setRevenueForm({...revenueForm, payment_method: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t.cash}</SelectItem>
                    <SelectItem value="bank">{t.bank}</SelectItem>
                    <SelectItem value="check">{t.check}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea 
                value={revenueForm.notes} 
                onChange={(e) => setRevenueForm({...revenueForm, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevenueDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleAddRevenue}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectFinancialsModule;
