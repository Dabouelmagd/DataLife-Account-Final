import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Upload, FileText, Calendar, DollarSign, Clock, 
  Building, Phone, Mail, MapPin, CreditCard, Shield,
  Plus, Trash2, Edit, Save, X, ChevronLeft, Camera,
  Briefcase, Heart, AlertCircle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EmployeeProfilePage = ({ employeeId, onBack, language = 'ar' }) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [shifts, setShifts] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  
  // Modals
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);

  const isRTL = language === 'ar';

  const t = {
    ar: {
      back: 'رجوع',
      employee_profile: 'ملف الموظف',
      personal_info: 'المعلومات الشخصية',
      employment: 'البيانات الوظيفية',
      salary: 'الراتب والبدلات',
      documents: 'المستندات',
      history: 'سجل الرواتب',
      shifts: 'الورديات',
      
      // Personal Info
      name: 'الاسم',
      name_en: 'الاسم (إنجليزي)',
      national_id: 'الرقم القومي',
      birth_date: 'تاريخ الميلاد',
      gender: 'النوع',
      male: 'ذكر',
      female: 'أنثى',
      marital_status: 'الحالة الاجتماعية',
      single: 'أعزب',
      married: 'متزوج',
      nationality: 'الجنسية',
      phone: 'الهاتف',
      mobile: 'المحمول',
      email: 'البريد الإلكتروني',
      address: 'العنوان',
      emergency_contact: 'جهة اتصال طوارئ',
      emergency_phone: 'هاتف الطوارئ',
      
      // Employment
      employee_code: 'كود الموظف',
      position: 'الوظيفة',
      department: 'القسم',
      branch: 'الفرع',
      hire_date: 'تاريخ التعيين',
      contract_type: 'نوع العقد',
      permanent: 'دائم',
      temporary: 'مؤقت',
      contract: 'عقد',
      contract_end_date: 'نهاية العقد',
      
      // Salary
      basic_salary: 'الراتب الأساسي',
      allowances: 'البدلات',
      deductions: 'الخصومات',
      gross_salary: 'إجمالي الراتب',
      net_salary: 'صافي الراتب',
      total_allowances: 'إجمالي البدلات',
      total_deductions: 'إجمالي الخصومات',
      
      // Insurance
      social_insurance: 'التأمينات الاجتماعية',
      social_insurance_number: 'رقم التأمينات',
      insurance_salary: 'الأجر التأميني',
      health_insurance: 'التأمين الصحي',
      health_insurance_number: 'رقم التأمين الصحي',
      health_insurance_company: 'شركة التأمين',
      health_insurance_amount: 'قيمة التأمين الصحي',
      medical_allowance: 'بدل العلاج',
      medical_balance: 'رصيد العلاج',
      
      // Documents
      upload_document: 'رفع مستند',
      document_type: 'نوع المستند',
      document_name: 'اسم المستند',
      expiry_date: 'تاريخ الانتهاء',
      contract_doc: 'عقد العمل',
      national_id_doc: 'البطاقة الشخصية',
      passport: 'جواز السفر',
      certificate: 'شهادة',
      insurance_card: 'كارنيه التأمين',
      medical_report: 'تقرير طبي',
      other: 'أخرى',
      
      // Actions
      edit: 'تعديل',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      add: 'إضافة',
      upload: 'رفع',
      upload_photo: 'رفع صورة',
      
      // Allowance Categories
      housing: 'بدل سكن',
      transportation: 'بدل انتقال',
      phone_allowance: 'بدل هاتف',
      meal: 'بدل وجبات',
      clothing: 'بدل ملابس',
      representation: 'بدل تمثيل',
      nature_of_work: 'بدل طبيعة عمل',
      
      // Deduction Categories
      social_insurance_ded: 'تأمينات اجتماعية',
      health_insurance_ded: 'تأمين صحي',
      medical: 'علاج',
      income_tax: 'ضريبة كسب العمل',
      absence: 'خصم غياب',
      late: 'خصم تأخير',
      penalty: 'جزاء',
      
      // Bank
      bank_info: 'البيانات البنكية',
      bank_name: 'اسم البنك',
      bank_account: 'رقم الحساب',
      iban: 'IBAN',
      
      // Leaves
      leave_balance: 'رصيد الإجازات',
      annual_leave: 'إجازة سنوية',
      sick_leave: 'إجازة مرضية',
      casual_leave: 'إجازة عارضة',
      days: 'يوم',
      
      no_documents: 'لا توجد مستندات',
      no_history: 'لا يوجد سجل رواتب',
      month: 'الشهر',
      status: 'الحالة',
      approved: 'معتمد',
      paid: 'مدفوع',
      
      amount: 'المبلغ',
      percentage: 'النسبة',
      is_taxable: 'خاضع للضريبة',
      yes: 'نعم',
      no: 'لا',
      
      current_shift: 'الوردية الحالية',
      assign_shift: 'تعيين وردية',
      shift_name: 'اسم الوردية',
      start_time: 'وقت البداية',
      end_time: 'وقت النهاية',
      working_hours: 'ساعات العمل',
    },
    en: {
      back: 'Back',
      employee_profile: 'Employee Profile',
      personal_info: 'Personal Information',
      employment: 'Employment Data',
      salary: 'Salary & Benefits',
      documents: 'Documents',
      history: 'Payroll History',
      shifts: 'Shifts',
      name: 'Name',
      name_en: 'Name (English)',
      national_id: 'National ID',
      birth_date: 'Birth Date',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      marital_status: 'Marital Status',
      single: 'Single',
      married: 'Married',
      nationality: 'Nationality',
      phone: 'Phone',
      mobile: 'Mobile',
      email: 'Email',
      address: 'Address',
      emergency_contact: 'Emergency Contact',
      emergency_phone: 'Emergency Phone',
      employee_code: 'Employee Code',
      position: 'Position',
      department: 'Department',
      branch: 'Branch',
      hire_date: 'Hire Date',
      contract_type: 'Contract Type',
      permanent: 'Permanent',
      temporary: 'Temporary',
      contract: 'Contract',
      contract_end_date: 'Contract End Date',
      basic_salary: 'Basic Salary',
      allowances: 'Allowances',
      deductions: 'Deductions',
      gross_salary: 'Gross Salary',
      net_salary: 'Net Salary',
      total_allowances: 'Total Allowances',
      total_deductions: 'Total Deductions',
      social_insurance: 'Social Insurance',
      social_insurance_number: 'Social Insurance Number',
      insurance_salary: 'Insurable Salary',
      health_insurance: 'Health Insurance',
      health_insurance_number: 'Health Insurance Number',
      health_insurance_company: 'Insurance Company',
      health_insurance_amount: 'Health Insurance Amount',
      medical_allowance: 'Medical Allowance',
      medical_balance: 'Medical Balance',
      upload_document: 'Upload Document',
      document_type: 'Document Type',
      document_name: 'Document Name',
      expiry_date: 'Expiry Date',
      contract_doc: 'Employment Contract',
      national_id_doc: 'National ID',
      passport: 'Passport',
      certificate: 'Certificate',
      insurance_card: 'Insurance Card',
      medical_report: 'Medical Report',
      other: 'Other',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      add: 'Add',
      upload: 'Upload',
      upload_photo: 'Upload Photo',
      housing: 'Housing',
      transportation: 'Transportation',
      phone_allowance: 'Phone',
      meal: 'Meal',
      clothing: 'Clothing',
      representation: 'Representation',
      nature_of_work: 'Nature of Work',
      social_insurance_ded: 'Social Insurance',
      health_insurance_ded: 'Health Insurance',
      medical: 'Medical',
      income_tax: 'Income Tax',
      absence: 'Absence',
      late: 'Late',
      penalty: 'Penalty',
      bank_info: 'Bank Information',
      bank_name: 'Bank Name',
      bank_account: 'Account Number',
      iban: 'IBAN',
      leave_balance: 'Leave Balance',
      annual_leave: 'Annual Leave',
      sick_leave: 'Sick Leave',
      casual_leave: 'Casual Leave',
      days: 'days',
      no_documents: 'No documents',
      no_history: 'No payroll history',
      month: 'Month',
      status: 'Status',
      approved: 'Approved',
      paid: 'Paid',
      amount: 'Amount',
      percentage: 'Percentage',
      is_taxable: 'Taxable',
      yes: 'Yes',
      no: 'No',
      current_shift: 'Current Shift',
      assign_shift: 'Assign Shift',
      shift_name: 'Shift Name',
      start_time: 'Start Time',
      end_time: 'End Time',
      working_hours: 'Working Hours',
    }
  }[language];

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/employees/${employeeId}`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
        setEditData(data);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error(language === 'ar' ? 'خطأ في تحميل بيانات الموظف' : 'Error loading employee data');
    } finally {
      setLoading(false);
    }
  }, [employeeId, language]);

  const fetchShifts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/shifts/list`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setShifts(data.shifts || []);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchPayrollHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/payroll-history`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setPayrollHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching payroll history:', error);
    }
  };

  useEffect(() => {
    fetchEmployee();
    fetchShifts();
    fetchPayrollHistory();
  }, [fetchEmployee]);

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(editData)
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حفظ البيانات بنجاح' : 'Data saved successfully');
        setIsEditing(false);
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حفظ البيانات' : 'Error saving data');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح' : 'Photo uploaded successfully');
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في رفع الصورة' : 'Error uploading photo');
    }
  };

  const handleDocumentUpload = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم رفع المستند بنجاح' : 'Document uploaded successfully');
        setShowDocumentModal(false);
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في رفع المستند' : 'Error uploading document');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm(language === 'ar' ? 'هل تريد حذف هذا المستند؟' : 'Delete this document?')) return;

    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حذف المستند' : 'Document deleted');
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حذف المستند' : 'Error deleting document');
    }
  };

  const handleAddAllowance = async (allowanceData) => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/allowances`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(allowanceData)
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم إضافة البدل بنجاح' : 'Allowance added successfully');
        setShowAllowanceModal(false);
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في إضافة البدل' : 'Error adding allowance');
    }
  };

  const handleDeleteAllowance = async (allowanceId) => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/allowances/${allowanceId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حذف البدل' : 'Allowance deleted');
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حذف البدل' : 'Error deleting allowance');
    }
  };

  const handleAddDeduction = async (deductionData) => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/deductions`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(deductionData)
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم إضافة الخصم بنجاح' : 'Deduction added successfully');
        setShowDeductionModal(false);
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في إضافة الخصم' : 'Error adding deduction');
    }
  };

  const handleDeleteDeduction = async (deductionId) => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${employeeId}/deductions/${deductionId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حذف الخصم' : 'Deduction deleted');
        fetchEmployee();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حذف الخصم' : 'Error deleting deduction');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          {language === 'ar' ? 'الموظف غير موجود' : 'Employee not found'}
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: t.personal_info, icon: User },
    { id: 'employment', label: t.employment, icon: Briefcase },
    { id: 'salary', label: t.salary, icon: DollarSign },
    { id: 'documents', label: t.documents, icon: FileText },
    { id: 'history', label: t.history, icon: Calendar },
  ];

  return (
    <div className={`p-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="back-button"
          >
            <ChevronLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.employee_profile}</h1>
        </div>
        
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            data-testid="edit-button"
          >
            <Edit className="h-4 w-4" />
            {t.edit}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              data-testid="save-button"
            >
              <Save className="h-4 w-4" />
              {t.save}
            </button>
            <button
              onClick={() => { setIsEditing(false); setEditData(employee); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              data-testid="cancel-button"
            >
              <X className="h-4 w-4" />
              {t.cancel}
            </button>
          </div>
        )}
      </div>

      {/* Employee Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Photo */}
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              {employee.photo_url ? (
                <img 
                  src={`${API_URL}${employee.photo_url}`} 
                  alt={employee.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-full cursor-pointer hover:bg-blue-600">
              <Camera className="h-4 w-4" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {employee.name}
            </h2>
            {employee.name_en && (
              <p className="text-gray-500 dark:text-gray-400 mb-2">{employee.name_en}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {employee.position}
              </span>
              {employee.department && (
                <span className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {employee.department}
                </span>
              )}
              {employee.employee_code && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  {employee.employee_code}
                </span>
              )}
            </div>
          </div>

          {/* Salary Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 min-w-[200px]">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">{t.net_salary}</h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {(employee.net_salary || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t.gross_salary}: {(employee.gross_salary || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        {/* Personal Info Tab */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.name}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.national_id}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.national_id || ''}
                  onChange={(e) => setEditData({...editData, national_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.national_id || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.email}</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({...editData, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.email || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.phone}</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({...editData, phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.phone || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.mobile}</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.mobile || ''}
                  onChange={(e) => setEditData({...editData, mobile: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.mobile || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.address}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.address || ''}
                  onChange={(e) => setEditData({...editData, address: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.address || '-'}</p>
              )}
            </div>

            {/* Leave Balance */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3">{t.leave_balance}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{employee.annual_leave_balance || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.annual_leave}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{employee.casual_leave_balance || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.casual_leave}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{employee.sick_leave_balance || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.sick_leave}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employment Tab */}
        {activeTab === 'employment' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.employee_code}</label>
              <p className="text-gray-900 dark:text-white">{employee.employee_code || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.position}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.position || ''}
                  onChange={(e) => setEditData({...editData, position: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.position}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.department}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.department || ''}
                  onChange={(e) => setEditData({...editData, department: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-gray-900 dark:text-white">{employee.department || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.hire_date}</label>
              <p className="text-gray-900 dark:text-white">{employee.hire_date}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.contract_type}</label>
              <p className="text-gray-900 dark:text-white">
                {t[employee.contract_type] || employee.contract_type}
              </p>
            </div>

            {/* Insurance Section */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t.social_insurance}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.social_insurance_number}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.social_insurance_number || ''}
                      onChange={(e) => setEditData({...editData, social_insurance_number: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{employee.social_insurance_number || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.insurance_salary}
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.insurance_salary || ''}
                      onChange={(e) => setEditData({...editData, insurance_salary: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {(employee.insurance_salary || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Health Insurance */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Heart className="h-5 w-5" />
                {t.health_insurance}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.health_insurance_company}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.health_insurance_company || ''}
                      onChange={(e) => setEditData({...editData, health_insurance_company: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{employee.health_insurance_company || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.health_insurance_amount}
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.health_insurance_amount || ''}
                      onChange={(e) => setEditData({...editData, health_insurance_amount: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">
                      {(employee.health_insurance_amount || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bank Info */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t.bank_info}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.bank_name}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.bank_name || ''}
                      onChange={(e) => setEditData({...editData, bank_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{employee.bank_name || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.bank_account}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.bank_account_number || ''}
                      onChange={(e) => setEditData({...editData, bank_account_number: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{employee.bank_account_number || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.iban}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.iban || ''}
                      onChange={(e) => setEditData({...editData, iban: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-white">{employee.iban || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Salary Tab */}
        {activeTab === 'salary' && (
          <div>
            {/* Basic Salary */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.basic_salary}</label>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.basic_salary || ''}
                  onChange={(e) => setEditData({...editData, basic_salary: parseFloat(e.target.value)})}
                  className="w-full max-w-xs px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(employee.basic_salary || 0).toLocaleString()} EGP
                </p>
              )}
            </div>

            {/* Allowances */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{t.allowances}</h3>
                <button
                  onClick={() => setShowAllowanceModal(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  data-testid="add-allowance-btn"
                >
                  <Plus className="h-4 w-4" />
                  {t.add}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                {(employee.allowances || []).length === 0 ? (
                  <p className="text-center py-4 text-gray-500">{language === 'ar' ? 'لا توجد بدلات' : 'No allowances'}</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-start text-sm font-medium">{language === 'ar' ? 'البدل' : 'Allowance'}</th>
                        <th className="px-4 py-2 text-start text-sm font-medium">{t.amount}</th>
                        <th className="px-4 py-2 text-start text-sm font-medium">{t.is_taxable}</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employee.allowances || []).map((allow, idx) => (
                        <tr key={allow.id || idx} className="border-t dark:border-gray-600">
                          <td className="px-4 py-2">{allow.name}</td>
                          <td className="px-4 py-2">{allow.amount?.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            {allow.is_taxable ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleDeleteAllowance(allow.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-green-50 dark:bg-green-900/20">
                      <tr>
                        <td className="px-4 py-2 font-semibold">{t.total_allowances}</td>
                        <td className="px-4 py-2 font-semibold text-green-600">
                          {(employee.total_allowances || 0).toLocaleString()}
                        </td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Deductions */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{t.deductions}</h3>
                <button
                  onClick={() => setShowDeductionModal(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                  data-testid="add-deduction-btn"
                >
                  <Plus className="h-4 w-4" />
                  {t.add}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                {(employee.deductions || []).length === 0 ? (
                  <p className="text-center py-4 text-gray-500">{language === 'ar' ? 'لا توجد خصومات' : 'No deductions'}</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-start text-sm font-medium">{language === 'ar' ? 'الخصم' : 'Deduction'}</th>
                        <th className="px-4 py-2 text-start text-sm font-medium">{t.amount}</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employee.deductions || []).map((ded, idx) => (
                        <tr key={ded.id || idx} className="border-t dark:border-gray-600">
                          <td className="px-4 py-2">{ded.name}</td>
                          <td className="px-4 py-2">{ded.amount?.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleDeleteDeduction(ded.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-red-50 dark:bg-red-900/20">
                      <tr>
                        <td className="px-4 py-2 font-semibold">{t.total_deductions}</td>
                        <td className="px-4 py-2 font-semibold text-red-600">
                          {(employee.total_deductions || 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.gross_salary}</p>
                <p className="text-2xl font-bold text-blue-600">{(employee.gross_salary || 0).toLocaleString()}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.total_deductions}</p>
                <p className="text-2xl font-bold text-red-600">{(employee.total_deductions || 0).toLocaleString()}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.net_salary}</p>
                <p className="text-2xl font-bold text-green-600">{(employee.net_salary || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t.documents}</h3>
              <button
                onClick={() => setShowDocumentModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                data-testid="upload-document-btn"
              >
                <Upload className="h-4 w-4" />
                {t.upload_document}
              </button>
            </div>

            {(employee.documents || []).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t.no_documents}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(employee.documents || []).map((doc) => (
                  <div key={doc.id} className="border dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-10 w-10 text-blue-500" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500">{doc.document_type}</p>
                          {doc.expiry_date && (
                            <p className="text-xs text-gray-400">{t.expiry_date}: {doc.expiry_date}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <a
                      href={`${API_URL}${doc.file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center text-sm text-blue-500 hover:text-blue-700"
                    >
                      {language === 'ar' ? 'عرض المستند' : 'View Document'}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payroll History Tab */}
        {activeTab === 'history' && (
          <div>
            {payrollHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t.no_history}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.month}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.basic_salary}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.total_allowances}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.gross_salary}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.total_deductions}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.net_salary}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollHistory.map((record, idx) => (
                      <tr key={idx} className="border-t dark:border-gray-600">
                        <td className="px-4 py-3">{record.month}</td>
                        <td className="px-4 py-3">{record.basic_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-green-600">{record.total_allowances?.toLocaleString()}</td>
                        <td className="px-4 py-3">{record.gross_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-red-600">{record.total_deductions?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold">{record.net_salary?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            record.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {t[record.status] || record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Upload Modal */}
      {showDocumentModal && (
        <DocumentUploadModal
          onClose={() => setShowDocumentModal(false)}
          onUpload={handleDocumentUpload}
          t={t}
          language={language}
        />
      )}

      {/* Allowance Modal */}
      {showAllowanceModal && (
        <AllowanceModal
          onClose={() => setShowAllowanceModal(false)}
          onSave={handleAddAllowance}
          t={t}
          language={language}
        />
      )}

      {/* Deduction Modal */}
      {showDeductionModal && (
        <DeductionModal
          onClose={() => setShowDeductionModal(false)}
          onSave={handleAddDeduction}
          t={t}
          language={language}
        />
      )}
    </div>
  );
};

// Document Upload Modal Component
const DocumentUploadModal = ({ onClose, onUpload, t, language }) => {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('contract');
  const [name, setName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const documentTypes = [
    { value: 'appointment_letter', label: language === 'ar' ? '📄 خطاب التعيين' : '📄 Appointment Letter' },
    { value: 'contract', label: language === 'ar' ? '📝 عقد العمل' : '📝 Employment Contract' },
    { value: 'national_id', label: language === 'ar' ? '🪪 البطاقة الشخصية' : '🪪 National ID' },
    { value: 'passport', label: language === 'ar' ? '🛂 جواز السفر' : '🛂 Passport' },
    { value: 'certificate', label: language === 'ar' ? '🎓 شهادة علمية' : '🎓 Certificate' },
    { value: 'insurance_card', label: language === 'ar' ? '🏥 كارنيه التأمين' : '🏥 Insurance Card' },
    { value: 'medical_report', label: language === 'ar' ? '🩺 تقرير طبي' : '🩺 Medical Report' },
    { value: 'bank_account', label: language === 'ar' ? '🏦 بيانات الحساب البنكي' : '🏦 Bank Account Info' },
    { value: 'criminal_record', label: language === 'ar' ? '📋 صحيفة الحالة الجنائية' : '📋 Criminal Record' },
    { value: 'other', label: language === 'ar' ? '📁 أخرى' : '📁 Other' },
  ];

  const handleSubmit = () => {
    if (!file || !name) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    formData.append('name', name);
    if (expiryDate) formData.append('expiry_date', expiryDate);

    onUpload(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{t.upload_document}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t.document_type}</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.document_name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.expiry_date}</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الملف' : 'File'}</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {t.upload}
          </button>
        </div>
      </div>
    </div>
  );
};

// Allowance Modal Component
const AllowanceModal = ({ onClose, onSave, t, language }) => {
  const [data, setData] = useState({
    category: 'housing',
    name: '',
    amount: 0,
    is_percentage: false,
    percentage: 0,
    is_taxable: true,
    is_insurable: false
  });

  const categories = [
    { value: 'housing', label: t.housing },
    { value: 'transportation', label: t.transportation },
    { value: 'phone', label: t.phone_allowance },
    { value: 'meal', label: t.meal },
    { value: 'clothing', label: t.clothing },
    { value: 'representation', label: t.representation },
    { value: 'nature_of_work', label: t.nature_of_work },
    { value: 'other', label: t.other },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{language === 'ar' ? 'إضافة بدل' : 'Add Allowance'}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الفئة' : 'Category'}</label>
            <select
              value={data.category}
              onChange={(e) => setData({...data, category: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الاسم' : 'Name'}</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({...data, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.amount}</label>
            <input
              type="number"
              value={data.amount}
              onChange={(e) => setData({...data, amount: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.is_taxable}
                onChange={(e) => setData({...data, is_taxable: e.target.checked})}
              />
              {t.is_taxable}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => onSave(data)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

// Deduction Modal Component
const DeductionModal = ({ onClose, onSave, t, language }) => {
  const [data, setData] = useState({
    category: 'other',
    name: '',
    amount: 0,
    is_percentage: false,
    percentage: 0
  });

  const categories = [
    { value: 'health_insurance', label: t.health_insurance_ded },
    { value: 'medical', label: t.medical },
    { value: 'absence', label: t.absence },
    { value: 'late', label: t.late },
    { value: 'penalty', label: t.penalty },
    { value: 'other', label: t.other },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{language === 'ar' ? 'إضافة خصم' : 'Add Deduction'}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الفئة' : 'Category'}</label>
            <select
              value={data.category}
              onChange={(e) => setData({...data, category: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'الاسم' : 'Name'}</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({...data, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.amount}</label>
            <input
              type="number"
              value={data.amount}
              onChange={(e) => setData({...data, amount: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => onSave(data)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfilePage;
