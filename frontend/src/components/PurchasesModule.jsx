import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { 
  ShoppingCart, Plus, Eye, Edit, Trash2, Search, Filter, RefreshCw,
  Package, Truck, CheckCircle, Clock, XCircle, AlertCircle, Building2,
  DollarSign, TrendingUp, Users, FileText, Star, Phone, Mail, MapPin,
  Printer, FileDown, File, Upload
} from 'lucide-react';
import ImportButton from './ImportButton';

const PurchasesModule = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showViewOrderDialog, setShowViewOrderDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Forms
  const [orderForm, setOrderForm] = useState({
    supplier_id: '',
    supplier_name: '',
    items: [{ description: '', quantity: 1, unit_price: 0, product_id: '' }],
    tax_rate: 14,
    payment_terms: '',
    delivery_date: '',
    notes: ''
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    payment_terms: 'Net 30',
    category: '',
    notes: ''
  });

  const t = {
    purchases: isRTL ? 'المشتريات' : 'Purchases',
    purchaseOrders: isRTL ? 'أوامر الشراء' : 'Purchase Orders',
    suppliers: isRTL ? 'الموردين' : 'Suppliers',
    createOrder: isRTL ? 'إنشاء أمر شراء' : 'Create Order',
    addSupplier: isRTL ? 'إضافة مورد' : 'Add Supplier',
    orderNumber: isRTL ? 'رقم الأمر' : 'Order Number',
    supplier: isRTL ? 'المورد' : 'Supplier',
    date: isRTL ? 'التاريخ' : 'Date',
    amount: isRTL ? 'المبلغ' : 'Amount',
    status: isRTL ? 'الحالة' : 'Status',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    draft: isRTL ? 'مسودة' : 'Draft',
    pending_approval: isRTL ? 'في انتظار الموافقة' : 'Pending Approval',
    approved: isRTL ? 'معتمد' : 'Approved',
    ordered: isRTL ? 'تم الطلب' : 'Ordered',
    received: isRTL ? 'مستلم' : 'Received',
    cancelled: isRTL ? 'ملغي' : 'Cancelled',
    view: isRTL ? 'عرض' : 'View',
    edit: isRTL ? 'تعديل' : 'Edit',
    delete: isRTL ? 'حذف' : 'Delete',
    items: isRTL ? 'البنود' : 'Items',
    description: isRTL ? 'الوصف' : 'Description',
    quantity: isRTL ? 'الكمية' : 'Quantity',
    unitPrice: isRTL ? 'سعر الوحدة' : 'Unit Price',
    total: isRTL ? 'الإجمالي' : 'Total',
    subtotal: isRTL ? 'المجموع الفرعي' : 'Subtotal',
    tax: isRTL ? 'الضريبة' : 'Tax',
    grandTotal: isRTL ? 'الإجمالي الكلي' : 'Grand Total',
    addItem: isRTL ? 'إضافة بند' : 'Add Item',
    paymentTerms: isRTL ? 'شروط الدفع' : 'Payment Terms',
    deliveryDate: isRTL ? 'تاريخ التسليم' : 'Delivery Date',
    notes: isRTL ? 'ملاحظات' : 'Notes',
    save: isRTL ? 'حفظ' : 'Save',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    name: isRTL ? 'الاسم' : 'Name',
    contactPerson: isRTL ? 'جهة الاتصال' : 'Contact Person',
    email: isRTL ? 'البريد الإلكتروني' : 'Email',
    phone: isRTL ? 'الهاتف' : 'Phone',
    address: isRTL ? 'العنوان' : 'Address',
    taxId: isRTL ? 'الرقم الضريبي' : 'Tax ID',
    category: isRTL ? 'الفئة' : 'Category',
    totalOrders: isRTL ? 'إجمالي الطلبات' : 'Total Orders',
    totalAmount: isRTL ? 'إجمالي المبلغ' : 'Total Amount',
    pendingOrders: isRTL ? 'طلبات معلقة' : 'Pending Orders',
    topSuppliers: isRTL ? 'أفضل الموردين' : 'Top Suppliers',
    noOrders: isRTL ? 'لا توجد أوامر شراء' : 'No purchase orders',
    noSuppliers: isRTL ? 'لا يوجد موردين' : 'No suppliers',
    orderCreated: isRTL ? 'تم إنشاء أمر الشراء' : 'Purchase order created',
    supplierAdded: isRTL ? 'تم إضافة المورد' : 'Supplier added',
    search: isRTL ? 'بحث...' : 'Search...',
    all: isRTL ? 'الكل' : 'All',
    approve: isRTL ? 'اعتماد' : 'Approve',
    markOrdered: isRTL ? 'تم الطلب' : 'Mark Ordered',
    markReceived: isRTL ? 'تم الاستلام' : 'Mark Received',
    active: isRTL ? 'نشط' : 'Active',
    inactive: isRTL ? 'غير نشط' : 'Inactive'
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    ordered: 'bg-purple-100 text-purple-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  const statusIcons = {
    draft: Clock,
    pending_approval: AlertCircle,
    approved: CheckCircle,
    ordered: Truck,
    received: Package,
    cancelled: XCircle
  };

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchStats();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/purchases/orders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrders(response.data || []);
    } catch (error) {
      toast.error(isRTL ? 'فشل في جلب الطلبات' : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/purchases/suppliers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuppliers(response.data || []);
    } catch (error) {
      // Error
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/purchases/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      // Error
    }
  };

  // Export orders to CSV
  const handleExportOrdersCSV = () => {
    const headers = [
      isRTL ? 'رقم الطلب' : 'Order Number',
      isRTL ? 'المورد' : 'Supplier',
      isRTL ? 'المبلغ' : 'Amount',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'التاريخ' : 'Date'
    ];
    
    const rows = orders.map(order => [
      order.order_number,
      order.supplier_name,
      order.total_amount,
      order.status,
      order.created_at?.slice(0, 10)
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase_orders_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير الطلبات' : 'Orders exported');
  };

  // Print purchase order
  const handlePrintOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${isRTL ? 'أمر شراء' : 'Purchase Order'} #${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #1a365d; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { padding: 15px; background: #f7fafc; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; }
          th { background: #edf2f7; }
          .totals { width: 300px; margin-${isRTL ? 'right' : 'left'}: auto; }
          .footer { margin-top: 40px; text-align: center; color: #718096; font-size: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isRTL ? 'أمر شراء' : 'PURCHASE ORDER'}</h1>
          <p>${isRTL ? 'رقم الطلب' : 'Order Number'}: <strong>${order.order_number}</strong></p>
          <p>${isRTL ? 'التاريخ' : 'Date'}: ${order.created_at?.slice(0, 10)}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>${isRTL ? 'معلومات المورد' : 'Supplier Information'}</h3>
            <p><strong>${order.supplier_name}</strong></p>
          </div>
          <div class="info-box">
            <h3>${isRTL ? 'تفاصيل الطلب' : 'Order Details'}</h3>
            <p>${isRTL ? 'الحالة' : 'Status'}: ${order.status}</p>
            <p>${isRTL ? 'تاريخ التسليم' : 'Delivery Date'}: ${order.expected_delivery || '-'}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${isRTL ? 'الوصف' : 'Description'}</th>
              <th>${isRTL ? 'الكمية' : 'Qty'}</th>
              <th>${isRTL ? 'السعر' : 'Price'}</th>
              <th>${isRTL ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unit_price?.toLocaleString()} EGP</td>
                <td>${(item.quantity * item.unit_price).toLocaleString()} EGP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table class="totals">
          <tr><td><strong>${isRTL ? 'الإجمالي' : 'Total'}</strong></td><td><strong>${order.total_amount?.toLocaleString()} EGP</strong></td></tr>
        </table>
        
        <div class="footer"><p>DataLife Account ERP System</p></div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // Export purchase order to PDF
  const handleExportPDF = (order) => {
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #1a365d;">${isRTL ? 'أمر شراء' : 'PURCHASE ORDER'}</h1>
          <p style="margin: 10px 0;">${isRTL ? 'رقم الطلب' : 'Order Number'}: <strong>${order.order_number}</strong></p>
          <p style="margin: 5px 0;">${isRTL ? 'التاريخ' : 'Date'}: ${order.created_at?.slice(0, 10)}</p>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 30px;">
          <div style="flex: 1; padding: 15px; background: #f7fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748;">${isRTL ? 'معلومات المورد' : 'Supplier Information'}</h3>
            <p style="margin: 5px 0;"><strong>${order.supplier_name}</strong></p>
          </div>
          <div style="flex: 1; padding: 15px; background: #f7fafc; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748;">${isRTL ? 'تفاصيل الطلب' : 'Order Details'}</h3>
            <p style="margin: 5px 0;">${isRTL ? 'الحالة' : 'Status'}: ${order.status}</p>
            <p style="margin: 5px 0;">${isRTL ? 'تاريخ التسليم' : 'Delivery Date'}: ${order.expected_delivery || '-'}</p>
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
            ${(order.items || []).map((item, idx) => `
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${idx + 1}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.description}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.quantity}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${item.unit_price?.toLocaleString()} EGP</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${(item.quantity * item.unit_price).toLocaleString()} EGP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table style="width: 300px; margin-${isRTL ? 'right' : 'left'}: auto;">
          <tr style="font-weight: bold; background: #ebf8ff;">
            <td style="padding: 10px;"><strong>${isRTL ? 'الإجمالي' : 'Total'}</strong></td>
            <td style="padding: 10px;"><strong>${order.total_amount?.toLocaleString()} EGP</strong></td>
          </tr>
        </table>
        
        <div style="margin-top: 40px; text-align: center; color: #718096; font-size: 12px;">
          <p>DataLife Account ERP System</p>
        </div>
      </div>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = content;
    
    const opt = {
      margin: 10,
      filename: `purchase_order_${order.order_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
    toast.success(isRTL ? 'تم تصدير الطلب PDF' : 'Order exported as PDF');
  };

  const handleCreateOrder = async () => {
    try {
      await axios.post(
        `${API_URL}/api/purchases/orders`,
        orderForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.orderCreated);
      setShowOrderDialog(false);
      resetOrderForm();
      fetchOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating order');
    }
  };

  const handleCreateSupplier = async () => {
    try {
      if (editingSupplier) {
        await axios.put(
          `${API_URL}/api/purchases/suppliers/${editingSupplier.id}`,
          supplierForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(isRTL ? 'تم تحديث المورد' : 'Supplier updated');
      } else {
        await axios.post(
          `${API_URL}/api/purchases/suppliers`,
          supplierForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(t.supplierAdded);
      }
      setShowSupplierDialog(false);
      resetSupplierForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving supplier');
    }
  };

  const handleUpdateStatus = async (poNumber, newStatus) => {
    try {
      await axios.put(
        `${API_URL}/api/purchases/orders/${poNumber}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم تحديث الحالة' : 'Status updated');
      fetchOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating status');
    }
  };

  const handleDeleteOrder = async (poNumber) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/purchases/orders/${poNumber}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إلغاء الطلب' : 'Order cancelled');
      fetchOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const resetOrderForm = () => {
    setOrderForm({
      supplier_id: '',
      supplier_name: '',
      items: [{ description: '', quantity: 1, unit_price: 0, product_id: '' }],
      tax_rate: 14,
      payment_terms: '',
      delivery_date: '',
      notes: ''
    });
  };

  const resetSupplierForm = () => {
    setSupplierForm({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      payment_terms: 'Net 30',
      category: '',
      notes: ''
    });
    setEditingSupplier(null);
  };

  const addOrderItem = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { description: '', quantity: 1, unit_price: 0, product_id: '' }]
    });
  };

  const removeOrderItem = (index) => {
    if (orderForm.items.length > 1) {
      setOrderForm({
        ...orderForm,
        items: orderForm.items.filter((_, i) => i !== index)
      });
    }
  };

  const updateOrderItem = (index, field, value) => {
    const newItems = [...orderForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderForm({ ...orderForm, items: newItems });
  };

  const calculateOrderTotals = () => {
    const subtotal = orderForm.items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0);
    const tax = subtotal * (orderForm.tax_rate / 100);
    return { subtotal, tax, total: subtotal + tax };
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = calculateOrderTotals();

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.purchases}</h1>
          <p className="text-gray-500 mt-1">
            {isRTL ? 'إدارة المشتريات والموردين' : 'Manage purchases and suppliers'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalOrders}</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.total_orders || 0}</p>
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

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.pendingOrders}</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.pending_orders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600">{t.suppliers}</p>
                <p className="text-2xl font-bold text-purple-900">{suppliers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t.purchaseOrders}
            </TabsTrigger>
            <TabsTrigger value="suppliers" data-testid="tab-suppliers">
              <Building2 className="h-4 w-4 mr-2" />
              {t.suppliers}
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'orders' ? (
            <div className="flex gap-2">
              <ImportButton language={language} importType="purchases" onSuccess={() => fetchOrders()} />
              <Button variant="outline" onClick={handleExportOrdersCSV} className="gap-2">
                <FileDown className="h-4 w-4" />
                {isRTL ? 'تصدير CSV' : 'Export CSV'}
              </Button>
              <Button onClick={() => setShowOrderDialog(true)} className="gap-2" data-testid="create-order-btn">
                <Plus className="h-4 w-4" />
                {t.createOrder}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <ImportButton language={language} importType="suppliers" onSuccess={() => fetchSuppliers()} />
              <Button onClick={() => setShowSupplierDialog(true)} className="gap-2" data-testid="add-supplier-btn">
                <Plus className="h-4 w-4" />
                {t.addSupplier}
              </Button>
            </div>
          )}
        </div>

        {/* Purchase Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t.search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.all}</SelectItem>
                    <SelectItem value="draft">{t.draft}</SelectItem>
                    <SelectItem value="pending_approval">{t.pending_approval}</SelectItem>
                    <SelectItem value="approved">{t.approved}</SelectItem>
                    <SelectItem value="ordered">{t.ordered}</SelectItem>
                    <SelectItem value="received">{t.received}</SelectItem>
                    <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchOrders}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">{t.noOrders}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.orderNumber}</TableHead>
                      <TableHead>{t.supplier}</TableHead>
                      <TableHead>{t.date}</TableHead>
                      <TableHead>{t.amount}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead className="text-center">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const StatusIcon = statusIcons[order.status] || Clock;
                      return (
                        <TableRow key={order.po_number}>
                          <TableCell className="font-medium">{order.po_number}</TableCell>
                          <TableCell>{order.supplier_name}</TableCell>
                          <TableCell>{order.created_at?.slice(0, 10)}</TableCell>
                          <TableCell className="font-semibold">
                            {order.grand_total?.toLocaleString()} EGP
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {t[order.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowViewOrderDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintOrder(order)}
                                title={isRTL ? 'طباعة' : 'Print'}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExportPDF(order)}
                                title={isRTL ? 'تصدير PDF' : 'Export PDF'}
                                className="text-red-600"
                              >
                                <File className="h-4 w-4" />
                              </Button>
                              
                              {order.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(order.po_number, 'pending_approval')}
                                  className="text-amber-600"
                                >
                                  {isRTL ? 'إرسال' : 'Submit'}
                                </Button>
                              )}
                              
                              {order.status === 'pending_approval' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(order.po_number, 'approved')}
                                  className="text-green-600"
                                >
                                  {t.approve}
                                </Button>
                              )}
                              
                              {order.status === 'approved' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(order.po_number, 'ordered')}
                                  className="text-purple-600"
                                >
                                  {t.markOrdered}
                                </Button>
                              )}
                              
                              {order.status === 'ordered' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(order.po_number, 'received')}
                                  className="text-green-600"
                                >
                                  {t.markReceived}
                                </Button>
                              )}
                              
                              {!['received', 'cancelled'].includes(order.status) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteOrder(order.po_number)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              {suppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">{t.noSuppliers}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers.map((supplier) => (
                    <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{supplier.name}</h3>
                              <p className="text-sm text-gray-500">{supplier.category || '-'}</p>
                            </div>
                          </div>
                          <Badge className={supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                            {supplier.is_active ? t.active : t.inactive}
                          </Badge>
                        </div>
                        
                        <div className="mt-4 space-y-2 text-sm">
                          {supplier.contact_person && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Users className="h-4 w-4" />
                              {supplier.contact_person}
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="h-4 w-4" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="h-4 w-4" />
                              {supplier.phone}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <div className="text-sm">
                            <span className="text-gray-500">{isRTL ? 'الطلبات:' : 'Orders:'}</span>
                            <span className="font-semibold ml-1">{supplier.total_orders || 0}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setSupplierForm({
                                name: supplier.name || '',
                                contact_person: supplier.contact_person || '',
                                email: supplier.email || '',
                                phone: supplier.phone || '',
                                address: supplier.address || '',
                                tax_id: supplier.tax_id || '',
                                payment_terms: supplier.payment_terms || 'Net 30',
                                category: supplier.category || '',
                                notes: supplier.notes || ''
                              });
                              setShowSupplierDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.createOrder}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Supplier Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.supplier} *</Label>
                <Select 
                  value={orderForm.supplier_id}
                  onValueChange={(v) => {
                    const sup = suppliers.find(s => s.id === v);
                    setOrderForm({
                      ...orderForm,
                      supplier_id: v,
                      supplier_name: sup?.name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر المورد' : 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.deliveryDate}</Label>
                <Input
                  type="date"
                  value={orderForm.delivery_date}
                  onChange={(e) => setOrderForm({...orderForm, delivery_date: e.target.value})}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.items}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addItem}
                </Button>
              </div>

              {orderForm.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Label className="text-xs">{t.description}</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateOrderItem(index, 'description', e.target.value)}
                        placeholder={isRTL ? 'وصف المنتج' : 'Product description'}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t.quantity}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">{t.unitPrice}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      {orderForm.items.length > 1 && (
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(index)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Totals */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t.subtotal}:</span>
                    <span>{totals.subtotal.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>{t.tax} ({orderForm.tax_rate}%):</span>
                    <span>{totals.tax.toLocaleString()} EGP</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t.grandTotal}:</span>
                    <span>{totals.total.toLocaleString()} EGP</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={orderForm.notes}
                onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>{t.cancel}</Button>
            <Button 
              onClick={handleCreateOrder}
              disabled={!orderForm.supplier_id || orderForm.items.every(i => !i.description)}
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={(open) => { setShowSupplierDialog(open); if (!open) resetSupplierForm(); }}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? (isRTL ? 'تعديل المورد' : 'Edit Supplier') : t.addSupplier}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.name} *</Label>
                <Input
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.contactPerson}</Label>
                <Input
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({...supplierForm, contact_person: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.email}</Label>
                <Input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.phone}</Label>
                <Input
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.address}</Label>
              <Input
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.taxId}</Label>
                <Input
                  value={supplierForm.tax_id}
                  onChange={(e) => setSupplierForm({...supplierForm, tax_id: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.category}</Label>
                <Input
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({...supplierForm, category: e.target.value})}
                  placeholder={isRTL ? 'مثال: مواد خام' : 'e.g., Raw Materials'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.paymentTerms}</Label>
              <Select 
                value={supplierForm.payment_terms}
                onValueChange={(v) => setSupplierForm({...supplierForm, payment_terms: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                  <SelectItem value="Net 90">Net 90</SelectItem>
                  <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                  <SelectItem value="Prepaid">Prepaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCreateSupplier} disabled={!supplierForm.name}>
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={showViewOrderDialog} onOpenChange={setShowViewOrderDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selectedOrder?.po_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.supplier}</p>
                  <p className="font-medium">{selectedOrder.supplier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.status}</p>
                  <Badge className={statusColors[selectedOrder.status]}>
                    {t[selectedOrder.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.date}</p>
                  <p>{selectedOrder.created_at?.slice(0, 10)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.deliveryDate}</p>
                  <p>{selectedOrder.delivery_date || '-'}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.description}</TableHead>
                    <TableHead className="text-center">{t.quantity}</TableHead>
                    <TableHead className="text-right">{t.unitPrice}</TableHead>
                    <TableHead className="text-right">{t.total}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.unit_price?.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">{item.total?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>{t.subtotal}:</span>
                  <span>{selectedOrder.subtotal?.toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>{t.tax}:</span>
                  <span>{selectedOrder.tax_amount?.toLocaleString()} EGP</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>{t.grandTotal}:</span>
                  <span>{selectedOrder.grand_total?.toLocaleString()} EGP</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-gray-500">{t.notes}</p>
                  <p className="bg-gray-50 p-3 rounded">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesModule;
