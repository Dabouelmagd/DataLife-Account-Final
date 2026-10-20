/**
 * الموارد البشرية ← الموظفون: قائمة موظفي الشركة (سجل الموارد البشرية).
 *
 * The HR «الموظفون» item opened the system-users screen (logins and invites),
 * so the people on the payroll were nowhere to be listed or added. Users now
 * live under «إدارة المستخدمين»; this lists employees, adds one, and opens the
 * employee's profile (photo, CV, documents, allowances, portal).
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, Search, X, UserRound } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const photoUrl = (p) => (!p ? null : p.startsWith('http') ? p : `${API}${p.startsWith('/') ? '' : '/'}${p}`);

const EMPTY = { name: '', position: '', department: '', hire_date: today(), basic_salary: '', national_id: '', phone: '', email: '' };

export default function HREmployeesList({ language = 'ar', onOpen }) {
  const ar = language === 'ar';
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/api/employees`, auth());
      setRows(data.employees || []);
    } catch (e) {
      setRows([]);
      setErr(e?.response?.data?.detail || (ar ? 'تعذّر تحميل الموظفين' : 'Could not load employees'));
    }
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((e) => {
      const active = e.is_active !== false && e.status !== 'terminated';
      if (status === 'active' && !active) return false;
      if (status === 'inactive' && active) return false;
      if (!t) return true;
      return [e.name, e.name_en, e.employee_code, e.position, e.department, e.phone, e.email]
        .some((v) => String(v || '').toLowerCase().includes(t));
    });
  }, [rows, q, status]);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const body = { ...f, name: f.name.trim(), position: f.position.trim(), basic_salary: Number(f.basic_salary) || 0 };
      Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k]; });
      const { data } = await axios.post(`${API}/api/employees`, body, auth());
      setAdding(false); setF(EMPTY);
      await load();
      if (data?.employee?.id) onOpen?.(data.employee.id);   // continue in the profile: photo, CV, documents
    } catch (e) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === 'string' ? d : (ar ? 'تعذّر حفظ الموظف — راجع الحقول' : 'Could not save — check the fields'));
    } finally { setBusy(false); }
  };

  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
  const canSave = f.name.trim().length >= 2 && f.position.trim() && f.hire_date;

  return (
    <div className="p-4 md:p-6 space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">{ar ? 'الموظفون' : 'Employees'}</h1>
          <p className="text-sm text-slate-500">
            {ar ? 'سجل موظفي الشركة. حسابات الدخول للبرنامج في «إدارة المستخدمين».' : 'Company staff records. Program logins are under User Management.'}</p>
        </div>
        <button onClick={() => { setAdding(true); setErr(''); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">
          <Plus className="w-4 h-4" aria-hidden /> {ar ? 'إضافة موظف' : 'Add employee'}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute top-2.5 start-3 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث بالاسم أو الكود أو الوظيفة' : 'Search name, code, position'}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900">
          <option value="active">{ar ? 'على رأس العمل' : 'Active'}</option>
          <option value="inactive">{ar ? 'منتهية خدمتهم' : 'Inactive'}</option>
          <option value="all">{ar ? 'الكل' : 'All'}</option>
        </select>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {rows.length === 0 ? (ar ? 'لا يوجد موظفون بعد — أضف أول موظف، أو استوردهم من «استيراد البيانات».' : 'No employees yet — add one, or import them.')
            : (ar ? 'لا نتائج لهذا البحث' : 'No matches')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-start px-3 py-2">{ar ? 'الموظف' : 'Employee'}</th>
                <th className="text-start px-3 py-2">{ar ? 'الكود' : 'Code'}</th>
                <th className="text-start px-3 py-2">{ar ? 'الوظيفة' : 'Position'}</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">{ar ? 'القسم' : 'Department'}</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">{ar ? 'تاريخ التعيين' : 'Hired'}</th>
                <th className="text-end px-3 py-2">{ar ? 'الأساسي' : 'Basic'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.map((e) => (
                <tr key={e.id} onClick={() => onOpen?.(e.id)} className="cursor-pointer hover:bg-blue-50/60 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-2">
                    <button type="button" className="flex items-center gap-2 text-start font-semibold" onClick={(ev) => { ev.stopPropagation(); onOpen?.(e.id); }}>
                      {photoUrl(e.photo_url)
                        ? <img src={photoUrl(e.photo_url)} alt="" className="w-8 h-8 rounded-full object-cover" />
                        : <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center"><UserRound className="w-4 h-4 text-slate-500" aria-hidden /></span>}
                      {e.name}
                    </button>
                  </td>
                  <td className="px-3 py-2"><bdi dir="ltr">{e.employee_code || '—'}</bdi></td>
                  <td className="px-3 py-2">{e.position || '—'}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{e.department || '—'}</td>
                  <td className="px-3 py-2 hidden md:table-cell"><bdi dir="ltr">{e.hire_date || '—'}</bdi></td>
                  <td className="px-3 py-2 text-end"><bdi dir="ltr" className="tabular-nums">{money(e.basic_salary)}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {err && !adding && <p className="text-sm text-red-700" role="alert">{err}</p>}

      {adding && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-extrabold">{ar ? 'إضافة موظف' : 'Add employee'}</h2>
              <button onClick={() => setAdding(false)} aria-label={ar ? 'إغلاق' : 'Close'} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-slate-600">{ar ? 'الاسم *' : 'Name *'}</span>
                <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">{ar ? 'الوظيفة *' : 'Position *'}</span>
                <input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">{ar ? 'القسم' : 'Department'}</span>
                <input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">{ar ? 'تاريخ التعيين *' : 'Hire date *'}</span>
                <input type="date" value={f.hire_date} onChange={(e) => setF({ ...f, hire_date: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">{ar ? 'الراتب الأساسي' : 'Basic salary'}</span>
                <input type="number" min="0" step="0.01" dir="ltr" value={f.basic_salary} onChange={(e) => setF({ ...f, basic_salary: e.target.value })} className={`${input} tabular-nums`} /></label>
              <label><span className="text-slate-600">{ar ? 'الرقم القومي' : 'National ID'}</span>
                <input dir="ltr" inputMode="numeric" maxLength={14} value={f.national_id} onChange={(e) => setF({ ...f, national_id: e.target.value.replace(/\D/g, '') })} className={input} /></label>
              <label><span className="text-slate-600">{ar ? 'الموبايل' : 'Mobile'}</span>
                <input dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
              <label className="sm:col-span-2"><span className="text-slate-600">{ar ? 'البريد الإلكتروني' : 'Email'}</span>
                <input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
              <p className="sm:col-span-2 text-xs text-slate-500">
                {ar ? 'بعد الحفظ يفتح ملف الموظف لإضافة الصورة والسيرة الذاتية والمستندات والبدلات.' : 'After saving, the profile opens for photo, CV, documents and allowances.'}</p>
            </div>
            {err && <p className="mx-5 mb-3 text-sm text-red-700" role="alert">{err}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={save} disabled={busy || !canSave} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
                {busy ? '…' : (ar ? 'حفظ' : 'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
