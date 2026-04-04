import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Edit, Trash2, Save, X, Calendar,
  Sun, Moon, Sunset, Users
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ShiftsPage = ({ language = 'ar' }) => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  const isRTL = language === 'ar';

  const t = {
    ar: {
      title: 'إدارة الورديات',
      add_shift: 'إضافة وردية',
      shift_name: 'اسم الوردية',
      shift_type: 'نوع الوردية',
      morning: 'صباحية',
      evening: 'مسائية',
      night: 'ليلية',
      split: 'منقسمة',
      flexible: 'مرنة',
      start_time: 'وقت البداية',
      end_time: 'وقت النهاية',
      break_start: 'بداية الاستراحة',
      break_end: 'نهاية الاستراحة',
      break_duration: 'مدة الاستراحة (دقيقة)',
      working_hours: 'ساعات العمل',
      overtime_after: 'الإضافي يبدأ بعد',
      working_days: 'أيام العمل',
      overtime_rate: 'معدل الإضافي',
      holiday_rate: 'معدل العطلات',
      night_rate: 'معدل الليل',
      allow_late: 'السماح بالتأخير (دقيقة)',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      employees: 'موظفين',
      no_shifts: 'لا توجد ورديات',
      days: {
        sunday: 'الأحد',
        monday: 'الإثنين',
        tuesday: 'الثلاثاء',
        wednesday: 'الأربعاء',
        thursday: 'الخميس',
        friday: 'الجمعة',
        saturday: 'السبت'
      }
    },
    en: {
      title: 'Shift Management',
      add_shift: 'Add Shift',
      shift_name: 'Shift Name',
      shift_type: 'Shift Type',
      morning: 'Morning',
      evening: 'Evening',
      night: 'Night',
      split: 'Split',
      flexible: 'Flexible',
      start_time: 'Start Time',
      end_time: 'End Time',
      break_start: 'Break Start',
      break_end: 'Break End',
      break_duration: 'Break Duration (min)',
      working_hours: 'Working Hours',
      overtime_after: 'Overtime After',
      working_days: 'Working Days',
      overtime_rate: 'Overtime Rate',
      holiday_rate: 'Holiday Rate',
      night_rate: 'Night Rate',
      allow_late: 'Allow Late (min)',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      employees: 'employees',
      no_shifts: 'No shifts',
      days: {
        sunday: 'Sunday',
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday'
      }
    }
  }[language];

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/employees/shifts/list`, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setShifts(data.shifts || []);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleSave = async (shiftData) => {
    try {
      const url = editingShift 
        ? `${API_URL}/api/employees/shifts/${editingShift.id}`
        : `${API_URL}/api/employees/shifts/create`;
      
      const response = await fetch(url, {
        method: editingShift ? 'PUT' : 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(shiftData)
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حفظ الوردية بنجاح' : 'Shift saved successfully');
        setShowModal(false);
        setEditingShift(null);
        fetchShifts();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حفظ الوردية' : 'Error saving shift');
    }
  };

  const handleDelete = async (shiftId) => {
    if (!window.confirm(language === 'ar' ? 'هل تريد حذف هذه الوردية؟' : 'Delete this shift?')) return;

    try {
      const response = await fetch(`${API_URL}/api/employees/shifts/${shiftId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم حذف الوردية' : 'Shift deleted');
        fetchShifts();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'خطأ في حذف الوردية' : 'Error deleting shift');
    }
  };

  const getShiftIcon = (type) => {
    switch (type) {
      case 'morning': return <Sun className="h-5 w-5 text-yellow-500" />;
      case 'evening': return <Sunset className="h-5 w-5 text-orange-500" />;
      case 'night': return <Moon className="h-5 w-5 text-blue-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getShiftColor = (type) => {
    switch (type) {
      case 'morning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'evening': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
      case 'night': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default: return 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="h-6 w-6" />
          {t.title}
        </h1>
        <button
          onClick={() => { setEditingShift(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          data-testid="add-shift-btn"
        >
          <Plus className="h-4 w-4" />
          {t.add_shift}
        </button>
      </div>

      {/* Shifts Grid */}
      {shifts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>{t.no_shifts}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className={`border rounded-xl p-5 ${getShiftColor(shift.shift_type)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getShiftIcon(shift.shift_type)}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{shift.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t[shift.shift_type] || shift.shift_type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingShift(shift); setShowModal(true); }}
                    className="p-1 text-gray-500 hover:text-blue-500"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(shift.id)}
                    className="p-1 text-gray-500 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t.start_time}</span>
                  <span className="font-medium">{shift.start_time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t.end_time}</span>
                  <span className="font-medium">{shift.end_time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t.working_hours}</span>
                  <span className="font-medium">{shift.working_hours} h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t.break_duration}</span>
                  <span className="font-medium">{shift.break_duration} min</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t.working_days}</p>
                <div className="flex flex-wrap gap-1">
                  {(shift.working_days || []).map((day) => (
                    <span
                      key={day}
                      className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-xs"
                    >
                      {t.days[day] || day}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded">
                  {t.overtime_rate}: {shift.overtime_rate}x
                </span>
                <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded">
                  {t.holiday_rate}: {shift.holiday_rate}x
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shift Modal */}
      {showModal && (
        <ShiftModal
          shift={editingShift}
          onClose={() => { setShowModal(false); setEditingShift(null); }}
          onSave={handleSave}
          t={t}
          language={language}
        />
      )}
    </div>
  );
};

// Shift Modal Component
const ShiftModal = ({ shift, onClose, onSave, t, language }) => {
  const [data, setData] = useState(shift || {
    name: '',
    name_en: '',
    shift_type: 'morning',
    start_time: '08:00',
    end_time: '16:00',
    break_start: '12:00',
    break_end: '13:00',
    break_duration: 60,
    working_hours: 8,
    overtime_starts_after: 8,
    working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    overtime_rate: 1.5,
    holiday_rate: 2.0,
    night_rate: 1.25,
    allow_late_minutes: 15
  });

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const shiftTypes = ['morning', 'evening', 'night', 'split', 'flexible'];

  const toggleDay = (day) => {
    const newDays = data.working_days.includes(day)
      ? data.working_days.filter(d => d !== day)
      : [...data.working_days, day];
    setData({ ...data, working_days: newDays });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {shift ? (language === 'ar' ? 'تعديل الوردية' : 'Edit Shift') : t.add_shift}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Shift Name */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.shift_name}</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({...data, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder={language === 'ar' ? 'مثال: الوردية الصباحية' : 'e.g. Morning Shift'}
            />
          </div>

          {/* Shift Type */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.shift_type}</label>
            <select
              value={data.shift_type}
              onChange={(e) => setData({...data, shift_type: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {shiftTypes.map(type => (
                <option key={type} value={type}>{t[type]}</option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.start_time}</label>
            <input
              type="time"
              value={data.start_time}
              onChange={(e) => setData({...data, start_time: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.end_time}</label>
            <input
              type="time"
              value={data.end_time}
              onChange={(e) => setData({...data, end_time: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Break Start */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.break_start}</label>
            <input
              type="time"
              value={data.break_start || ''}
              onChange={(e) => setData({...data, break_start: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Break End */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.break_end}</label>
            <input
              type="time"
              value={data.break_end || ''}
              onChange={(e) => setData({...data, break_end: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Working Hours */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.working_hours}</label>
            <input
              type="number"
              step="0.5"
              value={data.working_hours}
              onChange={(e) => setData({...data, working_hours: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Overtime After */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.overtime_after}</label>
            <input
              type="number"
              step="0.5"
              value={data.overtime_starts_after}
              onChange={(e) => setData({...data, overtime_starts_after: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Overtime Rate */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.overtime_rate}</label>
            <input
              type="number"
              step="0.25"
              value={data.overtime_rate}
              onChange={(e) => setData({...data, overtime_rate: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Holiday Rate */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.holiday_rate}</label>
            <input
              type="number"
              step="0.25"
              value={data.holiday_rate}
              onChange={(e) => setData({...data, holiday_rate: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Night Rate */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.night_rate}</label>
            <input
              type="number"
              step="0.25"
              value={data.night_rate}
              onChange={(e) => setData({...data, night_rate: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Allow Late */}
          <div>
            <label className="block text-sm font-medium mb-1">{t.allow_late}</label>
            <input
              type="number"
              value={data.allow_late_minutes}
              onChange={(e) => setData({...data, allow_late_minutes: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Working Days */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">{t.working_days}</label>
          <div className="flex flex-wrap gap-2">
            {days.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  data.working_days.includes(day)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {t.days[day]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => onSave(data)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftsPage;
