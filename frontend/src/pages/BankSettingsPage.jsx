import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Settings, Save, RefreshCw, Building2, CreditCard, 
  CheckCircle, AlertTriangle, Loader2, ArrowRight,
  Wallet, Users, FileText, Bell
} from 'lucide-react';

const BankSettingsPage = ({ language }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accounts, setAccounts] = useState([]);
  
  const [settings, setSettings] = useState({
    auto_post_journal: false,
    default_deposit_account: '161',
    default_withdrawal_account: '331',
    default_check_deposit_account: '131',
    default_check_issued_account: '251',
    require_approval_above: null,
    notify_on_large_transaction: false,
    large_transaction_threshold: 100000
  });

  useEffect(() => {
    fetchSettings();
    fetchAccounts();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-counter-accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bank-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {language === 'ar' ? 'إعدادات البنك' : 'Bank Settings'}
              </h1>
              <p className="text-slate-300 mt-1">
                {language === 'ar' 
                  ? 'تخصيص إعدادات الحركات البنكية والقيود المحاسبية' 
                  : 'Customize bank transactions and journal entry settings'}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-white text-slate-800 hover:bg-slate-100 gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved 
              ? (language === 'ar' ? 'تم الحفظ!' : 'Saved!') 
              : (language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto-Post Settings */}
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {language === 'ar' ? 'ترحيل القيود المحاسبية' : 'Journal Entry Posting'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.auto_post_journal ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <CheckCircle className={`w-5 h-5 ${settings.auto_post_journal ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium dark:text-white">
                      {language === 'ar' ? 'ترحيل تلقائي للقيود' : 'Auto-post Journal Entries'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {language === 'ar' 
                        ? 'ترحيل القيود مباشرة عند إنشاء الحركة البنكية' 
                        : 'Post entries immediately when creating bank transactions'}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_post_journal}
                    onChange={(e) => handleChange('auto_post_journal', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              {settings.auto_post_journal && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        {language === 'ar' ? 'الترحيل التلقائي مفعّل' : 'Auto-posting is enabled'}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        {language === 'ar' 
                          ? 'القيود ستُرحّل وتؤثر على أرصدة الحسابات فوراً' 
                          : 'Entries will be posted and affect account balances immediately'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {!settings.auto_post_journal && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                        {language === 'ar' ? 'الترحيل اليدوي مطلوب' : 'Manual posting required'}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        {language === 'ar' 
                          ? 'القيود ستُنشأ كمسودات وتحتاج ترحيل يدوي من صفحة القيود' 
                          : 'Entries will be created as drafts and need manual posting'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Large Transaction Alerts */}
        <Card className="border-0 shadow-lg dark:bg-slate-800">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {language === 'ar' ? 'تنبيهات المعاملات' : 'Transaction Alerts'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.notify_on_large_transaction ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <Bell className={`w-5 h-5 ${settings.notify_on_large_transaction ? 'text-amber-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-medium dark:text-white">
                    {language === 'ar' ? 'تنبيه المعاملات الكبيرة' : 'Large Transaction Alert'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'ar' 
                      ? 'إشعار عند تجاوز مبلغ معين' 
                      : 'Notify when amount exceeds threshold'}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notify_on_large_transaction}
                  onChange={(e) => handleChange('notify_on_large_transaction', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {settings.notify_on_large_transaction && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'حد المبلغ (ج.م)' : 'Threshold Amount (EGP)'}
                </label>
                <input
                  type="number"
                  value={settings.large_transaction_threshold}
                  onChange={(e) => handleChange('large_transaction_threshold', parseFloat(e.target.value) || 0)}
                  className="w-full p-3 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'ar' ? 'مبلغ يتطلب موافقة (اختياري)' : 'Amount Requiring Approval (optional)'}
              </label>
              <input
                type="number"
                value={settings.require_approval_above || ''}
                onChange={(e) => handleChange('require_approval_above', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder={language === 'ar' ? 'اتركه فارغاً لتعطيل' : 'Leave empty to disable'}
                className="w-full p-3 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"
              />
              <p className="text-xs text-gray-500">
                {language === 'ar' 
                  ? 'المعاملات فوق هذا المبلغ ستحتاج موافقة' 
                  : 'Transactions above this amount will require approval'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Default Accounts */}
        <Card className="border-0 shadow-lg dark:bg-slate-800 lg:col-span-2">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              {language === 'ar' ? 'الحسابات المقابلة الافتراضية' : 'Default Counter Accounts'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Deposit Account */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-800 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-green-600 rotate-180" />
                  </div>
                  <span className="font-medium text-green-800 dark:text-green-300">
                    {language === 'ar' ? 'إيداع' : 'Deposit'}
                  </span>
                </div>
                <select
                  value={settings.default_deposit_account}
                  onChange={(e) => handleChange('default_deposit_account', e.target.value)}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                >
                  {accounts.map(acc => (
                    <option key={acc.account_code} value={acc.account_code}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {language === 'ar' ? 'الحساب الدائن عند الإيداع' : 'Credit account for deposits'}
                </p>
              </div>

              {/* Withdrawal Account */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-800 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-medium text-red-800 dark:text-red-300">
                    {language === 'ar' ? 'سحب' : 'Withdrawal'}
                  </span>
                </div>
                <select
                  value={settings.default_withdrawal_account}
                  onChange={(e) => handleChange('default_withdrawal_account', e.target.value)}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                >
                  {accounts.map(acc => (
                    <option key={acc.account_code} value={acc.account_code}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {language === 'ar' ? 'الحساب المدين عند السحب' : 'Debit account for withdrawals'}
                </p>
              </div>

              {/* Check Deposit Account */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-800 dark:text-blue-300">
                    {language === 'ar' ? 'شيك وارد' : 'Check Deposit'}
                  </span>
                </div>
                <select
                  value={settings.default_check_deposit_account}
                  onChange={(e) => handleChange('default_check_deposit_account', e.target.value)}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                >
                  {accounts.map(acc => (
                    <option key={acc.account_code} value={acc.account_code}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  {language === 'ar' ? 'الحساب الدائن للشيكات الواردة' : 'Credit account for incoming checks'}
                </p>
              </div>

              {/* Check Issued Account */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium text-purple-800 dark:text-purple-300">
                    {language === 'ar' ? 'شيك صادر' : 'Check Issued'}
                  </span>
                </div>
                <select
                  value={settings.default_check_issued_account}
                  onChange={(e) => handleChange('default_check_issued_account', e.target.value)}
                  className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm"
                >
                  {accounts.map(acc => (
                    <option key={acc.account_code} value={acc.account_code}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  {language === 'ar' ? 'الحساب المدين للشيكات الصادرة' : 'Debit account for issued checks'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BankSettingsPage;
