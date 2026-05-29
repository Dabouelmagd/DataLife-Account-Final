import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles, Send, X, Bot, User, Loader2, Trash2, RefreshCcw, Wand2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const SUGGESTIONS_AR = [
  'كم عدد الموظفين عندي؟',
  'اعرض أعلى 5 عملاء حسب الرصيد',
  'كم إجمالي مبيعات الفواتير هذا الشهر؟',
  'أرني المنتجات التي كميتها أقل من 10',
];
const SUGGESTIONS_EN = [
  'How many employees do I have?',
  'Show top 5 customers by balance',
  'Total invoice revenue this month?',
  'List products with quantity below 10',
];

const AIAssistant = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  const suggestions = language === 'ar' ? SUGGESTIONS_AR : SUGGESTIONS_EN;

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Hide for unauthenticated visitors (landing pages, etc.)
  if (!user || !localStorage.getItem('token')) return null;

  const sendQuestion = async (q) => {
    const text = (q || question).trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: text, ts: Date.now() }]);
    setQuestion('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/ai-assistant/ask`,
        { question: text, session_id: sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessionId(res.data.session_id || sessionId);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.answer,
        intent: res.data.intent,
        result: res.data.result,
        ts: Date.now(),
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || (language === 'ar' ? 'تعذّر الإجابة. حاول مجدداً.' : 'Could not answer. Please try again.'),
        error: true,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    setSessionId(null);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/ai-assistant/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* noop */
    }
  };

  const renderResultBadge = (msg) => {
    if (!msg.result || msg.error) return null;
    if (Array.isArray(msg.result) && msg.result.length > 0) {
      return (
        <div className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded inline-flex items-center gap-1">
          <Wand2 className="h-3 w-3" />
          {msg.result.length} {language === 'ar' ? 'نتيجة' : 'results'}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-24 ${isRTL ? 'left-6' : 'right-6'} z-50 group`}
        title={language === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
        data-testid="ai-assistant-fab"
      >
        <div className="relative">
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-40 animate-ping"></span>
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          {/* AI badge */}
          <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
            AI
          </span>
        </div>
      </button>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-end"
          onClick={() => setOpen(false)}
          data-testid="ai-assistant-modal"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full sm:w-[440px] sm:m-6 h-[85vh] sm:h-[85vh] sm:max-h-[720px] bg-white dark:bg-slate-900 sm:rounded-2xl rounded-t-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-xl">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">
                  {language === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
                </h3>
                <p className="text-[11px] text-white/80">
                  {language === 'ar' ? 'اسألني عن بياناتك بالعربية' : 'Ask me about your business data'}
                </p>
              </div>
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-white/15 rounded-lg"
                title={language === 'ar' ? 'مسح المحادثة' : 'Clear chat'}
                data-testid="ai-clear"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/15 rounded-lg"
                data-testid="ai-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 pt-6">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {language === 'ar' ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟' : 'Hi! How can I help today?'}
                  </p>
                  <p className="text-xs mt-1">
                    {language === 'ar' ? 'جرّب أحد الأسئلة التالية:' : 'Try one of these questions:'}
                  </p>
                  <div className="mt-4 space-y-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendQuestion(s)}
                        className="block w-full text-start text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-200 transition-colors"
                        data-testid={`ai-suggestion-${i}`}
                      >
                        💬 {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                  }`}>
                    {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-end' : ''}`}>
                    <div className={`inline-block px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : msg.error
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-tl-sm border border-red-200 dark:border-red-700'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-200 dark:border-slate-700'
                    }`}>
                      {msg.content}
                    </div>
                    {renderResultBadge(msg)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span className="text-xs text-slate-500">{language === 'ar' ? 'جاري التفكير...' : 'Thinking...'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
                  placeholder={language === 'ar' ? 'اكتب سؤالك...' : 'Type your question...'}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  disabled={loading}
                  data-testid="ai-input"
                />
                <button
                  onClick={() => sendQuestion()}
                  disabled={loading || !question.trim()}
                  className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                  data-testid="ai-send"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                <RefreshCcw className="h-2.5 w-2.5" />
                {language === 'ar' ? 'مدعوم بـ GPT — قد تظهر أخطاء أحياناً' : 'Powered by GPT — may occasionally err'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
