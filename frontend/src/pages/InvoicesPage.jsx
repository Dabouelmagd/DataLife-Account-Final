import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import ModernSidebar from '../components/ModernSidebar';
import AppFooter from '../components/AppFooter';
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, Search, Filter, FileText, Download, Eye, Trash2, Edit,
  CheckCircle, Clock, XCircle, DollarSign, FileCheck, Send
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const InvoicesPage = () => {
  const { language, translations } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('sales_invoice');

  // Form state for new invoice
  const [formData, setFormData] = useState({
    document_type: 'sales_invoice',
    document_date: new Date().toISOString().split('T')[0],
    due_date: '',
    party_id: '',
    currency: 'EGP',
    payment_terms: 'cash',
    lines: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount_percent: 0 }],
    notes: '',
    reference: ''
  });

  const t = {
    ar: {
      invoices: 'الفواتير',
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
      edit: 'تعديل',
      delete: 'حذف',
      approve: 'اعتماد',
      print: 'طباعة',
      downloadPDF: 'تحميل PDF',
      convertToInvoice: 'تحويل لفاتورة',
      noInvoices: 'لا توجد فواتير',
      partyName: 'اسم العميل/المورد',
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
      recordPayment: 'تسجيل سداد',
      invoiceCreated: 'تم إنشاء الفاتورة بنجاح',
      invoiceApproved: 'تم اعتماد الفاتورة بنجاح',
      error: 'حدث خطأ',
      customers: 'العملاء',
      suppliers: 'الموردين',
      products: 'المنتجات',
      createCustomer: 'إضافة عميل',
      createSupplier: 'إضافة مورد',
      createProduct: 'إضافة منتج',
      name: 'الاسم',
      taxId: 'الرقم الضريبي',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      address: 'العنوان',
      code: 'الكود',
      price: 'السعر',
      unit: 'الوحدة'
    },
    en: {
      invoices: 'Invoices',
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
      edit: 'Edit',
      delete: 'Delete',
      approve: 'Approve',
      print: 'Print',
      downloadPDF: 'Download PDF',
      convertToInvoice: 'Convert to Invoice',
      noInvoices: 'No invoices found',
      partyName: 'Customer/Supplier Name',
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
      recordPayment: 'Record Payment',
      invoiceCreated: 'Invoice created successfully',
      invoiceApproved: 'Invoice approved successfully',
      error: 'An error occurred',
      customers: 'Customers',
      suppliers: 'Suppliers',
      products: 'Products',
      createCustomer: 'Add Customer',
      createSupplier: 'Add Supplier',
      createProduct: 'Add Product',
      name: 'Name',
      taxId: 'Tax ID',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      code: 'Code',
      price: 'Price',
      unit: 'Unit'
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
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, text.error]);

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

  const fetchProducts = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchParties();
    fetchProducts();
  }, [fetchInvoices, fetchParties, fetchProducts]);

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
          }))
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
      const response = await fetch(`${API}/invoices/${invoiceId}/approve`, {
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
      const response = await fetch(`${API}/invoices/${invoiceId}/pdf`, {
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
      const response = await fetch(`${API}/invoices/${quotationId}/convert-to-invoice`, {
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

  const calculateLineTotals = (line) => {
    const subtotal = line.quantity * line.unit_price;
    const discountAmount = subtotal * (line.discount_percent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (line.tax_rate / 100);
    const total = afterDiscount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
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

    const grandTotal = subtotal - totalDiscount + totalTax;
    return { subtotal, totalDiscount, totalTax, grandTotal };
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
      approved: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icon: FileCheck },
      paid: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
      partially_paid: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', icon: DollarSign },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: XCircle },
      converted: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300', icon: Send }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    const statusText = text[status.replace('_', '')] || status;

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
    <div className={`flex min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <ModernSidebar />
      
      <div className="flex-1 flex flex-col">
        <main className={`flex-1 p-6 ${isRTL ? 'mr-64' : 'ml-64'}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {text.invoices}
            </h1>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setTypeFilter(val); }} className="mb-6">
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.totalSales}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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

              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.totalPurchases}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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

              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.outstandingReceivables}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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

              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.outstandingPayables}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
            <div className="flex flex-wrap gap-4 mt-6 mb-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <Input
                    placeholder={text.search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${isRTL ? 'pr-10' : 'pl-10'} ${isDark ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
                    data-testid="search-input"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={`w-[150px] ${isDark ? 'bg-gray-800 border-gray-700 text-white' : ''}`} data-testid="status-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={text.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{text.all}</SelectItem>
                  <SelectItem value="draft">{text.draft}</SelectItem>
                  <SelectItem value="pending">{text.pending}</SelectItem>
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
            <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? 'border-gray-700' : ''}>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.invoiceNumber}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.date}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>
                        {activeTab.includes('purchase') ? text.supplier : text.customer}
                      </TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.total}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.amountDue}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.status}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.actions}</TableHead>
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
                        <TableCell colSpan={7} className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {text.noInvoices}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id} className={isDark ? 'border-gray-700 hover:bg-gray-750' : 'hover:bg-gray-50'}>
                          <TableCell className={`font-medium ${isDark ? 'text-white' : ''}`}>
                            {invoice.document_number}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {invoice.document_date}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {invoice.party_name}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {invoice.grand_total?.toLocaleString()} {invoice.currency}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {invoice.amount_due?.toLocaleString()} {invoice.currency}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedInvoice(invoice)}
                                title={text.view}
                                data-testid={`view-invoice-${invoice.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              {invoice.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApproveInvoice(invoice.id)}
                                  title={text.approve}
                                  className="text-green-600 hover:text-green-700"
                                  data-testid={`approve-invoice-${invoice.id}`}
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
                                  data-testid={`convert-invoice-${invoice.id}`}
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadPDF(invoice.id)}
                                title={text.downloadPDF}
                                data-testid={`download-pdf-${invoice.id}`}
                              >
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
          </Tabs>
        </main>

        <AppFooter />
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 text-white' : ''}`}>
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
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.date}
                </label>
                <Input
                  type="date"
                  value={formData.document_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, document_date: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="invoice-date"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.dueDate}
                </label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="invoice-due-date"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.paymentTerms}
                </label>
                <Select 
                  value={formData.payment_terms} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, payment_terms: val }))}
                >
                  <SelectTrigger className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''} data-testid="payment-terms">
                    <SelectValue />
                  </SelectTrigger>
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
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {activeTab.includes('purchase') ? text.supplier : text.customer}
              </label>
              <Select 
                value={formData.party_id} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, party_id: val }))}
              >
                <SelectTrigger className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''} data-testid="party-select">
                  <SelectValue placeholder={text.selectParty} />
                </SelectTrigger>
                <SelectContent>
                  {parties.map(party => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.name} {party.tax_id ? `(${party.tax_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Lines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.description}
                </label>
                <Button variant="outline" size="sm" onClick={addLine} data-testid="add-line-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  {text.addLine}
                </Button>
              </div>

              <div className="space-y-3">
                {formData.lines.map((line, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.description}</label>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          className={`text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                          placeholder={text.description}
                          data-testid={`line-description-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.quantity}</label>
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className={`text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                          data-testid={`line-quantity-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.unitPrice}</label>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className={`text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                          data-testid={`line-price-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.discount}</label>
                        <Input
                          type="number"
                          value={line.discount_percent}
                          onChange={(e) => updateLine(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                          className={`text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                          data-testid={`line-discount-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.taxRate}</label>
                        <Input
                          type="number"
                          value={line.tax_rate}
                          onChange={(e) => updateLine(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                          className={`text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                          data-testid={`line-tax-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.total}</label>
                        <div className={`p-2 rounded text-sm font-medium ${isDark ? 'bg-gray-600 text-white' : 'bg-gray-100'}`}>
                          {calculateLineTotals(line).total.toLocaleString()}
                        </div>
                      </div>
                      <div className="col-span-1">
                        {formData.lines.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            className="text-red-500 hover:text-red-700"
                            data-testid={`remove-line-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="grid grid-cols-2 gap-4 max-w-sm ml-auto">
                <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.subtotal}:</div>
                <div className={`text-right font-medium ${isDark ? 'text-white' : ''}`}>
                  {totals.subtotal.toLocaleString()} EGP
                </div>
                
                <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.discount}:</div>
                <div className={`text-right font-medium text-red-500`}>
                  -{totals.totalDiscount.toLocaleString()} EGP
                </div>
                
                <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.tax} (VAT):</div>
                <div className={`text-right font-medium ${isDark ? 'text-white' : ''}`}>
                  {totals.totalTax.toLocaleString()} EGP
                </div>
                
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{text.grandTotal}:</div>
                <div className={`text-right text-lg font-bold text-[#28376B] ${isDark ? 'text-blue-400' : ''}`}>
                  {totals.grandTotal.toLocaleString()} EGP
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.reference}
                </label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="invoice-reference"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.notes}
                </label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="invoice-notes"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} data-testid="cancel-btn">
                {text.cancel}
              </Button>
              <Button 
                onClick={handleCreateInvoice} 
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!formData.party_id || formData.lines.every(l => !l.description)}
                data-testid="save-invoice-btn"
              >
                {text.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className={`max-w-3xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 text-white' : ''}`}>
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
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{text.date}</p>
                    <p className={`font-medium ${isDark ? 'text-white' : ''}`}>{selectedInvoice.document_date}</p>
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedInvoice.document_type?.includes('purchase') ? text.supplier : text.customer}
                    </p>
                    <p className={`font-medium ${isDark ? 'text-white' : ''}`}>{selectedInvoice.party_name}</p>
                  </div>
                </div>

                {/* Lines Table */}
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? 'border-gray-700' : ''}>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>#</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.description}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.quantity}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.unitPrice}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.tax}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.total}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lines?.map((line, i) => (
                      <TableRow key={i} className={isDark ? 'border-gray-700' : ''}>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>{i + 1}</TableCell>
                        <TableCell className={isDark ? 'text-white' : ''}>{line.description}</TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>{line.quantity}</TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>{line.unit_price?.toLocaleString()}</TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>{line.tax_amount?.toLocaleString()}</TableCell>
                        <TableCell className={isDark ? 'text-white' : ''}>{line.total?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="grid grid-cols-2 gap-2 max-w-xs ml-auto">
                    <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.subtotal}:</div>
                    <div className={`text-right ${isDark ? 'text-white' : ''}`}>{selectedInvoice.subtotal?.toLocaleString()} EGP</div>
                    
                    <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.discount}:</div>
                    <div className="text-right text-red-500">-{selectedInvoice.total_discount?.toLocaleString()} EGP</div>
                    
                    <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.tax}:</div>
                    <div className={`text-right ${isDark ? 'text-white' : ''}`}>{selectedInvoice.total_tax?.toLocaleString()} EGP</div>
                    
                    <div className={`font-bold ${isDark ? 'text-white' : ''}`}>{text.grandTotal}:</div>
                    <div className="text-right font-bold text-[#28376B]">{selectedInvoice.grand_total?.toLocaleString()} EGP</div>
                    
                    <div className={isDark ? 'text-gray-300' : 'text-gray-600'}>{text.amountDue}:</div>
                    <div className={`text-right font-medium ${selectedInvoice.amount_due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {selectedInvoice.amount_due?.toLocaleString()} EGP
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {selectedInvoice.qr_code && (
                  <div className="flex justify-center">
                    <img 
                      src={`data:image/png;base64,${selectedInvoice.qr_code}`} 
                      alt="QR Code" 
                      className="w-32 h-32"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => handleDownloadPDF(selectedInvoice.id)}>
                    <Download className="w-4 h-4 mr-2" />
                    {text.downloadPDF}
                  </Button>
                  {selectedInvoice.status === 'draft' && (
                    <Button 
                      onClick={() => { handleApproveInvoice(selectedInvoice.id); setSelectedInvoice(null); }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {text.approve}
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
