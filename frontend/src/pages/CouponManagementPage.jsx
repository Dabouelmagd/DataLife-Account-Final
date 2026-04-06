import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Plus, Edit2, Trash2, Tag, Percent, DollarSign, Calendar, 
  Users, Download, Mail, Search, RefreshCw, CheckCircle, XCircle,
  Copy, BarChart3, Clock, Target, Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CouponManagementPage = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    discount_type: 'percentage',
    discount_value: '',
    min_amount: '',
    max_discount: '',
    duration: 'unlimited',
    expiry_date: '',
    usage_limit: '',
    applicable_plans: [],
    is_active: true
  });

  // Email form state
  const [emailData, setEmailData] = useState({
    recipient_email: '',
    recipient_name: ''
  });

  const t = {
    title: isRTL ? 'إدارة الكوبونات' : 'Coupon Management',
    subtitle: isRTL ? 'إنشاء وإدارة كوبونات الخصم' : 'Create and manage discount coupons',
    createCoupon: isRTL ? 'إنشاء كوبون' : 'Create Coupon',
    editCoupon: isRTL ? 'تعديل الكوبون' : 'Edit Coupon',
    deleteCoupon: isRTL ? 'حذف الكوبون' : 'Delete Coupon',
    exportExcel: isRTL ? 'تصدير Excel' : 'Export Excel',
    search: isRTL ? 'بحث...' : 'Search...',
    showInactive: isRTL ? 'عرض غير النشطة' : 'Show Inactive',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    code: isRTL ? 'الكود' : 'Code',
    name: isRTL ? 'الاسم' : 'Name',
    nameAr: isRTL ? 'الاسم بالعربي' : 'Arabic Name',
    nameEn: isRTL ? 'الاسم بالإنجليزي' : 'English Name',
    type: isRTL ? 'النوع' : 'Type',
    discount: isRTL ? 'الخصم' : 'Discount',
    percentage: isRTL ? 'نسبة مئوية' : 'Percentage',
    fixed: isRTL ? 'مبلغ ثابت' : 'Fixed Amount',
    minAmount: isRTL ? 'الحد الأدنى' : 'Min Amount',
    maxDiscount: isRTL ? 'الحد الأقصى للخصم' : 'Max Discount',
    duration: isRTL ? 'المدة' : 'Duration',
    expiry: isRTL ? 'تاريخ الانتهاء' : 'Expiry Date',
    usageLimit: isRTL ? 'حد الاستخدام' : 'Usage Limit',
    usageCount: isRTL ? 'مرات الاستخدام' : 'Times Used',
    status: isRTL ? 'الحالة' : 'Status',
    active: isRTL ? 'نشط' : 'Active',
    inactive: isRTL ? 'غير نشط' : 'Inactive',
    expired: isRTL ? 'منتهي' : 'Expired',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    save: isRTL ? 'حفظ' : 'Save',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    delete: isRTL ? 'حذف' : 'Delete',
    sendEmail: isRTL ? 'إرسال بالإيميل' : 'Send Email',
    copyCoupon: isRTL ? 'نسخ الكود' : 'Copy Code',
    confirmDelete: isRTL ? 'هل أنت متأكد من حذف هذا الكوبون؟' : 'Are you sure you want to delete this coupon?',
    noCoupons: isRTL ? 'لا توجد كوبونات' : 'No coupons found',
    // Duration options
    oneMonth: isRTL ? 'شهر واحد' : '1 Month',
    threeMonths: isRTL ? '3 أشهر' : '3 Months',
    sixMonths: isRTL ? '6 أشهر' : '6 Months',
    twelveMonths: isRTL ? '12 شهر' : '12 Months',
    unlimited: isRTL ? 'مستمر بدون انقطاع' : 'Unlimited (No Expiry)',
    custom: isRTL ? 'تاريخ مخصص' : 'Custom Date',
    // Stats
    totalCoupons: isRTL ? 'إجمالي الكوبونات' : 'Total Coupons',
    activeCoupons: isRTL ? 'كوبونات نشطة' : 'Active Coupons',
    totalUsage: isRTL ? 'إجمالي الاستخدام' : 'Total Usage',
    avgDiscount: isRTL ? 'متوسط الخصم' : 'Avg Discount',
    // Email
    recipientEmail: isRTL ? 'إيميل المستلم' : 'Recipient Email',
    recipientName: isRTL ? 'اسم المستلم' : 'Recipient Name',
    emailSent: isRTL ? 'تم إرسال الإيميل بنجاح' : 'Email sent successfully',
    // Plans
    allPlans: isRTL ? 'جميع الخطط' : 'All Plans',
    starterOnly: isRTL ? 'المبتدئ فقط' : 'Starter Only',
    professionalOnly: isRTL ? 'المحترف فقط' : 'Professional Only',
    enterpriseOnly: isRTL ? 'المؤسسي فقط' : 'Enterprise Only'
  };

  const durationOptions = [
    { value: '1_month', label: t.oneMonth, months: 1 },
    { value: '3_months', label: t.threeMonths, months: 3 },
    { value: '6_months', label: t.sixMonths, months: 6 },
    { value: '12_months', label: t.twelveMonths, months: 12 },
    { value: 'unlimited', label: t.unlimited, months: null },
    { value: 'custom', label: t.custom, months: null }
  ];

  const planOptions = [
    { value: 'all', label: t.allPlans },
    { value: 'starter', label: t.starterOnly },
    { value: 'professional', label: t.professionalOnly },
    { value: 'enterprise', label: t.enterpriseOnly }
  ];

  useEffect(() => {
    fetchCoupons();
  }, [showInactive]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/coupons/list?include_inactive=${showInactive}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setCoupons(response.data.coupons || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast.error(isRTL ? 'خطأ في جلب الكوبونات' : 'Error fetching coupons');
    } finally {
      setLoading(false);
    }
  };

  const calculateExpiryDate = (duration) => {
    if (duration === 'unlimited' || duration === 'custom') return null;
    
    const months = durationOptions.find(d => d.value === duration)?.months;
    if (!months) return null;
    
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString();
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name_ar: '',
      name_en: '',
      discount_type: 'percentage',
      discount_value: '',
      min_amount: '',
      max_discount: '',
      duration: 'unlimited',
      expiry_date: '',
      usage_limit: '',
      applicable_plans: [],
      is_active: true
    });
  };

  const handleCreateCoupon = async () => {
    if (!formData.name_ar || !formData.name_en || !formData.discount_value) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setProcessing(true);
    try {
      let expiryDate = null;
      if (formData.duration === 'custom' && formData.expiry_date) {
        expiryDate = new Date(formData.expiry_date).toISOString();
      } else if (formData.duration !== 'unlimited') {
        expiryDate = calculateExpiryDate(formData.duration);
      }

      const payload = {
        code: formData.code || null,
        name_ar: formData.name_ar,
        name_en: formData.name_en,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_amount: formData.min_amount ? parseFloat(formData.min_amount) : 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        expiry_date: expiryDate,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        applicable_plans: formData.applicable_plans.length > 0 && !formData.applicable_plans.includes('all') 
          ? formData.applicable_plans 
          : null,
        is_active: formData.is_active
      };

      await axios.post(
        `${API_URL}/api/coupons/create`,
        payload,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      toast.success(isRTL ? 'تم إنشاء الكوبون بنجاح' : 'Coupon created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error(error.response?.data?.detail || (isRTL ? 'خطأ في إنشاء الكوبون' : 'Error creating coupon'));
    } finally {
      setProcessing(false);
    }
  };

  const handleEditCoupon = async () => {
    if (!selectedCoupon) return;

    setProcessing(true);
    try {
      let expiryDate = formData.expiry_date;
      if (formData.duration === 'custom' && formData.expiry_date) {
        expiryDate = new Date(formData.expiry_date).toISOString();
      } else if (formData.duration !== 'unlimited' && formData.duration !== 'custom') {
        expiryDate = calculateExpiryDate(formData.duration);
      } else if (formData.duration === 'unlimited') {
        expiryDate = null;
      }

      const payload = {
        name_ar: formData.name_ar,
        name_en: formData.name_en,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_amount: formData.min_amount ? parseFloat(formData.min_amount) : 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        expiry_date: expiryDate,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        is_active: formData.is_active
      };

      await axios.put(
        `${API_URL}/api/coupons/${selectedCoupon.code}`,
        payload,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      toast.success(isRTL ? 'تم تحديث الكوبون بنجاح' : 'Coupon updated successfully');
      setShowEditDialog(false);
      setSelectedCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Error updating coupon:', error);
      toast.error(isRTL ? 'خطأ في تحديث الكوبون' : 'Error updating coupon');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCoupon = async () => {
    if (!selectedCoupon) return;

    setProcessing(true);
    try {
      await axios.delete(
        `${API_URL}/api/coupons/${selectedCoupon.code}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      toast.success(isRTL ? 'تم حذف الكوبون بنجاح' : 'Coupon deleted successfully');
      setShowDeleteDialog(false);
      setSelectedCoupon(null);
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error(isRTL ? 'خطأ في حذف الكوبون' : 'Error deleting coupon');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      await axios.put(
        `${API_URL}/api/coupons/${coupon.code}`,
        { is_active: !coupon.is_active },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      toast.success(isRTL ? 'تم تحديث حالة الكوبون' : 'Coupon status updated');
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCoupon || !emailData.recipient_email) {
      toast.error(isRTL ? 'يرجى إدخال الإيميل' : 'Please enter email');
      return;
    }

    setProcessing(true);
    try {
      await axios.post(
        `${API_URL}/api/coupons/send-email`,
        {
          coupon_code: selectedCoupon.code,
          recipient_email: emailData.recipient_email,
          recipient_name: emailData.recipient_name
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      toast.success(t.emailSent);
      setShowEmailDialog(false);
      setEmailData({ recipient_email: '', recipient_name: '' });
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(isRTL ? 'خطأ في إرسال الإيميل' : 'Error sending email');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportExcel = () => {
    // Create CSV content
    const headers = ['Code', 'Name (EN)', 'Name (AR)', 'Type', 'Value', 'Min Amount', 'Max Discount', 'Expiry', 'Usage Limit', 'Usage Count', 'Status'];
    const rows = coupons.map(c => [
      c.code,
      c.name_en,
      c.name_ar,
      c.discount_type,
      c.discount_value,
      c.min_amount || 0,
      c.max_discount || 'N/A',
      c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No Expiry',
      c.usage_limit || 'Unlimited',
      c.usage_count || 0,
      c.is_active ? 'Active' : 'Inactive'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coupons_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(isRTL ? 'تم تصدير الكوبونات' : 'Coupons exported');
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(isRTL ? 'تم نسخ الكود' : 'Code copied');
  };

  const openEditDialog = (coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      code: coupon.code,
      name_ar: coupon.name_ar,
      name_en: coupon.name_en,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      min_amount: coupon.min_amount?.toString() || '',
      max_discount: coupon.max_discount?.toString() || '',
      duration: coupon.expiry_date ? 'custom' : 'unlimited',
      expiry_date: coupon.expiry_date ? coupon.expiry_date.split('T')[0] : '',
      usage_limit: coupon.usage_limit?.toString() || '',
      applicable_plans: coupon.applicable_plans || [],
      is_active: coupon.is_active
    });
    setShowEditDialog(true);
  };

  const getCouponStatus = (coupon) => {
    if (!coupon.is_active) return { label: t.inactive, color: 'bg-gray-100 text-gray-700' };
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return { label: t.expired, color: 'bg-red-100 text-red-700' };
    }
    return { label: t.active, color: 'bg-green-100 text-green-700' };
  };

  const filteredCoupons = coupons.filter(coupon => 
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.name_ar.includes(searchQuery)
  );

  // Calculate stats
  const stats = {
    total: coupons.length,
    active: coupons.filter(c => c.is_active && (!c.expiry_date || new Date(c.expiry_date) > new Date())).length,
    totalUsage: coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0),
    avgDiscount: coupons.length > 0 
      ? (coupons.reduce((sum, c) => sum + c.discount_value, 0) / coupons.length).toFixed(1)
      : 0
  };

  return (
    <div className={`min-h-screen bg-gray-50 p-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="h-7 w-7 text-[#28376B]" />
              {t.title}
            </h1>
            <p className="text-gray-600 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              {t.exportExcel}
            </Button>
            <Button className="bg-[#28376B] hover:bg-[#1e2a52]" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t.createCoupon}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t.totalCoupons}</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Tag className="h-10 w-10 text-blue-500 bg-blue-50 rounded-full p-2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t.activeCoupons}</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500 bg-green-50 rounded-full p-2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t.totalUsage}</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalUsage}</p>
                </div>
                <Users className="h-10 w-10 text-purple-500 bg-purple-50 rounded-full p-2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t.avgDiscount}</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.avgDiscount}%</p>
                </div>
                <Percent className="h-10 w-10 text-orange-500 bg-orange-50 rounded-full p-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label className="text-sm">{t.showInactive}</Label>
              </div>
              <Button variant="outline" size="icon" onClick={fetchCoupons}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Coupons Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#28376B]" />
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t.noCoupons}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.code}</TableHead>
                      <TableHead>{t.name}</TableHead>
                      <TableHead>{t.type}</TableHead>
                      <TableHead>{t.discount}</TableHead>
                      <TableHead>{t.minAmount}</TableHead>
                      <TableHead>{t.expiry}</TableHead>
                      <TableHead>{t.usageCount}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCoupons.map((coupon) => {
                      const status = getCouponStatus(coupon);
                      return (
                        <TableRow key={coupon.code}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                {coupon.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(coupon.code)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{isRTL ? coupon.name_ar : coupon.name_en}</p>
                              <p className="text-xs text-gray-500">{isRTL ? coupon.name_en : coupon.name_ar}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {coupon.discount_type === 'percentage' ? (
                                <><Percent className="h-3 w-3 mr-1" />{t.percentage}</>
                              ) : (
                                <><DollarSign className="h-3 w-3 mr-1" />{t.fixed}</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {coupon.discount_type === 'percentage' 
                              ? `${coupon.discount_value}%`
                              : `$${coupon.discount_value}`
                            }
                          </TableCell>
                          <TableCell>
                            {coupon.min_amount ? `$${coupon.min_amount}` : '-'}
                          </TableCell>
                          <TableCell>
                            {coupon.expiry_date ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                {new Date(coupon.expiry_date).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-green-600 text-sm">{t.unlimited}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{coupon.usage_count || 0}</span>
                              {coupon.usage_limit && (
                                <span className="text-gray-400">/ {coupon.usage_limit}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(coupon)}
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedCoupon(coupon);
                                  setShowEmailDialog(true);
                                }}
                              >
                                <Mail className="h-4 w-4 text-purple-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedCoupon(coupon);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedCoupon(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showEditDialog ? t.editCoupon : t.createCoupon}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {!showEditDialog && (
                <div>
                  <Label>{t.code} ({isRTL ? 'اختياري' : 'Optional'})</Label>
                  <Input
                    placeholder={isRTL ? 'اتركه فارغاً للتوليد التلقائي' : 'Leave empty for auto-generation'}
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.nameAr} *</Label>
                  <Input
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="mt-1"
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label>{t.nameEn} *</Label>
                  <Input
                    value={formData.name_en}
                    onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.type}</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value) => setFormData({...formData, discount_type: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t.percentage}</SelectItem>
                      <SelectItem value="fixed">{t.fixed}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.discount} *</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({...formData, discount_value: e.target.value})}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {formData.discount_type === 'percentage' ? '%' : '$'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.minAmount}</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({...formData, min_amount: e.target.value})}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  </div>
                </div>
                <div>
                  <Label>{t.maxDiscount}</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={formData.max_discount}
                      onChange={(e) => setFormData({...formData, max_discount: e.target.value})}
                      placeholder={isRTL ? 'بدون حد' : 'No limit'}
                      disabled={formData.discount_type === 'fixed'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  </div>
                </div>
              </div>

              <div>
                <Label>{t.duration}</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) => setFormData({...formData, duration: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.duration === 'custom' && (
                <div>
                  <Label>{t.expiry}</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    className="mt-1"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <div>
                <Label>{t.usageLimit}</Label>
                <Input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                  placeholder={isRTL ? 'غير محدود' : 'Unlimited'}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
                <Label>{t.active}</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedCoupon(null);
                resetForm();
              }}>
                {t.cancel}
              </Button>
              <Button 
                className="bg-[#28376B] hover:bg-[#1e2a52]"
                onClick={showEditDialog ? handleEditCoupon : handleCreateCoupon}
                disabled={processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.deleteCoupon}</DialogTitle>
              <DialogDescription>{t.confirmDelete}</DialogDescription>
            </DialogHeader>
            {selectedCoupon && (
              <div className="py-4">
                <p className="text-center">
                  <code className="bg-red-50 text-red-700 px-3 py-1 rounded text-lg font-mono">
                    {selectedCoupon.code}
                  </code>
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                {t.cancel}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteCoupon}
                disabled={processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.sendEmail}</DialogTitle>
            </DialogHeader>
            {selectedCoupon && (
              <div className="py-4 space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500 mb-1">{t.code}</p>
                  <code className="text-xl font-mono font-bold text-[#28376B]">
                    {selectedCoupon.code}
                  </code>
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedCoupon.discount_type === 'percentage' 
                      ? `${selectedCoupon.discount_value}% ${t.discount}`
                      : `$${selectedCoupon.discount_value} ${t.discount}`
                    }
                  </p>
                </div>

                <div>
                  <Label>{t.recipientEmail} *</Label>
                  <Input
                    type="email"
                    value={emailData.recipient_email}
                    onChange={(e) => setEmailData({...emailData, recipient_email: e.target.value})}
                    placeholder="customer@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>{t.recipientName}</Label>
                  <Input
                    value={emailData.recipient_name}
                    onChange={(e) => setEmailData({...emailData, recipient_name: e.target.value})}
                    placeholder={isRTL ? 'اسم العميل' : 'Customer name'}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                {t.cancel}
              </Button>
              <Button 
                className="bg-[#28376B] hover:bg-[#1e2a52]"
                onClick={handleSendEmail}
                disabled={processing || !emailData.recipient_email}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                {t.sendEmail}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CouponManagementPage;
