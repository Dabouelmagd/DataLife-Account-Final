import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { 
  BookOpen, Search, Filter, Calendar, Download, ChevronDown,
  Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Scale, Building2, DollarSign, FileText, BarChart3, ChevronRight,
  RefreshCw, Eye, Shield
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GeneralLedgerPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [accountStatement, setAccountStatement] = useState(null);

  const translations = {
    ar: {
      title: 'دفتر الأستاذ العام',
      subtitle: 'عرض حركات الحسابات وأرصدتها',
      selectAccount: 'اختر الحساب',
      allAccounts: 'جميع الحسابات',
      accountCode: 'رقم الحساب',
      accountName: 'اسم الحساب',
      accountType: 'نوع الحساب',
      balance: 'الرصيد',
      date: 'التاريخ',
      description: 'البيان',
      reference: 'المرجع',
      debit: 'مدين',
      credit: 'دائن',
      runningBalance: 'الرصيد',
      fromDate: 'من تاريخ',
      toDate: 'إلى تاريخ',
      export: 'تصدير',
      noEntries: 'لا توجد حركات',
      totalDebit: 'إجمالي المدين',
      totalCredit: 'إجمالي الدائن',
      closingBalance: 'الرصيد الختامي',
      accountStatement: 'كشف حساب',
      asset: 'أصول',
      liability: 'خصوم',
      equity: 'حقوق ملكية',
      revenue: 'إيرادات',
      expense: 'مصروفات',
      contra_asset: 'أصول مقابلة',
      currentAssets: 'الأصول المتداولة',
      fixedAssets: 'الأصول الثابتة',
      currentLiabilities: 'الخصوم المتداولة',
      search: 'بحث في الحسابات...'
    },
    en: {
      title: 'General Ledger',
      subtitle: 'View account transactions and balances',
      selectAccount: 'Select Account',
      allAccounts: 'All Accounts',
      accountCode: 'Account Code',
      accountName: 'Account Name',
      accountType: 'Account Type',
      balance: 'Balance',
      date: 'Date',
      description: 'Description',
      reference: 'Reference',
      debit: 'Debit',
      credit: 'Credit',
      runningBalance: 'Balance',
      fromDate: 'From Date',
      toDate: 'To Date',
      export: 'Export',
      noEntries: 'No entries found',
      totalDebit: 'Total Debit',
      totalCredit: 'Total Credit',
      closingBalance: 'Closing Balance',
      accountStatement: 'Account Statement',
      asset: 'Asset',
      liability: 'Liability',
      equity: 'Equity',
      revenue: 'Revenue',
      expense: 'Expense',
      contra_asset: 'Contra Asset',
      currentAssets: 'Current Assets',
      fixedAssets: 'Fixed Assets',
      currentLiabilities: 'Current Liabilities',
      search: 'Search accounts...'
    }
  };

  const t = translations[language] || translations.en;

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchAccountStatement();
    }
  }, [selectedAccount, filters]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/accounting/accounts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountStatement = async () => {
    if (!selectedAccount) return;
    
    try {
      setLoadingEntries(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);

      const response = await axios.get(
        `${API_URL}/api/accounting/ledger/account-statement/${selectedAccount.id}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAccountStatement(response.data);
      setLedgerEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching account statement:', error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const getAccountTypeBadge = (type) => {
    const styles = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-purple-100 text-purple-800',
      equity: 'bg-indigo-100 text-indigo-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-red-100 text-red-800',
      contra_asset: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || styles.asset}`}>
        {t[type] || type}
      </span>
    );
  };

  const formatBalance = (balance, type) => {
    const isDebitNature = ['asset', 'expense', 'contra_liability', 'contra_equity'].includes(type);
    const color = balance >= 0 
      ? (isDebitNature ? 'text-green-600' : 'text-red-600')
      : (isDebitNature ? 'text-red-600' : 'text-green-600');
    
    return <span className={`font-medium ${color}`}>{Math.abs(balance).toLocaleString()}</span>;
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {});

  const accountTypeOrder = ['asset', 'contra_asset', 'liability', 'equity', 'revenue', 'expense'];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Enterprise Header */}
        <div className="bg-gradient-to-r from-[#0F1729] to-[#1e3a8a] rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black">{t.title}</h1>
                <p className="text-blue-200 text-sm mt-0.5">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-xs">
                <Shield className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-300">{isRTL ? 'Immutable Ledger' : 'Immutable Ledger'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 text-xs">
                <Scale className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-yellow-300">{isRTL ? '108 حساب' : '108 Accounts'}</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          {accountStatement && (
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/10">
              <div className="text-center">
                <p className="text-white/60 text-xs">{isRTL ? 'إجمالي المدين' : 'Total Debit'}</p>
                <p className="text-white font-bold text-lg mt-0.5">
                  {(accountStatement.total_debit || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-white/60 text-xs">{isRTL ? 'إجمالي الدائن' : 'Total Credit'}</p>
                <p className="text-white font-bold text-lg mt-0.5">
                  {(accountStatement.total_credit || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs">{isRTL ? 'الرصيد الختامي' : 'Closing Balance'}</p>
                <p className={`font-bold text-lg mt-0.5 ${(accountStatement.closing_balance || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {Math.abs(accountStatement.closing_balance || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Accounts List */}
          <div className="col-span-4">
            <div className="bg-white rounded-xl shadow-sm sticky top-6">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-800">{t.allAccounts}</h2>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t.search}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {accountTypeOrder.map((type) => {
                    const typeAccounts = groupedAccounts[type];
                    if (!typeAccounts || typeAccounts.length === 0) return null;
                    
                    return (
                      <div key={type} className="border-b last:border-0">
                        <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600">
                          {t[type] || type}
                        </div>
                        {typeAccounts.map((account) => (
                          <div
                            key={account.id}
                            onClick={() => setSelectedAccount(account)}
                            className={`px-3 py-2.5 cursor-pointer hover:bg-blue-50/80 transition-all border-b last:border-0 ${
                              selectedAccount?.id === account.id ? 'bg-blue-50 border-r-3 border-r-[#28376B] shadow-sm' : ''
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono font-bold text-[#1e3a8a] bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                    {account.account_code}
                                  </span>
                                  <span className="font-medium text-gray-800 text-sm truncate">
                                    {account.account_name}
                                  </span>
                                </div>
                                {account.account_name_en && (
                                  <div className="text-xs text-gray-400 mt-0.5 truncate">{account.account_name_en}</div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {formatBalance(account.current_balance || 0, account.account_type)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Account Details & Ledger */}
          <div className="col-span-8">
            {!selectedAccount ? (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center">
                <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">{t.selectAccount}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Account Info Card */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-[#28376B]">
                        {selectedAccount.account_code} - {selectedAccount.account_name}
                      </h2>
                      {selectedAccount.account_name_en && (
                        <p className="text-gray-500">{selectedAccount.account_name_en}</p>
                      )}
                      <div className="mt-2">
                        {getAccountTypeBadge(selectedAccount.account_type)}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm text-gray-500">{t.closingBalance}</div>
                      <div className="text-3xl font-bold text-[#28376B]">
                        {(selectedAccount.current_balance || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                      <Download className="w-4 h-4" />
                      {t.export}
                    </button>
                  </div>
                </div>

                {/* Ledger Entries Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">{t.accountStatement}</h3>
                  </div>
                  
                  {loadingEntries ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : ledgerEntries.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      {t.noEntries}
                    </div>
                  ) : (
                    <>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.date}</th>
                            <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.description}</th>
                            <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.debit}</th>
                            <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.credit}</th>
                            <th className="px-4 py-3 text-start text-sm font-medium text-gray-600">{t.runningBalance}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((entry, idx) => (
                            <tr key={entry.id || idx} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3">{entry.entry_date}</td>
                              <td className="px-4 py-3">{entry.description}</td>
                              <td className="px-4 py-3">
                                {entry.debit > 0 && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <ArrowUpRight className="w-4 h-4" />
                                    {entry.debit.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {entry.credit > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <ArrowDownRight className="w-4 h-4" />
                                    {entry.credit.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {entry.balance?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Totals */}
                      {accountStatement && (
                        <div className="p-4 bg-gray-50 border-t">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-sm text-gray-500">{t.totalDebit}</div>
                              <div className="text-xl font-bold text-green-600">
                                {accountStatement.total_debit?.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">{t.totalCredit}</div>
                              <div className="text-xl font-bold text-red-600">
                                {accountStatement.total_credit?.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">{t.closingBalance}</div>
                              <div className="text-xl font-bold text-[#28376B]">
                                {accountStatement.closing_balance?.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralLedgerPage;
