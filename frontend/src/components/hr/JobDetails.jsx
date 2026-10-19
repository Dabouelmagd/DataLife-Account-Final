/**
 * تفاصيل الوظيفة — كل بيانات الوظيفة وأسئلة المقابلة الخاصة بها.
 *
 * The job page showed only the title, department and weights. This shows
 * the whole profile (level, salary range, description, requirements,
 * responsibilities, criteria) and the interview questions this job will be
 * asked, grouped by type — general, technical, personal — the same set the
 * scorecard offers during the interview: questions written for this job
 * title (or department) plus the general ones that fit any job.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ChevronDown, MessageSquareText, Brain, Loader2, Info } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => Number(n || 0).toLocaleString('ar-EG');

const LEVELS = { junior: 'مبتدئ', mid: 'متوسط', senior: 'خبير' };
const GROUPS = [
  ['technical', 'أسئلة فنية'],
  ['soft_skills', 'أسئلة شخصية'],
  ['experience', 'أسئلة الخبرة'],
  ['culture_fit', 'التوافق مع بيئة العمل'],
  ['language', 'اللغات'],
  ['other', 'أخرى'],
];

export default function JobDetails({ job, onManageQuestions }) {
  const [questions, setQuestions] = useState(null);
  const [assess, setAssess] = useState(null);
  const [open, setOpen] = useState({});
  const [answer, setAnswer] = useState({});
  const [showProfile, setShowProfile] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/interviews/questions`, { ...auth(), params: { limit: 500 } });
        if (!alive) return;
        setQuestions((data.questions || []).filter((q) =>
          (!q.role || q.role === job.title) && (!q.department || q.department === job.department)));
      } catch { if (alive) setQuestions([]); }
      try {
        const { data } = await axios.get(`${API}/api/assessments/questions/summary`, auth());
        if (alive) setAssess(data);
      } catch { /* the HR-only summary is optional here */ }
    })();
    return () => { alive = false; };
  }, [job.title, job.department]);

  const grouped = useMemo(() => {
    const g = {};
    (questions || []).forEach((q) => { (g[q.category] = g[q.category] || []).push(q); });
    return g;
  }, [questions]);
  const specific = (questions || []).filter((q) => q.role || q.department).length;
  const general = (questions || []).length - specific;

  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
  const list = (arr) => (arr || []).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* the job profile */}
      <section className={card}>
        <button type="button" onClick={() => setShowProfile((v) => !v)} aria-expanded={showProfile}
          className="w-full flex items-center justify-between px-5 py-3 font-bold text-slate-900">
          <span>بيانات الوظيفة</span>
          <ChevronDown className={`w-4 h-4 transition ${showProfile ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {showProfile && (
          <div className="px-5 pb-5 space-y-4 text-sm">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><dt className="text-xs text-slate-500">القسم</dt><dd className="font-semibold">{job.department || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">المستوى</dt><dd className="font-semibold">{LEVELS[job.level] || job.level || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">حد النجاح</dt><dd className="font-semibold tabular-nums">{job.passing_score} / 100</dd></div>
              <div><dt className="text-xs text-slate-500">نطاق الراتب</dt>
                <dd className="font-semibold tabular-nums">{job.salary_range_min ? `${money(job.salary_range_min)} – ${money(job.salary_range_max)} ج.م` : '—'}</dd></div>
            </dl>
            {job.description && <p className="leading-7 text-slate-700">{job.description}</p>}
            <div className="grid sm:grid-cols-2 gap-4">
              {list(job.requirements).length > 0 && (
                <div><h3 className="font-bold mb-1">المتطلبات</h3>
                  <ul className="list-disc ps-5 space-y-0.5 text-slate-700">{list(job.requirements).map((r, i) => <li key={i}>{r}</li>)}</ul></div>
              )}
              {list(job.responsibilities).length > 0 && (
                <div><h3 className="font-bold mb-1">المسؤوليات</h3>
                  <ul className="list-disc ps-5 space-y-0.5 text-slate-700">{list(job.responsibilities).map((r, i) => <li key={i}>{r}</li>)}</ul></div>
              )}
            </div>
            <div>
              <h3 className="font-bold mb-2">معايير التقييم وأوزانها</h3>
              <ul className="space-y-1.5">
                {job.criteria.map((c) => (
                  <li key={c.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0">{c.label}</span>
                    <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                      <span className="block h-full bg-[#1e3a8a]" style={{ width: `${c.weight}%` }} />
                    </span>
                    <span className="w-12 text-end tabular-nums text-slate-600">{c.weight}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* interview questions for this job */}
      <section className={card}>
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-[#1e3a8a]" aria-hidden />أسئلة المقابلة لهذه الوظيفة
            {questions && <span className="text-xs font-normal text-slate-500">— {specific} خاصة بالوظيفة · {general} عامة</span>}
          </h2>
          {onManageQuestions && (
            <button onClick={onManageQuestions} className="text-sm font-semibold text-[#1e3a8a]">إدارة الأسئلة ←</button>
          )}
        </header>
        {questions === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : questions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600 flex items-center gap-2"><Info className="w-4 h-4 shrink-0" aria-hidden />
            لا توجد أسئلة لهذه الوظيفة بعد — أضفها من «بنك الأسئلة» أو اطلب اقتراحات بالذكاء الاصطناعي باسم هذه الوظيفة.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {GROUPS.filter(([k]) => grouped[k]?.length).map(([k, label]) => (
              <div key={k} className="px-5 py-3">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} aria-expanded={!!open[k]}
                  className="w-full flex items-center justify-between font-semibold text-slate-800">
                  <span>{label} <span className="text-xs text-slate-500 tabular-nums">({grouped[k].length})</span></span>
                  <ChevronDown className={`w-4 h-4 transition ${open[k] ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open[k] && (
                  <ol className="mt-2 space-y-2 list-decimal ps-5 text-sm">
                    {grouped[k].map((q) => (
                      <li key={q.id} className="leading-7">
                        <span>{q.question}</span>
                        <span className={`ms-2 text-[11px] px-1.5 py-0.5 rounded ${q.role || q.department ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                          {q.role || q.department ? 'خاص بالوظيفة' : 'عام'}</span>
                        {(q.expected_answer || q.evaluation_criteria?.length > 0) && (
                          <button type="button" onClick={() => setAnswer((a) => ({ ...a, [q.id]: !a[q.id] }))}
                            className="ms-2 text-xs text-[#1e3a8a] font-semibold">
                            {answer[q.id] ? 'إخفاء الإجابة النموذجية' : 'الإجابة النموذجية'}</button>
                        )}
                        {answer[q.id] && (
                          <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-6">
                            {q.expected_answer && <p>{q.expected_answer}</p>}
                            {q.evaluation_criteria?.length > 0 && <p className="mt-1"><b>يقيس:</b> {q.evaluation_criteria.join('، ')}</p>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* the candidate tests that go with every job */}
      {assess && (
        <section className={`${card} px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm`}>
          <span className="font-bold flex items-center gap-2"><Brain className="w-4 h-4 text-[#1e3a8a]" aria-hidden />اختبارات المرشح</span>
          <span>اختبار الشخصية: <b className="tabular-nums">{assess.psychometric || 0}</b> سؤال</span>
          <span>اختبار القدرات: <b className="tabular-nums">{assess.aptitude || 0}</b> سؤال</span>
          <span className="text-xs text-slate-500">يُؤدَّى من صفحة كل مرشح</span>
        </section>
      )}
    </div>
  );
}
