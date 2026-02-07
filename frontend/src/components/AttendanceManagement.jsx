import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { 
  Clock, LogIn, LogOut, Users, Calendar, BarChart3, Settings,
  CheckCircle, XCircle, AlertCircle, RefreshCw, QrCode, MapPin,
  Timer, TrendingUp, UserCheck, UserX, Wifi, WifiOff, Download,
  Printer, FileDown, File
} from 'lucide-react';
import useRealTimeSync from '../hooks/useRealTimeSync';

const AttendanceManagement = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [activeTab, setActiveTab] = useState('today');
  const [todayData, setTodayData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportDates, setReportDates] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  const t = {
    attendance: isRTL ? 'الحضور والانصراف' : 'Attendance',
    todayAttendance: isRTL ? 'حضور اليوم' : 'Today\'s Attendance',
    reports: isRTL ? 'التقارير' : 'Reports',
    settings: isRTL ? 'الإعدادات' : 'Settings',
    checkIn: isRTL ? 'تسجيل حضور' : 'Check In',
    checkOut: isRTL ? 'تسجيل انصراف' : 'Check Out',
    employee: isRTL ? 'الموظف' : 'Employee',
    time: isRTL ? 'الوقت' : 'Time',
    status: isRTL ? 'الحالة' : 'Status',
    workHours: isRTL ? 'ساعات العمل' : 'Work Hours',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    present: isRTL ? 'حاضر' : 'Present',
    absent: isRTL ? 'غائب' : 'Absent',
    late: isRTL ? 'متأخر' : 'Late',
    onLeave: isRTL ? 'إجازة' : 'On Leave',
    totalEmployees: isRTL ? 'إجمالي الموظفين' : 'Total Employees',
    presentToday: isRTL ? 'الحاضرون اليوم' : 'Present Today',
    absentToday: isRTL ? 'الغائبون اليوم' : 'Absent Today',
    lateToday: isRTL ? 'المتأخرون اليوم' : 'Late Today',
    selectEmployee: isRTL ? 'اختر الموظف' : 'Select Employee',
    confirm: isRTL ? 'تأكيد' : 'Confirm',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    generateQR: isRTL ? 'إنشاء QR' : 'Generate QR',
    scanQR: isRTL ? 'امسح الرمز' : 'Scan QR',
    qrExpiry: isRTL ? 'صالح حتى' : 'Valid until',
    generateReport: isRTL ? 'إنشاء تقرير' : 'Generate Report',
    fromDate: isRTL ? 'من تاريخ' : 'From Date',
    toDate: isRTL ? 'إلى تاريخ' : 'To Date',
    department: isRTL ? 'القسم' : 'Department',
    position: isRTL ? 'المنصب' : 'Position',
    checkedIn: isRTL ? 'سجل حضور' : 'Checked In',
    notCheckedIn: isRTL ? 'لم يسجل' : 'Not Checked In',
    checkedOut: isRTL ? 'انصرف' : 'Checked Out',
    overtime: isRTL ? 'إضافي' : 'Overtime',
    lateMinutes: isRTL ? 'دقائق التأخير' : 'Late Minutes',
    workStartTime: isRTL ? 'بداية العمل' : 'Work Start Time',
    workEndTime: isRTL ? 'نهاية العمل' : 'Work End Time',
    lateThreshold: isRTL ? 'حد التأخير (دقائق)' : 'Late Threshold (min)',
    save: isRTL ? 'حفظ' : 'Save',
    noRecords: isRTL ? 'لا توجد سجلات' : 'No records found',
    hours: isRTL ? 'ساعات' : 'hours',
    minutes: isRTL ? 'دقائق' : 'min'
  };

  const statusColors = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
    'half-day': 'bg-orange-100 text-orange-700',
    leave: 'bg-blue-100 text-blue-700'
  };

  // Real-time sync
  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type === 'attendance_updated') {
      fetchTodayAttendance();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  useEffect(() => {
    fetchTodayAttendance();
    fetchEmployees();
    fetchSettings();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/attendance/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTodayData(response.data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/hr/employees`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/attendance/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedEmployee) {
      toast.error(isRTL ? 'اختر الموظف أولاً' : 'Please select an employee');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/attendance/check-in`,
        { employee_id: selectedEmployee, method: 'manual' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم تسجيل الحضور بنجاح' : 'Check-in successful');
      setShowCheckInDialog(false);
      setSelectedEmployee('');
      fetchTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    if (!selectedEmployee) {
      toast.error(isRTL ? 'اختر الموظف أولاً' : 'Please select an employee');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/attendance/check-out`,
        { employee_id: selectedEmployee },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(
        `${isRTL ? 'تم تسجيل الانصراف - ساعات العمل:' : 'Check-out successful - Work hours:'} ${response.data.work_hours}`
      );
      setShowCheckOutDialog(false);
      setSelectedEmployee('');
      fetchTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Check-out failed');
    }
  };

  const handleGenerateQR = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/attendance/qr/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQrCode(response.data);
      setShowQRDialog(true);
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const handleGenerateReport = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/attendance/report?from_date=${reportDates.from}&to_date=${reportDates.to}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to generate report');
    }
  };

  // Export attendance to CSV
  const handleExportCSV = () => {
    if (!reportData?.employee_stats) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير، قم بإنشاء تقرير أولاً' : 'No data to export, generate a report first');
      return;
    }
    
    const headers = [
      isRTL ? 'الموظف' : 'Employee',
      isRTL ? 'القسم' : 'Department',
      isRTL ? 'أيام الحضور' : 'Present Days',
      isRTL ? 'أيام التأخير' : 'Late Days',
      isRTL ? 'ساعات العمل' : 'Total Hours',
      isRTL ? 'الوقت الإضافي' : 'Overtime (min)',
      isRTL ? 'التأخير' : 'Late (min)'
    ];
    
    const rows = Object.values(reportData.employee_stats).map(emp => [
      emp.employee_name,
      emp.department || '-',
      emp.present_days,
      emp.late_days,
      emp.total_hours,
      emp.overtime_minutes,
      emp.late_minutes
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_report_${reportDates.from}_${reportDates.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير التقرير' : 'Report exported');
  };

  // Print attendance report
  const handlePrintReport = () => {
    if (!reportData) {
      toast.error(isRTL ? 'لا توجد بيانات للطباعة' : 'No data to print');
      return;
    }
    
    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${isRTL ? 'تقرير الحضور' : 'Attendance Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #1a365d; }
          .period { background: #f7fafc; padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { background: #ebf8ff; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-card h3 { margin: 0; font-size: 24px; color: #2b6cb0; }
          .summary-card p { margin: 5px 0 0; color: #4a5568; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; }
          th { background: #edf2f7; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #718096; font-size: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isRTL ? 'تقرير الحضور والانصراف' : 'Attendance Report'}</h1>
        </div>
        
        <div class="period">
          <strong>${isRTL ? 'الفترة:' : 'Period:'}</strong> ${reportDates.from} ${isRTL ? 'إلى' : 'to'} ${reportDates.to}
        </div>
        
        <div class="summary">
          <div class="summary-card">
            <h3>${reportData.summary?.total_records || 0}</h3>
            <p>${isRTL ? 'إجمالي السجلات' : 'Total Records'}</p>
          </div>
          <div class="summary-card">
            <h3>${reportData.summary?.unique_employees || 0}</h3>
            <p>${isRTL ? 'عدد الموظفين' : 'Employees'}</p>
          </div>
          <div class="summary-card">
            <h3>${reportData.summary?.total_late || 0}</h3>
            <p>${isRTL ? 'حالات التأخير' : 'Late Arrivals'}</p>
          </div>
          <div class="summary-card">
            <h3>${(reportData.summary?.avg_work_hours || 0).toFixed(1)}</h3>
            <p>${isRTL ? 'متوسط ساعات العمل' : 'Avg Work Hours'}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>${isRTL ? 'الموظف' : 'Employee'}</th>
              <th>${isRTL ? 'القسم' : 'Department'}</th>
              <th>${isRTL ? 'أيام الحضور' : 'Present'}</th>
              <th>${isRTL ? 'التأخير' : 'Late'}</th>
              <th>${isRTL ? 'ساعات العمل' : 'Hours'}</th>
              <th>${isRTL ? 'الإضافي' : 'Overtime'}</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(reportData.employee_stats || {}).map(emp => `
              <tr>
                <td>${emp.employee_name}</td>
                <td>${emp.department || '-'}</td>
                <td>${emp.present_days}</td>
                <td>${emp.late_days}</td>
                <td>${emp.total_hours}</td>
                <td>${emp.overtime_minutes} min</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>${isRTL ? 'تم إنشاء التقرير بواسطة' : 'Generated by'} DataLife Account ERP</p>
          <p>${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // Export attendance report to PDF
  const handleExportPDF = () => {
    if (!reportData) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }
    
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #1a365d;">${isRTL ? 'تقرير الحضور والانصراف' : 'Attendance Report'}</h1>
        </div>
        
        <div style="background: #f7fafc; padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <strong>${isRTL ? 'الفترة:' : 'Period:'}</strong> ${reportDates.from} ${isRTL ? 'إلى' : 'to'} ${reportDates.to}
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <div style="flex: 1; background: #ebf8ff; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #2b6cb0;">${reportData.summary?.total_records || 0}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'إجمالي السجلات' : 'Total Records'}</p>
          </div>
          <div style="flex: 1; background: #c6f6d5; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #276749;">${reportData.summary?.unique_employees || 0}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'عدد الموظفين' : 'Employees'}</p>
          </div>
          <div style="flex: 1; background: #fefcbf; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #975a16;">${reportData.summary?.total_late || 0}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'حالات التأخير' : 'Late Arrivals'}</p>
          </div>
          <div style="flex: 1; background: #e9d8fd; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #553c9a;">${(reportData.summary?.avg_work_hours || 0).toFixed(1)}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'متوسط ساعات العمل' : 'Avg Work Hours'}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #edf2f7;">
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الموظف' : 'Employee'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'القسم' : 'Department'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'أيام الحضور' : 'Present'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'التأخير' : 'Late'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'ساعات العمل' : 'Hours'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الإضافي' : 'Overtime'}</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(reportData.employee_stats || {}).map(emp => `
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.employee_name}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.department || '-'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.present_days}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.late_days}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.total_hours}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${emp.overtime_minutes} min</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 40px; text-align: center; color: #718096; font-size: 12px;">
          <p>${isRTL ? 'تم إنشاء التقرير بواسطة' : 'Generated by'} DataLife Account ERP</p>
          <p>${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = content;
    
    const opt = {
      margin: 10,
      filename: `attendance_report_${reportDates.from}_${reportDates.to}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
    toast.success(isRTL ? 'تم تصدير التقرير PDF' : 'Report exported as PDF');
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(
        `${API_URL}/api/attendance/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
      setShowSettingsDialog(false);
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  // Get employees who haven't checked in yet
  const getUncheckedEmployees = () => {
    if (!todayData?.records || !employees.length) return employees;
    const checkedInIds = todayData.records.map(r => r.employee_id);
    return employees.filter(e => !checkedInIds.includes(e.id));
  };

  // Get employees who checked in but haven't checked out
  const getCheckedInEmployees = () => {
    if (!todayData?.records) return [];
    return todayData.records.filter(r => r.check_in_time && !r.check_out_time);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.attendance}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500">
              {isRTL ? 'إدارة حضور وانصراف الموظفين' : 'Manage employee attendance'}
            </p>
            <Badge variant="outline" className={isConnected ? 'text-green-600 border-green-300' : 'text-gray-400 border-gray-200'}>
              {isConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {isConnected ? (isRTL ? 'متصل' : 'Live') : (isRTL ? 'غير متصل' : 'Offline')}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateQR} className="gap-2">
            <QrCode className="h-4 w-4" />
            {t.generateQR}
          </Button>
          <Button onClick={() => setShowCheckInDialog(true)} className="gap-2 bg-green-600 hover:bg-green-700">
            <LogIn className="h-4 w-4" />
            {t.checkIn}
          </Button>
          <Button onClick={() => setShowCheckOutDialog(true)} className="gap-2 bg-red-600 hover:bg-red-700">
            <LogOut className="h-4 w-4" />
            {t.checkOut}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalEmployees}</p>
                <p className="text-2xl font-bold text-blue-900">
                  {todayData?.summary?.total_employees || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">{t.presentToday}</p>
                <p className="text-2xl font-bold text-green-900">
                  {todayData?.summary?.present || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <UserX className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-600">{t.absentToday}</p>
                <p className="text-2xl font-bold text-red-900">
                  {todayData?.summary?.absent || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.lateToday}</p>
                <p className="text-2xl font-bold text-amber-900">
                  {todayData?.summary?.late || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="today" className="gap-2">
              <Clock className="h-4 w-4" />
              {t.todayAttendance}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {t.reports}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              {t.settings}
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={fetchTodayAttendance}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Today's Attendance Tab */}
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {todayData?.date || new Date().toISOString().slice(0, 10)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                </div>
              ) : !todayData?.records?.length ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">{t.noRecords}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.employee}</TableHead>
                      <TableHead>{t.department}</TableHead>
                      <TableHead>{t.checkIn}</TableHead>
                      <TableHead>{t.checkOut}</TableHead>
                      <TableHead>{t.workHours}</TableHead>
                      <TableHead>{t.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayData.records.map((record, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{record.employee_name}</TableCell>
                        <TableCell>{record.department || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <LogIn className="h-4 w-4 text-green-500" />
                            {record.check_in_time?.slice(11, 16)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.check_out_time ? (
                            <div className="flex items-center gap-2">
                              <LogOut className="h-4 w-4 text-red-500" />
                              {record.check_out_time?.slice(11, 16)}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-amber-600">
                              {isRTL ? 'لم ينصرف' : 'Still working'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.work_hours ? (
                            <span className="font-medium">
                              {record.work_hours} {t.hours}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[record.status] || statusColors.present}>
                            {record.is_late && <AlertCircle className="h-3 w-3 mr-1" />}
                            {record.is_late ? t.late : t.present}
                          </Badge>
                          {record.late_minutes > 0 && (
                            <span className="text-xs text-amber-600 ml-2">
                              ({record.late_minutes} {t.minutes})
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t.reports}</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>{t.fromDate}</Label>
                    <Input
                      type="date"
                      value={reportDates.from}
                      onChange={(e) => setReportDates({...reportDates, from: e.target.value})}
                      className="w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>{t.toDate}</Label>
                    <Input
                      type="date"
                      value={reportDates.to}
                      onChange={(e) => setReportDates({...reportDates, to: e.target.value})}
                      className="w-40"
                    />
                  </div>
                  <Button onClick={handleGenerateReport} className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t.generateReport}
                  </Button>
                  <Button variant="outline" onClick={handleExportCSV} className="gap-2" disabled={!reportData}>
                    <FileDown className="h-4 w-4" />
                    {isRTL ? 'تصدير CSV' : 'Export CSV'}
                  </Button>
                  <Button variant="outline" onClick={handlePrintReport} className="gap-2" disabled={!reportData}>
                    <Printer className="h-4 w-4" />
                    {isRTL ? 'طباعة' : 'Print'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reportData ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-blue-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-blue-600">{t.totalEmployees}</p>
                        <p className="text-2xl font-bold">{reportData.summary?.total_employees}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-green-600">{isRTL ? 'أيام الحضور' : 'Present Days'}</p>
                        <p className="text-2xl font-bold">{reportData.summary?.total_present_days}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-amber-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-amber-600">{isRTL ? 'أيام التأخير' : 'Late Days'}</p>
                        <p className="text-2xl font-bold">{reportData.summary?.total_late_days}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-purple-600">{t.overtime}</p>
                        <p className="text-2xl font-bold">{Math.round(reportData.summary?.total_overtime_minutes / 60)} {t.hours}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Employee Details */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.employee}</TableHead>
                        <TableHead>{t.department}</TableHead>
                        <TableHead>{isRTL ? 'أيام الحضور' : 'Present'}</TableHead>
                        <TableHead>{isRTL ? 'أيام التأخير' : 'Late'}</TableHead>
                        <TableHead>{isRTL ? 'ساعات العمل' : 'Total Hours'}</TableHead>
                        <TableHead>{t.overtime}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.employees?.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{emp.employee_name}</TableCell>
                          <TableCell>{emp.department || '-'}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">{emp.present_days}</Badge>
                          </TableCell>
                          <TableCell>
                            {emp.late_days > 0 ? (
                              <Badge className="bg-amber-100 text-amber-700">{emp.late_days}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{emp.total_hours} {t.hours}</TableCell>
                          <TableCell>
                            {emp.overtime_minutes > 0 ? (
                              <span className="text-purple-600">
                                {Math.round(emp.overtime_minutes / 60)} {t.hours}
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">{isRTL ? 'اختر التواريخ واضغط إنشاء تقرير' : 'Select dates and generate report'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings}</CardTitle>
            </CardHeader>
            <CardContent>
              {settings && (
                <div className="grid grid-cols-2 gap-6 max-w-2xl">
                  <div className="space-y-2">
                    <Label>{t.workStartTime}</Label>
                    <Input
                      type="time"
                      value={settings.work_start_time}
                      onChange={(e) => setSettings({...settings, work_start_time: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.workEndTime}</Label>
                    <Input
                      type="time"
                      value={settings.work_end_time}
                      onChange={(e) => setSettings({...settings, work_end_time: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'ساعات العمل اليومية' : 'Work Hours Per Day'}</Label>
                    <Input
                      type="number"
                      value={settings.work_hours_per_day}
                      onChange={(e) => setSettings({...settings, work_hours_per_day: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.lateThreshold}</Label>
                    <Input
                      type="number"
                      value={settings.late_threshold_minutes}
                      onChange={(e) => setSettings({...settings, late_threshold_minutes: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleSaveSettings} className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t.save}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Check-In Dialog */}
      <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <LogIn className="h-5 w-5" />
              {t.checkIn}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>{t.selectEmployee}</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t.selectEmployee} />
              </SelectTrigger>
              <SelectContent>
                {getUncheckedEmployees().map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} - {emp.department || emp.position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckInDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCheckIn} className="bg-green-600 hover:bg-green-700">
              <LogIn className="h-4 w-4 mr-2" />
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-Out Dialog */}
      <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <LogOut className="h-5 w-5" />
              {t.checkOut}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>{t.selectEmployee}</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t.selectEmployee} />
              </SelectTrigger>
              <SelectContent>
                {getCheckedInEmployees().map(record => (
                  <SelectItem key={record.employee_id} value={record.employee_id}>
                    {record.employee_name} - {isRTL ? 'حضر' : 'In'}: {record.check_in_time?.slice(11, 16)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckOutDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCheckOut} className="bg-red-600 hover:bg-red-700">
              <LogOut className="h-4 w-4 mr-2" />
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5" />
              {isRTL ? 'رمز الحضور' : 'Attendance QR Code'}
            </DialogTitle>
          </DialogHeader>
          {qrCode && (
            <div className="py-6">
              <div className="bg-white p-6 rounded-lg border-2 border-dashed inline-block">
                <div className="text-6xl font-mono font-bold tracking-wider">
                  {qrCode.qr_code}
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                {t.qrExpiry}: {qrCode.expires_at?.slice(11, 16)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceManagement;
