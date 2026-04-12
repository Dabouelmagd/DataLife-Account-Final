import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Download, Printer, FileText, Search, RefreshCw,
  Calendar, User, Clock, DollarSign, TrendingUp, TrendingDown,
  BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  ChartBar, FilePdf, Calendar as CalendarIcon, User as UserIcon,
  CurrencyDollar, ArrowUp, ArrowDown, Clock as ClockIcon
} from '@phosphor-icons/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from 'recharts';
import html2pdf from 'html2pdf.js';
import { useLanguage } from '../contexts/LanguageContext';

const HRComprehensiveReportsPage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';
  const reportRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportData, setReportData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const t = {
    title: isRTL ? 'التقارير الشاملة للموارد البشرية' : 'Comprehensive HR Reports',
    subtitle: isRTL ? 'تقارير شاملة تجمع الحضور والخصومات والبدلات' : 'Comprehensive reports combining attendance, deductions, and allowances',
    employee: isRTL ? 'الموظف' : 'Employee',
    month: isRTL ? 'الشهر' : 'Month',
    all: isRTL ? 'جميع الموظفين' : 'All Employees',
    generateReport: isRTL ? 'إنشاء التقرير' : 'Generate Report',
    exportPDF: isRTL ? 'تصدير PDF' : 'Export PDF',
    print: isRTL ? 'طباعة' : 'Print',
    attendance: isRTL ? 'الحضور' : 'Attendance',
    deductions: isRTL ? 'الخصومات' : 'Deductions',
    allowances: isRTL ? 'البدلات' : 'Allowances',
    summary: isRTL ? 'الملخص المالي' : 'Financial Summary',
    workingDays: isRTL ? 'أيام العمل' : 'Working Days',
    presentDays: isRTL ? 'أيام الحضور' : 'Present Days',
    absentDays: isRTL ? 'أيام الغياب' : 'Absent Days',
    lateDays: isRTL ? 'أيام التأخير' : 'Late Days',
    totalDeductions: isRTL ? 'إجمالي الخصومات' : 'Total Deductions',
    totalAllowances: isRTL ? 'إجمالي البدلات' : 'Total Allowances',
    netBalance: isRTL ? 'الصافي' : 'Net Balance',
    baseSalary: isRTL ? 'الراتب الأساسي' : 'Base Salary',
    finalSalary: isRTL ? 'الراتب النهائي' : 'Final Salary',
    noData: isRTL ? 'لا توجد بيانات' : 'No data available',
    charts: isRTL ? 'الرسوم البيانية' : 'Charts',
    details: isRTL ? 'التفاصيل' : 'Details'
  };

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const attendanceColors = { present: '#10B981', absent: '#EF4444', late: '#F59E0B' };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0 && (selectedEmployee || selectedMonth)) {
      fetchReportData();
    }
  }, [selectedEmployee, selectedMonth, employees.length]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Handle both array and object with employees property
        const employeesList = Array.isArray(data) ? data : (data.data || data.employees || []);
        setEmployees(employeesList);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Mock data
      setEmployees([
        { id: 'EMP001', name: isRTL ? 'أحمد محمد' : 'Ahmed Mohamed', employee_code: 'EMP-0001', position: isRTL ? 'مدير' : 'Manager', basic_salary: 15000 },
        { id: 'EMP002', name: isRTL ? 'سارة أحمد' : 'Sara Ahmed', employee_code: 'EMP-0002', position: isRTL ? 'محاسب' : 'Accountant', basic_salary: 10000 },
        { id: 'EMP003', name: isRTL ? 'محمد علي' : 'Mohamed Ali', employee_code: 'EMP-0003', position: isRTL ? 'مهندس' : 'Engineer', basic_salary: 12000 }
      ]);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const employeeParam = selectedEmployee !== 'all' ? `&employee_id=${selectedEmployee}` : '';
      
      const [attendanceRes, deductionsRes, allowancesRes] = await Promise.all([
        fetch(`${API_URL}/api/hr/attendance?month=${selectedMonth}${employeeParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/hr/deductions?month=${selectedMonth}${employeeParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/hr/allowances?month=${selectedMonth}${employeeParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const attendance = attendanceRes.ok ? await attendanceRes.json() : [];
      const deductions = deductionsRes.ok ? await deductionsRes.json() : [];
      const allowances = allowancesRes.ok ? await allowancesRes.json() : [];

      // Process data per employee
      const employeeReports = {};
      const targetEmployees = selectedEmployee === 'all' 
        ? (Array.isArray(employees) ? employees : [])
        : (Array.isArray(employees) ? employees.filter(e => e.id === selectedEmployee) : []);

      targetEmployees.forEach(emp => {
        const empAttendance = Array.isArray(attendance) ? attendance.filter(a => a.employee_id === emp.id) : [];
        const empDeductions = Array.isArray(deductions) ? deductions.filter(d => d.employee_id === emp.id) : [];
        const empAllowances = Array.isArray(allowances) ? allowances.filter(a => a.employee_id === emp.id) : [];

        const presentDays = empAttendance.filter(a => a.status === 'present').length;
        const absentDays = empAttendance.filter(a => a.status === 'absent').length;
        const lateDays = empAttendance.filter(a => a.is_late).length;
        const totalDeductions = empDeductions.reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalAllowances = empAllowances.reduce((sum, a) => sum + (a.amount || 0), 0);
        const baseSalary = emp.basic_salary || 0;
        const netBalance = totalAllowances - totalDeductions;
        const finalSalary = baseSalary + netBalance;

        employeeReports[emp.id] = {
          employee: emp,
          attendance: {
            workingDays: 22, // Assuming 22 working days
            presentDays,
            absentDays,
            lateDays,
            attendanceRate: presentDays > 0 ? Math.round((presentDays / 22) * 100) : 0
          },
          deductions: {
            items: empDeductions,
            total: totalDeductions,
            byCategory: empDeductions.reduce((acc, d) => {
              acc[d.category] = (acc[d.category] || 0) + (d.amount || 0);
              return acc;
            }, {})
          },
          allowances: {
            items: empAllowances,
            total: totalAllowances,
            byCategory: empAllowances.reduce((acc, a) => {
              acc[a.category] = (acc[a.category] || 0) + (a.amount || 0);
              return acc;
            }, {})
          },
          summary: {
            baseSalary,
            totalDeductions,
            totalAllowances,
            netBalance,
            finalSalary
          }
        };
      });

      setReportData(employeeReports);
    } catch (error) {
      console.error('Error fetching report data:', error);
      // Generate mock report data
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const mockReports = {};
    const targetEmployees = selectedEmployee === 'all' 
      ? (Array.isArray(employees) ? employees : [])
      : (Array.isArray(employees) ? employees.filter(e => e.id === selectedEmployee) : []);

    targetEmployees.forEach(emp => {
      const baseSalary = emp.basic_salary || 10000;
      const totalDeductions = Math.floor(Math.random() * 2000);
      const totalAllowances = Math.floor(Math.random() * 3000);
      const netBalance = totalAllowances - totalDeductions;

      mockReports[emp.id] = {
        employee: emp,
        attendance: {
          workingDays: 22,
          presentDays: 18 + Math.floor(Math.random() * 4),
          absentDays: Math.floor(Math.random() * 3),
          lateDays: Math.floor(Math.random() * 5),
          attendanceRate: 85 + Math.floor(Math.random() * 15)
        },
        deductions: {
          items: [
            { category: 'late', amount: totalDeductions * 0.3, date: `${selectedMonth}-05` },
            { category: 'insurance', amount: totalDeductions * 0.7, date: `${selectedMonth}-01` }
          ],
          total: totalDeductions,
          byCategory: { late: totalDeductions * 0.3, insurance: totalDeductions * 0.7 }
        },
        allowances: {
          items: [
            { category: 'overtime', amount: totalAllowances * 0.5, hours: 10, date: `${selectedMonth}-15` },
            { category: 'transport', amount: totalAllowances * 0.5, date: `${selectedMonth}-01` }
          ],
          total: totalAllowances,
          byCategory: { overtime: totalAllowances * 0.5, transport: totalAllowances * 0.5 }
        },
        summary: {
          baseSalary,
          totalDeductions,
          totalAllowances,
          netBalance,
          finalSalary: baseSalary + netBalance
        }
      };
    });

    setReportData(mockReports);
  };

  const handleExportPDF = () => {
    if (!reportRef.current) return;
    
    const opt = {
      margin: 10,
      filename: `hr_report_${selectedMonth}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(reportRef.current).save();
  };

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (category, type) => {
    const labels = {
      deductions: {
        absence: isRTL ? 'غياب' : 'Absence',
        late: isRTL ? 'تأخير' : 'Late',
        penalty: isRTL ? 'جزاء' : 'Penalty',
        loan: isRTL ? 'سلفة' : 'Loan',
        insurance: isRTL ? 'تأمينات' : 'Insurance',
        tax: isRTL ? 'ضرائب' : 'Tax'
      },
      allowances: {
        overtime: isRTL ? 'إضافي' : 'Overtime',
        housing: isRTL ? 'سكن' : 'Housing',
        transport: isRTL ? 'انتقال' : 'Transport',
        bonus: isRTL ? 'مكافأة' : 'Bonus'
      }
    };
    return labels[type]?.[category] || category;
  };

  const filteredEmployees = Array.isArray(employees) ? employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const statsCards = reportData ? [
    {
      title: isRTL ? 'إجمالي الموظفين' : 'Total Employees',
      value: Object.keys(reportData).length,
      icon: UserIcon,
      color: 'blue'
    },
    {
      title: isRTL ? 'إجمالي الخصومات' : 'Total Deductions',
      value: Object.values(reportData).reduce((sum, r) => sum + r.summary.totalDeductions, 0).toLocaleString(),
      suffix: isRTL ? 'ج.م' : 'EGP',
      icon: ArrowDown,
      color: 'red'
    },
    {
      title: isRTL ? 'إجمالي البدلات' : 'Total Allowances',
      value: Object.values(reportData).reduce((sum, r) => sum + r.summary.totalAllowances, 0).toLocaleString(),
      suffix: isRTL ? 'ج.م' : 'EGP',
      icon: ArrowUp,
      color: 'green'
    },
    {
      title: isRTL ? 'صافي الفرق' : 'Net Difference',
      value: Object.values(reportData).reduce((sum, r) => sum + r.summary.netBalance, 0).toLocaleString(),
      suffix: isRTL ? 'ج.م' : 'EGP',
      icon: CurrencyDollar,
      color: 'violet'
    }
  ] : [];

  // Prepare chart data
  const getChartData = () => {
    if (!reportData || Object.keys(reportData).length === 0) return null;

    // Attendance pie chart data
    const totalPresent = Object.values(reportData).reduce((sum, r) => sum + r.attendance.presentDays, 0);
    const totalAbsent = Object.values(reportData).reduce((sum, r) => sum + r.attendance.absentDays, 0);
    const totalLate = Object.values(reportData).reduce((sum, r) => sum + r.attendance.lateDays, 0);

    const attendancePieData = [
      { name: isRTL ? 'حاضر' : 'Present', value: totalPresent, fill: attendanceColors.present },
      { name: isRTL ? 'غائب' : 'Absent', value: totalAbsent, fill: attendanceColors.absent },
      { name: isRTL ? 'متأخر' : 'Late', value: totalLate, fill: attendanceColors.late }
    ];

    // Employee comparison bar chart
    const employeeBarData = Object.values(reportData).map(r => ({
      name: r.employee.name?.split(' ')[0] || 'N/A',
      deductions: r.summary.totalDeductions,
      allowances: r.summary.totalAllowances,
      salary: r.summary.finalSalary
    }));

    // Deductions by category
    const deductionsCategory = {};
    Object.values(reportData).forEach(r => {
      Object.entries(r.deductions.byCategory).forEach(([cat, amount]) => {
        deductionsCategory[cat] = (deductionsCategory[cat] || 0) + amount;
      });
    });
    const deductionsPieData = Object.entries(deductionsCategory).map(([name, value], i) => ({
      name: getCategoryLabel(name, 'deductions'),
      value,
      fill: COLORS[i % COLORS.length]
    }));

    // Allowances by category
    const allowancesCategory = {};
    Object.values(reportData).forEach(r => {
      Object.entries(r.allowances.byCategory).forEach(([cat, amount]) => {
        allowancesCategory[cat] = (allowancesCategory[cat] || 0) + amount;
      });
    });
    const allowancesPieData = Object.entries(allowancesCategory).map(([name, value], i) => ({
      name: getCategoryLabel(name, 'allowances'),
      value,
      fill: COLORS[i % COLORS.length]
    }));

    return {
      attendancePieData,
      employeeBarData,
      deductionsPieData,
      allowancesPieData
    };
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6" data-testid="hr-comprehensive-reports">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ChartBar weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{t.title}</h1>
              <p className="text-slate-300 text-sm">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 me-2" />
              {t.print}
            </Button>
            <Button 
              className="bg-white text-slate-800 hover:bg-slate-100"
              onClick={handleExportPDF}
            >
              <FilePdf weight="fill" className="w-4 h-4 me-2" />
              {t.exportPDF}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-2 block">{t.employee}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder={t.all} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  {filteredEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="mb-2 block">{t.month}</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <Button onClick={fetchReportData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              {t.generateReport}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card, index) => {
            const Icon = card.icon;
            const colorClasses = {
              blue: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-600', icon: 'bg-blue-500' },
              red: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-600', icon: 'bg-red-500' },
              green: { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-600', icon: 'bg-green-500' },
              violet: { bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-600', icon: 'bg-violet-500' }
            }[card.color];

            return (
              <Card key={index} className={`border-0 shadow-sm ${colorClasses.bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                      <div className="flex items-baseline gap-1">
                        <p className={`text-2xl font-bold ${colorClasses.text}`}>{card.value}</p>
                        {card.suffix && <span className="text-sm text-slate-500">{card.suffix}</span>}
                      </div>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${colorClasses.icon} flex items-center justify-center`}>
                      <Icon weight="fill" className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts Section */}
      {reportData && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Pie Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-500" />
                {isRTL ? 'توزيع الحضور' : 'Attendance Distribution'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.attendancePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.attendancePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Employee Comparison Bar Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-500" />
                {isRTL ? 'مقارنة الموظفين' : 'Employee Comparison'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.employeeBarData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="allowances" name={isRTL ? 'البدلات' : 'Allowances'} fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deductions" name={isRTL ? 'الخصومات' : 'Deductions'} fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Deductions by Category */}
          {chartData.deductionsPieData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  {isRTL ? 'الخصومات حسب الفئة' : 'Deductions by Category'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.deductionsPieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.deductionsPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allowances by Category */}
          {chartData.allowancesPieData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  {isRTL ? 'البدلات حسب الفئة' : 'Allowances by Category'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.allowancesPieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.allowancesPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6 print:p-4">
        {reportData && Object.values(reportData).map((report) => (
          <Card key={report.employee.id} className="border-0 shadow-sm overflow-hidden">
            {/* Employee Header */}
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-slate-200 text-slate-700 text-lg">
                      {report.employee.name?.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg">{report.employee.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="font-mono">{report.employee.employee_code}</span>
                      <span>•</span>
                      <span>{report.employee.position}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">{t.baseSalary}</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {report.summary.baseSalary.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Attendance Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    {t.attendance}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <span className="text-sm">{t.workingDays}</span>
                      <span className="font-medium">{report.attendance.workingDays}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <span className="text-sm text-green-700 dark:text-green-400">{t.presentDays}</span>
                      <span className="font-medium text-green-700 dark:text-green-400">{report.attendance.presentDays}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                      <span className="text-sm text-red-700 dark:text-red-400">{t.absentDays}</span>
                      <span className="font-medium text-red-700 dark:text-red-400">{report.attendance.absentDays}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <span className="text-sm text-amber-700 dark:text-amber-400">{t.lateDays}</span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">{report.attendance.lateDays}</span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</span>
                        <span>{report.attendance.attendanceRate}%</span>
                      </div>
                      <Progress value={report.attendance.attendanceRate} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    {t.deductions}
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(report.deductions.byCategory).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between items-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                        <span className="text-sm">{getCategoryLabel(cat, 'deductions')}</span>
                        <span className="font-medium text-red-600">-{amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {Object.keys(report.deductions.byCategory).length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">{t.noData}</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-red-100 dark:bg-red-900/50 font-semibold">
                    <span>{t.totalDeductions}</span>
                    <span className="text-red-700 dark:text-red-400">-{report.deductions.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Allowances Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    {t.allowances}
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(report.allowances.byCategory).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <span className="text-sm">{getCategoryLabel(cat, 'allowances')}</span>
                        <span className="font-medium text-green-600">+{amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {Object.keys(report.allowances.byCategory).length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">{t.noData}</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-100 dark:bg-green-900/50 font-semibold">
                    <span>{t.totalAllowances}</span>
                    <span className="text-green-700 dark:text-green-400">+{report.allowances.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-violet-500" />
                  {t.summary}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
                    <p className="text-sm text-slate-500 mb-1">{t.baseSalary}</p>
                    <p className="text-lg font-bold">{report.summary.baseSalary.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-green-100 dark:bg-green-900/50 text-center">
                    <p className="text-sm text-green-600 mb-1">{t.totalAllowances}</p>
                    <p className="text-lg font-bold text-green-700">+{report.summary.totalAllowances.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/50 text-center">
                    <p className="text-sm text-red-600 mb-1">{t.totalDeductions}</p>
                    <p className="text-lg font-bold text-red-700">-{report.summary.totalDeductions.toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center ${report.summary.netBalance >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-rose-100 dark:bg-rose-900/50'}`}>
                    <p className="text-sm text-slate-600 mb-1">{t.netBalance}</p>
                    <p className={`text-lg font-bold ${report.summary.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {report.summary.netBalance >= 0 ? '+' : ''}{report.summary.netBalance.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-center">
                    <p className="text-sm text-violet-600 mb-1">{t.finalSalary}</p>
                    <p className="text-xl font-bold text-violet-700">{report.summary.finalSalary.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!reportData || Object.keys(reportData).length === 0) && !loading && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t.noData}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-testid="hr-comprehensive-reports"], [data-testid="hr-comprehensive-reports"] * { visibility: visible; }
          [data-testid="hr-comprehensive-reports"] { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:p-4 { padding: 1rem; }
        }
      `}</style>
    </div>
  );
};

export default HRComprehensiveReportsPage;
