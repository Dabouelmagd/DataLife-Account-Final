import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Users, UserPlus, Edit2, Trash2, AlertTriangle, Loader2,
         UserCheck, UserX, RefreshCw, Clock, LogIn, LogOut, Mail } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EmployeesTab = ({ 
  language, employees, loadingEmployees, onInviteClick, onEditClick,
  onDeleteEmployee, currentUserId, onRefresh, currentUserRole
}) => {
  const ar = language === 'ar';
  const [deletingId,     setDeletingId]     = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [resendingId,    setResendingId]    = useState(null);
  const [sentSuccessId,  setSentSuccessId]  = useState(null); // shows ✅ after resend
  const [expandedSession, setExpandedSession] = useState(null);

  // Only managers/admins see session data
  const isManager = ['General Manager','مدير عام','CEO','المدير التنفيذي',
                      'Board Chairman','رئيس مجلس الإدارة','SUPER_ADMIN',
                      'TOP_MANAGEMENT'].includes(currentUserRole);

  const handleDelete = async (emp) => {
    setDeletingId(emp.id);
    try { await onDeleteEmployee(emp.id); setShowDeleteConfirm(null); }
    finally { setDeletingId(null); }
  };

  const handleReactivate = async (emp) => {
    setReactivatingId(emp.id);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_URL}/api/users/${emp.id}/reactivate`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r.ok) { toast.success(ar ? 'تم تفعيل الحساب' : 'Account activated'); onRefresh?.(); }
      else { const e = await r.json(); toast.error(e.detail || (ar ? 'فشل التفعيل' : 'Failed')); }
    } catch { toast.error(ar ? 'حدث خطأ' : 'Error'); }
    finally { setReactivatingId(null); }
  };

  const handleResendInvite = async (emp) => {
    setResendingId(emp.id);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_URL}/api/users/${emp.id}/resend-invite`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r.ok) { setSentSuccessId(emp.id); setTimeout(() => setSentSuccessId(null), 4000); toast.success(ar ? `✅ تم إعادة إرسال الدعوة إلى ${emp.email}` : `✅ Invite resent to ${emp.email}`);}
      else      toast.error(ar ? 'فشل الإرسال' : 'Failed to resend');
    } catch { toast.error(ar ? 'حدث خطأ' : 'Error'); }
    finally { setResendingId(null); }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US', {
        day:'2-digit', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
    } catch { return iso?.slice(0,16) || '—'; }
  };

  const formatDuration = (mins) => {
    if (!mins) return '—';
    if (mins < 60) return `${mins} ${ar ? 'د' : 'min'}`;
    return `${Math.floor(mins/60)}${ar?'س':'h'} ${mins%60}${ar?'د':'m'}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#28376B]" />
              {ar ? 'إدارة الموظفين' : 'Employee Management'}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-gray-500">
                {employees.length} {ar ? 'موظف' : 'employees'}
              </span>
              <Button onClick={onInviteClick} className="bg-green-600 hover:bg-green-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                {ar ? 'دعوة موظف' : 'Invite Employee'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEmployees ? (
            <div className="text-center py-8 text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {ar ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{ar ? 'لا يوجد موظفون بعد' : 'No employees yet'}</p>
              <button onClick={onInviteClick} className="mt-3 text-sm text-green-600 underline">
                {ar ? 'دعوة أول موظف' : 'Invite first employee'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'الموظف' : 'Employee'}</th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'البريد' : 'Email'}</th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'الدور' : 'Role'}</th>
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'الحالة' : 'Status'}</th>
                    {isManager && (
                      <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'آخر دخول' : 'Last Login'}</th>
                    )}
                    <th className="text-start py-3 px-4 font-semibold text-gray-600">{ar ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <React.Fragment key={emp.id}>
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${emp.is_active === false ? 'bg-red-50/50' : ''}`}>

                        {/* Avatar + Name + Photo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {emp.profile_photo ? (
                              <img
                                src={emp.profile_photo}
                                alt={emp.full_name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                                emp.is_active === false ? 'bg-gray-400' : 'bg-gradient-to-br from-[#28376B] to-blue-600'
                              }`}>
                                {emp.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U'}
                              </div>
                            )}
                            <div>
                              <p className={`font-medium ${emp.is_active === false ? 'text-gray-400' : 'text-gray-800'}`}>
                                {emp.full_name}
                              </p>
                              {emp.is_online && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                                  {ar ? 'متصل الآن' : 'Online now'}
                                </span>
                              )}
                              {!emp.has_logged_in && emp.is_active !== false && 
                               !['رئيس مجلس الإدارة', 'مدير عام', 'Board Chairman', 'CEO', 'General Manager', 'المدير التنفيذي'].includes(emp.role) && (
                                <span className="text-xs text-amber-600 font-medium">
                                  {ar ? '⚠️ لم يدخل بعد' : '⚠️ Never logged in'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className={`py-3 px-4 ${emp.is_active === false ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span className="truncate max-w-[160px] block">{emp.email}</span>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            emp.is_active === false ? 'bg-gray-100 text-gray-500' :
                            emp.role?.match(/مدير|رئيس|Manager|Director|CEO|Chairman/i)
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {emp.role || '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {emp.is_active === false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              <UserX className="w-3 h-3" /> {ar ? 'معطل' : 'Disabled'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              <UserCheck className="w-3 h-3" /> {ar ? 'نشط' : 'Active'}
                            </span>
                          )}
                        </td>

                        {/* Session info — managers only */}
                        {isManager && (
                          <td className="py-3 px-4">
                            <div className="text-xs text-gray-500">
                              {emp.last_login ? (
                                <div>
                                  <div className="flex items-center gap-1 text-blue-600 font-medium">
                                    <LogIn className="w-3 h-3" />
                                    {formatDate(emp.last_login)}
                                  </div>
                                  {emp.last_logout && (
                                    <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                                      <LogOut className="w-3 h-3" />
                                      {formatDate(emp.last_logout)}
                                    </div>
                                  )}
                                  {emp.last_session_duration_minutes && (
                                    <div className="flex items-center gap-1 text-amber-600 mt-0.5">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(emp.last_session_duration_minutes)}
                                    </div>
                                  )}
                                  {emp.login_sessions?.length > 0 && (
                                    <button
                                      onClick={() => setExpandedSession(expandedSession === emp.id ? null : emp.id)}
                                      className="text-xs text-blue-500 underline mt-1"
                                    >
                                      {ar ? `${emp.login_sessions.length} جلسة` : `${emp.login_sessions.length} sessions`}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">{ar ? 'لم يدخل بعد' : 'Never logged in'}</span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Actions */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {emp.is_active === false ? (
                              <Button variant="outline" size="sm"
                                onClick={() => handleReactivate(emp)}
                                disabled={reactivatingId === emp.id}
                                className="text-green-600 border-green-300 hover:bg-green-600 hover:text-white text-xs">
                                {reactivatingId === emp.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <><UserCheck className="h-3 w-3 mr-1" />{ar ? 'تفعيل' : 'Activate'}</>
                                }
                              </Button>
                            ) : (
                              <>
                                <Button variant="outline" size="sm"
                                  onClick={() => onEditClick(emp)}
                                  className="text-[#28376B] border-[#28376B] hover:bg-[#28376B] hover:text-white text-xs">
                                  <Edit2 className="h-3 w-3 mr-1" />{ar ? 'تعديل' : 'Edit'}
                                </Button>

                                {/* Resend invite — show if never logged in AND not a founder */}
                                {!emp.has_logged_in && 
                                 !['رئيس مجلس الإدارة', 'مدير عام', 'Board Chairman', 'CEO', 'General Manager', 'المدير التنفيذي'].includes(emp.role) && (
                                  <Button variant="outline" size="sm"
                                    onClick={() => handleResendInvite(emp)}
                                    disabled={resendingId === emp.id}
                                    className="text-blue-600 border-blue-300 hover:bg-blue-600 hover:text-white text-xs">
                                    {resendingId === emp.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><Mail className="h-3 w-3 mr-1" />{ar ? 'إعادة إرسال' : 'Resend'}</>
                                    }
                                  </Button>
                                )}
                                {sentSuccessId === emp.id && (
                                  <span className="text-green-600 text-xs font-semibold flex items-center gap-1">
                                    ✅ {ar ? 'تم الإرسال!' : 'Sent!'}
                                  </span>
                                )}

                                {emp.id !== currentUserId && (
                                  <Button variant="outline" size="sm"
                                    onClick={() => setShowDeleteConfirm(emp.id)}
                                    className="text-red-600 border-red-300 hover:bg-red-600 hover:text-white text-xs">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Session history row */}
                      {isManager && expandedSession === emp.id && emp.login_sessions?.length > 0 && (
                        <tr>
                          <td colSpan={isManager ? 6 : 5} className="bg-blue-50/40 px-4 py-3">
                            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ar ? 'آخر جلسات العمل:' : 'Recent sessions:'}
                            </p>
                            <div className="space-y-1.5">
                              {[...emp.login_sessions].reverse().slice(0,10).map((s, idx) => (
                                <div key={idx} className="flex items-center gap-4 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                  <span className="flex items-center gap-1 text-green-700">
                                    <LogIn className="w-3 h-3" />
                                    {formatDate(s.login_at)}
                                  </span>
                                  {s.logout_at && (
                                    <span className="flex items-center gap-1 text-gray-500">
                                      <LogOut className="w-3 h-3" />
                                      {formatDate(s.logout_at)}
                                    </span>
                                  )}
                                  {s.duration_minutes && (
                                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(s.duration_minutes)}
                                    </span>
                                  )}
                                  {!s.logout_at && (
                                    <span className="text-green-500 font-medium animate-pulse">
                                      {ar ? '● متصل' : '● Active'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
              <div className="p-3 bg-red-100 rounded-full"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="text-lg font-bold">{ar ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
                <p className="text-sm text-gray-500">{ar ? 'هل أنت متأكد؟' : 'Are you sure?'}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 bg-amber-50 p-3 rounded-lg border border-amber-200">
              {ar ? 'سيتم إلغاء تفعيل حساب الموظف ولن يستطيع الدخول للنظام.' : 'The employee account will be deactivated.'}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="flex-1">
                {ar ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={() => handleDelete(employees.find(e => e.id === showDeleteConfirm))}
                disabled={deletingId === showDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {deletingId === showDeleteConfirm
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{ar ? 'جاري...' : 'Deleting...'}</>
                  : <><Trash2 className="h-4 w-4 mr-2" />{ar ? 'حذف' : 'Delete'}</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesTab;
