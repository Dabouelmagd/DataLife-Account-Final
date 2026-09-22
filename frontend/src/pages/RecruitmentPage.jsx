/**
 * التوظيف — jobs, candidates, evaluations and hiring in one place.
 *
 * Three views: the job list, its candidates with their scores, and one
 * candidate's summary (every interviewer's card, the weighted breakdown, and
 * hiring). Hiring is one click: the salary, title, department and date come
 * from the candidate and the job profile — HR only changes what differs.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Briefcase, Users, Star, Plus, X, Loader2, CheckCircle, UserPlus, ArrowRight,
  Sparkles, AlertTriangle, Scale, Trophy,
} from 'lucide-react';
import InterviewScorecard from '../components/InterviewScorecard';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const STAGES = {
  applied: ['متقدّم', 'bg-slate-100 text-slate-700'],
  screening: ['فرز مبدئي', 'bg-sky-100 text-sky-800'],
  interviewing: ['مقابلات', 'bg-indigo-100 text-indigo-800'],
  offer: ['عرض', 'bg-amber-100 text-amber-800'],
  hired: ['مُعيَّن', 'bg-emerald-100 text-emerald-800'],
  rejected: ['مرفوض', 'bg-red-100 text-red-700'],
  withdrawn: ['منسحب', 'bg-slate-100 text-slate-500'],
};
const RECOMMENDATION = {
  strong_yes: ['يرشّحه بقوة', 'text-emerald-700'], yes: ['يرشّحه', 'text-emerald-600'],
  neutral: ['محايد', 'text-slate-500'], no: ['لا يرشّحه', 'text-red-600'],
  strong_no: ['يرفضه بقوة', 'text-red-700'],
};
const CATEGORIES = [
  ['technical', 'فني'], ['soft_skills', 'شخصي'], ['experience', 'خبرة'],
  ['culture_fit', 'توافق'], ['language', 'لغة'], ['other', 'أخرى'],
];
const LEVELS = [['junior', 'مبتدئ'], ['mid', 'متوسط'], ['senior', 'خبير']];
const EMPTY_JOB = {
  title: '', department: '', level: 'mid', passing_score: 70, salary_range_min: '', salary_range_max: '',
  criteria: [
    { key: 'tech', label: 'المهارات الفنية', category: 'technical', weight: 40 },
    { key: 'soft', label: 'المهارات الشخصية', category: 'soft_skills', weight: 30 },
    { key: 'exp', label: 'الخبرة', category: 'experience', weight: 20 },
    { key: 'fit', label: 'التوافق مع بيئة العمل', category: 'culture_fit', weight: 10 },
  ],
};

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState(null);
  const [job, setJob] = useState(null);              // selected job
  const [candidates, setCandidates] = useState([]);
  const [candidate, setCandidate] = useState(null);  // selected candidate
  const [summary, setSummary] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [scoring, setScoring] = useState(false);     // scorecard open
  const [jobForm, setJobForm] = useState(null);
  const [candForm, setCandForm] = useState(null);
  const [hireForm, setHireForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/interviews/job-profiles`, { ...auth(), params: { only_open: false } });
      setJobs(data.job_profiles || []);
    } catch (e) { setJobs([]); setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر تحميل الوظائف' }); }
  }, []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadCandidates = useCallback(async (jobId) => {
    const { data } = await axios.get(`${API}/api/interviews/candidates`, { ...auth(), params: { job_profile_id: jobId } });
    setCandidates(data.candidates || []);
  }, []);

  const openJob = async (j) => {
    setJob(j); setCandidate(null); setSummary(null); setMsg({ type: '', text: '' });
    await loadCandidates(j.id);
  };

  const openCandidate = async (c) => {
    setCandidate(c); setSummary(null); setEvaluations([]); setScoring(false); setMsg({ type: '', text: '' });
    try {
      const [s, e] = await Promise.all([
        axios.get(`${API}/api/interviews/candidates/${c.id}/score`, { ...auth(), params: { job_profile_id: job.id } }),
        axios.get(`${API}/api/interviews/candidates/${c.id}/evaluations`, auth()),
      ]);
      setSummary(s.data); setEvaluations(e.data.evaluations || []);
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر تحميل تقييمات المرشح' }); }
  };

  const refreshCandidate = async () => { await loadCandidates(job.id); await openCandidate(candidate); };

  // ── job form ───────────────────────────────────────────────────────────
  const weightTotal = useMemo(
    () => (jobForm?.criteria || []).reduce((s, c) => s + (Number(c.weight) || 0), 0), [jobForm]);

  const saveJob = async () => {
    if (!jobForm.title.trim()) { setMsg({ type: 'err', text: 'اسم الوظيفة مطلوب' }); return; }
    if (Math.round(weightTotal * 100) / 100 !== 100) { setMsg({ type: 'err', text: `مجموع الأوزان ${weightTotal}% — يجب أن يساوي 100%` }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.post(`${API}/api/interviews/job-profiles`, {
        company_id: 'from-token', title: jobForm.title.trim(), department: jobForm.department || null,
        level: jobForm.level, passing_score: Number(jobForm.passing_score) || 70,
        salary_range_min: jobForm.salary_range_min === '' ? null : Number(jobForm.salary_range_min),
        salary_range_max: jobForm.salary_range_max === '' ? null : Number(jobForm.salary_range_max),
        criteria: jobForm.criteria.map((c) => ({ ...c, weight: Number(c.weight) })),
      }, auth());
      setJobForm(null); await loadJobs();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || 'تعذّر حفظ الوظيفة' }); }
    finally { setBusy(false); }
  };

  const saveCandidate = async () => {
    if (!candForm.name.trim()) { setMsg({ type: 'err', text: 'اسم المرشح مطلوب' }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.post(`${API}/api/interviews/candidates`, { ...candForm, job_profile_id: job.id }, auth());
      setCandForm(null); await loadCandidates(job.id);
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر إضافة المرشح' }); }
    finally { setBusy(false); }
  };

  const setStage = async (stage) => {
    setBusy(true);
    try {
      await axios.put(`${API}/api/interviews/candidates/${candidate.id}/stage`, { stage }, auth());
      await refreshCandidate();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر تحديث المرحلة' }); }
    finally { setBusy(false); }
  };

  // ── hiring: prefilled from the candidate and the job ────────────────────
  const openHire = () => setHireForm({
    hire_date: today(),
    basic_salary: candidate.expected_salary ?? job.salary_range_min ?? '',
    position: job.title, department: job.department || '', invite_to_portal: true,
    salaryHint: candidate.expected_salary ? 'الراتب المتوقع للمرشح'
      : (job.salary_range_min ? 'الحد الأدنى لنطاق الوظيفة' : 'لا يوجد راتب محفوظ — أدخله'),
  });

  const hire = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/interviews/candidates/${candidate.id}/onboard`, {
        hire_date: hireForm.hire_date || null,
        basic_salary: hireForm.basic_salary === '' ? null : Number(hireForm.basic_salary),
        position: hireForm.position || null, department: hireForm.department || null,
        invite_to_portal: hireForm.invite_to_portal,
      }, auth());
      setHireForm(null);
      const invited = data.portal_invite?.invite_link;
      setMsg({ type: 'ok', text: `${data.message}${invited ? ' — وأُرسلت دعوة بوابة الموظف' : ''}` });
      await refreshCandidate();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر التعيين' }); }
    finally { setBusy(false); }
  };

  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';

  // ══ candidate summary ═══════════════════════════════════════════════════
  if (candidate && scoring) return (
    <div dir="rtl" className="min-h-full bg-slate-50">
      <button onClick={() => { setScoring(false); refreshCandidate(); }}
        className="m-4 flex items-center gap-1.5 text-sm text-[#1e3a8a] font-semibold">
        <ArrowRight className="w-4 h-4" aria-hidden />رجوع لملف المرشح
      </button>
      <InterviewScorecard candidateId={candidate.id} jobProfileId={job.id}
        onSubmitted={() => { setScoring(false); refreshCandidate(); }} />
    </div>
  );

  if (candidate) return (
    <div dir="rtl" className="min-h-full bg-slate-50 p-4 md:p-6 space-y-4 text-slate-800">
      <button onClick={() => { setCandidate(null); setSummary(null); }} className="flex items-center gap-1.5 text-sm text-[#1e3a8a] font-semibold">
        <ArrowRight className="w-4 h-4" aria-hidden />رجوع لقائمة المرشحين
      </button>

      <header className={`${card} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{candidate.name}</h1>
          <p className="text-sm text-slate-500">{job.title}{candidate.email ? ` — ${candidate.email}` : ''}</p>
          <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${STAGES[candidate.stage]?.[1] || ''}`}>
            {STAGES[candidate.stage]?.[0] || candidate.stage}
          </span>
        </div>
        {summary && (
          <div className="text-center">
            <p className="text-xs text-slate-500">الدرجة النهائية ({summary.interviewers} مُقيِّم)</p>
            <p className={`text-4xl font-extrabold tabular-nums ${summary.passed ? 'text-emerald-600' : 'text-slate-900'}`}>
              {summary.interviewers ? summary.final_score : '—'}
            </p>
            <p className="text-xs text-slate-500">حد النجاح {summary.job_profile.passing_score}</p>
          </div>
        )}
      </header>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setScoring(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold">
          <Star className="w-4 h-4" aria-hidden />تقييم المقابلة
        </button>
        {candidate.stage !== 'hired' && (
          <button onClick={openHire} disabled={!summary?.interviewers}
            title={!summary?.interviewers ? 'لا يوجد تقييم بعد' : 'تعيين كموظف ببيانات المرشح'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-40">
            <UserPlus className="w-4 h-4" aria-hidden />تعيين كموظف
          </button>
        )}
        {!['hired', 'rejected'].includes(candidate.stage) && (
          <>
            <button onClick={() => setStage('offer')} disabled={busy} className="px-4 py-2 rounded-lg border border-amber-300 text-amber-800 font-semibold">عرض وظيفي</button>
            <button onClick={() => setStage('rejected')} disabled={busy} className="px-4 py-2 rounded-lg border border-red-300 text-red-700 font-semibold">رفض</button>
          </>
        )}
      </div>

      {summary?.interviewers > 0 && (
        <section className={`${card} overflow-hidden`}>
          <h2 className="px-5 py-3 border-b border-slate-100 font-bold flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#1e3a8a]" aria-hidden />تفصيل الدرجة
          </h2>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500">
              <th scope="col" className="px-4 py-2 text-start font-semibold">المعيار</th>
              <th scope="col" className="px-4 py-2 text-end font-semibold">المتوسط</th>
              <th scope="col" className="px-4 py-2 text-end font-semibold">الوزن</th>
              <th scope="col" className="px-4 py-2 text-end font-semibold">المساهمة</th>
            </tr></thead>
            <tbody>
              {summary.breakdown.map((b) => (
                <tr key={b.criterion_key} className="border-b border-slate-100">
                  <td className="px-4 py-2">{b.label}<span className="text-xs text-slate-400 ms-2">{b.raters} مُقيِّم</span></td>
                  <td className="px-4 py-2 text-end tabular-nums">{b.avg_score} / 5</td>
                  <td className="px-4 py-2 text-end tabular-nums text-slate-500">{b.effective_weight}%</td>
                  <td className="px-4 py-2 text-end tabular-nums font-semibold">{b.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.not_scored?.length > 0 && (
            <p className="px-5 py-3 text-xs text-amber-800 bg-amber-50 border-t border-amber-100 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
              معايير لم يقيّمها أحد بعد ({summary.not_scored.map((n) => n.label).join('، ')}) — الدرجة محسوبة على ما تم تقييمه فقط.
            </p>
          )}
        </section>
      )}

      {evaluations.length > 0 && (
        <section className={`${card} p-5 space-y-3`}>
          <h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-[#1e3a8a]" aria-hidden />تقييمات المُقيِّمين</h2>
          {evaluations.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-xl p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{e.interviewer_name || 'مُقيِّم'}
                  <span className="text-xs text-slate-500 ms-2">{e.round_name} — {e.interview_date}</span></p>
                <p className="tabular-nums font-bold">{e.weighted_score}
                  <span className={`ms-3 text-xs font-semibold ${RECOMMENDATION[e.recommendation]?.[1]}`}>{RECOMMENDATION[e.recommendation]?.[0]}</span></p>
              </div>
              {e.strengths && <p className="mt-2 text-emerald-800"><b>قوة:</b> {e.strengths}</p>}
              {e.concerns && <p className="mt-1 text-red-800"><b>تحفظ:</b> {e.concerns}</p>}
            </div>
          ))}
        </section>
      )}

      {/* hire dialog — everything prefilled */}
      {hireForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold flex items-center gap-2"><Trophy className="w-5 h-5 text-emerald-600" aria-hidden />تعيين {candidate.name}</h3>
              <button onClick={() => setHireForm(null)} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <p className="sm:col-span-2 text-xs text-slate-500">البيانات مأخوذة من ملف المرشح والوظيفة — عدّل ما تحتاجه فقط.</p>
              <label><span className="text-slate-600">تاريخ التعيين</span>
                <input type="date" value={hireForm.hire_date} onChange={(e) => setHireForm({ ...hireForm, hire_date: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">الراتب الأساسي</span>
                <input type="number" min="1" step="0.01" dir="ltr" value={hireForm.basic_salary}
                  onChange={(e) => setHireForm({ ...hireForm, basic_salary: e.target.value })} className={`${input} tabular-nums`} />
                <span className="block mt-0.5 text-xs text-slate-500">{hireForm.salaryHint}</span></label>
              <label><span className="text-slate-600">المسمى الوظيفي</span>
                <input value={hireForm.position} onChange={(e) => setHireForm({ ...hireForm, position: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">القسم</span>
                <input value={hireForm.department} onChange={(e) => setHireForm({ ...hireForm, department: e.target.value })} className={input} /></label>
              <label className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={hireForm.invite_to_portal}
                  onChange={(e) => setHireForm({ ...hireForm, invite_to_portal: e.target.checked })} />
                <span>إرسال دعوة بوابة الموظف على بريده</span></label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setHireForm(null)} className="px-4 py-2 rounded-lg border border-slate-300">إلغاء</button>
              <button onClick={hire} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckCircle className="w-4 h-4" aria-hidden />}تأكيد التعيين
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══ candidates of a job ═════════════════════════════════════════════════
  if (job) return (
    <div dir="rtl" className="min-h-full bg-slate-50 p-4 md:p-6 space-y-4 text-slate-800">
      <button onClick={() => setJob(null)} className="flex items-center gap-1.5 text-sm text-[#1e3a8a] font-semibold">
        <ArrowRight className="w-4 h-4" aria-hidden />رجوع للوظائف
      </button>
      <header className={`${card} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{job.title}</h1>
          <p className="text-sm text-slate-500">{job.department || '—'} · حد النجاح {job.passing_score}
            {job.salary_range_min ? ` · النطاق ${money(job.salary_range_min)} – ${money(job.salary_range_max)}` : ''}</p>
          <p className="mt-1 text-xs text-slate-500">{job.criteria.map((c) => `${c.label} ${c.weight}%`).join(' · ')}</p>
        </div>
        <button onClick={() => setCandForm({ name: '', email: '', phone: '', expected_salary: '', source: '' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold">
          <Plus className="w-4 h-4" aria-hidden />إضافة مرشح
        </button>
      </header>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      <div className={card}>
        {candidates.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">لا يوجد مرشحون لهذه الوظيفة بعد</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">المرشح</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">المرحلة</th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">الراتب المتوقع</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">فتح</span></th>
            </tr></thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <button onClick={() => openCandidate(c)} className="font-semibold text-slate-900 hover:text-[#1e3a8a] hover:underline">{c.name}</button>
                    <p className="text-xs text-slate-500">{c.email || c.phone || '—'}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGES[c.stage]?.[1] || ''}`}>{STAGES[c.stage]?.[0] || c.stage}</span>
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{c.expected_salary ? money(c.expected_salary) : '—'}</td>
                  <td className="px-4 py-2.5 text-end">
                    <button onClick={() => openCandidate(c)} className="text-[#1e3a8a] text-xs font-semibold">فتح الملف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {candForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold">إضافة مرشح — {job.title}</h3>
              <button onClick={() => setCandForm(null)} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-slate-600">الاسم *</span>
                <input autoFocus value={candForm.name} onChange={(e) => setCandForm({ ...candForm, name: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">البريد الإلكتروني</span>
                <input dir="ltr" type="email" value={candForm.email} onChange={(e) => setCandForm({ ...candForm, email: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">الهاتف</span>
                <input dir="ltr" value={candForm.phone} onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">الراتب المتوقع</span>
                <input type="number" min="0" dir="ltr" value={candForm.expected_salary}
                  onChange={(e) => setCandForm({ ...candForm, expected_salary: e.target.value })} className={`${input} tabular-nums`} />
                <span className="block mt-0.5 text-xs text-slate-500">يُستخدم تلقائياً عند التعيين</span></label>
              <label><span className="text-slate-600">المصدر</span>
                <input value={candForm.source} onChange={(e) => setCandForm({ ...candForm, source: e.target.value })} placeholder="ترشيح، لينكدإن…" className={input} /></label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setCandForm(null)} className="px-4 py-2 rounded-lg border border-slate-300">إلغاء</button>
              <button onClick={saveCandidate} disabled={busy} className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══ jobs ════════════════════════════════════════════════════════════════
  return (
    <div dir="rtl" className="min-h-full bg-slate-50 p-4 md:p-6 space-y-4 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-[#1e3a8a]" aria-hidden />التوظيف والمقابلات
        </h1>
        <button onClick={() => { setJobForm({ ...EMPTY_JOB, criteria: EMPTY_JOB.criteria.map((c) => ({ ...c })) }); setMsg({ type: '', text: '' }); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold">
          <Plus className="w-4 h-4" aria-hidden />وظيفة جديدة
        </button>
      </header>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      {jobs === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : jobs.length === 0 ? (
        <p className={`${card} p-12 text-center text-slate-600`}>ابدأ بإنشاء وظيفة ومعايير تقييمها، ثم أضف المرشحين.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((j) => (
            <button key={j.id} onClick={() => openJob(j)} className={`${card} p-5 text-start hover:border-[#1e3a8a]/40 transition`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-extrabold text-slate-900">{j.title}</h2>
                {!j.is_open && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">مغلقة</span>}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{j.department || '—'} · {LEVELS.find(([v]) => v === j.level)?.[1]}</p>
              <p className="text-xs text-slate-500 mt-3">{j.criteria.map((c) => `${c.label} ${c.weight}%`).join(' · ')}</p>
            </button>
          ))}
        </div>
      )}

      {jobForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold">وظيفة جديدة</h3>
              <button onClick={() => setJobForm(null)} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label><span className="text-slate-600">المسمى الوظيفي *</span>
                <input autoFocus value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">القسم</span>
                <input value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">المستوى</span>
                <select value={jobForm.level} onChange={(e) => setJobForm({ ...jobForm, level: e.target.value })} className={`${input} bg-white`}>
                  {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label><span className="text-slate-600">حد النجاح (من 100)</span>
                <input type="number" min="0" max="100" dir="ltr" value={jobForm.passing_score}
                  onChange={(e) => setJobForm({ ...jobForm, passing_score: e.target.value })} className={`${input} tabular-nums`} /></label>
              <label><span className="text-slate-600">الراتب من</span>
                <input type="number" min="0" dir="ltr" value={jobForm.salary_range_min}
                  onChange={(e) => setJobForm({ ...jobForm, salary_range_min: e.target.value })} className={`${input} tabular-nums`} /></label>
              <label><span className="text-slate-600">إلى</span>
                <input type="number" min="0" dir="ltr" value={jobForm.salary_range_max}
                  onChange={(e) => setJobForm({ ...jobForm, salary_range_max: e.target.value })} className={`${input} tabular-nums`} /></label>

              <div className="sm:col-span-2 mt-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold">معايير التقييم وأوزانها</p>
                  <span className={`text-sm font-bold tabular-nums ${Math.round(weightTotal * 100) / 100 === 100 ? 'text-emerald-600' : 'text-red-700'}`}>
                    المجموع {weightTotal}%
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {jobForm.criteria.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input value={c.label} aria-label="اسم المعيار"
                        onChange={(e) => setJobForm({ ...jobForm, criteria: jobForm.criteria.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                        className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg" />
                      <select value={c.category} aria-label="تصنيف المعيار"
                        onChange={(e) => setJobForm({ ...jobForm, criteria: jobForm.criteria.map((x, j) => j === i ? { ...x, category: e.target.value } : x) })}
                        className="px-2 py-2 border border-slate-300 rounded-lg bg-white">
                        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input type="number" min="1" max="100" dir="ltr" value={c.weight} aria-label="الوزن"
                        onChange={(e) => setJobForm({ ...jobForm, criteria: jobForm.criteria.map((x, j) => j === i ? { ...x, weight: e.target.value } : x) })}
                        className="w-20 px-2 py-2 border border-slate-300 rounded-lg tabular-nums" />
                      <span className="text-slate-500">%</span>
                      <button onClick={() => setJobForm({ ...jobForm, criteria: jobForm.criteria.filter((_, j) => j !== i) })}
                        aria-label="حذف المعيار" className="p-1.5 text-slate-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setJobForm({ ...jobForm, criteria: [...jobForm.criteria, { key: `c${jobForm.criteria.length + 1}`, label: '', category: 'other', weight: 0 }] })}
                  className="mt-2 flex items-center gap-1.5 text-sm text-[#1e3a8a] font-semibold">
                  <Plus className="w-4 h-4" aria-hidden />إضافة معيار
                </button>
                <p className="mt-2 text-xs text-slate-500 flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                  الأوزان هي ما يُحتسب به تقييم كل مُقيِّم، ويجب أن يكون مجموعها 100%.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setJobForm(null)} className="px-4 py-2 rounded-lg border border-slate-300">إلغاء</button>
              <button onClick={saveJob} disabled={busy} className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">حفظ الوظيفة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
