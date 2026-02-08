import React from 'react';
import { Button } from '../ui/button';
import { Shield, X, Save } from 'lucide-react';

const PermissionModal = ({
  language,
  employee,
  selectedRole,
  setSelectedRole,
  selectedPermissions,
  handlePermissionToggle,
  availableRoles,
  availablePermissions,
  savingPermissions,
  onSave,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#28376B] to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {language === 'ar' ? 'تعديل صلاحيات الموظف' : 'Edit Employee Settings'}
                </h3>
                <p className="text-white/80 text-sm">{employee.full_name}</p>
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
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {language === 'ar' ? 'الدور الوظيفي' : 'Job Role'}
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#28376B] focus:outline-none"
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
                  onClick={() => handlePermissionToggle(perm.id)}
                  className={`p-4 rounded-xl border-2 text-start transition-all ${
                    selectedPermissions.includes(perm.id)
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{perm.icon}</span>
                    <div>
                      <span className="font-medium block">{perm.label}</span>
                      <span className="text-xs">
                        {selectedPermissions.includes(perm.id) 
                          ? (language === 'ar' ? '✓ مفعّل' : '✓ Enabled')
                          : (language === 'ar' ? 'غير مفعّل' : 'Disabled')
                        }
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                availablePermissions.forEach(p => {
                  if (!selectedPermissions.includes(p.id)) {
                    handlePermissionToggle(p.id);
                  }
                });
              }}
              className="text-green-600 border-green-300 hover:bg-green-50"
            >
              {language === 'ar' ? 'تحديد الكل' : 'Select All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selectedPermissions.forEach(p => handlePermissionToggle(p));
              }}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {language === 'ar' ? 'إلغاء الكل' : 'Deselect All'}
            </Button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t p-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={onSave}
            disabled={savingPermissions}
            className="bg-[#28376B] hover:bg-[#1e2a52]"
          >
            {savingPermissions ? (
              <>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;
