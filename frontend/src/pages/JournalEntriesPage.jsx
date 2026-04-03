import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Plus, Search, Filter, Calendar, FileText, Check, X, 
  RotateCcw, ChevronDown, ChevronUp, Loader2, AlertCircle
} from 'lucide-react';
import { QuickEntryButtons } from '../components/QuickEntryButtons';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const JournalEntriesPage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: ''
  });

  // Form state for new entry
  const [newEntry, setNewEntry] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' }
    ]
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const translations = {
    ar: {
      title: 'القيود اليومية',
      subtitle: 'إدارة وتسجيل القيود المحاسبية',
      newEntry: 'قيد جديد',
      search: 'بحث...',
      filter: 'تصفية',
      startDate: 'من تاريخ',
      endDate: 'إلى تاريخ',
      status: 'الحالة',
      all: 'الكل',
      draft: 'مسودة',
      posted: 'مرحّل',
      reversed: 'معكوس',
      entryNumber: 'رقم القيد',
      date: 'التاريخ',
      reference: 'المرجع',
      description: 'البيان',
      totalDebit: 'إجمالي المدين',
      totalCredit: 'إجمالي الدائن',
      actions: 'الإجراءات',
      post: 'ترحيل',
      reverse: 'عكس',
      view: 'عرض',
      noEntries: 'لا توجد قيود',
      createEntry: 'إنشاء قيد يومي',
      account: 'الحساب',
      debit: 'مدين',
      credit: 'دائن',
      addLine: 'إضافة سطر',
      removeLine: 'حذف',
      save: 'حفظ',
      cancel: 'إلغاء',
      total: 'الإجمالي',
      balanced: 'متوازن',
      notBalanced: 'غير متوازن',
      difference: 'الفرق',
      selectAccount: 'اختر الحساب',
      success: 'تم بنجاح',
      error: 'خطأ',
      entryCreated: 'تم إنشاء القيد بنجاح',
      entryPosted: 'تم ترحيل القيد بنجاح',
      entryReversed: 'تم عكس القيد بنجاح',
      confirmPost: 'هل تريد ترحيل هذا القيد؟',
      confirmReverse: 'هل تريد عكس هذا القيد؟',
      lines: 'سطور القيد'
    },
    en: {
      title: 'Journal Entries',
      subtitle: 'Manage and record accounting entries',
      newEntry: 'New Entry',
      search: 'Search...',
      filter: 'Filter',
      startDate: 'From Date',
      endDate: 'To Date',
      status: 'Status',
      all: 'All',
      draft: 'Draft',
      posted: 'Posted',
      reversed: 'Reversed',
      entryNumber: 'Entry #',
      date: 'Date',
      reference: 'Reference',
      description: 'Description',
      totalDebit: 'Total Debit',
      totalCredit: 'Total Credit',
      actions: 'Actions',
      post: 'Post',
      reverse: 'Reverse',
      view: 'View',
      noEntries: 'No entries found',
      createEntry: 'Create Journal Entry',
      account: 'Account',
      debit: 'Debit',
      credit: 'Credit',
      addLine: 'Add Line',
      removeLine: 'Remove',
      save: 'Save',
      cancel: 'Cancel',
      total: 'Total',
      balanced: 'Balanced',
      notBalanced: 'Not Balanced',
      difference: 'Difference',
      selectAccount: 'Select Account',
      success: 'Success',
      error: 'Error',
      entryCreated: 'Entry created successfully',
      entryPosted: 'Entry posted successfully',
      entryReversed: 'Entry reversed successfully',
      confirmPost: 'Do you want to post this entry?',
      confirmReverse: 'Do you want to reverse this entry?',
      lines: 'Entry Lines'
    }
  };

  const t = translations[language] || translations.en;

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, [filters]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.status) params.append('status', filters.status);

      const response = await axios.get(
        `${API_URL}/api/accounting/journal-entries?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/accounting/accounts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleCreateEntry = async () => {
    setFormError('');
    
    // Validate
    const totalDebit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setFormError(language === 'ar' ? 'القيد غير متوازن' : 'Entry is not balanced');
      return;
    }

    if (newEntry.lines.some(l => !l.account_id)) {
      setFormError(language === 'ar' ? 'يجب اختيار حساب لكل سطر' : 'Please select an account for each line');
      return;
    }

    if (!newEntry.description.trim()) {
      setFormError(language === 'ar' ? 'يجب إدخال البيان' : 'Description is required');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/accounting/journal-entries`,
        newEntry,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowCreateModal(false);
      setNewEntry({
        entry_date: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        lines: [
          { account_id: '', debit: 0, credit: 0, description: '' },
          { account_id: '', debit: 0, credit: 0, description: '' }
        ]
      });
      fetchEntries();
    } catch (error) {
      setFormError(error.response?.data?.detail || 'Error creating entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostEntry = async (entryId) => {
    if (!window.confirm(t.confirmPost)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/accounting/journal-entries/${entryId}/post`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchEntries();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error posting entry');
    }
  };

  const handleReverseEntry = async (entryId) => {
    if (!window.confirm(t.confirmReverse)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/accounting/journal-entries/${entryId}/reverse`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchEntries();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error reversing entry');
    }
  };

  const addLine = () => {
    setNewEntry({
      ...newEntry,
      lines: [...newEntry.lines, { account_id: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeLine = (index) => {
    if (newEntry.lines.length <= 2) return;
    setNewEntry({
      ...newEntry,
      lines: newEntry.lines.filter((_, i) => i !== index)
    });
  };

  const updateLine = (index, field, value) => {
    const updatedLines = [...newEntry.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setNewEntry({ ...newEntry, lines: updatedLines });
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      posted: 'bg-green-100 text-green-800',
      reversed: 'bg-red-100 text-red-800'
    };
    const labels = {
      draft: t.draft,
      posted: t.posted,
      reversed: t.reversed
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const totalDebit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = newEntry.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#28376B]">{t.title}</h1>
            <p className="text-gray-600 mt-1">{t.subtitle}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-[#28376B] text-white px-4 py-2 rounded-lg hover:bg-[#1e2a52] transition-colors"
            data-testid="new-entry-btn"
          >
            <Plus className="w-5 h-5" />
            {t.newEntry}
          </button>
        </div>

        {/* Quick Entry Buttons */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {language === 'ar' ? 'قيود سريعة' : 'Quick Entries'}
          </h3>
          <QuickEntryButtons onEntryCreated={fetchEntries} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder={t.startDate}
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder={t.endDate}
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t.all}</option>
              <option value="draft">{t.draft}</option>
              <option value="posted">{t.posted}</option>
              <option value="reversed">{t.reversed}</option>
            </select>
          </div>
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#28376B]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>{t.noEntries}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.entryNumber}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.date}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.reference}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.description}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.totalDebit}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.totalCredit}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.status}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr 
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3 font-medium">#{entry.entry_number}</td>
                      <td className="px-4 py-3">{entry.entry_date}</td>
                      <td className="px-4 py-3">{entry.reference || '-'}</td>
                      <td className="px-4 py-3">{entry.description}</td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {entry.total_debit?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {entry.total_credit?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(entry.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {entry.status === 'draft' && (
                            <button
                              onClick={() => handlePostEntry(entry.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title={t.post}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {entry.status === 'posted' && (
                            <button
                              onClick={() => handleReverseEntry(entry.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title={t.reverse}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-1 text-gray-400">
                            {expandedEntry === entry.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedEntry === entry.id && (
                      <tr>
                        <td colSpan="8" className="px-4 py-4 bg-gray-50">
                          <div className="text-sm font-medium mb-2">{t.lines}:</div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-start py-1">{t.account}</th>
                                <th className="text-start py-1">{t.description}</th>
                                <th className="text-start py-1">{t.debit}</th>
                                <th className="text-start py-1">{t.credit}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines?.map((line, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="py-2">{line.account_code} - {line.account_name}</td>
                                  <td className="py-2">{line.description || '-'}</td>
                                  <td className="py-2 text-green-600">{line.debit > 0 ? line.debit.toLocaleString() : '-'}</td>
                                  <td className="py-2 text-red-600">{line.credit > 0 ? line.credit.toLocaleString() : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Entry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-[#28376B]">{t.createEntry}</h2>
            </div>
            
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.date}</label>
                  <input
                    type="date"
                    value={newEntry.entry_date}
                    onChange={(e) => setNewEntry({ ...newEntry, entry_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.reference}</label>
                  <input
                    type="text"
                    value={newEntry.reference}
                    onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder={language === 'ar' ? 'رقم الفاتورة / الإيصال' : 'Invoice / Receipt #'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
                  <input
                    type="text"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder={language === 'ar' ? 'وصف القيد' : 'Entry description'}
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-start text-sm font-medium">{t.account}</th>
                      <th className="px-3 py-2 text-start text-sm font-medium">{t.description}</th>
                      <th className="px-3 py-2 text-start text-sm font-medium w-32">{t.debit}</th>
                      <th className="px-3 py-2 text-start text-sm font-medium w-32">{t.credit}</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {newEntry.lines.map((line, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">
                          <select
                            value={line.account_id}
                            onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm"
                          >
                            <option value="">{t.selectAccount}</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.account_code} - {acc.account_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.debit || ''}
                            onChange={(e) => {
                              updateLine(index, 'debit', parseFloat(e.target.value) || 0);
                              if (parseFloat(e.target.value) > 0) {
                                updateLine(index, 'credit', 0);
                              }
                            }}
                            className="w-full border rounded px-2 py-1 text-sm text-green-600"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.credit || ''}
                            onChange={(e) => {
                              updateLine(index, 'credit', parseFloat(e.target.value) || 0);
                              if (parseFloat(e.target.value) > 0) {
                                updateLine(index, 'debit', 0);
                              }
                            }}
                            className="w-full border rounded px-2 py-1 text-sm text-red-600"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {newEntry.lines.length > 2 && (
                            <button
                              onClick={() => removeLine(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan="2" className="px-3 py-2">
                        <button
                          onClick={addLine}
                          className="text-[#28376B] text-sm font-medium flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          {t.addLine}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-bold text-green-600">{totalDebit.toLocaleString()}</td>
                      <td className="px-3 py-2 font-bold text-red-600">{totalCredit.toLocaleString()}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="px-3 py-2 text-end font-medium">{t.difference}:</td>
                      <td colSpan="2" className={`px-3 py-2 font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        {isBalanced ? t.balanced : (totalDebit - totalCredit).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleCreateEntry}
                disabled={submitting || !isBalanced}
                className="px-4 py-2 bg-[#28376B] text-white rounded-lg hover:bg-[#1e2a52] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalEntriesPage;
