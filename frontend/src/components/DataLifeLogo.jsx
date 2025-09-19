import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const DataLifeLogo = ({ size = 'default', className = '' }) => {
  const { language, isArabic } = useLanguage();
  
  const sizeClasses = {
    small: {
      height: 'h-24',
      width: 'w-auto'
    },
    default: {
      height: 'h-30',
      width: 'w-auto'
    },
    large: {
      height: 'h-36', 
      width: 'w-auto'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.default;
  const logoSrc = isArabic ? '/datalife-logo-arabic.jpg' : '/datalife-logo-english.jpg';
  const logoAlt = isArabic ? 'داتا لايف أكونت' : 'DataLife Account';

  return (
    <div className={`flex items-center ${className}`}>
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
  );
};

export default DataLifeLogo;