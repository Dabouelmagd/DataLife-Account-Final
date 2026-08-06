import { useLanguage } from '../contexts/LanguageContext';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ContactPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const t = (ar, en) => language === 'ar' ? ar : en;
  const [form, setForm] = useState({name:'',email:'',subject:'',message:'',type:'general'});
  const [status, setStatus] = useState('idle');

  const handleSubmit = async () => {
    setStatus('loading');
    try {
      await fetch(`${API}/api/contact/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      setStatus('success');
    } catch { setStatus('error'); }
  };

  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL?'rtl':'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={()=>navigate('/')} className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">D</div><span className="font-bold text-white text-lg">DataLife Account</span></button>
        <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {t('رجوع','Back')}</button>
      </nav>
      <div className="pt-24 pb-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 text-sm font-semibold mb-6">💬 {t('تواصل معنا','Contact Us')}</div>
          <h1 className="text-4xl font-black text-white mb-4">{t('نحن هنا لمساعدتك','We\'re Here to Help')}</h1>
          <p className="text-gray-400">{t('فريق الدعم متاح 24/7','Support team available 24/7')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            {[{icon:'✉️',label:t('البريد الإلكتروني','Email'),value:'support@datalifeai.com'},{icon:'📍',label:t('العنوان','Address'),value:t('القاهرة، مصر','Cairo, Egypt')},{icon:'🕒',label:t('أوقات الدعم','Support Hours'),value:'24/7'}].map((item,i)=>(
              <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-2xl">{item.icon}</span>
                <div><p className="text-gray-400 text-xs">{item.label}</p><p className="text-white font-medium text-sm">{item.value}</p></div>
              </div>
            ))}
          </div>
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            {status==='success'?(<div className="text-center py-12"><div className="text-6xl mb-4">✅</div><h3 className="text-xl font-bold text-white mb-2">{t('تم الإرسال!','Sent!')}</h3><p className="text-gray-400">{t('سنتواصل معك خلال 24 ساعة','We\'ll get back to you within 24 hours')}</p></div>):(
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-400 mb-1 block">{t('الاسم *','Name *')}</label><input required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#28376B]" placeholder={t('اسمك الكامل','Your full name')} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-400 mb-1 block">{t('البريد *','Email *')}</label><input required type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#28376B]" placeholder="email@company.com" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} dir="ltr" /></div>
                </div>
                <div><label className="text-xs text-gray-400 mb-1 block">{t('الموضوع *','Subject *')}</label><input required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#28376B]" value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} /></div>
                <div><label className="text-xs text-gray-400 mb-1 block">{t('الرسالة *','Message *')}</label><textarea required rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#28376B] resize-none" value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} /></div>
                <button onClick={handleSubmit} disabled={status==='loading'} className="w-full bg-[#28376B] hover:bg-[#1f2b54] text-white font-bold py-3 rounded-xl transition-all">
                  {status==='loading'?t('جاري الإرسال...','Sending...'):t('إرسال الرسالة','Send Message')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
