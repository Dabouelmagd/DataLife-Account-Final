import React from 'react';
import { Database } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const DataLifeLogo = ({ size = 'default', className = '', variant = 'default' }) => {
  const { language, isArabic } = useLanguage();
  
  const sizeClasses = {
    small: {
      icon: 'w-6 h-6',
      text: 'text-sm',
      container: 'w-6 h-6'
    },
    default: {
      icon: 'w-8 h-8',
      text: 'text-lg',
      container: 'w-8 h-8'
    },
    large: {
      icon: 'w-10 h-10', 
      text: 'text-xl',
      container: 'w-10 h-10'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.default;

  return (
    <div className={`flex items-center ${isArabic ? 'space-x-reverse' : ''} space-x-3 ${className}`}>
      <div className={`${currentSize.container} bg-[#28376B] rounded-lg flex items-center justify-center`}>
        <Database className={`${currentSize.icon} text-white`} />
      </div>
      <div className="flex flex-col">
        {isArabic ? (
          <>
            <span className={`${currentSize.text} font-bold text-[#28376B] leading-tight`}>
              داتا لايف
            </span>
            <span className="text-xs text-gray-600 leading-tight">
              لخدمات الذكاء الاصطناعي
            </span>
          </>
        ) : (
          <>
            <span className={`${currentSize.text} font-bold text-[#28376B] leading-tight`}>
              DataLife Account
            </span>
            <span className="text-xs text-gray-600 leading-tight">
              Business Management
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default DataLifeLogo;