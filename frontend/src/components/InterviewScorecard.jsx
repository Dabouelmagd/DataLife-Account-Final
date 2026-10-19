/**
 * بطاقة تقييم المقابلة — Interviewer scorecard.
 *
 * The weights come from the job profile, so the interviewer sees the same
 * weighting the final score will use, and the weighted total updates as they
 * rate. Criteria left unrated are excluded and the remaining weights are
 * rescaled — a skipped criterion never reads as a zero, in the UI or on the
 * server.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { User, Star, CheckCircle, Loader2, AlertTriangle, Briefcase, Calendar, Scale, MessageSquareText, ChevronDown } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const today = () => new Date().toISOString().slice(0, 10);

const ROUNDS = [
  ['screening', 'مبدئية'], ['technical', 'فنية'], ['hr', 'موارد بشرية'], ['final', 'نهائية'],
];
const RECOMMENDATIONS = [
  ['strong_yes', 'أرشّحه بقوة', 'bg-emerald-600'], ['yes', 'أرشّحه', 'bg-emerald-500'],
  ['neutral', 'محايد', 'bg-slate-400'], ['no', 'لا أرشّحه', 'bg-red-500'],
  ['strong_no', 'أرفضه بقوة', 'bg-red-600'],
];
const SCALE = { 1: 'ضعيف جداً', 2: 'ضعيف', 3: 'مقبول', 4: 'جيد', 5: 'ممتاز' };
const CATEGORY_LABEL = {
  technical: 'فني', soft_skills: 'شخصي', experience: 'خبرة',
  culture_fit: 'توافق', language: 'لغة', other: 'أخرى',
};

export default function InterviewScorecard({ candidateId, jobProfileId, onSubmitted }) {
  const [candidate, setCandidate] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [scores, setScores] = useState({});          // { criterion_key: 1..5 }
  const [notes, setNotes] = useState({});
  const [form, setForm] = useState({ round_name: 'technical', interview_date: today(), strengths: '', concerns: '', recommendation: 'neutral' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  // the question bank, shown under the criterion each question tests —
  // it used to be built on its own tab and never shown in the interview
  const [questions, setQuestions] = useState([]);
  const [openQs, setOpenQs] = useState({});           // criterion key -> expanded
  const [showAnswer, setShowAnswer] = useState({});   // question id -> model answer shown
  const [qBusy, setQBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [c, p] = await Promise.all([
        axios.get(`${API}/api/interviews/candidates`, { ...auth(), params: { job_profile_id: jobProfileId } }),
        axios.get(`${API}/api/interviews/job-profiles/${jobProfileId}`, auth()),
      ]);
      setCandidate((c.data.candidates || []).find((x) => x.id === candidateId) || null);
      setProfile(p.data);
      try {
        const q = await axios.get(`${API}/api/interviews/questions`, { ...auth(), params: { limit: 500 } });
        // general questions (no role/department) fit every job; specific ones only theirs
        setQuestions((q.data.questions || []).filter((x) =>
          (!x.role || x.role === p.data.title) && (!x.department || x.department === p.data.department)));
      } catch { setQuestions([]); }
    } catch (e) {
      setLoadError(e.response?.data?.detail || 'تعذّر تحميل بيانات المقابلة');
    }
  }, [candidateId, jobProfileId]);
  useEffect(() => { load(); }, [load]);

  // live weighted score — same rule as the server: rescale over rated criteria
  const { total, ratedWeight, contributions } = useMemo(() => {
    const criteria = profile?.criteria || [];
    const rated = criteria.filter((c) => scores[c.key]);
    const w = rated.reduce((s, c) => s + c.weight, 0);
    const contrib = {};
    let t = 0;
    rated.forEach((c) => {
      const share = w ? (c.weight / w) * 100 : 0;
      const value = share * (scores[c.key] / 5);
      contrib[c.key] = Math.round(value * 10) / 10;
      t += value;
    });
    return { total: Math.round(t * 10) / 10, ratedWeight: w, contributions: contrib };
  }, [profile, scores]);

  const criteria = profile?.criteria || [];
  const byCategory = useMemo(() => {
    const m = {};
    questions.forEach((q) => { (m[q.category] = m[q.category] || []).push(q); });
    return m;
  }, [questions]);
  const usedCategories = new Set(criteria.map((c) => c.category));
  const otherQuestions = questions.filter((q) => !usedCategories.has(q.category));

  const loadDefaultQuestions = async () => {
    setQBusy(true);
    try {
      const { data } = await axios.post(`${API}/api/interviews/questions/load-defaults`, {}, auth());
      setMsg({ type: 'ok', text: data.message });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر إضافة الأسئلة' });
    } finally { setQBusy(false); }
  };

  const QuestionList = ({ list }) => (
    <ol className="mt-2 space-y-2 list-decimal ps-5 text-sm">
      {list.map((q) => (
        <li key={q.id} className="leading-7">
          <span className="text-slate-800">{q.question}</span>
          {(q.expected_answer || (q.evaluation_criteria || []).length > 0) && (
            <button type="button" onClick={() => setShowAnswer((a) => ({ ...a, [q.id]: !a[q.id] }))}
              className="ms-2 text-xs text-[#1e3a8a] font-semibold">
              {showAnswer[q.id] ? 'إخفاء الإجابة النموذجية' : 'الإجابة النموذجية'}
            </button>
          )}
          {showAnswer[q.id] && (
            <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-6">
              {q.expected_answer && <p>{q.expected_answer}</p>}
              {(q.evaluation_criteria || []).length > 0 && (
                <p className="mt-1"><b>ما يبيّنه الجواب الجيد:</b> {q.evaluation_criteria.join('، ')}</p>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );

  const allRated = criteria.length > 0 && criteria.every((c) => scores[c.key]);
  const passing = profile?.passing_score ?? 70;

  const submit = async () => {
    if (!allRated) { setMsg({ type: 'err', text: 'قيّم كل المعايير قبل الإرسال' }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/interviews/evaluations`, {
        candidate_id: candidateId,
        job_profile_id: jobProfileId,
        round_name: form.round_name,
        interview_date: form.interview_date,
        strengths: form.strengths || null,
        concerns: form.concerns || null,
        recommendation: form.recommendation,
        scores: criteria.map((c) => ({ criterion_key: c.key, score: scores[c.key], note: notes[c.key] || null })),
      }, auth());
      setMsg({ type: 'ok', text: `${data.message} — درجتك ${data.evaluation.weighted_score}` });
      onSubmitted?.(data.evaluation);
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر حفظ التقييم' });
    } finally { setBusy(false); }
  };

  if (loadError) return (
    <div className="p-8 text-center text-sm text-slate-600" dir="rtl">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" aria-hidden />
      <p>{loadError}</p>
      <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white">إعادة المحاولة</button>
    </div>
  );
  if (!profile) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-4 md:p-6 space-y-5 text-slate-800">
      {/* Candidate */}
      <header className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center">
            <User className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{candidate?.name || 'المرشح'}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" aria-hidden />{profile.title}
              {profile.department ? ` — ${profile.department}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="text-xs text-slate-500">نوع المقابلة
            <select value={form.round_name} onChange={(e) => setForm({ ...form, round_name: e.target.value })}
              className="block mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800">
              {ROUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <label className="text-xs text-slate-500">التاريخ
            <input type="date" value={form.interview_date} onChange={(e) => setForm({ ...form, interview_date: e.target.value })}
              className="block mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" /></label>
        </div>
      </header>

      {/* Question guide */}
      {questions.length === 0 ? (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><MessageSquareText className="w-4 h-4 shrink-0" aria-hidden />
            لا توجد أسئلة مقابلة لهذه الوظيفة بعد. أضف المجموعة العامة (14 سؤالاً) أو أضف أسئلة خاصة من «بنك الأسئلة».</span>
          <button onClick={loadDefaultQuestions} disabled={qBusy}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50 min-h-[44px]">
            {qBusy ? 'جارٍ الإضافة…' : 'إضافة الأسئلة العامة'}
          </button>
        </section>
      ) : otherQuestions.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <button type="button" onClick={() => setOpenQs((o) => ({ ...o, __other: !o.__other }))}
            className="w-full flex items-center justify-between font-bold text-slate-900">
            <span className="flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-[#1e3a8a]" aria-hidden />أسئلة عامة ({otherQuestions.length})</span>
            <ChevronDown className={`w-4 h-4 transition ${openQs.__other ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {openQs.__other && <QuestionList list={otherQuestions} />}
        </section>
      )}

      {/* Criteria */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        <h2 className="px-5 py-3 font-bold text-slate-900 flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#1e3a8a]" aria-hidden />معايير التقييم
          <span className="text-xs font-normal text-slate-500">— الأوزان كما حددتها الوظيفة</span>
        </h2>
        {criteria.map((c) => (
          <div key={c.key} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{c.label}
                  <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{CATEGORY_LABEL[c.category] || c.category}</span>
                  <span className="ms-2 text-xs text-slate-500 tabular-nums">الوزن {c.weight}%</span>
                </p>
                {c.guidance && <p className="text-xs text-slate-500 mt-0.5">{c.guidance}</p>}
                {(byCategory[c.category] || []).length > 0 && (
                  <button type="button" onClick={() => setOpenQs((o) => ({ ...o, [c.key]: !o[c.key] }))}
                    aria-expanded={!!openQs[c.key]}
                    className="mt-1 text-xs font-semibold text-[#1e3a8a] flex items-center gap-1">
                    <MessageSquareText className="w-3.5 h-3.5" aria-hidden />
                    أسئلة مقترحة ({byCategory[c.category].length})
                    <ChevronDown className={`w-3.5 h-3.5 transition ${openQs[c.key] ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1" role="radiogroup" aria-label={c.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={scores[c.key] === n}
                    aria-label={`${n} — ${SCALE[n]}`} title={SCALE[n]}
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    className={`p-1.5 rounded-lg transition ${scores[c.key] >= n ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'}`}>
                    <Star className="w-6 h-6" fill={scores[c.key] >= n ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                ))}
                <span className="w-24 text-xs text-slate-500 tabular-nums">
                  {scores[c.key] ? `${SCALE[scores[c.key]]} · +${contributions[c.key] ?? 0}` : 'لم يُقيَّم'}
                </span>
              </div>
            </div>
            <input value={notes[c.key] || ''} onChange={(e) => setNotes((n) => ({ ...n, [c.key]: e.target.value }))}
              placeholder="ملاحظة (اختياري)" aria-label={`ملاحظة على ${c.label}`}
              className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            {openQs[c.key] && <QuestionList list={byCategory[c.category] || []} />}
          </div>
        ))}
      </section>

      {/* Live total */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">الدرجة الموزونة (تتحدث أثناء التقييم)</p>
            <p className={`text-4xl font-extrabold tabular-nums ${total >= passing ? 'text-emerald-600' : 'text-slate-900'}`}>
              {total.toLocaleString('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span className="text-base font-semibold text-slate-400"> / 100</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {allRated
                ? (total >= passing ? `فوق حد النجاح (${passing})` : `تحت حد النجاح (${passing})`)
                : `قيّمت ${ratedWeight}% من الأوزان — الدرجة محسوبة على ما قيّمته فقط`}
            </p>
          </div>
          <div className="h-3 flex-1 min-w-[180px] rounded-full bg-slate-100 overflow-hidden" role="progressbar"
            aria-valuenow={Math.round(total)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${total >= passing ? 'bg-emerald-500' : 'bg-[#1e3a8a]'}`} style={{ width: `${Math.min(total, 100)}%` }} />
          </div>
        </div>
      </section>

      {/* Notes and recommendation */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 grid sm:grid-cols-2 gap-4 text-sm">
        <label><span className="text-slate-600">نقاط القوة</span>
          <textarea rows={3} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
        <label><span className="text-slate-600">التحفظات</span>
          <textarea rows={3} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg" /></label>
        <div className="sm:col-span-2">
          <p className="text-slate-600 mb-2">التوصية</p>
          <div className="flex flex-wrap gap-2">
            {RECOMMENDATIONS.map(([v, l, color]) => (
              <button key={v} type="button" onClick={() => setForm({ ...form, recommendation: v })}
                aria-pressed={form.recommendation === v}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
                  form.recommendation === v ? `${color} text-white border-transparent` : 'bg-white border-slate-300 text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>
        <button onClick={submit} disabled={busy || !allRated}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckCircle className="w-4 h-4" aria-hidden />}
          {busy ? 'جارٍ الحفظ…' : 'إرسال التقييم'}
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500">
        <Calendar className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
        <p>يمكنك تعديل تقييمك لاحقاً بإعادة الإرسال لنفس المقابلة — لا يُنشأ تقييم مكرر، والدرجة النهائية للمرشح هي متوسط تقييمات المُقيِّمين موزوناً بأوزان الوظيفة.</p>
      </div>
    </div>
  );
}
