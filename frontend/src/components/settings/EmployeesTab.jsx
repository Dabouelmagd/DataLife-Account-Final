import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Users, UserPlus, Edit2, Trash2, AlertTriangle, Loader2, Check, X, Clock } from 'lucide-react';

const EmployeesTab = ({ 
  language, 
  employees, 
  loadingEmployees, 
  onInviteClick, 
  onEditClick,
  onDeleteEmployee,
  currentUserId,
  pendingUsers = [],
  loadingPending = false,
  onApprovePending,
  onRejectPending,
}) => {
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [processingPendingId, setProcessingPendingId] = useState(null);

  const handleDelete = async (emp) => {
    setDeletingId(emp.id);
    try {
      await onDeleteEmployee(emp.id);
      setShowDeleteConfirm(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApprove = async (pendingId) => {
    setProcessingPendingId(pendingId);
    try {
      await onApprovePending?.(pendingId);
    } finally {
      setProcessingPendingId(null);
    }
  };

  const handleReject = async (pendingId) => {
    setProcessingPendingId(pendingId);
    try {
      await onRejectPending?.(pendingId);
    } finally {
      setProcessingPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Approvals Card */}
      {(pendingUsers.length > 0 || loadingPending) && (
        <Card className="border-amber-200 bg-amber-50/40" data-testid="pending-approvals-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-5 w-5" />
                {language === 'ar' ? 'طلبات الانضمام المعلّقة' : 'Pending Join Requests'}
              </div>
              <span className="text-sm font-normal text-amber-700/80">
                {pendingUsers.length} {language === 'ar' ? 'طلب' : 'pending'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="text-center py-6 text-gray-500">
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                {language === 'ar' ? 'لا توجد طلبات معلّقة' : 'No pending requests'}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-amber-200"
                    data-testid={`pending-row-${u.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{u.full_name}</p>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                        {u.requested_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {language === 'ar' ? 'تاريخ الطلب: ' : 'Requested: '}
                            {new Date(u.requested_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(u.id)}
                        disabled={processingPendingId === u.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`approve-btn-${u.id}`}
                      >
                        {processingPendingId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Check className="h-4 w-4 mr-1" />{language === 'ar' ? 'موافقة' : 'Approve'}</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(u.id)}
                        disabled={processingPendingId === u.id}
                        className="text-red-600 border-red-300 hover:bg-red-600 hover:text-white hover:border-red-600"
                        data-testid={`reject-btn-${u.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {language === 'ar' ? 'رفض' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#28376B]" />
              {language === 'ar' ? 'إدارة الموظفين' : 'Employee Management'}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-gray-500">
                {employees.length} {language === 'ar' ? 'موظف' : 'employees'}
              </span>
              <Button
                onClick={onInviteClick}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="invite-employee-btn"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'دعوة موظف جديد' : 'Invite Employee'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEmployees ? (
            <div className="text-center py-8 text-gray-500">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {language === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">
                      {language === 'ar' ? 'الاسم' : 'Name'}
                    </th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    </th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">
                      {language === 'ar' ? 'الدور الوظيفي' : 'Role'}
                    </th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">
                      {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
                    </th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">
                      {language === 'ar' ? 'الإجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#28376B] to-blue-600 flex items-center justify-center text-white font-semibold">
                            {emp.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                          </div>
                          <span className="font-medium">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{emp.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          emp.role?.includes('مدير') || emp.role?.includes('رئيس') || emp.role?.includes('Manager') || emp.role?.includes('Director')
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">
                          {emp.permissions?.length || 0} {language === 'ar' ? 'صلاحية' : 'permissions'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditClick(emp)}
                            className="text-[#28376B] border-[#28376B] hover:bg-[#28376B] hover:text-white"
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </Button>
                          {emp.id !== currentUserId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowDeleteConfirm(emp.id)}
                              className="text-red-600 border-red-300 hover:bg-red-600 hover:text-white hover:border-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                </h3>
                <p className="text-sm text-gray-500">
                  {language === 'ar' ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this employee?'}
                </p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 bg-amber-50 p-3 rounded-lg border border-amber-200">
              {language === 'ar' 
                ? 'سيتم إلغاء تفعيل حساب الموظف ولن يستطيع الدخول للنظام.'
                : 'The employee account will be deactivated and they will not be able to access the system.'}
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={() => handleDelete(employees.find(e => e.id === showDeleteConfirm))}
                disabled={deletingId === showDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deletingId === showDeleteConfirm ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'ar' ? 'جاري الحذف...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesTab;
