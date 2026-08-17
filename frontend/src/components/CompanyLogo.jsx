import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const CompanyLogo = ({ size = 'medium', className = '' }) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const heights = { small: 28, medium: 40, large: 56, xlarge: 72 };
  const h = heights[size] || 40;
  return (
    <img
      src={isAr ? '/logos/logo_ar.png' : '/logos/logo_en.png'}
      alt={isAr ? 'داتا لايف أكونت' : 'DataLife Account'}
      style={{ height: h + 'px', width: 'auto', objectFit: 'contain' }}
      className={className}
    />
  );
};

export default CompanyLogo;
