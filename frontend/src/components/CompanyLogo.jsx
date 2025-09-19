import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const CompanyLogo = ({ size = 'default', className = '' }) => {
  const { language, isArabic } = useLanguage();
  
  const sizeClasses = {
    small: {
      height: 'h-24',
      width: 'w-auto'
    },
    default: {
      height: 'h-32',
      width: 'w-auto'
    },
    large: {
      height: 'h-40', 
      width: 'w-auto'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.default;
  const logoSrc = isArabic ? '/datalife-company-arabic.png' : '/datalife-company-english.png';
  const logoAlt = isArabic ? 'داتا لايف نيت - خدمات الذكاء الاصطناعي' : 'Data Life - Artificial Intelligence Services';

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={logoSrc}
        alt={logoAlt}
        className={`${currentSize.height} ${currentSize.width} object-contain`}
        onError={(e) => {
          console.error('Company logo failed to load:', e.target.src);
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
};

export default CompanyLogo;