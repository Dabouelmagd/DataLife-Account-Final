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
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

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
        <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</span>
        </Button>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isRTL = language === 'ar';
  const canEdit = userRole === 'Financial Manager' || userRole === 'المدير المالي';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'العملاء' : 'Customers'}
        </h2>
        <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'عميل جديد' : 'New Customer'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'العملاء النشطين' : 'Active Customers'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
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