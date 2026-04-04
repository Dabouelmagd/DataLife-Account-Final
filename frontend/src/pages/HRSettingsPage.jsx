import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, Clock, Calendar, DollarSign, Users, Save,
  AlertCircle, CheckCircle, RefreshCw, Percent, Timer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api/payroll';
const getToken = () => localStorage.getItem('token');

export default function HRSettingsPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  const text = {
    ar: {
      title: 'إعدادات الموارد البشرية',
      subtitle: 'تحكم في قواعد حساب التأخير والغياب والعمل الإضافي لشركتك',
      
      lateSection: 'إعدادات التأخير',
      lateDesc: 'ضبط قواعد خصم التأخير',
      enableLateDeduction: 'تفعيل خصم التأخير',
      lateMethod: 'طريقة حساب الخصم',
      perMinute: 'خصم لكل دقيقة',
      perHour: 'خصم بالساعة فقط',
      brackets: 'شرائح التأخير',
      none: 'بدون خصم',
      gracePeriod: 'فترة السماح (دقيقة)',
      gracePeriodDesc: 'التأخير المسموح بدون خصم',
      perMinuteRate: 'معدل خصم الدقيقة',
      perMinuteRateDesc: 'مضاعف معدل الدقيقة من الراتب',
      perHourRate: 'معدل خصم الساعة',
      maxLateBeforeAbsence: 'أقصى تأخير قبل الغياب (دقيقة)',
      
      absenceSection: 'إعدادات الغياب',
      absenceDesc: 'ضبط قواعد خصم الغياب',
      enableAbsenceDeduction: 'تفعيل خصم الغياب',
      absenceMethod: 'طريقة حساب الخصم',
      fullDay: 'خصم يوم كامل',
      dayPlusPenalty: 'يوم + جزاء',
      absenceDays: 'عدد الأيام المخصومة',
      absencePenalty: 'نسبة الجزاء الإضافي (%)',
      excusedDeduction: 'خصم الغياب المعذور',
      
      overtimeSection: 'إعدادات العمل الإضافي',
      overtimeDesc: 'ضبط قواعد مكافأة الأوفرتايم',
      enableOvertime: 'تفعيل مكافأة الأوفرتايم',
      overtimeMethod: 'طريقة الحساب',
      hourly: 'بالساعة',
      daily: 'بالمعدل اليومي',
      overtimeRate: 'معدل الأوفرتايم العادي',
      overtimeRateDesc: 'مضاعف أجر الساعة (مثال: 1.5 = ساعة ونصف)',
      holidayRate: 'معدل أوفرتايم العطلات',
      nightRate: 'معدل الأوفرتايم الليلي',
      maxMonthlyOvertime: 'الحد الأقصى الشهري (ساعة)',
      requiresApproval: 'يتطلب موافقة مسبقة',
      
      generalSection: 'الإعدادات العامة',
      generalDesc: 'إعدادات ساعات العمل والأيام',
      workingHoursPerDay: 'ساعات العمل اليومية',
      workingDaysPerMonth: 'أيام العمل الشهرية',
      weekendDays: 'أيام العطلة الأسبوعية',
      
      save: 'حفظ الإعدادات',
      saving: 'جاري الحفظ...',
      saved: 'تم حفظ الإعدادات بنجاح',
      error: 'حدث خطأ',
      
      friday: 'الجمعة',
      saturday: 'السبت',
      sunday: 'الأحد',
      monday: 'الاثنين',
      tuesday: 'الثلاثاء',
      wednesday: 'الأربعاء',
      thursday: 'الخميس'
    },
    en: {
      title: 'HR Settings',
      subtitle: 'Configure late, absence, and overtime calculation rules for your company',
      
      lateSection: 'Late Deduction Settings',
      lateDesc: 'Configure late deduction rules',
      enableLateDeduction: 'Enable Late Deduction',
      lateMethod: 'Calculation Method',
      perMinute: 'Per Minute',
      perHour: 'Per Hour Only',
      brackets: 'Brackets',
      none: 'No Deduction',
      gracePeriod: 'Grace Period (minutes)',
      gracePeriodDesc: 'Allowed late without deduction',
      perMinuteRate: 'Per Minute Rate',
      perMinuteRateDesc: 'Multiplier of minute rate from salary',
      perHourRate: 'Per Hour Rate',
      maxLateBeforeAbsence: 'Max Late Before Absence (minutes)',
      
      absenceSection: 'Absence Deduction Settings',
      absenceDesc: 'Configure absence deduction rules',
      enableAbsenceDeduction: 'Enable Absence Deduction',
      absenceMethod: 'Calculation Method',
      fullDay: 'Full Day Deduction',
      dayPlusPenalty: 'Day + Penalty',
      absenceDays: 'Days Deducted',
      absencePenalty: 'Additional Penalty (%)',
      excusedDeduction: 'Deduct Excused Absence',
      
      overtimeSection: 'Overtime Settings',
      overtimeDesc: 'Configure overtime bonus rules',
      enableOvertime: 'Enable Overtime Bonus',
      overtimeMethod: 'Calculation Method',
      hourly: 'Hourly',
      daily: 'Daily Rate',
      overtimeRate: 'Regular Overtime Rate',
      overtimeRateDesc: 'Hour rate multiplier (e.g., 1.5 = time and a half)',
      holidayRate: 'Holiday Overtime Rate',
      nightRate: 'Night Overtime Rate',
      maxMonthlyOvertime: 'Max Monthly Overtime (hours)',
      requiresApproval: 'Requires Pre-approval',
      
      generalSection: 'General Settings',
      generalDesc: 'Working hours and days settings',
      workingHoursPerDay: 'Working Hours per Day',
      workingDaysPerMonth: 'Working Days per Month',
      weekendDays: 'Weekend Days',
      
      save: 'Save Settings',
      saving: 'Saving...',
      saved: 'Settings saved successfully',
      error: 'An error occurred',
      
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday'
    }
  }[language];

  const weekDays = [
    { id: 'sunday', label: text.sunday },
    { id: 'monday', label: text.monday },
    { id: 'tuesday', label: text.tuesday },
    { id: 'wednesday', label: text.wednesday },
    { id: 'thursday', label: text.thursday },
    { id: 'friday', label: text.friday },
    { id: 'saturday', label: text.saturday }
  ];

  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/hr-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();
      const response = await fetch(`${API}/hr-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast.success(text.saved);
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(text.error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleWeekendDay = (day) => {
    const currentDays = settings?.weekend_days || [];
    if (currentDays.includes(day)) {
      updateSetting('weekend_days', currentDays.filter(d => d !== day));
    } else {
      updateSetting('weekend_days', [...currentDays, day]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="hr-settings-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-[#28376B]" />
            {text.title}
          </h1>
          <p className="text-gray-500 mt-1">{text.subtitle}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} data-testid="save-hr-settings-btn">
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? text.saving : text.save}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Late Deduction Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Clock className="w-5 h-5" />
              {text.lateSection}
            </CardTitle>
            <CardDescription>{text.lateDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-medium">{text.enableLateDeduction}</label>
              <input 
                type="checkbox" 
                checked={settings?.late_deduction_enabled ?? true}
                onChange={e => updateSetting('late_deduction_enabled', e.target.checked)}
                className="w-5 h-5 accent-[#28376B]"
              />
            </div>
            
            {settings?.late_deduction_enabled !== false && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{text.lateMethod}</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={settings?.late_deduction_method || 'per_minute'}
                    onChange={e => updateSetting('late_deduction_method', e.target.value)}
                  >
                    <option value="per_minute">{text.perMinute}</option>
                    <option value="per_hour">{text.perHour}</option>
                    <option value="brackets">{text.brackets}</option>
                    <option value="none">{text.none}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.gracePeriod}</label>
                  <p className="text-xs text-gray-500 mb-1">{text.gracePeriodDesc}</p>
                  <Input 
                    type="number" 
                    value={settings?.grace_period_minutes ?? 15}
                    onChange={e => updateSetting('grace_period_minutes', parseInt(e.target.value))}
                  />
                </div>
                
                {settings?.late_deduction_method === 'per_minute' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.perMinuteRate}</label>
                    <p className="text-xs text-gray-500 mb-1">{text.perMinuteRateDesc}</p>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={settings?.late_deduction_per_minute_rate ?? 1.0}
                      onChange={e => updateSetting('late_deduction_per_minute_rate', parseFloat(e.target.value))}
                    />
                  </div>
                )}
                
                {settings?.late_deduction_method === 'per_hour' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.perHourRate}</label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={settings?.late_deduction_per_hour_rate ?? 1.0}
                      onChange={e => updateSetting('late_deduction_per_hour_rate', parseFloat(e.target.value))}
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.maxLateBeforeAbsence}</label>
                  <Input 
                    type="number" 
                    value={settings?.max_late_minutes_before_absence ?? 120}
                    onChange={e => updateSetting('max_late_minutes_before_absence', parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Absence Deduction Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              {text.absenceSection}
            </CardTitle>
            <CardDescription>{text.absenceDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-medium">{text.enableAbsenceDeduction}</label>
              <input 
                type="checkbox" 
                checked={settings?.absence_deduction_enabled ?? true}
                onChange={e => updateSetting('absence_deduction_enabled', e.target.checked)}
                className="w-5 h-5 accent-[#28376B]"
              />
            </div>
            
            {settings?.absence_deduction_enabled !== false && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{text.absenceMethod}</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={settings?.absence_deduction_method || 'full_day'}
                    onChange={e => updateSetting('absence_deduction_method', e.target.value)}
                  >
                    <option value="full_day">{text.fullDay}</option>
                    <option value="day_plus_penalty">{text.dayPlusPenalty}</option>
                    <option value="none">{text.none}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.absenceDays}</label>
                  <Input 
                    type="number" 
                    step="0.5"
                    value={settings?.absence_deduction_days ?? 1.0}
                    onChange={e => updateSetting('absence_deduction_days', parseFloat(e.target.value))}
                  />
                </div>
                
                {settings?.absence_deduction_method === 'day_plus_penalty' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.absencePenalty}</label>
                    <Input 
                      type="number" 
                      value={settings?.absence_penalty_percentage ?? 0}
                      onChange={e => updateSetting('absence_penalty_percentage', parseFloat(e.target.value))}
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <label className="font-medium">{text.excusedDeduction}</label>
                  <input 
                    type="checkbox" 
                    checked={settings?.excused_absence_deduction ?? false}
                    onChange={e => updateSetting('excused_absence_deduction', e.target.checked)}
                    className="w-5 h-5 accent-[#28376B]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Overtime Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Timer className="w-5 h-5" />
              {text.overtimeSection}
            </CardTitle>
            <CardDescription>{text.overtimeDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-medium">{text.enableOvertime}</label>
              <input 
                type="checkbox" 
                checked={settings?.overtime_enabled ?? true}
                onChange={e => updateSetting('overtime_enabled', e.target.checked)}
                className="w-5 h-5 accent-[#28376B]"
              />
            </div>
            
            {settings?.overtime_enabled !== false && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{text.overtimeMethod}</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={settings?.overtime_calculation_method || 'hourly'}
                    onChange={e => updateSetting('overtime_calculation_method', e.target.value)}
                  >
                    <option value="hourly">{text.hourly}</option>
                    <option value="daily">{text.daily}</option>
                    <option value="none">{text.none}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.overtimeRate}</label>
                  <p className="text-xs text-gray-500 mb-1">{text.overtimeRateDesc}</p>
                  <Input 
                    type="number" 
                    step="0.25"
                    value={settings?.overtime_rate ?? 1.5}
                    onChange={e => updateSetting('overtime_rate', parseFloat(e.target.value))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.holidayRate}</label>
                  <Input 
                    type="number" 
                    step="0.25"
                    value={settings?.overtime_holiday_rate ?? 2.0}
                    onChange={e => updateSetting('overtime_holiday_rate', parseFloat(e.target.value))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.nightRate}</label>
                  <Input 
                    type="number" 
                    step="0.25"
                    value={settings?.overtime_night_rate ?? 1.25}
                    onChange={e => updateSetting('overtime_night_rate', parseFloat(e.target.value))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">{text.maxMonthlyOvertime}</label>
                  <Input 
                    type="number" 
                    value={settings?.max_monthly_overtime_hours ?? 60}
                    onChange={e => updateSetting('max_monthly_overtime_hours', parseFloat(e.target.value))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="font-medium">{text.requiresApproval}</label>
                  <input 
                    type="checkbox" 
                    checked={settings?.overtime_requires_approval ?? false}
                    onChange={e => updateSetting('overtime_requires_approval', e.target.checked)}
                    className="w-5 h-5 accent-[#28376B]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#28376B]">
              <Calendar className="w-5 h-5" />
              {text.generalSection}
            </CardTitle>
            <CardDescription>{text.generalDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{text.workingHoursPerDay}</label>
              <Input 
                type="number" 
                step="0.5"
                value={settings?.standard_working_hours_per_day ?? 8}
                onChange={e => updateSetting('standard_working_hours_per_day', parseFloat(e.target.value))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">{text.workingDaysPerMonth}</label>
              <Input 
                type="number" 
                value={settings?.standard_working_days_per_month ?? 22}
                onChange={e => updateSetting('standard_working_days_per_month', parseInt(e.target.value))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">{text.weekendDays}</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map(day => (
                  <button
                    key={day.id}
                    onClick={() => toggleWeekendDay(day.id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      (settings?.weekend_days || []).includes(day.id)
                        ? 'bg-[#28376B] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
