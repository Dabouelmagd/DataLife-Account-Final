import { useLanguage } from '../contexts/LanguageContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const sections = [
    {icon:'🗄️',title:t('البيانات التي نجمعها','Data We Collect'),content:t('نجمع البيانات اللازمة لتشغيل النظام فقط: بيانات الشركة والموظفين، المعاملات المالية، وبيانات الاستخدام. لا نبيع بياناتك لأي طرف ثالث.','We only collect data necessary to operate the system. We never sell your data to third parties.')},
    {icon:'🔒',title:t('حماية البيانات','Data Protection'),content:t('نستخدم تشفير SSL/TLS، وتشفير bcrypt لكلمات المرور، وعزل تام لبيانات كل شركة.','We use SSL/TLS encryption, bcrypt for passwords, and complete data isolation per company.')},
    {icon:'👁️',title:t('استخدام البيانات','Data Usage'),content:t('نستخدم بياناتك فقط لتقديم الخدمة المتفق عليها وتحسين النظام.','We use your data solely to provide the agreed service and improve the system.')},
    {icon:'🛡️',title:t('حقوقك','Your Rights'),content:t('لك الحق في الوصول لبياناتك وتصحيحها وحذفها ونقلها. يمكنك تصدير بياناتك بالكامل في أي وقت.','You have the right to access, correct, delete and transfer your data anytime.')},
    {icon:'✉️',title:t('تواصل بشأن الخصوصية','Privacy Contact'),content:t('للاستفسار عن الخصوصية: privacy@datalifeai.com — نرد خلال 72 ساعة عمل.','For privacy inquiries: privacy@datalifeai.com — we respond within 72 business hours.')},
  ];
  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL?'rtl':'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={()=>navigate('/')} className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">D</div><span className="font-bold text-white text-lg">DataLife Account</span></button>
        <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {t('رجوع','Back')}</button>
      </nav>
      <div className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-400/10 border border-blue-400/20 text-blue-400 text-sm font-semibold mb-6">🛡️ {t('سياسة الخصوصية','Privacy Policy')}</div>
          <h1 className="text-4xl font-black text-white mb-4">{t('خصوصيتك أمانة عندنا','Your Privacy Is Our Trust')}</h1>
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
