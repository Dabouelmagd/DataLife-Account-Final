/**
 * MessagesAdminPanel — رسائل التواصل من العملاء
 * Super Admin يرى كل الرسائل الواردة من نموذج التواصل
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MessageSquare, RefreshCw, Mail, Phone, Building2,
  Clock, CheckCircle, Search, Eye, Loader2, Calendar,
  Star, Archive
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function MessagesAdminPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/contact/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : data.messages || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const markRead = async (id) => {
    await fetch(`${API}/api/contact/messages/mark-read`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: [id] })
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  };

  const filtered = messages.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = (m.name || '').toLowerCase().includes(q) ||
                        (m.email || '').toLowerCase().includes(q) ||
                        (m.message || '').toLowerCase().includes(q) ||
                        (m.company_name || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' ? true :
                        filter === 'unread' ? !m.is_read :
                        filter === 'read' ? m.is_read : true;
    return matchSearch && matchFilter;
  });

  const unread = messages.filter(m => !m.is_read).length;
  const total  = messages.length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a1929] to-[#0d3b5e] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'رسائل التواصل' : 'Contact Messages'}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{ar ? 'رسائل العملاء من نموذج التواصل' : 'Customer messages from contact form'}</p>
            </div>
          </div>
          <button onClick={fetchMessages} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: ar ? 'الإجمالي' : 'Total',      value: total,  color: 'text-white' },
            { label: ar ? 'غير مقروء' : 'Unread',    value: unread, color: 'text-yellow-300' },
            { label: ar ? 'مقروء' : 'Read',          value: total - unread, color: 'text-green-300' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={ar ? 'بحث في الرسائل...' : 'Search messages...'}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        {['all', 'unread', 'read'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              filter === f ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f === 'all' ? (ar ? 'الكل' : 'All') :
             f === 'unread' ? (ar ? '🟡 غير مقروء' : '🟡 Unread') :
             (ar ? '✅ مقروء' : '✅ Read')}
          </button>
        ))}
      </div>

      {/* Messages + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Messages List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{ar ? 'لا توجد رسائل' : 'No messages found'}</p>
            </div>
          ) : filtered.map(msg => (
            <Card
              key={msg.id}
              onClick={() => { setSelected(msg); if (!msg.is_read) markRead(msg.id); }}
              className={`cursor-pointer border transition-all hover:shadow-md ${
                selected?.id === msg.id ? 'border-blue-400 ring-1 ring-blue-300' :
                !msg.is_read ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                    !msg.is_read ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {(msg.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{msg.name}</span>
                      {!msg.is_read && <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />}
                      {msg.subject && <Badge className="text-xs bg-gray-100 text-gray-600">{msg.subject}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{msg.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>📧 {msg.email}</span>
                      {msg.created_at && (
                        <span>🕒 {new Date(msg.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Message Detail */}
        <div>
          {selected ? (
            <Card className="border border-blue-200 sticky top-0">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{selected.name}</h3>
                    {selected.is_read
                      ? <Badge className="bg-green-100 text-green-700 text-xs mt-1">✅ {ar ? 'مقروء' : 'Read'}</Badge>
                      : <Badge className="bg-yellow-100 text-yellow-700 text-xs mt-1">🟡 {ar ? 'جديد' : 'New'}</Badge>
                    }
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <a href={`mailto:${selected.email}`} className="text-blue-600 hover:underline">{selected.email}</a>
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{selected.phone}</span>
                    </div>
                  )}
                  {selected.company_name && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span>{selected.company_name}</span>
                    </div>
                  )}
                  {selected.created_at && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{new Date(selected.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span>
                    </div>
                  )}
                </div>

                {selected.subject && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{ar ? 'الموضوع:' : 'Subject:'}</p>
                    <p className="font-medium text-gray-800">{selected.subject}</p>
                  </div>
                )}

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">{ar ? 'الرسالة:' : 'Message:'}</p>
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                </div>

                <a
                  href={`mailto:${selected.email}?subject=Re: ${selected.subject || 'رسالتك على DataLife'}`}
                  className="w-full py-2.5 bg-[#1e3a8a] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#1e40af] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {ar ? 'الرد بالبريد الإلكتروني' : 'Reply by Email'}
                </a>
              </CardContent>
            </Card>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center h-48 text-gray-400">
              <div className="text-center">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{ar ? 'اضغط على رسالة لعرضها' : 'Click a message to view'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
