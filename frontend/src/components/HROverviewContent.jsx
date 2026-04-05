import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Users, Plus, Eye, Edit, TrendingUp, Briefcase, Clock,
  DollarSign, UserCheck, UserMinus, Calendar, ChevronRight,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  UsersThree, UserCircle, Money, ClockCounterClockwise, CalendarCheck,
  ChartLineUp, Wallet, Briefcase as BriefcaseIcon
} from '@phosphor-icons/react';

const HROverviewContent = ({ 
  language, 
  stats, 
  employees, 
  onAddEmployee, 
  onViewProfile, 
  onEditEmployee 
}) => {
  // HR Module color theme (Cyan)
  const colors = {
    gradient: 'from-cyan-500 to-cyan-600',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    border: 'border-cyan-500/30',
    text: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500',
    light: 'bg-cyan-50 dark:bg-cyan-950/50',
    dark: 'bg-cyan-900'
  };

  const statsCards = [
    {
      id: 'employees',
      title: language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees',
      value: stats?.totalEmployees || 0,
      change: '+12%',
      trend: 'up',
      icon: UsersThree,
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/50',
      iconColor: 'bg-cyan-500'
    },
    {
      id: 'allowances',
      title: language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances',
      value: stats?.totalAllowances?.toLocaleString() || 0,
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      change: '+8%',
      trend: 'up',
      icon: Wallet,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500'
    },
    {
      id: 'deductions',
      title: language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions',
      value: stats?.totalDeductions?.toLocaleString() || 0,
      suffix: language === 'ar' ? 'ج.م' : 'EGP',
      change: '-3%',
      trend: 'down',
      icon: Money,
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'bg-amber-500'
    },
    {
      id: 'attendance',
      title: language === 'ar' ? 'نسبة الحضور' : 'Attendance Rate',
      value: '94%',
      change: '+2%',
      trend: 'up',
      icon: CalendarCheck,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500'
    }
  ];

  const quickActions = [
    {
      title: language === 'ar' ? 'إضافة موظف' : 'Add Employee',
      icon: Users,
      color: 'bg-cyan-500 hover:bg-cyan-600',
      action: onAddEmployee
    },
    {
      title: language === 'ar' ? 'كشف الرواتب' : 'Payroll',
      icon: DollarSign,
      color: 'bg-emerald-500 hover:bg-emerald-600',
      action: () => {}
    },
    {
      title: language === 'ar' ? 'الحضور' : 'Attendance',
      icon: Clock,
      color: 'bg-amber-500 hover:bg-amber-600',
      action: () => {}
    },
    {
      title: language === 'ar' ? 'التقارير' : 'Reports',
      icon: ChartLineUp,
      color: 'bg-violet-500 hover:bg-violet-600',
      action: () => {}
    }
  ];

  return (
    <div className="space-y-6" data-testid="hr-overview-content">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-cyan-800 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <UsersThree weight="fill" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {language === 'ar' ? 'الموارد البشرية' : 'Human Resources'}
                </h1>
                <p className="text-cyan-100 text-sm">
                  {language === 'ar' 
                    ? 'إدارة الموظفين والرواتب والحضور'
                    : 'Manage employees, payroll, and attendance'
                  }
                </p>
              </div>
            </div>
            <Button 
              className="bg-white text-cyan-700 hover:bg-cyan-50"
              onClick={onAddEmployee}
            >
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.id}
              className={`group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 ${card.bgColor}`}
              data-testid={`hr-stat-${card.id}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.iconColor}`}></div>
              
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {card.title}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {card.value}
                      </span>
                      {card.suffix && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {card.suffix}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {card.trend === 'up' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${card.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {card.change}
                      </span>
                      <span className="text-xs text-slate-400">
                        {language === 'ar' ? 'هذا الشهر' : 'this month'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.iconColor} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon weight="fill" className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  onClick={action.action}
                  className={`h-20 flex flex-col items-center justify-center gap-2 text-white ${action.color}`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{action.title}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                {language === 'ar' ? 'قائمة الموظفين' : 'Employee List'}
              </CardTitle>
              <Badge variant="outline" className="ms-2">
                {employees?.length || 0} {language === 'ar' ? 'موظف' : 'employees'}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="text-cyan-600 hover:text-cyan-700">
              {language === 'ar' ? 'عرض الكل' : 'View All'}
              <ChevronRight className="w-4 h-4 ms-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees && employees.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="font-semibold">{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                    <TableHead className="font-semibold">{language === 'ar' ? 'الوظيفة' : 'Position'}</TableHead>
                    <TableHead className="font-semibold">{language === 'ar' ? 'القسم' : 'Department'}</TableHead>
                    <TableHead className="font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="font-semibold">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.slice(0, 10).map((employee, index) => (
                    <TableRow 
                      key={index}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-cyan-200">
                            {employee.photo_url ? (
                              <AvatarImage src={employee.photo_url} />
                            ) : null}
                            <AvatarFallback className="bg-cyan-100 text-cyan-700 font-semibold">
                              {employee.employee_name?.split(' ').map(n => n[0]).join('') || 'NA'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{employee.employee_name || 'N/A'}</p>
                            <p className="text-xs text-slate-500">{employee.employee_id || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-700 dark:text-slate-300">{employee.job_title || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">
                          {employee.department || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100">
                          {language === 'ar' ? 'نشط' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                            onClick={() => onViewProfile(employee.id || employee.employee_id)}
                            title={language === 'ar' ? 'عرض الملف' : 'View Profile'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                            onClick={() => onEditEmployee(employee.id || employee.employee_id)}
                            title={language === 'ar' ? 'تعديل' : 'Edit'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                {language === 'ar' ? 'لا يوجد موظفين بعد' : 'No employees yet'}
              </p>
              <Button onClick={onAddEmployee} className="bg-cyan-500 hover:bg-cyan-600">
                <Plus className="w-4 h-4 me-2" />
                {language === 'ar' ? 'إضافة موظف' : 'Add Employee'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HROverviewContent;
