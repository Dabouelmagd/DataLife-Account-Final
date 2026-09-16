import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LOGO_FULL = '/logos/logo_en.png';
const LOGO_ICON = '/logos/logo_icon.png';

// className like "h-14" overrides inline style via Tailwind
const DataLifeLogo = ({
  height,          // px value — optional, use className instead for Tailwind sizes
  className = '',
  forceEn = false,
  forceAr = false,
  iconOnly = false,
}) => {
  const { language } = useLanguage();
  const src = iconOnly ? LOGO_ICON : LOGO_FULL;
  const style = height ? { height: height + 'px', width: 'auto', objectFit: 'contain' } : { width: 'auto', objectFit: 'contain' };

  return (
    <img
      src={src}
      alt="DataLife Account"
      style={style}
      className={className || 'h-14'}
    />
  );
};

export const LogoImg      = (props) => <DataLifeLogo {...props} />;
export const LogoImgSmall = (props) => <DataLifeLogo className="h-8" {...props} />;
export const LogoIcon     = (props) => <DataLifeLogo iconOnly className="h-10" {...props} />;
export const LogoEn       = (props) => <DataLifeLogo forceEn {...props} />;
export const LogoAr       = (props) => <DataLifeLogo forceAr {...props} />;

export default DataLifeLogo;
