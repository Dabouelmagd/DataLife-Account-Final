import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-[#1e3a8a] mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {language === 'ar' ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </h1>
        <p className="text-gray-500 mb-8">
          {language === 'ar'
            ? 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها'
            : 'The page you are looking for does not exist or has been moved'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {language === 'ar' ? 'رجوع' : 'Go Back'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2 bg-[#1e3a8a] text-white rounded-xl hover:bg-[#1e40af] transition-colors"
          >
            {language === 'ar' ? 'الرئيسية' : 'Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
