import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Edit, Trash2, Eye, Download, Search, Filter } from 'lucide-react';
import { Badge } from './ui/badge';

// Journal Entries Component
export const JournalEntriesModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const journalEntries = [
    { id: 'JE001', date: '2024-10-01', description: language === 'ar' ? 'مشتريات مواد خام' : 'Raw materials purchase', debit: 50000, credit: 0, account: language === 'ar' ? 'المخزون' : 'Inventory' },
    { id: 'JE002', date: '2024-10-02', description: language === 'ar' ? 'مبيعات منتجات' : 'Product sales', debit: 0, credit: 75000, account: language === 'ar' ? 'المبيعات' : 'Sales' },
    { id: 'JE003', date: '2024-10-03', description: language === 'ar' ? 'دفع رواتب' : 'Salary payment', debit: 120000, credit: 0, account: language === 'ar' ? 'المصروفات' : 'Expenses' },
    { id: 'JE004', date: '2024-10-05', description: language === 'ar' ? 'إيداع نقدي' : 'Cash deposit', debit: 0, credit: 30000, account: language === 'ar' ? 'البنك' : 'Bank' }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'القيود اليومية' : 'Journal Entries'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'بحث' : 'Search'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-[#28376B]">
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'قيد جديد' : 'New Entry'}</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'رقم القيد' : 'Entry #'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحساب' : 'Account'}</TableHead>
                <TableHead>{language === 'ar' ? 'مدين' : 'Debit'}</TableHead>
                <TableHead>{language === 'ar' ? 'دائن' : 'Credit'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journalEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.id}</TableCell>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.account}</TableCell>
                  <TableCell className="text-green-600">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</TableCell>
                  <TableCell className="text-red-600">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Treasury/Cash Module
export const TreasuryModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const treasuryData = {
    balance: 350000,
    transactions: [
      { id: 'T001', date: '2024-10-08', type: 'in', description: language === 'ar' ? 'تحصيل من عميل' : 'Customer payment', amount: 50000 },
      { id: 'T002', date: '2024-10-08', type: 'out', description: language === 'ar' ? 'شراء مستلزمات' : 'Purchase supplies', amount: 15000 },
      { id: 'T003', date: '2024-10-09', type: 'in', description: language === 'ar' ? 'مبيعات نقدية' : 'Cash sales', amount: 30000 },
      { id: 'T004', date: '2024-10-09', type: 'out', description: language === 'ar' ? 'دفع فواتير' : 'Bills payment', amount: 20000 }
    ]
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الخزنة' : 'Treasury'}
        </h2>
        {canEdit && (
          <Button size="sm" className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'حركة جديدة' : 'New Transaction'}</span>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{language === 'ar' ? 'رصيد الخزنة' : 'Treasury Balance'}</span>
            <span className="text-3xl font-bold text-green-600">{treasuryData.balance.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'آخر الحركات' : 'Recent Transactions'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'رقم' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treasuryData.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-medium">{tx.id}</TableCell>
                  <TableCell>{tx.date}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'in' ? 'success' : 'destructive'}>
                      {tx.type === 'in' ? (language === 'ar' ? 'إيداع' : 'Deposit') : (language === 'ar' ? 'سحب' : 'Withdrawal')}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className={tx.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                    {tx.type === 'in' ? '+' : '-'}{tx.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Custody Module
export const CustodyModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const custodyData = [
    { id: 'C001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', amount: 10000, date: '2024-09-15', purpose: language === 'ar' ? 'مصاريف سفر' : 'Travel expenses', status: 'active' },
    { id: 'C002', employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', amount: 5000, date: '2024-09-20', purpose: language === 'ar' ? 'شراء مستلزمات' : 'Purchase supplies', status: 'settled' },
    { id: 'C003', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', amount: 15000, date: '2024-10-01', purpose: language === 'ar' ? 'عهدة مشروع' : 'Project custody', status: 'active' }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'العهدة' : 'Custody'}
        </h2>
        {canEdit && (
          <Button size="sm" className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'عهدة جديدة' : 'New Custody'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي العهد' : 'Total Custody'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">30,000 {language === 'ar' ? 'ج.م' : 'EGP'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'العهد النشطة' : 'Active Custody'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'العهد المسددة' : 'Settled Custody'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">1</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'رقم' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'الغرض' : 'Purpose'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custodyData.map((custody) => (
                <TableRow key={custody.id}>
                  <TableCell className="font-medium">{custody.id}</TableCell>
                  <TableCell>{custody.employee}</TableCell>
                  <TableCell>{custody.amount.toLocaleString()}</TableCell>
                  <TableCell>{custody.date}</TableCell>
                  <TableCell>{custody.purpose}</TableCell>
                  <TableCell>
                    <Badge variant={custody.status === 'active' ? 'warning' : 'success'}>
                      {custody.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'مسدد' : 'Settled')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Accounts Module
export const AccountsModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const accounts = [
    { code: '1010', name: language === 'ar' ? 'البنك' : 'Bank', type: language === 'ar' ? 'أصول' : 'Assets', balance: 250000 },
    { code: '1020', name: language === 'ar' ? 'الخزنة' : 'Cash', type: language === 'ar' ? 'أصول' : 'Assets', balance: 350000 },
    { code: '2010', name: language === 'ar' ? 'الموردين' : 'Suppliers', type: language === 'ar' ? 'خصوم' : 'Liabilities', balance: 120000 },
    { code: '3010', name: language === 'ar' ? 'رأس المال' : 'Capital', type: language === 'ar' ? 'حقوق ملكية' : 'Equity', balance: 500000 },
    { code: '4010', name: language === 'ar' ? 'المبيعات' : 'Sales', type: language === 'ar' ? 'إيرادات' : 'Revenue', balance: 450000 },
    { code: '5010', name: language === 'ar' ? 'الرواتب' : 'Salaries', type: language === 'ar' ? 'مصروفات' : 'Expenses', balance: 180000 }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'دليل الحسابات' : 'Chart of Accounts'}
        </h2>
        {canEdit && (
          <Button size="sm" className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'حساب جديد' : 'New Account'}</span>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'Code'}</TableHead>
                <TableHead>{language === 'ar' ? 'اسم الحساب' : 'Account Name'}</TableHead>
                <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.code}>
                  <TableCell className="font-medium">{account.code}</TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>
                    <Badge>{account.type}</Badge>
                  </TableCell>
                  <TableCell className="font-bold">{account.balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Suppliers Module
export const SuppliersModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const suppliers = [
    { id: 'S001', name: language === 'ar' ? 'شركة المواد الخام المتحدة' : 'United Raw Materials Co.', phone: '+201234567890', balance: 45000, status: 'active' },
    { id: 'S002', name: language === 'ar' ? 'مؤسسة التوريدات الذهبية' : 'Golden Supplies Est.', phone: '+201098765432', balance: 32000, status: 'active' },
    { id: 'S003', name: language === 'ar' ? 'شركة الإمدادات الحديثة' : 'Modern Supplies Co.', phone: '+201555123456', balance: 0, status: 'inactive' }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الموردين' : 'Suppliers'}
        </h2>
        {canEdit && (
          <Button size="sm" className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الموردين النشطين' : 'Active Suppliers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي المديونية' : 'Total Payables'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">77,000 {language === 'ar' ? 'ج.م' : 'EGP'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'اسم المورد' : 'Supplier Name'}</TableHead>
                <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.id}</TableCell>
                  <TableCell>{supplier.name}</TableCell>
                  <TableCell>{supplier.phone}</TableCell>
                  <TableCell className={supplier.balance > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}>
                    {supplier.balance > 0 ? supplier.balance.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.status === 'active' ? 'success' : 'secondary'}>
                      {supplier.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Financial Reports Module
export const FinancialReportsModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const [reportType, setReportType] = useState('profit-loss');
  const [period, setPeriod] = useState('monthly');

  const reportTypes = [
    { id: 'profit-loss', name: language === 'ar' ? 'قائمة الدخل' : 'Profit & Loss' },
    { id: 'balance-sheet', name: language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet' },
    { id: 'cash-flow', name: language === 'ar' ? 'قائمة التدفق النقدي' : 'Cash Flow Statement' },
    { id: 'trial-balance', name: language === 'ar' ? 'ميزان المراجعة' : 'Trial Balance' },
    { id: 'tax-report', name: language === 'ar' ? 'التقرير الضريبي' : 'Tax Report' }
  ];

  const profitLossData = {
    revenue: [
      { account: language === 'ar' ? 'المبيعات' : 'Sales', amount: 450000 },
      { account: language === 'ar' ? 'إيرادات أخرى' : 'Other Income', amount: 25000 }
    ],
    expenses: [
      { account: language === 'ar' ? 'الرواتب' : 'Salaries', amount: 180000 },
      { account: language === 'ar' ? 'الإيجار' : 'Rent', amount: 50000 },
      { account: language === 'ar' ? 'المرافق' : 'Utilities', amount: 15000 },
      { account: language === 'ar' ? 'مصاريف تشغيلية' : 'Operating Expenses', amount: 80000 }
    ]
  };

  const balanceSheetData = {
    assets: [
      { account: language === 'ar' ? 'البنك' : 'Bank', amount: 250000 },
      { account: language === 'ar' ? 'الخزنة' : 'Cash', amount: 350000 },
      { account: language === 'ar' ? 'العملاء' : 'Accounts Receivable', amount: 137000 },
      { account: language === 'ar' ? 'المخزون' : 'Inventory', amount: 180000 }
    ],
    liabilities: [
      { account: language === 'ar' ? 'الموردين' : 'Accounts Payable', amount: 77000 },
      { account: language === 'ar' ? 'قروض قصيرة الأجل' : 'Short-term Loans', amount: 100000 }
    ],
    equity: [
      { account: language === 'ar' ? 'رأس المال' : 'Capital', amount: 500000 },
      { account: language === 'ar' ? 'الأرباح المحتجزة' : 'Retained Earnings', amount: 240000 }
    ]
  };

  const totalRevenue = profitLossData.revenue.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = profitLossData.expenses.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const totalAssets = balanceSheetData.assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = balanceSheetData.liabilities.reduce((sum, item) => sum + item.amount, 0);
  const totalEquity = balanceSheetData.equity.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'نوع التقرير' : 'Report Type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الفترة' : 'Period'}</CardTitle>
          </CardHeader>
          <CardContent>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
              <option value="quarterly">{language === 'ar' ? 'ربع سنوي' : 'Quarterly'}</option>
              <option value="annual">{language === 'ar' ? 'سنوي' : 'Annual'}</option>
            </select>
          </CardContent>
        </Card>
      </div>

      {reportType === 'profit-loss' && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'قائمة الدخل' : 'Profit & Loss Statement'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</h3>
              <Table>
                <TableBody>
                  {profitLossData.revenue.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.account}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {item.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-green-50">
                    <TableCell className="font-bold">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {totalRevenue.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">{language === 'ar' ? 'المصروفات' : 'Expenses'}</h3>
              <Table>
                <TableBody>
                  {profitLossData.expenses.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.account}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        ({item.amount.toLocaleString()}) {language === 'ar' ? 'ج.م' : 'EGP'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-red-50">
                    <TableCell className="font-bold">{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ({totalExpenses.toLocaleString()}) {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="border-t-2 pt-4">
              <Table>
                <TableBody>
                  <TableRow className="bg-blue-50">
                    <TableCell className="font-bold text-lg">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</TableCell>
                    <TableCell className="text-right font-bold text-lg text-blue-600">
                      {netProfit.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'balance-sheet' && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">{language === 'ar' ? 'الأصول' : 'Assets'}</h3>
              <Table>
                <TableBody>
                  {balanceSheetData.assets.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.account}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-blue-50">
                    <TableCell className="font-bold">{language === 'ar' ? 'إجمالي الأصول' : 'Total Assets'}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      {totalAssets.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">{language === 'ar' ? 'الخصوم' : 'Liabilities'}</h3>
              <Table>
                <TableBody>
                  {balanceSheetData.liabilities.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.account}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {item.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-red-50">
                    <TableCell className="font-bold">{language === 'ar' ? 'إجمالي الخصوم' : 'Total Liabilities'}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {totalLiabilities.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">{language === 'ar' ? 'حقوق الملكية' : 'Equity'}</h3>
              <Table>
                <TableBody>
                  {balanceSheetData.equity.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.account}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {item.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-green-50">
                    <TableCell className="font-bold">{language === 'ar' ? 'إجمالي حقوق الملكية' : 'Total Equity'}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {totalEquity.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="border-t-2 pt-4">
              <Table>
                <TableBody>
                  <TableRow className="bg-gray-100">
                    <TableCell className="font-bold text-lg">{language === 'ar' ? 'الخصوم وحقوق الملكية' : 'Liabilities + Equity'}</TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {(totalLiabilities + totalEquity).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Customers Module
export const CustomersModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const customers = [
    { id: 'C001', name: language === 'ar' ? 'شركة التجارة العالمية' : 'Global Trading Co.', phone: '+201111222333', balance: 85000, status: 'active' },
    { id: 'C002', name: language === 'ar' ? 'مؤسسة الأعمال المتطورة' : 'Advanced Business Est.', phone: '+201222333444', balance: 52000, status: 'active' },
    { id: 'C003', name: language === 'ar' ? 'شركة المستقبل للتنمية' : 'Future Development Co.', phone: '+201333444555', balance: 0, status: 'active' }
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'العملاء' : 'Customers'}
        </h2>
        {canEdit && (
          <Button size="sm" className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'عميل جديد' : 'New Customer'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'العملاء النشطين' : 'Active Customers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي المستحقات' : 'Total Receivables'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">137,000 {language === 'ar' ? 'ج.م' : 'EGP'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</TableHead>
                <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.id}</TableCell>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell className={customer.balance > 0 ? 'text-green-600 font-bold' : 'text-gray-500'}>
                    {customer.balance > 0 ? customer.balance.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">
                      {language === 'ar' ? 'نشط' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
