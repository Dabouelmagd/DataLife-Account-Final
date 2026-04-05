import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Download, FileText, Users, Calendar, TrendingUp,
  DollarSign, Clock, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { 
  ChartLineUp, ChartBar, ChartPie, FileDoc, UsersThree,
  CalendarCheck, Money
} from '@phosphor-icons/react';

const HRReportsPage = ({ language }) => {
  const isRTL = language === 'ar';
  const [selectedReport, setSelectedReport] = useState('attendance');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const colors = {
    cyan: '#06b6d4',
    emerald: '#10b981',
    amber: '#f59e0b',
    violet: '#8b5cf6',
    rose: '#f43f5e',
    blue: '#3b82f6'
  };

  // Mock data for charts
  const attendanceData = [
    { month: language === 'ar' ? 'يناير' : 'Jan', present: 95, absent: 5, late: 8 },
    { month: language === 'ar' ? 'فبراير' : 'Feb', present: 92, absent: 8, late: 10 },
    { month: language === 'ar' ? 'مارس' : 'Mar', present: 96, absent: 4, late: 6 },
    { month: language === 'ar' ? 'أبريل' : 'Apr', present: 94, absent: 6, late: 9 },
    { month: language === 'ar' ? 'مايو' : 'May', present: 97, absent: 3, late: 5 },
    { month: language === 'ar' ? 'يونيو' : 'Jun', present: 93, absent: 7, late: 11 }
  ];

  const salaryData = [
    { month: language === 'ar' ? 'يناير' : 'Jan', salaries: 150000, allowances: 25000, deductions: 15000 },
    { month: language === 'ar' ? 'فبراير' : 'Feb', salaries: 155000, allowances: 28000, deductions: 18000 },
    { month: language === 'ar' ? 'مارس' : 'Mar', salaries: 152000, allowances: 26000, deductions: 16000 },
    { month: language === 'ar' ? 'أبريل' : 'Apr', salaries: 160000, allowances: 30000, deductions: 20000 },
    { month: language === 'ar' ? 'مايو' : 'May', salaries: 158000, allowances: 27000, deductions: 17000 },
    { month: language === 'ar' ? 'يونيو' : 'Jun', salaries: 165000, allowances: 32000, deductions: 22000 }
  ];

  const departmentData = [
    { name: language === 'ar' ? 'الإدارة' : 'Management', value: 5, color: colors.cyan },
    { name: language === 'ar' ? 'المالية' : 'Finance', value: 8, color: colors.emerald },
    { name: language === 'ar' ? 'المبيعات' : 'Sales', value: 12, color: colors.amber },
    { name: language === 'ar' ? 'التسويق' : 'Marketing', value: 6, color: colors.violet },
    { name: language === 'ar' ? 'تقنية المعلومات' : 'IT', value: 10, color: colors.blue }
  ];

  const leaveData = [
    { name: language === 'ar' ? 'إجازة سنوية' : 'Annual', value: 45, color: colors.violet },
    { name: language === 'ar' ? 'إجازة عارضة' : 'Casual', value: 25, color: colors.cyan },
    { name: language === 'ar' ? 'إجازة مرضية' : 'Sick', value: 15, color: colors.rose },
    { name: language === 'ar' ? 'أخرى' : 'Other', value: 15, color: colors.amber }
  ];

  const reportTypes = [
    { id: 'attendance', name: language === 'ar' ? 'تقرير الحضور' : 'Attendance Report', icon: CalendarCheck },
    { id: 'salary', name: language === 'ar' ? 'تقرير الرواتب' : 'Salary Report', icon: Money },
    { id: 'department', name: language === 'ar' ? 'تقرير الأقسام' : 'Department Report', icon: UsersThree },
    { id: 'leave', name: language === 'ar' ? 'تقرير الإجازات' : 'Leave Report', icon: CalendarCheck }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const exportReport = () => {
    // Mock export functionality
    alert(language === 'ar' ? 'جاري تصدير التقرير...' : 'Exporting report...');
  };

  const renderReport = () => {
    switch (selectedReport) {
      case 'attendance':
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartBar weight="fill" className="w-5 h-5 text-cyan-500" />
                  {language === 'ar' ? 'إحصائيات الحضور الشهرية' : 'Monthly Attendance Statistics'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="present" 
                      name={language === 'ar' ? 'حاضر' : 'Present'} 
                      fill={colors.emerald} 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="absent" 
                      name={language === 'ar' ? 'غائب' : 'Absent'} 
                      fill={colors.rose} 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="late" 
                      name={language === 'ar' ? 'متأخر' : 'Late'} 
                      fill={colors.amber} 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );

      case 'salary':
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartLineUp weight="fill" className="w-5 h-5 text-emerald-500" />
                  {language === 'ar' ? 'تحليل الرواتب الشهرية' : 'Monthly Salary Analysis'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={salaryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${(value/1000)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="salaries" 
                      name={language === 'ar' ? 'الرواتب' : 'Salaries'} 
                      stroke={colors.emerald} 
                      strokeWidth={3}
                      dot={{ fill: colors.emerald, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="allowances" 
                      name={language === 'ar' ? 'البدلات' : 'Allowances'} 
                      stroke={colors.cyan} 
                      strokeWidth={3}
                      dot={{ fill: colors.cyan, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="deductions" 
                      name={language === 'ar' ? 'الخصومات' : 'Deductions'} 
                      stroke={colors.rose} 
                      strokeWidth={3}
                      dot={{ fill: colors.rose, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );

      case 'department':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartPie weight="fill" className="w-5 h-5 text-violet-500" />
                  {language === 'ar' ? 'توزيع الموظفين حسب الأقسام' : 'Employee Distribution by Department'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'تفاصيل الأقسام' : 'Department Details'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departmentData.map((dept, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }}></div>
                        <span className="font-medium">{dept.name}</span>
                      </div>
                      <Badge variant="outline" className="font-bold">
                        {dept.value} {language === 'ar' ? 'موظف' : 'employees'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'leave':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartPie weight="fill" className="w-5 h-5 text-amber-500" />
                  {language === 'ar' ? 'توزيع أنواع الإجازات' : 'Leave Type Distribution'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leaveData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {leaveData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'تفاصيل الإجازات' : 'Leave Details'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveData.map((leave, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: leave.color }}></div>
                        <span className="font-medium">{leave.name}</span>
                      </div>
                      <Badge variant="outline" className="font-bold">
                        {leave.value}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="hr-reports-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ChartLineUp weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports'}
              </h1>
              <p className="text-slate-300 text-sm">
                {language === 'ar' 
                  ? 'تحليلات وتقارير شاملة للموارد البشرية'
                  : 'Comprehensive HR analytics and reports'
                }
              </p>
            </div>
          </div>
          <Button 
            className="bg-white text-slate-900 hover:bg-slate-100"
            onClick={exportReport}
          >
            <Download className="w-4 h-4 me-2" />
            {language === 'ar' ? 'تصدير التقرير' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {reportTypes.map((report) => {
              const Icon = report.icon;
              const isActive = selectedReport === report.id;
              return (
                <Button
                  key={report.id}
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => setSelectedReport(report.id)}
                  className={isActive 
                    ? 'bg-cyan-500 hover:bg-cyan-600' 
                    : 'hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300'
                  }
                >
                  <Icon weight={isActive ? 'fill' : 'regular'} className="w-4 h-4 me-2" />
                  {report.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{language === 'ar' ? 'من:' : 'From:'}</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{language === 'ar' ? 'إلى:' : 'To:'}</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-40"
              />
            </div>
            <Button variant="outline" className="ms-auto">
              {language === 'ar' ? 'تطبيق' : 'Apply'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {renderReport()}
    </div>
  );
};

export default HRReportsPage;
