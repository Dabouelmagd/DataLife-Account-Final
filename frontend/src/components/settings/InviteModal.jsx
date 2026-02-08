import React from 'react';
import { Button } from '../ui/button';
import { UserPlus, X, Send, Mail } from 'lucide-react';

const InviteModal = ({
  language,
  inviteData,
  setInviteData,
  availableRoles,
  availablePermissions,
  handleInvitePermissionToggle,
  sendingInvite,
  onSend,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {language === 'ar' ? 'دعوة موظف جديد' : 'Invite New Employee'}
                </h3>
                <p className="text-white/80 text-sm">
                  {language === 'ar' ? 'أرسل دعوة للانضمام إلى شركتك' : 'Send invitation to join your company'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Employee Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {language === 'ar' ? 'اسم الموظف' : 'Employee Name'} *
            </label>
            <input
              type="text"
              value={inviteData.full_name}
              onChange={(e) => setInviteData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
              placeholder={language === 'ar' ? 'أدخل اسم الموظف' : 'Enter employee name'}
            />
          </div>

          {/* Employee Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'} *
            </label>
            <input
              type="email"
              value={inviteData.email}
              onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
              placeholder={language === 'ar' ? 'example@company.com' : 'example@company.com'}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {language === 'ar' ? 'الدور الوظيفي' : 'Job Role'}
            </label>
            <select
              value={inviteData.role}
              onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
            >
              {availableRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Permissions Grid */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availablePermissions.map((perm) => (
                <button
                  key={perm.id}
                  type="button"
                  onClick={() => handleInvitePermissionToggle(perm.id)}
                  className={`p-3 rounded-xl border-2 text-start transition-all ${
                    inviteData.permissions.includes(perm.id)
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{perm.icon}</span>
                    <span className="font-medium text-sm">{perm.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-semibold mb-1">
                  {language === 'ar' ? 'ماذا سيحدث؟' : 'What happens next?'}
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>{language === 'ar' ? 'سيتم إنشاء حساب للموظف تلقائياً' : 'An account will be created automatically'}</li>
                  <li>{language === 'ar' ? 'سيتلقى الموظف بريداً إلكترونياً ببيانات الدخول' : 'Employee will receive an email with login credentials'}</li>
                  <li>{language === 'ar' ? 'يمكنه البدء بالعمل فوراً' : 'They can start working immediately'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t p-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={onSend}
            disabled={sendingInvite}
            className="bg-green-600 hover:bg-green-700"
          >
            {sendingInvite ? (
              <>{language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إرسال الدعوة' : 'Send Invitation'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
