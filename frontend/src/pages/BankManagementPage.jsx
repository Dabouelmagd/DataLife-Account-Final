import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Building2, Plus, Edit, Trash2, Eye, Download, RefreshCw, Search,
  ArrowUpCircle, ArrowDownCircle, FileText, CreditCard, Loader2, X,
  TrendingUp, TrendingDown, Wallet, CheckCircle, AlertCircle, Calendar,
  BookOpen, Link2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const BankManagementPage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('accounts');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [counterAccounts, setCounterAccounts] = useState([]);
  const [recommendedAccounts, setRecommendedAccounts] = useState([]);
  
  // Modals
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showViewAccountModal, setShowViewAccountModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null);
  
  // Form states
  const [newAccount, setNewAccount] = useState({
    bank_name: '',
    bank_name_en: '',
    account_number: '',
    iban: '',
    swift_code: '',
    branch_name: '',
    currency: 'EGP',
    opening_balance: 0,
    account_type: 'current'
  });
  
  const [newTransaction, setNewTransaction] = useState({
    bank_account_id: '',
    transaction_type: 'deposit',
    amount: 0,
    description: '',
    reference: '',
    check_number: '',
    check_date: '',
    beneficiary: '',
    counter_account_code: '',
    auto_create_journal: true
  });

  // Fetch bank accounts
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        setSummary(data.summary || {});
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch transactions
  const fetchTransactions = async (accountId = null) => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/bank-transactions`;
      if (accountId) url += `?bank_account_id=${accountId}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchCounterAccounts();
  }, []);

  // Fetch counter accounts for journal entries
  const fetchCounterAccounts = async (transactionType = null) => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/bank-counter-accounts`;
      if (transactionType) url += `?transaction_type=${transactionType}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCounterAccounts(data.accounts || []);
        if (data.recommended_for_type) {
          setRecommendedAccounts(data.recommended_for_type.accounts || []);
        }
      }
    } catch (error) {
      console.error('Error fetching counter accounts:', error);
    }
  };

  // Fetch journal entry for transaction
  const fetchJournalEntry = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-transactions/${transactionId}/journal-entry`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.has_journal_entry) {
          setSelectedJournalEntry(data.journal_entry);
          setShowJournalModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching journal entry:', error);
    }
  };

  // Create account
  const handleCreateAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newAccount)
      });
      
      if (response.ok) {
        setShowAddAccountModal(false);
        setNewAccount({
          bank_name: '', bank_name_en: '', account_number: '', iban: '',
          swift_code: '', branch_name: '', currency: 'EGP', opening_balance: 0, account_type: 'current'
        });
        fetchAccounts();
      }
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  // Create transaction
  const handleCreateTransaction = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTransaction)
      });
      
      if (response.ok) {
        const result = await response.json();
        setShowAddTransactionModal(false);
        setNewTransaction({
          bank_account_id: '', transaction_type: 'deposit', amount: 0,
          description: '', reference: '', check_number: '', check_date: '', beneficiary: '',
          counter_account_code: '', auto_create_journal: true
        });
        fetchAccounts();
        fetchTransactions(selectedAccount?.id);
        
        // Show success message with journal entry info
        if (result.journal_entry_number) {
          alert(language === 'ar' 
            ? `تم إنشاء الحركة بنجاح مع القيد المحاسبي رقم ${result.journal_entry_number}` 
            : `Transaction created successfully with Journal Entry #${result.journal_entry_number}`);
        }
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-accounts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        setDeleteTarget(null);
        fetchAccounts();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  // Get transaction type label
  const getTransactionTypeLabel = (type) => {
    const labels = {
      deposit: language === 'ar' ? 'إيداع' : 'Deposit',
      withdrawal: language === 'ar' ? 'سحب' : 'Withdrawal',
      transfer_in: language === 'ar' ? 'تحويل وارد' : 'Transfer In',
      transfer_out: language === 'ar' ? 'تحويل صادر' : 'Transfer Out',
      check_deposit: language === 'ar' ? 'إيداع شيك' : 'Check Deposit',
      check_issued: language === 'ar' ? 'شيك صادر' : 'Check Issued'
    };
    return labels[type] || type;
  };

  // Get transaction type color
  const getTransactionTypeColor = (type) => {
    if (['deposit', 'transfer_in', 'check_deposit'].includes(type)) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (transactionTypeFilter === 'all') return true;
    if (transactionTypeFilter === 'deposits') return ['deposit', 'transfer_in', 'check_deposit'].includes(t.transaction_type);
    if (transactionTypeFilter === 'withdrawals') return ['withdrawal', 'transfer_out', 'check_issued'].includes(t.transaction_type);
    if (transactionTypeFilter === 'checks') return ['check_deposit', 'check_issued'].includes(t.transaction_type);
    return true;
  });

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'إدارة البنوك' : 'Bank Management'}</h1>
              <p className="text-blue-200 text-sm">{language === 'ar' ? 'إدارة الحسابات البنكية والحركات المالية' : 'Manage bank accounts and transactions'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchAccounts(); fetchTransactions(); }} className="bg-white/10 border-white/20 hover:bg-white/20 text-white">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setShowAddAccountModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'حساب جديد' : 'New Account'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 dark:bg-slate-800/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'عدد الحسابات' : 'Total Accounts'}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{accounts.length}</h3>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 dark:bg-slate-800/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إجمالي الأرصدة' : 'Total Balance'}</p>
                <h3 className="text-2xl font-bold text-emerald-600">{(summary.total_balance || 0).toLocaleString()}</h3>
                <p className="text-xs text-gray-400">{language === 'ar' ? 'ج.م' : 'EGP'}</p>
              </div>
              <Wallet className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 dark:bg-slate-800/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إجمالي الإيداعات' : 'Total Deposits'}</p>
                <h3 className="text-2xl font-bold text-green-600">{(summary.total_deposits || 0).toLocaleString()}</h3>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 dark:bg-slate-800/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إجمالي المسحوبات' : 'Total Withdrawals'}</p>
                <h3 className="text-2xl font-bold text-red-600">{(summary.total_withdrawals || 0).toLocaleString()}</h3>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === 'accounts'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          <Building2 className="w-4 h-4 inline-block mr-2" />
          {language === 'ar' ? 'الحسابات البنكية' : 'Bank Accounts'}
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          <FileText className="w-4 h-4 inline-block mr-2" />
          {language === 'ar' ? 'الحركات البنكية' : 'Transactions'}
        </button>
      </div>

      {/* Bank Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {language === 'ar' ? 'لا توجد حسابات بنكية' : 'No bank accounts found'}
            </div>
          ) : (
            accounts.map((account) => (
              <Card key={account.id} className="dark:bg-slate-800/50 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { setSelectedAccount(account); setShowViewAccountModal(true); }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{language === 'ar' ? account.bank_name : (account.bank_name_en || account.bank_name)}</CardTitle>
                        <p className="text-sm text-gray-500">{account.account_number}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {account.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</span>
                      <span className="text-xl font-bold text-emerald-600">{(account.current_balance || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <ArrowUpCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600">{(account.total_deposits || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-600">{(account.total_withdrawals || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t dark:border-slate-700 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelectedAccount(account); setNewTransaction({ ...newTransaction, bank_account_id: account.id }); setShowAddTransactionModal(true); }}>
                        <Plus className="w-3 h-3 mr-1" />
                        {language === 'ar' ? 'حركة' : 'Transaction'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDeleteTarget(account); setShowDeleteModal(true); }}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <Card className="dark:bg-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{language === 'ar' ? 'الحركات البنكية' : 'Bank Transactions'}</CardTitle>
            <div className="flex gap-2">
              <select
                value={transactionTypeFilter}
                onChange={(e) => setTransactionTypeFilter(e.target.value)}
                className="px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded-lg text-sm"
              >
                <option value="all">{language === 'ar' ? 'كل الحركات' : 'All Transactions'}</option>
                <option value="deposits">{language === 'ar' ? 'الإيداعات' : 'Deposits'}</option>
                <option value="withdrawals">{language === 'ar' ? 'المسحوبات' : 'Withdrawals'}</option>
                <option value="checks">{language === 'ar' ? 'الشيكات' : 'Checks'}</option>
              </select>
              <Button size="sm" onClick={() => setShowAddTransactionModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {language === 'ar' ? 'حركة جديدة' : 'New Transaction'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                  <TableHead className="font-bold">{language === 'ar' ? 'رقم الحركة' : 'Transaction #'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'البنك' : 'Bank'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                  <TableHead className="font-bold text-center">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead className="font-bold text-center">{language === 'ar' ? 'القيد المحاسبي' : 'Journal Entry'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {language === 'ar' ? 'لا توجد حركات' : 'No transactions found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((txn) => (
                    <TableRow key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <TableCell className="font-mono text-sm text-blue-600">{txn.transaction_number}</TableCell>
                      <TableCell>{txn.transaction_date}</TableCell>
                      <TableCell>{txn.bank_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(txn.transaction_type)}`}>
                          {getTransactionTypeLabel(txn.transaction_type)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{txn.description}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${['deposit', 'transfer_in', 'check_deposit'].includes(txn.transaction_type) ? 'text-green-600' : 'text-red-600'}`}>
                          {['deposit', 'transfer_in', 'check_deposit'].includes(txn.transaction_type) ? '+' : '-'}
                          {txn.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {txn.journal_entry_number ? (
                          <button
                            onClick={() => fetchJournalEntry(txn.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs hover:bg-purple-200 transition-colors"
                          >
                            <BookOpen className="w-3 h-3" />
                            #{txn.journal_entry_number}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">{language === 'ar' ? 'لا يوجد' : 'None'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddAccountModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-white">{language === 'ar' ? 'إضافة حساب بنكي' : 'Add Bank Account'}</h2>
              <button onClick={() => setShowAddAccountModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'اسم البنك (عربي)' : 'Bank Name (Arabic)'}</label>
                  <input
                    type="text"
                    value={newAccount.bank_name}
                    onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    placeholder={language === 'ar' ? 'البنك الأهلي المصري' : 'National Bank of Egypt'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'اسم البنك (إنجليزي)' : 'Bank Name (English)'}</label>
                  <input
                    type="text"
                    value={newAccount.bank_name_en}
                    onChange={(e) => setNewAccount({ ...newAccount, bank_name_en: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'رقم الحساب' : 'Account Number'}</label>
                  <input
                    type="text"
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'اسم الفرع' : 'Branch Name'}</label>
                  <input
                    type="text"
                    value={newAccount.branch_name}
                    onChange={(e) => setNewAccount({ ...newAccount, branch_name: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                  <input
                    type="number"
                    value={newAccount.opening_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'نوع الحساب' : 'Account Type'}</label>
                  <select
                    value={newAccount.account_type}
                    onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  >
                    <option value="current">{language === 'ar' ? 'جاري' : 'Current'}</option>
                    <option value="savings">{language === 'ar' ? 'توفير' : 'Savings'}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddAccountModal(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleCreateAccount} className="bg-emerald-600 hover:bg-emerald-700">{language === 'ar' ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTransactionModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-white">{language === 'ar' ? 'إضافة حركة بنكية' : 'Add Transaction'}</h2>
              <button onClick={() => setShowAddTransactionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الحساب البنكي' : 'Bank Account'}</label>
                <select
                  value={newTransaction.bank_account_id}
                  onChange={(e) => setNewTransaction({ ...newTransaction, bank_account_id: e.target.value })}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                >
                  <option value="">{language === 'ar' ? '-- اختر الحساب --' : '-- Select Account --'}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {language === 'ar' ? acc.bank_name : (acc.bank_name_en || acc.bank_name)} - {acc.account_number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'نوع الحركة' : 'Transaction Type'}</label>
                  <select
                    value={newTransaction.transaction_type}
                    onChange={(e) => setNewTransaction({ ...newTransaction, transaction_type: e.target.value })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  >
                    <option value="deposit">{language === 'ar' ? 'إيداع' : 'Deposit'}</option>
                    <option value="withdrawal">{language === 'ar' ? 'سحب' : 'Withdrawal'}</option>
                    <option value="check_deposit">{language === 'ar' ? 'إيداع شيك' : 'Check Deposit'}</option>
                    <option value="check_issued">{language === 'ar' ? 'شيك صادر' : 'Check Issued'}</option>
                    <option value="transfer_in">{language === 'ar' ? 'تحويل وارد' : 'Transfer In'}</option>
                    <option value="transfer_out">{language === 'ar' ? 'تحويل صادر' : 'Transfer Out'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'المبلغ' : 'Amount'}</label>
                  <input
                    type="number"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                />
              </div>
              {['check_deposit', 'check_issued'].includes(newTransaction.transaction_type) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'رقم الشيك' : 'Check Number'}</label>
                    <input
                      type="text"
                      value={newTransaction.check_number}
                      onChange={(e) => setNewTransaction({ ...newTransaction, check_number: e.target.value })}
                      className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{language === 'ar' ? 'تاريخ الشيك' : 'Check Date'}</label>
                    <input
                      type="date"
                      value={newTransaction.check_date}
                      onChange={(e) => setNewTransaction({ ...newTransaction, check_date: e.target.value })}
                      className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                    />
                  </div>
                </div>
              )}
              
              {/* Counter Account Selection for Journal Entry */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <h4 className="font-medium text-purple-800 dark:text-purple-300">{language === 'ar' ? 'القيد المحاسبي' : 'Journal Entry'}</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto_journal"
                      checked={newTransaction.auto_create_journal}
                      onChange={(e) => setNewTransaction({ ...newTransaction, auto_create_journal: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="auto_journal" className="text-sm text-gray-700 dark:text-gray-300">
                      {language === 'ar' ? 'إنشاء قيد محاسبي تلقائياً' : 'Auto-create journal entry'}
                    </label>
                  </div>
                  
                  {newTransaction.auto_create_journal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {language === 'ar' ? 'الحساب المقابل' : 'Counter Account'}
                      </label>
                      <select
                        value={newTransaction.counter_account_code}
                        onChange={(e) => setNewTransaction({ ...newTransaction, counter_account_code: e.target.value })}
                        className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                      >
                        <option value="">{language === 'ar' ? '-- اختيار تلقائي --' : '-- Auto Select --'}</option>
                        <optgroup label={language === 'ar' ? 'الحسابات الموصى بها' : 'Recommended Accounts'}>
                          {newTransaction.transaction_type === 'deposit' && (
                            <>
                              <option value="161">161 - {language === 'ar' ? 'النقدية بالصندوق' : 'Cash on Hand'}</option>
                              <option value="131">131 - {language === 'ar' ? 'العملاء' : 'Accounts Receivable'}</option>
                              <option value="411">411 - {language === 'ar' ? 'إيراد مبيعات' : 'Sales Revenue'}</option>
                            </>
                          )}
                          {newTransaction.transaction_type === 'withdrawal' && (
                            <>
                              <option value="161">161 - {language === 'ar' ? 'النقدية بالصندوق' : 'Cash on Hand'}</option>
                              <option value="331">331 - {language === 'ar' ? 'رواتب وأجور' : 'Salaries & Wages'}</option>
                              <option value="332">332 - {language === 'ar' ? 'مصروفات خدمية' : 'Utilities'}</option>
                            </>
                          )}
                          {newTransaction.transaction_type === 'check_deposit' && (
                            <>
                              <option value="131">131 - {language === 'ar' ? 'العملاء' : 'Accounts Receivable'}</option>
                              <option value="132">132 - {language === 'ar' ? 'أوراق القبض' : 'Notes Receivable'}</option>
                            </>
                          )}
                          {newTransaction.transaction_type === 'check_issued' && (
                            <>
                              <option value="251">251 - {language === 'ar' ? 'الموردون' : 'Accounts Payable'}</option>
                              <option value="252">252 - {language === 'ar' ? 'أوراق الدفع' : 'Notes Payable'}</option>
                              <option value="331">331 - {language === 'ar' ? 'رواتب وأجور' : 'Salaries & Wages'}</option>
                            </>
                          )}
                          {(newTransaction.transaction_type === 'transfer_in' || newTransaction.transaction_type === 'transfer_out') && (
                            <option value="162">162 - {language === 'ar' ? 'بنك آخر' : 'Other Bank'}</option>
                          )}
                        </optgroup>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {language === 'ar' 
                          ? 'اترك فارغاً لاختيار الحساب الافتراضي تلقائياً' 
                          : 'Leave empty for automatic default selection'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddTransactionModal(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleCreateTransaction} className="bg-emerald-600 hover:bg-emerald-700">{language === 'ar' ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {language === 'ar' 
                  ? `هل أنت متأكد من حذف حساب "${deleteTarget.bank_name}"؟`
                  : `Are you sure you want to delete "${deleteTarget.bank_name_en || deleteTarget.bank_name}"?`}
              </p>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>{language === 'ar' ? 'حذف' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* View Account Modal */}
      {showViewAccountModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowViewAccountModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-white">{language === 'ar' ? 'تفاصيل الحساب' : 'Account Details'}</h2>
              <button onClick={() => setShowViewAccountModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold dark:text-white">{language === 'ar' ? selectedAccount.bank_name : (selectedAccount.bank_name_en || selectedAccount.bank_name)}</h3>
                  <p className="text-gray-500">{selectedAccount.account_number}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</p>
                  <p className="text-lg font-bold text-blue-600">{(selectedAccount.opening_balance || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الإيداعات' : 'Total Deposits'}</p>
                  <p className="text-lg font-bold text-green-600">+{(selectedAccount.total_deposits || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي المسحوبات' : 'Total Withdrawals'}</p>
                  <p className="text-lg font-bold text-red-600">-{(selectedAccount.total_withdrawals || 0).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
                <p className="text-sm text-gray-500">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</p>
                <p className="text-3xl font-bold text-emerald-600">{(selectedAccount.current_balance || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                  <p className="text-gray-500">{language === 'ar' ? 'الفرع' : 'Branch'}</p>
                  <p className="font-medium dark:text-white">{selectedAccount.branch_name || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
                  <p className="text-gray-500">{language === 'ar' ? 'العملة' : 'Currency'}</p>
                  <p className="font-medium dark:text-white">{selectedAccount.currency}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end">
              <Button onClick={() => setShowViewAccountModal(false)}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entry Modal */}
      {showJournalModal && selectedJournalEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowJournalModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold dark:text-white">{language === 'ar' ? 'القيد المحاسبي' : 'Journal Entry'}</h2>
                  <p className="text-sm text-gray-500">#{selectedJournalEntry.entry_number}</p>
                </div>
              </div>
              <button onClick={() => setShowJournalModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Entry Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                  <p className="font-medium dark:text-white">{selectedJournalEntry.entry_date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'المرجع' : 'Reference'}</p>
                  <p className="font-medium dark:text-white">{selectedJournalEntry.reference || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedJournalEntry.status === 'posted' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {selectedJournalEntry.status === 'posted' 
                      ? (language === 'ar' ? 'مرحّل' : 'Posted')
                      : (language === 'ar' ? 'مسودة' : 'Draft')}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">{selectedJournalEntry.description}</p>
              </div>

              {/* Journal Lines */}
              <div className="overflow-hidden rounded-lg border dark:border-slate-700">
                <table className="w-full">
                  <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">{language === 'ar' ? 'الحساب' : 'Account'}</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {selectedJournalEntry.lines?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-gray-100 dark:bg-slate-600 px-2 py-0.5 rounded">{line.account_code}</span>
                            <span className="text-sm dark:text-white">{line.account_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {line.debit > 0 && (
                            <span className="text-green-600 font-medium">{line.debit.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {line.credit > 0 && (
                            <span className="text-red-600 font-medium">{line.credit.toLocaleString()}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-300">{language === 'ar' ? 'الإجمالي' : 'Total'}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-600">{(selectedJournalEntry.total_debit || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-600">{(selectedJournalEntry.total_credit || 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance Check */}
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                selectedJournalEntry.total_debit === selectedJournalEntry.total_credit
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                {selectedJournalEntry.total_debit === selectedJournalEntry.total_credit ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700 dark:text-green-400">{language === 'ar' ? 'القيد متوازن' : 'Entry is balanced'}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700 dark:text-red-400">{language === 'ar' ? 'القيد غير متوازن!' : 'Entry is NOT balanced!'}</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end">
              <Button onClick={() => setShowJournalModal(false)}>{language === 'ar' ? 'إغلاق' : 'Close'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankManagementPage;
