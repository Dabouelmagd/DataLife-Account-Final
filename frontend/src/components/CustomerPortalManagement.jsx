import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Users, Plus, Mail, Copy, Check, X, Settings, RefreshCw,
  UserPlus, Link2, Shield, Building2, ExternalLink
} from 'lucide-react';

const CustomerPortalManagement = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalCode, setPortalCode] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '' });
  const [copiedCode, setCopiedCode] = useState(false);

  const t = {
    portalManagement: isRTL ? 'إدارة بوابة العملاء' : 'Customer Portal Management',
    customers: isRTL ? 'العملاء' : 'Customers',
    inviteCustomer: isRTL ? 'دعوة عميل' : 'Invite Customer',
    setupPortal: isRTL ? 'إعداد البوابة' : 'Setup Portal',
    portalCode: isRTL ? 'كود البوابة' : 'Portal Code',
    portalUrl: isRTL ? 'رابط البوابة' : 'Portal URL',
    copyCode: isRTL ? 'نسخ الكود' : 'Copy Code',
    copied: isRTL ? 'تم النسخ' : 'Copied',
    email: isRTL ? 'البريد الإلكتروني' : 'Email',
    name: isRTL ? 'الاسم' : 'Name',
    status: isRTL ? 'الحالة' : 'Status',
    active: isRTL ? 'نشط' : 'Active',
    inactive: isRTL ? 'غير نشط' : 'Inactive',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    invite: isRTL ? 'دعوة' : 'Invite',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    enable: isRTL ? 'تفعيل' : 'Enable',
    disable: isRTL ? 'تعطيل' : 'Disable',
    noCustomers: isRTL ? 'لا يوجد عملاء مسجلين في البوابة' : 'No customers registered in portal',
    inviteSent: isRTL ? 'تم إرسال الدعوة' : 'Invitation sent',
    portalSetup: isRTL ? 'تم إعداد البوابة' : 'Portal setup complete',
    tempPassword: isRTL ? 'كلمة المرور المؤقتة' : 'Temporary Password',
    shareWithCustomer: isRTL ? 'شارك هذه المعلومات مع العميل' : 'Share this information with the customer',
    joinedAt: isRTL ? 'تاريخ الانضمام' : 'Joined At',
    description: isRTL ? 'اسمح لعملائك بالوصول إلى فواتيرهم ومدفوعاتهم' : 'Allow your customers to access their invoices and payments'
  };

  useEffect(() => {
    fetchCustomers();
    fetchPortalCode();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/customer-portal/customers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCustomers(response.data || []);
    } catch (error) {
      // Error fetching customers
    } finally {
      setLoading(false);
    }
  };

  const fetchPortalCode = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/companies/current`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPortalCode(response.data?.portal_code || null);
    } catch (error) {
      // No portal code yet
    }
  };

  const handleSetupPortal = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/customer-portal/setup-portal`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPortalCode(response.data.portal_code);
      toast.success(t.portalSetup);
      setShowSetupDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error setting up portal');
    }
  };

  const handleInviteCustomer = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/customer-portal/customers/invite`,
        inviteForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(
        <div>
          <p>{t.inviteSent}</p>
          <p className="text-sm mt-1">{t.tempPassword}: <code className="bg-gray-100 px-1 rounded">{response.data.temp_password}</code></p>
        </div>,
        { duration: 10000 }
      );
      
      setShowInviteDialog(false);
      setInviteForm({ email: '', name: '' });
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error inviting customer');
    }
  };

  const handleToggleAccess = async (customerId) => {
    try {
      await axios.put(
        `${API_URL}/api/customer-portal/customers/${customerId}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating access');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const portalUrl = portalCode 
    ? `${window.location.origin}/customer-portal?company=${portalCode}`
    : null;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.portalManagement}</h1>
          <p className="text-gray-500 mt-1">{t.description}</p>
        </div>
        <div className="flex gap-2">
          {!portalCode ? (
            <Button onClick={() => setShowSetupDialog(true)} className="gap-2" data-testid="setup-portal-btn">
              <Settings className="h-4 w-4" />
              {t.setupPortal}
            </Button>
          ) : (
            <Button onClick={() => setShowInviteDialog(true)} className="gap-2" data-testid="invite-customer-btn">
              <UserPlus className="h-4 w-4" />
              {t.inviteCustomer}
            </Button>
          )}
        </div>
      </div>

      {/* Portal Info Card */}
      {portalCode && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Link2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t.portalCode}</h3>
                  <code className="text-2xl font-bold text-blue-600">{portalCode}</code>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(portalCode)}
                  className="gap-2"
                  data-testid="copy-code-btn"
                >
                  {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copiedCode ? t.copied : t.copyCode}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(portalUrl, '_blank')}
                  className="gap-2"
                  data-testid="open-portal-btn"
                >
                  <ExternalLink className="h-4 w-4" />
                  {isRTL ? 'فتح البوابة' : 'Open Portal'}
                </Button>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white/50 rounded-lg">
              <p className="text-sm text-gray-600">{t.portalUrl}:</p>
              <code className="text-sm text-blue-600 break-all">{portalUrl}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t.customers}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{t.noCustomers}</p>
              {portalCode && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t.inviteCustomer}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.email}</TableHead>
                  <TableHead>{t.joinedAt}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-center">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name || '-'}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.created_at?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge className={customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                        {customer.is_active ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAccess(customer.id)}
                        className={customer.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                        data-testid={`toggle-${customer.id}`}
                      >
                        {customer.is_active ? (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            {t.disable}
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            {t.enable}
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Setup Portal Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t.setupPortal}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? 'سيتم إنشاء كود فريد لبوابة العملاء الخاصة بشركتك'
                : 'A unique code will be generated for your company\'s customer portal'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {isRTL 
                  ? 'بعد الإعداد، يمكنك دعوة عملائك للوصول إلى فواتيرهم ومدفوعاتهم عبر البوابة.'
                  : 'After setup, you can invite your customers to access their invoices and payments through the portal.'
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleSetupPortal} data-testid="confirm-setup-btn">
              <Settings className="h-4 w-4 mr-2" />
              {t.setupPortal}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Customer Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t.inviteCustomer}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? 'سيتم إرسال دعوة بالبريد الإلكتروني مع كلمة مرور مؤقتة'
                : 'An invitation email will be sent with a temporary password'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.email} *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                placeholder="customer@example.com"
                data-testid="invite-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.name}</Label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                placeholder={isRTL ? 'اسم العميل' : 'Customer name'}
                data-testid="invite-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>{t.cancel}</Button>
            <Button 
              onClick={handleInviteCustomer}
              disabled={!inviteForm.email}
              data-testid="send-invite-btn"
            >
              <Mail className="h-4 w-4 mr-2" />
              {t.invite}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortalManagement;
