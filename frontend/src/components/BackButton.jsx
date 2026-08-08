import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';

export default function BackButton({ onClick, className = '' }) {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  
  const handleBack = () => {
    if (onClick) onClick();
    else navigate(-1);
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-[#28376B] hover:bg-gray-100 rounded-lg transition-colors mb-4 ${className}`}
    >
      {isRTL ? (
        <ArrowRight className="w-4 h-4" />
      ) : (
        <ArrowLeft className="w-4 h-4" />
      )}
      <span>{language === 'ar' ? 'رجوع' : 'Back'}</span>
    </button>
  );
}
