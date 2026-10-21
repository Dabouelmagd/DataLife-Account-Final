/**
 * AI Support Chatbot Component
 * Floating chat widget with AI-powered responses
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, X, Send, Loader2, Trash2, Mail, 
  UserCircle, Bot, Minimize2, Maximize2, Phone, HeadphonesIcon
} from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../contexts/LanguageContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// the assistant answers in short markdown — show **bold** as bold, drop stray heading marks
const renderBold = (text) => String(text || '').replace(/^#{1,6}\s*/gm, '').split(/(\*\*[^*]+\*\*)/g)
  .map((part, i) => (part.startsWith('**') && part.endsWith('**')
    ? <strong key={i}>{part.slice(2, -2)}</strong> : part));

const SupportChatbot = () => {
  const { language, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showHumanSupport, setShowHumanSupport] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [issueSummary, setIssueSummary] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const t = {
    ar: {
      title: 'الدعم الفني',
      subtitle: 'مرحباً! كيف يمكنني مساعدتك؟',
      placeholder: 'اكتب رسالتك هنا...',
      send: 'إرسال',
      clearChat: 'مسح المحادثة',
      emailChat: 'إرسال بالبريد',
      humanSupport: 'دعم بشري',
      welcome: 'مرحباً! 👋 أنا مساعد الدعم الفني لنظام DataLife ERP. كيف يمكنني مساعدتك اليوم؟',
      typing: 'جاري الكتابة...',
      error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
      emailPlaceholder: 'بريدك الإلكتروني',
      emailSent: 'تم إرسال المحادثة بنجاح!',
      namePlaceholder: 'اسمك',
      issuePlaceholder: 'صف المشكلة باختصار',
      submitTicket: 'إنشاء تذكرة دعم',
      ticketCreated: 'تم إنشاء التذكرة بنجاح!',
      back: 'رجوع',
      contactOptions: 'خيارات التواصل',
    },
    en: {
      title: 'Support',
      subtitle: 'Hello! How can I help you?',
      placeholder: 'Type your message here...',
      send: 'Send',
      clearChat: 'Clear Chat',
      emailChat: 'Email Chat',
      humanSupport: 'Human Support',
      welcome: 'Hello! 👋 I am the DataLife ERP technical support assistant. How can I help you today?',
      typing: 'Typing...',
      error: 'An error occurred. Please try again.',
      emailPlaceholder: 'Your email',
      emailSent: 'Chat transcript sent successfully!',
      namePlaceholder: 'Your name',
      issuePlaceholder: 'Describe your issue briefly',
      submitTicket: 'Create Support Ticket',
      ticketCreated: 'Ticket created successfully!',
      back: 'Back',
      contactOptions: 'Contact Options',
    }
  };

  const content = t[language] || t.en;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Add welcome message when chat opens for first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: content.welcome,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, content.welcome, messages.length]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    const body = JSON.stringify({ session_id: sessionId, message: userMessage.content, language });
    const finish = (data) => {
      setSessionId(data.session_id);
      setMessages(prev => {
        const rest = prev.filter(m => !m.streaming);
        return [...rest, { role: 'assistant', content: data.message, timestamp: new Date(data.timestamp) }];
      });
    };

    try {
      // The answer is streamed (Server-Sent Events) so it appears as it is written
      // instead of after a long spinner. If the stream can't be read (old browser,
      // proxy), the same question goes to /send and arrives in one piece.
      let streamed = false;
      try {
        const res = await fetch(`${API_URL}/api/chatbot/stream`, {
          method: 'POST', headers: chatHeaders(), body
        });
        if (res.ok && res.body && res.body.getReader) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let text = '';
          let done = null;
          for (;;) {
            const { value, done: end } = await reader.read();
            if (end) break;
            buf += decoder.decode(value, { stream: true });
            const events = buf.split('\n\n');
            buf = events.pop();
            for (const ev of events) {
              const line = ev.split('\n').find(l => l.startsWith('data:'));
              if (!line) continue;
              let msg;
              try { msg = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
              if (msg.type === 'delta') {
                text += msg.text || '';
                const shown = text;
                setIsLoading(false);
                setMessages(prev => {
                  const rest = prev.filter(m => !m.streaming);
                  return [...rest, { role: 'assistant', content: shown, timestamp: new Date(), streaming: true }];
                });
              } else if (msg.type === 'done') {
                done = msg;
              }
            }
          }
          if (done) { finish(done); streamed = true; }
        }
      } catch (e) {
        streamed = false;
      }
      if (streamed) return;

      const response = await fetch(`${API_URL}/api/chatbot/send`, {
        method: 'POST', headers: chatHeaders(), body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Error');
      finish(data);
    } catch (error) {
      setMessages(prev => [...prev.filter(m => !m.streaming), {
        role: 'assistant',
        content: content.error,
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // a signed-in user's conversation is recorded as theirs (so they can delete it)
  const chatHeaders = () => {
    const t = localStorage.getItem('token');
    return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
  };

  const clearChat = async () => {
    if (sessionId) {
      try {
        // only a signed-in user can delete (their own) conversation on the server;
        // a visitor's chat is just cleared on screen
        const authToken = localStorage.getItem('token');
        if (authToken) {
          await fetch(`${API_URL}/api/chatbot/session/${sessionId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
          });
        }
      } catch (e) {
        console.error('Error clearing session:', e);
      }
    }
    setMessages([{
      role: 'assistant',
      content: content.welcome,
      timestamp: new Date()
    }]);
    setSessionId(null);
  };

  const sendEmailTranscript = async () => {
    if (!email.trim() || !sessionId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chatbot/email-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          email: email.trim(),
          language: language
        })
      });

      if (response.ok) {
        alert(content.emailSent);
        setShowEmailForm(false);
        setEmail('');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const requestHumanSupport = async () => {
    if (!userName.trim() || !email.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/chatbot/request-human-support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'no-session',
          user_name: userName.trim(),
          user_email: email.trim(),
          issue_summary: issueSummary.trim() || 'General inquiry',
          language: language
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }]);
        setShowHumanSupport(false);
        setUserName('');
        setEmail('');
        setIssueSummary('');
      }
    } catch (error) {
      console.error('Error requesting support:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 w-16 h-16 bg-gradient-to-r from-[#28376B] to-[#1e2a5a] text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center group hover:scale-110`}
        data-testid="chatbot-open-btn"
      >
        <MessageCircle className="h-7 w-7 group-hover:scale-110 transition-transform" />
        {/* Pulse animation */}
        <span className="absolute w-full h-full rounded-full bg-[#28376B] animate-ping opacity-30"></span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 transition-all duration-300`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#28376B] to-[#1e2a5a] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">{content.title}</h3>
              {!isMinimized && <p className="text-xs text-blue-200">{content.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              data-testid="chatbot-close-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {showHumanSupport ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowHumanSupport(false)}
                    className="text-sm text-[#28376B] hover:underline flex items-center gap-1"
                  >
                    ← {content.back}
                  </button>
                  <h4 className="font-bold text-gray-800">{content.contactOptions}</h4>
                  <input
                    type="text"
                    placeholder={content.namePlaceholder}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#28376B]/30"
                  />
                  <input
                    type="email"
                    placeholder={content.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#28376B]/30"
                  />
                  <textarea
                    placeholder={content.issuePlaceholder}
                    value={issueSummary}
                    onChange={(e) => setIssueSummary(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#28376B]/30 resize-none"
                    rows={3}
                  />
                  <Button
                    onClick={requestHumanSupport}
                    disabled={!userName.trim() || !email.trim()}
                    className="w-full bg-[#28376B]"
                  >
                    <HeadphonesIcon className="h-4 w-4 mr-2" />
                    {content.submitTicket}
                  </Button>
                </div>
              ) : showEmailForm ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowEmailForm(false)}
                    className="text-sm text-[#28376B] hover:underline flex items-center gap-1"
                  >
                    ← {content.back}
                  </button>
                  <input
                    type="email"
                    placeholder={content.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#28376B]/30"
                  />
                  <Button
                    onClick={sendEmailTranscript}
                    disabled={!email.trim()}
                    className="w-full bg-[#28376B]"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {content.emailChat}
                  </Button>
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user' 
                            ? 'bg-[#28376B] text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {msg.role === 'user' ? <UserCircle className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                        </div>
                        <div className={`p-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-[#28376B] text-white rounded-tr-sm'
                            : msg.isError
                            ? 'bg-red-100 text-red-700 rounded-tl-sm'
                            : 'bg-white text-gray-800 shadow-sm rounded-tl-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap leading-6">{renderBold(msg.content)}</p>
                          <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#28376B]" />
                            <span className="text-sm text-gray-500">{content.typing}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Quick Actions */}
            {!showHumanSupport && !showEmailForm && (
              <div className="px-4 py-2 border-t bg-white flex gap-2">
                <button
                  onClick={clearChat}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title={content.clearChat}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title={content.emailChat}
                  disabled={!sessionId}
                >
                  <Mail className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowHumanSupport(true)}
                  className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                  title={content.humanSupport}
                >
                  <HeadphonesIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input Area */}
            {!showHumanSupport && !showEmailForm && (
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={content.placeholder}
                    disabled={isLoading}
                    className="flex-1 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#28376B]/30 focus:border-[#28376B] transition-all"
                    data-testid="chatbot-input"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-[#28376B] hover:bg-[#1e2a5a] px-4"
                    data-testid="chatbot-send-btn"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SupportChatbot;
