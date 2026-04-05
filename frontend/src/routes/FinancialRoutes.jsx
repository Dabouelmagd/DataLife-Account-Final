import React from 'react';

// Financial Pages
import TrialBalancePage from '../pages/TrialBalancePage';
import IncomeStatementPage from '../pages/IncomeStatementPage';
import BalanceSheetPage from '../pages/BalanceSheetPage';
import ProductsPage from '../pages/ProductsPage';
import CurrenciesPage from '../pages/CurrenciesPage';
import InventoryPage from '../pages/InventoryPage';
import ProjectsPage from '../pages/ProjectsPage';

// Financial Modules
import PurchasesModule from '../components/PurchasesModule';
import {
  JournalEntriesPage,
  GeneralLedgerPage,
  FinancialReportsPage,
  TreasuryModule,
  CustodyModule,
  AccountsModule,
  BankModule,
  CustomersModule,
  SuppliersModule,
} from '../components/FinancialSubModules';

/**
 * Financial Module Route Handler
 * Handles all Financial sub-module routing
 */
export const renderFinancialContent = ({
  activeFinancialSubModule,
  language,
  userRole
}) => {
  switch (activeFinancialSubModule) {
    case 'journal-entries':
      return <JournalEntriesPage />;
    case 'general-ledger':
      return <GeneralLedgerPage />;
    case 'trial-balance':
      return <TrialBalancePage language={language} />;
    case 'income-statement':
      return <IncomeStatementPage language={language} />;
    case 'balance-sheet':
      return <BalanceSheetPage language={language} />;
    case 'financial-reports':
      return <FinancialReportsPage />;
    case 'treasury':
      return <TreasuryModule language={language} userRole={userRole} />;
    case 'custody':
      return <CustodyModule language={language} userRole={userRole} />;
    case 'accounts':
      return <AccountsModule language={language} userRole={userRole} />;
    case 'bank':
      return <BankModule language={language} userRole={userRole} />;
    case 'customers':
      return <CustomersModule language={language} userRole={userRole} />;
    case 'suppliers':
      return <SuppliersModule language={language} userRole={userRole} />;
    case 'products':
      return <ProductsPage />;
    case 'currencies':
      return <CurrenciesPage />;
    case 'purchases':
    case 'purchase-invoices':
      return <PurchasesModule language={language} userRole={userRole} />;
    case 'inventory':
      return <InventoryPage />;
    case 'projects':
    case 'tasks':
      return <ProjectsPage language={language} />;
    default:
      return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
  }
};

export default renderFinancialContent;
