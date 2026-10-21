import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, Search, Filter, FileText, Download, Eye,
  CheckCircle, Clock, XCircle, DollarSign, FileCheck, Send, Trash2, Minus,
  Building, Upload, Percent,
  RotateCcw
,
  X} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;
const ETA_API = `${process.env.REACT_APP_BACKEND_URL}/api/eta`;

const InvoicesPage = () => {
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const isRTL = language === 'ar';

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('sales_invoice');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [parties, setParties] = useState([]);
  const [activeTab, setActiveTab] = useState('sales_invoice');
  // debit note: the way to correct a posted purchase invoice
  const [debitNote, setDebitNote] = useState(null);      // the invoice being corrected
  const [dnMode, setDnMode] = useState('items');         // items | amount
  const [dnForm, setDnForm] = useState({ items: [], amount: '', reason: '' });
  const [dnBusy, setDnBusy] = useState(false);
  // sales credit note: per-line quantity + what happens to the returned goods
  const [creditNote, setCreditNote] = useState(null);    // the sales invoice being credited
  const [cnCtx, setCnCtx] = useState(null);              // returnable lines, warehouses, ETA link
  const [cnMode, setCnMode] = useState('items');         // items | amount
  const [cnForm, setCnForm] = useState({ items: [], amount: '', reason: '' });
  const [cnBusy, setCnBusy] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState('EGP');
  const [adjustmentCategories, setAdjustmentCategories] = useState(null);
  // payment on an approved invoice (foreign currency: payment rate + realized FX)
  const [payInvoice, setPayInvoice] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', discount_amount: '', payment_date: '', payment_method: 'bank_transfer', exchange_rate: '', reference: '' });
  const [payBusy, setPayBusy] = useState(false);

  const [formData, setFormData] = useState({
    document_type: 'sales_invoice',
    document_date: new Date().toISOString().split('T')[0],
    due_date: '',
    party_id: '',
    currency: 'EGP',
    exchange_rate: '',
    payment_terms: 'cash',
    lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount_percent: 0 }],
    adjustments: [], // خصومات وإضافات الفاتورة
    notes: '',
    reference: ''
  });

  const t = {
    ar: {
      invoices: 'الفواتير الإلكترونية',
      salesInvoices: 'فواتير البيع',
      purchaseInvoices: 'فواتير الشراء',
      quotations: 'عروض الأسعار',
      purchaseOrders: 'أوامر الشراء',
      createInvoice: 'إنشاء فاتورة',
      createQuotation: 'إنشاء عرض سعر',
      createPO: 'إنشاء أمر شراء',
      search: 'بحث...',
      all: 'الكل',
      draft: 'مسودة',
      pending: 'معلق',
      approved: 'معتمد',
      paid: 'مدفوع',
      partiallyPaid: 'مدفوع جزئياً',
      cancelled: 'ملغي',
      converted: 'محول',
      invoiceNumber: 'رقم الفاتورة',
      date: 'التاريخ',
      customer: 'العميل',
      supplier: 'المورد',
      total: 'الإجمالي',
      status: 'الحالة',
      actions: 'الإجراءات',
      view: 'عرض',
      approve: 'اعتماد',
      downloadPDF: 'تحميل PDF',
      convertToInvoice: 'تحويل لفاتورة',
      noInvoices: 'لا توجد فواتير',
      selectParty: 'اختر العميل/المورد',
      addLine: 'إضافة سطر',
      description: 'الوصف',
      quantity: 'الكمية',
      unitPrice: 'سعر الوحدة',
      taxRate: 'نسبة الضريبة',
      discount: 'الخصم %',
      subtotal: 'المجموع الفرعي',
      tax: 'الضريبة',
      grandTotal: 'الإجمالي الكلي',
      save: 'حفظ',
      cancel: 'إلغاء',
      paymentTerms: 'شروط الدفع',
      cash: 'نقداً',
      net7: '7 أيام',
      net15: '15 يوم',
      net30: '30 يوم',
      notes: 'ملاحظات',
      reference: 'المرجع',
      dueDate: 'تاريخ الاستحقاق',
      amountDue: 'المبلغ المستحق',
      totalSales: 'إجمالي المبيعات',
      totalPurchases: 'إجمالي المشتريات',
      outstandingReceivables: 'المستحقات',
      outstandingPayables: 'المطلوبات',
      invoiceCreated: 'تم إنشاء الفاتورة بنجاح',
      invoiceApproved: 'تم اعتماد الفاتورة بنجاح',
      error: 'حدث خطأ',
      // Adjustments translations
      adjustments: 'الخصومات والإضافات',
      addDiscount: 'إضافة خصم',
      addAddition: 'إضافة رسوم',
      adjustmentType: 'النوع',
      adjustmentName: 'الاسم',
      adjustmentValue: 'القيمة',
      calculationType: 'طريقة الحساب',
      percentage: 'نسبة %',
      fixedAmount: 'مبلغ ثابت',
      applyOn: 'التطبيق على',
      beforeTax: 'قبل الضريبة — يُخفِّض وعاء الضريبة',
      afterTax: 'بعد الضريبة — لا يغيّر الضريبة',
      discountCategories: {
        contract_discount: 'خصم تعاقد',
        early_payment: 'خصم دفع مبكر',
        volume_discount: 'خصم كمية',
        promotional: 'خصم ترويجي',
        custom: 'خصم مخصص'
      },
      additionCategories: {
        shipping: 'رسوم شحن',
        service_fee: 'رسوم خدمة',
        table_tax: 'ضريبة جدول',
        insurance: 'تأمين',
        handling: 'رسوم مناولة',
        custom: 'إضافة مخصصة'
      },
      totalDiscounts: 'إجمالي الخصومات',
      totalAdditions: 'إجمالي الإضافات',
      vat: 'ضريبة القيمة المضافة',
      vat14: 'ضريبة القيمة المضافة (14%)',
      sendToETA: 'إرسال لمصلحة الضرائب',
      etaSubmitted: 'مرسلة للضرائب',
      etaPending: 'في انتظار الإرسال',
      etaSuccess: 'تم إرسال الفاتورة لمصلحة الضرائب بنجاح',
      etaError: 'فشل إرسال الفاتورة لمصلحة الضرائب',
      taxDetails: 'تفاصيل الضريبة',
      vatAmount: 'قيمة الضريبة'
    },
    en: {
      invoices: 'Electronic Invoices',
      salesInvoices: 'Sales Invoices',
      purchaseInvoices: 'Purchase Invoices',
      quotations: 'Quotations',
      purchaseOrders: 'Purchase Orders',
      createInvoice: 'Create Invoice',
      createQuotation: 'Create Quotation',
      createPO: 'Create Purchase Order',
      search: 'Search...',
      all: 'All',
      draft: 'Draft',
      pending: 'Pending',
      approved: 'Approved',
      paid: 'Paid',
      partiallyPaid: 'Partially Paid',
      cancelled: 'Cancelled',
      converted: 'Converted',
      invoiceNumber: 'Invoice #',
      date: 'Date',
      customer: 'Customer',
      supplier: 'Supplier',
      total: 'Total',
      status: 'Status',
      actions: 'Actions',
      view: 'View',
      approve: 'Approve',
      downloadPDF: 'Download PDF',
      convertToInvoice: 'Convert to Invoice',
      noInvoices: 'No invoices found',
      selectParty: 'Select Customer/Supplier',
      addLine: 'Add Line',
      description: 'Description',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      taxRate: 'Tax Rate',
      discount: 'Discount %',
      subtotal: 'Subtotal',
      tax: 'Tax',
      grandTotal: 'Grand Total',
      save: 'Save',
      cancel: 'Cancel',
      paymentTerms: 'Payment Terms',
      cash: 'Cash',
      net7: 'Net 7 Days',
      net15: 'Net 15 Days',
      net30: 'Net 30 Days',
      notes: 'Notes',
      reference: 'Reference',
      dueDate: 'Due Date',
      amountDue: 'Amount Due',
      totalSales: 'Total Sales',
      totalPurchases: 'Total Purchases',
      outstandingReceivables: 'Receivables',
      outstandingPayables: 'Payables',
      invoiceCreated: 'Invoice created successfully',
      invoiceApproved: 'Invoice approved successfully',
      error: 'An error occurred',
      // Adjustments translations
      adjustments: 'Discounts & Additions',
      addDiscount: 'Add Discount',
      addAddition: 'Add Fee',
      adjustmentType: 'Type',
      adjustmentName: 'Name',
      adjustmentValue: 'Value',
      calculationType: 'Calculation',
      percentage: 'Percentage %',
      fixedAmount: 'Fixed Amount',
      applyOn: 'Apply On',
      beforeTax: 'Before tax — reduces the VAT base',
      afterTax: 'After tax — VAT unchanged',
      discountCategories: {
        contract_discount: 'Contract Discount',
        early_payment: 'Early Payment',
        volume_discount: 'Volume Discount',
        promotional: 'Promotional',
        custom: 'Custom Discount'
      },
      additionCategories: {
        shipping: 'Shipping Fee',
        service_fee: 'Service Fee',
        table_tax: 'Table Tax',
        insurance: 'Insurance',
        handling: 'Handling Fee',
        custom: 'Custom Addition'
      },
      totalDiscounts: 'Total Discounts',
      totalAdditions: 'Total Additions',
      vat: 'VAT',
      vat14: 'VAT (14%)',
      sendToETA: 'Send to Tax Authority',
      etaSubmitted: 'Submitted to ETA',
      etaPending: 'Pending Submission',
      etaSuccess: 'Invoice submitted to Tax Authority successfully',
      etaError: 'Failed to submit invoice to Tax Authority',
      taxDetails: 'Tax Details',
      vatAmount: 'VAT Amount'
    }
  };

  const text = t[language] || t.ar;
  const getToken = () => localStorage.getItem('token');

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      let url = `${API}/?limit=100`;
      
      if (typeFilter !== 'all') {
        url += `&document_type=${typeFilter}`;
      }
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  const fetchParties = useCallback(async () => {
    try {
      const token = getToken();
      const partyType = activeTab.includes('sales') || activeTab === 'sales_quotation' ? 'customer' : 'supplier';
      const response = await fetch(`${API}/parties?party_type=${partyType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setParties(data.parties || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
    }
  }, [activeTab]);

  const fetchCurrencies = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/config/currencies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCurrencies(data.currencies?.filter(c => c.is_enabled) || []);
      setBaseCurrency(data.base_currency || 'EGP');
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  }, []);

  const fetchAdjustmentCategories = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/adjustment-categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAdjustmentCategories(data);
    } catch (error) {
      console.error('Error fetching adjustment categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchCurrencies();
    fetchAdjustmentCategories();
  }, [fetchInvoices, fetchCurrencies, fetchAdjustmentCategories]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  // مراكز التكلفة / الفروع — يُسجَّل المركز المختار على كل سطر في قيد الفاتورة
  const [costCenters, setCostCenters] = useState([]);
  useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/enterprise/cost-centers`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : { cost_centers: [] }))
      .then((d) => setCostCenters(d.cost_centers || []))
      .catch(() => {});
  }, []);

  // EGP per one unit of `currency` on `date` (the server reads every saved rate format)
  const fetchRateOn = async (currency, date) => {
    if (!currency || currency === 'EGP') return '';
    try {
      const res = await fetch(`${API}/config/exchange-rates/on?currency=${currency}&date=${date}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.detail || text.error); return ''; }
      return String(d.rate);
    } catch (e) {
      return '';
    }
  };

  const changeInvoiceFx = async (patch) => {
    const next = { ...formData, ...patch };
    setFormData(prev => ({ ...prev, ...patch, exchange_rate: next.currency === 'EGP' ? '' : prev.exchange_rate }));
    if (next.currency !== 'EGP') {
      const rate = await fetchRateOn(next.currency, next.document_date);
      setFormData(prev => ({ ...prev, exchange_rate: rate }));
    }
  };

  const openPayment = async (invoice) => {
    const today = new Date().toISOString().split('T')[0];
    setPayInvoice(invoice);
    setPayForm({ amount: String(invoice.amount_due ?? ''), discount_amount: '', payment_date: today, payment_method: 'bank_transfer', exchange_rate: '', reference: '' });
    if (invoice.currency && invoice.currency !== 'EGP') {
      const rate = await fetchRateOn(invoice.currency, today);
      setPayForm(prev => ({ ...prev, exchange_rate: rate }));
    }
  };

  const changePaymentDate = async (date) => {
    setPayForm(prev => ({ ...prev, payment_date: date }));
    if (payInvoice && payInvoice.currency && payInvoice.currency !== 'EGP') {
      const rate = await fetchRateOn(payInvoice.currency, date);
      setPayForm(prev => ({ ...prev, exchange_rate: rate }));
    }
  };

  const handleRecordPayment = async () => {
    const amount = Number(payForm.amount);
    const discount = Number(payForm.discount_amount) || 0;
    if (!(amount > 0) && !(discount > 0)) { toast.error(isRTL ? 'أدخل مبلغ السداد' : 'Enter the amount'); return; }
    if (discount < 0) { toast.error(isRTL ? 'الخصم النقدي لا يكون بالسالب' : 'The cash discount cannot be negative'); return; }
    const foreign = payInvoice.currency && payInvoice.currency !== 'EGP';
    setPayBusy(true);
    try {
      const res = await fetch(`${API}/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: payInvoice.id, amount: amount || 0, discount_amount: discount, payment_date: payForm.payment_date,
          payment_method: payForm.payment_method, reference: payForm.reference || null,
          exchange_rate: foreign ? (Number(payForm.exchange_rate) || null) : null
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || text.error);
      const fx = d.payment && d.payment.fx_difference;
      toast.success(fx ? (isRTL ? `تم تسجيل السداد — فرق عملة ${fx > 0 ? 'ربح' : 'خسارة'} ${Math.abs(fx).toLocaleString()} ج.م`
                                : `Payment recorded — FX ${fx > 0 ? 'gain' : 'loss'} ${Math.abs(fx).toLocaleString()} EGP`)
                       : (isRTL ? 'تم تسجيل السداد' : 'Payment recorded'));
      setPayInvoice(null);
      fetchInvoices();
    } catch (e) {
      toast.error(e.message || text.error);
    } finally { setPayBusy(false); }
  };

  const handleCreateInvoice = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          exchange_rate: formData.currency !== 'EGP' ? (Number(formData.exchange_rate) || null) : null,
          lines: formData.lines.map(line => ({
            ...line,
            tax_type: 'vat',
            vat_category: line.vat_category || null,
            other_taxes: (line.other_taxes || []).map(t => ({
              tax_type: t.tax_type, sub_type: t.sub_type || null,
              rate: FIXED_TAXES.includes(t.tax_type) ? 0 : (Number(t.rate) || 0),
              amount: FIXED_TAXES.includes(t.tax_type) ? (Number(t.amount) || 0) : 0
            }))
          })),
          adjustments: formData.adjustments || []
        })
      });

      if (response.ok) {
        toast.success(text.invoiceCreated);
        setShowCreateModal(false);
        fetchInvoices();
        resetForm();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(text.error);
    }
  };

  const openDebitNote = async (invoice) => {
    setDnMode('items'); setDnBusy(false);
    setDnForm({ amount: '', reason: '', items: (invoice.lines || []).map((l) => ({
      product_id: l.product_id, description: l.description,
      max: Number(l.quantity) || 0, quantity: 0,
      unit_price: Number(l.unit_price) || 0, vat_percent: Number(l.tax_rate ?? 14),
    })) });
    setDebitNote(invoice);
  };

  const submitDebitNote = async () => {
    const body = { reason: dnForm.reason || null };
    if (dnMode === 'items') {
      const items = dnForm.items.filter((i) => Number(i.quantity) > 0).map((i) => ({
        product_id: i.product_id, description: i.description,
        quantity: Number(i.quantity), unit_price: i.unit_price, vat_percent: i.vat_percent,
      }));
      if (!items.length) { alert(isRTL ? 'حدد الكميات المرتجعة' : 'Enter the returned quantities'); return; }
      body.items = items;
    } else {
      if (!(Number(dnForm.amount) > 0)) { alert(isRTL ? 'أدخل مبلغ الإشعار' : 'Enter the amount'); return; }
      body.amount = Number(dnForm.amount);
    }
    setDnBusy(true);
    try {
      const res = await fetch(`${API}/purchase-invoices/${debitNote.id}/debit-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || '');
      alert(d.message);
      setDebitNote(null); fetchInvoices();
    } catch (e) {
      alert(e.message || (isRTL ? 'تعذّر إصدار الإشعار' : 'Could not issue the note'));
    } finally { setDnBusy(false); }
  };

  const openCreditNote = async (invoice) => {
    setCnMode('items'); setCnBusy(false); setCnCtx(null);
    setCnForm({ items: [], amount: '', reason: '' });
    setCreditNote(invoice);
    try {
      const res = await fetch(`${API}/sales-invoices/${invoice.id}/credit-note-context`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || '');
      const main = (d.warehouses || []).find((w) => w.warehouse_type === 'main');
      const quarantine = (d.warehouses || []).find((w) => w.warehouse_type === 'quarantine');
      setCnCtx(d);
      setCnForm({ amount: '', reason: '', items: (d.lines || []).map((l) => ({
        ...l, quantity_original: l.quantity, quantity: 0, disposition: 'restock',
        warehouse_id: main ? main.id : '', quarantine_id: quarantine ? quarantine.id : '',
      })) });
    } catch (e) {
      toast.error(e.message || text.error);
      setCreditNote(null);
    }
  };

  const setCnItem = (idx, patch) =>
    setCnForm((f) => ({ ...f, items: f.items.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));

  const submitCreditNote = async () => {
    if (!cnForm.reason.trim()) { toast.error(isRTL ? 'سبب الإشعار مطلوب' : 'A reason is required'); return; }
    const body = { reason: cnForm.reason.trim() };
    if (cnMode === 'items') {
      const items = cnForm.items.filter((i) => Number(i.quantity) > 0).map((i) => ({
        line_number: i.line_number, quantity: Number(i.quantity), disposition: i.disposition,
        warehouse_id: i.disposition === 'quarantine' ? i.quarantine_id
          : i.disposition === 'restock' ? (i.warehouse_id || null) : null,
      }));
      if (!items.length) { toast.error(isRTL ? 'حدد الكميات المرتجعة' : 'Enter the returned quantities'); return; }
      if (items.some((i) => i.disposition === 'quarantine' && !i.warehouse_id)) {
        toast.error(isRTL ? 'اختر مخزن الحجر/الفحص' : 'Choose the quarantine warehouse'); return;
      }
      body.items = items;
    } else {
      if (!(Number(cnForm.amount) > 0)) { toast.error(isRTL ? 'أدخل مبلغ الإشعار' : 'Enter the amount'); return; }
      body.amount = Number(cnForm.amount);
    }
    setCnBusy(true);
    try {
      const res = await fetch(`${API}/sales-invoices/${creditNote.id}/credit-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || '');
      toast.success(d.message);
      setCreditNote(null); fetchInvoices();
    } catch (e) {
      toast.error(e.message || (isRTL ? 'تعذّر إصدار الإشعار' : 'Could not issue the note'));
    } finally { setCnBusy(false); }
  };

  const handleApproveInvoice = async (invoiceId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/${invoiceId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(text.invoiceApproved);
        fetchInvoices();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      console.error('Error approving invoice:', error);
      toast.error(text.error);
    }
  };

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/${invoiceId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error(text.error);
    }
  };

  const handleConvertToInvoice = async (quotationId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/${quotationId}/convert-to-invoice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(text.invoiceCreated);
        fetchInvoices();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      console.error('Error converting quotation:', error);
      toast.error(text.error);
    }
  };

  // Submit invoice to Egyptian Tax Authority (ETA)
  const handleSubmitToETA = async (invoiceId) => {
    try {
      const token = getToken();
      const response = await fetch(`${ETA_API}/submit/${invoiceId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(text.etaSuccess);
        fetchInvoices();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.etaError);
      }
    } catch (error) {
      console.error('Error submitting to ETA:', error);
      toast.error(text.etaError);
    }
  };

  const resetForm = () => {
    setFormData({
      document_type: activeTab,
      document_date: new Date().toISOString().split('T')[0],
      due_date: '',
      party_id: '',
      currency: 'EGP',
      exchange_rate: '',
      payment_terms: 'cash',
      lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount_percent: 0 }],
      adjustments: [],
      notes: '',
      reference: ''
    });
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount_percent: 0 }]
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length > 1) {
      setFormData(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index)
      }));
    }
  };

  const updateLine = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => 
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };

  // دوال التعديلات (الخصومات والإضافات)
  const addAdjustment = (type) => {
    const newAdjustment = {
      adjustment_type: type, // 'discount' or 'addition'
      category: 'custom',
      name: '',
      name_en: '',
      calculation_type: 'percentage',
      value: 0,
      base: 'before_tax',
      notes: ''
    };
    setFormData(prev => ({
      ...prev,
      adjustments: [...prev.adjustments, newAdjustment]
    }));
  };

  const removeAdjustment = (index) => {
    setFormData(prev => ({
      ...prev,
      adjustments: prev.adjustments.filter((_, i) => i !== index)
    }));
  };

  const updateAdjustment = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      adjustments: prev.adjustments.map((adj, i) => 
        i === index ? { ...adj, [field]: value } : adj
      )
    }));
  };

  // Mirrors models/invoice.py: a before-tax invoice discount is spread onto
  // the lines pro-rata (it lowers the VAT); table tax (T2/T3) is inside the
  // VAT base; stamp duty (T5/T6) is not; T4 (withholding) is subtracted.
  const r2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
  const FIXED_TAXES = ['T3', 'T6'];

  const calculateLineTotals = (line, share = 0) => {
    const subtotal = r2((Number(line.quantity) || 0) * (Number(line.unit_price) || 0));
    const discountAmount = r2(subtotal * ((Number(line.discount_percent) || 0) / 100));
    const net = r2(subtotal - discountAmount - share);
    const taxes = line.other_taxes || [];
    const t3 = taxes.filter(t => t.tax_type === 'T3').reduce((a, t) => a + r2(t.amount || 0), 0);
    let inBase = 0; let added = 0; let withheld = 0;
    taxes.forEach(t => {
      const amt = FIXED_TAXES.includes(t.tax_type) ? r2(t.amount || 0)
        : t.tax_type === 'T2' ? r2((net + t3) * (Number(t.rate) || 0) / 100)
        : r2(net * (Number(t.rate) || 0) / 100);
      if (t.tax_type === 'T4') withheld += amt;
      else { added += amt; if (t.tax_type === 'T2' || t.tax_type === 'T3') inBase += amt; }
    });
    const standard = !line.vat_category || line.vat_category === 'standard';
    const taxAmount = standard ? r2((net + inBase) * ((Number(line.tax_rate) || 0) / 100)) : 0;
    const total = r2(net + taxAmount + added - withheld);
    return { subtotal, discountAmount, share, net, taxAmount, otherTaxes: r2(added), withheld: r2(withheld), total };
  };

  const calculateInvoiceTotals = () => {
    const adjustments = formData.adjustments || [];
    const ownNets = formData.lines.map(l => {
      const t = calculateLineTotals(l);
      return r2(t.subtotal - t.discountAmount);
    });
    const baseNet = r2(ownNets.reduce((a, b) => a + b, 0));
    const adjAmounts = adjustments.map(() => 0);
    let beforeDisc = 0;
    adjustments.forEach((adj, i) => {
      if (adj.adjustment_type === 'discount' && adj.base === 'before_tax') {
        adjAmounts[i] = adj.calculation_type === 'percentage' ? r2(baseNet * ((Number(adj.value) || 0) / 100)) : r2(adj.value || 0);
        beforeDisc += adjAmounts[i];
      }
    });
    beforeDisc = Math.min(r2(beforeDisc), baseNet);
    const shares = ownNets.map(n => (baseNet > 0 ? r2(beforeDisc * n / baseNet) : 0));
    const diff = r2(beforeDisc - shares.reduce((a, b) => a + b, 0));
    if (diff && shares.length) {
      const big = ownNets.indexOf(Math.max(...ownNets));
      shares[big] = r2(shares[big] + diff);
    }
    const lines = formData.lines.map((l, i) => calculateLineTotals(l, shares[i] || 0));
    const sum = (k) => r2(lines.reduce((a, t) => a + t[k], 0));
    const subtotal = sum('subtotal');
    const totalDiscount = r2(sum('discountAmount') + sum('share'));
    const totalTax = sum('taxAmount');
    const otherTaxes = sum('otherTaxes');
    const withheld = sum('withheld');
    const afterDiscount = r2(subtotal - totalDiscount);
    const gross = r2(afterDiscount + totalTax + otherTaxes - withheld);

    let totalInvoiceDiscount = 0;
    let totalInvoiceAddition = 0;
    adjustments.forEach((adj, i) => {
      if (adj.adjustment_type === 'discount' && adj.base === 'before_tax') return;
      const base = adj.base === 'before_tax' ? afterDiscount : gross;
      adjAmounts[i] = adj.calculation_type === 'percentage' ? r2(base * ((Number(adj.value) || 0) / 100)) : r2(adj.value || 0);
      if (adj.adjustment_type === 'discount') totalInvoiceDiscount += adjAmounts[i];
      else totalInvoiceAddition += adjAmounts[i];
    });
    const grandTotal = r2(gross - totalInvoiceDiscount + totalInvoiceAddition);
    return {
      lines, adjAmounts,
      subtotal,
      totalDiscount,
      beforeTaxDiscount: r2(beforeDisc),
      totalTax,
      otherTaxes,
      withheld,
      totalInvoiceDiscount: r2(totalInvoiceDiscount),
      totalInvoiceAddition: r2(totalInvoiceAddition),
      grandTotal
    };
  };

  const VAT_CATEGORY_OPTIONS = [
    { id: 'standard', ar: 'خاضع (السعر المكتوب)', en: 'Standard (rate typed)' },
    { id: 'export', ar: 'تصدير — صفر (V001)', en: 'Export — 0% (V001)' },
    { id: 'free_zone', ar: 'منطقة حرة — صفر (V002)', en: 'Free zone — 0% (V002)' },
    { id: 'exempt', ar: 'معفى (V003)', en: 'Exempt (V003)' },
    { id: 'non_taxable', ar: 'غير خاضع (V004)', en: 'Non-taxable (V004)' },
  ];
  const OTHER_TAX_OPTIONS = [
    { id: 'T2', sub: 'Tbl01', ar: 'ضريبة جدول نسبية % (T2) — داخل وعاء القيمة المضافة', en: 'Table tax % (T2) — in VAT base' },
    { id: 'T3', sub: 'Tbl02', ar: 'ضريبة جدول نوعية — مبلغ (T3) — داخل وعاء القيمة المضافة', en: 'Table tax fixed (T3) — in VAT base' },
    { id: 'T5', sub: 'ST01', ar: 'دمغة نسبية % (T5)', en: 'Stamp duty % (T5)' },
    { id: 'T6', sub: 'ST02', ar: 'دمغة نوعية — مبلغ (T6)', en: 'Stamp duty fixed (T6)' },
    { id: 'T4', sub: 'W001', ar: 'خصم من المنبع % (T4) — يُطرح', en: 'Withholding % (T4) — deducted' },
  ];

  const addLineTax = (index) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index
        ? { ...line, other_taxes: [...(line.other_taxes || []), { tax_type: 'T5', sub_type: 'ST01', rate: 0.4, amount: 0 }] }
        : line))
    }));
  };
  const updateLineTax = (index, ti, patch) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index
        ? { ...line, other_taxes: (line.other_taxes || []).map((t, k) => (k === ti ? { ...t, ...patch } : t)) }
        : line))
    }));
  };
  const removeLineTax = (index, ti) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index
        ? { ...line, other_taxes: (line.other_taxes || []).filter((_, k) => k !== ti) }
        : line))
    }));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Clock },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-blue-100 text-blue-800', icon: FileCheck },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      partially_paid: { color: 'bg-orange-100 text-orange-800', icon: DollarSign },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
      converted: { color: 'bg-purple-100 text-purple-800', icon: Send }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    const statusText = text[status?.replace('_', '')] || status;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {statusText}
      </Badge>
    );
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      sales_invoice: text.salesInvoices,
      purchase_invoice: text.purchaseInvoices,
      sales_quotation: text.quotations,
      purchase_order: text.purchaseOrders
    };
    return labels[type] || type;
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        invoice.document_number?.toLowerCase().includes(search) ||
        invoice.party_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const totals = calculateInvoiceTotals();

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{text.invoices}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {language === 'ar' ? 'إدارة الفواتير وعروض الأسعار وأوامر الشراء' : 'Manage invoices, quotations, and purchase orders'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setTypeFilter(val); }}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="sales_invoice" data-testid="tab-sales-invoice">
            {text.salesInvoices}
          </TabsTrigger>
          <TabsTrigger value="purchase_invoice" data-testid="tab-purchase-invoice">
            {text.purchaseInvoices}
          </TabsTrigger>
          <TabsTrigger value="sales_quotation" data-testid="tab-quotations">
            {text.quotations}
          </TabsTrigger>
          <TabsTrigger value="purchase_order" data-testid="tab-purchase-orders">
            {text.purchaseOrders}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalSales}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoices
                    .filter(i => i.document_type === 'sales_invoice' && i.status !== 'cancelled')
                    .reduce((sum, i) => sum + (i.grand_total || 0), 0)
                    .toLocaleString()} EGP
                </p>
              </div>
              <FileText className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalPurchases}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoices
                    .filter(i => i.document_type === 'purchase_invoice' && i.status !== 'cancelled')
                    .reduce((sum, i) => sum + (i.grand_total || 0), 0)
                    .toLocaleString()} EGP
                </p>
              </div>
              <FileText className="w-10 h-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.outstandingReceivables}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoices
                    .filter(i => i.document_type === 'sales_invoice' && i.amount_due > 0)
                    .reduce((sum, i) => sum + (i.amount_due || 0), 0)
                    .toLocaleString()} EGP
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.outstandingPayables}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invoices
                    .filter(i => i.document_type === 'purchase_invoice' && i.amount_due > 0)
                    .reduce((sum, i) => sum + (i.amount_due || 0), 0)
                    .toLocaleString()} EGP
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500`} />
            <Input
              placeholder={text.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={isRTL ? 'pr-10' : 'pl-10'}
              data-testid="search-input"
            />
          </div>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder={text.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.all}</SelectItem>
            <SelectItem value="draft">{text.draft}</SelectItem>
            <SelectItem value="approved">{text.approved}</SelectItem>
            <SelectItem value="paid">{text.paid}</SelectItem>
            <SelectItem value="partially_paid">{text.partiallyPaid}</SelectItem>
            <SelectItem value="cancelled">{text.cancelled}</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={() => { 
            setFormData(prev => ({ ...prev, document_type: activeTab }));
            fetchParties();
            setShowCreateModal(true); 
          }}
          className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
          data-testid="create-invoice-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === 'sales_quotation' ? text.createQuotation : 
           activeTab === 'purchase_order' ? text.createPO : text.createInvoice}
        </Button>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{text.invoiceNumber}</TableHead>
                <TableHead>{text.date}</TableHead>
                <TableHead>{activeTab.includes('purchase') ? text.supplier : text.customer}</TableHead>
                <TableHead>{text.vat14}</TableHead>
                <TableHead>{text.total}</TableHead>
                <TableHead>{text.amountDue}</TableHead>
                <TableHead>{text.status}</TableHead>
                <TableHead>{text.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B] mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {text.noInvoices}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">{invoice.document_number}</TableCell>
                    <TableCell>{invoice.document_date}</TableCell>
                    <TableCell>{invoice.party_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <Percent className="w-3 h-3" />
                        <span>{invoice.tax_amount?.toLocaleString() || '0'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.grand_total?.toLocaleString()} {invoice.currency}</TableCell>
                    <TableCell>{invoice.amount_due?.toLocaleString()} {invoice.currency}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(invoice.status)}
                        {['submitted', 'valid'].includes(String(invoice.eta_status || '').toLowerCase()) && (
                          <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1 w-fit">
                            <Building className="w-3 h-3" />
                            {text.etaSubmitted}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(invoice)} title={text.view}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {invoice.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleApproveInvoice(invoice.id)}
                            title={text.approve}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {['approved', 'partially_paid'].includes(invoice.status) &&
                         ['sales_invoice', 'purchase_invoice'].includes(invoice.document_type) &&
                         Number(invoice.amount_due) > 0 && (
                          <Button variant="ghost" size="icon" onClick={() => openPayment(invoice)}
                            title={isRTL ? 'تسجيل سداد' : 'Record payment'}
                            className="text-emerald-600 hover:text-emerald-700">
                            <DollarSign className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Debit note — a posted purchase invoice cannot be edited */}
                        {['approved', 'partially_paid', 'paid'].includes(invoice.status) &&
                         invoice.document_type === 'purchase_invoice' && (
                          <Button variant="ghost" size="icon" onClick={() => openDebitNote(invoice)}
                            title={isRTL ? 'إشعار مدين (مردود مشتريات)' : 'Debit note (purchase return)'}
                            className="text-amber-600 hover:text-amber-700">
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Credit note — returns / price corrections on a posted sales invoice */}
                        {['approved', 'partially_paid', 'paid'].includes(invoice.status) &&
                         invoice.document_type === 'sales_invoice' && (
                          <Button variant="ghost" size="icon" onClick={() => openCreditNote(invoice)}
                            title={isRTL ? 'إشعار دائن (مردود مبيعات)' : 'Credit note (sales return)'}
                            className="text-rose-600 hover:text-rose-700">
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Submit to ETA button - Only for approved sales invoices */}
                        {invoice.status === 'approved' && 
                         ['sales_invoice', 'credit_note'].includes(invoice.document_type) && 
                         !['submitted', 'valid'].includes(String(invoice.eta_status || '').toLowerCase()) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSubmitToETA(invoice.id)}
                            title={text.sendToETA}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Building className="w-4 h-4" />
                          </Button>
                        )}

                        {invoice.document_type === 'sales_quotation' && invoice.status !== 'converted' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConvertToInvoice(invoice.id)}
                            title={text.convertToInvoice}
                            className="text-purple-600 hover:text-purple-700"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(invoice.id)} title={text.downloadPDF}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.document_type === 'sales_quotation' ? text.createQuotation : 
               formData.document_type === 'purchase_order' ? text.createPO : text.createInvoice}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.date}</label>
                <Input
                  type="date"
                  value={formData.document_date}
                  onChange={(e) => changeInvoiceFx({ document_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.dueDate}</label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.paymentTerms}</label>
                <Select value={formData.payment_terms} onValueChange={(val) => setFormData(prev => ({ ...prev, payment_terms: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{text.cash}</SelectItem>
                    <SelectItem value="net_7">{text.net7}</SelectItem>
                    <SelectItem value="net_15">{text.net15}</SelectItem>
                    <SelectItem value="net_30">{text.net30}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Party Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  {activeTab.includes('purchase') ? text.supplier : text.customer}
                </label>
                <Select value={formData.party_id} onValueChange={(val) => setFormData(prev => ({ ...prev, party_id: val }))}>
                  <SelectTrigger><SelectValue placeholder={text.selectParty} /></SelectTrigger>
                  <SelectContent>
                    {parties.map(party => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name} {party.tax_id ? `(${party.tax_id})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  {language === 'ar' ? 'العملة' : 'Currency'}
                </label>
                <Select value={formData.currency} onValueChange={(val) => changeInvoiceFx({ currency: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.code} - {language === 'ar' ? curr.name_ar : curr.name_en} ({curr.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.currency !== 'EGP' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    {isRTL ? `سعر الصرف (ج.م لكل 1 ${formData.currency})` : `Exchange rate (EGP per 1 ${formData.currency})`}
                  </label>
                  <Input
                    type="number" step="0.0001" min="0"
                    value={formData.exchange_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, exchange_rate: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isRTL ? 'يُملأ تلقائياً بسعر تاريخ الفاتورة — القيد يُرحَّل بالجنيه بهذا السعر'
                           : 'Prefilled with the rate on the invoice date — the entry posts in EGP at this rate'}
                  </p>
                </div>
              )}
            </div>

            {costCenters.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    {language === 'ar' ? 'مركز التكلفة / الفرع' : 'Cost centre / branch'}
                  </label>
                  <select
                    className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                    value={formData.cost_center_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_center_id: e.target.value }))}
                  >
                    <option value="">{language === 'ar' ? '— بدون (الشركة كلها) —' : '— None (whole company) —'}</option>
                    {costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} — {language === 'ar' ? c.name_ar : (c.name_en || c.name_ar)}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Invoice Lines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">{text.description}</label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" />{text.addLine}
                </Button>
              </div>

              <div className="space-y-3">
                {formData.lines.map((line, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-gray-50">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className="text-xs text-gray-500">{text.description}</label>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder={text.description}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-gray-500">{text.quantity}</label>
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">{text.unitPrice}</label>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-gray-500">{text.discount}</label>
                        <Input
                          type="number"
                          value={line.discount_percent}
                          onChange={(e) => updateLine(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-gray-500">{text.taxRate}</label>
                        <Input
                          type="number"
                          value={line.tax_rate}
                          onChange={(e) => updateLine(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">{text.total}</label>
                        <div className="p-2 rounded text-sm font-medium bg-gray-100">
                          {(totals.lines[index] ? totals.lines[index].total : 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="col-span-1">
                        {formData.lines.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeLine(index)} className="text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* VAT category + other taxes (table / stamp / withholding) */}
                    <div className="mt-2 grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 md:col-span-4">
                        <label htmlFor={`vatcat-${index}`} className="text-xs text-gray-500">
                          {language === 'ar' ? 'فئة ضريبة القيمة المضافة' : 'VAT category'}
                        </label>
                        <select id={`vatcat-${index}`}
                          className="w-full p-2 border rounded-md text-sm bg-white"
                          value={line.vat_category || ''}
                          onChange={(e) => updateLine(index, 'vat_category', e.target.value)}>
                          <option value="">{language === 'ar' ? 'تلقائي — من بيانات العميل' : 'Auto — from the customer'}</option>
                          {VAT_CATEGORY_OPTIONS.map(o => <option key={o.id} value={o.id}>{language === 'ar' ? o.ar : o.en}</option>)}
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-8 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{language === 'ar' ? 'ضرائب أخرى على البند (جدول / دمغة)' : 'Other taxes on the line (table / stamp)'}</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => addLineTax(index)}>
                            <Plus className="w-3 h-3 mr-1" />{language === 'ar' ? 'إضافة ضريبة' : 'Add tax'}
                          </Button>
                        </div>
                        {(line.other_taxes || []).map((t, ti) => (
                          <div key={ti} className="flex flex-wrap items-center gap-2">
                            <select aria-label={language === 'ar' ? 'نوع الضريبة' : 'Tax type'}
                              className="flex-1 min-w-[12rem] p-2 border rounded-md text-sm bg-white"
                              value={t.tax_type}
                              onChange={(e) => {
                                const opt = OTHER_TAX_OPTIONS.find(o => o.id === e.target.value);
                                updateLineTax(index, ti, { tax_type: e.target.value, sub_type: opt ? opt.sub : null });
                              }}>
                              {OTHER_TAX_OPTIONS.map(o => <option key={o.id} value={o.id}>{language === 'ar' ? o.ar : o.en}</option>)}
                            </select>
                            {FIXED_TAXES.includes(t.tax_type) ? (
                              <Input type="number" step="0.01" min="0" className="w-28"
                                aria-label={language === 'ar' ? 'المبلغ' : 'Amount'}
                                value={t.amount} onChange={(e) => updateLineTax(index, ti, { amount: parseFloat(e.target.value) || 0 })} />
                            ) : (
                              <Input type="number" step="0.01" min="0" className="w-28"
                                aria-label={language === 'ar' ? 'النسبة %' : 'Rate %'}
                                value={t.rate} onChange={(e) => updateLineTax(index, ti, { rate: parseFloat(e.target.value) || 0 })} />
                            )}
                            <span className="text-xs text-gray-500">{FIXED_TAXES.includes(t.tax_type) ? formData.currency : '%'}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLineTax(index, ti)} className="text-red-500"
                              aria-label={language === 'ar' ? 'حذف الضريبة' : 'Remove tax'}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjustments Section - الخصومات والإضافات */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-700">{text.adjustments}</h3>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addAdjustment('discount')}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    {text.addDiscount}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addAdjustment('addition')}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {text.addAddition}
                  </Button>
                </div>
              </div>

              {formData.adjustments && formData.adjustments.length > 0 && (
                <div className="space-y-3">
                  {formData.adjustments.map((adj, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${adj.adjustment_type === 'discount' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
                    >
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">
                            {adj.adjustment_type === 'discount' ? text.addDiscount : text.addAddition}
                          </label>
                          <select
                            value={adj.category}
                            onChange={(e) => {
                              const category = e.target.value;
                              const categories = adj.adjustment_type === 'discount' 
                                ? text.discountCategories 
                                : text.additionCategories;
                              updateAdjustment(index, 'category', category);
                              updateAdjustment(index, 'name', categories[category] || category);
                            }}
                            className="w-full p-2 border rounded-md text-sm"
                          >
                            {adj.adjustment_type === 'discount' ? (
                              <>
                                <option value="contract_discount">{text.discountCategories.contract_discount}</option>
                                <option value="early_payment">{text.discountCategories.early_payment}</option>
                                <option value="volume_discount">{text.discountCategories.volume_discount}</option>
                                <option value="promotional">{text.discountCategories.promotional}</option>
                                <option value="custom">{text.discountCategories.custom}</option>
                              </>
                            ) : (
                              <>
                                <option value="shipping">{text.additionCategories.shipping}</option>
                                <option value="service_fee">{text.additionCategories.service_fee}</option>
                                <option value="table_tax">{text.additionCategories.table_tax}</option>
                                <option value="insurance">{text.additionCategories.insurance}</option>
                                <option value="handling">{text.additionCategories.handling}</option>
                                <option value="custom">{text.additionCategories.custom}</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">{text.calculationType}</label>
                          <select
                            value={adj.calculation_type}
                            onChange={(e) => updateAdjustment(index, 'calculation_type', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                          >
                            <option value="percentage">{text.percentage}</option>
                            <option value="fixed">{text.fixedAmount}</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">{text.adjustmentValue}</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={adj.value}
                            onChange={(e) => updateAdjustment(index, 'value', parseFloat(e.target.value) || 0)}
                            placeholder={adj.calculation_type === 'percentage' ? '1%' : '0.00'}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">{text.applyOn}</label>
                          <select
                            value={adj.base}
                            onChange={(e) => updateAdjustment(index, 'base', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                          >
                            <option value="before_tax">{text.beforeTax}</option>
                            <option value="after_tax">{text.afterTax}</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">{text.total}</label>
                          <div className={`p-2 rounded text-sm font-medium ${adj.adjustment_type === 'discount' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {adj.adjustment_type === 'discount' ? '-' : '+'}
                            {(totals.adjAmounts[index] || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeAdjustment(index)} 
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(!formData.adjustments || formData.adjustments.length === 0) && (
                <p className="text-center text-gray-400 text-sm py-4">
                  {language === 'ar' ? 'لا توجد خصومات أو إضافات' : 'No discounts or additions'}
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
              <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                <div className="text-gray-600 dark:text-gray-400">{text.subtotal}:</div>
                <div className="text-right font-medium">{totals.subtotal.toLocaleString()} {formData.currency}</div>
                
                <div className="text-gray-600 dark:text-gray-400">{text.discount} ({language === 'ar' ? 'الأسطر + الخصم قبل الضريبة' : 'Lines + before-tax discount'}):</div>
                <div className="text-right font-medium text-red-500">-{totals.totalDiscount.toLocaleString()} {formData.currency}</div>
                {totals.beforeTaxDiscount > 0 && (
                  <p className="col-span-2 text-xs text-gray-500">
                    {language === 'ar'
                      ? `منها خصم قبل الضريبة ${totals.beforeTaxDiscount.toLocaleString()} موزَّع على البنود — يُخفِّض ضريبة القيمة المضافة`
                      : `incl. a before-tax discount of ${totals.beforeTaxDiscount.toLocaleString()} spread over the lines — it lowers the VAT`}
                  </p>
                )}
                
                {/* VAT 14% Highlighted */}
                <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-orange-500" />
                  {text.vat14}:
                </div>
                <div className="text-right font-medium text-orange-600 dark:text-orange-400 flex items-center justify-end gap-1">
                  <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">14%</span>
                  {totals.totalTax.toLocaleString()} {formData.currency}
                </div>
                {totals.otherTaxes > 0 && (
                  <>
                    <div className="text-gray-600 dark:text-gray-400">{language === 'ar' ? 'ضريبة الجدول والدمغة:' : 'Table tax & stamp duty:'}</div>
                    <div className="text-right font-medium">{totals.otherTaxes.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                {totals.withheld > 0 && (
                  <>
                    <div className="text-gray-600 dark:text-gray-400">{language === 'ar' ? 'خصم من المنبع (T4):' : 'Withholding (T4):'}</div>
                    <div className="text-right font-medium text-red-500">-{totals.withheld.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                
                {totals.totalInvoiceDiscount > 0 && (
                  <>
                    <div className="text-gray-600 dark:text-gray-400">{text.totalDiscounts} ({language === 'ar' ? 'بعد الضريبة' : 'after tax'}):</div>
                    <div className="text-right font-medium text-red-500">-{totals.totalInvoiceDiscount.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                
                {totals.totalInvoiceAddition > 0 && (
                  <>
                    <div className="text-gray-600 dark:text-gray-400">{text.totalAdditions}:</div>
                    <div className="text-right font-medium text-green-600">+{totals.totalInvoiceAddition.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                
                <div className="text-lg font-bold text-gray-900 dark:text-white border-t border-gray-300 dark:border-gray-600 pt-2">{text.grandTotal}:</div>
                <div className="text-right text-lg font-bold text-[#28376B] dark:text-blue-400 border-t border-gray-300 dark:border-gray-600 pt-2">{totals.grandTotal.toLocaleString()} {formData.currency}</div>
                {formData.currency !== 'EGP' && Number(formData.exchange_rate) > 0 && (
                  <>
                    <div className="text-sm text-gray-500">{isRTL ? 'المعادل بالجنيه:' : 'EGP equivalent:'}</div>
                    <div className="text-right text-sm text-gray-600">{(Math.round(totals.grandTotal * Number(formData.exchange_rate) * 100) / 100).toLocaleString()} EGP</div>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.reference}</label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.notes}</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{text.cancel}</Button>
              <Button 
                onClick={handleCreateInvoice} 
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!formData.party_id || formData.lines.every(l => !l.description)}
              >
                {text.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debit note — correcting a posted purchase invoice */}
      {debitNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-gray-900">{isRTL ? 'إشعار مدين — مردود مشتريات' : 'Debit note — purchase return'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setDebitNote(null)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="font-bold text-gray-800">{debitNote.document_number} — {debitNote.party_name}</p>
                <p className="text-gray-600">{isRTL ? 'قيمة الفاتورة:' : 'Invoice:'} {Number(debitNote.grand_total || 0).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {[['items', isRTL ? 'مردود أصناف' : 'Returned items'], ['amount', isRTL ? 'خصم بمبلغ' : 'Discount']].map(([k, l]) => (
                  <button key={k} onClick={() => setDnMode(k)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${dnMode === k ? 'bg-amber-600 text-white' : 'border border-gray-300 text-gray-700'}`}>{l}</button>
                ))}
              </div>
              {dnMode === 'items' ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{isRTL ? 'الكمية المرتجعة لا تتجاوز كمية الفاتورة، وتخرج من المخزون.' : 'Returned quantities leave stock.'}</p>
                  {dnForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 border border-gray-200 rounded-lg p-2">
                      <span className="flex-1 truncate">{it.description}
                        <span className="text-xs text-gray-400"> ({isRTL ? 'بالفاتورة' : 'on invoice'} {it.max})</span></span>
                      <Input type="number" min="0" max={it.max} step="any" value={it.quantity} dir="ltr"
                        aria-label={it.description}
                        onChange={(e) => setDnForm((f) => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, quantity: Math.min(Number(e.target.value) || 0, x.max) } : x) }))}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg tabular-nums" />
                      <span className="text-xs text-gray-500 w-20 text-left tabular-nums">{((Number(it.quantity) || 0) * it.unit_price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <label className="block"><span className="text-gray-600">{isRTL ? 'مبلغ الإشعار (شامل الضريبة)' : 'Amount (incl. VAT)'}</span>
                  <Input type="number" min="0" step="0.01" dir="ltr" value={dnForm.amount}
                    onChange={(e) => setDnForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg tabular-nums" /></label>
              )}
              <label className="block"><span className="text-gray-600">{isRTL ? 'السبب' : 'Reason'}</span>
                <input value={dnForm.reason} onChange={(e) => setDnForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder={isRTL ? 'تالف، خطأ في الصنف، خصم…' : 'Damaged, wrong item, discount…'}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" /></label>
              <p className="text-xs text-gray-500">
                {isRTL ? 'يُرحَّل فوراً: يقلّل رصيد المورد والمشتريات وضريبة المدخلات، وتخرج البضاعة من المخزون.'
                        : 'Posted immediately: reduces the supplier balance, purchases and input VAT; goods leave stock.'}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <Button variant="outline" onClick={() => setDebitNote(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={submitDebitNote} disabled={dnBusy} className="bg-amber-600 hover:bg-amber-700 text-white">
                {dnBusy ? (isRTL ? 'جارٍ الإصدار…' : 'Issuing…') : (isRTL ? 'إصدار الإشعار' : 'Issue note')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Credit note — sales return with a disposition per line */}
      {creditNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-gray-900">{isRTL ? 'إشعار دائن — مردود مبيعات' : 'Credit note — sales return'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCreditNote(null)} aria-label={isRTL ? 'إغلاق' : 'Close'}><X className="w-5 h-5" /></Button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="bg-rose-50 rounded-xl p-3 space-y-1">
                <p className="font-bold text-gray-800">{creditNote.document_number} — {creditNote.party_name}</p>
                <p className="text-gray-600">{isRTL ? 'المتبقي القابل للرد:' : 'Remaining creditable:'} {Number(cnCtx?.invoice?.remaining ?? creditNote.grand_total ?? 0).toLocaleString()} {creditNote.currency}</p>
              </div>
              {cnCtx?.eta && (
                <div className={`rounded-xl p-3 text-xs flex items-start gap-2 ${cnCtx.eta.can_submit_note ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  <Building className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {isRTL ? 'الربط بالمنظومة: ' : 'ETA link: '}
                      {cnCtx.eta.eta_status || (isRTL ? 'غير مُرسلة' : 'not submitted')}
                      {cnCtx.eta.eta_uuid && <span className="font-mono" dir="ltr"> · {cnCtx.eta.eta_uuid}</span>}
                    </p>
                    <p>{cnCtx.eta.message}</p>
                  </div>
                </div>
              )}
              {!cnCtx ? (
                <p className="text-gray-500">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {[['items', isRTL ? 'مردود أصناف' : 'Returned items'], ['amount', isRTL ? 'خصم بمبلغ' : 'Price correction']].map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setCnMode(k)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold ${cnMode === k ? 'bg-rose-600 text-white' : 'border border-gray-300 text-gray-700'}`}>{l}</button>
                    ))}
                  </div>
                  {cnMode === 'items' ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        {isRTL ? 'لكل بند: الكمية المرتجعة ومصيرها — إرجاع لمخزن البيع بتكلفته الأصلية، أو حجر للفحص (لا يُباع حتى الإفراج)، أو إعدام (تُحمَّل تكلفته على التالف والهدر).'
                               : 'Per line: quantity and disposition — restock at original cost, quarantine for inspection (not sellable until released), or scrap (cost to waste & spoilage).'}
                      </p>
                      {cnForm.items.map((it, idx) => {
                        const sellable = (cnCtx.warehouses || []).filter((w) => w.warehouse_type === 'main');
                        const held = (cnCtx.warehouses || []).filter((w) => w.warehouse_type === 'quarantine');
                        return (
                          <div key={it.line_number} className="border border-gray-200 rounded-lg p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 truncate">{it.description}
                                <span className="text-xs text-gray-400"> ({isRTL ? 'المتاح للرد' : 'returnable'} {it.returnable} / {it.quantity_original})</span></span>
                              <Input type="number" min="0" max={it.returnable} step="any" value={it.quantity} dir="ltr"
                                aria-label={isRTL ? `الكمية المرتجعة — ${it.description}` : `Returned quantity — ${it.description}`}
                                disabled={!(it.returnable > 0)}
                                onChange={(e) => setCnItem(idx, { quantity: Math.max(0, Math.min(Number(e.target.value) || 0, it.returnable)) })}
                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg tabular-nums" />
                              <span className="text-xs text-gray-500 w-20 text-left tabular-nums">{((Number(it.quantity) || 0) * Number(it.unit_price || 0)).toLocaleString()}</span>
                            </div>
                            {it.product_id && Number(it.quantity) > 0 && (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {[['restock', isRTL ? 'إرجاع للمخزون' : 'Restock'], ['quarantine', isRTL ? 'حجر/فحص' : 'Quarantine'], ['scrap', isRTL ? 'إعدام' : 'Scrap']].map(([k, l]) => (
                                  <label key={k} className={`px-2 py-1 rounded-lg border cursor-pointer ${it.disposition === k ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-300 text-gray-600'}`}>
                                    <input type="radio" className="sr-only" name={`disp-${it.line_number}`} checked={it.disposition === k}
                                      onChange={() => setCnItem(idx, { disposition: k })} />{l}
                                  </label>
                                ))}
                                {it.disposition === 'restock' && (
                                  <select value={it.warehouse_id} onChange={(e) => setCnItem(idx, { warehouse_id: e.target.value })}
                                    aria-label={isRTL ? 'مخزن الإرجاع' : 'Restock warehouse'}
                                    className="px-2 py-1 border border-gray-300 rounded-lg">
                                    <option value="">{isRTL ? 'المخزن الرئيسي' : 'Main warehouse'}</option>
                                    {sellable.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                  </select>
                                )}
                                {it.disposition === 'quarantine' && (held.length ? (
                                  <select value={it.quarantine_id} onChange={(e) => setCnItem(idx, { quarantine_id: e.target.value })}
                                    aria-label={isRTL ? 'مخزن الحجر' : 'Quarantine warehouse'}
                                    className="px-2 py-1 border border-gray-300 rounded-lg">
                                    {held.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                  </select>
                                ) : (
                                  <span className="text-amber-700">{isRTL ? 'أنشئ مخزناً من نوع «حجر/فحص» أولاً' : 'Create a quarantine warehouse first'}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <label className="block"><span className="text-gray-600">{isRTL ? 'مبلغ الإشعار (شامل الضريبة)' : 'Amount (incl. VAT)'}</span>
                      <Input type="number" min="0" step="0.01" dir="ltr" value={cnForm.amount}
                        onChange={(e) => setCnForm((f) => ({ ...f, amount: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg tabular-nums" /></label>
                  )}
                  <label className="block"><span className="text-gray-600">{isRTL ? 'السبب (مطلوب)' : 'Reason (required)'}</span>
                    <input value={cnForm.reason} onChange={(e) => setCnForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder={isRTL ? 'مرتجع عميل، عيب صناعة، خطأ في السعر…' : 'Customer return, defect, price error…'}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" /></label>
                  <p className="text-xs text-gray-500">
                    {isRTL ? 'يُرحَّل فوراً: يعكس المبيعات وضريبة المخرجات ويخفّض رصيد العميل. الضريبة بنفس نسب الفاتورة الأصلية.'
                           : 'Posted immediately: reverses sales and output VAT and reduces the customer balance, at the original rates.'}
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <Button variant="outline" onClick={() => setCreditNote(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={submitCreditNote} disabled={cnBusy || !cnCtx || !cnCtx.can_issue} className="bg-rose-600 hover:bg-rose-700 text-white">
                {cnBusy ? (isRTL ? 'جارٍ الإصدار…' : 'Issuing…') : (isRTL ? 'إصدار الإشعار' : 'Issue note')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{getDocumentTypeLabel(selectedInvoice.document_type)} - {selectedInvoice.document_number}</span>
                  {getStatusBadge(selectedInvoice.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{text.date}</p>
                    <p className="font-medium">{selectedInvoice.document_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {selectedInvoice.document_type?.includes('purchase') ? text.supplier : text.customer}
                    </p>
                    <p className="font-medium">{selectedInvoice.party_name}</p>
                  </div>
                </div>

                {/* Lines Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{text.description}</TableHead>
                      <TableHead>{text.quantity}</TableHead>
                      <TableHead>{text.unitPrice}</TableHead>
                      <TableHead>{text.tax}</TableHead>
                      <TableHead>{text.total}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lines?.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>{line.unit_price?.toLocaleString()}</TableCell>
                        <TableCell>{line.tax_amount?.toLocaleString()}</TableCell>
                        <TableCell>{line.total?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="p-4 rounded-lg bg-gray-100">
                  <div className="grid grid-cols-2 gap-2 max-w-xs ml-auto">
                    <div className="text-gray-600">{text.subtotal}:</div>
                    <div className="text-right">{selectedInvoice.subtotal?.toLocaleString()} EGP</div>
                    
                    <div className="text-gray-600">{text.discount}:</div>
                    <div className="text-right text-red-500">-{selectedInvoice.total_discount?.toLocaleString()} EGP</div>
                    
                    <div className="text-gray-600">{text.tax}:</div>
                    <div className="text-right">{selectedInvoice.total_tax?.toLocaleString()} EGP</div>
                    
                    <div className="font-bold">{text.grandTotal}:</div>
                    <div className="text-right font-bold text-[#28376B]">{selectedInvoice.grand_total?.toLocaleString()} EGP</div>
                    
                    <div className="text-gray-600">{text.amountDue}:</div>
                    <div className={`text-right font-medium ${selectedInvoice.amount_due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {selectedInvoice.amount_due?.toLocaleString()} EGP
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {selectedInvoice.qr_code && (
                  <div className="flex justify-center">
                    <img src={`data:image/png;base64,${selectedInvoice.qr_code}`} alt="QR Code" className="w-32 h-32" />
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => handleDownloadPDF(selectedInvoice.id)}>
                    <Download className="w-4 h-4 mr-2" />{text.downloadPDF}
                  </Button>
                  {selectedInvoice.status === 'draft' && (
                    <Button 
                      onClick={() => { handleApproveInvoice(selectedInvoice.id); setSelectedInvoice(null); }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />{text.approve}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(open) => { if (!open) setPayInvoice(null); }}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تسجيل سداد' : 'Record payment'}</DialogTitle>
          </DialogHeader>
          {payInvoice && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-bold text-gray-800">{payInvoice.document_number} — {payInvoice.party_name}</p>
                <p className="text-gray-600">
                  {isRTL ? 'المستحق:' : 'Due:'} {Number(payInvoice.amount_due || 0).toLocaleString()} {payInvoice.currency}
                  {payInvoice.currency !== 'EGP' && ` — ${isRTL ? 'سعر الفاتورة' : 'invoice rate'} ${payInvoice.exchange_rate}`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  {isRTL ? `المبلغ (${payInvoice.currency})` : `Amount (${payInvoice.currency})`}
                </label>
                <Input type="number" step="0.01" min="0" value={payForm.amount}
                  onChange={(e) => setPayForm(prev => ({ ...prev, amount: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="pay-cash-discount" className="block text-sm font-medium mb-1 text-gray-700">
                  {payInvoice.document_type === 'purchase_invoice'
                    ? (isRTL ? `خصم نقدي مكتسب — تعجيل دفع (${payInvoice.currency})` : `Cash discount received (${payInvoice.currency})`)
                    : (isRTL ? `خصم نقدي مسموح به — تعجيل دفع (${payInvoice.currency})` : `Cash discount allowed (${payInvoice.currency})`)}
                </label>
                <Input id="pay-cash-discount" type="number" step="0.01" min="0" value={payForm.discount_amount}
                  onChange={(e) => {
                    const disc = e.target.value;
                    setPayForm(prev => ({ ...prev, discount_amount: disc,
                      amount: String(Math.max(Math.round((Number(payInvoice.amount_due || 0) - (Number(disc) || 0)) * 100) / 100, 0)) }));
                  }} />
                <p className="text-xs text-gray-500 mt-1">
                  {isRTL ? 'يُسوّي رصيد الفاتورة دون تحصيل ويُرحَّل لحساب الخصم النقدي — لا يغيّر ضريبة القيمة المضافة. المبلغ + الخصم ≤ المستحق.'
                         : 'Settles part of the balance without cash and posts to the cash-discount account — VAT is not changed. Amount + discount ≤ due.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">{text.date}</label>
                  <Input type="date" value={payForm.payment_date} onChange={(e) => changePaymentDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">{isRTL ? 'طريقة السداد' : 'Method'}</label>
                  <select className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm(prev => ({ ...prev, payment_method: e.target.value }))}>
                    <option value="bank_transfer">{isRTL ? 'تحويل بنكي' : 'Bank transfer'}</option>
                    <option value="cash">{isRTL ? 'نقدي' : 'Cash'}</option>
                    <option value="check">{isRTL ? 'شيك' : 'Cheque'}</option>
                    <option value="credit_card">{isRTL ? 'بطاقة' : 'Card'}</option>
                    <option value="mobile_wallet">{isRTL ? 'محفظة' : 'Wallet'}</option>
                  </select>
                </div>
              </div>
              {payInvoice.currency && payInvoice.currency !== 'EGP' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    {isRTL ? `سعر الصرف يوم السداد (ج.م لكل 1 ${payInvoice.currency})` : `Payment rate (EGP per 1 ${payInvoice.currency})`}
                  </label>
                  <Input type="number" step="0.0001" min="0" value={payForm.exchange_rate}
                    onChange={(e) => setPayForm(prev => ({ ...prev, exchange_rate: e.target.value }))} />
                  {Number(payForm.exchange_rate) > 0 && Number(payForm.amount) > 0 && (() => {
                    const cash = Math.round(Number(payForm.amount) * Number(payForm.exchange_rate) * 100) / 100;
                    const book = Math.round(Number(payForm.amount) * Number(payInvoice.exchange_rate || 1) * 100) / 100;
                    const diff = Math.round((cash - book) * 100) / 100;
                    const gain = payInvoice.document_type === 'sales_invoice' ? diff > 0 : diff < 0;
                    return (
                      <p className="text-xs text-gray-500 mt-1">
                        {isRTL ? 'بالجنيه:' : 'In EGP:'} {cash.toLocaleString()}
                        {diff !== 0 && ` — ${isRTL ? (gain ? 'ربح' : 'خسارة') : (gain ? 'gain' : 'loss')} ${isRTL ? 'فرق عملة تقريبي' : 'approx. FX'} ${Math.abs(diff).toLocaleString()}`}
                      </p>
                    );
                  })()}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.reference}</label>
                <Input value={payForm.reference} onChange={(e) => setPayForm(prev => ({ ...prev, reference: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleRecordPayment} disabled={payBusy} className="flex-1 bg-[#28376B] hover:bg-[#1e2a52] text-white">
                  {payBusy ? '…' : (isRTL ? 'تأكيد السداد' : 'Confirm payment')}
                </Button>
                <Button variant="outline" onClick={() => setPayInvoice(null)}>{text.cancel}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesPage;
