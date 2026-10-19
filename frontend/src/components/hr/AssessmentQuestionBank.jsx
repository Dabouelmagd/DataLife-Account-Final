/**
 * بنك أسئلة التقييم النفسي واختبار القدرات — إدارة.
 *
 * Add, edit and remove the questions the candidate tests are built from.
 * The server validates every question as a whole (a personality item needs
 * an axis and a pole on each option; an aptitude item an area and a correct
 * option), so the form mirrors those rules and shows the server's reason
 * when one is broken.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Brain, Target, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const errText = (e, f) => (typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : f);

const AXES = {
  EI: ['انبساط / انطواء', 'E', 'I'], SN: ['حسّي / حدسي', 'S', 'N'],
  TF: ['تفكير / وجدان', 'T', 'F'], JP: ['حاسم / مرن', 'J', 'P'],
};
const POLE_LABEL = { E: 'انبساط', I: 'انطواء', S: 'حسّي', N: 'حدسي', T: 'تفكير', F: 'وجدان', J: 'حاسم', P: 'مرن' };
const AREAS = {
  numerical: 'عددي', verbal: 'لفظي', logical: 'منطقي', attention: 'دقة ملاحظة', situational: 'مواقف عملية',
};
const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

const blank = (kind) => (kind === 'psychometric'
  ? { kind, text: '', dichotomy: 'EI', options: [{ key: 'a', text: '', pole: 'E' }, { key: 'b', text: '', pole: 'I' }] }
  : { kind, text: '', area: 'numerical', correct_option: 'a',
      options: ['a', 'b', 'c', 'd'].map((k) => ({ key: k, text: '' })) });

export default function AssessmentQuestionBank() {
  const [kind, setKind] = useState('psychometric');
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);       // {id?, ...question}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data } = await axios.get(`${API}/api/assessments/questions`, { ...auth(), params: { kind, limit: 500 } });
      setRows(data.questions || []);
    } catch (e) { setRows([]); setMsg({ type: 'err', text: errText(e, 'تعذّر تحميل الأسئلة') }); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const loadDefaults = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/api/assessments/questions/load-defaults`, {}, auth());
      setMsg({ type: 'ok', text: data.message }); await load();
    } catch (e) { setMsg({ type: 'err', text: errText(e, 'تعذّر إضافة الأسئلة') }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    const body = { ...form, options: form.options.filter((o) => o.text.trim()) };
    try {
      if (form.id) await axios.put(`${API}/api/assessments/questions/${form.id}`, body, auth());
      else await axios.post(`${API}/api/assessments/questions`, { ...body, company_id: 'x' }, auth());
      setMsg({ type: 'ok', text: form.id ? 'تم تعديل السؤال' : 'تمت إضافة السؤال' });
      setForm(null); await load();
    } catch (e) {
      const d = e?.response?.data?.detail;
      setMsg({ type: 'err', text: Array.isArray(d) ? (d[0]?.msg || 'بيانات غير صالحة') : errText(e, 'تعذّر الحفظ') });
    } finally { setBusy(false); }
  };

  const remove = async (q) => {
    if (!window.confirm('حذف هذا السؤال من الاختبار؟ النتائج السابقة لا تتأثر.')) return;
    try {
      await axios.delete(`${API}/api/assessments/questions/${q.id}`, auth());
      setMsg({ type: 'ok', text: 'تم حذف السؤال' }); await load();
    } catch (e) { setMsg({ type: 'err', text: errText(e, 'تعذّر الحذف') }); }
  };

  const setOpt = (i, patch) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
  const input = 'mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';

  return (
    <section className="space-y-3" aria-label="أسئلة التقييم">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="tablist">
          {[['psychometric', 'أسئلة الشخصية', Brain], ['aptitude', 'أسئلة القدرات', Target]].map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setForm(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold ${kind === k ? 'bg-[#1e3a8a] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              <Icon className="w-4 h-4" aria-hidden />{l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {rows && rows.length === 0 && (
            <button onClick={loadDefaults} disabled={busy}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">إضافة الأسئلة الافتراضية</button>
          )}
          <button onClick={() => setForm(blank(kind))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" aria-hidden />سؤال جديد
          </button>
        </div>
      </div>

      {kind === 'psychometric' && (
        <p className="text-xs text-slate-500">كل سؤال يقيس محوراً واحداً، وكل خيار يميل لأحد قطبيه. يُفضَّل عدد فردي من الأسئلة لكل محور حتى لا يتعادل. النتيجة استرشادية ولا تدخل في درجة القبول.</p>
      )}
      {msg.text && <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}

      {form && (
        <div className={`${card} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{form.id ? 'تعديل سؤال' : 'سؤال جديد'}</h3>
            <button onClick={() => setForm(null)} aria-label="إغلاق"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <label className="block text-sm"><span className="text-slate-600">نص السؤال *</span>
            <textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className={input} /></label>

          {form.kind === 'psychometric' ? (
            <label className="block text-sm"><span className="text-slate-600">المحور</span>
              <select value={form.dichotomy} className={input}
                onChange={(e) => {
                  const [, a, b] = AXES[e.target.value];
                  setForm({ ...form, dichotomy: e.target.value,
                    options: form.options.map((o, i) => ({ ...o, pole: i % 2 === 0 ? a : b })) });
                }}>
                {Object.entries(AXES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          ) : (
            <label className="block text-sm"><span className="text-slate-600">المجال</span>
              <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={input}>
                {Object.entries(AREAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
          )}

          <div className="space-y-2">
            <p className="text-sm text-slate-600">الخيارات {form.kind === 'aptitude' ? '— اختر الإجابة الصحيحة' : '— وما يقيسه كل خيار'}</p>
            {form.options.map((o, i) => (
              <div key={o.key} className="flex items-center gap-2">
                {form.kind === 'aptitude' && (
                  <input type="radio" name="correct" checked={form.correct_option === o.key}
                    onChange={() => setForm({ ...form, correct_option: o.key })} aria-label={`الخيار ${o.key} صحيح`} />
                )}
                <input value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })}
                  placeholder={`الخيار ${i + 1}`} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                {form.kind === 'psychometric' && (
                  <select value={o.pole} onChange={(e) => setOpt(i, { pole: e.target.value })}
                    className="px-2 py-2 border border-slate-300 rounded-lg text-sm" aria-label="القطب">
                    {AXES[form.dichotomy].slice(1).map((p) => <option key={p} value={p}>{POLE_LABEL[p]}</option>)}
                  </select>
                )}
                {form.options.length > 2 && (
                  <button onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                    aria-label="حذف الخيار"><X className="w-4 h-4 text-slate-400" /></button>
                )}
              </div>
            ))}
            {form.options.length < 6 && (
              <button onClick={() => {
                const key = KEYS.find((k) => !form.options.some((o) => o.key === k));
                const pole = form.kind === 'psychometric' ? AXES[form.dichotomy][1] : undefined;
                setForm({ ...form, options: [...form.options, { key, text: '', ...(pole ? { pole } : {}) }] });
              }} className="text-sm text-[#1e3a8a] font-semibold">+ خيار</button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">إلغاء</button>
            <button onClick={save} disabled={busy || form.text.trim().length < 5}
              className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-bold disabled:opacity-50">حفظ</button>
          </div>
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className={`${card} p-10 text-center text-slate-600`}>لا توجد أسئلة بعد — أضف الأسئلة الافتراضية أو سؤالاً جديداً.</p>
      ) : (
        <ol className={`${card} divide-y divide-slate-100`}>
          {rows.map((q, i) => (
            <li key={q.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-7"><span className="text-slate-400 tabular-nums">{i + 1}. </span>{q.text}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {q.kind === 'psychometric'
                    ? `المحور: ${AXES[q.dichotomy]?.[0] || q.dichotomy}`
                    : `المجال: ${AREAS[q.area] || q.area} · الإجابة الصحيحة: ${(q.options.find((o) => o.key === q.correct_option) || {}).text || '—'}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setForm({ ...q })} className="p-2 rounded-lg hover:bg-slate-100" aria-label="تعديل">
                  <Pencil className="w-4 h-4 text-slate-500" /></button>
                <button onClick={() => remove(q)} className="p-2 rounded-lg hover:bg-red-50" aria-label="حذف">
                  <Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
