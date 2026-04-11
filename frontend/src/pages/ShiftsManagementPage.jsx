import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Plus, Edit, Trash2, Clock, Users, Sun, Moon, Sunrise
} from 'lucide-react';
import { 
  Clock as ClockIcon, Sun as SunIcon, Moon as MoonIcon, CalendarBlank
} from '@phosphor-icons/react';
import { useLanguage } from '../contexts/LanguageContext';

const ShiftsManagementPage = ({ language: propLanguage }) => {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage || 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    type: 'morning',
    start_time: '09:00',
    end_time: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    break_duration: 60,
    working_hours: 8,
    working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    overtime_rate: 1.5,
    holiday_rate: 2.0,
    night_rate: 1.25,
    overtime_starts_after: 8,
    allow_late_minutes: 15,
    deduct_after_late: true,
    is_active: true
  });

  const shiftTypes = [
    { value: 'morning', label: language === 'ar' ? 'صباحية' : 'Morning', icon: Sun, color: 'amber' },
    { value: 'evening', label: language === 'ar' ? 'مسائية' : 'Evening', icon: Sunrise, color: 'orange' },
    { value: 'night', label: language === 'ar' ? 'ليلية' : 'Night', icon: Moon, color: 'indigo' },
    { value: 'split', label: language === 'ar' ? 'منقسمة' : 'Split', icon: Clock, color: 'violet' },
    { value: 'flexible', label: language === 'ar' ? 'مرنة' : 'Flexible', icon: Clock, color: 'cyan' }
  ];

  const weekDays = [
    { value: 'sunday', label: language === 'ar' ? 'الأحد' : 'Sun' },
    { value: 'monday', label: language === 'ar' ? 'الإثنين' : 'Mon' },
    { value: 'tuesday', label: language === 'ar' ? 'الثلاثاء' : 'Tue' },
    { value: 'wednesday', label: language === 'ar' ? 'الأربعاء' : 'Wed' },
    { value: 'thursday', label: language === 'ar' ? 'الخميس' : 'Thu' },
    { value: 'friday', label: language === 'ar' ? 'الجمعة' : 'Fri' },
    { value: 'saturday', label: language === 'ar' ? 'السبت' : 'Sat' }
  ];

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setShifts(data);
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock data
      setShifts([
        { 
          id: 'SH001', name: 'Morning Shift', name_ar: 'الوردية الصباحية', type: 'morning',
          start_time: '08:00', end_time: '16:00', break_start: '12:00', break_end: '13:00',
          break_duration: 60, working_hours: 8, working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
          overtime_rate: 1.5, holiday_rate: 2.0, night_rate: 1.25, overtime_starts_after: 8,
          allow_late_minutes: 15, deduct_after_late: true, is_active: true, employee_count: 25
        },
        { 
          id: 'SH002', name: 'Evening Shift', name_ar: 'الوردية المسائية', type: 'evening',
          start_time: '14:00', end_time: '22:00', break_start: '18:00', break_end: '19:00',
          break_duration: 60, working_hours: 8, working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
          overtime_rate: 1.5, holiday_rate: 2.0, night_rate: 1.25, overtime_starts_after: 8,
          allow_late_minutes: 15, deduct_after_late: true, is_active: true, employee_count: 15
        },
        { 
          id: 'SH003', name: 'Night Shift', name_ar: 'الوردية الليلية', type: 'night',
          start_time: '22:00', end_time: '06:00', break_start: '02:00', break_end: '03:00',
          break_duration: 60, working_hours: 8, working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
          overtime_rate: 1.5, holiday_rate: 2.0, night_rate: 1.5, overtime_starts_after: 8,
          allow_late_minutes: 15, deduct_after_late: true, is_active: true, employee_count: 10
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddShift = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchShifts();
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error:', error);
      // Mock add
      const id = 'SH' + String(shifts.length + 1).padStart(3, '0');
      setShifts([...shifts, { ...formData, id, employee_count: 0 }]);
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleEditShift = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/hr/shifts/${selectedShift.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchShifts();
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setShifts(shifts.map(s => s.id === selectedShift.id ? { ...s, ...formData } : s));
      setShowEditModal(false);
    }
  };

  const handleDeleteShift = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/hr/shifts/${selectedShift.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchShifts();
    } catch (error) {
      setShifts(shifts.filter(s => s.id !== selectedShift.id));
    }
    setShowDeleteModal(false);
  };

  const resetForm = () => {
    setFormData({
      name: '', name_ar: '', type: 'morning', start_time: '09:00', end_time: '17:00',
      break_start: '12:00', break_end: '13:00', break_duration: 60, working_hours: 8,
      working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      overtime_rate: 1.5, holiday_rate: 2.0, night_rate: 1.25, overtime_starts_after: 8,
      allow_late_minutes: 15, deduct_after_late: true, is_active: true
    });
  };

  const openEditModal = (shift) => {
    setSelectedShift(shift);
    setFormData({
      name: shift.name, name_ar: shift.name_ar, type: shift.type,
      start_time: shift.start_time, end_time: shift.end_time,
      break_start: shift.break_start, break_end: shift.break_end,
      break_duration: shift.break_duration, working_hours: shift.working_hours,
      working_days: shift.working_days, overtime_rate: shift.overtime_rate,
      holiday_rate: shift.holiday_rate, night_rate: shift.night_rate,
      overtime_starts_after: shift.overtime_starts_after,
      allow_late_minutes: shift.allow_late_minutes, deduct_after_late: shift.deduct_after_late,
      is_active: shift.is_active
    });
    setShowEditModal(true);
  };

  const getShiftTypeConfig = (type) => {
    return shiftTypes.find(t => t.value === type) || shiftTypes[0];
  };

  const toggleWorkingDay = (day) => {
    const days = formData.working_days.includes(day)
      ? formData.working_days.filter(d => d !== day)
      : [...formData.working_days, day];
    setFormData({ ...formData, working_days: days });
  };

  const stats = {
    total: shifts.length,
    active: shifts.filter(s => s.is_active).length,
    totalEmployees: shifts.reduce((sum, s) => sum + (s.employee_count || 0), 0),
    avgHours: shifts.length > 0 ? Math.round(shifts.reduce((sum, s) => sum + (s.working_hours || 0), 0) / shifts.length) : 0
  };

  const statsCards = [
    {
      title: language === 'ar' ? 'إجمالي الورديات' : 'Total Shifts',
      value: stats.total,
      icon: ClockIcon,
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/50',
      iconColor: 'bg-cyan-500',
      textColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      title: language === 'ar' ? 'الورديات النشطة' : 'Active Shifts',
      value: stats.active,
      icon: SunIcon,
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
      iconColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: language === 'ar' ? 'إجمالي الموظفين' : 'Total Employees',
      value: stats.totalEmployees,
      icon: CalendarBlank,
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: language === 'ar' ? 'متوسط الساعات' : 'Avg Hours',
      value: stats.avgHours,
      suffix: language === 'ar' ? 'ساعة' : 'hrs',
      icon: MoonIcon,
      bgColor: 'bg-violet-50 dark:bg-violet-950/50',
      iconColor: 'bg-violet-500',
      textColor: 'text-violet-600 dark:text-violet-400'
    }
  ];

  const ShiftFormContent = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pe-2">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Morning Shift"
          />
        </div>
        <div>
          <Label>{language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
          <Input
            value={formData.name_ar}
            onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
            placeholder="الوردية الصباحية"
            dir="rtl"
          />
        </div>
      </div>
      
      <div>
        <Label>{language === 'ar' ? 'نوع الوردية' : 'Shift Type'}</Label>
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shiftTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Working Hours */}
      <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-4">
        <h4 className="font-medium text-sm">{language === 'ar' ? 'ساعات العمل' : 'Working Hours'}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{language === 'ar' ? 'بداية العمل' : 'Start Time'}</Label>
            <Input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            />
          </div>
          <div>
            <Label>{language === 'ar' ? 'نهاية العمل' : 'End Time'}</Label>
            <Input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{language === 'ar' ? 'بداية الاستراحة' : 'Break Start'}</Label>
            <Input
              type="time"
              value={formData.break_start}
              onChange={(e) => setFormData({ ...formData, break_start: e.target.value })}
            />
          </div>
          <div>
            <Label>{language === 'ar' ? 'نهاية الاستراحة' : 'Break End'}</Label>
            <Input
              type="time"
              value={formData.break_end}
              onChange={(e) => setFormData({ ...formData, break_end: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>{language === 'ar' ? 'ساعات العمل اليومية' : 'Working Hours/Day'}</Label>
          <Input
            type="number"
            value={formData.working_hours}
            onChange={(e) => setFormData({ ...formData, working_hours: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      {/* Working Days */}
      <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <h4 className="font-medium text-sm mb-3">{language === 'ar' ? 'أيام العمل' : 'Working Days'}</h4>
        <div className="flex flex-wrap gap-2">
          {weekDays.map(day => (
            <Button
              key={day.value}
              type="button"
              variant={formData.working_days.includes(day.value) ? "default" : "outline"}
              size="sm"
              className={formData.working_days.includes(day.value) ? "bg-cyan-500 hover:bg-cyan-600" : ""}
              onClick={() => toggleWorkingDay(day.value)}
            >
              {day.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Overtime Settings */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 space-y-4">
        <h4 className="font-medium text-sm">{language === 'ar' ? 'إعدادات الإضافي' : 'Overtime Settings'}</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{language === 'ar' ? 'معدل الإضافي' : 'Overtime Rate'}</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.overtime_rate}
              onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <Label>{language === 'ar' ? 'معدل الإجازات' : 'Holiday Rate'}</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.holiday_rate}
              onChange={(e) => setFormData({ ...formData, holiday_rate: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <Label>{language === 'ar' ? 'معدل الليلي' : 'Night Rate'}</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.night_rate}
              onChange={(e) => setFormData({ ...formData, night_rate: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>{language === 'ar' ? 'الإضافي يبدأ بعد' : 'Overtime Starts After'}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={formData.overtime_starts_after}
              onChange={(e) => setFormData({ ...formData, overtime_starts_after: parseInt(e.target.value) })}
              className="w-24"
            />
            <span className="text-sm text-slate-500">{language === 'ar' ? 'ساعات' : 'hours'}</span>
          </div>
        </div>
      </div>

      {/* Late Settings */}
      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 space-y-4">
        <h4 className="font-medium text-sm">{language === 'ar' ? 'إعدادات التأخير' : 'Late Settings'}</h4>
        <div>
          <Label>{language === 'ar' ? 'السماحية (دقائق)' : 'Grace Period (min)'}</Label>
          <Input
            type="number"
            value={formData.allow_late_minutes}
            onChange={(e) => setFormData({ ...formData, allow_late_minutes: parseInt(e.target.value) })}
          />
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Checkbox
            id="deduct_late"
            checked={formData.deduct_after_late}
            onCheckedChange={(checked) => setFormData({ ...formData, deduct_after_late: checked })}
          />
          <Label htmlFor="deduct_late" className="cursor-pointer">
            {language === 'ar' ? 'خصم بعد انتهاء السماحية' : 'Deduct after grace period'}
          </Label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="shifts-management-page">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-teal-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ClockIcon weight="fill" className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {language === 'ar' ? 'الورديات' : 'Work Shifts'}
              </h1>
              <p className="text-cyan-100 text-sm">
                {language === 'ar' 
                  ? 'إدارة ورديات العمل وساعات الدوام'
                  : 'Manage work shifts and schedules'
                }
              </p>
            </div>
          </div>
          <Button 
            className="bg-white text-cyan-700 hover:bg-cyan-50"
            onClick={() => { resetForm(); setShowAddModal(true); }}
          >
            <Plus className="w-4 h-4 me-2" />
            {language === 'ar' ? 'إضافة وردية' : 'Add Shift'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className={`border-0 shadow-sm ${card.bgColor}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${card.iconColor}`}></div>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                    <div className="flex items-baseline gap-1">
                      <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                      {card.suffix && <span className="text-sm text-slate-500">{card.suffix}</span>}
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${card.iconColor} flex items-center justify-center`}>
                    <Icon weight="fill" className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map(shift => {
          const typeConfig = getShiftTypeConfig(shift.type);
          const TypeIcon = typeConfig.icon;
          const colorClasses = {
            amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 text-amber-700' },
            orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-100 text-orange-700' },
            indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
            violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-400', badge: 'bg-violet-100 text-violet-700' },
            cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-400', badge: 'bg-cyan-100 text-cyan-700' }
          }[typeConfig.color];

          return (
            <Card key={shift.id} className={`border ${colorClasses.border} ${colorClasses.bg} shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colorClasses.badge} flex items-center justify-center`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">{language === 'ar' ? shift.name_ar : shift.name}</h3>
                      <Badge className={`${colorClasses.badge} text-xs mt-1`}>{typeConfig.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditModal(shift)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => { setSelectedShift(shift); setShowDeleteModal(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{language === 'ar' ? 'التوقيت' : 'Time'}</span>
                    <span className="font-medium">{shift.start_time} - {shift.end_time}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{language === 'ar' ? 'ساعات العمل' : 'Working Hours'}</span>
                    <span className="font-medium">{shift.working_hours} {language === 'ar' ? 'ساعة' : 'hrs'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{language === 'ar' ? 'الموظفين' : 'Employees'}</span>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{shift.employee_count || 0}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-2 border-t dark:border-slate-700">
                    {shift.working_days?.map(day => (
                      <span key={day} className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {weekDays.find(d => d.value === day)?.label}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClockIcon weight="fill" className="w-5 h-5 text-cyan-500" />
              {language === 'ar' ? 'إضافة وردية جديدة' : 'Add New Shift'}
            </DialogTitle>
          </DialogHeader>
          <ShiftFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={handleAddShift}>
              {language === 'ar' ? 'إضافة' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-500" />
              {language === 'ar' ? 'تعديل الوردية' : 'Edit Shift'}
            </DialogTitle>
          </DialogHeader>
          <ShiftFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={handleEditShift}>
              {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 dark:text-slate-400">
            {language === 'ar' 
              ? `هل أنت متأكد من حذف وردية "${selectedShift?.name_ar || selectedShift?.name}"؟`
              : `Are you sure you want to delete "${selectedShift?.name}" shift?`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDeleteShift}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftsManagementPage;
