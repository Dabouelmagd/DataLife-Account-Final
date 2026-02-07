import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { 
  FileText, Plus, Send, DollarSign, Eye, Edit, Trash2, 
  Download, Mail, CheckCircle, Clock, XCircle, AlertCircle,
  Building2, User, Phone, MapPin, Calculator, Receipt,
  FileCheck, Upload, Search, Filter, RefreshCw, Wifi, WifiOff,
  Printer, FileDown, File
} from 'lucide-react';
import AttachmentsManager from './AttachmentsManager';
import useRealTimeSync from '../hooks/useRealTimeSync';

const InvoicesModule = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [etaxStats, setEtaxStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state for new invoice
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    customer_tax_id: '',
    issuer_tax_id: '',
    invoice_type: 'regular',
    notes: '',
    due_date: '',
    currency: 'EGP',
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount: 0 }]
  });

  const t = {
    invoices: isRTL ? 'الفواتير' : 'Invoices',
    createInvoice: isRTL ? 'إنشاء فاتورة' : 'Create Invoice',
    allInvoices: isRTL ? 'جميع الفواتير' : 'All Invoices',
    regularInvoices: isRTL ? 'فواتير عادية' : 'Regular Invoices',
    etaxInvoices: isRTL ? 'فواتير إلكترونية' : 'E-Tax Invoices',
    customerName: isRTL ? 'اسم العميل' : 'Customer Name',
    customerEmail: isRTL ? 'البريد الإلكتروني' : 'Customer Email',
    customerPhone: isRTL ? 'رقم الهاتف' : 'Phone Number',
    customerAddress: isRTL ? 'العنوان' : 'Address',
    customerTaxId: isRTL ? 'الرقم الضريبي للعميل' : 'Customer Tax ID',
    issuerTaxId: isRTL ? 'الرقم الضريبي للمنشأة' : 'Issuer Tax ID',
    invoiceType: isRTL ? 'نوع الفاتورة' : 'Invoice Type',
    regular: isRTL ? 'فاتورة عادية' : 'Regular Invoice',
    etax: isRTL ? 'فاتورة إلكترونية (E-Tax)' : 'Electronic Invoice (E-Tax)',
    items: isRTL ? 'البنود' : 'Items',
    description: isRTL ? 'الوصف' : 'Description',
    quantity: isRTL ? 'الكمية' : 'Quantity',
    unitPrice: isRTL ? 'سعر الوحدة' : 'Unit Price',
    taxRate: isRTL ? 'نسبة الضريبة %' : 'Tax Rate %',
    discount: isRTL ? 'الخصم %' : 'Discount %',
    addItem: isRTL ? 'إضافة بند' : 'Add Item',
    removeItem: isRTL ? 'حذف' : 'Remove',
    notes: isRTL ? 'ملاحظات' : 'Notes',
    dueDate: isRTL ? 'تاريخ الاستحقاق' : 'Due Date',
    subtotal: isRTL ? 'المجموع الفرعي' : 'Subtotal',
    totalDiscount: isRTL ? 'إجمالي الخصم' : 'Total Discount',
    totalTax: isRTL ? 'إجمالي الضريبة' : 'Total Tax',
    grandTotal: isRTL ? 'الإجمالي' : 'Grand Total',
    create: isRTL ? 'إنشاء' : 'Create',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    view: isRTL ? 'عرض' : 'View',
    edit: isRTL ? 'تعديل' : 'Edit',
    delete: isRTL ? 'حذف' : 'Delete',
    sendEmail: isRTL ? 'إرسال بالبريد' : 'Send Email',
    submitToEtax: isRTL ? 'إرسال للمنظومة' : 'Submit to E-Tax',
    recordPayment: isRTL ? 'تسجيل دفعة' : 'Record Payment',
    status: isRTL ? 'الحالة' : 'Status',
    draft: isRTL ? 'مسودة' : 'Draft',
    sent: isRTL ? 'مُرسلة' : 'Sent',
    paid: isRTL ? 'مدفوعة' : 'Paid',
    overdue: isRTL ? 'متأخرة' : 'Overdue',
    cancelled: isRTL ? 'ملغاة' : 'Cancelled',
    totalInvoices: isRTL ? 'إجمالي الفواتير' : 'Total Invoices',
    totalAmount: isRTL ? 'إجمالي المبلغ' : 'Total Amount',
    paidAmount: isRTL ? 'المبلغ المدفوع' : 'Paid Amount',
    pendingAmount: isRTL ? 'المبلغ المعلق' : 'Pending Amount',
    search: isRTL ? 'بحث...' : 'Search...',
    filterByStatus: isRTL ? 'تصفية حسب الحالة' : 'Filter by Status',
    all: isRTL ? 'الكل' : 'All',
    invoiceNumber: isRTL ? 'رقم الفاتورة' : 'Invoice Number',
    issueDate: isRTL ? 'تاريخ الإصدار' : 'Issue Date',
    amount: isRTL ? 'المبلغ' : 'Amount',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    noInvoices: isRTL ? 'لا توجد فواتير' : 'No invoices found',
    invoiceCreated: isRTL ? 'تم إنشاء الفاتورة بنجاح' : 'Invoice created successfully',
    emailSent: isRTL ? 'تم إرسال الفاتورة بالبريد' : 'Invoice sent via email',
    etaxSubmitted: isRTL ? 'تم إرسال الفاتورة للمنظومة' : 'Invoice submitted to E-Tax',
    paymentRecorded: isRTL ? 'تم تسجيل الدفعة' : 'Payment recorded',
    paymentAmount: isRTL ? 'مبلغ الدفعة' : 'Payment Amount',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    cash: isRTL ? 'نقدي' : 'Cash',
    bank: isRTL ? 'تحويل بنكي' : 'Bank Transfer',
    card: isRTL ? 'بطاقة' : 'Card',
    etaxPending: isRTL ? 'في انتظار الإرسال' : 'Pending Submission',
    etaxSubmittedStatus: isRTL ? 'تم الإرسال' : 'Submitted'
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-200 text-gray-500'
  };

  const statusIcons = {
    draft: Clock,
    sent: Send,
    paid: CheckCircle,
    overdue: AlertCircle,
    cancelled: XCircle
  };

  // Real-time sync handler
  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type === 'invoice_created' || message.type === 'invoice_updated') {
      fetchInvoices();
      fetchStats();
      fetchEtaxStats();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
    fetchEtaxStats();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/invoices/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvoices(response.data || []);
    } catch (error) {
      toast.error(isRTL ? 'فشل في جلب الفواتير' : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/invoices/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      // Stats fetch error
    }
  };

  const fetchEtaxStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/invoices/etax/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEtaxStats(response.data);
    } catch (error) {
      // E-Tax stats fetch error
    }
  };

  // Print invoice
  const handlePrintInvoice = (invoice) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${isRTL ? 'فاتورة' : 'Invoice'} #${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #1a365d; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { padding: 15px; background: #f7fafc; border-radius: 8px; }
          .info-box h3 { margin: 0 0 10px 0; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; }
          th { background: #edf2f7; font-weight: bold; }
          .totals { width: 300px; margin-${isRTL ? 'right' : 'left'}: auto; }
          .totals td { padding: 8px; }
          .grand-total { font-size: 18px; font-weight: bold; background: #ebf8ff !important; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
          .status-paid { background: #c6f6d5; color: #22543d; }
          .status-pending { background: #fefcbf; color: #744210; }
          .footer { margin-top: 40px; text-align: center; color: #718096; font-size: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isRTL ? 'فاتورة' : 'INVOICE'}</h1>
          <p>${isRTL ? 'رقم الفاتورة' : 'Invoice Number'}: <strong>${invoice.invoice_number}</strong></p>
          <p>${isRTL ? 'التاريخ' : 'Date'}: ${invoice.issue_date || new Date().toLocaleDateString()}</p>
          <span class="status ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
            ${invoice.status === 'paid' ? (isRTL ? 'مدفوعة' : 'PAID') : (isRTL ? 'معلقة' : 'PENDING')}
          </span>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>${isRTL ? 'معلومات العميل' : 'Customer Information'}</h3>
            <p><strong>${invoice.customer_name}</strong></p>
            <p>${invoice.customer_email || ''}</p>
            <p>${invoice.customer_phone || ''}</p>
            <p>${invoice.customer_address || ''}</p>
          </div>
          <div class="info-box">
            <h3>${isRTL ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
            <p>${isRTL ? 'نوع الفاتورة' : 'Type'}: ${invoice.invoice_type === 'etax' ? (isRTL ? 'إلكترونية' : 'E-Tax') : (isRTL ? 'عادية' : 'Regular')}</p>
            <p>${isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}: ${invoice.due_date || '-'}</p>
            ${invoice.customer_tax_id ? `<p>${isRTL ? 'الرقم الضريبي' : 'Tax ID'}: ${invoice.customer_tax_id}</p>` : ''}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${isRTL ? 'الوصف' : 'Description'}</th>
              <th>${isRTL ? 'الكمية' : 'Qty'}</th>
              <th>${isRTL ? 'السعر' : 'Price'}</th>
              <th>${isRTL ? 'الخصم' : 'Discount'}</th>
              <th>${isRTL ? 'الضريبة' : 'Tax'}</th>
              <th>${isRTL ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((item, idx) => {
              const subtotal = item.quantity * item.unit_price;
              const discount = subtotal * (item.discount || 0) / 100;
              const afterDiscount = subtotal - discount;
              const tax = afterDiscount * (item.tax_rate || 0) / 100;
              const total = afterDiscount + tax;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit_price.toLocaleString()} EGP</td>
                  <td>${item.discount || 0}%</td>
                  <td>${item.tax_rate || 0}%</td>
                  <td>${total.toLocaleString()} EGP</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <table class="totals">
          <tr>
            <td>${isRTL ? 'المجموع الفرعي' : 'Subtotal'}</td>
            <td>${(invoice.subtotal || 0).toLocaleString()} EGP</td>
          </tr>
          <tr>
            <td>${isRTL ? 'الخصم' : 'Discount'}</td>
            <td>-${(invoice.total_discount || 0).toLocaleString()} EGP</td>
          </tr>
          <tr>
            <td>${isRTL ? 'الضريبة' : 'Tax'} (14%)</td>
            <td>${(invoice.total_tax || 0).toLocaleString()} EGP</td>
          </tr>
          <tr class="grand-total">
            <td>${isRTL ? 'الإجمالي' : 'Grand Total'}</td>
            <td>${(invoice.total_amount || 0).toLocaleString()} EGP</td>
          </tr>
        </table>
        
        <div class="footer">
          <p>${isRTL ? 'شكراً لتعاملكم معنا' : 'Thank you for your business'}</p>
          <p>DataLife Account ERP System</p>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Export invoices to CSV
  const handleExportCSV = () => {
    const headers = [
      isRTL ? 'رقم الفاتورة' : 'Invoice Number',
      isRTL ? 'العميل' : 'Customer',
      isRTL ? 'المبلغ' : 'Amount',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'التاريخ' : 'Date',
      isRTL ? 'النوع' : 'Type'
    ];
    
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.customer_name,
      inv.total_amount,
      inv.status,
      inv.issue_date || inv.created_at?.slice(0, 10),
      inv.invoice_type
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير الفواتير' : 'Invoices exported');
  };

  // Export invoice to PDF
  const handleExportPDF = (invoice) => {
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #1a365d; font-size: 28px;">${isRTL ? 'فاتورة' : 'INVOICE'}</h1>
          <p style="margin: 10px 0;">${isRTL ? 'رقم الفاتورة' : 'Invoice Number'}: <strong>${invoice.invoice_number}</strong></p>
          <p style="margin: 5px 0;">${isRTL ? 'التاريخ' : 'Date'}: ${invoice.issue_date || new Date().toLocaleDateString()}</p>
          <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; background: ${invoice.status === 'paid' ? '#c6f6d5' : '#fefcbf'}; color: ${invoice.status === 'paid' ? '#22543d' : '#744210'};">
            ${invoice.status === 'paid' ? (isRTL ? 'مدفوعة' : 'PAID') : (isRTL ? 'معلقة' : 'PENDING')}
          </span>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 30px;">
          <div style="flex: 1; padding: 15px; background: #f7fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${isRTL ? 'معلومات العميل' : 'Customer Information'}</h3>
            <p style="margin: 5px 0;"><strong>${invoice.customer_name}</strong></p>
            <p style="margin: 5px 0;">${invoice.customer_email || ''}</p>
            <p style="margin: 5px 0;">${invoice.customer_phone || ''}</p>
            <p style="margin: 5px 0;">${invoice.customer_address || ''}</p>
          </div>
          <div style="flex: 1; padding: 15px; background: #f7fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${isRTL ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
            <p style="margin: 5px 0;">${isRTL ? 'نوع الفاتورة' : 'Type'}: ${invoice.invoice_type === 'etax' ? (isRTL ? 'إلكترونية' : 'E-Tax') : (isRTL ? 'عادية' : 'Regular')}</p>
            <p style="margin: 5px 0;">${isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}: ${invoice.due_date || '-'}</p>
            ${invoice.customer_tax_id ? `<p style="margin: 5px 0;">${isRTL ? 'الرقم الضريبي' : 'Tax ID'}: ${invoice.customer_tax_id}</p>` : ''}
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #edf2f7;">
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">#</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الوصف' : 'Description'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الكمية' : 'Qty'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'السعر' : 'Price'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((item, idx) => {
              const total = item.quantity * item.unit_price;
              return `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">${idx + 1}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.description}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.quantity}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.unit_price.toLocaleString()} EGP</td>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">${total.toLocaleString()} EGP</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <table style="width: 300px; margin-${isRTL ? 'right' : 'left'}: auto;">
          <tr>
            <td style="padding: 8px;">${isRTL ? 'المجموع الفرعي' : 'Subtotal'}</td>
            <td style="padding: 8px;">${(invoice.subtotal || 0).toLocaleString()} EGP</td>
          </tr>
          <tr>
            <td style="padding: 8px;">${isRTL ? 'الضريبة' : 'Tax'} (14%)</td>
            <td style="padding: 8px;">${(invoice.total_tax || 0).toLocaleString()} EGP</td>
          </tr>
          <tr style="font-size: 18px; font-weight: bold; background: #ebf8ff;">
            <td style="padding: 8px;">${isRTL ? 'الإجمالي' : 'Grand Total'}</td>
            <td style="padding: 8px;">${(invoice.total_amount || 0).toLocaleString()} EGP</td>
          </tr>
        </table>
        
        <div style="margin-top: 40px; text-align: center; color: #718096; font-size: 12px;">
          <p>${isRTL ? 'شكراً لتعاملكم معنا' : 'Thank you for your business'}</p>
          <p>DataLife Account ERP System</p>
        </div>
      </div>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = content;
    
    const opt = {
      margin: 10,
      filename: `invoice_${invoice.invoice_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
    toast.success(isRTL ? 'تم تصدير الفاتورة PDF' : 'Invoice exported as PDF');
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    formData.items.forEach(item => {
      const itemSubtotal = item.quantity * item.unit_price;
      const itemDiscount = itemSubtotal * (item.discount / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = itemAfterDiscount * (item.tax_rate / 100);

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    });

    return {
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal: subtotal - totalDiscount + totalTax
    };
  };

  const handleCreateInvoice = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/invoices/`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(t.invoiceCreated);
      setShowCreateDialog(false);
      resetForm();
      fetchInvoices();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating invoice');
    }
  };

  const handleSendEmail = async (invoiceNumber, email) => {
    try {
      await axios.post(
        `${API_URL}/api/invoices/${invoiceNumber}/send`,
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.emailSent);
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error sending email');
    }
  };

  const handleSubmitToEtax = async (invoiceNumber) => {
    try {
      await axios.post(
        `${API_URL}/api/invoices/${invoiceNumber}/etax/submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.etaxSubmitted);
      fetchInvoices();
      fetchEtaxStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error submitting to E-Tax');
    }
  };

  const handleRecordPayment = async (invoiceNumber, amount, method) => {
    try {
      await axios.post(
        `${API_URL}/api/invoices/${invoiceNumber}/payment`,
        { amount, method },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.paymentRecorded);
      fetchInvoices();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error recording payment');
    }
  };

  const handleDeleteInvoice = async (invoiceNumber) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?')) {
      return;
    }
    
    try {
      await axios.delete(
        `${API_URL}/api/invoices/${invoiceNumber}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف الفاتورة' : 'Invoice deleted');
      fetchInvoices();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_address: '',
      customer_tax_id: '',
      issuer_tax_id: '',
      invoice_type: 'regular',
      notes: '',
      due_date: '',
      currency: 'EGP',
      items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount: 0 }]
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 14, discount: 0 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      });
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'regular' && inv.invoice_type !== 'etax') ||
                      (activeTab === 'etax' && inv.invoice_type === 'etax');
    return matchesSearch && matchesStatus && matchesTab;
  });

  const totals = calculateTotals();

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.invoices}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500">
              {isRTL ? 'إدارة الفواتير العادية والإلكترونية' : 'Manage regular and electronic invoices'}
            </p>
            {/* Real-time connection indicator */}
            <Badge variant="outline" className={isConnected ? 'text-green-600 border-green-300' : 'text-gray-400 border-gray-200'}>
              {isConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {isConnected ? (isRTL ? 'متصل' : 'Live') : (isRTL ? 'غير متصل' : 'Offline')}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="export-csv-btn">
            <FileDown className="h-4 w-4" />
            {isRTL ? 'تصدير CSV' : 'Export CSV'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2" data-testid="create-invoice-btn">
            <Plus className="h-4 w-4" />
            {t.createInvoice}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalInvoices}</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.total_invoices || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">{t.totalAmount}</p>
                <p className="text-2xl font-bold text-green-900">
                  {(stats?.total_amount || 0).toLocaleString()} EGP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-600">{t.paidAmount}</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {(stats?.paid_amount || 0).toLocaleString()} EGP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.pendingAmount}</p>
                <p className="text-2xl font-bold text-amber-900">
                  {(stats?.pending_amount || 0).toLocaleString()} EGP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* E-Tax Stats */}
      {etaxStats && etaxStats.total_etax_invoices > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-purple-600" />
              {isRTL ? 'إحصائيات الفواتير الإلكترونية' : 'E-Tax Invoice Statistics'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-purple-600">{isRTL ? 'الإجمالي' : 'Total'}</p>
                <p className="text-xl font-bold text-purple-900">{etaxStats.total_etax_invoices}</p>
              </div>
              <div>
                <p className="text-sm text-green-600">{isRTL ? 'تم الإرسال' : 'Submitted'}</p>
                <p className="text-xl font-bold text-green-900">{etaxStats.submitted}</p>
              </div>
              <div>
                <p className="text-sm text-amber-600">{isRTL ? 'قيد الانتظار' : 'Pending'}</p>
                <p className="text-xl font-bold text-amber-900">{etaxStats.pending}</p>
              </div>
              <div>
                <p className="text-sm text-purple-600">{isRTL ? 'القيمة المُرسلة' : 'Submitted Value'}</p>
                <p className="text-xl font-bold text-purple-900">{etaxStats.submitted_amount?.toLocaleString()} EGP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs and Filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">{t.all}</TabsTrigger>
                <TabsTrigger value="regular" data-testid="tab-regular">{t.regularInvoices}</TabsTrigger>
                <TabsTrigger value="etax" data-testid="tab-etax">{t.etaxInvoices}</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="search-invoices"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="status-filter">
                  <SelectValue placeholder={t.filterByStatus} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  <SelectItem value="draft">{t.draft}</SelectItem>
                  <SelectItem value="sent">{t.sent}</SelectItem>
                  <SelectItem value="paid">{t.paid}</SelectItem>
                  <SelectItem value="overdue">{t.overdue}</SelectItem>
                  <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchInvoices} data-testid="refresh-btn">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{t.noInvoices}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.invoiceNumber}</TableHead>
                  <TableHead>{t.customerName}</TableHead>
                  <TableHead>{t.issueDate}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.invoiceType}</TableHead>
                  <TableHead className="text-center">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusIcons[invoice.status] || Clock;
                  return (
                    <TableRow key={invoice.invoice_number} data-testid={`invoice-row-${invoice.invoice_number}`}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.issue_date?.slice(0, 10)}</TableCell>
                      <TableCell className="font-semibold">
                        {invoice.grand_total?.toLocaleString()} {invoice.currency}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[invoice.status]} gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {t[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.invoice_type === 'etax' ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <FileCheck className="h-3 w-3 mr-1" />
                            E-Tax
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t.regular}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowViewDialog(true);
                            }}
                            data-testid={`view-invoice-${invoice.invoice_number}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintInvoice(invoice)}
                            data-testid={`print-invoice-${invoice.invoice_number}`}
                            title={isRTL ? 'طباعة' : 'Print'}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPDF(invoice)}
                            data-testid={`pdf-invoice-${invoice.invoice_number}`}
                            title={isRTL ? 'تصدير PDF' : 'Export PDF'}
                            className="text-red-600 hover:text-red-700"
                          >
                            <File className="h-4 w-4" />
                          </Button>
                          
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendEmail(invoice.invoice_number, invoice.customer_email)}
                                disabled={!invoice.customer_email}
                                data-testid={`send-invoice-${invoice.invoice_number}`}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              
                              {invoice.invoice_type === 'etax' && invoice.etax_submission_status !== 'submitted' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSubmitToEtax(invoice.invoice_number)}
                                  className="text-purple-600 hover:text-purple-700"
                                  data-testid={`submit-etax-${invoice.invoice_number}`}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteInvoice(invoice.invoice_number)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`delete-invoice-${invoice.invoice_number}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t.createInvoice}
            </DialogTitle>
            <DialogDescription>
              {isRTL ? 'أدخل بيانات الفاتورة الجديدة' : 'Enter the new invoice details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Invoice Type */}
            <div className="space-y-2">
              <Label>{t.invoiceType}</Label>
              <Select 
                value={formData.invoice_type} 
                onValueChange={(v) => setFormData({...formData, invoice_type: v})}
              >
                <SelectTrigger data-testid="invoice-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{t.regular}</SelectItem>
                  <SelectItem value="etax">{t.etax}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.customerName} *</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  data-testid="customer-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.customerEmail}</Label>
                <Input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                  data-testid="customer-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.customerPhone}</Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                  data-testid="customer-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.customerAddress}</Label>
                <Input
                  value={formData.customer_address}
                  onChange={(e) => setFormData({...formData, customer_address: e.target.value})}
                  data-testid="customer-address-input"
                />
              </div>
              
              {/* Tax IDs for E-Tax */}
              {formData.invoice_type === 'etax' && (
                <>
                  <div className="space-y-2">
                    <Label>{t.customerTaxId} *</Label>
                    <Input
                      value={formData.customer_tax_id}
                      onChange={(e) => setFormData({...formData, customer_tax_id: e.target.value})}
                      placeholder="e.g., 123456789"
                      data-testid="customer-tax-id-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.issuerTaxId}</Label>
                    <Input
                      value={formData.issuer_tax_id}
                      onChange={(e) => setFormData({...formData, issuer_tax_id: e.target.value})}
                      placeholder="e.g., 987654321"
                      data-testid="issuer-tax-id-input"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.dueDate}</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  data-testid="due-date-input"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.items}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="add-item-btn">
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addItem}
                </Button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-xs">{t.description}</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder={isRTL ? 'وصف المنتج/الخدمة' : 'Product/Service description'}
                          data-testid={`item-description-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.quantity}</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                          data-testid={`item-quantity-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.unitPrice}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          data-testid={`item-price-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.taxRate}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.tax_rate}
                          onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                          data-testid={`item-tax-${index}`}
                        />
                      </div>
                      <div className="flex items-end">
                        {formData.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-500 hover:text-red-600"
                            data-testid={`remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Totals */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t.subtotal}:</span>
                    <span>{totals.subtotal.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>{t.totalDiscount}:</span>
                    <span>-{totals.totalDiscount.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>{t.totalTax} (14% VAT):</span>
                    <span>+{totals.totalTax.toLocaleString()} EGP</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t.grandTotal}:</span>
                    <span>{totals.grandTotal.toLocaleString()} EGP</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                data-testid="notes-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t.cancel}
            </Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={!formData.customer_name || formData.items.every(i => !i.description)}
              data-testid="submit-invoice-btn"
            >
              {t.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.customerName}</p>
                  <p className="font-medium">{selectedInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.status}</p>
                  <Badge className={statusColors[selectedInvoice.status]}>
                    {t[selectedInvoice.status]}
                  </Badge>
                </div>
                {selectedInvoice.customer_email && (
                  <div>
                    <p className="text-sm text-gray-500">{t.customerEmail}</p>
                    <p>{selectedInvoice.customer_email}</p>
                  </div>
                )}
                {selectedInvoice.customer_phone && (
                  <div>
                    <p className="text-sm text-gray-500">{t.customerPhone}</p>
                    <p>{selectedInvoice.customer_phone}</p>
                  </div>
                )}
              </div>

              {/* E-Tax Info */}
              {selectedInvoice.invoice_type === 'etax' && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCheck className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">
                        {isRTL ? 'معلومات الفاتورة الإلكترونية' : 'E-Tax Information'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-purple-600">UUID:</span>
                        <span className="ml-2 font-mono text-xs">{selectedInvoice.etax_uuid?.slice(0, 16)}...</span>
                      </div>
                      <div>
                        <span className="text-purple-600">{isRTL ? 'حالة الإرسال' : 'Submission Status'}:</span>
                        <Badge className={`ml-2 ${selectedInvoice.etax_submission_status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedInvoice.etax_submission_status === 'submitted' ? t.etaxSubmittedStatus : t.etaxPending}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Items */}
              <div>
                <p className="text-sm text-gray-500 mb-2">{t.items}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.description}</TableHead>
                      <TableHead className="text-center">{t.quantity}</TableHead>
                      <TableHead className="text-right">{t.unitPrice}</TableHead>
                      <TableHead className="text-right">{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.unit_price?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{item.total?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t.subtotal}:</span>
                  <span>{selectedInvoice.subtotal?.toLocaleString()} {selectedInvoice.currency}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t.totalDiscount}:</span>
                  <span>-{selectedInvoice.total_discount?.toLocaleString()} {selectedInvoice.currency}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>{t.totalTax}:</span>
                  <span>+{selectedInvoice.total_tax?.toLocaleString()} {selectedInvoice.currency}</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>{t.grandTotal}:</span>
                  <span>{selectedInvoice.grand_total?.toLocaleString()} {selectedInvoice.currency}</span>
                </div>
              </div>

              {/* Actions */}
              {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleSendEmail(selectedInvoice.invoice_number, selectedInvoice.customer_email)}
                    disabled={!selectedInvoice.customer_email}
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {t.sendEmail}
                  </Button>
                  
                  {selectedInvoice.invoice_type === 'etax' && selectedInvoice.etax_submission_status !== 'submitted' && (
                    <Button
                      onClick={() => handleSubmitToEtax(selectedInvoice.invoice_number)}
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Upload className="h-4 w-4" />
                      {t.submitToEtax}
                    </Button>
                  )}
                </div>
              )}

              {/* Attachments Section */}
              <div className="pt-4 border-t">
                <AttachmentsManager 
                  entityType="invoice" 
                  entityId={selectedInvoice.invoice_number}
                  readOnly={selectedInvoice.status === 'cancelled'}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesModule;
