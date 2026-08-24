import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { RefreshCw, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit3, Check, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SystemGuidePanel() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editIdx, setEditIdx]   = useState(null);
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/system-guide`, { headers });
      if (r.ok) {
        const d = await r.json();
        if (!d.sections || d.sections.length === 0) {
          // Auto-seed from UserGuidePage content
          try {
            await fetch(`${API}/api/admin/system-guide/seed`, { method: 'POST', headers });
          } catch {}
          const r2 = await fetch(`${API}/api/admin/system-guide`, { headers });
          if (r2.ok) { const d2 = await r2.json(); setSections(d2.sections || []); }
        } else {
          setSections(d.sections);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/system-guide`, {
        method: 'PUT', headers,
        body: JSON.stringify({ sections })
      });
      if (r.ok) { toast.success(ar ? '✅ تم حفظ الدليل' : '✅ Guide saved'); setEditIdx(null); }
      else toast.error('Error');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const update = (idx, field, val) =>
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const addSection = () => setSections(prev => [...prev, {
    id: `section_${Date.now()}`, title_ar: 'قسم جديد', title_en: 'New Section',
    content_ar: '', content_en: '', order: prev.length + 1
  }]);

  const remove = (idx) => setSections(prev => prev.filter((_, i) => i !== idx));

  const moveUp   = (idx) => { if (idx === 0) return; const s = [...sections]; [s[idx-1],s[idx]]=[s[idx],s[idx-1]]; setSections(s); };
  const moveDown = (idx) => { if (idx === sections.length-1) return; const s = [...sections]; [s[idx],s[idx+1]]=[s[idx+1],s[idx]]; setSections(s); };

  if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-[#28376B]" /></div>;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#1e3a8a] rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black">{ar ? 'دليل النظام الشامل' : 'System Guide & Manual'}</h2>
          <p className="text-blue-200 text-sm mt-1">{ar ? `${sections.length} قسم — قابل للتعديل في أي وقت` : `${sections.length} sections — editable anytime`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addSection} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> {ar ? 'إضافة قسم' : 'Add Section'}
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-white text-[#0f1729] hover:bg-gray-100 px-4 py-2 rounded-xl text-sm font-bold transition-all">
            <Save className="w-4 h-4" /> {saving ? '...' : (ar ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(i)}   className="p-0.5 hover:text-blue-600 text-gray-400 transition-colors"><ChevronUp   className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveDown(i)} className="p-0.5 hover:text-blue-600 text-gray-400 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <span className="w-7 h-7 bg-[#28376B] text-white text-xs font-bold rounded-lg flex items-center justify-center">{i+1}</span>
              {editIdx === i ? (
                <div className="flex gap-2 flex-1">
                  <input value={s.title_ar} onChange={e => update(i,'title_ar',e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="العنوان بالعربي" />
                  <input value={s.title_en} onChange={e => update(i,'title_en',e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="English Title" />
                </div>
              ) : (
                <div className="flex-1">
                  <span className="font-semibold text-gray-800">{ar ? s.title_ar : s.title_en}</span>
                  <span className="text-gray-400 text-xs mx-2">·</span>
                  <span className="text-gray-400 text-xs">{ar ? s.title_en : s.title_ar}</span>
                </div>
              )}
              <div className="flex gap-1.5">
                {editIdx === i ? (
                  <button onClick={() => setEditIdx(null)} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all"><Check className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => setEditIdx(i)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"><Edit3 className="w-4 h-4" /></button>
                )}
                <button onClick={() => remove(i)} className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{ar ? 'المحتوى بالعربي' : 'Arabic Content'}</label>
                <textarea value={s.content_ar} onChange={e => update(i,'content_ar',e.target.value)}
                  rows={5} dir="rtl"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none font-[Cairo]"
                  placeholder="اكتب محتوى القسم بالعربي..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{ar ? 'المحتوى بالإنجليزي' : 'English Content'}</label>
                <textarea value={s.content_en} onChange={e => update(i,'content_en',e.target.value)}
                  rows={5} dir="ltr"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  placeholder="Write section content in English..." />
              </div>
            </div>
          </div>
        ))}
      </div>

      {sections.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm mb-3">{ar ? 'لا توجد أقسام بعد' : 'No sections yet'}</p>
          <button onClick={addSection} className="bg-[#28376B] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0f1729] transition-all">
            {ar ? '+ إضافة أول قسم' : '+ Add first section'}
          </button>
        </div>
      )}
    </div>
  );
}
