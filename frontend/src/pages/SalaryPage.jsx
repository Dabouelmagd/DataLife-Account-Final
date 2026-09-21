/**
 * SalaryPage — legacy alias.
 * The old SalariesPage called /api/hr/salaries, which does not exist,
 * so it could only ever render an empty list. Kept as an alias so old
 * imports keep working, now pointing at the real payroll system.
 */
export { default } from './PayrollPage';
