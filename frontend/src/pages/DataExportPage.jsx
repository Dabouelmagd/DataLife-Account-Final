import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Download, Database, RefreshCw, ShieldCheck, AlertTriangle, FileArchive } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const currentUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
};

const STATUS_AR = {
  queued: 'في الانتظار',
  running: 'جارٍ التصدير',
  done: 'جاهز للتحميل',
  failed: 'فشل',
  expired: 'انتهت صلاحيته (حُذف بعد 24 ساعة)',
};

const BACKUP_STATE = {
  ok: { label: 'سليم', cls: 'bg-emerald-100 text-emerald-800' },
  warning: { label: 'تحذير', cls: 'bg-amber-100 text-amber-800' },
  stale: { label: 'قديم', cls: 'bg-orange-100 text-orange-800' },
  failed: { label: 'فشل', cls: 'bg-red-100 text-red-800' },
  unknown: { label: 'غير معروف', cls: 'bg-slate-100 text-slate-700' },
};

const fmtSize = (n) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ar-EG'); } catch { return s; }
};

async function readError(res) {
  try {
    const j = await res.json();
    return typeof j.detail === 'string' ? j.detail : 'حدث خطأ';
  } catch {
    return 'حدث خطأ';
  }
}

function BackupStatusCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/backup/status`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await readError(res));
      setStatus(await res.json());
    } catch (e) {
      setStatus({ state: 'unknown', message_ar: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const st = BACKUP_STATE[status?.state] || BACKUP_STATE.unknown;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" /> النسخ الاحتياطي لقاعدة البيانات
          </CardTitle>
          <CardDescription>يظهر لمديري المنصة فقط — يُقرأ من ملف الحالة الذي يكتبه سكربت النسخ على الخادم</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          <span className="text-slate-600">{status?.message_ar || '...'}</span>
        </div>
        {status && status.state !== 'unknown' && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div><dt className="text-slate-500">آخر نسخة</dt><dd>{fmtDate(status.time)}</dd></div>
            <div><dt className="text-slate-500">العمر</dt><dd>{status.age_hours != null ? `${status.age_hours} ساعة` : '—'}</dd></div>
            <div><dt className="text-slate-500">الحجم</dt><dd>{fmtSize(status.size)}</dd></div>
            <div><dt className="text-slate-500">تم التحقق</dt><dd>{status.verified ? 'نعم' : 'لا'}</dd></div>
            <div><dt className="text-slate-500">نسخة خارج الخادم</dt><dd>{status.offsite || 'لا يوجد'}</dd></div>
            <div><dt className="text-slate-500">عدد النسخ المحفوظة</dt><dd>{status.kept ?? '—'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">الملف</dt><dd className="font-mono text-xs" dir="ltr">{status.file || '—'}</dd></div>
          </dl>
        )}
        {status?.error && <p className="text-red-700">{status.error}</p>}
      </CardContent>
    </Card>
  );
}

export default function DataExportPage() {
  const user = currentUser();
  const isPlatformAdmin = user?.is_platform_admin === true || user?.role === 'Super Admin';
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/data-export`, { headers: authHeaders() });
      if (res.status === 403) { setDenied(await readError(res)); return; }
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = jobs.find((j) => j.status === 'queued' || j.status === 'running');

  useEffect(() => {
    if (!active) return undefined;
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/data-export/${active.id}`, { headers: authHeaders() });
        if (!res.ok) return;
        const j = await res.json();
        setJobs((prev) => prev.map((p) => (p.id === j.id ? j : p)));
        if (j.status === 'done') toast.success('ملف التصدير جاهز للتحميل');
        if (j.status === 'failed') toast.error(j.error || 'فشل التصدير');
      } catch {
        /* network blip: try again on the next tick */
      }
    }, 2000);
    return () => clearInterval(timer.current);
  }, [active]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/data-export`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(await readError(res));
      const job = await res.json();
      setJobs((prev) => [job, ...prev]);
      toast.success('بدأ تصدير بيانات الشركة');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async (job) => {
    try {
      const res = await fetch(`${API}/api/data-export/${job.id}/link`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(await readError(res));
      const { url } = await res.json();
      window.location.assign(`${API}${url}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">تصدير بيانات الشركة</h1>
        <p className="mt-1 text-slate-600">
          بياناتك ملكك. نزّل نسخة كاملة من كل بيانات شركتك في أي وقت لتحتفظ بها أو تنقلها إلى أي نظام آخر.
        </p>
      </header>

      {isPlatformAdmin && <BackupStatusCard />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileArchive className="h-5 w-5" /> نسخة كاملة من بياناتك (ZIP)
          </CardTitle>
          <CardDescription>
            ملف JSON لكل مجموعة بيانات، وملفات Excel لدليل الحسابات وسطور القيود والفواتير والعملاء والموردين والأصناف والموظفين.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-slate-600">
            <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              لا تُصدَّر الأسرار: كلمات المرور، رموز الدخول، أكواد التحقق، أسرار ربط الفاتورة الإلكترونية والمتاجر.</li>
            <li className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              البيانات الشخصية للموظفين والعملاء غير مُخفاة لأنها نسختك الخاصة — احفظ الملف في مكان آمن.</li>
            <li className="flex items-start gap-2"><RefreshCw className="mt-0.5 h-4 w-4 text-slate-500" />
              تصدير واحد كل ساعة لكل شركة. الملف يُحذف تلقائياً بعد 24 ساعة، ورابط التحميل يعمل مرة واحدة.</li>
          </ul>

          {denied ? (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{denied}</p>
          ) : (
            <Button onClick={start} disabled={busy || !!active}>
              <FileArchive className="ml-2 h-4 w-4" />
              {active ? 'جارٍ التصدير…' : 'طلب تصدير جديد'}
            </Button>
          )}

          {jobs.length > 0 && (
            <div className="divide-y rounded-md border">
              {jobs.map((j) => (
                <div key={j.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={j.status === 'done' ? 'default' : 'secondary'}>{STATUS_AR[j.status] || j.status}</Badge>
                      <span className="text-sm text-slate-600">{fmtDate(j.created_at)}</span>
                      {j.requested_by_name && <span className="text-xs text-slate-500">— {j.requested_by_name}</span>}
                    </div>
                    {(j.status === 'running' || j.status === 'queued') && (
                      <div className="w-64 max-w-full">
                        <div className="h-2 overflow-hidden rounded bg-slate-100">
                          <div className="h-2 bg-blue-600 transition-all" style={{ width: `${j.progress || 0}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{j.step} · {j.progress || 0}% · {j.documents || 0} سجل</p>
                      </div>
                    )}
                    {j.status === 'done' && (
                      <p className="text-xs text-slate-500">
                        {j.documents} سجل · {fmtSize(j.size)} · متاح حتى {fmtDate(j.expires_at)}
                      </p>
                    )}
                    {j.status === 'failed' && <p className="text-xs text-red-700">{j.error}</p>}
                  </div>
                  {j.status === 'done' && (
                    <Button variant="outline" size="sm" onClick={() => download(j)}>
                      <Download className="ml-2 h-4 w-4" /> تحميل
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
