/**
 * الاختبار النفسي واختبار القدرات — من صفحة المرشح.
 *
 * The scoring, the report and the PDF existed, but nothing let a candidate
 * sit the test: no screen asked the questions, and a new company had no
 * questions to ask. This is that screen. HR opens it for the candidate (on
 * HR's device or handed over), the candidate answers one question at a time,
 * and the answers go to /api/assessments/submit.
 *
 * The paper never carries the answer key or the personality poles — the
 * server strips them — so nothing on this screen can reveal a "right" answer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Brain, Target, Loader2, ChevronRight, ChevronLeft, CheckCircle2, Info, RotateCcw } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

const KINDS = {
  psychometric: {
    title: 'اختبار الشخصية', Icon: Brain,
    intro: 'لا توجد إجابة صحيحة أو خاطئة. اختر ما يصفك فعلاً لا ما تظن أنه مطلوب. النتيجة استرشادية ولا تُستخدم كمعيار قبول أو رفض.',
  },
  aptitude: {
    title: 'اختبار القدرات', Icon: Target,
    intro: 'لكل سؤال إجابة واحدة صحيحة. أجب عن كل الأسئلة؛ لا يمكن التسليم قبل ذلك.',
  },
};

export default function CandidateAssessments({ candidate, onOpenReport }) {
  const [summary, setSummary] = useState(null);          // {psychometric: n, aptitude: n}
  const [results, setResults] = useState({});            // kind -> latest result
  const [paper, setPaper] = useState(null);              // {kind, questions}
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        axios.get(`${API}/api/assessments/questions/summary`, auth()),
        axios.get(`${API}/api/assessments/candidates/${candidate.id}`, auth()),
      ]);
      setSummary(s.data);
      const latest = {};
      (r.data.assessments || []).forEach((a) => { if (!latest[a.kind]) latest[a.kind] = a; });
      setResults(latest);
    } catch (e) {
      setMsg({ type: 'err', text: errText(e, 'تعذّر تحميل بيانات الاختبارات') });
    }
  }, [candidate.id]);

  useEffect(() => { load(); }, [load]);

  const loadDefaults = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/api/assessments/questions/load-defaults`, {}, auth());
      setMsg({ type: 'ok', text: data.message });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: errText(e, 'تعذّر إضافة الأسئلة') });
    } finally { setBusy(false); }
  };

  const start = async (kind) => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.get(`${API}/api/assessments/paper/${candidate.id}`, { ...auth(), params: { kind } });
      if (!data.questions?.length) {
        setMsg({ type: 'err', text: 'لا توجد أسئلة لهذا الاختبار بعد — أضف الأسئلة الافتراضية أولاً.' });
        return;
      }
      // options are shown in a fresh random order each sitting, so the
      // position of the right answer tells the candidate nothing
      const shuffle = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      setPaper({ kind, questions: data.questions.map((q) => ({ ...q, options: shuffle(q.options) })) });
      setAnswers({}); setIndex(0); setStartedAt(new Date().toISOString());
    } catch (e) {
      setMsg({ type: 'err', text: errText(e, 'تعذّر فتح الاختبار') });
    } finally { setBusy(false); }
  };

  const submit = async () => {
    const qs = paper.questions;
    const missing = qs.findIndex((q) => !answers[q.id]);
    if (missing !== -1) { setIndex(missing); setMsg({ type: 'err', text: `السؤال ${missing + 1} بلا إجابة` }); return; }
    setBusy(true);
    try {
      const duration = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
      await axios.post(`${API}/api/assessments/submit`, {
        candidate_id: candidate.id, kind: paper.kind, started_at: startedAt, duration_seconds: duration,
        answers: qs.map((q) => ({ question_id: q.id, option_key: answers[q.id] })),
      }, auth());
      setPaper(null);
      setMsg({ type: 'ok', text: `تم تسليم ${KINDS[paper.kind].title} — النتيجة في التقرير الشامل` });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: errText(e, 'تعذّر تسليم الإجابات') });
    } finally { setBusy(false); }
  };

  const card = 'bg-white border border-slate-200 rounded-xl';

  // ── taking a test ──────────────────────────────────────────────────────
  if (paper) {
    const qs = paper.questions;
    const q = qs[index];
    const answered = qs.filter((x) => answers[x.id]).length;
    const { title, Icon } = KINDS[paper.kind];
    return (
      <section className={`${card} p-4 md:p-6 space-y-4`} aria-label={title}>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold flex items-center gap-2"><Icon className="w-5 h-5 text-[#1e3a8a]" aria-hidden />{title} — {candidate.name}</h2>
          <span className="text-sm text-slate-600 tabular-nums">أُجيب {answered} من {qs.length}</span>
        </header>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" aria-hidden>
          <div className="h-full bg-[#1e3a8a] transition-all" style={{ width: `${(answered / qs.length) * 100}%` }} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-base font-bold text-slate-900 leading-8">
            <span className="text-slate-500 tabular-nums">{index + 1}. </span>{q.text}
          </legend>
          {q.options.map((o) => (
            <label key={o.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer min-h-[44px] ${answers[q.id] === o.key ? 'border-[#1e3a8a] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name={`q-${q.id}`} value={o.key} checked={answers[q.id] === o.key}
                onChange={() => setAnswers({ ...answers, [q.id]: o.key })} className="mt-1" />
              <span className="leading-7">{o.text}</span>
            </label>
          ))}
        </fieldset>

        {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-40 min-h-[44px]">
              <ChevronRight className="w-4 h-4" aria-hidden />السابق
            </button>
            {index < qs.length - 1 ? (
              <button onClick={() => setIndex(index + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold min-h-[44px]">
                التالي<ChevronLeft className="w-4 h-4" aria-hidden />
              </button>
            ) : (
              <button onClick={submit} disabled={busy}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50 min-h-[44px]">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckCircle2 className="w-4 h-4" aria-hidden />}تسليم الإجابات
              </button>
            )}
          </div>
          <button onClick={() => { if (window.confirm('الخروج من الاختبار؟ لن تُحفظ الإجابات.')) setPaper(null); }}
            className="text-sm text-slate-500 hover:text-red-700 min-h-[44px]">خروج دون حفظ</button>
        </div>
      </section>
    );
  }

  // ── overview on the candidate page ─────────────────────────────────────
  const noQuestions = summary && (!summary.psychometric || !summary.aptitude);
  return (
    <section className={`${card} p-4 md:p-5 space-y-3`} aria-label="التقييم النفسي والقدرات">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><Brain className="w-5 h-5 text-[#1e3a8a]" aria-hidden />التقييم النفسي والقدرات</h2>
        {onOpenReport && (results.psychometric || results.aptitude) && (
          <button onClick={onOpenReport} className="text-sm font-semibold text-[#1e3a8a]">عرض النتيجة في التقرير الشامل ←</button>
        )}
      </header>

      {summary === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {noQuestions && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <span className="flex items-center gap-2"><Info className="w-4 h-4 shrink-0" aria-hidden />
                بنك أسئلة التقييم فارغ{summary.psychometric ? ' لاختبار القدرات' : summary.aptitude ? ' لاختبار الشخصية' : ''}. أضف المجموعة الافتراضية (20 سؤال شخصية و15 سؤال قدرات) ويمكنك تعديلها لاحقاً.
              </span>
              <button onClick={loadDefaults} disabled={busy}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50 min-h-[44px]">
                {busy ? 'جارٍ الإضافة…' : 'إضافة الأسئلة الافتراضية'}
              </button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(KINDS).map(([kind, { title, Icon, intro }]) => {
              const r = results[kind];
              const count = summary[kind] || 0;
              return (
                <div key={kind} className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <h3 className="font-bold flex items-center gap-2"><Icon className="w-4 h-4 text-[#1e3a8a]" aria-hidden />{title}</h3>
                  <p className="text-xs text-slate-600 leading-6">{intro}</p>
                  {r ? (
                    <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" aria-hidden />
                      {kind === 'psychometric'
                        ? <>تم — النمط <b dir="ltr">{r.personality_type}</b></>
                        : <>تم — الدرجة <b className="tabular-nums">{r.aptitude_score}</b> من 10 ({r.correct_count}/{r.total_questions})</>}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">لم يُؤدَّ بعد · {count} سؤال</p>
                  )}
                  <button onClick={() => start(kind)} disabled={busy || !count}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-40 min-h-[44px]">
                    {r ? <><RotateCcw className="w-4 h-4" aria-hidden />إعادة الاختبار</> : 'بدء الاختبار'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
    </section>
  );
}
