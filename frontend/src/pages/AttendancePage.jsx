import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Calendar, Users, UserCheck, UserX, Timer,
  TrendingUp, TrendingDown, Download, Upload, Filter,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  FileText, BarChart3, Settings, Plus
} from 'lucide-react';
import { 
  Clock as ClockIcon, Users as UsersIcon, CheckCircle as CheckIcon,
  XCircle as XCircleIcon, Warning
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AttendancePage = ({ language = 'ar' }) => {
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [fingerprintReport, setFingerprintReport] = useState(null);
  const [overtimeReport, setOvertimeReport] = useState(null);

  const isRTL = language === 'ar';

  const t = {
    ar: {
      title: 'الحضور والانصراف',
      daily_attendance: 'الحضور اليومي',
      monthly_summary: 'الملخص الشهري',
      fingerprint_report: 'تقرير البصمة',
      overtime_report: 'تقرير الإضافي',
      settings: 'الإعدادات',
      
      date: 'التاريخ',
      employee: 'الموظف',
      employee_code: 'كود الموظف',
      department: 'القسم',
      shift: 'الوردية',
      check_in: 'الحضور',
      check_out: 'الانصراف',
      expected_in: 'الحضور المتوقع',
      expected_out: 'الانصراف المتوقع',
      working_hours: 'ساعات العمل',
      overtime: 'الإضافي',
      late: 'التأخير',
      early_leave: 'انصراف مبكر',
      status: 'الحالة',
      
      present: 'حاضر',
      absent: 'غائب',
      late_status: 'متأخر',
      early_leave_status: 'انصراف مبكر',
      on_leave: 'إجازة',
      
      total_employees: 'إجمالي الموظفين',
      present_count: 'الحاضرين',
      absent_count: 'الغائبين',
      late_count: 'المتأخرين',
      on_leave_count: 'في إجازة',
      attendance_rate: 'نسبة الحضور',
      total_working_hours: 'إجمالي ساعات العمل',
      total_overtime: 'إجمالي الإضافي',
      total_late: 'إجمالي التأخير',
      
      add_manual: 'إضافة يدوي',
      import_fingerprint: 'استيراد البصمة',
      export: 'تصدير',
      refresh: 'تحديث',
      
      minutes: 'دقيقة',
      hours: 'ساعة',
      days: 'يوم',
      
      no_records: 'لا توجد سجلات',
      loading: 'جاري التحميل...',
      
      start_date: 'من تاريخ',
      end_date: 'إلى تاريخ',
      filter: 'فلترة',
      
      employee_name: 'اسم الموظف',
      present_days: 'أيام الحضور',
      absent_days: 'أيام الغياب',
      late_days: 'أيام التأخير',
      leave_days: 'أيام الإجازة',
      
      save: 'حفظ',
      cancel: 'إلغاء',
      notes: 'ملاحظات',
      is_excused: 'معذور',
      excuse_reason: 'سبب العذر',
    },
    en: {
      title: 'Attendance Management',
      daily_attendance: 'Daily Attendance',
      monthly_summary: 'Monthly Summary',
      fingerprint_report: 'Fingerprint Report',
      overtime_report: 'Overtime Report',
      settings: 'Settings',
      
      date: 'Date',
      employee: 'Employee',
      employee_code: 'Employee Code',
      department: 'Department',
      shift: 'Shift',
      check_in: 'Check In',
      check_out: 'Check Out',
      expected_in: 'Expected In',
      expected_out: 'Expected Out',
      working_hours: 'Working Hours',
      overtime: 'Overtime',
      late: 'Late',
      early_leave: 'Early Leave',
      status: 'Status',
      
      present: 'Present',
      absent: 'Absent',
      late_status: 'Late',
      early_leave_status: 'Early Leave',
      on_leave: 'On Leave',
      
      total_employees: 'Total Employees',
      present_count: 'Present',
      absent_count: 'Absent',
      late_count: 'Late',
      on_leave_count: 'On Leave',
      attendance_rate: 'Attendance Rate',
      total_working_hours: 'Total Working Hours',
      total_overtime: 'Total Overtime',
      total_late: 'Total Late',
      
      add_manual: 'Add Manual',
      import_fingerprint: 'Import Fingerprint',
      export: 'Export',
      refresh: 'Refresh',
      
      minutes: 'min',
      hours: 'hrs',
      days: 'days',
      
      no_records: 'No records found',
      loading: 'Loading...',
      
      start_date: 'Start Date',
      end_date: 'End Date',
      filter: 'Filter',
      
      employee_name: 'Employee Name',
      present_days: 'Present Days',
      absent_days: 'Absent Days',
      late_days: 'Late Days',
      leave_days: 'Leave Days',
      
      save: 'Save',
      cancel: 'Cancel',
      notes: 'Notes',
      is_excused: 'Excused',
      excuse_reason: 'Excuse Reason',
    }
  }[language];

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchDailyData = useCallback(async () => {
    try {
      setLoading(true);
      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/attendance-pro/records?date=${selectedDate}`, { headers: getAuthHeader() }),
        fetch(`${API_URL}/api/attendance-pro/daily-summary?date=${selectedDate}`, { headers: getAuthHeader() })
      ]);
      
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data.records || []);
      }
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setDailySummary(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchMonthlyData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/attendance-pro/monthly-summary?month=${selectedMonth}`, { headers: getAuthHeader() }),
        fetch(`${API_URL}/api/attendance-pro/statistics?month=${selectedMonth}`, { headers: getAuthHeader() })
      ]);
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setMonthlySummary(data.summaries || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const fetchFingerprintReport = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/attendance-pro/fingerprint-report?start_date=${startDate}&end_date=${endDate}`,
        { headers: getAuthHeader() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setFingerprintReport(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOvertimeReport = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/attendance-pro/overtime-report?month=${selectedMonth}`,
        { headers: getAuthHeader() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setOvertimeReport(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees`, { headers: getAuthHeader() });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyData();
    } else if (activeTab === 'monthly') {
      fetchMonthlyData();
    } else if (activeTab === 'overtime') {
      fetchOvertimeReport();
    }
  }, [activeTab, selectedDate, selectedMonth, fetchDailyData, fetchMonthlyData, fetchOvertimeReport]);

  const handleManualAttendance = async (data) => {
    try {
      const response = await fetch(`${API_URL}/api/attendance-pro/manual`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم إضافة السجل بنجاح' : 'Record added successfully');
        setShowManualModal(false);
        fetchDailyData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error');
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في الإضافة' : 'Error adding record');
    }
  };

  const handleImportFingerprint = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/attendance-pro/import-fingerprint`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchDailyData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error importing');
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في الاستيراد' : 'Import error');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      present: { color: 'bg-green-100 text-green-800', label: t.present },
      absent: { color: 'bg-red-100 text-red-800', label: t.absent },
      late: { color: 'bg-yellow-100 text-yellow-800', label: t.late_status },
      early_leave: { color: 'bg-orange-100 text-orange-800', label: t.early_leave_status },
      on_leave: { color: 'bg-blue-100 text-blue-800', label: t.on_leave }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const tabs = [
    { id: 'daily', label: t.daily_attendance, icon: Calendar },
    { id: 'monthly', label: t.monthly_summary, icon: BarChart3 },
    { id: 'fingerprint', label: t.fingerprint_report, icon: FileText },
    { id: 'overtime', label: t.overtime_report, icon: Timer },
  ];

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'} data-testid="attendance-page">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClockIcon weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
              <p className="text-teal-100 text-sm">
                {language === 'ar' 
                  ? 'تتبع حضور وانصراف الموظفين وإدارة البصمة'
                  : 'Track employee attendance and manage fingerprint records'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/30 text-white rounded-lg hover:bg-white/20 cursor-pointer transition-colors">
              <Upload className="h-4 w-4" />
              {t.import_fingerprint}
              <input type="file" accept=".csv" className="hidden" onChange={handleImportFingerprint} />
            </label>
            <Button
              onClick={() => setShowManualModal(true)}
              className="bg-white text-teal-700 hover:bg-teal-50"
            >
              <Plus className="h-4 w-4 me-2" />
              {t.add_manual}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-teal-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date/Month Selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          {activeTab === 'daily' ? (
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm font-medium">{t.date}:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={fetchDailyData}
                className="p-2 text-gray-500 hover:text-teal-500 transition-colors"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm font-medium">{language === 'ar' ? 'الشهر' : 'Month'}:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Attendance Tab */}
      {activeTab === 'daily' && (
        <>
          {/* Summary Cards */}
          {dailySummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t.total_employees}</p>
                    <p className="text-2xl font-bold">{dailySummary.total_employees}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t.present_count}</p>
                    <p className="text-2xl font-bold text-green-600">{dailySummary.present_count}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <UserX className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t.absent_count}</p>
                    <p className="text-2xl font-bold text-red-600">{dailySummary.absent_count}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t.late_count}</p>
                    <p className="text-2xl font-bold text-yellow-600">{dailySummary.late_count}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t.attendance_rate}</p>
                    <p className="text-2xl font-bold text-purple-600">{dailySummary.attendance_rate}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Records Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">{t.loading}</div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t.no_records}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.employee}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.department}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.shift}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.check_in}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.check_out}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.working_hours}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.late}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.overtime}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{record.employee_name}</p>
                            <p className="text-xs text-gray-500">{record.employee_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{record.department || '-'}</td>
                        <td className="px-4 py-3 text-sm">{record.shift_name || '-'}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{record.check_in || '-'}</p>
                            <p className="text-xs text-gray-500">{record.expected_check_in}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{record.check_out || '-'}</p>
                            <p className="text-xs text-gray-500">{record.expected_check_out}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{record.actual_working_hours?.toFixed(1) || 0} h</td>
                        <td className="px-4 py-3">
                          {record.late_minutes > 0 ? (
                            <span className="text-red-600 font-medium">{record.late_minutes} {t.minutes}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {record.overtime_hours > 0 ? (
                            <span className="text-green-600 font-medium">{record.overtime_hours?.toFixed(1)} h</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Monthly Summary Tab */}
      {activeTab === 'monthly' && (
        <>
          {/* Statistics Cards */}
          {statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{t.total_working_hours}</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.total_working_hours} h</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{t.total_overtime}</p>
                <p className="text-2xl font-bold text-green-600">{statistics.total_overtime_hours} h</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{t.total_late}</p>
                <p className="text-2xl font-bold text-red-600">{statistics.total_late_minutes} {t.minutes}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-500">{t.attendance_rate}</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.average_attendance_rate}%</p>
              </div>
            </div>
          )}

          {/* Monthly Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">{t.loading}</div>
            ) : monthlySummary.length === 0 ? (
              <div className="p-12 text-center text-gray-500">{t.no_records}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.employee_name}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.department}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.present_days}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.absent_days}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.late_days}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.leave_days}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.working_hours}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.overtime}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.late}</th>
                      <th className="px-4 py-3 text-start text-sm font-medium">{t.attendance_rate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.map((summary, idx) => (
                      <tr key={idx} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{summary.employee_name}</p>
                            <p className="text-xs text-gray-500">{summary.employee_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{summary.department || '-'}</td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium">{summary.present_days}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{summary.absent_days}</td>
                        <td className="px-4 py-3 text-sm text-yellow-600 font-medium">{summary.late_days}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{summary.leave_days}</td>
                        <td className="px-4 py-3 text-sm">{summary.total_working_hours} h</td>
                        <td className="px-4 py-3 text-sm text-green-600">{summary.total_overtime_hours} h</td>
                        <td className="px-4 py-3 text-sm text-red-600">{summary.total_late_minutes} {t.minutes}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${summary.attendance_rate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{summary.attendance_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fingerprint Report Tab */}
      {activeTab === 'fingerprint' && (
        <FingerprintReportSection 
          t={t} 
          language={language} 
          onFetch={fetchFingerprintReport}
          report={fingerprintReport}
          loading={loading}
        />
      )}

      {/* Overtime Report Tab */}
      {activeTab === 'overtime' && (
        <OvertimeReportSection 
          t={t} 
          language={language}
          report={overtimeReport}
          loading={loading}
        />
      )}

      {/* Manual Attendance Modal */}
      {showManualModal && (
        <ManualAttendanceModal
          employees={employees}
          onClose={() => setShowManualModal(false)}
          onSave={handleManualAttendance}
          t={t}
          language={language}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};

// Fingerprint Report Section
const FingerprintReportSection = ({ t, language, onFetch, report, loading }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t.start_date}:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t.end_date}:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <button
            onClick={() => onFetch(startDate, endDate)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Filter className="h-4 w-4" />
            {t.filter}
          </button>
        </div>
      </div>

      {/* Statistics */}
      {report?.statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي السجلات' : 'Total Records'}</p>
            <p className="text-2xl font-bold">{report.statistics.total_records}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{language === 'ar' ? 'حالات التأخير' : 'Late Instances'}</p>
            <p className="text-2xl font-bold text-yellow-600">{report.statistics.total_late_instances}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{t.total_overtime}</p>
            <p className="text-2xl font-bold text-green-600">{report.statistics.total_overtime_hours} h</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">{language === 'ar' ? 'متوسط ساعات العمل' : 'Avg Working Hours'}</p>
            <p className="text-2xl font-bold text-blue-600">{report.statistics.average_working_hours} h</p>
          </div>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t.loading}</div>
        ) : !report?.report?.length ? (
          <div className="p-12 text-center text-gray-500">{t.no_records}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-start">{t.date}</th>
                  <th className="px-3 py-2 text-start">{t.employee_code}</th>
                  <th className="px-3 py-2 text-start">{t.employee_name}</th>
                  <th className="px-3 py-2 text-start">{t.shift}</th>
                  <th className="px-3 py-2 text-start">{t.expected_in}</th>
                  <th className="px-3 py-2 text-start">{t.check_in}</th>
                  <th className="px-3 py-2 text-start">{t.expected_out}</th>
                  <th className="px-3 py-2 text-start">{t.check_out}</th>
                  <th className="px-3 py-2 text-start">{t.late}</th>
                  <th className="px-3 py-2 text-start">{t.working_hours}</th>
                  <th className="px-3 py-2 text-start">{t.overtime}</th>
                </tr>
              </thead>
              <tbody>
                {report.report.map((row, idx) => (
                  <tr key={idx} className="border-t dark:border-gray-700">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.employee_code}</td>
                    <td className="px-3 py-2">{row.employee_name}</td>
                    <td className="px-3 py-2">{row.shift_name || '-'}</td>
                    <td className="px-3 py-2">{row.expected_in || '-'}</td>
                    <td className="px-3 py-2 font-medium">{row.actual_in || '-'}</td>
                    <td className="px-3 py-2">{row.expected_out || '-'}</td>
                    <td className="px-3 py-2 font-medium">{row.actual_out || '-'}</td>
                    <td className="px-3 py-2 text-red-600">{row.late_minutes > 0 ? `${row.late_minutes} m` : '-'}</td>
                    <td className="px-3 py-2">{row.working_hours?.toFixed(1)} h</td>
                    <td className="px-3 py-2 text-green-600">{row.overtime_hours > 0 ? `${row.overtime_hours?.toFixed(1)} h` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Overtime Report Section
const OvertimeReportSection = ({ t, language, report, loading }) => {
  if (loading) {
    return <div className="p-12 text-center text-gray-500">{t.loading}</div>;
  }

  return (
    <div>
      {/* Total Overtime */}
      {report && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
          <p className="text-green-100">{t.total_overtime}</p>
          <p className="text-4xl font-bold">{report.total_overtime_hours} {t.hours}</p>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {!report?.report?.length ? (
          <div className="p-12 text-center text-gray-500">{t.no_records}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t.employee_name}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t.department}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{language === 'ar' ? 'أيام الإضافي' : 'Overtime Days'}</th>
                  <th className="px-4 py-3 text-start text-sm font-medium">{t.total_overtime}</th>
                </tr>
              </thead>
              <tbody>
                {report.report.map((emp, idx) => (
                  <tr key={idx} className="border-t dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{emp.employee_name}</p>
                        <p className="text-xs text-gray-500">{emp.employee_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{emp.department || '-'}</td>
                    <td className="px-4 py-3">{emp.overtime_days} {t.days}</td>
                    <td className="px-4 py-3 text-green-600 font-bold">{emp.total_overtime_hours} {t.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Manual Attendance Modal
const ManualAttendanceModal = ({ employees, onClose, onSave, t, language, selectedDate }) => {
  const [data, setData] = useState({
    employee_id: '',
    date: selectedDate,
    check_in: '',
    check_out: '',
    status: 'present',
    notes: '',
    is_excused: false,
    excuse_reason: ''
  });

  const statusOptions = [
    { value: 'present', label: t.present },
    { value: 'absent', label: t.absent },
    { value: 'late', label: t.late_status },
    { value: 'on_leave', label: t.on_leave }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{t.add_manual}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t.employee}</label>
            <select
              value={data.employee_id}
              onChange={(e) => setData({...data, employee_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">{language === 'ar' ? 'اختر موظف' : 'Select Employee'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.employee_code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.date}</label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => setData({...data, date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t.check_in}</label>
              <input
                type="time"
                value={data.check_in}
                onChange={(e) => setData({...data, check_in: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.check_out}</label>
              <input
                type="time"
                value={data.check_out}
                onChange={(e) => setData({...data, check_out: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.status}</label>
            <select
              value={data.status}
              onChange={(e) => setData({...data, status: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t.notes}</label>
            <textarea
              value={data.notes}
              onChange={(e) => setData({...data, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.is_excused}
              onChange={(e) => setData({...data, is_excused: e.target.checked})}
              id="is_excused"
            />
            <label htmlFor="is_excused" className="text-sm">{t.is_excused}</label>
          </div>

          {data.is_excused && (
            <div>
              <label className="block text-sm font-medium mb-1">{t.excuse_reason}</label>
              <input
                type="text"
                value={data.excuse_reason}
                onChange={(e) => setData({...data, excuse_reason: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          )}
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
            disabled={!data.employee_id}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
