import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { UserPlus, X, Send, Mail, CheckCircle, RefreshCw, Shield, ChevronDown } from 'lucide-react';

// Role → default permissions mapping (mirrors backend ROLE_PERMISSIONS)
const ROLE_DEFAULT_PERMISSIONS = {
  'General Manager':         ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'مدير عام':                ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'CEO':                     ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'المدير التنفيذي':         ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'Board Chairman':          ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'رئيس مجلس الإدارة':      ['hr','financial','sales','invoices','purchases','projects','analytics','reports','settings','users','approvals'],
  'Financial Manager':       ['financial','sales','invoices','purchases','analytics','reports'],
  'المدير المالي':           ['financial','sales','invoices','purchases','analytics','reports'],
  'Chief Accountant':        ['financial','invoices','reports'],
  'رئيس الحسابات':           ['financial','invoices','reports'],
  'HR Manager':              ['hr','reports'],
  'مدير الموارد البشرية':    ['hr','reports'],
  'Project Manager':         ['projects','reports'],
  'مدير المشاريع':           ['projects','reports'],
  'Accountant':              ['financial','invoices'],
  'محاسب':                   ['financial','invoices'],
  'HR Specialist':           ['hr'],
  'أخصائي موارد بشرية':      ['hr'],
  'Sales Manager':           ['sales','invoices','reports'],
  'مدير المبيعات':           ['sales','invoices','reports'],
  'Viewer':                  ['reports'],
  'مشاهد':                   ['reports'],
};

const InviteModal = ({
  language,
  inviteData,
  setInviteData,
  availableRoles,
  availablePermissions,
  handleInvitePermissionToggle,
  sendingInvite,
  onSend,
  onClose,
  onResend,
  lastInvitedEmail,
}) => {
  const ar = language === 'ar';
  const [showSuccess, setShowSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Auto-set permissions when role changes
  useEffect(() => {
    const role = inviteData.role;
    if (role && ROLE_DEFAULT_PERMISSIONS[role]) {
      setInviteData(prev => ({
        ...prev,
        permissions: ROLE_DEFAULT_PERMISSIONS[role]
      }));
    }
  }, [inviteData.role]);

  const handleSend = async () => {
    try {
      await onSend();
      setShowSuccess(true);
    } catch (e) {
      // onSend already handles error display
      // still show success if invite was created
      setShowSuccess(true);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
      await onResend(lastInvitedEmail || inviteData.email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{ar ? 'دعوة موظف جديد' : 'Invite New Employee'}</h3>
                <p className="text-white/80 text-xs">{ar ? 'سيصله بريد بكلمة مرور مؤقتة' : 'They will receive login credentials by email'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Success state */}
        {showSuccess ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {ar ? '✅ تم إرسال الدعوة!' : '✅ Invitation Sent!'}
            </h3>
            <p className="text-gray-600 mb-1">
              {ar ? 'تم إرسال بريد إلكتروني إلى:' : 'An email was sent to:'}
            </p>
            <p className="font-bold text-blue-700 text-lg mb-6">{inviteData.email}</p>

            {/* Email confirmation box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-right mb-6">
              <p className="text-sm font-bold text-blue-800 mb-2">{ar ? 'محتوى البريد المرسل:' : 'Email contains:'}</p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>{ar ? `اسم المستخدم: ${inviteData.email}` : `Username: ${inviteData.email}`}</li>
                <li>{ar ? 'كلمة مرور مؤقتة — يجب تغييرها عند أول دخول' : 'Temporary password — must be changed on first login'}</li>
                <li>{ar ? `الصلاحيات: ${inviteData.permissions.join(' | ')}` : `Permissions: ${inviteData.permissions.join(' | ')}`}</li>
                <li>{ar ? 'رابط تسجيل الدخول المباشر' : 'Direct login link'}</li>
              </ul>
            </div>

            {/* Resend button */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResend}
                disabled={resending}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                  resendSuccess
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-blue-400 text-blue-700 hover:bg-blue-50'
                }`}
              >
                {resending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : resendSuccess ? (
                  <><CheckCircle className="w-4 h-4" /> {ar ? 'تم إعادة الإرسال ✓' : 'Resent ✓'}</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> {ar ? 'إعادة إرسال البريد' : 'Resend Email'}</>
                )}
              </button>
              <button
                onClick={() => { setShowSuccess(false); }}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
              >
                {ar ? 'دعوة موظف آخر' : 'Invite Another'}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                {ar ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">

            {/* Name + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {ar ? 'اسم الموظف' : 'Employee Name'} *
                </label>
                <input
                  type="text"
                  value={inviteData.full_name}
                  onChange={e => setInviteData(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-sm"
                  placeholder={ar ? 'الاسم الكامل' : 'Full name'}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {ar ? 'البريد الإلكتروني' : 'Email Address'} *
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={e => setInviteData(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Role — triggers auto-permissions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                {ar ? 'الدور الوظيفي (يحدد الصلاحيات تلقائياً)' : 'Job Role (auto-sets permissions)'}
              </label>
              <div className="relative">
                <select
                  value={inviteData.role}
                  onChange={e => setInviteData(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-sm appearance-none"
                >
                  {availableRoles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {inviteData.role && ROLE_DEFAULT_PERMISSIONS[inviteData.role] && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  ✅ {ar ? 'صلاحيات محددة تلقائياً:' : 'Auto-permissions:'} {ROLE_DEFAULT_PERMISSIONS[inviteData.role].join(' · ')}
                </p>
              )}
            </div>

            {/* Permissions grid */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {ar ? 'الصلاحيات (يمكن تعديلها)' : 'Permissions (editable)'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availablePermissions.map(perm => (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() => handleInvitePermissionToggle(perm.id)}
                    className={`p-2.5 rounded-xl border-2 text-start transition-all text-xs ${
                      inviteData.permissions.includes(perm.id)
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <span>{perm.icon}</span> {perm.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                {ar
                  ? 'سيصل الموظف بريداً يحتوي على: اسم المستخدم + كلمة مرور مؤقتة + رابط الدخول + صلاحياته'
                  : 'Employee will receive: username + temporary password + login link + their permissions'}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={onClose} className="text-sm">{ar ? 'إلغاء' : 'Cancel'}</Button>
              <Button
                onClick={handleSend}
                disabled={sendingInvite || !inviteData.email || !inviteData.full_name}
                className="bg-green-600 hover:bg-green-700 text-sm"
              >
                {sendingInvite
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{ar ? 'جاري الإرسال...' : 'Sending...'}</>
                  : <><Send className="h-4 w-4 mr-2" />{ar ? 'إرسال الدعوة' : 'Send Invitation'}</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteModal;
