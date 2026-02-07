import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText, DollarSign, Eye, User, LogOut, Home, CreditCard,
  CheckCircle, Clock, XCircle, AlertCircle, Receipt, Building2,
  Lock, Mail, Phone, MapPin, RefreshCw, Download, ChevronRight
} from 'lucide-react';

const CustomerPortal = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);

  // Login state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Profile state
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', address: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const t = {
    customerPortal: isRTL ? 'بوابة العملاء' : 'Customer Portal',
    login: isRTL ? 'تسجيل الدخول' : 'Login',
    email: isRTL ? 'البريد الإلكتروني' : 'Email',
    password: isRTL ? 'كلمة المرور' : 'Password',
    loginBtn: isRTL ? 'دخول' : 'Sign In',
    logout: isRTL ? 'تسجيل الخروج' : 'Logout',
    dashboard: isRTL ? 'لوحة التحكم' : 'Dashboard',
    invoices: isRTL ? 'الفواتير' : 'Invoices',
    payments: isRTL ? 'المدفوعات' : 'Payments',
    profile: isRTL ? 'الملف الشخصي' : 'Profile',
    welcome: isRTL ? 'مرحباً' : 'Welcome',
    totalInvoices: isRTL ? 'إجمالي الفواتير' : 'Total Invoices',
    totalAmount: isRTL ? 'إجمالي المبلغ' : 'Total Amount',
    paidAmount: isRTL ? 'المبلغ المدفوع' : 'Paid Amount',
    pendingAmount: isRTL ? 'المبلغ المعلق' : 'Pending Amount',
    recentInvoices: isRTL ? 'أحدث الفواتير' : 'Recent Invoices',
    pendingInvoices: isRTL ? 'الفواتير المعلقة' : 'Pending Invoices',
    invoiceNumber: isRTL ? 'رقم الفاتورة' : 'Invoice Number',
    issueDate: isRTL ? 'تاريخ الإصدار' : 'Issue Date',
    dueDate: isRTL ? 'تاريخ الاستحقاق' : 'Due Date',
    amount: isRTL ? 'المبلغ' : 'Amount',
    status: isRTL ? 'الحالة' : 'Status',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    view: isRTL ? 'عرض' : 'View',
    pay: isRTL ? 'دفع' : 'Pay',
    draft: isRTL ? 'مسودة' : 'Draft',
    sent: isRTL ? 'مُرسلة' : 'Sent',
    paid: isRTL ? 'مدفوعة' : 'Paid',
    overdue: isRTL ? 'متأخرة' : 'Overdue',
    cancelled: isRTL ? 'ملغاة' : 'Cancelled',
    noInvoices: isRTL ? 'لا توجد فواتير' : 'No invoices found',
    noPayments: isRTL ? 'لا توجد مدفوعات' : 'No payments found',
    paymentDate: isRTL ? 'تاريخ الدفع' : 'Payment Date',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    paymentReference: isRTL ? 'المرجع' : 'Reference',
    name: isRTL ? 'الاسم' : 'Name',
    phone: isRTL ? 'رقم الهاتف' : 'Phone',
    address: isRTL ? 'العنوان' : 'Address',
    updateProfile: isRTL ? 'تحديث الملف الشخصي' : 'Update Profile',
    changePassword: isRTL ? 'تغيير كلمة المرور' : 'Change Password',
    currentPassword: isRTL ? 'كلمة المرور الحالية' : 'Current Password',
    newPassword: isRTL ? 'كلمة المرور الجديدة' : 'New Password',
    confirmPassword: isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password',
    save: isRTL ? 'حفظ' : 'Save',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    loginError: isRTL ? 'خطأ في تسجيل الدخول' : 'Login failed',
    loginSuccess: isRTL ? 'تم تسجيل الدخول بنجاح' : 'Login successful',
    profileUpdated: isRTL ? 'تم تحديث الملف الشخصي' : 'Profile updated',
    passwordChanged: isRTL ? 'تم تغيير كلمة المرور' : 'Password changed',
    items: isRTL ? 'البنود' : 'Items',
    description: isRTL ? 'الوصف' : 'Description',
    quantity: isRTL ? 'الكمية' : 'Quantity',
    unitPrice: isRTL ? 'سعر الوحدة' : 'Unit Price',
    total: isRTL ? 'الإجمالي' : 'Total',
    subtotal: isRTL ? 'المجموع الفرعي' : 'Subtotal',
    tax: isRTL ? 'الضريبة' : 'Tax',
    discount: isRTL ? 'الخصم' : 'Discount',
    grandTotal: isRTL ? 'الإجمالي الكلي' : 'Grand Total',
    paidAmountLabel: isRTL ? 'المدفوع' : 'Paid',
    remaining: isRTL ? 'المتبقي' : 'Remaining'
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
    sent: Mail,
    paid: CheckCircle,
    overdue: AlertCircle,
    cancelled: XCircle
  };

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('customer_portal_token');
    const savedCustomer = localStorage.getItem('customer_portal_user');
    if (savedToken && savedCustomer) {
      setToken(savedToken);
      setCustomer(JSON.parse(savedCustomer));
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchDashboard();
      fetchInvoices();
      fetchPayments();
    }
  }, [isLoggedIn, token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/customer-portal/login`, loginForm);
      const { access_token, customer: customerData } = response.data;
      
      setToken(access_token);
      setCustomer(customerData);
      setIsLoggedIn(true);
      
      localStorage.setItem('customer_portal_token', access_token);
      localStorage.setItem('customer_portal_user', JSON.stringify(customerData));
      
      toast.success(t.loginSuccess);
    } catch (error) {
      toast.error(error.response?.data?.detail || t.loginError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken(null);
    setCustomer(null);
    localStorage.removeItem('customer_portal_token');
    localStorage.removeItem('customer_portal_user');
  };

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/customer-portal/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboardData(response.data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/customer-portal/invoices`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvoices(response.data || []);
    } catch (error) {
      console.error('Invoices fetch error:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/customer-portal/payments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayments(response.data || []);
    } catch (error) {
      console.error('Payments fetch error:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/customer-portal/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileForm({
        name: response.data.name || '',
        phone: response.data.phone || '',
        address: response.data.address || ''
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await axios.put(
        `${API_URL}/api/customer-portal/profile`,
        profileForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.profileUpdated);
      setShowProfileDialog(false);
      
      // Update local customer data
      const updatedCustomer = { ...customer, name: profileForm.name };
      setCustomer(updatedCustomer);
      localStorage.setItem('customer_portal_user', JSON.stringify(updatedCustomer));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating profile');
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }
    
    try {
      await axios.put(
        `${API_URL}/api/customer-portal/change-password`,
        {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.passwordChanged);
      setShowPasswordDialog(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error changing password');
    }
  };

  const viewInvoice = async (invoiceNumber) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/customer-portal/invoices/${invoiceNumber}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedInvoice(response.data);
      setShowInvoiceDialog(true);
    } catch (error) {
      toast.error('Error loading invoice');
    }
  };

  // Login Page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>
        
        <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t.customerPortal}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'سجل دخولك للوصول إلى فواتيرك ومدفوعاتك' : 'Login to access your invoices and payments'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="pl-10"
                    placeholder="your@email.com"
                    required
                    data-testid="customer-email-input"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">{t.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                    data-testid="customer-password-input"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isLoading}
                data-testid="customer-login-btn"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : t.loginBtn}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t.customerPortal}</h1>
                <p className="text-sm text-gray-300">{customer?.company_name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">{t.welcome}, {customer?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white hover:bg-white/10"
                data-testid="customer-logout-btn"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.logout}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-dashboard">
              <Home className="h-4 w-4" />
              {t.dashboard}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2" data-testid="tab-invoices">
              <FileText className="h-4 w-4" />
              {t.invoices}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2" data-testid="tab-payments">
              <CreditCard className="h-4 w-4" />
              {t.payments}
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
              <User className="h-4 w-4" />
              {t.profile}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
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
                      <p className="text-2xl font-bold text-blue-900">
                        {dashboardData?.summary?.total_invoices || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-600">{t.totalAmount}</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {(dashboardData?.summary?.total_amount || 0).toLocaleString()} EGP
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-green-600">{t.paidAmount}</p>
                      <p className="text-2xl font-bold text-green-900">
                        {(dashboardData?.summary?.paid_amount || 0).toLocaleString()} EGP
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
                        {(dashboardData?.summary?.pending_amount || 0).toLocaleString()} EGP
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent & Pending Invoices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    {t.recentInvoices}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.recent_invoices?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.recent_invoices.map((invoice) => {
                        const StatusIcon = statusIcons[invoice.status] || Clock;
                        return (
                          <div
                            key={invoice.invoice_number}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                            onClick={() => viewInvoice(invoice.invoice_number)}
                          >
                            <div>
                              <p className="font-medium">{invoice.invoice_number}</p>
                              <p className="text-sm text-gray-500">{invoice.issue_date?.slice(0, 10)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{invoice.grand_total?.toLocaleString()} EGP</p>
                              <Badge className={statusColors[invoice.status]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {t[invoice.status]}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">{t.noInvoices}</p>
                  )}
                </CardContent>
              </Card>

              {/* Pending Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    {t.pendingInvoices}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.pending_invoices?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.pending_invoices.map((invoice) => (
                        <div
                          key={invoice.invoice_number}
                          className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 cursor-pointer"
                          onClick={() => viewInvoice(invoice.invoice_number)}
                        >
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-gray-500">
                              {isRTL ? 'مستحق' : 'Due'}: {invoice.due_date?.slice(0, 10) || '-'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-amber-700">
                              {(invoice.grand_total - (invoice.paid_amount || 0)).toLocaleString()} EGP
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-600">{isRTL ? 'لا توجد فواتير معلقة' : 'No pending invoices'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>{t.invoices}</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.invoiceNumber}</TableHead>
                        <TableHead>{t.issueDate}</TableHead>
                        <TableHead>{t.dueDate}</TableHead>
                        <TableHead>{t.amount}</TableHead>
                        <TableHead>{t.status}</TableHead>
                        <TableHead className="text-center">{t.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const StatusIcon = statusIcons[invoice.status] || Clock;
                        return (
                          <TableRow key={invoice.invoice_number}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.issue_date?.slice(0, 10)}</TableCell>
                            <TableCell>{invoice.due_date?.slice(0, 10) || '-'}</TableCell>
                            <TableCell className="font-semibold">
                              {invoice.grand_total?.toLocaleString()} EGP
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[invoice.status]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {t[invoice.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewInvoice(invoice.invoice_number)}
                                data-testid={`view-invoice-${invoice.invoice_number}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t.noInvoices}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>{t.payments}</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.invoiceNumber}</TableHead>
                        <TableHead>{t.paymentDate}</TableHead>
                        <TableHead>{t.amount}</TableHead>
                        <TableHead>{t.paymentMethod}</TableHead>
                        <TableHead>{t.paymentReference}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                          <TableCell>{payment.date?.slice(0, 10)}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {payment.amount?.toLocaleString()} EGP
                          </TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell>{payment.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t.noPayments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{t.profile}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-500">{t.name}</Label>
                      <p className="font-medium text-lg">{customer?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">{t.email}</Label>
                      <p className="font-medium">{customer?.email}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-500">{isRTL ? 'الشركة' : 'Company'}</Label>
                      <p className="font-medium">{customer?.company_name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      fetchProfile();
                      setShowProfileDialog(true);
                    }}
                    data-testid="edit-profile-btn"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t.updateProfile}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordDialog(true)}
                    data-testid="change-password-btn"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t.changePassword}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Invoice Detail Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Invoice Items */}
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

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>{t.subtotal}:</span>
                  <span>{selectedInvoice.subtotal?.toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{t.discount}:</span>
                  <span>-{selectedInvoice.total_discount?.toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>{t.tax}:</span>
                  <span>+{selectedInvoice.total_tax?.toLocaleString()} EGP</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>{t.grandTotal}:</span>
                  <span>{selectedInvoice.grand_total?.toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>{t.paidAmountLabel}:</span>
                  <span>{(selectedInvoice.paid_amount || 0).toLocaleString()} EGP</span>
                </div>
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>{t.remaining}:</span>
                  <span>{(selectedInvoice.grand_total - (selectedInvoice.paid_amount || 0)).toLocaleString()} EGP</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.updateProfile}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.name}</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.phone}</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.address}</Label>
              <Input
                value={profileForm.address}
                onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleUpdateProfile}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.changePassword}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.currentPassword}</Label>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.newPassword}</Label>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.confirmPassword}</Label>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleChangePassword}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortal;
