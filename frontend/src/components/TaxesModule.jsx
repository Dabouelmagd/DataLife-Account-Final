/**
 * TaxesModule — Taxes page (extracted from AssetsModule)
 * Renders the tax-related tabs: VAT, Payroll Tax, Withholding Tax
 */
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import AssetsModule from './AssetsModule';

const TaxesModule = () => {
  const { language } = useLanguage();
  const ar = language === 'ar';

  // Render AssetsModule with tax defaultTab
  return <AssetsModule defaultTab="payroll" />;
};

export default TaxesModule;
