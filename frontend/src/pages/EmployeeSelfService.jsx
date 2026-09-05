/**
 * Employee Self-Service Portal — بوابة الخدمة الذاتية للموظف
 * 
 * الموظف العادي يرى هذه الصفحة فقط عند الدخول
 * يشمل: بيانات شخصية، مستندات، راتب، بدلات، خصومات،
 *        تسجيل الحضور بالموقع الجغرافي، طلبات الإجازات
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// ── Icons (inline SVG to avoid dependency issues) ──────────────
const Icon = ({ d, size = 18, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d={d} />
  </svg>
);

const ICONS = {
  user:       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  doc:        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  salary:     "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  calendar:   "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  clock:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4l3 3",
  map:        "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4",
  check:      "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  bell:       "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  logout:     "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  upload:     "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  plus:       "M12 5v14M5 12h14",
  x:          "M18 6 6 18M6 6l12 12",
  refresh:    "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  eye:        "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  shield:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  phone:      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 17z",
  mail:       "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  home:       "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  bank:       "M3 10h18M3 14h18M3 18h18M3 6l9-3 9 3H3z",
};

const T = {
  tabs: { profile: 'ملفي الشخصي', salary: 'الراتب والبدلات', leaves: 'الإجازات', attendance: 'الحضور', docs: 'مستنداتي', requests: 'طلباتي' },
  profile: { title: 'بياناتي الشخصية', name: 'الاسم', nameEn: 'الاسم (إنجليزي)', nationalId: 'الرقم القومي', birth: 'تاريخ الميلاد', gender: 'النوع', marital: 'الحالة الاجتماعية', nationality: 'الجنسية', phone: 'الهاتف', mobile: 'الموبايل', email: 'البريد الإلكتروني', address: 'العنوان', emergency: 'جهة الاتصال الطارئ', emergencyPhone: 'هاتف الطوارئ', position: 'الوظيفة', department: 'القسم', hire: 'تاريخ التعيين', contract: 'نوع العقد', insurance: 'رقم التأمين الاجتماعي', bank: 'البنك', iban: 'IBAN' },
  salary: { basic: 'الراتب الأساسي', allowances: 'البدلات', deductions: 'الخصومات', net: 'الصافي', tax: 'ضريبة الدخل', insurance: 'تأمينات اجتماعية', history: 'سجل الرواتب', downloadSlip: 'تحميل قسيمة الراتب' },
  leaves: { annual: 'إجازة سنوية', casual: 'إجازة عارضة', sick: 'إجازة مرضية', balance: 'الرصيد المتاح', used: 'المستخدم', total: 'الإجمالي', requestLeave: 'طلب إجازة', from: 'من', to: 'إلى', reason: 'السبب', type: 'النوع', status: 'الحالة', days: 'الأيام' },
  attendance: { checkIn: 'تسجيل حضور', checkOut: 'تسجيل انصراف', location: 'الموقع الجغرافي', today: 'اليوم', history: 'سجل الحضور', inTime: 'وقت الدخول', outTime: 'وقت الخروج', duration: 'المدة', locating: 'جاري تحديد موقعك...', confirm: 'تأكيد الموقع وتسجيل الحضور', distance: 'المسافة من العمل' },
  docs: { title: 'مستنداتي', upload: 'رفع مستند', type: 'النوع', name: 'اسم الملف', expiry: 'تاريخ الانتهاء', status: 'الحالة' },
  requests: { title: 'طلباتي', pending: 'في الانتظار', approved: 'مقبول', rejected: 'مرفوض', new: 'طلب جديد', amount: 'المبلغ', installments: 'عدد الأقساط', hours: 'عدد الساعات', date: 'التاريخ' },
  status: { pending: 'في الانتظار', approved: 'مقبول', rejected: 'مرفوض', active: 'نشط' },
  btns: { save: 'حفظ التغييرات', cancel: 'إلغاء', submit: 'إرسال', close: 'إغلاق', edit: 'تعديل', logout: 'تسجيل خروج' },
  msg: { loading: 'جاري التحميل...', noData: 'لا توجد بيانات', success: 'تم بنجاح', error: 'حدث خطأ', saved: 'تم الحفظ بنجاح', notLinked: 'حسابك غير مرتبط بملف موظف — تواصل مع الـ HR', locationError: 'تعذر تحديد موقعك — تأكد من تفعيل GPS' }
};

// ── Status Badge ───────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    active: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  const labels = { pending: T.status.pending, approved: T.status.approved, rejected: T.status.rejected, active: T.status.active };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
};

// ── Toast ──────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => msg ? (
  <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl
    font-bold text-sm flex items-center gap-2 transition-all
    ${type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
    {type === 'error' ? '⚠️' : '✅'} {msg}
    <button onClick={onClose} className="mr-2 opacity-70 hover:opacity-100">✕</button>
  </div>
) : null;

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
const EmployeeSelfService = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [activeTab, setActiveTab] = useState('profile');
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({ annual: 21, casual: 6, sick: 15 });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);

  // Modal states
  const [leaveModal, setLeaveModal] = useState(false);
  const [loanModal, setLoanModal] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [loanForm, setLoanForm] = useState({ amount: '', installments: 3, reason: '' });

  // Attendance / GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkOutDone, setCheckOutDone] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 4000);
  };

  // ── Fetch employee data ──────────────────────────────────────
  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      // Try ESS endpoint first — returns own employee data
      const res = await axios.get(`${API}/api/ess/profile`, { headers: authHeaders() })
        .catch(() => axios.get(`${API}/api/hr/employees/me`, { headers: authHeaders() }));
      setEmployee(res.data?.employee || res.data);
    } catch {
      // Fallback: build from user data
      setEmployee({ name: user?.full_name || user?.name || '', ...user });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPayroll = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ess/payslip/list`, { headers: authHeaders() });
      setPayrollHistory(res.data?.payslips || []);
    } catch { setPayrollHistory([]); }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ess/requests/my-requests?request_type=leave`, { headers: authHeaders() });
      setLeaves(res.data?.requests || []);
      // Try balances
      const bal = await axios.get(`${API}/api/ess/leave/balances`, { headers: authHeaders() })
        .catch(() => null);
      if (bal?.data) setLeaveBalances(bal.data);
      else if (employee) {
        setLeaveBalances({
          annual: employee.annual_leave_balance ?? 21,
          casual: employee.casual_leave_balance ?? 6,
          sick:   employee.sick_leave_balance   ?? 15,
        });
      }
    } catch { }
  }, [employee]);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ess/attendance/my-records`, { headers: authHeaders() });
      setAttendanceRecords(res.data?.records || []);
      // Check if already checked in today
      const today = new Date().toISOString().slice(0, 10);
      const todayRec = (res.data?.records || []).find(r => r.date === today);
      if (todayRec?.check_in_time) setCheckInDone(true);
      if (todayRec?.check_out_time) setCheckOutDone(true);
    } catch { }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ess/requests/my-requests`, { headers: authHeaders() });
      setMyRequests(res.data?.requests || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  useEffect(() => {
    if (activeTab === 'salary')     fetchPayroll();
    if (activeTab === 'leaves')     fetchLeaves();
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'requests')   fetchRequests();
  }, [activeTab, fetchPayroll, fetchLeaves, fetchAttendance, fetchRequests]);

  // ── GPS helpers ──────────────────────────────────────────────
  const getGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS غير مدعوم في هذا المتصفح'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0
    });
  });

  const handleCheckIn = async () => {
    setGpsLoading(true); setGpsError('');
    try {
      const pos = await getGPS();
      setGpsCoords(pos.coords);
      await axios.post(`${API}/api/ess/attendance/check-in`, {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude
      }, { headers: authHeaders() });
      setCheckInDone(true);
      showToast('✅ تم تسجيل الحضور بنجاح');
      fetchAttendance();
    } catch (e) {
      setGpsError(e.message || T.msg.locationError);
      showToast(e.response?.data?.detail || T.msg.locationError, 'error');
    } finally { setGpsLoading(false); }
  };

  const handleCheckOut = async () => {
    setGpsLoading(true); setGpsError('');
    try {
      const pos = await getGPS();
      setGpsCoords(pos.coords);
      await axios.post(`${API}/api/ess/attendance/check-out`, {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude
      }, { headers: authHeaders() });
      setCheckOutDone(true);
      showToast('✅ تم تسجيل الانصراف بنجاح');
      fetchAttendance();
    } catch (e) {
      setGpsError(e.message || T.msg.locationError);
      showToast(e.response?.data?.detail || T.msg.locationError, 'error');
    } finally { setGpsLoading(false); }
  };

  // ── Submit leave ─────────────────────────────────────────────
  const submitLeave = async () => {
    try {
      await axios.post(`${API}/api/ess/requests/leave`, leaveForm, { headers: authHeaders() });
      showToast('✅ تم تقديم طلب الإجازة بنجاح');
      setLeaveModal(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      fetchLeaves();
      fetchRequests();
    } catch (e) {
      showToast(e.response?.data?.detail || 'حدث خطأ في إرسال الطلب', 'error');
    }
  };

  // ── Submit loan ──────────────────────────────────────────────
  const submitLoan = async () => {
    try {
      await axios.post(`${API}/api/ess/requests/loan`, loanForm, { headers: authHeaders() });
      showToast('✅ تم تقديم طلب السلفة بنجاح');
      setLoanModal(false);
      setLoanForm({ amount: '', installments: 3, reason: '' });
      fetchRequests();
    } catch (e) {
      showToast(e.response?.data?.detail || 'حدث خطأ في إرسال الطلب', 'error');
    }
  };

  // ── Upload photo ─────────────────────────────────────────────
  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const res = await axios.post(`${API}/api/hr/employees/${employee?.id}/photo`, fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      setEmployee(prev => ({ ...prev, photo_url: res.data?.photo_url }));
      showToast('✅ تم رفع الصورة بنجاح');
    } catch { showToast('تعذر رفع الصورة', 'error'); }
  };

  // ── Download payslip ─────────────────────────────────────────
  const downloadPayslip = async (runId) => {
    try {
      const res = await axios.get(`${API}/api/ess/payslip/${runId}`,
        { headers: authHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `payslip-${runId}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { showToast('تعذر تحميل قسيمة الراتب', 'error'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500 font-semibold">{T.msg.loading}</p>
      </div>
    </div>
  );

  if (!employee && !loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-gray-700 font-bold mb-2">{T.msg.notLinked}</p>
        <button onClick={logout} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl font-bold">
          تسجيل خروج
        </button>
      </div>
    </div>
  );

  const emp = employee || {};
  const totalAllowances = (emp.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const totalDeductions = (emp.deductions || []).reduce((s, d) => s + (d.amount || 0), 0);
  const netSalary = (emp.basic_salary || 0) + totalAllowances - totalDeductions;

  // ── TABS ──────────────────────────────────────────────────────
  const TABS = [
    { id: 'profile',    label: T.tabs.profile,    icon: ICONS.user },
    { id: 'salary',     label: T.tabs.salary,     icon: ICONS.salary },
    { id: 'leaves',     label: T.tabs.leaves,     icon: ICONS.calendar },
    { id: 'attendance', label: T.tabs.attendance, icon: ICONS.clock },
    { id: 'docs',       label: T.tabs.docs,       icon: ICONS.doc },
    { id: 'requests',   label: T.tabs.requests,   icon: ICONS.bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: '' })} />

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {emp.photo_url ? (
                <img src={emp.photo_url} alt={emp.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                  {(emp.name || 'م').charAt(0)}
                </div>
              )}
              <label className="absolute -bottom-1 -left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-400">
                <Icon d={ICONS.upload} size={10} color="#fff" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) { setPhotoFile(f); uploadPhoto(f); } }} />
              </label>
            </div>
            <div>
              <div className="font-bold text-base">{emp.name || user?.full_name}</div>
              <div className="text-xs text-blue-200">{emp.position || user?.role || 'موظف'} — {emp.department || emp.company_name || ''}</div>
              <div className="text-xs text-blue-300 mt-0.5">كود: {emp.employee_code || emp.id?.slice(-6) || '—'}</div>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all">
            <Icon d={ICONS.logout} size={14} />
            {T.btns.logout}
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-t-xl transition-all
                ${activeTab === tab.id
                  ? 'bg-white text-blue-800'
                  : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <Icon d={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ══ PROFILE TAB ════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Personal Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-50 border-b px-5 py-3 flex items-center gap-2">
                <Icon d={ICONS.user} size={16} color="#1b4fa0" />
                <span className="font-bold text-blue-900 text-sm">{T.profile.title}</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  [T.profile.name, emp.name], [T.profile.nameEn, emp.name_en],
                  [T.profile.nationalId, emp.national_id ? '••••' + emp.national_id.slice(-4) : '—'],
                  [T.profile.birth, emp.birth_date], [T.profile.gender, emp.gender === 'male' ? 'ذكر' : emp.gender === 'female' ? 'أنثى' : emp.gender],
                  [T.profile.marital, emp.marital_status], [T.profile.nationality, emp.nationality],
                  [T.profile.phone, emp.phone], [T.profile.mobile, emp.mobile],
                  [T.profile.email, emp.email], [T.profile.address, emp.address],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-400 font-semibold">{label}</span>
                    <span className="text-sm font-bold text-gray-800">{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Employment */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-green-50 border-b px-5 py-3 flex items-center gap-2">
                <Icon d={ICONS.home} size={16} color="#059669" />
                <span className="font-bold text-green-900 text-sm">البيانات الوظيفية</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  [T.profile.position, emp.position], [T.profile.department, emp.department],
                  [T.profile.hire, emp.hire_date], [T.profile.contract, emp.contract_type],
                  ['المدير المباشر', emp.manager_name], ['الفرع', emp.branch],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-400 font-semibold">{label}</span>
                    <span className="text-sm font-bold text-gray-800">{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Bank */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-amber-50 border-b px-5 py-3 flex items-center gap-2">
                <Icon d={ICONS.bank} size={16} color="#d97706" />
                <span className="font-bold text-amber-900 text-sm">البيانات البنكية</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  [T.profile.bank, emp.bank_name],
                  ['رقم الحساب', emp.bank_account_number ? '••••' + (emp.bank_account_number || '').slice(-4) : null],
                  [T.profile.iban, emp.iban ? emp.iban.slice(0, 4) + '••••' + emp.iban.slice(-4) : null],
                  [T.profile.insurance, emp.social_insurance_number],
                ].map(([label, val]) => val ? (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-400 font-semibold">{label}</span>
                    <span className="text-sm font-bold text-gray-800 font-mono">{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>
        )}

        {/* ══ SALARY TAB ═════════════════════════════════════════ */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            {/* Salary summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: T.salary.basic, value: emp.basic_salary || 0, color: 'blue' },
                { label: T.salary.allowances, value: totalAllowances, color: 'green' },
                { label: T.salary.deductions, value: totalDeductions, color: 'red' },
                { label: T.salary.net, value: netSalary, color: 'purple' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`bg-white rounded-2xl border shadow-sm p-4
                  border-${color}-100`}>
                  <div className={`text-xs font-bold text-${color}-600 mb-1`}>{label}</div>
                  <div className={`text-xl font-black text-${color}-700`}>
                    {value.toLocaleString('ar-EG')}
                    <span className="text-xs font-normal mr-1">ج.م</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Allowances */}
            {(emp.allowances || []).length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-green-50 border-b px-5 py-3">
                  <span className="font-bold text-green-900 text-sm">✅ {T.salary.allowances}</span>
                </div>
                <div className="divide-y">
                  {emp.allowances.map((a, i) => (
                    <div key={i} className="flex justify-between items-center px-5 py-3 text-sm">
                      <span className="text-gray-700 font-semibold">{a.type || a.name || 'بدل'}</span>
                      <span className="font-bold text-green-700">+{(a.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deductions */}
            {(emp.deductions || []).length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="bg-red-50 border-b px-5 py-3">
                  <span className="font-bold text-red-900 text-sm">➖ {T.salary.deductions}</span>
                </div>
                <div className="divide-y">
                  {emp.deductions.map((d, i) => (
                    <div key={i} className="flex justify-between items-center px-5 py-3 text-sm">
                      <span className="text-gray-700 font-semibold">{d.type || d.name || 'خصم'}</span>
                      <span className="font-bold text-red-700">-{(d.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payslip history */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-blue-50 border-b px-5 py-3">
                <span className="font-bold text-blue-900 text-sm">📋 {T.salary.history}</span>
              </div>
              {payrollHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">{T.msg.noData}</div>
              ) : (
                <div className="divide-y">
                  {payrollHistory.map((slip, i) => (
                    <div key={i} className="flex justify-between items-center px-5 py-3">
                      <div>
                        <div className="text-sm font-bold text-gray-800">{slip.period_month || slip.period || `مسير ${i + 1}`}</div>
                        <div className="text-xs text-gray-400">{slip.payment_date || slip.created_at?.slice(0, 10)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-blue-700">{(slip.net_salary || 0).toLocaleString('ar-EG')} ج.م</span>
                        <button onClick={() => downloadPayslip(slip.run_id || slip.id)}
                          className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                          <Icon d={ICONS.download} size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ LEAVES TAB ═════════════════════════════════════════ */}
        {activeTab === 'leaves' && (
          <div className="space-y-4">
            {/* Balances */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: T.leaves.annual, balance: leaveBalances.annual, color: 'blue', icon: '🌴' },
                { label: T.leaves.casual, balance: leaveBalances.casual, color: 'amber', icon: '☀️' },
                { label: T.leaves.sick,   balance: leaveBalances.sick,   color: 'green', icon: '🏥' },
              ].map(({ label, balance, color, icon }) => (
                <div key={label} className="bg-white rounded-2xl border shadow-sm p-4 text-center">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-xs text-gray-500 font-semibold mb-1">{label}</div>
                  <div className={`text-3xl font-black text-${color}-600`}>{balance}</div>
                  <div className="text-xs text-gray-400">يوم متاح</div>
                </div>
              ))}
            </div>

            {/* Request leave button */}
            <button onClick={() => setLeaveModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow transition-all">
              <Icon d={ICONS.plus} size={16} /> {T.leaves.requestLeave}
            </button>

            {/* Leave history */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-blue-50 border-b px-5 py-3">
                <span className="font-bold text-blue-900 text-sm">سجل الإجازات</span>
              </div>
              {leaves.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">{T.msg.noData}</div>
              ) : (
                <div className="divide-y">
                  {leaves.map((lv, i) => (
                    <div key={i} className="px-5 py-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          {lv.leave_type === 'annual' ? '🌴 سنوية' : lv.leave_type === 'casual' ? '☀️ عارضة' : '🏥 مرضية'}
                          {' — '}{lv.days} {T.leaves.days}
                        </div>
                        <div className="text-xs text-gray-400">{lv.start_date} → {lv.end_date}</div>
                        {lv.reason && <div className="text-xs text-gray-500 mt-0.5">{lv.reason}</div>}
                      </div>
                      <StatusBadge status={lv.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ATTENDANCE TAB ══════════════════════════════════════ */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* GPS Check-in/out */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-blue-50 border-b px-5 py-3 flex items-center gap-2">
                <Icon d={ICONS.map} size={16} color="#1b4fa0" />
                <span className="font-bold text-blue-900 text-sm">تسجيل الحضور اليوم</span>
              </div>
              <div className="p-5 space-y-3">
                {gpsCoords && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 font-semibold flex items-center gap-2">
                    <Icon d={ICONS.check} size={14} color="#059669" />
                    الموقع: {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                    {' — دقة: '}{gpsCoords.accuracy?.toFixed(0)}م
                  </div>
                )}
                {gpsError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700 font-semibold">
                    ⚠️ {gpsError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleCheckIn} disabled={checkInDone || gpsLoading}
                    className={`py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                      ${checkInDone
                        ? 'bg-green-100 text-green-600 cursor-default border border-green-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow active:scale-95'}`}>
                    {gpsLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      : <Icon d={ICONS.map} size={16} />}
                    {checkInDone ? '✅ تم الحضور' : T.attendance.checkIn}
                  </button>
                  <button onClick={handleCheckOut} disabled={!checkInDone || checkOutDone || gpsLoading}
                    className={`py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                      ${checkOutDone
                        ? 'bg-green-100 text-green-600 cursor-default border border-green-200'
                        : !checkInDone
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow active:scale-95'}`}>
                    {checkOutDone ? '✅ تم الانصراف' : T.attendance.checkOut}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  سيتم تسجيل موقعك الجغرافي عند الضغط — تأكد من تفعيل GPS
                </p>
              </div>
            </div>

            {/* Attendance records */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b px-5 py-3">
                <span className="font-bold text-gray-700 text-sm">📅 {T.attendance.history}</span>
              </div>
              {attendanceRecords.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">{T.msg.noData}</div>
              ) : (
                <div className="divide-y">
                  {attendanceRecords.slice(0, 14).map((rec, i) => (
                    <div key={i} className="px-5 py-3 flex justify-between items-center text-sm">
                      <div className="text-gray-700 font-semibold">{rec.date}</div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-600 font-bold">دخول: {rec.check_in_time?.slice(11, 16) || '—'}</span>
                        <span className="text-orange-500 font-bold">خروج: {rec.check_out_time?.slice(11, 16) || '—'}</span>
                        {rec.duration_hours && <span className="text-blue-600 font-bold">{rec.duration_hours}h</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ DOCS TAB ════════════════════════════════════════════ */}
        {activeTab === 'docs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-purple-50 border-b px-5 py-3 flex items-center justify-between">
                <span className="font-bold text-purple-900 text-sm">📎 {T.docs.title}</span>
                <button onClick={() => setDocModal(true)}
                  className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Icon d={ICONS.upload} size={12} /> {T.docs.upload}
                </button>
              </div>
              {(emp.documents || []).length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-gray-400 text-sm">لا توجد مستندات مرفوعة بعد</p>
                  <button onClick={() => setDocModal(true)}
                    className="mt-3 px-5 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl">
                    رفع أول مستند
                  </button>
                </div>
              ) : (
                <div className="divide-y">
                  {emp.documents.map((doc, i) => (
                    <div key={i} className="px-5 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                          <Icon d={ICONS.doc} size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{doc.name || doc.document_type}</div>
                          <div className="text-xs text-gray-400">
                            {doc.expiry_date ? `ينتهي: ${doc.expiry_date}` : 'بدون انتهاء'}
                          </div>
                        </div>
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer"
                          className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600">
                          <Icon d={ICONS.eye} size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ REQUESTS TAB ════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLeaveModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-2 shadow transition-all active:scale-95">
                <Icon d={ICONS.calendar} size={22} />
                <span className="text-sm">طلب إجازة</span>
              </button>
              <button onClick={() => setLoanModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl flex flex-col items-center gap-2 shadow transition-all active:scale-95">
                <Icon d={ICONS.salary} size={22} />
                <span className="text-sm">طلب سلفة</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b px-5 py-3">
                <span className="font-bold text-gray-700 text-sm">📋 جميع طلباتي</span>
              </div>
              {myRequests.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">لا توجد طلبات بعد</div>
              ) : (
                <div className="divide-y">
                  {myRequests.map((req, i) => (
                    <div key={i} className="px-5 py-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          {req.request_type === 'leave' ? '🌴 إجازة'
                            : req.request_type === 'loan' ? '💰 سلفة'
                              : req.request_type === 'overtime' ? '⏱️ وقت إضافي' : req.request_type}
                        </div>
                        <div className="text-xs text-gray-400">
                          {req.request_type === 'leave' && `${req.days} يوم — ${req.start_date}`}
                          {req.request_type === 'loan' && `${(req.amount || 0).toLocaleString('ar-EG')} ج.م`}
                          {req.request_type === 'overtime' && `${req.hours} ساعة`}
                        </div>
                        <div className="text-xs text-gray-400">{req.created_at?.slice(0, 10)}</div>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ LEAVE MODAL ═════════════════════════════════════════ */}
      {leaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold">🌴 طلب إجازة</span>
              <button onClick={() => setLeaveModal(false)}><Icon d={ICONS.x} size={18} color="#fff" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">نوع الإجازة</label>
                <select value={leaveForm.leave_type}
                  onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                  <option value="annual">🌴 سنوية ({leaveBalances.annual} يوم متاح)</option>
                  <option value="casual">☀️ عارضة ({leaveBalances.casual} يوم متاح)</option>
                  <option value="sick">🏥 مرضية ({leaveBalances.sick} يوم متاح)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">من</label>
                  <input type="date" value={leaveForm.start_date}
                    onChange={e => setLeaveForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">إلى</label>
                  <input type="date" value={leaveForm.end_date}
                    onChange={e => setLeaveForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">السبب</label>
                <textarea value={leaveForm.reason}
                  onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                  rows={3} placeholder="سبب الإجازة..."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setLeaveModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">{T.btns.cancel}</button>
                <button onClick={submitLeave}
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-sm">{T.btns.submit}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOAN MODAL ══════════════════════════════════════════ */}
      {loanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-amber-500 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold">💰 طلب سلفة</span>
              <button onClick={() => setLoanModal(false)}><Icon d={ICONS.x} size={18} color="#fff" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">المبلغ (ج.م)</label>
                <input type="number" value={loanForm.amount} min="100"
                  onChange={e => setLoanForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="أدخل المبلغ المطلوب"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">عدد أقساط السداد</label>
                <select value={loanForm.installments}
                  onChange={e => setLoanForm(p => ({ ...p, installments: parseInt(e.target.value) }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'قسط' : 'أقساط'}</option>
                  ))}
                </select>
              </div>
              {loanForm.amount && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-semibold">
                  القسط الشهري التقريبي: {(parseFloat(loanForm.amount || 0) / loanForm.installments).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">السبب</label>
                <textarea value={loanForm.reason}
                  onChange={e => setLoanForm(p => ({ ...p, reason: e.target.value }))}
                  rows={2} placeholder="سبب طلب السلفة..."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setLoanModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">{T.btns.cancel}</button>
                <button onClick={submitLoan}
                  className="flex-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-xl text-sm">{T.btns.submit}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSelfService;
