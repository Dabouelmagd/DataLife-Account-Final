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

  const isFooter = variant === 'footer';
  const iconBgColor = isFooter ? 'bg-white/20' : 'bg-[#28376B]';
  const iconColor = isFooter ? 'text-white' : 'text-white';
  const textColor = isFooter ? 'text-white' : 'text-[#28376B]';
  const subtitleColor = isFooter ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className={`flex items-center ${isArabic ? 'space-x-reverse' : ''} space-x-3 ${className}`}>
      <div className={`${currentSize.container} ${iconBgColor} rounded-lg flex items-center justify-center`}>
        <Database className={`${currentSize.icon} ${iconColor}`} />
      </div>
      <div className="flex flex-col">
        {isArabic ? (
          <>
            <span className={`${currentSize.text} font-bold ${textColor} leading-tight`}>
              داتا لايف
            </span>
            <span className={`text-xs ${subtitleColor} leading-tight`}>
              لخدمات الذكاء الاصطناعي
            </span>
          </>
        ) : (
          <>
            <span className={`${currentSize.text} font-bold ${textColor} leading-tight`}>
              DataLife Account
            </span>
            <span className={`text-xs ${subtitleColor} leading-tight`}>
              Business Management
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default DataLifeLogo;