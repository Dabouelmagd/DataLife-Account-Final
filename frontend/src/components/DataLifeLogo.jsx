import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

// Full logo with text — best on dark backgrounds
const LOGO_FULL = '/logos/logo_en.png';
// Icon only (DL box) — works on light and dark backgrounds
const LOGO_ICON = '/logos/logo_icon.png';

const DataLifeLogo = ({
  height = 40,
  className = '',
  forceEn = false,
  forceAr = false,
  iconOnly = false,   // show only DL icon (for light backgrounds)
}) => {
  const { language } = useLanguage();
  const src = iconOnly ? LOGO_ICON : LOGO_FULL;

  return (
    <img
      src={src}
      alt="DataLife Account"
      style={{ height: height + 'px', width: 'auto', objectFit: 'contain' }}
      className={className}
    />
  );
};

export const LogoImg      = (props) => <DataLifeLogo {...props} />;
export const LogoImgSmall = (props) => <DataLifeLogo height={28} {...props} />;
export const LogoIcon     = (props) => <DataLifeLogo iconOnly {...props} />;
export const LogoEn       = (props) => <DataLifeLogo forceEn {...props} />;
export const LogoAr       = (props) => <DataLifeLogo forceAr {...props} />;

export default DataLifeLogo;
