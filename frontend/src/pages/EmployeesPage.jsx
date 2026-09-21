/**
 * EmployeesPage — صفحة الموظفين المستقلة
 * قائمة كاملة مع بحث وفلترة وتعديل الدور والحذف وإعادة التفعيل.
 * منفصلة عن "نظرة عامة" التي تعرض الإحصائيات.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Users, Search, RefreshCw, Trash2, UserCheck, UserX,
  Mail, Loader2, AlertTriangle, Shield, X
} from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');

const MANAGER_ROLES = [
  'Super Admin', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي',
  'Board Chairman', 'رئيس مجلس الإدارة', 'SUPER_ADMIN', 'TOP_MANAGEMENT'
];

export default function EmployeesPage({ language: propLanguage, currentUser }) {
  const ctx = useLanguage?.() || {};
  const language = propLanguage || ctx.language || 'ar';
  const ar = language === 'ar';

  const token = localStorage.getItem('token');
  const me = useMemo(() => {
    if (currentUser) return currentUser;
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, [currentUser]);

  const canManage = MANAGER_ROLES.includes(me?.role);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [query, setQuery]         = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast]         = useState(null);

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/users/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(ar ? 'تعذر تحميل قائمة الموظفين' : 'Could not load employees');
    } finally {
      setLoading(false);
    }
  }, [token, ar]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const roles = useMemo(
    () => [...new Set(employees.map(e => e.role).filter(Boolean))],
    [employees]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(e => {
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      if (statusFilter === 'active'   && !e.is_active) return false;
      if (statusFilter === 'inactive' &&  e.is_active) return false;
      if (!q) return true;
      return (e.full_name || '').toLowerCase().includes(q)
          || (e.email || '').toLowerCase().includes(q)
          || (e.role || '').toLowerCase().includes(q);
    });
  }, [employees, query, roleFilter, statusFilter]);

  const handleDelete = async (emp) => {
    setBusyId(emp.id);
    try {
      await axios.delete(`${API_URL}/api/users/${emp.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify(ar ? 'تم تعطيل الموظف' : 'Employee deactivated');
      setConfirmDelete(null);
      fetchEmployees();
    } catch {
      notify(ar ? 'تعذر تنفيذ العملية' : 'Operation failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (emp) => {
    setBusyId(emp.id);
    try {
      await axios.post(`${API_URL}/api/users/${emp.id}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify(ar ? 'تم إعادة تفعيل الموظف' : 'Employee reactivated');
      fetchEmployees();
    } catch {
      notify(ar ? 'تعذر إعادة التفعيل' : 'Reactivation failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleResendInvite = async (emp) => {
    setBusyId(emp.id);
    try {
      await axios.post(`${API_URL}/api/users/${emp.id}/resend-invite`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notify(ar ? 'تم إرسال الدعوة مرة أخرى' : 'Invite resent');
    } catch {
      notify(ar ? 'تعذر إرسال الدعوة' : 'Could not resend invite', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const initials = (name) =>
    (name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-600" />
            {ar ? 'الموظفون' : 'Employees'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length}{' '}
            {ar ? 'موظف' : 'employees'}
            {filtered.length !== employees.length && (
              <span className="text-gray-400"> {ar ? `من ${employees.length}` : `of ${employees.length}`}</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchEmployees}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${ar ? 'right-3' : 'left-3'}`} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={ar ? 'ابحث بالاسم أو البريد أو الوظيفة…' : 'Search by name, email or role…'}
            className={`w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm ${ar ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="all">{ar ? 'كل الوظائف' : 'All roles'}</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option>
          <option value="active">{ar ? 'نشط' : 'Active'}</option>
          <option value="inactive">{ar ? 'معطّل' : 'Inactive'}</option>
        </select>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-cyan-500 animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {employees.length === 0
              ? (ar ? 'لا يوجد موظفون مسجلون بعد' : 'No employees yet')
              : (ar ? 'لا توجد نتائج مطابقة' : 'No matching results')}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {filtered.map((emp, i) => (
            <div
              key={emp.id || i}
              className={`flex flex-wrap items-center gap-3 p-4 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''} ${!emp.is_active ? 'opacity-60' : ''}`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {initials(emp.full_name)}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-[160px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {emp.full_name || (ar ? 'بدون اسم' : 'Unnamed')}
                  </p>
                  {emp.id === me?.id && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600 border border-cyan-100">
                      {ar ? 'أنت' : 'You'}
                    </span>
                  )}
                  {!emp.is_active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {ar ? 'معطّل' : 'Inactive'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{emp.email}</p>
              </div>

              {/* Role */}
              <div className="min-w-[130px]">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                  <Shield className="w-3 h-3 text-gray-400" />
                  {emp.role || '—'}
                </span>
              </div>

              {/* Actions */}
              {canManage && emp.id !== me?.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleResendInvite(emp)}
                    disabled={busyId === emp.id}
                    title={ar ? 'إعادة إرسال الدعوة' : 'Resend invite'}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  {emp.is_active ? (
                    <button
                      onClick={() => setConfirmDelete(emp)}
                      disabled={busyId === emp.id}
                      title={ar ? 'تعطيل' : 'Deactivate'}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                    >
                      {busyId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(emp)}
                      disabled={busyId === emp.id}
                      title={ar ? 'إعادة تفعيل' : 'Reactivate'}
                      className="p-2 rounded-lg hover:bg-green-50 text-green-600 disabled:opacity-50"
                    >
                      {busyId === emp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div dir={ar ? 'rtl' : 'ltr'} className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  {ar ? 'تعطيل الموظف' : 'Deactivate employee'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {ar
                    ? `سيفقد ${confirmDelete.full_name || 'هذا الموظف'} إمكانية الدخول. يمكنك إعادة التفعيل لاحقاً.`
                    : `${confirmDelete.full_name || 'This employee'} will lose access. You can reactivate later.`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {busyId === confirmDelete.id
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : (ar ? 'تعطيل' : 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 ${ar ? 'right-5' : 'left-5'} z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-3.5 h-3.5 opacity-70" /></button>
        </div>
      )}
    </div>
  );
}
