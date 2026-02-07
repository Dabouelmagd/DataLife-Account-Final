import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Edit, Trash2, Eye, Download, Search, Filter, Calendar, DollarSign, FileText, CheckCircle, Printer, Users, TrendingUp, TrendingDown, Award, AlertCircle, File } from 'lucide-react';
import { Badge } from './ui/badge';
import { printContent, exportToPDF, generateTableHTML, generateStatsHTML } from '../utils/printExport';

// Salaries Module
export const SalariesModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const initialSalaries = [
    { id: 'E001', name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', position: language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer', basicSalary: 15000, totalSalary: 18500, status: 'paid' },
    { id: 'E002', name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', position: language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager', basicSalary: 20000, totalSalary: 24000, status: 'paid' },
    { id: 'E003', name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', position: language === 'ar' ? 'محاسب' : 'Accountant', basicSalary: 12000, totalSalary: 14500, status: 'pending' },
    { id: 'E004', name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', position: language === 'ar' ? 'مصمم جرافيك' : 'Graphic Designer', basicSalary: 10000, totalSalary: 12200, status: 'paid' }
  ];
  
  const [salaries, setSalaries] = useState(initialSalaries);
  
  // Update salaries when language changes
  React.useEffect(() => {
    setSalaries([
      { id: 'E001', name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', position: language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer', basicSalary: 15000, totalSalary: 18500, status: 'paid' },
      { id: 'E002', name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', position: language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager', basicSalary: 20000, totalSalary: 24000, status: 'paid' },
      { id: 'E003', name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', position: language === 'ar' ? 'محاسب' : 'Accountant', basicSalary: 12000, totalSalary: 14500, status: 'pending' },
      { id: 'E004', name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', position: language === 'ar' ? 'مصمم جرافيك' : 'Graphic Designer', basicSalary: 10000, totalSalary: 12200, status: 'paid' }
    ]);
  }, [language]);

  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الاسم', 'الوظيفة', 'الراتب الأساسي', 'الراتب الإجمالي', 'الحالة']
      : ['ID', 'Name', 'Position', 'Basic Salary', 'Total Salary', 'Status'];
    
    const csvData = salaries.map(salary => [
      salary.id,
      salary.name,
      salary.position,
      salary.basicSalary,
      salary.totalSalary,
      salary.status === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'معلق' : 'Pending')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility with Arabic
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `salaries_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const handleProcessPayroll = () => {
    // Process all pending salaries
    setSalaries(salaries.map(s => ({ ...s, status: 'paid' })));
    setShowProcessModal(false);
    setSuccessMessage(language === 'ar' ? 'تم معالجة المرتبات بنجاح!' : 'Payroll processed successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const handleDeleteConfirm = () => {
    setSalaries(salaries.filter(s => s.id !== selectedSalary.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'المرتبات' : 'Salaries'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </Button>
          {canEdit && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 flex items-center gap-2" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4" />
                <span>{language === 'ar' ? 'موظف جديد' : 'New Employee'}</span>
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2" onClick={() => setShowProcessModal(true)}>
                <DollarSign className="h-4 w-4" />
                <span>{language === 'ar' ? 'معالجة المرتبات' : 'Process Payroll'}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'ar' ? 'إجمالي المرتبات' : 'Total Payroll'}
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {salaries.reduce((sum, s) => sum + s.totalSalary, 0).toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'ج.م' : 'EGP'}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'ar' ? 'المدفوع' : 'Paid'}
                </p>
                <h3 className="text-3xl font-bold text-green-600">
                  {salaries.filter(s => s.status === 'paid').length}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'رواتب' : 'salaries'}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'ar' ? 'قيد الانتظار' : 'Pending'}
                </p>
                <h3 className="text-3xl font-bold text-yellow-600">
                  {salaries.filter(s => s.status === 'pending').length}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'رواتب' : 'salaries'}
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {language === 'ar' ? 'عدد الموظفين' : 'Employees'}
                </p>
                <h3 className="text-3xl font-bold text-purple-600">{salaries.length}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'موظفين' : 'employees'}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'البحث بالاسم أو الكود...' : 'Search by name or ID...'}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              <option value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</option>
              <option value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'اسم الموظف' : 'Employee Name'}</TableHead>
                <TableHead>{language === 'ar' ? 'الوظيفة' : 'Position'}</TableHead>
                <TableHead>{language === 'ar' ? 'المرتب الأساسي' : 'Basic Salary'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجمالي المرتب' : 'Total Salary'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell className="font-medium">{salary.id}</TableCell>
                  <TableCell>{salary.name}</TableCell>
                  <TableCell>{salary.position}</TableCell>
                  <TableCell>{salary.basicSalary.toLocaleString()}</TableCell>
                  <TableCell className="font-bold">{salary.totalSalary.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={salary.status === 'paid' ? 'success' : 'warning'}>
                      {salary.status === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedSalary(salary); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSalary(salary); setSuccessMessage(language === 'ar' ? 'سيتم فتح نموذج التعديل' : 'Edit form will open'); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSalary(salary); setShowDeleteModal(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {showViewModal && selectedSalary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل المرتب' : 'Salary Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedSalary.name}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الوظيفة' : 'Position'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedSalary.position}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'المرتب الأساسي' : 'Basic Salary'}</p>
                  <p className="text-lg font-bold text-green-600">{selectedSalary.basicSalary.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي المرتب' : 'Total Salary'}</p>
                  <p className="text-lg font-bold text-green-600">{selectedSalary.totalSalary.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                <Badge variant={selectedSalary.status === 'paid' ? 'success' : 'warning'}>
                  {selectedSalary.status === 'paid' ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                </Badge>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSalary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف سجل المرتب لـ ${selectedSalary.name}؟` : `Are you sure you want to delete the salary record for ${selectedSalary.name}?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Process Payroll Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowProcessModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="text-xl font-bold mb-4 text-[#28376B]">{language === 'ar' ? 'معالجة المرتبات' : 'Process Payroll'}</h3>
            <p className="mb-6 text-gray-700">{language === 'ar' ? 'هل تريد معالجة جميع المرتبات المعلقة؟' : 'Do you want to process all pending salaries?'}</p>
            <div className="flex gap-4">
              <Button onClick={handleProcessPayroll} className="flex-1 bg-[#28376B]">
                {language === 'ar' ? 'تأكيد' : 'Confirm'}
              </Button>
              <Button onClick={() => setShowProcessModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal - Enhanced */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'إضافة موظف جديد' : 'Add New Employee'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const newEmployee = {
                id: `E${String(salaries.length + 1).padStart(3, '0')}`,
                name: formData.get('name'),
                position: formData.get('position'),
                basicSalary: parseFloat(formData.get('basicSalary')),
                totalSalary: parseFloat(formData.get('basicSalary')) * 1.2,
                status: 'pending',
                photo: formData.get('photo')?.name || null,
                documents: formData.get('documents')?.name || null
              };
              setSalaries([...salaries, newEmployee]);
              setShowAddModal(false);
              setSuccessMessage(language === 'ar' ? 'تم إضافة الموظف بنجاح!' : 'Employee added successfully!');
              setShowSuccessModal(true);
              setTimeout(() => setShowSuccessModal(false), 2000);
            }} className="space-y-6">
              
              {/* Personal Photo Upload */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📸 {language === 'ar' ? 'صورة الموظف' : 'Employee Photo'}
                </label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                />
                <p className="text-xs text-gray-500 mt-2">{language === 'ar' ? 'صيغ مدعومة: JPG, PNG, JPEG (حد أقصى 5MB)' : 'Supported formats: JPG, PNG, JPEG (Max 5MB)'}</p>
              </div>

              {/* Section: Basic Information */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-[#28376B] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  {language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder={language === 'ar' ? 'أدخل الاسم الكامل' : 'Enter full name'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'رقم الهوية الوطنية' : 'National ID'}
                    </label>
                    <input
                      type="text"
                      name="nationalId"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder={language === 'ar' ? 'رقم الهوية' : 'ID Number'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                    </label>
                    <input
                      type="date"
                      name="birthDate"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'الجنس' : 'Gender'}
                    </label>
                    <select
                      name="gender"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    >
                      <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                      <option value="male">{language === 'ar' ? 'ذكر' : 'Male'}</option>
                      <option value="female">{language === 'ar' ? 'أنثى' : 'Female'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'الجنسية' : 'Nationality'}
                    </label>
                    <input
                      type="text"
                      name="nationality"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder={language === 'ar' ? 'الجنسية' : 'Nationality'}
                      defaultValue={language === 'ar' ? 'مصري' : 'Egyptian'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'الحالة الاجتماعية' : 'Marital Status'}
                    </label>
                    <select
                      name="maritalStatus"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    >
                      <option value="">{language === 'ar' ? 'اختر' : 'Select'}</option>
                      <option value="single">{language === 'ar' ? 'أعزب' : 'Single'}</option>
                      <option value="married">{language === 'ar' ? 'متزوج' : 'Married'}</option>
                      <option value="divorced">{language === 'ar' ? 'مطلق' : 'Divorced'}</option>
                      <option value="widowed">{language === 'ar' ? 'أرمل' : 'Widowed'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Contact Information */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-[#28376B] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  {language === 'ar' ? 'معلومات الاتصال' : 'Contact Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder="+201234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder="employee@example.com"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'العنوان' : 'Address'}
                    </label>
                    <textarea
                      name="address"
                      rows="2"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder={language === 'ar' ? 'أدخل العنوان الكامل' : 'Enter full address'}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Section: Employment Details */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-[#28376B] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  {language === 'ar' ? 'تفاصيل الوظيفة' : 'Employment Details'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'المسمى الوظيفي' : 'Job Position'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="position"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    >
                      <option value="">{language === 'ar' ? 'اختر الوظيفة' : 'Select Position'}</option>
                      
                      {/* Executive Management - الإدارة التنفيذية */}
                      <optgroup label={language === 'ar' ? '━━━━ الإدارة التنفيذية ━━━━' : '━━━━ Executive Management ━━━━'}>
                        <option value={language === 'ar' ? 'الرئيس التنفيذي' : 'Chief Executive Officer (CEO)'}>{language === 'ar' ? 'الرئيس التنفيذي (CEO)' : 'Chief Executive Officer (CEO)'}</option>
                        <option value={language === 'ar' ? 'المدير العام' : 'General Manager'}>{language === 'ar' ? 'المدير العام' : 'General Manager'}</option>
                        <option value={language === 'ar' ? 'نائب المدير العام' : 'Deputy General Manager'}>{language === 'ar' ? 'نائب المدير العام' : 'Deputy General Manager'}</option>
                        <option value={language === 'ar' ? 'مدير تنفيذي' : 'Executive Director'}>{language === 'ar' ? 'مدير تنفيذي' : 'Executive Director'}</option>
                      </optgroup>

                      {/* HR Department - الموارد البشرية */}
                      <optgroup label={language === 'ar' ? '━━━━ الموارد البشرية ━━━━' : '━━━━ Human Resources ━━━━'}>
                        <option value={language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager'}>{language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager'}</option>
                        <option value={language === 'ar' ? 'مسؤول موارد بشرية' : 'HR Officer'}>{language === 'ar' ? 'مسؤول موارد بشرية' : 'HR Officer'}</option>
                        <option value={language === 'ar' ? 'مسؤول التوظيف' : 'Recruitment Specialist'}>{language === 'ar' ? 'مسؤول التوظيف' : 'Recruitment Specialist'}</option>
                        <option value={language === 'ar' ? 'مسؤول الرواتب' : 'Payroll Officer'}>{language === 'ar' ? 'مسؤول الرواتب' : 'Payroll Officer'}</option>
                        <option value={language === 'ar' ? 'مسؤول التدريب والتطوير' : 'Training & Development Officer'}>{language === 'ar' ? 'مسؤول التدريب والتطوير' : 'Training & Development Officer'}</option>
                      </optgroup>

                      {/* Finance & Accounting - المالية والمحاسبة */}
                      <optgroup label={language === 'ar' ? '━━━━ المالية والمحاسبة ━━━━' : '━━━━ Finance & Accounting ━━━━'}>
                        <option value={language === 'ar' ? 'المدير المالي' : 'Chief Financial Officer (CFO)'}>{language === 'ar' ? 'المدير المالي (CFO)' : 'Chief Financial Officer (CFO)'}</option>
                        <option value={language === 'ar' ? 'مدير الحسابات' : 'Accounting Manager'}>{language === 'ar' ? 'مدير الحسابات' : 'Accounting Manager'}</option>
                        <option value={language === 'ar' ? 'محاسب عام' : 'General Accountant'}>{language === 'ar' ? 'محاسب عام' : 'General Accountant'}</option>
                        <option value={language === 'ar' ? 'محاسب تكاليف' : 'Cost Accountant'}>{language === 'ar' ? 'محاسب تكاليف' : 'Cost Accountant'}</option>
                        <option value={language === 'ar' ? 'محاسب ضرائب' : 'Tax Accountant'}>{language === 'ar' ? 'محاسب ضرائب' : 'Tax Accountant'}</option>
                        <option value={language === 'ar' ? 'مراجع مالي' : 'Financial Auditor'}>{language === 'ar' ? 'مراجع مالي' : 'Financial Auditor'}</option>
                        <option value={language === 'ar' ? 'أمين صندوق' : 'Cashier'}>{language === 'ar' ? 'أمين صندوق' : 'Cashier'}</option>
                        <option value={language === 'ar' ? 'محلل مالي' : 'Financial Analyst'}>{language === 'ar' ? 'محلل مالي' : 'Financial Analyst'}</option>
                      </optgroup>

                      {/* IT Department - تكنولوجيا المعلومات */}
                      <optgroup label={language === 'ar' ? '━━━━ تكنولوجيا المعلومات ━━━━' : '━━━━ Information Technology ━━━━'}>
                        <option value={language === 'ar' ? 'مدير تكنولوجيا المعلومات' : 'IT Manager'}>{language === 'ar' ? 'مدير تكنولوجيا المعلومات' : 'IT Manager'}</option>
                        <option value={language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer'}>{language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer'}</option>
                        <option value={language === 'ar' ? 'مطور ويب' : 'Web Developer'}>{language === 'ar' ? 'مطور ويب' : 'Web Developer'}</option>
                        <option value={language === 'ar' ? 'مطور تطبيقات موبايل' : 'Mobile App Developer'}>{language === 'ar' ? 'مطور تطبيقات موبايل' : 'Mobile App Developer'}</option>
                        <option value={language === 'ar' ? 'مهندس DevOps' : 'DevOps Engineer'}>{language === 'ar' ? 'مهندس DevOps' : 'DevOps Engineer'}</option>
                        <option value={language === 'ar' ? 'محلل بيانات' : 'Data Analyst'}>{language === 'ar' ? 'محلل بيانات' : 'Data Analyst'}</option>
                        <option value={language === 'ar' ? 'مهندس شبكات' : 'Network Engineer'}>{language === 'ar' ? 'مهندس شبكات' : 'Network Engineer'}</option>
                        <option value={language === 'ar' ? 'مسؤول أنظمة' : 'System Administrator'}>{language === 'ar' ? 'مسؤول أنظمة' : 'System Administrator'}</option>
                        <option value={language === 'ar' ? 'مهندس أمن معلومات' : 'Cybersecurity Engineer'}>{language === 'ar' ? 'مهندس أمن معلومات' : 'Cybersecurity Engineer'}</option>
                        <option value={language === 'ar' ? 'مسؤول دعم فني' : 'Technical Support'}>{language === 'ar' ? 'مسؤول دعم فني' : 'Technical Support'}</option>
                      </optgroup>

                      {/* Sales & Marketing - المبيعات والتسويق */}
                      <optgroup label={language === 'ar' ? '━━━━ المبيعات والتسويق ━━━━' : '━━━━ Sales & Marketing ━━━━'}>
                        <option value={language === 'ar' ? 'مدير المبيعات' : 'Sales Manager'}>{language === 'ar' ? 'مدير المبيعات' : 'Sales Manager'}</option>
                        <option value={language === 'ar' ? 'مدير التسويق' : 'Marketing Manager'}>{language === 'ar' ? 'مدير التسويق' : 'Marketing Manager'}</option>
                        <option value={language === 'ar' ? 'مندوب مبيعات' : 'Sales Representative'}>{language === 'ar' ? 'مندوب مبيعات' : 'Sales Representative'}</option>
                        <option value={language === 'ar' ? 'مسؤول تسويق رقمي' : 'Digital Marketing Specialist'}>{language === 'ar' ? 'مسؤول تسويق رقمي' : 'Digital Marketing Specialist'}</option>
                        <option value={language === 'ar' ? 'مسؤول وسائل التواصل الاجتماعي' : 'Social Media Specialist'}>{language === 'ar' ? 'مسؤول وسائل التواصل الاجتماعي' : 'Social Media Specialist'}</option>
                        <option value={language === 'ar' ? 'مسؤول علاقات العملاء' : 'Customer Relations Officer'}>{language === 'ar' ? 'مسؤول علاقات العملاء' : 'Customer Relations Officer'}</option>
                        <option value={language === 'ar' ? 'مسؤول خدمة العملاء' : 'Customer Service Representative'}>{language === 'ar' ? 'مسؤول خدمة العملاء' : 'Customer Service Representative'}</option>
                      </optgroup>

                      {/* Operations & Logistics - العمليات والخدمات اللوجستية */}
                      <optgroup label={language === 'ar' ? '━━━━ العمليات واللوجستيات ━━━━' : '━━━━ Operations & Logistics ━━━━'}>
                        <option value={language === 'ar' ? 'مدير العمليات' : 'Operations Manager'}>{language === 'ar' ? 'مدير العمليات' : 'Operations Manager'}</option>
                        <option value={language === 'ar' ? 'مدير المشتريات' : 'Procurement Manager'}>{language === 'ar' ? 'مدير المشتريات' : 'Procurement Manager'}</option>
                        <option value={language === 'ar' ? 'مدير المخزون' : 'Inventory Manager'}>{language === 'ar' ? 'مدير المخزون' : 'Inventory Manager'}</option>
                        <option value={language === 'ar' ? 'مدير سلسلة الإمداد' : 'Supply Chain Manager'}>{language === 'ar' ? 'مدير سلسلة الإمداد' : 'Supply Chain Manager'}</option>
                        <option value={language === 'ar' ? 'مسؤول مستودع' : 'Warehouse Officer'}>{language === 'ar' ? 'مسؤول مستودع' : 'Warehouse Officer'}</option>
                        <option value={language === 'ar' ? 'مسؤول لوجستيات' : 'Logistics Coordinator'}>{language === 'ar' ? 'مسؤول لوجستيات' : 'Logistics Coordinator'}</option>
                      </optgroup>

                      {/* Design & Creative - التصميم والإبداع */}
                      <optgroup label={language === 'ar' ? '━━━━ التصميم والإبداع ━━━━' : '━━━━ Design & Creative ━━━━'}>
                        <option value={language === 'ar' ? 'مدير إبداعي' : 'Creative Director'}>{language === 'ar' ? 'مدير إبداعي' : 'Creative Director'}</option>
                        <option value={language === 'ar' ? 'مصمم جرافيك' : 'Graphic Designer'}>{language === 'ar' ? 'مصمم جرافيك' : 'Graphic Designer'}</option>
                        <option value={language === 'ar' ? 'مصمم UI/UX' : 'UI/UX Designer'}>{language === 'ar' ? 'مصمم UI/UX' : 'UI/UX Designer'}</option>
                        <option value={language === 'ar' ? 'مصمم موشن جرافيك' : 'Motion Graphics Designer'}>{language === 'ar' ? 'مصمم موشن جرافيك' : 'Motion Graphics Designer'}</option>
                        <option value={language === 'ar' ? 'مصور فوتوغرافي' : 'Photographer'}>{language === 'ar' ? 'مصور فوتوغرافي' : 'Photographer'}</option>
                        <option value={language === 'ar' ? 'محرر فيديو' : 'Video Editor'}>{language === 'ar' ? 'محرر فيديو' : 'Video Editor'}</option>
                        <option value={language === 'ar' ? 'كاتب محتوى' : 'Content Writer'}>{language === 'ar' ? 'كاتب محتوى' : 'Content Writer'}</option>
                      </optgroup>

                      {/* Engineering & Production - الهندسة والإنتاج */}
                      <optgroup label={language === 'ar' ? '━━━━ الهندسة والإنتاج ━━━━' : '━━━━ Engineering & Production ━━━━'}>
                        <option value={language === 'ar' ? 'مدير الإنتاج' : 'Production Manager'}>{language === 'ar' ? 'مدير الإنتاج' : 'Production Manager'}</option>
                        <option value={language === 'ar' ? 'مهندس ميكانيكي' : 'Mechanical Engineer'}>{language === 'ar' ? 'مهندس ميكانيكي' : 'Mechanical Engineer'}</option>
                        <option value={language === 'ar' ? 'مهندس كهربائي' : 'Electrical Engineer'}>{language === 'ar' ? 'مهندس كهربائي' : 'Electrical Engineer'}</option>
                        <option value={language === 'ar' ? 'مهندس مدني' : 'Civil Engineer'}>{language === 'ar' ? 'مهندس مدني' : 'Civil Engineer'}</option>
                        <option value={language === 'ar' ? 'مهندس صناعي' : 'Industrial Engineer'}>{language === 'ar' ? 'مهندس صناعي' : 'Industrial Engineer'}</option>
                        <option value={language === 'ar' ? 'مراقب جودة' : 'Quality Control Inspector'}>{language === 'ar' ? 'مراقب جودة' : 'Quality Control Inspector'}</option>
                        <option value={language === 'ar' ? 'فني صيانة' : 'Maintenance Technician'}>{language === 'ar' ? 'فني صيانة' : 'Maintenance Technician'}</option>
                      </optgroup>

                      {/* Legal & Compliance - القانونية والامتثال */}
                      <optgroup label={language === 'ar' ? '━━━━ القانونية والامتثال ━━━━' : '━━━━ Legal & Compliance ━━━━'}>
                        <option value={language === 'ar' ? 'المستشار القانوني' : 'Legal Counsel'}>{language === 'ar' ? 'المستشار القانوني' : 'Legal Counsel'}</option>
                        <option value={language === 'ar' ? 'محامي' : 'Lawyer'}>{language === 'ar' ? 'محامي' : 'Lawyer'}</option>
                        <option value={language === 'ar' ? 'مسؤول امتثال' : 'Compliance Officer'}>{language === 'ar' ? 'مسؤول امتثال' : 'Compliance Officer'}</option>
                      </optgroup>

                      {/* Administrative - الإدارية */}
                      <optgroup label={language === 'ar' ? '━━━━ الوظائف الإدارية ━━━━' : '━━━━ Administrative ━━━━'}>
                        <option value={language === 'ar' ? 'مدير مكتب' : 'Office Manager'}>{language === 'ar' ? 'مدير مكتب' : 'Office Manager'}</option>
                        <option value={language === 'ar' ? 'سكرتير تنفيذي' : 'Executive Secretary'}>{language === 'ar' ? 'سكرتير تنفيذي' : 'Executive Secretary'}</option>
                        <option value={language === 'ar' ? 'موظف استقبال' : 'Receptionist'}>{language === 'ar' ? 'موظف استقبال' : 'Receptionist'}</option>
                        <option value={language === 'ar' ? 'مساعد إداري' : 'Administrative Assistant'}>{language === 'ar' ? 'مساعد إداري' : 'Administrative Assistant'}</option>
                        <option value={language === 'ar' ? 'منسق إداري' : 'Administrative Coordinator'}>{language === 'ar' ? 'منسق إداري' : 'Administrative Coordinator'}</option>
                      </optgroup>

                      {/* Others - أخرى */}
                      <optgroup label={language === 'ar' ? '━━━━ أخرى ━━━━' : '━━━━ Others ━━━━'}>
                        <option value={language === 'ar' ? 'مستشار' : 'Consultant'}>{language === 'ar' ? 'مستشار' : 'Consultant'}</option>
                        <option value={language === 'ar' ? 'باحث' : 'Researcher'}>{language === 'ar' ? 'باحث' : 'Researcher'}</option>
                        <option value={language === 'ar' ? 'متدرب' : 'Intern'}>{language === 'ar' ? 'متدرب' : 'Intern'}</option>
                        <option value={language === 'ar' ? 'سائق' : 'Driver'}>{language === 'ar' ? 'سائق' : 'Driver'}</option>
                        <option value={language === 'ar' ? 'عامل نظافة' : 'Cleaner'}>{language === 'ar' ? 'عامل نظافة' : 'Cleaner'}</option>
                        <option value={language === 'ar' ? 'حارس أمن' : 'Security Guard'}>{language === 'ar' ? 'حارس أمن' : 'Security Guard'}</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'القسم' : 'Department'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    >
                      <option value="">{language === 'ar' ? 'اختر القسم' : 'Select Department'}</option>
                      <option value="executive">{language === 'ar' ? 'الإدارة التنفيذية' : 'Executive Management'}</option>
                      <option value="hr">{language === 'ar' ? 'الموارد البشرية' : 'Human Resources'}</option>
                      <option value="finance">{language === 'ar' ? 'المالية والمحاسبة' : 'Finance & Accounting'}</option>
                      <option value="it">{language === 'ar' ? 'تكنولوجيا المعلومات' : 'Information Technology'}</option>
                      <option value="sales">{language === 'ar' ? 'المبيعات' : 'Sales'}</option>
                      <option value="marketing">{language === 'ar' ? 'التسويق' : 'Marketing'}</option>
                      <option value="operations">{language === 'ar' ? 'العمليات' : 'Operations'}</option>
                      <option value="logistics">{language === 'ar' ? 'الخدمات اللوجستية' : 'Logistics'}</option>
                      <option value="procurement">{language === 'ar' ? 'المشتريات' : 'Procurement'}</option>
                      <option value="design">{language === 'ar' ? 'التصميم والإبداع' : 'Design & Creative'}</option>
                      <option value="engineering">{language === 'ar' ? 'الهندسة' : 'Engineering'}</option>
                      <option value="production">{language === 'ar' ? 'الإنتاج' : 'Production'}</option>
                      <option value="quality">{language === 'ar' ? 'الجودة' : 'Quality Control'}</option>
                      <option value="legal">{language === 'ar' ? 'القانونية' : 'Legal & Compliance'}</option>
                      <option value="admin">{language === 'ar' ? 'الشؤون الإدارية' : 'Administration'}</option>
                      <option value="customer_service">{language === 'ar' ? 'خدمة العملاء' : 'Customer Service'}</option>
                      <option value="research">{language === 'ar' ? 'البحث والتطوير' : 'Research & Development'}</option>
                      <option value="security">{language === 'ar' ? 'الأمن والسلامة' : 'Security & Safety'}</option>
                      <option value="maintenance">{language === 'ar' ? 'الصيانة' : 'Maintenance'}</option>
                      <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'تاريخ التعيين' : 'Hire Date'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="hireDate"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'نوع العقد' : 'Contract Type'}
                    </label>
                    <select
                      name="contractType"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    >
                      <option value="permanent">{language === 'ar' ? 'دائم' : 'Permanent'}</option>
                      <option value="temporary">{language === 'ar' ? 'مؤقت' : 'Temporary'}</option>
                      <option value="contract">{language === 'ar' ? 'عقد' : 'Contract'}</option>
                      <option value="parttime">{language === 'ar' ? 'دوام جزئي' : 'Part-Time'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'الراتب الأساسي' : 'Basic Salary'} <span className="text-red-500">*</span> <span className="text-gray-400">({language === 'ar' ? 'ج.م' : 'EGP'})</span>
                    </label>
                    <input
                      type="number"
                      name="basicSalary"
                      step="100"
                      min="1000"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="10000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'حساب البنك' : 'Bank Account'}
                    </label>
                    <input
                      type="text"
                      name="bankAccount"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                      placeholder={language === 'ar' ? 'رقم الحساب البنكي' : 'Bank account number'}
                    />
                  </div>
                </div>
              </div>

              {/* Documents Upload */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-2 border-dashed border-purple-300">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📄 {language === 'ar' ? 'المستندات والأوراق الرسمية' : 'Official Documents'}
                </label>
                <input
                  type="file"
                  name="documents"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {language === 'ar' 
                    ? 'يمكنك رفع عدة ملفات: شهادات، بطاقة الهوية، عقد العمل، السيرة الذاتية، إلخ' 
                    : 'Upload multiple files: certificates, ID card, employment contract, CV, etc.'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'الصيغ المدعومة: PDF, DOC, DOCX, JPG, PNG (حد أقصى 10MB لكل ملف)' : 'Supported: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)'}
                </p>
              </div>

              {/* Emergency Contact */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">!</span>
                  {language === 'ar' ? 'جهة الاتصال في حالات الطوارئ' : 'Emergency Contact'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'اسم جهة الاتصال' : 'Contact Name'}
                    </label>
                    <input
                      type="text"
                      name="emergencyName"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder={language === 'ar' ? 'اسم الشخص' : 'Person name'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    </label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="+201234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'ar' ? 'العلاقة' : 'Relationship'}
                    </label>
                    <input
                      type="text"
                      name="emergencyRelation"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder={language === 'ar' ? 'مثال: أب، أخ، زوجة' : 'e.g., Father, Brother, Spouse'}
                    />
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-400 p-4 rounded">
                <p className="text-sm text-green-800 flex items-start gap-2">
                  <span className="text-xl">✓</span>
                  <span>
                    {language === 'ar' 
                      ? 'سيتم حساب الراتب الإجمالي تلقائياً بإضافة البدلات والخصومات. يمكنك تعديل معلومات الموظف لاحقاً من قسم إدارة الموظفين.' 
                      : 'Total salary will be calculated automatically with allowances and deductions. You can edit employee information later from the employee management section.'}
                  </span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-3">
                  <Plus className="h-5 w-5 mr-2" />
                  {language === 'ar' ? 'حفظ وإضافة الموظف' : 'Save & Add Employee'}
                </Button>
                <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" className="flex-1 text-lg py-3">
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Allowances & Overtime Module
export const AllowancesModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const [allowances, setAllowances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  
  // Fetch allowances from backend API
  React.useEffect(() => {
    const fetchAllowances = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/hr/allowances`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAllowances(data);
        } else {
          console.error('Failed to fetch allowances:', response.statusText);
          setAllowances([]);
        }
      } catch (error) {
        console.error('Error fetching allowances:', error);
        setAllowances([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllowances();
  }, [language]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [newAllowance, setNewAllowance] = useState({ employee: '', type: '', amount: '', month: '' });
  const [editAllowance, setEditAllowance] = useState({ id: '', employee: '', type: '', amount: '', month: '' });

  // Calculate statistics
  const stats = {
    totalAllowances: allowances.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    totalEmployees: new Set(allowances.map(item => item.employee_name || item.employee)).size,
    avgAllowance: allowances.length > 0 ? allowances.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) / allowances.length : 0,
    mostCommonType: allowances.length > 0 ? 
      Object.entries(allowances.reduce((acc, item) => {
        const type = item.allowance_type || item.type || 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] : 'N/A'
  };

  // Filter allowances
  const filteredAllowances = allowances.filter(item => {
    const matchesSearch = (item.employee_name || item.employee || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.allowance_type || item.type || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || (item.allowance_type || item.type) === filterType;
    const matchesMonth = filterMonth === 'all' || item.month === filterMonth;
    return matchesSearch && matchesType && matchesMonth;
  });

  // Get unique types and months for filters
  const uniqueTypes = [...new Set(allowances.map(item => item.allowance_type || item.type))].filter(Boolean);
  const uniqueMonths = [...new Set(allowances.map(item => item.month))].filter(Boolean);

  const handleAdd = () => {
    if (newAllowance.employee && newAllowance.type && newAllowance.amount) {
      const id = 'A' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      setAllowances([...allowances, { ...newAllowance, id, amount: parseFloat(newAllowance.amount) }]);
      setNewAllowance({ employee: '', type: '', amount: '', month: '' });
      setShowAddModal(false);
      setSuccessMessage(language === 'ar' ? 'تم الإضافة بنجاح!' : 'Added successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleEdit = () => {
    if (editAllowance.employee && editAllowance.type && editAllowance.amount) {
      setAllowances(allowances.map(a => 
        a.id === editAllowance.id 
          ? { ...editAllowance, amount: parseFloat(editAllowance.amount) }
          : a
      ));
      setShowEditModal(false);
      setSuccessMessage(language === 'ar' ? 'تم التعديل بنجاح!' : 'Updated successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleDeleteConfirm = () => {
    setAllowances(allowances.filter(a => a.id !== selectedItem.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الموظف', 'النوع', 'المبلغ', 'الشهر']
      : ['ID', 'Employee', 'Type', 'Amount', 'Month'];
    
    const csvData = allowances.map(item => [
      item.id,
      item.employee_name,
      item.allowance_type || item.type,
      item.amount,
      item.month
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `allowances_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'البدلات والإضافي' : 'Allowances & Overtime'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'إضافة بدل' : 'Add Allowance'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards - Professional Design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">{language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances'}</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{stats.totalAllowances.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-green-600 mt-1">{allowances.length} {language === 'ar' ? 'بدل' : 'items'}</p>
              </div>
              <div className="bg-green-200 p-3 rounded-full">
                <DollarSign className="h-8 w-8 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">{language === 'ar' ? 'عدد الموظفين' : 'Total Employees'}</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalEmployees}</p>
                <p className="text-xs text-blue-600 mt-1">{language === 'ar' ? 'موظف يستحق بدلات' : 'receiving allowances'}</p>
              </div>
              <div className="bg-blue-200 p-3 rounded-full">
                <Users className="h-8 w-8 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">{language === 'ar' ? 'متوسط البدل' : 'Average Allowance'}</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">{stats.avgAllowance.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-purple-600 mt-1">{language === 'ar' ? 'للموظف الواحد' : 'per employee'}</p>
              </div>
              <div className="bg-purple-200 p-3 rounded-full">
                <TrendingUp className="h-8 w-8 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">{language === 'ar' ? 'النوع الأكثر شيوعاً' : 'Most Common Type'}</p>
                <p className="text-xl font-bold text-orange-900 mt-2">{stats.mostCommonType}</p>
                <p className="text-xs text-orange-600 mt-1">{language === 'ar' ? 'الأكثر استخداماً' : 'most used'}</p>
              </div>
              <div className="bg-orange-200 p-3 rounded-full">
                <Award className="h-8 w-8 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث عن موظف أو نوع بدل...' : 'Search by employee or type...'}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="all">{language === 'ar' ? 'كل الشهور' : 'All Months'}</option>
                {uniqueMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B]"></div>
              <p className="mt-2 text-gray-600">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
            </div>
          ) : filteredAllowances.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">{language === 'ar' ? 'لا توجد بدلات' : 'No allowances found'}</p>
              {canEdit && (
                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                  {language === 'ar' ? 'إضافة بدل جديد' : 'Add New Allowance'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-bold">{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'اسم الموظف' : 'Employee Name'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'نوع البدل' : 'Allowance Type'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllowances.map((item, index) => (
                  <TableRow key={item.id || index} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">{item.id || `A${index + 1}`}</TableCell>
                    <TableCell>{item.employee_name || item.employee || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {item.allowance_type || item.type || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {(item.amount || 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                    <TableCell>{item.month || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { 
                            setSelectedItem(item); 
                            setShowViewModal(true); 
                          }}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setEditAllowance(item); 
                                setShowEditModal(true); 
                              }}
                            >
                              <Edit className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setSelectedItem(item); 
                                setShowDeleteModal(true); 
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {allowances.filter(a => a.type !== 'Overtime' && a.type !== 'ساعات إضافية').reduce((sum, a) => sum + a.amount, 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الساعات الإضافية' : 'Overtime'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {allowances.filter(a => a.type === 'Overtime' || a.type === 'ساعات إضافية').reduce((sum, a) => sum + a.amount, 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الإجمالي' : 'Grand Total'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {allowances.reduce((sum, a) => sum + a.amount, 0).toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          ) : allowances.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">{language === 'ar' ? 'لا توجد بدلات حالياً' : 'No allowances yet'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowances.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell>{item.employee_name}</TableCell>
                    <TableCell>
                      <Badge>{item.type}</Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-bold">{item.amount.toLocaleString()}</TableCell>
                    <TableCell>{item.month}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setShowViewModal(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setEditAllowance({ id: item.id, employee: item.employee_name, type: item.type, amount: item.amount, month: item.month }); setShowEditModal(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setShowDeleteModal(true); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {showViewModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل البدل' : 'Allowance Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.employee}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'نوع البدل' : 'Type'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.type}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'المبلغ' : 'Amount'}</p>
                <p className="text-2xl font-bold text-green-600">{selectedItem.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الشهر' : 'Month'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.month}</p>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Allowance Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="text-2xl font-bold text-[#28376B] mb-6">{language === 'ar' ? 'تعديل البدل' : 'Edit Allowance'}</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                value={editAllowance.employee}
                onChange={(e) => setEditAllowance({ ...editAllowance, employee: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="text"
                placeholder={language === 'ar' ? 'نوع البدل' : 'Allowance Type'}
                value={editAllowance.type}
                onChange={(e) => setEditAllowance({ ...editAllowance, type: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="number"
                placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                value={editAllowance.amount}
                onChange={(e) => setEditAllowance({ ...editAllowance, amount: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="text"
                placeholder={language === 'ar' ? 'الشهر' : 'Month'}
                value={editAllowance.month}
                onChange={(e) => setEditAllowance({ ...editAllowance, month: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={handleEdit} className="flex-1 bg-[#28376B]">
                {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
              <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
              <p className="text-gray-600">{language === 'ar' ? 'هل أنت متأكد من حذف هذا السجل؟' : 'Are you sure you want to delete this record?'}</p>
              <div className="bg-gray-50 p-3 rounded-lg mt-4">
                <p className="font-semibold">{selectedItem.employee} - {selectedItem.type}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{language === 'ar' ? 'تم بنجاح!' : 'Success!'}</h3>
              <p className="text-gray-600 mt-2">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Allowance Modal - Professional Modern Design */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Plus className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{language === 'ar' ? 'إضافة بدل جديد' : 'Add New Allowance'}</h3>
                    <p className="text-green-100 text-sm">{language === 'ar' ? 'املأ البيانات أدناه' : 'Fill in the details below'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Employee Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Users className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'أدخل اسم الموظف' : 'Enter employee name'}
                  value={newAllowance.employee}
                  onChange={(e) => setNewAllowance({ ...newAllowance, employee: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                />
              </div>

              {/* Allowance Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Award className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'نوع البدل' : 'Allowance Type'}
                </label>
                <select
                  value={newAllowance.type}
                  onChange={(e) => setNewAllowance({ ...newAllowance, type: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                >
                  <option value="">{language === 'ar' ? 'اختر نوع البدل' : 'Select allowance type'}</option>
                  <option value={language === 'ar' ? 'بدل انتقال' : 'Transportation'}>{language === 'ar' ? 'بدل انتقال' : 'Transportation'}</option>
                  <option value={language === 'ar' ? 'بدل سكن' : 'Housing'}>{language === 'ar' ? 'بدل سكن' : 'Housing'}</option>
                  <option value={language === 'ar' ? 'بدل وجبات' : 'Meals'}>{language === 'ar' ? 'بدل وجبات' : 'Meals'}</option>
                  <option value={language === 'ar' ? 'بدل اتصالات' : 'Communication'}>{language === 'ar' ? 'بدل اتصالات' : 'Communication'}</option>
                  <option value={language === 'ar' ? 'ساعات إضافية' : 'Overtime'}>{language === 'ar' ? 'ساعات إضافية' : 'Overtime'}</option>
                  <option value={language === 'ar' ? 'بدل خطر' : 'Hazard'}>{language === 'ar' ? 'بدل خطر' : 'Hazard'}</option>
                  <option value={language === 'ar' ? 'حوافز' : 'Bonus'}>{language === 'ar' ? 'حوافز' : 'Bonus'}</option>
                  <option value={language === 'ar' ? 'أخرى' : 'Other'}>{language === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'المبلغ' : 'Amount'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={language === 'ar' ? 'أدخل المبلغ' : 'Enter amount'}
                    value={newAllowance.amount}
                    onChange={(e) => setNewAllowance({ ...newAllowance, amount: e.target.value })}
                    className="w-full p-4 pr-16 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    {language === 'ar' ? 'ج.م' : 'EGP'}
                  </span>
                </div>
              </div>

              {/* Month */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'الشهر' : 'Month'}
                </label>
                <input
                  type="month"
                  value={newAllowance.month}
                  onChange={(e) => setNewAllowance({ ...newAllowance, month: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
              <Button 
                onClick={handleAdd} 
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                {language === 'ar' ? 'إضافة البدل' : 'Add Allowance'}
              </Button>
              <Button 
                onClick={() => setShowAddModal(false)} 
                variant="outline" 
                className="flex-1 h-12 border-2 rounded-xl font-semibold"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Deductions Module
export const DeductionsModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const initialDeductions = [
    { id: 'D001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', type: language === 'ar' ? 'تأمينات' : 'Insurance', amount: 800, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
    { id: 'D002', employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', type: language === 'ar' ? 'ضرائب' : 'Taxes', amount: 1200, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
    { id: 'D003', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', type: language === 'ar' ? 'غياب' : 'Absence', amount: 500, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
    { id: 'D004', employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', type: language === 'ar' ? 'تأمينات' : 'Insurance', amount: 600, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' }
  ];
  
  const [deductions, setDeductions] = useState(initialDeductions);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  
  // Update deductions when language changes
  React.useEffect(() => {
    setDeductions([
      { id: 'D001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', type: language === 'ar' ? 'تأمينات' : 'Insurance', amount: 800, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
      { id: 'D002', employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', type: language === 'ar' ? 'ضرائب' : 'Taxes', amount: 1200, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
      { id: 'D003', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', type: language === 'ar' ? 'غياب' : 'Absence', amount: 500, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' },
      { id: 'D004', employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', type: language === 'ar' ? 'تأمينات' : 'Insurance', amount: 600, month: language === 'ar' ? 'أكتوبر 2024' : 'October 2024' }
    ]);
  }, [language]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [newDeduction, setNewDeduction] = useState({ employee: '', type: '', amount: '', month: '' });
  const [editDeduction, setEditDeduction] = useState({ id: '', employee: '', type: '', amount: '', month: '' });

  // Calculate statistics
  const stats = {
    totalDeductions: deductions.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    totalEmployees: new Set(deductions.map(item => item.employee)).size,
    avgDeduction: deductions.length > 0 ? deductions.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) / deductions.length : 0,
    mostCommonType: deductions.length > 0 ? 
      Object.entries(deductions.reduce((acc, item) => {
        const type = item.type || 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] : 'N/A'
  };

  // Filter deductions
  const filteredDeductions = deductions.filter(item => {
    const matchesSearch = (item.employee || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.type || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesMonth = filterMonth === 'all' || item.month === filterMonth;
    return matchesSearch && matchesType && matchesMonth;
  });

  // Get unique types and months for filters
  const uniqueTypes = [...new Set(deductions.map(item => item.type))].filter(Boolean);
  const uniqueMonths = [...new Set(deductions.map(item => item.month))].filter(Boolean);

  const handleAdd = () => {
    if (newDeduction.employee && newDeduction.type && newDeduction.amount) {
      const id = 'D' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      setDeductions([...deductions, { ...newDeduction, id, amount: parseFloat(newDeduction.amount) }]);
      setNewDeduction({ employee: '', type: '', amount: '', month: '' });
      setShowAddModal(false);
      setSuccessMessage(language === 'ar' ? 'تم الإضافة بنجاح!' : 'Added successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleEdit = () => {
    if (editDeduction.employee && editDeduction.type && editDeduction.amount) {
      setDeductions(deductions.map(d => 
        d.id === editDeduction.id 
          ? { ...editDeduction, amount: parseFloat(editDeduction.amount) }
          : d
      ));
      setShowEditModal(false);
      setSuccessMessage(language === 'ar' ? 'تم التعديل بنجاح!' : 'Updated successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleDeleteConfirm = () => {
    setDeductions(deductions.filter(d => d.id !== selectedItem.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الموظف', 'النوع', 'المبلغ', 'الشهر']
      : ['ID', 'Employee', 'Type', 'Amount', 'Month'];
    
    const csvData = deductions.map(item => [
      item.id,
      item.employee,
      item.type,
      item.amount,
      item.month
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `deductions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الخصومات' : 'Deductions'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'إضافة خصم' : 'Add Deduction'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards - Professional Design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">{language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}</p>
                <p className="text-3xl font-bold text-red-900 mt-2">{stats.totalDeductions.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-red-600 mt-1">{deductions.length} {language === 'ar' ? 'خصم' : 'items'}</p>
              </div>
              <div className="bg-red-200 p-3 rounded-full">
                <TrendingDown className="h-8 w-8 text-red-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">{language === 'ar' ? 'عدد الموظفين' : 'Total Employees'}</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalEmployees}</p>
                <p className="text-xs text-blue-600 mt-1">{language === 'ar' ? 'موظف عليه خصومات' : 'with deductions'}</p>
              </div>
              <div className="bg-blue-200 p-3 rounded-full">
                <Users className="h-8 w-8 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">{language === 'ar' ? 'متوسط الخصم' : 'Average Deduction'}</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">{stats.avgDeduction.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}</p>
                <p className="text-xs text-orange-600 mt-1">{language === 'ar' ? 'للموظف الواحد' : 'per employee'}</p>
              </div>
              <div className="bg-orange-200 p-3 rounded-full">
                <DollarSign className="h-8 w-8 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">{language === 'ar' ? 'النوع الأكثر شيوعاً' : 'Most Common Type'}</p>
                <p className="text-xl font-bold text-purple-900 mt-2">{stats.mostCommonType}</p>
                <p className="text-xs text-purple-600 mt-1">{language === 'ar' ? 'الأكثر استخداماً' : 'most used'}</p>
              </div>
              <div className="bg-purple-200 p-3 rounded-full">
                <AlertCircle className="h-8 w-8 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث عن موظف أو نوع خصم...' : 'Search by employee or type...'}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="all">{language === 'ar' ? 'كل الشهور' : 'All Months'}</option>
                {uniqueMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {filteredDeductions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">{language === 'ar' ? 'لا توجد خصومات' : 'No deductions found'}</p>
              {canEdit && (
                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                  {language === 'ar' ? 'إضافة خصم جديد' : 'Add New Deduction'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-bold">{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'اسم الموظف' : 'Employee Name'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead className="font-bold">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeductions.map((item, index) => (
                  <TableRow key={item.id || index} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">{item.id}</TableCell>
                    <TableCell>{item.employee}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-red-600">
                      -{item.amount.toLocaleString()} {language === 'ar' ? 'ج.م' : 'EGP'}
                    </TableCell>
                    <TableCell>{item.month}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { 
                            setSelectedItem(item); 
                            setShowViewModal(true); 
                          }}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setEditDeduction(item); 
                                setShowEditModal(true); 
                              }}
                            >
                              <Edit className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { 
                                setSelectedItem(item); 
                                setShowDeleteModal(true); 
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals remain the same - Add, Edit, View, Delete, Success */}
      {/* View Details Modal */}
      {showViewModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل الخصم' : 'Deduction Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.employee}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'نوع الخصم' : 'Type'}</p>
                <Badge variant="destructive">{selectedItem.type}</Badge>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'المبلغ' : 'Amount'}</p>
                <p className="text-lg font-bold text-red-600">-{selectedItem.amount.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الشهر' : 'Month'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.month}</p>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Deduction Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="text-2xl font-bold text-[#28376B] mb-6">{language === 'ar' ? 'تعديل الخصم' : 'Edit Deduction'}</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={language === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                value={editDeduction.employee}
                onChange={(e) => setEditDeduction({ ...editDeduction, employee: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="text"
                placeholder={language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}
                value={editDeduction.type}
                onChange={(e) => setEditDeduction({ ...editDeduction, type: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="number"
                placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                value={editDeduction.amount}
                onChange={(e) => setEditDeduction({ ...editDeduction, amount: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
              <input
                type="text"
                placeholder={language === 'ar' ? 'الشهر' : 'Month'}
                value={editDeduction.month}
                onChange={(e) => setEditDeduction({ ...editDeduction, month: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
              />
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={handleEdit} className="flex-1 bg-[#28376B]">
                {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
              <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف خصم ${selectedItem.type} لـ ${selectedItem.employee}؟` : `Are you sure you want to delete the ${selectedItem.type} deduction for ${selectedItem.employee}?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deduction Modal - Professional Modern Design */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{language === 'ar' ? 'إضافة خصم جديد' : 'Add New Deduction'}</h3>
                    <p className="text-red-100 text-sm">{language === 'ar' ? 'املأ البيانات أدناه' : 'Fill in the details below'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Employee Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Users className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'اسم الموظف' : 'Employee Name'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'أدخل اسم الموظف' : 'Enter employee name'}
                  value={newDeduction.employee}
                  onChange={(e) => setNewDeduction({ ...newDeduction, employee: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50"
                />
              </div>

              {/* Deduction Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'نوع الخصم' : 'Deduction Type'}
                </label>
                <select
                  value={newDeduction.type}
                  onChange={(e) => setNewDeduction({ ...newDeduction, type: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50"
                >
                  <option value="">{language === 'ar' ? 'اختر نوع الخصم' : 'Select deduction type'}</option>
                  <option value={language === 'ar' ? 'تأمينات' : 'Insurance'}>{language === 'ar' ? 'تأمينات اجتماعية' : 'Social Insurance'}</option>
                  <option value={language === 'ar' ? 'ضرائب' : 'Taxes'}>{language === 'ar' ? 'ضرائب الدخل' : 'Income Tax'}</option>
                  <option value={language === 'ar' ? 'غياب' : 'Absence'}>{language === 'ar' ? 'غياب بدون عذر' : 'Unexcused Absence'}</option>
                  <option value={language === 'ar' ? 'تأخير' : 'Late'}>{language === 'ar' ? 'تأخير متكرر' : 'Repeated Lateness'}</option>
                  <option value={language === 'ar' ? 'سلفة' : 'Advance'}>{language === 'ar' ? 'سلفة على الراتب' : 'Salary Advance'}</option>
                  <option value={language === 'ar' ? 'قرض' : 'Loan'}>{language === 'ar' ? 'قسط قرض' : 'Loan Installment'}</option>
                  <option value={language === 'ar' ? 'جزاء' : 'Penalty'}>{language === 'ar' ? 'جزاء إداري' : 'Administrative Penalty'}</option>
                  <option value={language === 'ar' ? 'أخرى' : 'Other'}>{language === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'المبلغ' : 'Amount'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={language === 'ar' ? 'أدخل المبلغ' : 'Enter amount'}
                    value={newDeduction.amount}
                    onChange={(e) => setNewDeduction({ ...newDeduction, amount: e.target.value })}
                    className="w-full p-4 pr-16 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    {language === 'ar' ? 'ج.م' : 'EGP'}
                  </span>
                </div>
              </div>

              {/* Month */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  {language === 'ar' ? 'الشهر' : 'Month'}
                </label>
                <input
                  type="month"
                  value={newDeduction.month}
                  onChange={(e) => setNewDeduction({ ...newDeduction, month: e.target.value })}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
              <Button 
                onClick={handleAdd} 
                className="flex-1 h-12 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg"
              >
                <TrendingDown className="h-5 w-5 mr-2" />
                {language === 'ar' ? 'إضافة الخصم' : 'Add Deduction'}
              </Button>
              <Button 
                onClick={() => setShowAddModal(false)} 
                variant="outline" 
                className="flex-1 h-12 border-2 rounded-xl font-semibold"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Casual Leave Module
export const CasualLeaveModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const initialCasualLeaves = [
    { id: 'CL001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', date: '2024-10-05', reason: language === 'ar' ? 'ظروف عائلية' : 'Family emergency', status: 'approved' },
    { id: 'CL002', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', date: '2024-10-08', reason: language === 'ar' ? 'ظروف صحية' : 'Medical', status: 'pending' },
    { id: 'CL003', employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', date: '2024-10-10', reason: language === 'ar' ? 'ظروف طارئة' : 'Emergency', status: 'approved' }
  ];
  
  const [casualLeaves, setCasualLeaves] = useState(initialCasualLeaves);
  
  // Update casual leaves when language changes
  React.useEffect(() => {
    setCasualLeaves([
      { id: 'CL001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', date: '2024-10-05', reason: language === 'ar' ? 'ظروف عائلية' : 'Family emergency', status: 'approved' },
      { id: 'CL002', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', date: '2024-10-08', reason: language === 'ar' ? 'ظروف صحية' : 'Medical', status: 'pending' },
      { id: 'CL003', employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', date: '2024-10-10', reason: language === 'ar' ? 'ظروف طارئة' : 'Emergency', status: 'approved' }
    ]);
  }, [language]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [newLeave, setNewLeave] = useState({ employee: '', date: '', reason: '', status: 'pending' });

  const handleAdd = () => {
    if (newLeave.employee && newLeave.date && newLeave.reason) {
      const id = 'CL' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      setCasualLeaves([...casualLeaves, { ...newLeave, id }]);
      setNewLeave({ employee: '', date: '', reason: '', status: 'pending' });
      setShowAddModal(false);
      setSuccessMessage(language === 'ar' ? 'تم الإضافة بنجاح!' : 'Added successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleDeleteConfirm = () => {
    setCasualLeaves(casualLeaves.filter(l => l.id !== selectedLeave.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الموظف', 'التاريخ', 'السبب', 'الحالة']
      : ['ID', 'Employee', 'Date', 'Reason', 'Status'];
    
    const csvData = casualLeaves.map(leave => [
      leave.id,
      leave.employee,
      leave.date,
      leave.reason,
      leave.status === 'approved' ? (language === 'ar' ? 'موافق عليها' : 'Approved') : (language === 'ar' ? 'معلقة' : 'Pending')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `casual_leave_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'إضافة إجازة' : 'Add Leave'}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي الإجازات' : 'Total Leaves'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'موافق عليها' : 'Approved'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">1</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'السبب' : 'Reason'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {casualLeaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{leave.id}</TableCell>
                  <TableCell>{leave.employee}</TableCell>
                  <TableCell>{leave.date}</TableCell>
                  <TableCell>{leave.reason}</TableCell>
                  <TableCell>
                    <Badge variant={leave.status === 'approved' ? 'success' : 'warning'}>
                      {leave.status === 'approved' ? (language === 'ar' ? 'موافق' : 'Approved') : (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setSuccessMessage(language === 'ar' ? `تعديل إجازة ${leave.employee}` : `Edit leave for ${leave.employee}`); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setShowDeleteModal(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {showViewModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل الإجازة العارضة' : 'Casual Leave Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedLeave.employee}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedLeave.date}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'السبب' : 'Reason'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedLeave.reason}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                <Badge variant={selectedLeave.status === 'approved' ? 'success' : 'warning'}>
                  {selectedLeave.status === 'approved' ? (language === 'ar' ? 'موافق' : 'Approved') : (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                </Badge>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف إجازة ${selectedLeave.employee} بتاريخ ${selectedLeave.date}؟` : `Are you sure you want to delete the casual leave for ${selectedLeave.employee} on ${selectedLeave.date}?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Casual Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'إضافة إجازة عارضة' : 'Add Casual Leave'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'اسم الموظف' : 'Employee Name'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder={language === 'ar' ? 'أدخل اسم الموظف' : 'Enter employee name'} 
                  value={newLeave.employee} 
                  onChange={(e) => setNewLeave({ ...newLeave, employee: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'التاريخ' : 'Date'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={newLeave.date} 
                  onChange={(e) => setNewLeave({ ...newLeave, date: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'السبب' : 'Reason'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder={language === 'ar' ? 'أدخل سبب الإجازة' : 'Enter reason for leave'} 
                  value={newLeave.reason} 
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} 
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  required
                ></textarea>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <p className="text-sm text-blue-800">
                  {language === 'ar' 
                    ? 'ℹ️ الإجازات العارضة محدودة ويتم الموافقة عليها حسب سياسة الشركة' 
                    : 'ℹ️ Casual leaves are limited and approved based on company policy'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t">
              <Button onClick={handleAdd} className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة الإجازة' : 'Add Leave'}
              </Button>
              <Button onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Annual Leave Module
export const AnnualLeaveModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const initialAnnualLeaves = [
    { id: 'AL001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', startDate: '2024-12-15', endDate: '2024-12-25', days: 10, balance: 11, status: 'approved' },
    { id: 'AL002', employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', startDate: '2024-11-01', endDate: '2024-11-07', days: 7, balance: 14, status: 'pending' },
    { id: 'AL003', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', startDate: '2024-10-20', endDate: '2024-10-25', days: 5, balance: 16, status: 'approved' }
  ];
  
  const [annualLeaves, setAnnualLeaves] = useState(initialAnnualLeaves);
  
  // Update annual leaves when language changes
  React.useEffect(() => {
    setAnnualLeaves([
      { id: 'AL001', employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', startDate: '2024-12-15', endDate: '2024-12-25', days: 10, balance: 11, status: 'approved' },
      { id: 'AL002', employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', startDate: '2024-11-01', endDate: '2024-11-07', days: 7, balance: 14, status: 'pending' },
      { id: 'AL003', employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', startDate: '2024-10-20', endDate: '2024-10-25', days: 5, balance: 16, status: 'approved' }
    ]);
  }, [language]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [newLeave, setNewLeave] = useState({ employee: '', startDate: '', endDate: '', days: 0, balance: 21, status: 'pending' });

  const handleAdd = () => {
    if (newLeave.employee && newLeave.startDate && newLeave.endDate) {
      const id = 'AL' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      setAnnualLeaves([...annualLeaves, { ...newLeave, id, days: parseInt(newLeave.days) }]);
      setNewLeave({ employee: '', startDate: '', endDate: '', days: 0, balance: 21, status: 'pending' });
      setShowAddModal(false);
      setSuccessMessage(language === 'ar' ? 'تم الإضافة بنجاح!' : 'Added successfully!');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    }
  };

  const handleDeleteConfirm = () => {
    setAnnualLeaves(annualLeaves.filter(l => l.id !== selectedLeave.id));
    setShowDeleteModal(false);
    setSuccessMessage(language === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الموظف', 'تاريخ البداية', 'تاريخ النهاية', 'عدد الأيام', 'الرصيد المتبقي', 'الحالة']
      : ['ID', 'Employee', 'Start Date', 'End Date', 'Days', 'Balance', 'Status'];
    
    const csvData = annualLeaves.map(leave => [
      leave.id,
      leave.employee,
      leave.startDate,
      leave.endDate,
      leave.days,
      leave.balance,
      leave.status === 'approved' ? (language === 'ar' ? 'موافق عليها' : 'Approved') : (language === 'ar' ? 'معلقة' : 'Pending')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `annual_leave_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
          {canEdit && (
            <Button size="sm" className="bg-[#28376B]" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'طلب إجازة' : 'Request Leave'}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي الطلبات' : 'Total Requests'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'أيام مستخدمة' : 'Days Used'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">22</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الرصيد المتبقي' : 'Remaining Balance'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">41</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'موافق عليها' : 'Approved'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">2</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{language === 'ar' ? 'من' : 'From'}</TableHead>
                <TableHead>{language === 'ar' ? 'إلى' : 'To'}</TableHead>
                <TableHead>{language === 'ar' ? 'الأيام' : 'Days'}</TableHead>
                <TableHead>{language === 'ar' ? 'الرصيد المتبقي' : 'Balance'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annualLeaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{leave.id}</TableCell>
                  <TableCell>{leave.employee}</TableCell>
                  <TableCell>{leave.startDate}</TableCell>
                  <TableCell>{leave.endDate}</TableCell>
                  <TableCell className="font-bold">{leave.days}</TableCell>
                  <TableCell className="text-green-600">{leave.balance}</TableCell>
                  <TableCell>
                    <Badge variant={leave.status === 'approved' ? 'success' : 'warning'}>
                      {leave.status === 'approved' ? (language === 'ar' ? 'موافق' : 'Approved') : (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setSuccessMessage(language === 'ar' ? `تعديل إجازة ${leave.employee}` : `Edit leave for ${leave.employee}`); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedLeave(leave); setShowDeleteModal(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {showViewModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل الإجازة السنوية' : 'Annual Leave Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedLeave.employee}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'من' : 'Start Date'}</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedLeave.startDate}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'إلى' : 'End Date'}</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedLeave.endDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'عدد الأيام' : 'Days'}</p>
                  <p className="text-lg font-bold text-purple-600">{selectedLeave.days}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'الرصيد المتبقي' : 'Balance'}</p>
                  <p className="text-lg font-bold text-green-600">{selectedLeave.balance}</p>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                <Badge variant={selectedLeave.status === 'approved' ? 'success' : 'warning'}>
                  {selectedLeave.status === 'approved' ? (language === 'ar' ? 'موافق' : 'Approved') : (language === 'ar' ? 'قيد المراجعة' : 'Pending')}
                </Badge>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-600">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-gray-700 mb-6">
              {language === 'ar' ? `هل أنت متأكد من حذف طلب الإجازة السنوية لـ ${selectedLeave.employee} (${selectedLeave.startDate} - ${selectedLeave.endDate})؟` : `Are you sure you want to delete the annual leave request for ${selectedLeave.employee} (${selectedLeave.startDate} - ${selectedLeave.endDate})?`}
            </p>
            <div className="flex gap-4">
              <Button onClick={handleDeleteConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
                {language === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Annual Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'طلب إجازة سنوية' : 'Request Annual Leave'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'اسم الموظف' : 'Employee Name'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder={language === 'ar' ? 'أدخل اسم الموظف' : 'Enter employee name'} 
                  value={newLeave.employee} 
                  onChange={(e) => setNewLeave({ ...newLeave, employee: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'من تاريخ' : 'Start Date'} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    value={newLeave.startDate} 
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'ar' ? 'إلى تاريخ' : 'End Date'} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    value={newLeave.endDate} 
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'عدد الأيام' : 'Number of Days'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  placeholder={language === 'ar' ? 'عدد أيام الإجازة' : 'Number of leave days'} 
                  value={newLeave.days} 
                  onChange={(e) => setNewLeave({ ...newLeave, days: e.target.value })} 
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'ar' ? 'سبب الإجازة (اختياري)' : 'Reason (Optional)'}
                </label>
                <textarea
                  placeholder={language === 'ar' ? 'أدخل سبب الإجازة إن وجد' : 'Enter reason for leave if any'} 
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#28376B] focus:border-transparent"
                ></textarea>
              </div>

              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                <p className="text-sm text-green-800">
                  {language === 'ar' 
                    ? '✓ سيتم خصم عدد الأيام من رصيد الإجازات السنوية بعد الموافقة' 
                    : '✓ Days will be deducted from annual leave balance after approval'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t">
              <Button onClick={handleAdd} className="flex-1 bg-[#28376B] hover:bg-[#1f2b54]">
                <Calendar className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'تقديم الطلب' : 'Submit Request'}
              </Button>
              <Button onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// HR Reports Module
export const HRReportsModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const [reportType, setReportType] = useState('attendance');
  const [period, setPeriod] = useState('monthly');

  const reportTypes = [
    { id: 'attendance', name: language === 'ar' ? 'تقرير الحضور' : 'Attendance Report' },
    { id: 'payroll', name: language === 'ar' ? 'تقرير المرتبات' : 'Payroll Report' },
    { id: 'leaves', name: language === 'ar' ? 'تقرير الإجازات' : 'Leaves Report' },
    { id: 'overtime', name: language === 'ar' ? 'تقرير الإضافي' : 'Overtime Report' },
    { id: 'deductions', name: language === 'ar' ? 'تقرير الخصومات' : 'Deductions Report' }
  ];

  const attendanceData = [
    { employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', present: 22, absent: 1, late: 2, totalDays: 25 },
    { employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', present: 24, absent: 0, late: 1, totalDays: 25 },
    { employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', present: 20, absent: 3, late: 2, totalDays: 25 },
    { employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', present: 23, absent: 1, late: 1, totalDays: 25 }
  ];

  const payrollData = [
    { employee: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', basic: 15000, allowances: 3500, deductions: 800, net: 17700 },
    { employee: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', basic: 20000, allowances: 4000, deductions: 1200, net: 22800 },
    { employee: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', basic: 12000, allowances: 2500, deductions: 500, net: 14000 },
    { employee: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', basic: 10000, allowances: 2200, deductions: 600, net: 11600 }
  ];

  // Export to CSV function
  const exportToCSV = () => {
    let headers, csvData, filename;
    
    if (reportType === 'attendance') {
      headers = language === 'ar' 
        ? ['الموظف', 'أيام الحضور', 'أيام الغياب', 'أيام التأخير', 'إجمالي الأيام']
        : ['Employee', 'Present Days', 'Absent Days', 'Late Days', 'Total Days'];
      csvData = attendanceData.map(row => [row.employee, row.present, row.absent, row.late, row.totalDays]);
      filename = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      headers = language === 'ar'
        ? ['الموظف', 'الراتب الأساسي', 'البدلات', 'الخصومات', 'صافي الراتب']
        : ['Employee', 'Basic Salary', 'Allowances', 'Deductions', 'Net Salary'];
      csvData = payrollData.map(row => [row.employee, row.basic, row.allowances, row.deductions, row.net]);
      filename = `payroll_report_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(language === 'ar' ? 'تم تصدير التقرير بنجاح!' : 'Report exported successfully!');
  };

  // Export to PDF function
  const exportToPDF = () => {
    // Create simple text-based PDF content
    let content = language === 'ar' ? 'تقارير الموارد البشرية\n\n' : 'HR Reports\n\n';
    content += `${language === 'ar' ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString()}\n`;
    content += `${language === 'ar' ? 'نوع التقرير' : 'Report Type'}: ${reportTypes.find(r => r.id === reportType)?.name}\n\n`;
    
    if (reportType === 'attendance') {
      content += language === 'ar' ? 'بيانات الحضور:\n' : 'Attendance Data:\n';
      attendanceData.forEach(row => {
        content += `${row.employee}: ${language === 'ar' ? 'حضور' : 'Present'}: ${row.present}, ${language === 'ar' ? 'غياب' : 'Absent'}: ${row.absent}\n`;
      });
    } else {
      content += language === 'ar' ? 'بيانات المرتبات:\n' : 'Payroll Data:\n';
      payrollData.forEach(row => {
        content += `${row.employee}: ${language === 'ar' ? 'صافي' : 'Net'}: ${row.net.toLocaleString()}\n`;
      });
    }

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `hr_report_${reportType}_${new Date().toISOString().split('T')[0]}.txt`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(language === 'ar' ? 'تم تصدير التقرير بنجاح!' : 'Report exported successfully!');
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'نوع التقرير' : 'Report Type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'الفترة' : 'Period'}</CardTitle>
          </CardHeader>
          <CardContent>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="weekly">{language === 'ar' ? 'أسبوعي' : 'Weekly'}</option>
              <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
              <option value="annual">{language === 'ar' ? 'سنوي' : 'Annual'}</option>
            </select>
          </CardContent>
        </Card>
      </div>

      {reportType === 'attendance' && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'تقرير الحضور' : 'Attendance Report'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{language === 'ar' ? 'حاضر' : 'Present'}</TableHead>
                  <TableHead>{language === 'ar' ? 'غائب' : 'Absent'}</TableHead>
                  <TableHead>{language === 'ar' ? 'تأخير' : 'Late'}</TableHead>
                  <TableHead>{language === 'ar' ? 'إجمالي الأيام' : 'Total Days'}</TableHead>
                  <TableHead>{language === 'ar' ? 'نسبة الحضور' : 'Attendance %'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.employee}</TableCell>
                    <TableCell className="text-green-600">{row.present}</TableCell>
                    <TableCell className="text-red-600">{row.absent}</TableCell>
                    <TableCell className="text-yellow-600">{row.late}</TableCell>
                    <TableCell>{row.totalDays}</TableCell>
                    <TableCell className="font-bold">{((row.present / row.totalDays) * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === 'payroll' && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'تقرير المرتبات' : 'Payroll Report'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المرتب الأساسي' : 'Basic Salary'}</TableHead>
                  <TableHead>{language === 'ar' ? 'البدلات' : 'Allowances'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الخصومات' : 'Deductions'}</TableHead>
                  <TableHead>{language === 'ar' ? 'صافي المرتب' : 'Net Salary'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.employee}</TableCell>
                    <TableCell>{row.basic.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">+{row.allowances.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">-{row.deductions.toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-blue-600">{row.net.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50">
                  <TableCell className="font-bold">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                  <TableCell className="font-bold">{payrollData.reduce((sum, r) => sum + r.basic, 0).toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-green-600">+{payrollData.reduce((sum, r) => sum + r.allowances, 0).toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-red-600">-{payrollData.reduce((sum, r) => sum + r.deductions, 0).toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-blue-600">{payrollData.reduce((sum, r) => sum + r.net, 0).toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Attendance Module
export const AttendanceModule = ({ language, userRole }) => {
  const isRTL = language === 'ar';
  const canEdit = ['HR Manager', 'مدير الموارد البشرية', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(userRole);

  const [attendance, setAttendance] = useState([
    { id: 'E001', name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohamed', date: '2024-10-10', checkIn: '08:45', checkOut: '17:30', status: 'present', hours: 8.75 },
    { id: 'E002', name: language === 'ar' ? 'سارة أحمد' : 'Sara Ahmed', date: '2024-10-10', checkIn: '09:00', checkOut: '18:00', status: 'present', hours: 9 },
    { id: 'E003', name: language === 'ar' ? 'محمد علي' : 'Mohamed Ali', date: '2024-10-10', checkIn: '-', checkOut: '-', status: 'absent', hours: 0 },
    { id: 'E004', name: language === 'ar' ? 'فاطمة عمر' : 'Fatima Omar', date: '2024-10-10', checkIn: '10:00', checkOut: '17:00', status: 'late', hours: 7 }
  ]);

  const [showViewModal, setShowViewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filteredAttendance, setFilteredAttendance] = useState(attendance);

  // Filter attendance by date and search term
  React.useEffect(() => {
    let filtered = attendance;

    // Filter by date if selected
    if (selectedDate) {
      filtered = filtered.filter(record => record.date === selectedDate);
    }

    // Filter by search term (name or ID)
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAttendance(filtered);
  }, [attendance, selectedDate, searchTerm]);

  // Export to CSV function
  const exportToCSV = () => {
    const headers = language === 'ar' 
      ? ['الكود', 'الاسم', 'التاريخ', 'الدخول', 'الخروج', 'الحالة', 'الساعات']
      : ['ID', 'Name', 'Date', 'Check In', 'Check Out', 'Status', 'Hours'];
    
    const csvData = attendance.map(record => [
      record.id,
      record.name,
      record.date,
      record.checkIn,
      record.checkOut,
      record.status === 'present' ? (language === 'ar' ? 'حاضر' : 'Present') : 
      record.status === 'absent' ? (language === 'ar' ? 'غائب' : 'Absent') : 
      (language === 'ar' ? 'متأخر' : 'Late'),
      record.hours
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(language === 'ar' ? 'تم التصدير بنجاح!' : 'Exported successfully!');
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === 'ar' ? 'الحضور والانصراف' : 'Attendance'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            <span className={isRTL ? 'mr-2' : 'ml-2'}>{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        {/* Date Picker */}
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="h-5 w-5 text-blue-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Search Box */}
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-5 w-5 text-blue-600" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'ابحث بالاسم أو الكود...' : 'Search by name or ID...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600 font-medium">
          {language === 'ar' 
            ? `${filteredAttendance.length} نتيجة` 
            : `${filteredAttendance.length} results`}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredAttendance.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'حاضر' : 'Present'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {filteredAttendance.filter(a => a.status === 'present').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'غائب' : 'Absent'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {filteredAttendance.filter(a => a.status === 'absent').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{language === 'ar' ? 'تأخير' : 'Late'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredAttendance.filter(a => a.status === 'late').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الكود' : 'ID'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحضور' : 'Check In'}</TableHead>
                <TableHead>{language === 'ar' ? 'الانصراف' : 'Check Out'}</TableHead>
                <TableHead>{language === 'ar' ? 'الساعات' : 'Hours'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="8" className="text-center py-8 text-gray-500">
                    {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendance.map((record) => (
                  <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.id}</TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.checkIn}</TableCell>
                  <TableCell>{record.checkOut}</TableCell>
                  <TableCell className="font-bold">{record.hours}</TableCell>
                  <TableCell>
                    <Badge variant={
                      record.status === 'present' ? 'success' : 
                      record.status === 'absent' ? 'destructive' : 
                      'warning'
                    }>
                      {record.status === 'present' ? (language === 'ar' ? 'حاضر' : 'Present') : 
                       record.status === 'absent' ? (language === 'ar' ? 'غائب' : 'Absent') : 
                       (language === 'ar' ? 'تأخير' : 'Late')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedRecord(record); setShowViewModal(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRecord(record); setSuccessMessage(language === 'ar' ? `تعديل سجل ${record.name}` : `Edit record for ${record.name}`); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Modal */}
      {showViewModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#28376B]">{language === 'ar' ? 'تفاصيل الحضور' : 'Attendance Details'}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الموظف' : 'Employee'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedRecord.name}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                <p className="text-lg font-semibold text-gray-800">{selectedRecord.date}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'الحضور' : 'Check In'}</p>
                  <p className="text-lg font-bold text-green-600">{selectedRecord.checkIn}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'الانصراف' : 'Check Out'}</p>
                  <p className="text-lg font-bold text-red-600">{selectedRecord.checkOut}</p>
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'إجمالي الساعات' : 'Total Hours'}</p>
                <p className="text-lg font-bold text-purple-600">{selectedRecord.hours}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                <Badge variant={
                  selectedRecord.status === 'present' ? 'success' : 
                  selectedRecord.status === 'absent' ? 'destructive' : 
                  'warning'
                }>
                  {selectedRecord.status === 'present' ? (language === 'ar' ? 'حاضر' : 'Present') : 
                   selectedRecord.status === 'absent' ? (language === 'ar' ? 'غائب' : 'Absent') : 
                   (language === 'ar' ? 'تأخير' : 'Late')}
                </Badge>
              </div>
            </div>
            <Button onClick={() => setShowViewModal(false)} className="w-full mt-6 bg-[#28376B]">
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
