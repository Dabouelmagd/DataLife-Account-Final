/**
 * Projects Configuration
 * إعدادات وترجمات المشاريع
 */

/**
 * Get translations based on language
 */
export const getProjectTranslations = (isRTL) => ({
  projects: isRTL ? 'المشاريع' : 'Projects',
  tasks: isRTL ? 'المهام' : 'Tasks',
  myTasks: isRTL ? 'مهامي' : 'My Tasks',
  createProject: isRTL ? 'مشروع جديد' : 'New Project',
  createTask: isRTL ? 'مهمة جديدة' : 'New Task',
  name: isRTL ? 'الاسم' : 'Name',
  title: isRTL ? 'العنوان' : 'Title',
  description: isRTL ? 'الوصف' : 'Description',
  priority: isRTL ? 'الأولوية' : 'Priority',
  low: isRTL ? 'منخفضة' : 'Low',
  medium: isRTL ? 'متوسطة' : 'Medium',
  high: isRTL ? 'عالية' : 'High',
  urgent: isRTL ? 'عاجلة' : 'Urgent',
  status: isRTL ? 'الحالة' : 'Status',
  planning: isRTL ? 'تخطيط' : 'Planning',
  in_progress: isRTL ? 'قيد التنفيذ' : 'In Progress',
  on_hold: isRTL ? 'معلق' : 'On Hold',
  completed: isRTL ? 'مكتمل' : 'Completed',
  cancelled: isRTL ? 'ملغي' : 'Cancelled',
  todo: isRTL ? 'للتنفيذ' : 'To Do',
  review: isRTL ? 'مراجعة' : 'Review',
  startDate: isRTL ? 'تاريخ البداية' : 'Start Date',
  endDate: isRTL ? 'تاريخ النهاية' : 'End Date',
  dueDate: isRTL ? 'تاريخ الاستحقاق' : 'Due Date',
  budget: isRTL ? 'الميزانية' : 'Budget',
  manager: isRTL ? 'المدير' : 'Manager',
  assignedTo: isRTL ? 'مسند إلى' : 'Assigned To',
  teamMembers: isRTL ? 'فريق العمل' : 'Team Members',
  estimatedHours: isRTL ? 'الساعات المقدرة' : 'Estimated Hours',
  progress: isRTL ? 'التقدم' : 'Progress',
  save: isRTL ? 'حفظ' : 'Save',
  cancel: isRTL ? 'إلغاء' : 'Cancel',
  delete: isRTL ? 'حذف' : 'Delete',
  edit: isRTL ? 'تعديل' : 'Edit',
  view: isRTL ? 'عرض' : 'View',
  comments: isRTL ? 'التعليقات' : 'Comments',
  addComment: isRTL ? 'أضف تعليق' : 'Add Comment',
  totalProjects: isRTL ? 'إجمالي المشاريع' : 'Total Projects',
  totalTasks: isRTL ? 'إجمالي المهام' : 'Total Tasks',
  overdue: isRTL ? 'متأخرة' : 'Overdue',
  dueThisWeek: isRTL ? 'تستحق هذا الأسبوع' : 'Due This Week',
  noProjects: isRTL ? 'لا توجد مشاريع' : 'No projects',
  noTasks: isRTL ? 'لا توجد مهام' : 'No tasks',
  tasksCount: isRTL ? 'المهام' : 'Tasks',
  project: isRTL ? 'المشروع' : 'Project',
  financials: isRTL ? 'الحسابات المالية' : 'Financials',
  viewFinancials: isRTL ? 'عرض الحسابات' : 'View Financials',
  projectDetails: isRTL ? 'تفاصيل المشروع' : 'Project Details',
  taskDetails: isRTL ? 'تفاصيل المهمة' : 'Task Details',
  exportCSV: isRTL ? 'تصدير CSV' : 'Export CSV',
  printReport: isRTL ? 'طباعة التقرير' : 'Print Report',
  refresh: isRTL ? 'تحديث' : 'Refresh',
  selectProject: isRTL ? 'اختر المشروع' : 'Select Project',
  selectEmployee: isRTL ? 'اختر الموظف' : 'Select Employee',
  noEmployees: isRTL ? 'لا يوجد موظفين' : 'No employees',
  loading: isRTL ? 'جاري التحميل...' : 'Loading...',
  error: isRTL ? 'حدث خطأ' : 'Error occurred',
  success: isRTL ? 'تم بنجاح' : 'Success'
});

/**
 * Status styling configuration
 */
export const STATUS_COLORS = {
  planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  on_hold: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  todo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

/**
 * Priority styling configuration
 */
export const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
};

/**
 * Project status options
 */
export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: { en: 'Planning', ar: 'تخطيط' } },
  { value: 'in_progress', label: { en: 'In Progress', ar: 'قيد التنفيذ' } },
  { value: 'on_hold', label: { en: 'On Hold', ar: 'معلق' } },
  { value: 'completed', label: { en: 'Completed', ar: 'مكتمل' } },
  { value: 'cancelled', label: { en: 'Cancelled', ar: 'ملغي' } }
];

/**
 * Task status options
 */
export const TASK_STATUS_OPTIONS = [
  { value: 'todo', label: { en: 'To Do', ar: 'للتنفيذ' } },
  { value: 'in_progress', label: { en: 'In Progress', ar: 'قيد التنفيذ' } },
  { value: 'review', label: { en: 'Review', ar: 'مراجعة' } },
  { value: 'completed', label: { en: 'Completed', ar: 'مكتمل' } }
];

/**
 * Priority options
 */
export const PRIORITY_OPTIONS = [
  { value: 'low', label: { en: 'Low', ar: 'منخفضة' } },
  { value: 'medium', label: { en: 'Medium', ar: 'متوسطة' } },
  { value: 'high', label: { en: 'High', ar: 'عالية' } },
  { value: 'urgent', label: { en: 'Urgent', ar: 'عاجلة' } }
];

/**
 * Initial project form state
 */
export const INITIAL_PROJECT_FORM = {
  name: '',
  description: '',
  priority: 'medium',
  start_date: '',
  end_date: '',
  budget: '',
  manager_id: '',
  team_members: []
};

/**
 * Initial task form state
 */
export const INITIAL_TASK_FORM = {
  title: '',
  description: '',
  project_id: '',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
  estimated_hours: ''
};
