import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Edit, Trash2, Eye, Download, Search, Filter } from 'lucide-react';
import { Badge } from './ui/badge';

// Journal Entries Component
export const JournalEntriesModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const [journalEntries, setJournalEntries] = useState([
    { id: 'JE001', date: '2024-10-01', description: language === 'ar' ? 'مشتريات مواد خام' : 'Raw materials purchase', debit: 50000, credit: 0, account: language === 'ar' ? 'المخزون' : 'Inventory' },
    { id: 'JE002', date: '2024-10-02', description: language === 'ar' ? 'مبيعات منتجات' : 'Product sales', debit: 0, credit: 75000, account: language === 'ar' ? 'المبيعات' : 'Sales' },
    { id: 'JE003', date: '2024-10-03', description: language === 'ar' ? 'دفع رواتب' : 'Salary payment', debit: 120000, credit: 0, account: language === 'ar' ? 'المصروفات' : 'Expenses' },
    { id: 'JE004', date: '2024-10-05', description: language === 'ar' ? 'إيداع نقدي' : 'Cash deposit', debit: 0, credit: 30000, account: language === 'ar' ? 'البنك' : 'Bank' }
  ]);

  const handleDeleteConfirm = () => {
    setJournalEntries(journalEntries.filter(e => e.id !== selectedEntry.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'التاريخ', 'الوصف', 'الحساب', 'مدين', 'دائن']
      : ['ID', 'Date', 'Description', 'Account', 'Debit', 'Credit'];
    
    const csvData = journalEntries.map(entry => [
      entry.id,
      entry.date,
      entry.description,
      entry.account,
      entry.debit,
      entry.credit
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `journal_entries_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'القيود اليومية' : 'Journal Entries'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'بحث' : 'Search'}</span>
          </Button>
          <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'قيد جديد' : 'New Entry'}</span>
          </Button>
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(entry); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(entry); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(entry); setShowDeleteModal(true); }}>
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

      {/* View Details Modal */}
      {showViewModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل القيد' : 'Entry Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'رقم القيد' : 'Entry #'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.id}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.date}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الوصف' : 'Description'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.description}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الحساب' : 'Account'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.account}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'مدين' : 'Debit'}</p>
                  <p className="text-lg font-bold text-green-600">{selectedEntry.debit > 0 ? selectedEntry.debit.toLocaleString() : '-'}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'دائن' : 'Credit'}</p>
                  <p className="text-lg font-bold text-red-600">{selectedEntry.credit > 0 ? selectedEntry.credit.toLocaleString() : '-'}</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف القيد ${selectedEntry.id}؟` : `Are you sure you want to delete entry ${selectedEntry.id}?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'قيد جديد' : 'New Journal Entry'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newEntry = {
                id: `JE${String(journalEntries.length + 1).padStart(3, '0')}`,
                date: formData.get('date'),
                description: formData.get('description'),
                account: formData.get('account'),
                debit: parseFloat(formData.get('debit')) || 0,
                credit: parseFloat(formData.get('credit')) || 0,
              };
              setJournalEntries([...journalEntries, newEntry]);
              setShowAddModal(false);
              setSuccessMessage(language === 'ar' ? 'تم إضافة القيد بنجاح!' : 'Entry added successfully!');
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'التاريخ' : 'Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'الحساب' : 'Account'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="account"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  >
                    <option value="">{language === 'ar' ? 'اختر الحساب' : 'Select Account'}</option>
                    <option value={language === 'ar' ? 'المخزون' : 'Inventory'}>{language === 'ar' ? 'المخزون' : 'Inventory'}</option>
                    <option value={language === 'ar' ? 'المبيعات' : 'Sales'}>{language === 'ar' ? 'المبيعات' : 'Sales'}</option>
                    <option value={language === 'ar' ? 'المصروفات' : 'Expenses'}>{language === 'ar' ? 'المصروفات' : 'Expenses'}</option>
                    <option value={language === 'ar' ? 'البنك' : 'Bank'}>{language === 'ar' ? 'البنك' : 'Bank'}</option>
                    <option value={language === 'ar' ? 'النقدية' : 'Cash'}>{language === 'ar' ? 'النقدية' : 'Cash'}</option>
                    <option value={language === 'ar' ? 'العملاء' : 'Customers'}>{language === 'ar' ? 'العملاء' : 'Customers'}</option>
                    <option value={language === 'ar' ? 'الموردين' : 'Suppliers'}>{language === 'ar' ? 'الموردين' : 'Suppliers'}</option>
                    <option value={language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}>{language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}</option>
                    <option value={language === 'ar' ? 'رأس المال' : 'Capital'}>{language === 'ar' ? 'رأس المال' : 'Capital'}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الوصف' : 'Description'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder={language === 'ar' ? 'أدخل وصف القيد...' : 'Enter entry description...'}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Debit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'مدين' : 'Debit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="debit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                {/* Credit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'دائن' : 'Credit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="credit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  {language === 'ar' 
                    ? '⚠️ ملاحظة: يجب إدخال قيمة في المدين أو الدائن (ليس كلاهما)' 
                    : '⚠️ Note: Enter value in either Debit or Credit (not both)'}
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                  {language === 'ar' ? 'حفظ القيد' : 'Save Entry'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Treasury/Cash Module
export const TreasuryModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(tx); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(tx); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(tx); setShowDeleteModal(true); }}>
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

      {/* View Details Modal */}
      {showViewModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل الحركة' : 'Transaction Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'رقم الحركة' : 'Transaction #'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.id}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.date}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'النوع' : 'Type'}</p>
                <Badge variant={selectedEntry.type === 'in' ? 'success' : 'destructive'}>
                  {selectedEntry.type === 'in' ? (language === 'ar' ? 'إيداع' : 'Deposit') : (language === 'ar' ? 'سحب' : 'Withdrawal')}
                </Badge>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الوصف' : 'Description'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedEntry.description}</p>
              </div>
              <div className={`${selectedEntry.type === 'in' ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'المبلغ' : 'Amount'}</p>
                <p className={`text-lg font-bold ${selectedEntry.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedEntry.type === 'in' ? '+' : '-'}{selectedEntry.amount.toLocaleString()}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Add New Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'قيد جديد' : 'New Journal Entry'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newEntry = {
                id: `JE${String(journalEntries.length + 1).padStart(3, '0')}`,
                date: formData.get('date'),
                description: formData.get('description'),
                account: formData.get('account'),
                debit: parseFloat(formData.get('debit')) || 0,
                credit: parseFloat(formData.get('credit')) || 0,
              };
              setJournalEntries([...journalEntries, newEntry]);
              setShowAddModal(false);
              setSuccessMessage(language === 'ar' ? 'تم إضافة القيد بنجاح!' : 'Entry added successfully!');
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'التاريخ' : 'Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'الحساب' : 'Account'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="account"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  >
                    <option value="">{language === 'ar' ? 'اختر الحساب' : 'Select Account'}</option>
                    <option value={language === 'ar' ? 'المخزون' : 'Inventory'}>{language === 'ar' ? 'المخزون' : 'Inventory'}</option>
                    <option value={language === 'ar' ? 'المبيعات' : 'Sales'}>{language === 'ar' ? 'المبيعات' : 'Sales'}</option>
                    <option value={language === 'ar' ? 'المصروفات' : 'Expenses'}>{language === 'ar' ? 'المصروفات' : 'Expenses'}</option>
                    <option value={language === 'ar' ? 'البنك' : 'Bank'}>{language === 'ar' ? 'البنك' : 'Bank'}</option>
                    <option value={language === 'ar' ? 'النقدية' : 'Cash'}>{language === 'ar' ? 'النقدية' : 'Cash'}</option>
                    <option value={language === 'ar' ? 'العملاء' : 'Customers'}>{language === 'ar' ? 'العملاء' : 'Customers'}</option>
                    <option value={language === 'ar' ? 'الموردين' : 'Suppliers'}>{language === 'ar' ? 'الموردين' : 'Suppliers'}</option>
                    <option value={language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}>{language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}</option>
                    <option value={language === 'ar' ? 'رأس المال' : 'Capital'}>{language === 'ar' ? 'رأس المال' : 'Capital'}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الوصف' : 'Description'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder={language === 'ar' ? 'أدخل وصف القيد...' : 'Enter entry description...'}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Debit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'مدين' : 'Debit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="debit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                {/* Credit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'دائن' : 'Credit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="credit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  {language === 'ar' 
                    ? '⚠️ ملاحظة: يجب إدخال قيمة في المدين أو الدائن (ليس كلاهما)' 
                    : '⚠️ Note: Enter value in either Debit or Credit (not both)'}
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                  {language === 'ar' ? 'حفظ القيد' : 'Save Entry'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Custody Module
export const CustodyModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(custody); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(custody); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(custody); setShowDeleteModal(true); }}>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(account); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(account); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(account); setShowDeleteModal(true); }}>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const suppliers = [
    { id: 'S001', name: language === 'ar' ? 'شركة المواد الخام المتحدة' : 'United Raw Materials Co.', phone: '+201234567890', balance: 45000, status: 'active' },
    { id: 'S002', name: language === 'ar' ? 'مؤسسة التوريدات الذهبية' : 'Golden Supplies Est.', phone: '+201098765432', balance: 32000, status: 'active' },
    { id: 'S003', name: language === 'ar' ? 'شركة الإمدادات الحديثة' : 'Modern Supplies Co.', phone: '+201555123456', balance: 0, status: 'inactive' }
  ];

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'اسم المورد', 'الهاتف', 'الرصيد', 'الحالة']
      : ['ID', 'Supplier Name', 'Phone', 'Balance', 'Status'];
    
    const csvData = suppliers.map(supplier => [
      supplier.id,
      supplier.name,
      supplier.phone,
      supplier.balance,
      supplier.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الموردين' : 'Suppliers'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</span>
          </Button>
        </div>
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(supplier); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(supplier); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(supplier); setShowDeleteModal(true); }}>
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

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newSupplier = {
                id: `S${String(suppliers.length + 1).padStart(3, '0')}`,
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                balance: parseFloat(formData.get('balance')) || 0,
                status: 'active'
              };
              setSuccessMessage(language === 'ar' ? 'تم إضافة المورد بنجاح!' : 'Supplier added successfully!');
              setShowAddModal(false);
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'اسم المورد' : 'Supplier Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    placeholder={language === 'ar' ? 'أدخل اسم المورد' : 'Enter supplier name'}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    placeholder="+201234567890"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder="supplier@example.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'العنوان' : 'Address'}
                </label>
                <textarea
                  name="address"
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder={language === 'ar' ? 'أدخل عنوان المورد' : 'Enter supplier address'}
                ></textarea>
              </div>

              {/* Balance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                </label>
                <input
                  type="number"
                  name="balance"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                  {language === 'ar' ? 'حفظ المورد' : 'Save Supplier'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Financial Reports Module
export const FinancialReportsModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const [financialReportTab, setFinancialReportTab] = useState('overview');
  const [financialPeriod, setFinancialPeriod] = useState('monthly');

  // بيانات مالية شاملة
  const financialData = {
    executiveSummary: {
      currentMonth: {
        revenue: 285000,
        expenses: 180000,
        netProfit: 105000,
        profitMargin: 36.8,
        revenueGrowth: 15.2,
        expenseGrowth: 8.5
      },
      previousMonth: {
        revenue: 248000,
        expenses: 166000,
        netProfit: 82000
      },
      yearToDate: {
        revenue: 2650000,
        expenses: 1950000,
        netProfit: 700000
      }
    },
    
    profitLoss: {
      revenue: {
        sales: 285000,
        services: 45000,
        other: 15000,
        total: 345000
      },
      cogs: 120000,
      grossProfit: 225000,
      operatingExpenses: {
        salaries: 85000,
        rent: 25000,
        marketing: 15000,
        utilities: 8000,
        maintenance: 7000,
        other: 20000,
        total: 160000
      },
      operatingProfit: 65000,
      nonOperating: {
        income: 5000,
        expenses: 3000,
        net: 2000
      },
      profitBeforeTax: 67000,
      tax: 10000,
      netProfit: 57000
    },

    cashFlow: {
      operating: {
        netIncome: 57000,
        depreciation: 8000,
        accountsReceivable: -15000,
        inventory: -8000,
        accountsPayable: 12000,
        total: 54000
      },
      investing: {
        equipment: -25000,
        investments: -10000,
        total: -35000
      },
      financing: {
        loans: 20000,
        dividends: -15000,
        total: 5000
      },
      netCashFlow: 24000,
      beginningCash: 120000,
      endingCash: 144000
    },

    balanceSheet: {
      assets: {
        current: {
          cash: 144000,
          accountsReceivable: 85000,
          inventory: 65000,
          prepaid: 15000,
          total: 309000
        },
        fixed: {
          equipment: 180000,
          buildings: 350000,
          depreciation: -45000,
          total: 485000
        },
        totalAssets: 794000
      },
      liabilities: {
        current: {
          accountsPayable: 45000,
          shortTermLoans: 25000,
          accrued: 18000,
          total: 88000
        },
        longTerm: {
          loans: 150000,
          total: 150000
        },
        totalLiabilities: 238000
      },
      equity: {
        capital: 400000,
        retainedEarnings: 156000,
        totalEquity: 556000
      }
    },

    kpis: {
      profitability: {
        grossMargin: 65.2,
        operatingMargin: 18.8,
        netMargin: 16.5,
        roe: 10.3,
        roa: 7.2
      },
      liquidity: {
        currentRatio: 3.51,
        quickRatio: 2.77,
        cashRatio: 1.64
      },
      efficiency: {
        assetTurnover: 0.43,
        receivablesTurnover: 4.1,
        inventoryTurnover: 5.3,
        payablesTurnover: 3.6
      }
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* التحكم في التقارير المالية */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <span>{language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}</span>
            </CardTitle>
            <div className="flex gap-2">
              <select 
                className="border rounded px-3 py-2 text-sm"
                value={financialPeriod}
                onChange={(e) => setFinancialPeriod(e.target.value)}
              >
                <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
              </select>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'تصدير' : 'Export'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* تبويبات التقارير */}
      <div className="border-b">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: language === 'ar' ? 'الملخص التنفيذي' : 'Executive Summary' },
            { id: 'profitLoss', label: language === 'ar' ? 'الربح والخسارة' : 'Profit & Loss' },
            { id: 'cashFlow', label: language === 'ar' ? 'التدفق النقدي' : 'Cash Flow' },
            { id: 'balance', label: language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet' },
            { id: 'kpis', label: language === 'ar' ? 'مؤشرات الأداء' : 'KPIs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFinancialReportTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                financialReportTab === tab.id 
                  ? 'border-[#28376B] text-[#28376B]' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* محتوى التبويبات */}
      <div>
        {/* الملخص التنفيذي */}
        {financialReportTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">{language === 'ar' ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</p>
                      <p className="text-2xl font-bold text-green-800">{financialData.executiveSummary.currentMonth.revenue.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                      <p className="text-sm text-green-600">+{financialData.executiveSummary.currentMonth.revenueGrowth}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-red-50 to-red-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700">{language === 'ar' ? 'المصروفات الشهرية' : 'Monthly Expenses'}</p>
                      <p className="text-2xl font-bold text-red-800">{financialData.executiveSummary.currentMonth.expenses.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                      <p className="text-sm text-red-600">+{financialData.executiveSummary.currentMonth.expenseGrowth}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</p>
                      <p className="text-2xl font-bold text-blue-800">{financialData.executiveSummary.currentMonth.netProfit.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                      <p className="text-sm text-blue-600">{financialData.executiveSummary.currentMonth.profitMargin}% {language === 'ar' ? 'هامش' : 'margin'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">{language === 'ar' ? 'الإيرادات السنوية' : 'YTD Revenue'}</p>
                      <p className="text-2xl font-bold text-purple-800">{financialData.executiveSummary.yearToDate.revenue.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                      <p className="text-sm text-purple-600">{language === 'ar' ? 'حتى تاريخه' : 'Year to Date'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* مقارنة الأداء */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مقارنة الأداء الشهري' : 'Monthly Performance Comparison'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'الشهر الحالي' : 'Current Month'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium">{financialData.executiveSummary.currentMonth.revenue.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-red-600">{financialData.executiveSummary.currentMonth.expenses.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">{financialData.executiveSummary.currentMonth.netProfit.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'الشهر السابق' : 'Previous Month'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium">{financialData.executiveSummary.previousMonth.revenue.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-red-600">{financialData.executiveSummary.previousMonth.expenses.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">{financialData.executiveSummary.previousMonth.netProfit.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'التغيير' : 'Change'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'الإيرادات:' : 'Revenue:'}</span>
                        <span className="font-medium text-green-600">+{financialData.executiveSummary.currentMonth.revenueGrowth}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'المصروفات:' : 'Expenses:'}</span>
                        <span className="font-medium text-orange-600">+{financialData.executiveSummary.currentMonth.expenseGrowth}%</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                        <span className="font-semibold text-green-600">+28.0%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* بيان الربح والخسارة */}
        {financialReportTab === 'profitLoss' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'بيان الربح والخسارة' : 'Profit & Loss Statement'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* الإيرادات */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-3">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-medium">{financialData.profitLoss.revenue.sales.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الخدمات:' : 'Services:'}</span>
                      <span className="font-medium">{financialData.profitLoss.revenue.services.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-700 border-t pt-2">
                      <span>{language === 'ar' ? 'إجمالي الإيرادات:' : 'Total Revenue:'}</span>
                      <span>{financialData.profitLoss.revenue.total.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>

                {/* المصروفات التشغيلية */}
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-3">{language === 'ar' ? 'المصروفات التشغيلية' : 'Operating Expenses'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الرواتب:' : 'Salaries:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.salaries.toLocaleString()}) {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'الإيجار:' : 'Rent:'}</span>
                      <span className="font-medium">({financialData.profitLoss.operatingExpenses.rent.toLocaleString()}) {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-red-700 border-t pt-2">
                      <span>{language === 'ar' ? 'إجمالي المصروفات:' : 'Total Expenses:'}</span>
                      <span>({financialData.profitLoss.operatingExpenses.total.toLocaleString()}) {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>

                {/* النتيجة النهائية */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span className="text-green-800">{language === 'ar' ? 'صافي الربح:' : 'Net Profit:'}</span>
                    <span className="text-green-800">{financialData.profitLoss.netProfit.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* بيان التدفق النقدي */}
        {financialReportTab === 'cashFlow' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'بيان التدفق النقدي' : 'Cash Flow Statement'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* التدفقات التشغيلية */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3">{language === 'ar' ? 'التدفقات من الأنشطة التشغيلية' : 'Operating Activities'}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{language === 'ar' ? 'صافي الدخل:' : 'Net Income:'}</span>
                      <span className="font-medium">{financialData.cashFlow.operating.netIncome.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span className="text-blue-700">{language === 'ar' ? 'صافي التدفق التشغيلي:' : 'Net Operating Cash Flow:'}</span>
                      <span className="text-blue-700">{financialData.cashFlow.operating.total.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>

                {/* الملخص النهائي */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span>{language === 'ar' ? 'صافي التغير في النقدية:' : 'Net Change in Cash:'}</span>
                      <span className="text-blue-600">{financialData.cashFlow.netCashFlow.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span className="text-green-800">{language === 'ar' ? 'النقدية في نهاية الفترة:' : 'Ending Cash Balance:'}</span>
                      <span className="text-green-800">{financialData.cashFlow.endingCash.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* الميزانية العمومية */}
        {financialReportTab === 'balance' && (
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'الميزانية العمومية' : 'Balance Sheet'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* الأصول */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-800">{language === 'ar' ? 'الأصول' : 'Assets'}</h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-700 mb-3">{language === 'ar' ? 'الأصول المتداولة' : 'Current Assets'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{language === 'ar' ? 'النقد:' : 'Cash:'}</span>
                        <span className="font-medium">{financialData.balanceSheet.assets.current.cash.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-blue-700">{language === 'ar' ? 'إجمالي الأصول المتداولة:' : 'Total Current Assets:'}</span>
                        <span className="text-blue-700">{financialData.balanceSheet.assets.current.total.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-200 p-4 rounded-lg">
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-blue-800">{language === 'ar' ? 'إجمالي الأصول:' : 'Total Assets:'}</span>
                      <span className="text-blue-800">{financialData.balanceSheet.assets.totalAssets.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  </div>
                </div>

                {/* الخصوم وحقوق الملكية */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-800">{language === 'ar' ? 'الخصوم وحقوق الملكية' : 'Liabilities & Equity'}</h3>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-700 mb-3">{language === 'ar' ? 'الخصوم المتداولة' : 'Current Liabilities'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-red-700">{language === 'ar' ? 'إجمالي الخصوم:' : 'Total Liabilities:'}</span>
                        <span className="text-red-700">{financialData.balanceSheet.liabilities.totalLiabilities.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-700 mb-3">{language === 'ar' ? 'حقوق الملكية' : 'Equity'}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span className="text-green-700">{language === 'ar' ? 'إجمالي حقوق الملكية:' : 'Total Equity:'}</span>
                        <span className="text-green-700">{financialData.balanceSheet.equity.totalEquity.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* مؤشرات الأداء */}
        {financialReportTab === 'kpis' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مؤشرات الربحية' : 'Profitability Ratios'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'هامش الربح الإجمالي' : 'Gross Margin'}</p>
                    <p className="text-2xl font-bold text-blue-600">{financialData.kpis.profitability.grossMargin}%</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'هامش الربح الصافي' : 'Net Margin'}</p>
                    <p className="text-2xl font-bold text-green-600">{financialData.kpis.profitability.netMargin}%</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'العائد على حقوق الملكية' : 'ROE'}</p>
                    <p className="text-2xl font-bold text-purple-600">{financialData.kpis.profitability.roe}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مؤشرات السيولة' : 'Liquidity Ratios'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'نسبة السيولة الجارية' : 'Current Ratio'}</p>
                    <p className="text-2xl font-bold text-blue-600">{financialData.kpis.liquidity.currentRatio}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'نسبة السيولة السريعة' : 'Quick Ratio'}</p>
                    <p className="text-2xl font-bold text-green-600">{financialData.kpis.liquidity.quickRatio}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">{language === 'ar' ? 'نسبة النقدية' : 'Cash Ratio'}</p>
                    <p className="text-2xl font-bold text-purple-600">{financialData.kpis.liquidity.cashRatio}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// Customers Module
export const CustomersModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const isRTL = language === 'ar';
  const canEdit = ['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', balance: 0 });
  const [editCustomer, setEditCustomer] = useState({ id: '', name: '', phone: '', email: '', address: '', balance: 0 });

  // Fetch customers from backend API
  React.useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/financial/customers`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setCustomers(data);
        } else {
          console.error('Failed to fetch customers:', response.statusText);
          setCustomers([]);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [language]);

  // Calculate statistics
  const stats = {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => (c.balance || 0) >= 0).length,
    totalBalance: customers.reduce((sum, c) => sum + (parseFloat(c.balance) || 0), 0),
    avgBalance: customers.length > 0 ? customers.reduce((sum, c) => sum + (parseFloat(c.balance) || 0), 0) / customers.length : 0
  };

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (customer.phone || '').includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && (customer.balance || 0) >= 0) ||
                         (filterStatus === 'inactive' && (customer.balance || 0) < 0);
    return matchesSearch && matchesStatus;
  });

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'اسم العميل', 'الهاتف', 'الرصيد', 'الحالة']
      : ['ID', 'Customer Name', 'Phone', 'Balance', 'Status'];
    
    const csvData = customers.map(customer => [
      customer.id,
      customer.name,
      customer.phone,
      customer.balance,
      'Active'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'العملاء' : 'Customers'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-600" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'عميل جديد' : 'New Customer'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards - Professional Design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalCustomers}</p>
                <p className="text-xs text-blue-600 mt-1">{language === 'ar' ? 'عميل' : 'customers'}</p>
              </div>
              <div className="bg-blue-200 p-3 rounded-full">
                <Users className="h-8 w-8 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">{language === 'ar' ? 'العملاء النشطين' : 'Active Customers'}</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{stats.activeCustomers}</p>
                <p className="text-xs text-green-600 mt-1">{language === 'ar' ? 'نشط' : 'active'}</p>
              </div>
              <div className="bg-green-200 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">{language === 'ar' ? 'إجمالي الرصيد' : 'Total Balance'}</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">{stats.totalBalance.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-purple-600 mt-1">{language === 'ar' ? 'الرصيد الإجمالي' : 'total'}</p>
              </div>
              <div className="bg-purple-200 p-3 rounded-full">
                <DollarSign className="h-8 w-8 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">{language === 'ar' ? 'متوسط الرصيد' : 'Average Balance'}</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">{stats.avgBalance.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-orange-600 mt-1">{language === 'ar' ? 'للعميل' : 'per customer'}</p>
              </div>
              <div className="bg-orange-200 p-3 rounded-full">
                <TrendingUp className="h-8 w-8 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث عن عميل بالاسم أو الهاتف...' : 'Search by name or phone...'}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">{language === 'ar' ? 'جميع العملاء' : 'All Customers'}</option>
                <option value="active">{language === 'ar' ? 'العملاء النشطين' : 'Active Customers'}</option>
                <option value="inactive">{language === 'ar' ? 'العملاء غير النشطين' : 'Inactive Customers'}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">{language === 'ar' ? 'لا يوجد عملاء' : 'No customers found'}</p>
              {canEdit && (
                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                  {language === 'ar' ? 'إضافة عميل جديد' : 'Add New Customer'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-bold">{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, index) => (
                  <TableRow key={customer.id || index} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">{customer.id || `C${index + 1}`}</TableCell>
                    <TableCell className="font-semibold">{customer.name || 'N/A'}</TableCell>
                    <TableCell>{customer.phone || 'N/A'}</TableCell>
                    <TableCell>{customer.email || 'N/A'}</TableCell>
                    <TableCell className={`font-semibold ${(customer.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(customer.balance || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={(customer.balance || 0) >= 0 ? 'success' : 'destructive'}>
                        {(customer.balance || 0) >= 0 ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { 
                            setSelectedEntry(customer); 
                            setShowViewModal(true); 
                          }}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setEditCustomer(customer); 
                                setShowEditModal(true); 
                              }}
                            >
                              <Edit className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setSelectedEntry(customer); 
                                setShowDeleteModal(true); 
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي المستحقات' : 'Total Receivables'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {customers.reduce((sum, c) => sum + c.balance, 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">{language === 'ar' ? 'لا يوجد عملاء حالياً' : 'No customers yet'}</p>
            </div>
          ) : (
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(customer); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(customer); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(customer); setShowDeleteModal(true); }}>
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
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'عميل جديد' : 'New Customer'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newCustomer = {
                id: `C${String(customers.length + 1).padStart(3, '0')}`,
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                balance: parseFloat(formData.get('balance')) || 0,
                status: 'active'
              };
              setCustomers([...customers, newCustomer]);
              setShowAddModal(false);
              setSuccessMessage(language === 'ar' ? 'تم إضافة العميل بنجاح!' : 'Customer added successfully!');
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'اسم العميل' : 'Customer Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    placeholder={language === 'ar' ? 'أدخل اسم العميل' : 'Enter customer name'}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    placeholder="+201234567890"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder="customer@example.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'العنوان' : 'Address'}
                </label>
                <textarea
                  name="address"
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder={language === 'ar' ? 'أدخل عنوان العميل' : 'Enter customer address'}
                ></textarea>
              </div>

              {/* Balance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                </label>
                <input
                  type="number"
                  name="balance"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                  {language === 'ar' ? 'حفظ العميل' : 'Save Customer'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Bank Module
export const BankModule = ({ language, userRole }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي' || userRole === 'Chief Accountant' || userRole === 'رئيس الحسابات';

  const initialTransactions = [
    { id: 'BT001', date: '2024-10-01', description: language === 'ar' ? 'إيداع شيك' : 'Check Deposit', type: 'deposit', amount: 50000, balance: 150000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
    { id: 'BT002', date: '2024-10-03', description: language === 'ar' ? 'سحب نقدي' : 'Cash Withdrawal', type: 'withdrawal', amount: 20000, balance: 130000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
    { id: 'BT003', date: '2024-10-05', description: language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer', type: 'transfer', amount: 30000, balance: 100000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
    { id: 'BT004', date: '2024-10-08', description: language === 'ar' ? 'إيداع راتب' : 'Salary Deposit', type: 'deposit', amount: 75000, balance: 175000, bankName: language === 'ar' ? 'بنك الراجحي' : 'Al Rajhi Bank' }
  ];

  const [transactions, setTransactions] = useState(initialTransactions);

  // Update transactions when language changes
  React.useEffect(() => {
    setTransactions([
      { id: 'BT001', date: '2024-10-01', description: language === 'ar' ? 'إيداع شيك' : 'Check Deposit', type: 'deposit', amount: 50000, balance: 150000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
      { id: 'BT002', date: '2024-10-03', description: language === 'ar' ? 'سحب نقدي' : 'Cash Withdrawal', type: 'withdrawal', amount: 20000, balance: 130000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
      { id: 'BT003', date: '2024-10-05', description: language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer', type: 'transfer', amount: 30000, balance: 100000, bankName: language === 'ar' ? 'البنك الأهلي' : 'National Bank' },
      { id: 'BT004', date: '2024-10-08', description: language === 'ar' ? 'إيداع راتب' : 'Salary Deposit', type: 'deposit', amount: 75000, balance: 175000, bankName: language === 'ar' ? 'بنك الراجحي' : 'Al Rajhi Bank' }
    ]);
  }, [language]);

  const handleDeleteConfirm = () => {
    setTransactions(transactions.filter(t => t.id !== selectedTransaction.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal' || t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-[#28376B]">
          {language === 'ar' ? 'البنك' : 'Bank'}
        </h2>
        {canEdit && (
          <Button onClick={() => setShowAddModal(true)} className="bg-[#28376B]">
            <Plus className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'إضافة معاملة' : 'Add Transaction'}</span>
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي الإيداعات' : 'Total Deposits'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{totalDeposits.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي السحوبات' : 'Total Withdrawals'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{totalWithdrawals.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#28376B]">{transactions[transactions.length - 1]?.balance.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                <TableHead>{language === 'ar' ? 'البنك' : 'Bank'}</TableHead>
                <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead>{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.id}</TableCell>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{transaction.bankName}</TableCell>
                  <TableCell>
                    <Badge variant={transaction.type === 'deposit' ? 'success' : 'destructive'}>
                      {transaction.type === 'deposit' 
                        ? (language === 'ar' ? 'إيداع' : 'Deposit') 
                        : transaction.type === 'withdrawal'
                        ? (language === 'ar' ? 'سحب' : 'Withdrawal')
                        : (language === 'ar' ? 'تحويل' : 'Transfer')}
                    </Badge>
                  </TableCell>
                  <TableCell className={transaction.type === 'deposit' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {transaction.type === 'deposit' ? '+' : '-'}{transaction.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-bold">{transaction.balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedTransaction(transaction); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedTransaction(transaction); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedTransaction(transaction); setShowDeleteModal(true); }}>
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

      {/* View Details Modal */}
      {showViewModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل المعاملة' : 'Transaction Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'رقم المعاملة' : 'Transaction #'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedTransaction.id}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedTransaction.date}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'البنك' : 'Bank'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedTransaction.bankName}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الوصف' : 'Description'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedTransaction.description}</p>
              </div>
              <div className={`${selectedTransaction.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'المبلغ' : 'Amount'}</p>
                <p className={`text-2xl font-bold ${selectedTransaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedTransaction.type === 'deposit' ? '+' : '-'}{selectedTransaction.amount.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الرصيد بعد المعاملة' : 'Balance After'}</p>
                <p className="text-2xl font-bold text-purple-600">{selectedTransaction.balance.toLocaleString()}</p>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف المعاملة ${selectedTransaction.id}؟` : `Are you sure you want to delete transaction ${selectedTransaction.id}?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'قيد جديد' : 'New Journal Entry'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newEntry = {
                id: `JE${String(journalEntries.length + 1).padStart(3, '0')}`,
                date: formData.get('date'),
                description: formData.get('description'),
                account: formData.get('account'),
                debit: parseFloat(formData.get('debit')) || 0,
                credit: parseFloat(formData.get('credit')) || 0,
              };
              setJournalEntries([...journalEntries, newEntry]);
              setShowAddModal(false);
              setSuccessMessage(language === 'ar' ? 'تم إضافة القيد بنجاح!' : 'Entry added successfully!');
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'التاريخ' : 'Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'الحساب' : 'Account'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="account"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  >
                    <option value="">{language === 'ar' ? 'اختر الحساب' : 'Select Account'}</option>
                    <option value={language === 'ar' ? 'المخزون' : 'Inventory'}>{language === 'ar' ? 'المخزون' : 'Inventory'}</option>
                    <option value={language === 'ar' ? 'المبيعات' : 'Sales'}>{language === 'ar' ? 'المبيعات' : 'Sales'}</option>
                    <option value={language === 'ar' ? 'المصروفات' : 'Expenses'}>{language === 'ar' ? 'المصروفات' : 'Expenses'}</option>
                    <option value={language === 'ar' ? 'البنك' : 'Bank'}>{language === 'ar' ? 'البنك' : 'Bank'}</option>
                    <option value={language === 'ar' ? 'النقدية' : 'Cash'}>{language === 'ar' ? 'النقدية' : 'Cash'}</option>
                    <option value={language === 'ar' ? 'العملاء' : 'Customers'}>{language === 'ar' ? 'العملاء' : 'Customers'}</option>
                    <option value={language === 'ar' ? 'الموردين' : 'Suppliers'}>{language === 'ar' ? 'الموردين' : 'Suppliers'}</option>
                    <option value={language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}>{language === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets'}</option>
                    <option value={language === 'ar' ? 'رأس المال' : 'Capital'}>{language === 'ar' ? 'رأس المال' : 'Capital'}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'الوصف' : 'Description'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  placeholder={language === 'ar' ? 'أدخل وصف القيد...' : 'Enter entry description...'}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Debit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'مدين' : 'Debit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="debit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                {/* Credit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'دائن' : 'Credit'} <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                  </label>
                  <input
                    type="number"
                    name="credit"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  {language === 'ar' 
                    ? '⚠️ ملاحظة: يجب إدخال قيمة في المدين أو الدائن (ليس كلاهما)' 
                    : '⚠️ Note: Enter value in either Debit or Credit (not both)'}
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                  {language === 'ar' ? 'حفظ القيد' : 'Save Entry'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};