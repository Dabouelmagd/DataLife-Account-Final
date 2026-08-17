import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LOGO_EN = '/logos/logo_en.png';
const LOGO_AR = '/logos/logo_ar.png';

const DataLifeLogo = ({ height = 40, className = '', forceEn = false, forceAr = false }) => {
  const { language } = useLanguage();
  const isAr = forceAr || (!forceEn && language === 'ar');
  return (
    <img
      src={isAr ? LOGO_AR : LOGO_EN}
      alt={isAr ? 'داتا لايف أكونت' : 'DataLife Account'}
      style={{ height: height + 'px', width: 'auto', objectFit: 'contain' }}
      className={className}
    />
  );
};

export const LogoImg      = (props) => <DataLifeLogo {...props} />;
export const LogoImgSmall = (props) => <DataLifeLogo height={28} {...props} />;
export const LogoEn       = (props) => <DataLifeLogo forceEn {...props} />;
export const LogoAr       = (props) => <DataLifeLogo forceAr {...props} />;

export default DataLifeLogo;
