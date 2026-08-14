import React from 'react';

// HR Pages
import PayrollPage from '../pages/PayrollPage';
import ShiftsManagementPage from '../pages/ShiftsManagementPage';
import AttendancePage from '../pages/AttendancePage';
import SalaryPage from '../pages/SalaryPage';
import DeductionsPage from '../pages/DeductionsPage';
import AllowancesPage from '../pages/AllowancesPage';
import HRComprehensiveReportsPage from '../pages/HRComprehensiveReportsPage';

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
  // HR Overview
  if (activeHRSubModule === 'hr-overview' || !activeHRSubModule) {
    return (
      <HROverviewContent
        language={language}
        stats={stats}
        employees={employees}
        onAddEmployee={() => {
          setActiveHRSubModule('employees');
        }}
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
    case 'leaves':
      return <LeavesContent language={language} />;
    case 'end-service':
      return <EmployeeResignationsContent language={language} />;
    case 'hr-reports':
      return <HRComprehensiveReportsPage language={language} />;
    default:
      return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
  }
};

export default renderHRContent;
