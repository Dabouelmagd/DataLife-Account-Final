/**
 * تقرير المرشح — للمدير صاحب قرار التعيين.
 *
 * The personality panel is deliberately styled as context, not as a score:
 * no number, no colour that reads as pass or fail, and the caveat sits next
 * to it rather than in a footnote. An instrument that does not predict job
 * performance should not look on screen like one that does.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FileDown, Sparkles, Loader2, UserRound, Brain, Target, Users,
  AlertTriangle, CheckCircle2, XCircle, ClipboardList, Info,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const AREA_LABELS = {
  numerical: 'عددي', verbal: 'لفظي', logical: 'منطقي',
  attention: 'دقة ملاحظة', situational: 'مواقف عملية',
};
const AXIS_LABELS = { EI: 'انبساط / انطواء', SN: 'حسّي / حدسي', TF: 'تفكير / وجدان', JP: 'حاسم / مرن' };

const verdictStyle = (verdict = '') => {
  if (verdict.includes('لا يُرشَّح')) return { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle };
  if (verdict.includes('تحفظات')) return { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle };
  if (verdict.includes('يُرشَّح')) return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 };
  return { cls: 'bg-slate-50 text-slate-700 border-slate-200', Icon: Info };
};

export default function CandidateReportDashboard({ candidateId, language = 'ar' }) {
  const ar = language === 'ar';
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!candidateId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.get(`${API}/api/assessments/report/${candidateId}`, auth());
      setReport(data);
    } catch (e) {
      setError(e.response?.data?.detail || (ar ? 'تعذّر تحميل التقرير' : 'Could not load the report'));
    } finally { setLoading(false); }
  }, [candidateId, ar]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/assessments/reports`, auth());
      setHistory(data.reports || []);
    } catch { /* the history list is secondary; its absence must not blank the page */ }
  }, []);

  useEffect(() => { load(); loadHistory(); }, [load, loadHistory]);

  const generateSummary = async () => {
    setAiBusy(true); setError('');
    try {
      const { data } = await axios.get(
        `${API}/api/assessments/report/${candidateId}?with_ai=true`, auth());
      setReport(data);
      if (data.ai_error) setError(data.ai_error);
    } catch (e) {
      setError(e.response?.data?.detail || (ar ? 'تعذّر توليد الملخص' : 'Could not generate the summary'));
    } finally { setAiBusy(false); }
  };

  const downloadPdf = async () => {
    setPdfBusy(true); setError('');
    try {
      const res = await axios.get(
        `${API}/api/assessments/report/${candidateId}/pdf?with_ai=${report?.ai_summary ? 'true' : 'false'}`,
        { ...auth(), responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير-${report?.candidate_name || candidateId}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(ar ? 'تعذّر تنزيل الملف' : 'Could not download the file');
    } finally { setPdfBusy(false); }
  };

  // interview criteria + aptitude areas on one comparable scale (out of 10)
  const radarData = useMemo(() => {
    if (!report) return [];
    const fromInterview = (report.interview_breakdown || []).map((b) => ({
      area: b.label, score: Number((b.avg_score * 2).toFixed(2)), source: 'interview',
    }));
    const fromAptitude = Object.entries(report.area_scores || {}).map(([k, v]) => ({
      area: AREA_LABELS[k] || k, score: Number(v), source: 'aptitude',
    }));
    return [...fromInterview, ...fromAptitude];
  }, [report]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }
  if (!report) {
    return (
      <div className="p-8 text-center text-slate-600" dir={ar ? 'rtl' : 'ltr'}>
        {error || (ar ? 'لا يوجد تقرير لهذا المرشح بعد' : 'No report yet')}
      </div>
    );
  }

  const { cls: verdictCls, Icon: VerdictIcon } = verdictStyle(report.recommendation);
  const card = 'bg-white rounded-2xl border border-slate-200 p-5';

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4 text-slate-800">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <UserRound className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
            {report.candidate_name}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {report.job_title || (ar ? 'بدون وظيفة محددة' : 'No role set')}
            {report.interviewers_count > 0 && (
              <span className="ms-2 text-slate-400">
                · {report.interviewers_count} {ar ? 'مُقيِّم' : 'raters'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateSummary} disabled={aiBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold disabled:opacity-50">
            {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
            {ar ? 'ملخص المدير' : 'Manager summary'}
          </button>
          <button onClick={downloadPdf} disabled={pdfBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileDown className="w-4 h-4" aria-hidden />}
            {ar ? 'تنزيل PDF' : 'Download PDF'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      {/* the decision line */}
      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${verdictCls}`}>
        <VerdictIcon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-bold">{report.recommendation}</p>
          <p className="text-sm mt-0.5 opacity-90">
            {ar ? `حد النجاح ${report.passing_score} من 100 — محسوبة من المقابلات والقدرات فقط`
                : `Pass mark ${report.passing_score}/100 — from interviews and aptitude only`}
          </p>
        </div>
      </div>

      {/* headline numbers */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat icon={Users} label={ar ? 'درجة المقابلات' : 'Interviews'}
              value={report.interview_score != null ? `${report.interview_score}` : '—'}
              suffix={ar ? 'من 100' : '/100'} />
        <Stat icon={Target} label={ar ? 'اختبار القدرات' : 'Aptitude'}
              value={report.aptitude_score != null ? `${report.aptitude_score}` : '—'}
              suffix={ar ? 'من 10' : '/10'} />
        <Stat icon={ClipboardList} label={ar ? 'التوصيات' : 'Recommendations'}
              value={Object.entries(report.recommendations || {}).map(([k, v]) => `${v}`).join(' / ') || '—'}
              suffix={Object.keys(report.recommendations || {}).join(' / ') || ''} />
      </div>

      {/* comparison across areas */}
      {radarData.length >= 3 && (
        <section className={card}>
          <h3 className="font-bold mb-2">{ar ? 'المقارنة بين المجالات (من 10)' : 'Across areas (out of 10)'}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="area" tick={{ fontSize: 12, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Radar name={report.candidate_name} dataKey="score"
                       stroke="#1e3a8a" fill="#1e3a8a" fillOpacity={0.25} />
                <Tooltip formatter={(v) => [`${v} / 10`, ar ? 'الدرجة' : 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {ar ? 'درجات المقابلة (من 5) محوّلة إلى مقياس 10 للمقارنة.' : 'Interview scores rescaled to 10.'}
          </p>
        </section>
      )}

      {/* aptitude detail */}
      {Object.keys(report.area_scores || {}).length > 0 && (
        <section className={card}>
          <h3 className="font-bold mb-2">{ar ? 'تفصيل القدرات' : 'Aptitude detail'}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(report.area_scores).map(([k, v]) => ({
                area: AREA_LABELS[k] || k, score: Number(v) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="area" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => [`${v} / 10`, ar ? 'الدرجة' : 'Score']} />
                <Bar dataKey="score" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* personality — context, not a score */}
      {report.personality_type && (
        <section className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h3 className="font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-slate-500" aria-hidden />
              {ar ? 'ملف الشخصية' : 'Personality profile'}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                {ar ? 'استرشادي' : 'Advisory'}
              </span>
            </h3>
            <span className="font-mono text-2xl font-extrabold text-slate-700 tracking-widest">
              {report.personality_type}
            </span>
          </div>
          <p className="mt-1 text-slate-700 font-semibold">{report.personality_label}</p>
          {report.personality_traits?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {report.personality_traits.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">{t}</span>
              ))}
            </div>
          )}
          {Object.keys(report.personality_clarity || {}).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {Object.entries(report.personality_clarity).map(([axis, pct]) => (
                <div key={axis} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-slate-500 shrink-0">{AXIS_LABELS[axis] || axis}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="w-12 text-end tabular-nums text-slate-500">{pct}%</span>
                </div>
              ))}
              <p className="text-xs text-slate-500 pt-1">
                {ar ? 'النسبة تعني مدى حسم الإجابات لهذا المحور — النسبة المنخفضة تعني أن الحرف شبه عشوائي.'
                    : 'How decisively the answers settled each axis.'}
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            {ar ? 'لم تدخل هذه النتيجة في أي درجة أو توصية. أدوات أنماط الشخصية لا تتنبأ بالأداء الوظيفي وقد تعطي نمطاً مختلفاً عند إعادة الاختبار، فاستخدمها لفهم أسلوب العمل المفضّل فقط — لا لقبول مرشح أو رفضه.'
                : 'Not part of any score or recommendation. These instruments do not predict job performance and often re-test to a different type — use it to understand working style, never to accept or reject.'}
          </p>
        </section>
      )}

      {/* what the raters said */}
      {(report.strengths_notes?.length > 0 || report.concerns_notes?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NoteList title={ar ? 'نقاط القوة' : 'Strengths'} items={report.strengths_notes}
                    tone="emerald" empty={ar ? 'لم تُذكر' : 'None'} />
          <NoteList title={ar ? 'التحفظات' : 'Concerns'} items={report.concerns_notes}
                    tone="amber" empty={ar ? 'لم تُذكر' : 'None'} />
        </div>
      )}

      {/* AI summary */}
      {report.ai_summary && (
        <section className={card}>
          <h3 className="font-bold flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#1e3a8a]" aria-hidden />
            {ar ? 'ملخص المدير' : 'Manager summary'}
          </h3>
          <div className="text-sm leading-7 whitespace-pre-line text-slate-700">{report.ai_summary}</div>
          <p className="mt-2 text-xs text-slate-500">
            {ar ? 'ملخص مُولَّد آلياً — يُقرأ كمساعدة لا كبديل عن قراءة التقرير.' : 'Generated; read alongside the report, not instead of it.'}
          </p>
        </section>
      )}

      {/* history */}
      {history.length > 0 && (
        <section className={card}>
          <h3 className="font-bold mb-2">{ar ? 'تقارير سابقة' : 'Previous reports'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 border-b border-slate-200">
                <th scope="col" className="py-2 text-start font-semibold">{ar ? 'المرشح' : 'Candidate'}</th>
                <th scope="col" className="py-2 text-start font-semibold">{ar ? 'الوظيفة' : 'Role'}</th>
                <th scope="col" className="py-2 text-end font-semibold">{ar ? 'المقابلات' : 'Interview'}</th>
                <th scope="col" className="py-2 text-end font-semibold">{ar ? 'القدرات' : 'Aptitude'}</th>
                <th scope="col" className="py-2 text-end font-semibold">{ar ? 'التوصية' : 'Verdict'}</th>
              </tr></thead>
              <tbody>
                {history.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 font-semibold">{r.candidate_name}</td>
                    <td className="py-2 text-slate-600">{r.job_title || '—'}</td>
                    <td className="py-2 text-end tabular-nums">{r.interview_score ?? '—'}</td>
                    <td className="py-2 text-end tabular-nums">{r.aptitude_score ?? '—'}</td>
                    <td className="py-2 text-end text-slate-600">{r.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, suffix }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Icon className="w-4 h-4" aria-hidden />{label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {value}<span className="text-sm font-normal text-slate-400 ms-1">{suffix}</span>
      </p>
    </div>
  );
}

function NoteList({ title, items = [], tone, empty }) {
  const tones = { emerald: 'border-emerald-200 bg-emerald-50/40', amber: 'border-amber-200 bg-amber-50/40' };
  return (
    <section className={`rounded-2xl border p-4 ${tones[tone] || 'border-slate-200'}`}>
      <h3 className="font-bold mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {items.map((t, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{t}</span></li>)}
        </ul>
      )}
    </section>
  );
}
