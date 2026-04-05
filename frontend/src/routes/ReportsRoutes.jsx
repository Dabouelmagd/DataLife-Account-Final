import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, Calculator, BarChart } from 'lucide-react';

// Reports Pages
import SystemReportsPage from '../pages/SystemReportsPage';

/**
 * Reports Module Route Handler
 * Handles all Reports routing
 */
export const renderReportsContent = ({
  language,
  setActiveModule,
  setActiveHRSubModule,
  setActiveFinancialSubModule
}) => {
  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <BarChart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">{language === 'ar' ? 'التقارير' : 'Reports'}</h1>
            <p className="text-slate-300 text-sm">{language === 'ar' ? 'التقارير والتحليلات الشاملة لجميع أقسام النظام' : 'Comprehensive reports and analytics for all system modules'}</p>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* HR Reports */}
        <Card 
          className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30"
          onClick={() => {
            setActiveModule('hr');
            setActiveHRSubModule('hr-reports');
          }}
        >
          <CardContent className="p-6">
            <div className="w-14 h-14 rounded-xl bg-cyan-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              {language === 'ar' ? 'تقارير الموارد البشرية' : 'HR Reports'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'تقارير الموظفين، الحضور، الرواتب والأداء' : 'Employee, attendance, payroll and performance reports'}
            </p>
          </CardContent>
        </Card>

        {/* Financial Reports */}
        <Card 
          className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30"
          onClick={() => {
            setActiveModule('financial');
            setActiveFinancialSubModule('financial-reports');
          }}
        >
          <CardContent className="p-6">
            <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              {language === 'ar' ? 'التقارير المالية' : 'Financial Reports'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'الميزانية، قائمة الدخل، التدفقات النقدية' : 'Balance sheet, income statement, cash flows'}
            </p>
          </CardContent>
        </Card>

        {/* System Reports */}
        <Card 
          className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"
          onClick={() => setActiveModule('system-reports')}
        >
          <CardContent className="p-6">
            <div className="w-14 h-14 rounded-xl bg-violet-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BarChart className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              {language === 'ar' ? 'تقارير النظام' : 'System Reports'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'المشاريع، المشتريات، المخزون، والموافقات' : 'Projects, purchases, inventory, and approvals'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * System Reports Content
 */
export const renderSystemReportsContent = ({ language }) => {
  return <SystemReportsPage language={language} />;
};

export default { renderReportsContent, renderSystemReportsContent };
