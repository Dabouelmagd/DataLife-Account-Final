import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { 
  Plus, ArrowDownLeft, ArrowUpRight, FileText, ShoppingCart,
  Receipt, CreditCard, X, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const QuickEntryModal = ({ isOpen, onClose, entryType, onSuccess }) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    amount: '',
    cashAccount: '',
    targetAccount: '',
    description: '',
    reference: ''
  });

  const translations = {
    ar: {
      receipt: 'إيصال قبض',
      receiptDesc: 'تسجيل مبلغ مستلم (نقدية أو بنك)',
      payment: 'إيصال صرف',
      paymentDesc: 'تسجيل مبلغ مدفوع (مصروف)',
      salesInvoice: 'فاتورة بيع',
      salesInvoiceDesc: 'تسجيل فاتورة مبيعات',
      purchaseInvoice: 'فاتورة شراء',
      purchaseInvoiceDesc: 'تسجيل فاتورة مشتريات',
      amount: 'المبلغ',
      cashAccount: 'حساب النقدية/البنك',
      targetAccount: 'الحساب المقابل',
      revenueAccount: 'حساب الإيراد',
      expenseAccount: 'حساب المصروف',
      customerAccount: 'حساب العميل',
      supplierAccount: 'حساب المورد',
      description: 'البيان',
      reference: 'المرجع (رقم الفاتورة/الإيصال)',
      save: 'حفظ',
      cancel: 'إلغاء',
      selectAccount: 'اختر الحساب',
      success: 'تم إنشاء القيد بنجاح',
      error: 'خطأ في إنشاء القيد',
      requiredFields: 'يرجى ملء جميع الحقول المطلوبة'
    },
    en: {
      receipt: 'Receipt Voucher',
      receiptDesc: 'Record received amount (cash or bank)',
      payment: 'Payment Voucher',
      paymentDesc: 'Record paid amount (expense)',
      salesInvoice: 'Sales Invoice',
      salesInvoiceDesc: 'Record sales invoice',
      purchaseInvoice: 'Purchase Invoice',
      purchaseInvoiceDesc: 'Record purchase invoice',
      amount: 'Amount',
      cashAccount: 'Cash/Bank Account',
      targetAccount: 'Target Account',
      revenueAccount: 'Revenue Account',
      expenseAccount: 'Expense Account',
      customerAccount: 'Customer Account',
      supplierAccount: 'Supplier Account',
      description: 'Description',
      reference: 'Reference (Invoice/Receipt #)',
      save: 'Save',
      cancel: 'Cancel',
      selectAccount: 'Select Account',
      success: 'Entry created successfully',
      error: 'Error creating entry',
      requiredFields: 'Please fill all required fields'
    }
  };

  const t = translations[language] || translations.en;

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
      setFormData({
        amount: '',
        cashAccount: '',
        targetAccount: '',
        description: '',
        reference: ''
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/accounting/accounts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEntryConfig = () => {
    switch (entryType) {
      case 'receipt':
        return {
          title: t.receipt,
          description: t.receiptDesc,
          icon: ArrowDownLeft,
          color: 'text-green-600 bg-green-100',
          targetLabel: t.revenueAccount,
          targetFilter: (acc) => acc.account_type === 'revenue',
          debitAccount: 'cash',
          creditAccount: 'target'
        };
      case 'payment':
        return {
          title: t.payment,
          description: t.paymentDesc,
          icon: ArrowUpRight,
          color: 'text-red-600 bg-red-100',
          targetLabel: t.expenseAccount,
          targetFilter: (acc) => acc.account_type === 'expense',
          debitAccount: 'target',
          creditAccount: 'cash'
        };
      case 'sales':
        return {
          title: t.salesInvoice,
          description: t.salesInvoiceDesc,
          icon: Receipt,
          color: 'text-blue-600 bg-blue-100',
          targetLabel: t.customerAccount,
          targetFilter: (acc) => acc.account_code === '1200', // العملاء
          debitAccount: 'target',
          creditAccount: 'revenue'
        };
      case 'purchase':
        return {
          title: t.purchaseInvoice,
          description: t.purchaseInvoiceDesc,
          icon: ShoppingCart,
          color: 'text-purple-600 bg-purple-100',
          targetLabel: t.supplierAccount,
          targetFilter: (acc) => acc.account_code === '2100', // الموردين
          debitAccount: 'expense',
          creditAccount: 'target'
        };
      default:
        return null;
    }
  };

  const config = getEntryConfig();

  const cashAccounts = accounts.filter(acc => 
    acc.account_code === '1101' || acc.account_code === '1102'
  );

  const targetAccounts = accounts.filter(config?.targetFilter || (() => true));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.amount || !formData.cashAccount || !formData.targetAccount) {
      setError(t.requiredFields);
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      
      const cashAcc = accounts.find(a => a.id === formData.cashAccount);
      const targetAcc = accounts.find(a => a.id === formData.targetAccount);
      const amount = parseFloat(formData.amount);

      let lines = [];
      
      if (entryType === 'receipt') {
        // Receipt: Debit Cash, Credit Revenue
        lines = [
          { account_id: formData.cashAccount, debit: amount, credit: 0, description: formData.description },
          { account_id: formData.targetAccount, debit: 0, credit: amount, description: formData.description }
        ];
      } else if (entryType === 'payment') {
        // Payment: Debit Expense, Credit Cash
        lines = [
          { account_id: formData.targetAccount, debit: amount, credit: 0, description: formData.description },
          { account_id: formData.cashAccount, debit: 0, credit: amount, description: formData.description }
        ];
      } else if (entryType === 'sales') {
        // Sales Invoice: Debit Customer (Receivable), Credit Revenue
        const revenueAcc = accounts.find(a => a.account_code === '4100');
        lines = [
          { account_id: formData.targetAccount, debit: amount, credit: 0, description: formData.description },
          { account_id: revenueAcc?.id || formData.cashAccount, debit: 0, credit: amount, description: formData.description }
        ];
      } else if (entryType === 'purchase') {
        // Purchase Invoice: Debit Expense/Inventory, Credit Supplier (Payable)
        const expenseAcc = accounts.find(a => a.account_code === '5100');
        lines = [
          { account_id: expenseAcc?.id || formData.cashAccount, debit: amount, credit: 0, description: formData.description },
          { account_id: formData.targetAccount, debit: 0, credit: amount, description: formData.description }
        ];
      }

      // Create journal entry
      const response = await axios.post(
        `${API_URL}/api/accounting/journal-entries`,
        {
          entry_date: new Date().toISOString().split('T')[0],
          reference: formData.reference,
          description: formData.description || config?.title,
          lines
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Auto-post the entry
      if (response.data.entry?.id) {
        await axios.post(
          `${API_URL}/api/accounting/journal-entries/${response.data.entry.id}/post`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setSuccess(t.success);
      setTimeout(() => {
        onSuccess && onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.detail || t.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !config) return null;

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className={`p-4 rounded-t-xl ${config.color} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/50 rounded-lg">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{config.title}</h2>
              <p className="text-sm opacity-80">{config.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.amount} *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-lg font-bold text-center"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Cash Account */}
          {(entryType === 'receipt' || entryType === 'payment') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.cashAccount} *</label>
              <select
                value={formData.cashAccount}
                onChange={(e) => setFormData({ ...formData, cashAccount: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">{t.selectAccount}</option>
                {cashAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.account_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{config.targetLabel} *</label>
            <select
              value={formData.targetAccount}
              onChange={(e) => setFormData({ ...formData, targetAccount: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">{t.selectAccount}</option>
              {(entryType === 'receipt' || entryType === 'payment' ? 
                accounts.filter(config.targetFilter) : 
                targetAccounts
              ).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_code} - {acc.account_name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder={config.title}
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.reference}</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="INV-001"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-[#28376B] text-white rounded-lg hover:bg-[#1e2a52] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Quick Entry Buttons Component
const QuickEntryButtons = ({ onEntryCreated }) => {
  const { language } = useLanguage();
  const [activeModal, setActiveModal] = useState(null);

  const translations = {
    ar: {
      quickEntry: 'قيد سريع',
      receipt: 'إيصال قبض',
      payment: 'إيصال صرف',
      salesInvoice: 'فاتورة بيع',
      purchaseInvoice: 'فاتورة شراء'
    },
    en: {
      quickEntry: 'Quick Entry',
      receipt: 'Receipt',
      payment: 'Payment',
      salesInvoice: 'Sales Invoice',
      purchaseInvoice: 'Purchase Invoice'
    }
  };

  const t = translations[language] || translations.en;

  const buttons = [
    { type: 'receipt', label: t.receipt, icon: ArrowDownLeft, color: 'bg-green-500 hover:bg-green-600' },
    { type: 'payment', label: t.payment, icon: ArrowUpRight, color: 'bg-red-500 hover:bg-red-600' },
    { type: 'sales', label: t.salesInvoice, icon: Receipt, color: 'bg-blue-500 hover:bg-blue-600' },
    { type: 'purchase', label: t.purchaseInvoice, icon: ShoppingCart, color: 'bg-purple-500 hover:bg-purple-600' }
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => setActiveModal(btn.type)}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${btn.color}`}
            data-testid={`quick-entry-${btn.type}`}
          >
            <btn.icon className="w-4 h-4" />
            {btn.label}
          </button>
        ))}
      </div>

      <QuickEntryModal
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        entryType={activeModal}
        onSuccess={onEntryCreated}
      />
    </>
  );
};

export { QuickEntryModal, QuickEntryButtons };
export default QuickEntryButtons;
