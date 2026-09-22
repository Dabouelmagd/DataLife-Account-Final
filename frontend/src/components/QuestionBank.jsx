/**
 * بنك الأسئلة — interview questions by department, role, category and level.
 *
 * AI suggestions are proposals only: they appear in a review list where each
 * one can be edited, kept or dropped, and nothing reaches the bank until the
 * recruiter saves it. If the AI is unavailable the screen says so plainly and
 * everything else keeps working.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Plus, X, Loader2, Sparkles, Check, AlertTriangle, MessageSquareQuote } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const CATEGORIES = [
  ['technical', 'فني'], ['soft_skills', 'شخصي'], ['experience', 'خبرة'],
  ['culture_fit', 'توافق'], ['language', 'لغة'], ['other', 'أخرى'],
];
const LEVELS = [['junior', 'مبتدئ'], ['mid', 'متوسط'], ['senior', 'خبير']];
const label = (list, v) => list.find(([k]) => k === v)?.[1] || v;
const EMPTY = { question: '', category: 'technical', difficulty: 'mid', department: '', role: '', expected_answer: '' };

export default function QuestionBank({ jobs = [] }) {
  const [questions, setQuestions] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', difficulty: '', role: '' });
  const [form, setForm] = useState(null);
  const [ai, setAi] = useState(null);          // { job_title, experience_level, department, focus }
  const [suggested, setSuggested] = useState(null);   // review list before saving
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await axios.get(`${API}/api/interviews/questions`, { ...auth(), params });
      setQuestions(data.questions || []);
    } catch (e) { setQuestions([]); setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر تحميل الأسئلة' }); }
  }, [filters]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const saveOne = async () => {
    if (form.question.trim().length < 5) { setMsg({ type: 'err', text: 'اكتب نص السؤال' }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.post(`${API}/api/interviews/questions`, {
        company_id: 'from-token', ...form,
        question: form.question.trim(), department: form.department || null,
        role: form.role || null, expected_answer: form.expected_answer || null,
      }, auth());
      setForm(null); await load();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || 'تعذّر حفظ السؤال' }); }
    finally { setBusy(false); }
  };

  const suggest = async () => {
    if (!ai.job_title.trim()) { setMsg({ type: 'err', text: 'اكتب المسمى الوظيفي' }); return; }
    setBusy(true); setMsg({ type: '', text: '' }); setSuggested(null);
    try {
      const { data } = await axios.post(`${API}/api/interviews/questions/suggest`, {
        job_title: ai.job_title.trim(), experience_level: ai.experience_level,
        department: ai.department || null, focus: ai.focus || null,
      }, auth());
      if (!data.ok) { setMsg({ type: 'err', text: data.reason || 'تعذّر اقتراح الأسئلة' }); return; }
      setSuggested(data.questions.map((q) => ({ ...q, keep: true, role: ai.job_title.trim(), department: ai.department || '' })));
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || 'تعذّر الاتصال بخدمة الاقتراح' }); }
    finally { setBusy(false); }
  };

  const saveSuggested = async () => {
    const keep = suggested.filter((q) => q.keep && q.question.trim());
    if (!keep.length) { setMsg({ type: 'err', text: 'لم تختر أي سؤال' }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/api/interviews/questions/bulk`, {
        questions: keep.map((q) => ({
          question: q.question.trim(), category: q.category, difficulty: q.difficulty,
          role: q.role || null, department: q.department || null,
          expected_answer: q.expected_answer || null,
          evaluation_criteria: q.evaluation_criteria || [], source: 'ai',
        })),
      }, auth());
      setSuggested(null); setAi(null); setMsg({ type: 'ok', text: data.message }); await load();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || 'تعذّر حفظ الأسئلة' }); }
    finally { setBusy(false); }
  };

  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-[#1e3a8a]" aria-hidden />بنك الأسئلة
        </h2>
        <div className="flex gap-2">
          <button onClick={() => { setAi({ job_title: jobs[0]?.title || '', experience_level: 'mid', department: jobs[0]?.department || '', focus: '' }); setSuggested(null); setMsg({ type: '', text: '' }); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1e3a8a] text-[#1e3a8a] font-semibold">
            <Sparkles className="w-4 h-4" aria-hidden />اقتراح بالذكاء الاصطناعي
          </button>
          <button onClick={() => { setForm({ ...EMPTY }); setMsg({ type: '', text: '' }); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold">
            <Plus className="w-4 h-4" aria-hidden />سؤال جديد
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <label className="relative flex-1 min-w-[200px]">
          <span className="sr-only">بحث</span>
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
          <input type="search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="ابحث في نص الأسئلة" className="w-full ps-9 pe-3 py-2 border border-slate-300 rounded-lg bg-white" />
        </label>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          aria-label="التصنيف" className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
          <option value="">كل التصنيفات</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
          aria-label="المستوى" className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
          <option value="">كل المستويات</option>
          {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          aria-label="الوظيفة" className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
          <option value="">كل الوظائف</option>
          {[...new Set(jobs.map((j) => j.title))].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      {questions === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : questions.length === 0 ? (
        <p className={`${card} p-10 text-center text-slate-600`}>لا توجد أسئلة مطابقة — أضف سؤالاً أو اطلب اقتراحات.</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className={`${card} p-4`}>
              <p className="font-semibold text-slate-900">{q.question}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label(CATEGORIES, q.category)}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label(LEVELS, q.difficulty)}</span>
                {q.role && <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{q.role}</span>}
                {q.department && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{q.department}</span>}
                {q.source === 'ai' && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">مُقترح بالذكاء الاصطناعي</span>}
              </div>
              {q.expected_answer && <p className="mt-2 text-sm text-slate-600"><b>الإجابة المتوقعة:</b> {q.expected_answer}</p>}
              {q.evaluation_criteria?.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">يقيس: {q.evaluation_criteria.join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* manual question */}
      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold">سؤال جديد</h3>
              <button onClick={() => setForm(null)} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-slate-600">نص السؤال *</span>
                <textarea autoFocus rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">التصنيف</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${input} bg-white`}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label><span className="text-slate-600">المستوى</span>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={`${input} bg-white`}>
                  {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label><span className="text-slate-600">الوظيفة</span>
                <input list="rec-jobs" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={input} />
                <datalist id="rec-jobs">{[...new Set(jobs.map((j) => j.title))].map((t) => <option key={t} value={t} />)}</datalist></label>
              <label><span className="text-slate-600">القسم</span>
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={input} /></label>
              <label className="sm:col-span-2"><span className="text-slate-600">الإجابة المتوقعة</span>
                <textarea rows={2} value={form.expected_answer} onChange={(e) => setForm({ ...form, expected_answer: e.target.value })} className={input} /></label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300">إلغاء</button>
              <button onClick={saveOne} disabled={busy} className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* AI suggestions — reviewed before anything is saved */}
      {ai && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" aria-hidden />اقتراح أسئلة</h3>
              <button onClick={() => { setAi(null); setSuggested(null); }} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm border-b border-slate-100">
              <label><span className="text-slate-600">المسمى الوظيفي *</span>
                <input list="rec-jobs-ai" value={ai.job_title} onChange={(e) => setAi({ ...ai, job_title: e.target.value })} className={input} />
                <datalist id="rec-jobs-ai">{[...new Set(jobs.map((j) => j.title))].map((t) => <option key={t} value={t} />)}</datalist></label>
              <label><span className="text-slate-600">مستوى الخبرة</span>
                <select value={ai.experience_level} onChange={(e) => setAi({ ...ai, experience_level: e.target.value })} className={`${input} bg-white`}>
                  {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label><span className="text-slate-600">القسم</span>
                <input value={ai.department} onChange={(e) => setAi({ ...ai, department: e.target.value })} className={input} /></label>
              <label><span className="text-slate-600">ركّز على (اختياري)</span>
                <input value={ai.focus} onChange={(e) => setAi({ ...ai, focus: e.target.value })} placeholder="مثال: المعايير المصرية، Excel" className={input} /></label>
              <div className="sm:col-span-2 flex justify-end">
                <button onClick={suggest} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
                  {suggested ? 'اقتراح أسئلة أخرى' : 'اقترح 5 أسئلة'}
                </button>
              </div>
            </div>

            {msg.text && msg.type === 'err' && (
              <p className="mx-5 mt-3 text-sm text-red-700 flex items-start gap-1.5" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{msg.text}
              </p>
            )}

            {suggested && (
              <>
                <p className="px-5 pt-4 text-xs text-slate-500">راجع الأسئلة وعدّلها، وألغِ اختيار ما لا تريده — لا يُحفظ شيء إلا بعد الضغط على حفظ.</p>
                <ul className="p-5 space-y-3">
                  {suggested.map((q, i) => (
                    <li key={i} className={`border rounded-xl p-4 ${q.keep ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 opacity-60'}`}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={q.keep} className="mt-1"
                          onChange={(e) => setSuggested(suggested.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))} />
                        <textarea rows={2} value={q.question}
                          onChange={(e) => setSuggested(suggested.map((x, j) => j === i ? { ...x, question: e.target.value } : x))}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <select value={q.category} aria-label="التصنيف"
                          onChange={(e) => setSuggested(suggested.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                          className="px-2 py-1 border border-slate-300 rounded bg-white">
                          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <select value={q.difficulty} aria-label="المستوى"
                          onChange={(e) => setSuggested(suggested.map((x, j) => j === i ? { ...x, difficulty: e.target.value } : x))}
                          className="px-2 py-1 border border-slate-300 rounded bg-white">
                          {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      {q.expected_answer && <p className="mt-2 text-xs text-slate-600"><b>الإجابة المتوقعة:</b> {q.expected_answer}</p>}
                      {q.evaluation_criteria?.length > 0 && <p className="mt-1 text-xs text-slate-500">يقيس: {q.evaluation_criteria.join(' · ')}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="sticky bottom-0 bg-white flex justify-between items-center gap-2 px-5 py-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">{suggested ? `${suggested.filter((q) => q.keep).length} من ${suggested.length} مختارة` : ''}</span>
              <div className="flex gap-2">
                <button onClick={() => { setAi(null); setSuggested(null); }} className="px-4 py-2 rounded-lg border border-slate-300">إغلاق</button>
                {suggested && (
                  <button onClick={saveSuggested} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-bold disabled:opacity-50">
                    <Check className="w-4 h-4" aria-hidden />حفظ المختارة
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
