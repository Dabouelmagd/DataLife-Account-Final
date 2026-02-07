import React, { useState, useEffect, useCallback } from 'react';
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
import { 
  ClipboardCheck, ClipboardList, Clock, CheckCircle, XCircle, AlertCircle,
  User, Calendar, DollarSign, FileText, Send, Eye, ChevronRight,
  RefreshCw, Settings, Plus, Inbox, ArrowRight, History, Wifi, WifiOff
} from 'lucide-react';
import AttachmentsManager from './AttachmentsManager';
import useRealTimeSync from '../hooks/useRealTimeSync';

const ApprovalsModule = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [activeTab, setActiveTab] = useState('pending');
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [createForm, setCreateForm] = useState({
    type: 'expense',
    title: '',
    description: '',
    amount: '',
    currency: 'EGP'
  });

  const t = {
    approvals: isRTL ? 'الموافقات' : 'Approvals',
    pendingApprovals: isRTL ? 'في انتظار الموافقة' : 'Pending Approvals',
    myRequests: isRTL ? 'طلباتي' : 'My Requests',
    workflows: isRTL ? 'سير العمل' : 'Workflows',
    createRequest: isRTL ? 'إنشاء طلب' : 'Create Request',
    type: isRTL ? 'النوع' : 'Type',
    title: isRTL ? 'العنوان' : 'Title',
    description: isRTL ? 'الوصف' : 'Description',
    amount: isRTL ? 'المبلغ' : 'Amount',
    status: isRTL ? 'الحالة' : 'Status',
    requester: isRTL ? 'مقدم الطلب' : 'Requester',
    date: isRTL ? 'التاريخ' : 'Date',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    approve: isRTL ? 'موافقة' : 'Approve',
    reject: isRTL ? 'رفض' : 'Reject',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    view: isRTL ? 'عرض' : 'View',
    pending: isRTL ? 'قيد الانتظار' : 'Pending',
    approved: isRTL ? 'معتمد' : 'Approved',
    rejected: isRTL ? 'مرفوض' : 'Rejected',
    cancelled: isRTL ? 'ملغي' : 'Cancelled',
    leave_request: isRTL ? 'طلب إجازة' : 'Leave Request',
    expense: isRTL ? 'مصروفات' : 'Expense',
    purchase_order: isRTL ? 'أمر شراء' : 'Purchase Order',
    invoice: isRTL ? 'فاتورة' : 'Invoice',
    salary_change: isRTL ? 'تغيير راتب' : 'Salary Change',
    document: isRTL ? 'مستند' : 'Document',
    comments: isRTL ? 'تعليقات' : 'Comments',
    reason: isRTL ? 'السبب' : 'Reason',
    level: isRTL ? 'المستوى' : 'Level',
    approvalHistory: isRTL ? 'سجل الموافقات' : 'Approval History',
    noApprovals: isRTL ? 'لا توجد طلبات معلقة' : 'No pending approvals',
    noRequests: isRTL ? 'لا توجد طلبات' : 'No requests',
    requestCreated: isRTL ? 'تم إنشاء الطلب' : 'Request created',
    requestApproved: isRTL ? 'تمت الموافقة' : 'Request approved',
    requestRejected: isRTL ? 'تم الرفض' : 'Request rejected',
    myPending: isRTL ? 'طلبات تنتظر موافقتي' : 'Awaiting My Approval',
    totalRequests: isRTL ? 'إجمالي الطلبات' : 'Total Requests',
    avgApprovalTime: isRTL ? 'متوسط وقت الموافقة' : 'Avg. Approval Time',
    hours: isRTL ? 'ساعات' : 'hours',
    currentLevel: isRTL ? 'المستوى الحالي' : 'Current Level',
    of: isRTL ? 'من' : 'of',
    save: isRTL ? 'حفظ' : 'Save',
    submit: isRTL ? 'إرسال' : 'Submit'
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500'
  };

  const statusIcons = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
    cancelled: AlertCircle
  };

  const typeIcons = {
    leave_request: Calendar,
    expense: DollarSign,
    purchase_order: ClipboardList,
    invoice: FileText,
    salary_change: DollarSign,
    document: FileText
  };

  // Real-time sync handler
  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type === 'approval_updated' || message.type === 'approval_created') {
      fetchPendingApprovals();
      fetchMyRequests();
      fetchStats();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  useEffect(() => {
    fetchPendingApprovals();
    fetchMyRequests();
    fetchStats();
    fetchWorkflows();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/approvals/pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingApprovals(response.data || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/approvals/my-requests`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMyRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching my requests:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/approvals/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/approvals/workflows/list`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkflows(response.data || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  };

  const handleCreateRequest = async () => {
    try {
      await axios.post(
        `${API_URL}/api/approvals/request`,
        createForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.requestCreated);
      setShowCreateDialog(false);
      setCreateForm({ type: 'expense', title: '', description: '', amount: '', currency: 'EGP' });
      fetchMyRequests();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating request');
    }
  };

  const handleApprove = async () => {
    try {
      await axios.post(
        `${API_URL}/api/approvals/${selectedRequest.id}/approve`,
        { comments: approvalComments },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.requestApproved);
      setShowApproveDialog(false);
      setApprovalComments('');
      fetchPendingApprovals();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error approving request');
    }
  };

  const handleReject = async () => {
    try {
      await axios.post(
        `${API_URL}/api/approvals/${selectedRequest.id}/reject`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.requestRejected);
      setShowRejectDialog(false);
      setRejectionReason('');
      fetchPendingApprovals();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error rejecting request');
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من إلغاء الطلب؟' : 'Are you sure you want to cancel this request?')) {
      return;
    }
    
    try {
      await axios.post(
        `${API_URL}/api/approvals/${requestId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إلغاء الطلب' : 'Request cancelled');
      fetchMyRequests();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error cancelling request');
    }
  };

  const RequestCard = ({ request, showActions = false, isPending = false }) => {
    const TypeIcon = typeIcons[request.type] || FileText;
    const StatusIcon = statusIcons[request.status] || Clock;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPending ? 'bg-amber-100' : 'bg-blue-100'}`}>
                <TypeIcon className={`h-5 w-5 ${isPending ? 'text-amber-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h3 className="font-semibold">{request.title}</h3>
                <p className="text-sm text-gray-500">
                  {isRTL ? request.type_name_ar : request.type_name_en}
                </p>
              </div>
            </div>
            <Badge className={statusColors[request.status]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {t[request.status]}
            </Badge>
          </div>

          {request.description && (
            <p className="mt-3 text-sm text-gray-600 line-clamp-2">{request.description}</p>
          )}

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {request.amount && (
                <span className="font-semibold text-green-600">
                  {parseFloat(request.amount).toLocaleString()} {request.currency}
                </span>
              )}
              <span className="text-gray-500">
                {request.created_at?.slice(0, 10)}
              </span>
            </div>
            
            {request.status === 'pending' && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{t.level} {request.current_level}</span>
                <span>{t.of}</span>
                <span>{request.total_levels}</span>
              </div>
            )}
          </div>

          {!isPending && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <User className="h-4 w-4" />
              <span>{request.requester_name}</span>
            </div>
          )}

          {showActions && request.status === 'pending' && (
            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowApproveDialog(true);
                }}
                data-testid={`approve-${request.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {t.approve}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowRejectDialog(true);
                }}
                data-testid={`reject-${request.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                {t.reject}
              </Button>
            </div>
          )}

          {isPending && request.status === 'pending' && (
            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowViewDialog(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                {t.view}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => handleCancelRequest(request.id)}
              >
                {t.cancel}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.approvals}</h1>
          <p className="text-gray-500 mt-1">
            {isRTL ? 'إدارة طلبات الموافقة وسير العمل' : 'Manage approval requests and workflows'}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2" data-testid="create-request-btn">
          <Plus className="h-4 w-4" />
          {t.createRequest}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Inbox className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.myPending}</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.my_pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalRequests}</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.total_requests || 0}</p>
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
                <p className="text-sm text-green-600">{t.approved}</p>
                <p className="text-2xl font-bold text-green-900">{stats?.by_status?.approved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600">{t.avgApprovalTime}</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats?.average_approval_hours || 0} <span className="text-sm font-normal">{t.hours}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
            <Inbox className="h-4 w-4" />
            {t.pendingApprovals}
            {pendingApprovals.length > 0 && (
              <Badge className="bg-amber-500 text-white ml-1">{pendingApprovals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="gap-2" data-testid="tab-my-requests">
            <Send className="h-4 w-4" />
            {t.myRequests}
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2" data-testid="tab-workflows">
            <Settings className="h-4 w-4" />
            {t.workflows}
          </TabsTrigger>
        </TabsList>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-4" />
                <p className="text-gray-500">{t.noApprovals}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingApprovals.map((request) => (
                <RequestCard key={request.id} request={request} showActions />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="my-requests" className="mt-6">
          {myRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">{t.noRequests}</p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t.createRequest}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRequests.map((request) => (
                <RequestCard key={request.id} request={request} isPending />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {isRTL ? 'إعدادات سير العمل' : 'Workflow Settings'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.type} className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">
                            {isRTL ? workflow.name_ar : workflow.name_en}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {workflow.is_default 
                              ? (isRTL ? 'سير العمل الافتراضي' : 'Default workflow')
                              : (isRTL ? 'سير عمل مخصص' : 'Custom workflow')
                            }
                          </p>
                        </div>
                        <Badge variant="outline" className={workflow.is_active !== false ? 'border-green-500 text-green-600' : 'border-gray-300'}>
                          {workflow.is_active !== false 
                            ? (isRTL ? 'نشط' : 'Active')
                            : (isRTL ? 'غير نشط' : 'Inactive')
                          }
                        </Badge>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-gray-500">{isRTL ? 'المعتمدون:' : 'Approvers:'}</span>
                        <div className="flex flex-wrap gap-1">
                          {(workflow.default_approvers || workflow.approvers?.map(a => a.role) || []).map((role, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.createRequest}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.type}</Label>
              <Select value={createForm.type} onValueChange={(v) => setCreateForm({...createForm, type: v})}>
                <SelectTrigger data-testid="request-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t.expense}</SelectItem>
                  <SelectItem value="leave_request">{t.leave_request}</SelectItem>
                  <SelectItem value="purchase_order">{t.purchase_order}</SelectItem>
                  <SelectItem value="invoice">{t.invoice}</SelectItem>
                  <SelectItem value="salary_change">{t.salary_change}</SelectItem>
                  <SelectItem value="document">{t.document}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.title} *</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                placeholder={isRTL ? 'عنوان الطلب' : 'Request title'}
                data-testid="request-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                rows={3}
                data-testid="request-description-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.amount}</Label>
                <Input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({...createForm, amount: e.target.value})}
                  data-testid="request-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={createForm.currency} onValueChange={(v) => setCreateForm({...createForm, currency: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">EGP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCreateRequest} disabled={!createForm.title} data-testid="submit-request-btn">
              {t.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              {t.approve}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {selectedRequest && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold">{selectedRequest.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedRequest.description}</p>
                {selectedRequest.amount && (
                  <p className="mt-2 font-semibold text-green-600">
                    {parseFloat(selectedRequest.amount).toLocaleString()} {selectedRequest.currency}
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label>{t.comments}</Label>
              <Textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder={isRTL ? 'أضف تعليقاتك (اختياري)' : 'Add your comments (optional)'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>{t.cancel}</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} data-testid="confirm-approve-btn">
              <CheckCircle className="h-4 w-4 mr-2" />
              {t.approve}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t.reject}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {selectedRequest && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold">{selectedRequest.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedRequest.description}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>{t.reason} *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={isRTL ? 'سبب الرفض' : 'Reason for rejection'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{t.cancel}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason} data-testid="confirm-reject-btn">
              <XCircle className="h-4 w-4 mr-2" />
              {t.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selectedRequest?.title}</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.type}</p>
                  <p className="font-medium">{isRTL ? selectedRequest.type_name_ar : selectedRequest.type_name_en}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.status}</p>
                  <Badge className={statusColors[selectedRequest.status]}>
                    {t[selectedRequest.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.date}</p>
                  <p>{selectedRequest.created_at?.slice(0, 10)}</p>
                </div>
                {selectedRequest.amount && (
                  <div>
                    <p className="text-sm text-gray-500">{t.amount}</p>
                    <p className="font-semibold text-green-600">
                      {parseFloat(selectedRequest.amount).toLocaleString()} {selectedRequest.currency}
                    </p>
                  </div>
                )}
              </div>

              {selectedRequest.description && (
                <div>
                  <p className="text-sm text-gray-500">{t.description}</p>
                  <p className="mt-1 p-3 bg-gray-50 rounded">{selectedRequest.description}</p>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">
                    {t.currentLevel}: {selectedRequest.current_level} {t.of} {selectedRequest.total_levels}
                  </p>
                </div>
              )}

              {selectedRequest.approval_history?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t.approvalHistory}
                  </p>
                  <div className="space-y-2">
                    {selectedRequest.approval_history.map((entry, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${entry.action === 'approved' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{entry.user_name}</span>
                          <Badge className={entry.action === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {entry.action === 'approved' ? t.approved : t.rejected}
                          </Badge>
                        </div>
                        {entry.comments && <p className="text-sm text-gray-600 mt-1">{entry.comments}</p>}
                        {entry.reason && <p className="text-sm text-red-600 mt-1">{entry.reason}</p>}
                        <p className="text-xs text-gray-400 mt-1">{entry.timestamp?.slice(0, 16).replace('T', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalsModule;
