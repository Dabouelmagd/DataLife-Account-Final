import React from 'react';

// HR Pages
import PayrollPage from '../pages/PayrollPage';
import ShiftsManagementPage from '../pages/ShiftsManagementPage';
import AttendancePage from '../pages/AttendancePage';
import SalaryPage from '../pages/SalaryPage';
import DeductionsPage from '../pages/DeductionsPage';
import AllowancesPage from '../pages/AllowancesPage';
import HRComprehensiveReportsPage from '../pages/HRComprehensiveReportsPage';
import CasualLeavePage from '../pages/CasualLeavePage';
import AnnualLeavePage from '../pages/AnnualLeavePage';
import TerminationPage from '../pages/TerminationPage';

// HR Content Components
import {
  HROverviewContent,
  EmployeeProfileContent,
  EmployeesTab,
  LeavesContent,
  EmployeeResignationsContent,
} from '../components/HRSubModules';

/**
 * HR Module Route Handler
 * Handles all HR sub-module routing
 * Fixed: overview check, casual-leave, annual-leave, termination, reports aliases
 */
export const renderHRContent = ({
  activeHRSubModule,
  language,
  stats,
  employees,
  selectedEmployeeId,
  userRole,
  setActiveModule,
  setActiveHRSubModule,
  setSelectedEmployeeId
}) => {
  // HR Overview — matches null (main HR click), 'hr-overview' (legacy), OR 'overview' (sidebar submodule click)
  if (!activeHRSubModule || activeHRSubModule === 'overview' || activeHRSubModule === 'hr-overview') {
    return (
      <HROverviewContent
        language={language}
        stats={stats}
        employees={employees}
        onAddEmployee={() => setActiveHRSubModule('employees')}
        onViewProfile={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          setActiveHRSubModule('employee-profile');
        }}
        onEditEmployee={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          setActiveHRSubModule('employee-profile');
        }}
      />
    );
  }

  // HR Sub-module components
  switch (activeHRSubModule) {
    case 'payroll':
      return <PayrollPage />;
    case 'shifts':
      return <ShiftsManagementPage language={language} />;
    case 'attendance':
      return <AttendancePage language={language} />;
    case 'salaries':
      return <SalaryPage onNavigateToEmployees={() => setActiveHRSubModule('employees')} />;
    case 'employee-profile':
      return <EmployeeProfileContent employeeId={selectedEmployeeId} language={language} />;
    case 'deductions':
      return <DeductionsPage language={language} />;
    case 'allowances':
      return <AllowancesPage language={language} />;
    case 'employees':
      return <EmployeesTab language={language} userRole={userRole} />;
    // Leaves
    case 'leaves':
      return <LeavesContent language={language} />;
    case 'casual-leave':         // moduleConfig id
      return <CasualLeavePage language={language} />;
    case 'annual-leave':         // moduleConfig id
      return <AnnualLeavePage language={language} />;
    // End of service / termination
    case 'end-service':
      return <EmployeeResignationsContent language={language} />;
    case 'termination':          // moduleConfig id alias
      return <TerminationPage language={language} />;
    // Reports — moduleConfig uses 'reports', legacy used 'hr-reports'
    case 'reports':
    case 'hr-reports':
      return <HRComprehensiveReportsPage language={language} />;
    default:
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          {language === 'ar' ? 'اختر وحدة فرعية من القائمة الجانبية' : 'Select a sub-module from the sidebar'}
        </div>
      );
  }
};

export default renderHRContent;
