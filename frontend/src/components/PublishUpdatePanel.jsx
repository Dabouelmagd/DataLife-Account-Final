/**
 * PublishUpdatePanel — Super Admin Panel
 * نشر تحديث جديد لكل الشركات
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles, Plus, X, Send, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function PublishUpdatePanel() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    version: '',
    title_ar: '',
    title_en: '',
    description_ar: '',
    description_en: '',
    features: [''],
    is_critical: false,
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchUpdates = async () => {
    try {
      const res = await fetch(`${API}/api/updates/all`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUpdates(data.updates || []);
      }
    } catch {}
  };

  useEffect(() => { fetchUpdates(); }, []);

  const handlePublish = async () => {
    if (!form.title_ar && !form.title_en) return;
    setLoading(true);
    try {
      const body = {
        ...form,
        features: form.features.filter(f => f.trim()),
      };
      const res = await fetch(`${API}/api/updates/`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (res.ok) {
        setSuccess(language === 'ar' ? '✅ تم نشر التحديث لكل الشركات!' : '✅ Update published to all companies!');
        setShowForm(false);
        setForm({ version:'', title_ar:'', title_en:'', description_ar:'', description_en:'', features:[''], is_critical:false });
        fetchUpdates();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch {}
    setLoading(false);
  };

  const deactivate = async (id) => {
    await fetch(`${API}/api/updates/${id}/deactivate`, { method: 'PATCH', headers });
    fetchUpdates();
  };

  const addFeature = () => setForm(f => ({ ...f, features: [...f.features, ''] }));
  const removeFeature = (i) => setForm(f => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));
  const updateFeature = (i, val) => setForm(f => {
    const features = [...f.features];
    features[i] = val;
    return { ...f, features };
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {language === 'ar' ? 'نشر التحديثات' : 'Publish Updates'}
            </h2>
            <p className="text-sm text-gray-500">
              {language === 'ar' ? 'إشعار الشركات بالتحديثات الجديدة' : 'Notify companies about new updates'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#1e40af] transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'تحديث جديد' : 'New Update'}
        </button>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Publish Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="font-bold text-gray-800 text-lg border-b pb-3">
            {language === 'ar' ? 'نشر تحديث جديد' : 'Publish New Update'}
          </h3>

          {/* Version */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {language === 'ar' ? 'رقم الإصدار' : 'Version Number'}
            </label>
            <input
              type="text"
              placeholder="e.g. 2.1.0"
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">العنوان (عربي) *</label>
              <input
                type="text"
                placeholder="مثال: تحديث جديد — أغسطس 2026"
                value={form.title_ar}
                onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title (English)</label>
              <input
                type="text"
                placeholder="e.g. New Update — August 2026"
                value={form.title_en}
                onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الوصف (عربي)</label>
              <textarea
                rows={3}
                placeholder="وصف مختصر للتحديث..."
                value={form.description_ar}
                onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description (English)</label>
              <textarea
                rows={3}
                placeholder="Brief update description..."
                value={form.description_en}
                onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'مميزات التحديث' : 'Update Features'}
              </label>
              <button onClick={addFeature} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {language === 'ar' ? 'إضافة ميزة' : 'Add feature'}
              </button>
            </div>
            <div className="space-y-2">
              {form.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={language === 'ar' ? `الميزة ${i + 1}...` : `Feature ${i + 1}...`}
                    value={f}
                    onChange={e => updateFeature(i, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {form.features.length > 1 && (
                    <button onClick={() => removeFeature(i)} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Critical toggle */}
          <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
            <input
              type="checkbox"
              id="critical"
              checked={form.is_critical}
              onChange={e => setForm(f => ({ ...f, is_critical: e.target.checked }))}
              className="w-4 h-4 accent-orange-600"
            />
            <label htmlFor="critical" className="text-sm font-medium text-orange-800 flex items-center gap-2 cursor-pointer">
              <AlertTriangle className="w-4 h-4" />
              {language === 'ar' ? 'تحديث مهم (يظهر باللون الأحمر)' : 'Critical Update (shows in red)'}
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePublish}
              disabled={loading || (!form.title_ar && !form.title_en)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading
                ? (language === 'ar' ? 'جاري النشر...' : 'Publishing...')
                : (language === 'ar' ? 'نشر لكل الشركات' : 'Publish to All Companies')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Updates list */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">
          {language === 'ar' ? `التحديثات المنشورة (${updates.length})` : `Published Updates (${updates.length})`}
        </h3>
        {updates.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{language === 'ar' ? 'لا توجد تحديثات منشورة بعد' : 'No updates published yet'}</p>
          </div>
        ) : (
          updates.map(u => (
            <div key={u.id} className={`p-4 rounded-xl border ${u.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-sm ${u.is_critical ? 'text-red-700' : 'text-gray-800'}`}>
                      {u.title_ar || u.title_en}
                    </span>
                    {u.version && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">v{u.version}</span>}
                    {u.is_critical && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ مهم</span>}
                    {!u.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">موقوف</span>}
                  </div>
                  {u.description_ar && <p className="text-xs text-gray-500 mt-1">{u.description_ar}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>📅 {new Date(u.created_at).toLocaleDateString('ar-EG')}</span>
                    <span>👁️ رأى: {u.seen_by?.length || 0}</span>
                    <span>✅ حدّث: {u.updated_by?.length || 0}</span>
                  </div>
                </div>
                {u.is_active && (
                  <button
                    onClick={() => deactivate(u.id)}
                    className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title={language === 'ar' ? 'إيقاف التحديث' : 'Deactivate'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
