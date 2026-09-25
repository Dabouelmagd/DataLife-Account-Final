import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const CompanyLogo = ({ size = 'medium', className = '', style }) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  // "default" was being passed from the login page and is not a size, so the
  // logo silently fell back to 40px — a mark barely readable at arm's length.
  // Unknown names now fall back to medium, and hero is for a page's own header.
  const heights = { small: 28, medium: 40, large: 56, xlarge: 72, hero: 96 };
  const h = heights[size] || heights.medium;
  return (
    <img
      src={isAr ? '/logos/logo_ar.png' : '/logos/logo_en.png'}
      alt={isAr ? 'داتا لايف أكونت' : 'DataLife Account'}
      style={{ height: h + 'px', width: 'auto', objectFit: 'contain', ...(style || {}) }}
      className={className}
    />
  );
};

export default CompanyLogo;
