import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import DataLifeLogo from './DataLifeLogo';
import { ShieldOff, ArrowRight, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage({ moduleName }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === 'ar';

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
    >
      {/* Logo */}
      <div className="mb-8">
        <DataLifeLogo height={80} />
      </div>

      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6 border-2 border-red-100 dark:border-red-800">
        <ShieldOff className="w-10 h-10 text-red-400" />
      </div>

      {/* Message */}
      <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-3">
        {ar ? 'ليس لك صلاحيات لمشاهدة هذه الصفحة' : 'You do not have permission to view this page'}
      </h1>

      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        {ar
          ? 'تواصل مع مدير النظام أو المدير العام لطلب الصلاحية المناسبة.'
          : 'Please contact your system administrator or General Manager to request access.'}
      </p>

      {moduleName && (
        <div className="mb-6 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
          {ar ? `الوحدة: ${moduleName}` : `Module: ${moduleName}`}
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-bold text-sm transition-all shadow-md"
      >
        {ar ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        {ar ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
      </button>
    </div>
  );
}
