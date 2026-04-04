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
  CheckCircle, Clock, XCircle, DollarSign, FileCheck, Send, Trash2, Minus
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

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
  const [currencies, setCurrencies] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState('EGP');
  const [adjustmentCategories, setAdjustmentCategories] = useState(null);

  const [formData, setFormData] = useState({
    document_type: 'sales_invoice',
    document_date: new Date().toISOString().split('T')[0],
    due_date: '',
    party_id: '',
    currency: 'EGP',
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
      beforeTax: 'قبل الضريبة',
      afterTax: 'بعد الضريبة',
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
      totalAdditions: 'إجمالي الإضافات'
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
      beforeTax: 'Before Tax',
      afterTax: 'After Tax',
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
      totalAdditions: 'Total Additions'
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
          lines: formData.lines.map(line => ({
            ...line,
            tax_type: 'vat'
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

  const resetForm = () => {
    setFormData({
      document_type: activeTab,
      document_date: new Date().toISOString().split('T')[0],
      due_date: '',
      party_id: '',
      currency: 'EGP',
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

  const calculateLineTotals = (line) => {
    const subtotal = line.quantity * line.unit_price;
    const discountAmount = subtotal * (line.discount_percent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (line.tax_rate / 100);
    const total = afterDiscount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const calculateAdjustmentAmount = (adj, baseBeforeTax, baseAfterTax) => {
    const baseAmount = adj.base === 'before_tax' ? baseBeforeTax : baseAfterTax;
    if (adj.calculation_type === 'percentage') {
      return baseAmount * (adj.value / 100);
    }
    return adj.value;
  };

  const calculateInvoiceTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    formData.lines.forEach(line => {
      const lineTotals = calculateLineTotals(line);
      subtotal += lineTotals.subtotal;
      totalDiscount += lineTotals.discountAmount;
      totalTax += lineTotals.taxAmount;
    });

    const afterLineDiscount = subtotal - totalDiscount;
    const afterTax = afterLineDiscount + totalTax;

    // حساب خصومات وإضافات الفاتورة
    let totalInvoiceDiscount = 0;
    let totalInvoiceAddition = 0;

    (formData.adjustments || []).forEach(adj => {
      const amount = calculateAdjustmentAmount(adj, afterLineDiscount, afterTax);
      if (adj.adjustment_type === 'discount') {
        totalInvoiceDiscount += amount;
      } else {
        totalInvoiceAddition += amount;
      }
    });

    const grandTotal = afterTax - totalInvoiceDiscount + totalInvoiceAddition;
    return { 
      subtotal, 
      totalDiscount, 
      totalTax, 
      totalInvoiceDiscount, 
      totalInvoiceAddition,
      grandTotal 
    };
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
                <TableHead>{text.total}</TableHead>
                <TableHead>{text.amountDue}</TableHead>
                <TableHead>{text.status}</TableHead>
                <TableHead>{text.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B] mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {text.noInvoices}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{invoice.document_number}</TableCell>
                    <TableCell>{invoice.document_date}</TableCell>
                    <TableCell>{invoice.party_name}</TableCell>
                    <TableCell>{invoice.grand_total?.toLocaleString()} {invoice.currency}</TableCell>
                    <TableCell>{invoice.amount_due?.toLocaleString()} {invoice.currency}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, document_date: e.target.value }))}
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
                <Select value={formData.currency} onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}>
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
            </div>

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
                          {calculateLineTotals(line).total.toLocaleString()}
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
                            {calculateAdjustmentAmount(
                              adj, 
                              totals.subtotal - totals.totalDiscount, 
                              totals.subtotal - totals.totalDiscount + totals.totalTax
                            ).toLocaleString()}
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
            <div className="p-4 rounded-lg bg-gray-100">
              <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                <div className="text-gray-600">{text.subtotal}:</div>
                <div className="text-right font-medium">{totals.subtotal.toLocaleString()} {formData.currency}</div>
                
                <div className="text-gray-600">{text.discount} ({language === 'ar' ? 'الأسطر' : 'Lines'}):</div>
                <div className="text-right font-medium text-red-500">-{totals.totalDiscount.toLocaleString()} {formData.currency}</div>
                
                <div className="text-gray-600">{text.tax} (VAT):</div>
                <div className="text-right font-medium">{totals.totalTax.toLocaleString()} {formData.currency}</div>
                
                {totals.totalInvoiceDiscount > 0 && (
                  <>
                    <div className="text-gray-600">{text.totalDiscounts}:</div>
                    <div className="text-right font-medium text-red-500">-{totals.totalInvoiceDiscount.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                
                {totals.totalInvoiceAddition > 0 && (
                  <>
                    <div className="text-gray-600">{text.totalAdditions}:</div>
                    <div className="text-right font-medium text-green-600">+{totals.totalInvoiceAddition.toLocaleString()} {formData.currency}</div>
                  </>
                )}
                
                <div className="text-lg font-bold text-gray-900 border-t pt-2">{text.grandTotal}:</div>
                <div className="text-right text-lg font-bold text-[#28376B] border-t pt-2">{totals.grandTotal.toLocaleString()} {formData.currency}</div>
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
    </div>
  );
};

export default InvoicesPage;
