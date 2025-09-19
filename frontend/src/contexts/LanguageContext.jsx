import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or default to English
    return localStorage.getItem('language') || 'en';
  });

  const [direction, setDirection] = useState(() => {
    return language === 'ar' ? 'rtl' : 'ltr';
  });

  useEffect(() => {
    // Save language preference
    localStorage.setItem('language', language);
    
    // Update direction
    const newDirection = language === 'ar' ? 'rtl' : 'ltr';
    setDirection(newDirection);
    
    // Update document direction and lang
    document.documentElement.dir = newDirection;
    document.documentElement.lang = language;
    
    // Update body class for styling
    document.body.className = document.body.className.replace(/\b(ltr|rtl)\b/g, '');
    document.body.classList.add(newDirection);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const value = {
    language,
    direction,
    setLanguage,
    toggleLanguage,
    isRTL: language === 'ar',
    isArabic: language === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};