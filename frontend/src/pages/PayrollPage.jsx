import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, Users, Calendar, Calculator, CheckCircle, 
  Clock, FileText, Plus, Eye, Download, Settings,
  CreditCard, Banknote, TrendingUp, TrendingDown, RefreshCw,
  UserX, Wallet, Mail
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api/payroll';

const getToken = () => localStorage.getItem('token');

export default function PayrollPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('runs');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [loans, setLoans] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [settings, setSettings] = useState(null);
  const [employees, setEmployees] = useState([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});

  const text = {
    ar: {
      payroll: 'إدارة الرواتب',
      runs: 'مسيرات الرواتب',
      loans: 'السُلف',
      endOfService: 'نهاية الخدمة',
      settings: 'الإعدادات',
      reports: 'التقارير',
      createPayroll: 'إنشاء مسير رواتب',
      createLoan: 'إنشاء سُلفة',
      createSettlement: 'تسوية نهاية خدمة',
      month: 'الشهر',
      year: 'السنة',
      status: 'الحالة',
      employees: 'الموظفين',
      grossSalary: 'إجمالي الراتب',
      netSalary: 'صافي الراتب',
      deductions: 'الخصومات',
      calculate: 'حساب',
      approve: 'اعتماد',
      pay: 'صرف',
      view: 'عرض',
      draft: 'مسودة',
      calculated: 'محسوب',
      approved: 'معتمد',
      paid: 'مصروف',
      employee: 'الموظف',
      amount: 'المبلغ',
      installments: 'الأقساط',
      installment: 'القسط',
      remaining: 'المتبقي',
      startMonth: 'شهر البداية',
      reason: 'السبب',
      pending: 'قيد الانتظار',
      active: 'نشط',
      basicSalary: 'الراتب الأساسي',
      allowances: 'البدلات',
      socialInsurance: 'التأمينات',
      incomeTax: 'ضريبة الدخل',
      loansDeduction: 'خصم السُلف',
      totalEmployees: 'إجمالي الموظفين',
      totalGross: 'إجمالي الرواتب',
      totalNet: 'صافي الرواتب',
      totalDeductions: 'إجمالي الخصومات',
      yearsOfService: 'سنوات الخدمة',
      endOfServiceAmount: 'مكافأة نهاية الخدمة',
      pendingLoans: 'سُلف مستحقة',
      netSettlement: 'صافي التسوية',
      save: 'حفظ',
      cancel: 'إلغاء',
      journalEntry: 'القيد المحاسبي',
      employeeRate: 'نسبة الموظف',
      companyRate: 'نسبة الشركة',
      taxBrackets: 'شرائح الضريبة',
      monthlyCost: 'تقرير التكلفة الشهرية',
      departmentCost: 'تقرير تكلفة الأقسام'
    },
    en: {
      payroll: 'Payroll Management',
      runs: 'Payroll Runs',
      loans: 'Loans',
      endOfService: 'End of Service',
      settings: 'Settings',
      reports: 'Reports',
      createPayroll: 'Create Payroll',
      createLoan: 'Create Loan',
      createSettlement: 'End of Service Settlement',
      month: 'Month',
      year: 'Year',
      status: 'Status',
      employees: 'Employees',
      grossSalary: 'Gross Salary',
      netSalary: 'Net Salary',
      deductions: 'Deductions',
      calculate: 'Calculate',
      approve: 'Approve',
      pay: 'Pay',
      view: 'View',
      draft: 'Draft',
      calculated: 'Calculated',
      approved: 'Approved',
      paid: 'Paid',
      employee: 'Employee',
      amount: 'Amount',
      installments: 'Installments',
      installment: 'Installment',
      remaining: 'Remaining',
      startMonth: 'Start Month',
      reason: 'Reason',
      pending: 'Pending',
      active: 'Active',
      basicSalary: 'Basic Salary',
      allowances: 'Allowances',
      socialInsurance: 'Social Insurance',
      incomeTax: 'Income Tax',
      loansDeduction: 'Loans Deduction',
      totalEmployees: 'Total Employees',
      totalGross: 'Total Gross',
      totalNet: 'Total Net',
      totalDeductions: 'Total Deductions',
      yearsOfService: 'Years of Service',
      endOfServiceAmount: 'End of Service Amount',
      pendingLoans: 'Pending Loans',
      netSettlement: 'Net Settlement',
      save: 'Save',
      cancel: 'Cancel',
      journalEntry: 'Journal Entry',
      employeeRate: 'Employee Rate',
      companyRate: 'Company Rate',
      taxBrackets: 'Tax Brackets',
      monthlyCost: 'Monthly Cost Report',
      departmentCost: 'Department Cost Report'
    }
  }[language];

  // Fetch functions
  const fetchPayrollRuns = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/runs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPayrollRuns(data.payroll_runs || []);
    } catch (error) {
      console.error('Error fetching payroll runs:', error);
    }
  }, []);

  const fetchLoans = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/loans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/end-of-service`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettlements(data.settlements || []);
    } catch (error) {
      console.error('Error fetching settlements:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/hr/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : (data.data || data.employees || []));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPayrollRuns(),
        fetchLoans(),
        fetchSettlements(),
        fetchSettings(),
        fetchEmployees()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchPayrollRuns, fetchLoans, fetchSettlements, fetchSettings, fetchEmployees]);

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    
    if (type === 'payroll') {
      const now = new Date();
      setFormData({
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      });
    } else if (type === 'loan') {
      setFormData({
        employee_id: '',
        amount: 0,
        installments: 12,
        start_month: '',
        reason: ''
      });
    } else if (type === 'settlement') {
      setFormData({
        employee_id: '',
        end_date: new Date().toISOString().split('T')[0],
        termination_reason: '',
        other_entitlements: 0,
        other_deductions: 0
      });
    }
    
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const token = getToken();
      let url = API;
      
      if (modalType === 'payroll') {
        url += '/runs';
      } else if (modalType === 'loan') {
        url += '/loans';
      } else if (modalType === 'settlement') {
        url += '/end-of-service';
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
        setShowModal(false);
        
        if (modalType === 'payroll') fetchPayrollRuns();
        else if (modalType === 'loan') fetchLoans();
        else if (modalType === 'settlement') fetchSettlements();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error saving');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error saving');
    }
  };

  const handlePayrollAction = async (runId, action) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/runs/${runId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || (language === 'ar' ? 'تمت العملية بنجاح' : 'Action completed'));
        fetchPayrollRuns();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error');
    }
  };

  const handleSendPayslips = async (runId) => {
    if (!window.confirm(language === 'ar' 
      ? 'هل تريد إرسال قسائم الرواتب بالبريد الإلكتروني للموظفين؟' 
      : 'Send payslip emails to all employees?')) {
      return;
    }
    
    try {
      const token = getToken();
      toast.loading(language === 'ar' ? 'جاري إرسال قسائم الرواتب...' : 'Sending payslips...', { id: 'sending-payslips' });
      
      const response = await fetch(`${API}/runs/${runId}/send-payslips`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || (language === 'ar' ? 'تم إرسال قسائم الرواتب' : 'Payslips sent'), { id: 'sending-payslips' });
        fetchPayrollRuns();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error sending payslips', { id: 'sending-payslips' });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(language === 'ar' ? 'خطأ في إرسال قسائم الرواتب' : 'Error sending payslips', { id: 'sending-payslips' });
    }
  };


  const handleLoanApprove = async (loanId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/loans/${loanId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم اعتماد السُلفة' : 'Loan approved');
        fetchLoans();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSettlementApprove = async (settlementId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/end-of-service/${settlementId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم اعتماد التسوية' : 'Settlement approved');
        fetchSettlements();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      calculated: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      paid: 'bg-purple-100 text-purple-700',
      pending: 'bg-yellow-100 text-yellow-700',
      active: 'bg-blue-100 text-blue-700'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status] || 'bg-gray-100'}`}>
        {text[status] || status}
      </span>
    );
  };

  const tabs = [
    { id: 'runs', icon: Calendar, label: text.runs },
    { id: 'loans', icon: CreditCard, label: text.loans },
    { id: 'endOfService', icon: UserX, label: text.endOfService },
    { id: 'reports', icon: FileText, label: text.reports },
    { id: 'settings', icon: Settings, label: text.settings }
  ];

  // Calculate summary
  const currentMonthPayroll = payrollRuns[0];
  const totalLoans = loans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="payroll-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{text.payroll}</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.totalEmployees}</p>
                <p className="text-2xl font-bold">{employees.filter(e => e.is_active).length}</p>
              </div>
              <Users className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.totalGross}</p>
                <p className="text-2xl font-bold">
                  {(currentMonthPayroll?.total_gross_salary || 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.totalDeductions}</p>
                <p className="text-2xl font-bold">
                  {(currentMonthPayroll?.total_deductions || 0).toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.loans}</p>
                <p className="text-2xl font-bold">{totalLoans.toLocaleString()}</p>
              </div>
              <Wallet className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[#28376B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Payroll Runs Tab */}
        {activeTab === 'runs' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{text.runs}</h2>
              <Button onClick={() => openModal('payroll')} data-testid="create-payroll-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.createPayroll}
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">#</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.month}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.employees}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.grossSalary}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.deductions}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.netSalary}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.journalEntry}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payrollRuns.map(run => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{run.payroll_number}</td>
                      <td className="px-4 py-3 text-sm">{run.month}</td>
                      <td className="px-4 py-3 text-sm">{run.total_employees}</td>
                      <td className="px-4 py-3 text-sm">{run.total_gross_salary?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{run.total_deductions?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{run.total_net_salary?.toLocaleString()}</td>
                      <td className="px-4 py-3">{getStatusBadge(run.status)}</td>
                      <td className="px-4 py-3 text-sm text-blue-600">{run.journal_entry_number || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          {run.status === 'draft' && (
                            <Button size="sm" onClick={() => handlePayrollAction(run.id, 'calculate')}>
                              <Calculator className="w-4 h-4 mr-1" />
                              {text.calculate}
                            </Button>
                          )}
                          {run.status === 'calculated' && (
                            <Button size="sm" onClick={() => handlePayrollAction(run.id, 'approve')}>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {text.approve}
                            </Button>
                          )}
                          {run.status === 'approved' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handlePayrollAction(run.id, 'pay')}>
                                <Banknote className="w-4 h-4 mr-1" />
                                {text.pay}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleSendPayslips(run.id)} title={language === 'ar' ? 'إرسال قسائم الرواتب' : 'Send Payslips'}>
                                <Mail className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {run.status === 'paid' && (
                            <Button size="sm" variant="ghost" onClick={() => handleSendPayslips(run.id)} title={language === 'ar' ? 'إرسال قسائم الرواتب' : 'Send Payslips'}>
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedItem(run); setModalType('viewPayroll'); setShowModal(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payrollRuns.length === 0 && (
                <p className="text-center py-8 text-gray-500">
                  {language === 'ar' ? 'لا توجد مسيرات رواتب' : 'No payroll runs found'}
                </p>
              )}
            </div>
          </>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{text.loans}</h2>
              <Button onClick={() => openModal('loan')} data-testid="create-loan-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.createLoan}
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">#</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.employee}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.amount}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.installments}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.installment}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.remaining}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loans.map(loan => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{loan.loan_number}</td>
                      <td className="px-4 py-3 text-sm">{loan.employee_name}</td>
                      <td className="px-4 py-3 text-sm">{loan.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">{loan.installments}</td>
                      <td className="px-4 py-3 text-sm">{loan.installment_amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{loan.remaining_amount?.toLocaleString()}</td>
                      <td className="px-4 py-3">{getStatusBadge(loan.status)}</td>
                      <td className="px-4 py-3">
                        {loan.status === 'pending' && (
                          <Button size="sm" onClick={() => handleLoanApprove(loan.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {text.approve}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loans.length === 0 && (
                <p className="text-center py-8 text-gray-500">
                  {language === 'ar' ? 'لا توجد سُلف' : 'No loans found'}
                </p>
              )}
            </div>
          </>
        )}

        {/* End of Service Tab */}
        {activeTab === 'endOfService' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{text.endOfService}</h2>
              <Button onClick={() => openModal('settlement')} data-testid="create-settlement-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.createSettlement}
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">#</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.employee}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.yearsOfService}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.endOfServiceAmount}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.pendingLoans}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.netSettlement}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {settlements.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{s.settlement_number}</td>
                      <td className="px-4 py-3 text-sm">{s.employee_name}</td>
                      <td className="px-4 py-3 text-sm">{s.years_of_service}</td>
                      <td className="px-4 py-3 text-sm">{s.end_of_service_amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{s.pending_loans?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{s.net_settlement?.toLocaleString()}</td>
                      <td className="px-4 py-3">{getStatusBadge(s.status)}</td>
                      <td className="px-4 py-3">
                        {s.status === 'pending' && (
                          <Button size="sm" onClick={() => handleSettlementApprove(s.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {text.approve}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {settlements.length === 0 && (
                <p className="text-center py-8 text-gray-500">
                  {language === 'ar' ? 'لا توجد تسويات' : 'No settlements found'}
                </p>
              )}
            </div>
          </>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <FileText className="w-12 h-12 mx-auto text-[#28376B] mb-3" />
                <h3 className="font-semibold">{text.monthlyCost}</h3>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <h3 className="font-semibold">{text.departmentCost}</h3>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{text.socialInsurance}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.employeeRate} %</label>
                    <Input type="number" value={settings.employee_social_insurance_rate || 11} readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.companyRate} %</label>
                    <Input type="number" value={settings.company_social_insurance_rate || 18.75} readOnly />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{text.incomeTax}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    {settings.income_tax_brackets?.map((bracket, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{bracket.from?.toLocaleString()} - {bracket.to === Infinity ? '∞' : bracket.to?.toLocaleString()}</span>
                        <span className="font-medium">{bracket.rate}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {modalType === 'payroll' && text.createPayroll}
                {modalType === 'loan' && text.createLoan}
                {modalType === 'settlement' && text.createSettlement}
                {modalType === 'viewPayroll' && `${text.runs} - ${selectedItem?.payroll_number}`}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Create Payroll Form */}
              {modalType === 'payroll' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{text.month} *</label>
                  <Input 
                    type="month" 
                    value={formData.month || ''} 
                    onChange={e => setFormData({...formData, month: e.target.value})} 
                  />
                </div>
              )}

              {/* Create Loan Form */}
              {modalType === 'loan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.employee} *</label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={formData.employee_id || ''} 
                      onChange={e => setFormData({...formData, employee_id: e.target.value})}
                    >
                      <option value="">--</option>
                      {employees.filter(e => e.is_active).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.amount} *</label>
                      <Input 
                        type="number" 
                        value={formData.amount || 0} 
                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.installments} *</label>
                      <Input 
                        type="number" 
                        value={formData.installments || 12} 
                        onChange={e => setFormData({...formData, installments: parseInt(e.target.value)})} 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.startMonth} *</label>
                    <Input 
                      type="month" 
                      value={formData.start_month || ''} 
                      onChange={e => setFormData({...formData, start_month: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.reason}</label>
                    <Input 
                      value={formData.reason || ''} 
                      onChange={e => setFormData({...formData, reason: e.target.value})} 
                    />
                  </div>
                </>
              )}

              {/* Create Settlement Form */}
              {modalType === 'settlement' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.employee} *</label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={formData.employee_id || ''} 
                      onChange={e => setFormData({...formData, employee_id: e.target.value})}
                    >
                      <option value="">--</option>
                      {employees.filter(e => e.is_active).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'تاريخ انتهاء الخدمة' : 'End Date'} *</label>
                    <Input 
                      type="date" 
                      value={formData.end_date || ''} 
                      onChange={e => setFormData({...formData, end_date: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'سبب الإنهاء' : 'Termination Reason'}</label>
                    <Input 
                      value={formData.termination_reason || ''} 
                      onChange={e => setFormData({...formData, termination_reason: e.target.value})} 
                    />
                  </div>
                </>
              )}

              {/* View Payroll Details */}
              {modalType === 'viewPayroll' && selectedItem && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{text.month}:</span>
                      <span className="ml-2 font-medium">{selectedItem.month}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{text.employees}:</span>
                      <span className="ml-2 font-medium">{selectedItem.total_employees}</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span>{text.basicSalary}</span>
                      <span className="font-medium">{selectedItem.total_basic_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{text.allowances}</span>
                      <span className="font-medium">{selectedItem.total_allowances?.toLocaleString()}</span>
                    </div>
                    
                    {/* Overtime Bonus from Attendance */}
                    {selectedItem.total_overtime_bonus > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>{language === 'ar' ? 'مكافأة أوفرتايم' : 'Overtime Bonus'}</span>
                        <span>+{selectedItem.total_overtime_bonus?.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">{text.grossSalary}</span>
                      <span className="font-bold">{selectedItem.total_gross_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>{text.socialInsurance}</span>
                      <span>-{selectedItem.total_social_insurance?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>{text.incomeTax}</span>
                      <span>-{selectedItem.total_income_tax?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>{text.loansDeduction}</span>
                      <span>-{selectedItem.total_loans?.toLocaleString()}</span>
                    </div>
                    
                    {/* Late Deductions from Attendance */}
                    {selectedItem.total_late_deductions > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>{language === 'ar' ? 'خصم تأخير' : 'Late Deduction'}</span>
                        <span>-{selectedItem.total_late_deductions?.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {/* Absence Deductions from Attendance */}
                    {selectedItem.total_absence_deductions > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>{language === 'ar' ? 'خصم غياب' : 'Absence Deduction'}</span>
                        <span>-{selectedItem.total_absence_deductions?.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">{text.totalDeductions}</span>
                      <span className="font-bold text-red-600">-{selectedItem.total_deductions?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg">
                      <span className="font-bold">{text.netSalary}</span>
                      <span className="font-bold text-green-600">{selectedItem.total_net_salary?.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {selectedItem.journal_entry_number && (
                    <div className="text-center text-blue-600">
                      {text.journalEntry}: {selectedItem.journal_entry_number}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>{text.cancel}</Button>
              {modalType !== 'viewPayroll' && (
                <Button onClick={handleSave}>{text.save}</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
