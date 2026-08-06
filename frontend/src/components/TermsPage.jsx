import { useLanguage } from '../contexts/LanguageContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const sections = [
    {icon:'✅',title:t('الموافقة على الشروط','Agreement'),content:t('باستخدامك DataLife Account، فأنت توافق على هذه الشروط والأحكام.','By using DataLife Account, you agree to these Terms and Conditions.')},
    {icon:'📄',title:t('الخدمة والاشتراك','Service & Subscription'),content:t('DataLife Account نظام SaaS. تحصل على ترخيص استخدام غير حصري بناءً على خطة اشتراكك.','DataLife Account is a SaaS system. You receive a non-exclusive license based on your subscription plan.')},
    {icon:'⚠️',title:t('الاستخدام المقبول','Acceptable Use'),content:t('يجب استخدام النظام للأغراض التجارية المشروعة فقط. يُحظر محاولة اختراق النظام أو مشاركة بيانات الدخول.','The system must be used for legitimate business purposes only.')},
    {icon:'❌',title:t('إنهاء الخدمة','Termination'),content:t('يحق لنا إنهاء حسابك عند انتهاك الشروط. يمكنك تصدير بياناتك خلال 30 يوم من تاريخ الإلغاء.','We reserve the right to terminate your account upon violation. You can export data within 30 days.')},
    {icon:'⚖️',title:t('القانون المطبق','Applicable Law'),content:t('تخضع هذه الشروط لقوانين جمهورية مصر العربية. أي نزاع يُحال إلى المحاكم المصرية المختصة.','These terms are governed by the laws of the Arab Republic of Egypt.')},
  ];
  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL?'rtl':'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={()=>navigate('/')} className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">D</div><span className="font-bold text-white text-lg">DataLife Account</span></button>
        <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {t('رجوع','Back')}</button>
      </nav>
      <div className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-400/10 border border-purple-400/20 text-purple-400 text-sm font-semibold mb-6">⚖️ {t('شروط الاستخدام','Terms of Use')}</div>
          <h1 className="text-4xl font-black text-white mb-4">{t('شروط وأحكام الاستخدام','Terms & Conditions')}</h1>
          <p className="text-gray-400">{t('آخر تحديث: يوليو 2026','Last updated: July 2026')}</p>
        </div>
        <div className="space-y-4">
          {sections.map((s,i)=>(
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-bold text-lg mb-3">{s.icon} {s.title}</h2>
              <p className="text-gray-400 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
