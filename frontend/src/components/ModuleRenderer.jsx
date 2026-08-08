/**
 * Module Renderer Component
 * مكون عرض الوحدات
 * Handles rendering the appropriate component based on active module
 */

import React from 'react';

// Page imports
import InvoicesModule from '../components/InvoicesModule';
import CustomerPortalManagement from '../components/CustomerPortalManagement';
import PurchasesModule from '../components/PurchasesModule';
import ApprovalsModule from '../components/ApprovalsModule';
import AttendanceManagement from '../components/AttendanceManagement';
import ProjectsModule from '../components/ProjectsModule';
import DocumentsModule from '../components/DocumentsModule';
import JournalEntriesPage from '../pages/JournalEntriesPage';
import GeneralLedgerPage from '../pages/GeneralLedgerPage';
import FinancialReportsPage from '../pages/FinancialReportsPage';
import InvoicesPage from '../pages/InvoicesPage';
import PartiesPage from '../pages/PartiesPage';
import ProductsPage from '../pages/ProductsPage';
import InvoiceReportsPage from '../pages/InvoiceReportsPage';
import CurrenciesPage from '../pages/CurrenciesPage';
import InventoryPage from '../pages/InventoryPage';
import PayrollPage from '../pages/PayrollPage';
import EmployeeProfilePage from '../pages/EmployeeProfilePage';
import ShiftsPage from '../pages/ShiftsPage';
import AttendancePage from '../pages/AttendancePage';
import HRSettingsPage from '../pages/HRSettingsPage';
import ETASettingsPage from '../pages/ETASettingsPage';
import ProjectsPage from '../pages/ProjectsPage';
import CasualLeavePage from '../pages/CasualLeavePage';
import AnnualLeavePage from '../pages/AnnualLeavePage';
import HRReportsPage from '../pages/HRReportsPage';
import TerminationPage from '../pages/TerminationPage';
import DeductionsPage from '../pages/DeductionsPage';
import AllowancesPage from '../pages/AllowancesPage';
import ShiftsManagementPage from '../pages/ShiftsManagementPage';
import SalariesPage from '../pages/SalariesPage';
import HRComprehensiveReportsPage from '../pages/HRComprehensiveReportsPage';
import SystemReportsPage from '../pages/SystemReportsPage';
import TrialBalancePage from '../pages/TrialBalancePage';
import IncomeStatementPage from '../pages/IncomeStatementPage';
import BalanceSheetPage from '../pages/BalanceSheetPage';
import BankManagementPage from '../pages/BankManagementPage';
import BankSettingsPage from '../pages/BankSettingsPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import SuperAdminDashboard from '../pages/SuperAdminDashboard';
import NotificationSettingsPage from '../pages/NotificationSettingsPage';
import UserGuidePage from '../pages/UserGuidePage';
import ReportManagementPage from '../pages/ReportManagementPage';
import AssetsModule from '../components/AssetsModule';

// Overview components
import HROverviewContent from '../components/HROverviewContent';
import FinancialOverviewContent from '../components/FinancialOverviewContent';
import InvoicesOverviewContent from '../components/InvoicesOverviewContent';

// Sub-modules
import {
  SalariesModule,
  AllowancesModule,
  DeductionsModule,
  CasualLeaveModule,
  AnnualLeaveModule,
  AttendanceModule,
  HRReportsModule
} from '../components/HRSubModules';

import {
  JournalEntriesModule,
  TreasuryModule,
  BankModule,
  CustomersModule,
  SuppliersModule,
  CustodyModule,
  AccountsModule,
  InventoryModule,
  FinancialReportsModule
} from '../components/FinancialSubModules';

import { AnalyticsModule } from '../components/AnalyticsModule';
import CompanySettings from '../components/CompanySettings';
import ImportDataPage from '../components/ImportDataPage';
import DashboardContent from '../components/DashboardContent';

/**
 * Render HR Module Content
 */
export const renderHRContent = ({
  activeHRSubModule,
  language,
  employees,
  stats,
  selectedEmployeeId,
  setSelectedEmployeeId,
  setActiveHRSubModule
}) => {
  // Employee Profile View
  if (selectedEmployeeId) {
    return (
      <EmployeeProfilePage 
        employeeId={selectedEmployeeId} 
        onBack={() => setSelectedEmployeeId(null)}
      />
    );
  }

  // HR Overview
  if (activeHRSubModule === 'overview' || !activeHRSubModule) {
    return (
      <HROverviewContent
        language={language}
        stats={stats}
        employees={employees}
        onNavigate={(subModule) => setActiveHRSubModule(subModule)}
        onViewEmployee={(id) => setSelectedEmployeeId(id)}
      />
    );
  }

  // HR Sub-modules
  const hrSubModuleMap = {
    'payroll': <PayrollPage language={language} />,
    'salaries': <SalariesPage language={language} />,
    'allowances': <AllowancesPage language={language} />,
    'deductions': <DeductionsPage language={language} />,
    'attendance': <AttendancePage language={language} />,
    'shifts': <ShiftsManagementPage language={language} />,
    'casual-leave': <CasualLeavePage language={language} />,
    'annual-leave': <AnnualLeavePage language={language} />,
    'termination': <TerminationPage language={language} />,
    'reports': <HRComprehensiveReportsPage language={language} />,
    'hr-settings': <HRSettingsPage language={language} />
  };

  return hrSubModuleMap[activeHRSubModule] || null;
};

/**
 * Render Financial Module Content
 */
export const renderFinancialContent = ({
  activeFinancialSubModule,
  language,
  stats,
  setActiveFinancialSubModule
}) => {
  // Financial Overview
  if (activeFinancialSubModule === 'overview' || !activeFinancialSubModule) {
    return (
      <FinancialOverviewContent
        language={language}
        stats={stats}
        onNavigate={(subModule) => setActiveFinancialSubModule(subModule)}
      />
    );
  }

  // Financial Sub-modules
  const financialSubModuleMap = {
    'journal-entries': <JournalEntriesPage language={language} />,
    'general-ledger': <GeneralLedgerPage language={language} />,
    'parties': <PartiesPage language={language} />,
    'products': <ProductsPage language={language} />,
    'currencies': <CurrenciesPage language={language} />,
    'inventory': <InventoryPage language={language} />,
    'bank': <BankManagementPage language={language} />,
    'bank-settings': <BankSettingsPage language={language} />,
    'trial-balance': <TrialBalancePage language={language} />,
    'income-statement': <IncomeStatementPage language={language} />,
    'balance-sheet': <BalanceSheetPage language={language} />,
    'reports': <FinancialReportsPage language={language} />
  };

  return financialSubModuleMap[activeFinancialSubModule] || <JournalEntriesPage language={language} />;
};

/**
 * Render Invoice Module Content
 */
export const renderInvoiceContent = ({
  activeInvoiceSubModule,
  language,
  stats,
  setActiveInvoiceSubModule
}) => {
  // Invoice Overview
  if (activeInvoiceSubModule === 'overview' || !activeInvoiceSubModule) {
    return (
      <InvoicesOverviewContent
        language={language}
        stats={stats}
        onNavigate={(subModule) => setActiveInvoiceSubModule(subModule)}
        onCreateInvoice={() => setActiveInvoiceSubModule('invoices')}
        onGoToETASettings={() => setActiveInvoiceSubModule('eta-settings')}
      />
    );
  }

  // Invoice Sub-modules
  const invoiceSubModuleMap = {
    'invoices': <InvoicesPage language={language} />,
    'reports': <InvoiceReportsPage language={language} />,
    'eta-settings': <ETASettingsPage language={language} />
  };

  return invoiceSubModuleMap[activeInvoiceSubModule] || <InvoicesPage language={language} />;
};

/**
 * Main Module Renderer
 */
const ModuleRenderer = ({
  activeModule,
  setActiveModule,
  activeHRSubModule,
  activeFinancialSubModule,
  activeInvoiceSubModule,
  language,
  employees,
  stats,
  selectedEmployeeId,
  setSelectedEmployeeId,
  setActiveHRSubModule,
  setActiveFinancialSubModule,
  setActiveInvoiceSubModule,
  navigate
}) => {
  // Dashboard Module
  if (activeModule === 'dashboard') {
    // Create onNavigate handler for dashboard quick actions
    const handleDashboardNavigate = (module, subModule) => {
      if (module === 'hr') {
        setActiveHRSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('hr');
      } else if (module === 'financial') {
        setActiveFinancialSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('financial');
      } else if (module === 'invoices') {
        setActiveInvoiceSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('invoices');
      } else if (module === 'reports') {
        if (setActiveModule) setActiveModule('reports');
      } else {
        if (setActiveModule) setActiveModule(module);
      }
    };
    return <DashboardContent language={language} stats={stats} onNavigate={handleDashboardNavigate} />;
  }

  // HR Module
  if (activeModule === 'hr') {
    return renderHRContent({
      activeHRSubModule,
      language,
      employees,
      stats,
      selectedEmployeeId,
      setSelectedEmployeeId,
      setActiveHRSubModule
    });
  }

  // Financial Module
  if (activeModule === 'financial') {
    return renderFinancialContent({
      activeFinancialSubModule,
      language,
      stats,
      setActiveFinancialSubModule
    });
  }

  // Invoices Module
  if (activeModule === 'invoices') {
    return renderInvoiceContent({
      activeInvoiceSubModule,
      language,
      stats,
      setActiveInvoiceSubModule
    });
  }

  // Simple modules (no sub-modules)
  const simpleModuleMap = {
    'assets': <AssetsModule />,
    'analytics': <AnalyticsModule language={language} />,
    'system-reports': <SystemReportsPage language={language} />,
    'report-management': <ReportManagementPage language={language} />,
    'customer-portal-mgmt': <CustomerPortalManagement language={language} />,
    'purchases': <PurchasesModule language={language} />,
    'approvals': <ApprovalsModule language={language} />,
    'attendance-mgmt': <AttendanceManagement language={language} />,
    'projects': <ProjectsModule language={language} />,
    'documents': <DocumentsModule language={language} />,
    'settings': <CompanySettings language={language} />,
    'import': <ImportDataPage language={language} />,
    'admin-dashboard': <AdminDashboardPage language={language} />,
    'super-admin': <SuperAdminDashboard language={language} />,
    'notification-settings': <NotificationSettingsPage language={language} />,
    'user-guide': <UserGuidePage language={language} />
  };

  if (simpleModuleMap[activeModule]) {
    return simpleModuleMap[activeModule];
  }

  // Coupon Management - redirect
  if (activeModule === 'coupons') {
    navigate('/admin/coupons');
    return null;
  }

  return null;
};

export default ModuleRenderer;
