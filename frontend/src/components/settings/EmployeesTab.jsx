import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Users, UserPlus, Edit2 } from 'lucide-react';

const EmployeesTab = ({ 
  language, 
  employees, 
  loadingEmployees, 
  onInviteClick, 
  onEditClick 
}) => {
  return (
    <div className="space-y-6">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditClick(emp)}
                          className="text-[#28376B] border-[#28376B] hover:bg-[#28376B] hover:text-white"
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          {language === 'ar' ? 'تعديل' : 'Edit'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeesTab;
