import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const DataLifeLogo = ({ size = 'default', className = '' }) => {
  const { language, isArabic } = useLanguage();
  
  const sizeClasses = {
    small: {
      height: 'h-32',
      width: 'w-auto'
    },
    default: {
      height: 'h-40',
      width: 'w-auto'
    },
    large: {
      height: 'h-48', 
      width: 'w-auto'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.default;
  const logoSrc = isArabic ? '/datalife-logo-arabic.jpg' : '/datalife-logo-english.jpg';
  const logoAlt = isArabic ? 'داتا لايف أكونت' : 'DataLife Account';

  return (
    <div className={`flex items-center ${className}`}>
      <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100">
        <img 
          src={logoSrc}
          alt={logoAlt}
          className={`${currentSize.height} ${currentSize.width} object-contain`}
          onError={(e) => {
            console.error('Logo failed to load:', e.target.src);
            // Fallback to text if image fails to load
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};

export default DataLifeLogo;