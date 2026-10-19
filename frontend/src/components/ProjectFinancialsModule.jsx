import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import axios from 'axios';
import ProjectMoneyDialog, { EXPENSE_CATS, REVENUE_CATS } from './ProjectMoneyDialog';
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
  
  const [moneyKind, setMoneyKind] = useState(null);   // 'expense' | 'revenue' while the form is open

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

  const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-rose-500', 'bg-lime-600', 'bg-gray-500'];
  const expenseCategories = Object.fromEntries(Object.entries(EXPENSE_CATS).map(([k, name], i) => [k, { name, color: COLORS[i % COLORS.length] }]));
  const revenueCategories = Object.fromEntries(Object.entries(REVENUE_CATS).map(([k, name], i) => [k, { name, color: COLORS[i % COLORS.length] }]));

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

  const cancelItem = async (kind, item) => {
    const reason = window.prompt(isRTL ? 'سبب الإلغاء — سيُعكس القيد بنفس تاريخه ويبقى ظاهراً للمراجعة:' : 'Reason for cancelling:');
    if (!reason || reason.trim().length < 3) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/projects/${projectId}/${kind === 'expense' ? 'expenses' : 'revenues'}/${item.id}/cancel`,
        { reason: reason.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(data.message);
      fetchFinancials();
    } catch (error) {
      toast.error(error?.response?.data?.detail || (isRTL ? 'تعذّر الإلغاء' : 'Could not cancel'));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
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
        <div className="flex gap-2">
          <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setMoneyKind('expense')}>
            <Plus className="h-4 w-4 me-1" />{isRTL ? 'مصروف' : 'Expense'}
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setMoneyKind('revenue')}>
            <Plus className="h-4 w-4 me-1" />{isRTL ? 'إيراد' : 'Revenue'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </div>

      {(financials?.ledger_check?.unposted || []).length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {isRTL
            ? `${financials.ledger_check.unposted.length} بند في هذا المشروع ليس له قيد مرحّل — لا يظهر في الحسابات. ألغِه وأعد تسجيله.`
            : `${financials.ledger_check.unposted.length} items have no posted entry.`}
        </div>
      )}

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
            <Button onClick={() => setMoneyKind('expense')}>
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
                          <p className="font-medium">{expense.description}
                            {expense.status === 'cancelled' && <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">ملغى{expense.cancel_reason ? ` — ${expense.cancel_reason}` : ''}</span>}
                          </p>
                          {(expense.account_code || expense.journal_entry_number) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {expense.account_code && <span>{expense.account_code} {expense.account_name}</span>}
                              {expense.paid_from_name && <span> · {'expense' === 'expense' ? 'من' : 'إلى'} {expense.paid_from_name}</span>}
                              {expense.journal_entry_number && <span dir="ltr" className="ms-1 px-1.5 rounded bg-blue-50 text-blue-700">{expense.journal_entry_number}</span>}
                            </p>
                          )}
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
                        <span className={`text-lg font-bold ${expense.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-red-600'}`}>{formatCurrency(expense.amount)}</span>
                        <div className="flex gap-1">
                          {expense.status !== 'cancelled' && (
                            <Button variant="ghost" size="sm" title={isRTL ? 'إلغاء بقيد عكسي' : 'Cancel'} onClick={() => cancelItem('expense', expense)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
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
            <Button onClick={() => setMoneyKind('revenue')}>
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
                          <p className="font-medium">{revenue.description}
                            {revenue.status === 'cancelled' && <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">ملغى{revenue.cancel_reason ? ` — ${revenue.cancel_reason}` : ''}</span>}
                          </p>
                          {(revenue.account_code || revenue.journal_entry_number) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {revenue.account_code && <span>{revenue.account_code} {revenue.account_name}</span>}
                              {revenue.paid_from_name && <span> · {'revenue' === 'expense' ? 'من' : 'إلى'} {revenue.paid_from_name}</span>}
                              {revenue.journal_entry_number && <span dir="ltr" className="ms-1 px-1.5 rounded bg-blue-50 text-blue-700">{revenue.journal_entry_number}</span>}
                            </p>
                          )}
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
                        <span className={`text-lg font-bold ${revenue.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-green-600'}`}>{formatCurrency(revenue.amount)}</span>
                        <div className="flex gap-1">
                          {revenue.status !== 'cancelled' && (
                            <Button variant="ghost" size="sm" title={isRTL ? 'إلغاء بقيد عكسي' : 'Cancel'} onClick={() => cancelItem('revenue', revenue)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
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

      {moneyKind && (
        <ProjectMoneyDialog
          projectId={projectId}
          kind={moneyKind}
          onClose={() => setMoneyKind(null)}
          onSaved={(data) => { setMoneyKind(null); toast.success(data.message); fetchFinancials(); }}
        />
      )}
    </div>
  );
};

export default ProjectFinancialsModule;
