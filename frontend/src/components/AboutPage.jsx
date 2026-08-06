import { useLanguage } from '../contexts/LanguageContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AboutPage() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const t = (ar, en) => language === 'ar' ? ar : en;
  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL?'rtl':'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={()=>navigate('/')} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">D</div>
          <span className="font-bold text-white text-lg">DataLife Account</span>
        </button>
        <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {t('رجوع','Back')}</button>
      </nav>
      <div className="pt-24 pb-20 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-sm font-semibold mb-6">👋 {t('من نحن','About Us')}</div>
          <h1 className="text-4xl font-black text-white mb-4">{t('نبنيها لأجلك','Built For You')}</h1>
          <p className="text-gray-400 text-lg">{t('DataLife Account — نظام ERP متكامل للشركات المصرية والعربية','DataLife Account — Complete ERP for Egyptian & Arab businesses')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            {icon:'🎯',title:t('مهمتنا','Our Mission'),desc:t('تمكين الشركات المصرية والعربية بأدوات تقنية عالمية','Empowering businesses with world-class tools')},
            {icon:'❤️',title:t('قيمنا','Our Values'),desc:t('البساطة · الموثوقية · الامتثال القانوني · الشفافية','Simplicity · Reliability · Compliance · Transparency')},
            {icon:'🌍',title:t('رؤيتنا','Our Vision'),desc:t('نظام ERP الأول في الوطن العربي','#1 ERP system in the Arab world')},
          ].map((item,i)=>(
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-r from-[#28376B] to-[#3d52a0] rounded-2xl p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[['370+',t('مسار API','API Routes')],['10',t('وحدات وظيفية','Modules')],['9',t('حلول قطاعية','Industries')],['16+',t('خطة تسعير','Pricing Plans')]].map(([n,l],i)=>(
              <div key={i}><div className="text-4xl font-black text-yellow-400 mb-2">{n}</div><div className="text-white/70 text-sm">{l}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
