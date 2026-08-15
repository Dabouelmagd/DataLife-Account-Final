import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { 
  FolderKanban, Plus, ListTodo, Calendar, Users, Clock, AlertCircle,
  CheckCircle, Circle, PlayCircle, PauseCircle, Trash2, Edit, Eye,
  RefreshCw, Target, TrendingUp, ChevronRight, MessageSquare, Wifi, WifiOff,
  Flag, User, CalendarDays, Timer, FileDown, Printer, File, Calculator, DollarSign
} from 'lucide-react';
import useRealTimeSync from '../hooks/useRealTimeSync';
import ProjectFinancialsModule from './ProjectFinancialsModule';

// Import configurations
import { 
  getProjectTranslations, 
  STATUS_COLORS, 
  PRIORITY_COLORS,
  INITIAL_PROJECT_FORM,
  INITIAL_TASK_FORM
} from '../config/projectsConfig';

// Import sub-components
import { 
  ProjectsHeader, 
  ProjectsStats, 
  ProjectCard, 
  TaskCard,
  ProjectsList,
  TasksKanban,
  TasksList,
  ProjectFormDialog,
  TaskFormDialog,
  ProjectDetailDialog,
  TaskDetailDialog
} from './projects';

// Alias for backwards compatibility
const TaskList = TasksList;

const ProjectsModule = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Use translations from config
  const t = getProjectTranslations(isRTL);

  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showProjectDetailDialog, setShowProjectDetailDialog] = useState(false);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  const [showFinancialsDialog, setShowFinancialsDialog] = useState(false);
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [financialsProject, setFinancialsProject] = useState(null);

  const [projectForm, setProjectForm] = useState(INITIAL_PROJECT_FORM);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM);

  // Status colors from config
  const statusColors = STATUS_COLORS;
  const priorityColors = PRIORITY_COLORS;

  const [newComment, setNewComment] = useState('');

  const statusIcons = {
    planning: Circle,
    in_progress: PlayCircle,
    on_hold: PauseCircle,
    completed: CheckCircle,
    cancelled: AlertCircle,
    todo: Circle,
    review: Eye
  };

  // Real-time sync
  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type === 'project_updated' || message.type === 'task_updated') {
      fetchProjects();
      fetchTasks();
      fetchMyTasks();
      fetchStats();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
    fetchMyTasks();
    fetchStats();
    fetchEmployees();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/tasks/projects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/tasks/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(response.data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/tasks/my-tasks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMyTasks(response.data || []);
    } catch (error) {
      console.error('Error fetching my tasks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/tasks/dashboard/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/hr/employees`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Handle paginated response
      const employeesData = response.data?.data || response.data || [];
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const handleCreateProject = async () => {
    try {
      await axios.post(
        `${API_URL}/api/tasks/projects`,
        projectForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إنشاء المشروع' : 'Project created');
      setShowProjectDialog(false);
      resetProjectForm();
      fetchProjects();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating project');
    }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(
        `${API_URL}/api/tasks/projects/${editingProject.id}`,
        projectForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم تحديث المشروع' : 'Project updated');
      setShowProjectDialog(false);
      setEditingProject(null);
      resetProjectForm();
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد؟ سيتم حذف جميع المهام المرتبطة.' : 'Are you sure? All related tasks will be deleted.')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/tasks/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف المشروع' : 'Project deleted');
      fetchProjects();
      fetchTasks();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting project');
    }
  };

  const handleCreateTask = async () => {
    try {
      await axios.post(
        `${API_URL}/api/tasks/`,
        taskForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إنشاء المهمة' : 'Task created');
      setShowTaskDialog(false);
      resetTaskForm();
      fetchTasks();
      fetchMyTasks();
      fetchProjects();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating task');
    }
  };

  // Export projects to CSV
  const handleExportProjectsCSV = () => {
    const headers = [
      isRTL ? 'المشروع' : 'Project',
      isRTL ? 'الوصف' : 'Description',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'التقدم' : 'Progress',
      isRTL ? 'عدد المهام' : 'Tasks',
      isRTL ? 'تاريخ البدء' : 'Start Date',
      isRTL ? 'تاريخ الانتهاء' : 'End Date'
    ];
    
    const rows = projects.map(p => [
      p.name,
      p.description || '',
      p.status,
      `${p.progress || 0}%`,
      p.task_count || 0,
      p.start_date || '-',
      p.end_date || '-'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projects_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير المشاريع' : 'Projects exported');
  };

  // Export tasks to CSV
  const handleExportTasksCSV = () => {
    const headers = [
      isRTL ? 'المهمة' : 'Task',
      isRTL ? 'المشروع' : 'Project',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'الأولوية' : 'Priority',
      isRTL ? 'تاريخ الاستحقاق' : 'Due Date',
      isRTL ? 'المكلف' : 'Assignee'
    ];
    
    const rows = tasks.map(t => [
      t.title,
      t.project_name || '-',
      t.status,
      t.priority,
      t.due_date || '-',
      t.assigned_to_name || '-'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير المهام' : 'Tasks exported');
  };

  // Print project summary
  const handlePrintProject = async (project) => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);

    // ── Fetch financial data ──────────────────────────────
    let financials = null;
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${project.id}/financials`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) financials = await res.json();
    } catch {}

    const expenses     = financials?.expenses || [];
    const revenues     = financials?.revenues || [];
    const totalExp     = financials?.total_expenses || 0;
    const totalRev     = financials?.total_revenues || 0;
    const profitLoss   = financials?.profit_loss || 0;
    const budget       = project.budget || 0;

    const fmt = (n) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 });

    const EXP_CAT = {
      labor:'عمالة', materials:'مواد', equipment:'معدات', subcontractor:'مقاول فرعي',
      consulting:'استشارات', transportation:'نقل', utilities:'مرافق', permits:'تصاريح',
      insurance:'تأمين', other:'أخرى'
    };
    const REV_CAT = {
      payment:'دفعة عميل', advance:'دفعة مقدمة', milestone:'مستخلص',
      final_payment:'دفعة نهائية', variation:'أعمال إضافية', other:'أخرى'
    };

    const expenseRows = expenses.map(e => `
      <tr>
        <td>${e.date || '—'}</td>
        <td>${isRTL ? (EXP_CAT[e.category] || e.category) : e.category}</td>
        <td>${e.description || '—'}</td>
        <td style="text-align:left">${fmt(e.amount)} ج.م</td>
      </tr>`).join('');

    const revenueRows = revenues.map(r => `
      <tr>
        <td>${r.date || '—'}</td>
        <td>${isRTL ? (REV_CAT[r.category] || r.category) : r.category}</td>
        <td>${r.description || '—'}</td>
        <td style="text-align:left">${fmt(r.amount)} ج.م</td>
      </tr>`).join('');

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${project.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 24px; direction: ${isRTL ? 'rtl' : 'ltr'}; color: #1a202c; font-size: 13px; }
          .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1e3a8a; }
          .header h1 { font-size: 22px; color: #1e3a8a; margin-bottom: 4px; }
          .header p  { color: #4a5568; font-size: 12px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 15px; font-weight: bold; color: #1e3a8a; border-bottom: 2px solid #bee3f8; padding-bottom: 6px; margin-bottom: 12px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
          .kpi { background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi .val { font-size: 18px; font-weight: 900; color: #1e3a8a; }
          .kpi .lbl { font-size: 11px; color: #4a5568; margin-top: 2px; }
          .kpi.profit  { background: #f0fff4; border-color: #9ae6b4; }
          .kpi.loss    { background: #fff5f5; border-color: #fed7d7; }
          .kpi.neutral { background: #f7fafc; border-color: #e2e8f0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; }
          th { background: #edf2f7; font-weight: bold; color: #2d3748; }
          tr:nth-child(even) { background: #f7fafc; }
          .total-row { background: #ebf8ff !important; font-weight: bold; }
          .profit-row { background: #f0fff4 !important; font-weight: bold; color: #276749; }
          .loss-row   { background: #fff5f5 !important; font-weight: bold; color: #c53030; }
          .progress-bar { height: 16px; background: #e2e8f0; border-radius: 8px; overflow: hidden; margin: 8px 0; }
          .progress-fill { height: 100%; background: #48bb78; border-radius: 8px; }
          .footer { margin-top: 40px; text-align: center; color: #718096; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>

        <!-- HEADER -->
        <div class="header">
          <h1>${project.name}</h1>
          <p>${project.description || ''}</p>
          <p style="margin-top:6px; font-size:11px; color:#718096">
            ${isRTL ? 'تاريخ التقرير:' : 'Report Date:'} ${new Date().toLocaleDateString('ar-EG')}
            &nbsp;|&nbsp;
            ${isRTL ? 'حالة المشروع:' : 'Status:'} ${project.status || '—'}
            ${project.start_date ? `&nbsp;|&nbsp; ${isRTL?'البداية:':'Start:'} ${project.start_date}` : ''}
            ${project.end_date   ? `&nbsp;|&nbsp; ${isRTL?'النهاية:':'End:'} ${project.end_date}` : ''}
          </p>
        </div>

        <!-- PROGRESS -->
        <div class="section">
          <p style="font-weight:bold; margin-bottom:6px">${isRTL ? 'التقدم:' : 'Progress:'} ${project.progress || 0}%</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, project.progress || 0)}%"></div>
          </div>
        </div>

        <!-- FINANCIAL KPIs -->
        <div class="kpis">
          <div class="kpi">
            <div class="val">${fmt(totalRev)} ج.م</div>
            <div class="lbl">${isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}</div>
          </div>
          <div class="kpi">
            <div class="val">${fmt(totalExp)} ج.م</div>
            <div class="lbl">${isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}</div>
          </div>
          <div class="kpi ${profitLoss >= 0 ? 'profit' : 'loss'}">
            <div class="val" style="color:${profitLoss >= 0 ? '#276749' : '#c53030'}">${fmt(Math.abs(profitLoss))} ج.م</div>
            <div class="lbl">${profitLoss >= 0 ? (isRTL?'صافي الربح':'Net Profit') : (isRTL?'صافي الخسارة':'Net Loss')}</div>
          </div>
          <div class="kpi neutral">
            <div class="val">${fmt(budget)} ج.م</div>
            <div class="lbl">${isRTL ? 'الميزانية المعتمدة' : 'Approved Budget'}</div>
          </div>
        </div>

        <!-- REVENUES TABLE -->
        <div class="section">
          <div class="section-title">💰 ${isRTL ? 'الإيرادات' : 'Revenues'} (${revenues.length})</div>
          ${revenues.length === 0 ? `<p style="color:#718096; font-size:12px">${isRTL?'لا توجد إيرادات مسجلة':'No revenues recorded'}</p>` : `
          <table>
            <thead>
              <tr>
                <th>${isRTL ? 'التاريخ' : 'Date'}</th>
                <th>${isRTL ? 'النوع' : 'Category'}</th>
                <th>${isRTL ? 'الوصف' : 'Description'}</th>
                <th>${isRTL ? 'المبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              ${revenueRows}
              <tr class="total-row">
                <td colspan="3">${isRTL ? 'إجمالي الإيرادات' : 'Total Revenues'}</td>
                <td>${fmt(totalRev)} ج.م</td>
              </tr>
            </tbody>
          </table>`}
        </div>

        <!-- EXPENSES TABLE -->
        <div class="section">
          <div class="section-title">📋 ${isRTL ? 'المصروفات' : 'Expenses'} (${expenses.length})</div>
          ${expenses.length === 0 ? `<p style="color:#718096; font-size:12px">${isRTL?'لا توجد مصروفات مسجلة':'No expenses recorded'}</p>` : `
          <table>
            <thead>
              <tr>
                <th>${isRTL ? 'التاريخ' : 'Date'}</th>
                <th>${isRTL ? 'التصنيف' : 'Category'}</th>
                <th>${isRTL ? 'الوصف' : 'Description'}</th>
                <th>${isRTL ? 'المبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows}
              <tr class="total-row">
                <td colspan="3">${isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}</td>
                <td>${fmt(totalExp)} ج.م</td>
              </tr>
            </tbody>
          </table>`}
        </div>

        <!-- PROFIT/LOSS SUMMARY -->
        <div class="section">
          <div class="section-title">📊 ${isRTL ? 'ملخص الربح والخسارة' : 'Profit & Loss Summary'}</div>
          <table>
            <tbody>
              <tr>
                <td>${isRTL ? 'إجمالي الإيرادات' : 'Total Revenues'}</td>
                <td style="text-align:left; font-weight:bold; color:#276749">${fmt(totalRev)} ج.م</td>
              </tr>
              <tr>
                <td>${isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}</td>
                <td style="text-align:left; font-weight:bold; color:#c53030">${fmt(totalExp)} ج.م</td>
              </tr>
              <tr class="${profitLoss >= 0 ? 'profit-row' : 'loss-row'}">
                <td>${profitLoss >= 0 ? (isRTL?'صافي الربح':'Net Profit') : (isRTL?'صافي الخسارة':'Net Loss')}</td>
                <td style="text-align:left">${fmt(Math.abs(profitLoss))} ج.م</td>
              </tr>
              ${budget > 0 ? `
              <tr>
                <td>${isRTL ? 'الميزانية المعتمدة' : 'Approved Budget'}</td>
                <td style="text-align:left">${fmt(budget)} ج.م</td>
              </tr>
              <tr>
                <td>${isRTL ? 'المتبقي من الميزانية' : 'Budget Remaining'}</td>
                <td style="text-align:left; font-weight:bold">${fmt(budget - totalExp)} ج.م</td>
              </tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- TASKS TABLE -->
        <div class="section">
          <div class="section-title">✅ ${isRTL ? 'المهام' : 'Tasks'} (${projectTasks.length})</div>
          ${projectTasks.length === 0 ? `<p style="color:#718096; font-size:12px">${isRTL?'لا توجد مهام':'No tasks'}</p>` : `
          <table>
            <thead>
              <tr>
                <th>${isRTL ? 'المهمة' : 'Task'}</th>
                <th>${isRTL ? 'الحالة' : 'Status'}</th>
                <th>${isRTL ? 'الأولوية' : 'Priority'}</th>
                <th>${isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
              </tr>
            </thead>
            <tbody>
              ${projectTasks.map(t => `
                <tr>
                  <td>${t.title || '—'}</td>
                  <td>${t.status || '—'}</td>
                  <td>${t.priority || '—'}</td>
                  <td>${t.due_date || '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>`}
        </div>

        <div class="footer">
          <p>DataLife Account ERP — datalifeaccount.com | ${new Date().toLocaleDateString('ar-EG', {year:'numeric',month:'long',day:'numeric'})}</p>
        </div>

      </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // Export project to PDF
    // Export project to PDF (html2pdf with full financial data)
  const handleExportProjectPDF = async (project) => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);

    // Fetch financial data
    let financials = null;
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${project.id}/financials`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) financials = await res.json();
    } catch {}

    const expenses   = financials?.expenses || [];
    const revenues   = financials?.revenues || [];
    const totalExp   = financials?.total_expenses || 0;
    const totalRev   = financials?.total_revenues || 0;
    const profitLoss = financials?.profit_loss || 0;
    const budget     = project.budget || 0;

    const fmt = (n) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 });

    const EXP_CAT = { labor:'عمالة', materials:'مواد', equipment:'معدات', subcontractor:'مقاول فرعي', consulting:'استشارات', transportation:'نقل', utilities:'مرافق', permits:'تصاريح', insurance:'تأمين', other:'أخرى' };
    const REV_CAT = { payment:'دفعة عميل', advance:'دفعة مقدمة', milestone:'مستخلص', final_payment:'دفعة نهائية', variation:'أعمال إضافية', other:'أخرى' };

    const tableStyle = 'width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px';
    const thStyle    = 'border:1px solid #e2e8f0;padding:8px 10px;background:#edf2f7;font-weight:bold;';
    const tdStyle    = 'border:1px solid #e2e8f0;padding:8px 10px;';

    const pdfContent = `
      <div style="font-family:Arial,sans-serif;padding:20px;direction:${isRTL?'rtl':'ltr'};color:#1a202c;">

        <div style="text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #1e3a8a;">
          <h1 style="margin:0;color:#1e3a8a;font-size:20px">${project.name}</h1>
          <p style="color:#4a5568;font-size:12px;margin-top:4px">${project.description || ''}</p>
          <p style="color:#718096;font-size:11px;margin-top:4px">
            ${isRTL?'تاريخ التقرير:':'Report Date:'} ${new Date().toLocaleDateString('ar-EG')} |
            ${isRTL?'الحالة:':'Status:'} ${project.status || '—'}
          </p>
        </div>

        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
          <div style="background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:16px;font-weight:900;color:#1e3a8a">${fmt(totalRev)} ج.م</div>
            <div style="font-size:10px;color:#4a5568;margin-top:2px">${isRTL?'إجمالي الإيرادات':'Total Revenue'}</div>
          </div>
          <div style="background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:16px;font-weight:900;color:#1e3a8a">${fmt(totalExp)} ج.م</div>
            <div style="font-size:10px;color:#4a5568;margin-top:2px">${isRTL?'إجمالي المصروفات':'Total Expenses'}</div>
          </div>
          <div style="background:${profitLoss>=0?'#f0fff4':'#fff5f5'};border:1px solid ${profitLoss>=0?'#9ae6b4':'#fed7d7'};border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:16px;font-weight:900;color:${profitLoss>=0?'#276749':'#c53030'}">${fmt(Math.abs(profitLoss))} ج.م</div>
            <div style="font-size:10px;color:#4a5568;margin-top:2px">${profitLoss>=0?(isRTL?'صافي الربح':'Net Profit'):(isRTL?'صافي الخسارة':'Net Loss')}</div>
          </div>
          <div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:16px;font-weight:900;color:#1e3a8a">${fmt(budget)} ج.م</div>
            <div style="font-size:10px;color:#4a5568;margin-top:2px">${isRTL?'الميزانية':'Budget'}</div>
          </div>
        </div>

        <!-- REVENUES -->
        <h3 style="color:#1e3a8a;border-bottom:2px solid #bee3f8;padding-bottom:6px;margin-bottom:10px;font-size:14px">
          💰 ${isRTL?'الإيرادات':'Revenues'} (${revenues.length})
        </h3>
        ${revenues.length === 0
          ? `<p style="color:#718096;font-size:12px;margin-bottom:16px">${isRTL?'لا توجد إيرادات مسجلة':'No revenues recorded'}</p>`
          : `<table style="${tableStyle}">
              <thead><tr>
                <th style="${thStyle}">${isRTL?'التاريخ':'Date'}</th>
                <th style="${thStyle}">${isRTL?'النوع':'Category'}</th>
                <th style="${thStyle}">${isRTL?'الوصف':'Description'}</th>
                <th style="${thStyle}">${isRTL?'المبلغ':'Amount'}</th>
              </tr></thead>
              <tbody>
                ${revenues.map(r => `<tr>
                  <td style="${tdStyle}">${r.date||'—'}</td>
                  <td style="${tdStyle}">${isRTL?(REV_CAT[r.category]||r.category):r.category}</td>
                  <td style="${tdStyle}">${r.description||'—'}</td>
                  <td style="${tdStyle};font-weight:bold;color:#276749">${fmt(r.amount)} ج.م</td>
                </tr>`).join('')}
                <tr style="background:#f0fff4">
                  <td colspan="3" style="${tdStyle};font-weight:bold">${isRTL?'إجمالي الإيرادات':'Total Revenues'}</td>
                  <td style="${tdStyle};font-weight:bold;color:#276749">${fmt(totalRev)} ج.م</td>
                </tr>
              </tbody>
            </table>`}

        <!-- EXPENSES -->
        <h3 style="color:#1e3a8a;border-bottom:2px solid #bee3f8;padding-bottom:6px;margin-bottom:10px;font-size:14px">
          📋 ${isRTL?'المصروفات':'Expenses'} (${expenses.length})
        </h3>
        ${expenses.length === 0
          ? `<p style="color:#718096;font-size:12px;margin-bottom:16px">${isRTL?'لا توجد مصروفات مسجلة':'No expenses recorded'}</p>`
          : `<table style="${tableStyle}">
              <thead><tr>
                <th style="${thStyle}">${isRTL?'التاريخ':'Date'}</th>
                <th style="${thStyle}">${isRTL?'التصنيف':'Category'}</th>
                <th style="${thStyle}">${isRTL?'الوصف':'Description'}</th>
                <th style="${thStyle}">${isRTL?'المبلغ':'Amount'}</th>
              </tr></thead>
              <tbody>
                ${expenses.map(e => `<tr>
                  <td style="${tdStyle}">${e.date||'—'}</td>
                  <td style="${tdStyle}">${isRTL?(EXP_CAT[e.category]||e.category):e.category}</td>
                  <td style="${tdStyle}">${e.description||'—'}</td>
                  <td style="${tdStyle};font-weight:bold;color:#c53030">${fmt(e.amount)} ج.م</td>
                </tr>`).join('')}
                <tr style="background:#fff5f5">
                  <td colspan="3" style="${tdStyle};font-weight:bold">${isRTL?'إجمالي المصروفات':'Total Expenses'}</td>
                  <td style="${tdStyle};font-weight:bold;color:#c53030">${fmt(totalExp)} ج.م</td>
                </tr>
              </tbody>
            </table>`}

        <!-- P&L SUMMARY -->
        <h3 style="color:#1e3a8a;border-bottom:2px solid #bee3f8;padding-bottom:6px;margin-bottom:10px;font-size:14px">
          📊 ${isRTL?'ملخص الربح والخسارة':'Profit & Loss'}
        </h3>
        <table style="${tableStyle}">
          <tbody>
            <tr><td style="${tdStyle}">${isRTL?'إجمالي الإيرادات':'Revenues'}</td><td style="${tdStyle};font-weight:bold;color:#276749">${fmt(totalRev)} ج.م</td></tr>
            <tr><td style="${tdStyle}">${isRTL?'إجمالي المصروفات':'Expenses'}</td><td style="${tdStyle};font-weight:bold;color:#c53030">${fmt(totalExp)} ج.م</td></tr>
            <tr style="background:${profitLoss>=0?'#f0fff4':'#fff5f5'}">
              <td style="${tdStyle};font-weight:bold">${profitLoss>=0?(isRTL?'صافي الربح':'Net Profit'):(isRTL?'صافي الخسارة':'Net Loss')}</td>
              <td style="${tdStyle};font-weight:bold;color:${profitLoss>=0?'#276749':'#c53030'}">${fmt(Math.abs(profitLoss))} ج.م</td>
            </tr>
            ${budget > 0 ? `
            <tr><td style="${tdStyle}">${isRTL?'الميزانية المعتمدة':'Approved Budget'}</td><td style="${tdStyle}">${fmt(budget)} ج.م</td></tr>
            <tr><td style="${tdStyle}">${isRTL?'المتبقي من الميزانية':'Budget Remaining'}</td><td style="${tdStyle};font-weight:bold">${fmt(budget - totalExp)} ج.م</td></tr>` : ''}
          </tbody>
        </table>

        <!-- TASKS -->
        <h3 style="color:#1e3a8a;border-bottom:2px solid #bee3f8;padding-bottom:6px;margin-bottom:10px;font-size:14px">
          ✅ ${isRTL?'المهام':'Tasks'} (${projectTasks.length})
        </h3>
        ${projectTasks.length === 0
          ? `<p style="color:#718096;font-size:12px">${isRTL?'لا توجد مهام':'No tasks'}</p>`
          : `<table style="${tableStyle}">
              <thead><tr>
                <th style="${thStyle}">${isRTL?'المهمة':'Task'}</th>
                <th style="${thStyle}">${isRTL?'الحالة':'Status'}</th>
                <th style="${thStyle}">${isRTL?'الأولوية':'Priority'}</th>
                <th style="${thStyle}">${isRTL?'الاستحقاق':'Due Date'}</th>
              </tr></thead>
              <tbody>
                ${projectTasks.map(t => `<tr>
                  <td style="${tdStyle}">${t.title||'—'}</td>
                  <td style="${tdStyle}">${t.status||'—'}</td>
                  <td style="${tdStyle}">${t.priority||'—'}</td>
                  <td style="${tdStyle}">${t.due_date||'—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>`}

        <div style="margin-top:32px;text-align:center;color:#718096;font-size:11px;border-top:1px solid #e2e8f0;padding-top:10px">
          DataLife Account ERP — datalifeaccount.com | ${new Date().toLocaleDateString('ar-EG', {year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>`;

    // Use html2pdf if available, fallback to print
    if (window.html2pdf) {
      const element = document.createElement('div');
      element.innerHTML = pdfContent;
      document.body.appendChild(element);
      const opt = {
        margin: 8,
        filename: `project_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(element);
      });
    } else {
      // Fallback: print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pdfContent}</body></html>`);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
    toast.success(isRTL ? 'تم تصدير التقرير المالي للمشروع' : 'Project financial report exported');
  };

  
  const handleUpdateTask = async (taskId, updates) => {
    try {
      await axios.put(
        `${API_URL}/api/tasks/${taskId}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم تحديث المهمة' : 'Task updated');
      fetchTasks();
      fetchMyTasks();
      fetchProjects();
      fetchStats();
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, ...updates });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف المهمة' : 'Task deleted');
      setShowTaskDetailDialog(false);
      fetchTasks();
      fetchMyTasks();
      fetchProjects();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting task');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    
    try {
      await axios.post(
        `${API_URL}/api/tasks/${selectedTask.id}/comments`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      // Refresh task details
      const response = await axios.get(
        `${API_URL}/api/tasks/${selectedTask.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedTask(response.data);
    } catch (error) {
      toast.error('Error adding comment');
    }
  };

  // Update task status
  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(
        `${API_URL}/api/tasks/${taskId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم تحديث الحالة' : 'Status updated');
      fetchTasks();
      fetchMyTasks();
      fetchStats();
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating status');
    }
  };

  // Add comment to task (for dialog)
  const handleAddTaskComment = async (taskId, comment) => {
    try {
      await axios.post(
        `${API_URL}/api/tasks/${taskId}/comments`,
        { text: comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إضافة التعليق' : 'Comment added');
      // Refresh task details
      const response = await axios.get(
        `${API_URL}/api/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedTask(response.data);
    } catch (error) {
      toast.error('Error adding comment');
    }
  };

  // Open edit project dialog
  const openEditProjectDialog = (project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'medium',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budget: project.budget || '',
      manager_id: project.manager_id || '',
      team_members: project.team_members || []
    });
    setShowProjectDialog(true);
  };

  // Open financials dialog
  const openFinancialsDialog = (project) => {
    setFinancialsProject(project);
    setShowFinancialsDialog(true);
  };

  const resetProjectForm = () => {
    setProjectForm({
      name: '', description: '', priority: 'medium', start_date: '', end_date: '', budget: '', manager_id: '', team_members: []
    });
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '', description: '', project_id: '', priority: 'medium', assigned_to: '', due_date: '', estimated_hours: ''
    });
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'medium',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budget: project.budget || '',
      manager_id: project.manager_id || '',
      team_members: project.team_members || []
    });
    setShowProjectDialog(true);
  };

  const viewProjectDetails = async (projectId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/tasks/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedProject(response.data);
      setShowProjectDetailDialog(true);
    } catch (error) {
      toast.error('Error loading project');
    }
  };

  const viewTaskDetails = async (taskId) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedTask(response.data);
      setShowTaskDetailDialog(true);
    } catch (error) {
      toast.error('Error loading task');
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'} data-testid="projects-module">
      {/* Header */}
      <ProjectsHeader
        isRTL={isRTL}
        isConnected={isConnected}
        onExport={handleExportProjectsCSV}
        onNewTask={() => setShowTaskDialog(true)}
        onNewProject={() => setShowProjectDialog(true)}
        t={t}
      />

      {/* Stats */}
      <ProjectsStats
        projects={projects}
        tasks={tasks}
        stats={stats}
        t={t}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="projects" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            {t.projects}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            {t.tasks}
          </TabsTrigger>
          <TabsTrigger value="my-tasks" className="gap-2">
            <User className="h-4 w-4" />
            {t.myTasks}
            {myTasks.length > 0 && <Badge className="ml-1 bg-blue-500">{myTasks.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <ProjectsList
              projects={projects}
              t={t}
              isRTL={isRTL}
              onView={viewProjectDetails}
              onEdit={openEditProjectDialog}
              onDelete={handleDeleteProject}
              onViewFinancials={openFinancialsDialog}
              onPrint={handlePrintProject}
              onExportPDF={handleExportProjectPDF}
            />
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <TaskList tasks={tasks} t={t} statusColors={statusColors} priorityColors={priorityColors} statusIcons={statusIcons}
            onView={viewTaskDetails} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} isRTL={isRTL} projects={projects} />
        </TabsContent>

        {/* My Tasks Tab */}
        <TabsContent value="my-tasks" className="mt-4">
          <TaskList tasks={myTasks} t={t} statusColors={statusColors} priorityColors={priorityColors} statusIcons={statusIcons}
            onView={viewTaskDetails} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} isRTL={isRTL} projects={projects} isMyTasks />
        </TabsContent>
      </Tabs>

      {/* Project Financials Dialog */}
      <Dialog open={showFinancialsDialog} onOpenChange={setShowFinancialsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          {financialsProject && (
            <ProjectFinancialsModule 
              projectId={financialsProject.id} 
              projectName={financialsProject.name}
              onClose={() => setShowFinancialsDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Project Form Dialog */}
      <ProjectFormDialog
        open={showProjectDialog}
        onOpenChange={(open) => { 
          setShowProjectDialog(open); 
          if (!open) { setEditingProject(null); resetProjectForm(); }
        }}
        form={projectForm}
        setForm={setProjectForm}
        onSave={editingProject ? handleUpdateProject : handleCreateProject}
        isEditing={!!editingProject}
        employees={employees}
        t={t}
        isRTL={isRTL}
      />

      {/* Task Form Dialog */}
      <TaskFormDialog
        open={showTaskDialog}
        onOpenChange={(open) => { 
          setShowTaskDialog(open); 
          if (!open) { setEditingTask(null); resetTaskForm(); }
        }}
        form={taskForm}
        setForm={setTaskForm}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        isEditing={!!editingTask}
        projects={projects}
        employees={employees}
        t={t}
        isRTL={isRTL}
      />

      {/* Project Detail Dialog */}
      <ProjectDetailDialog
        open={showProjectDetailDialog}
        onOpenChange={setShowProjectDetailDialog}
        project={selectedProject}
        t={t}
        isRTL={isRTL}
        onViewTask={viewTaskDetails}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={showTaskDetailDialog}
        onOpenChange={setShowTaskDetailDialog}
        task={selectedTask}
        projects={projects}
        t={t}
        isRTL={isRTL}
        onUpdateStatus={handleUpdateTaskStatus}
        onDelete={handleDeleteTask}
        onAddComment={handleAddTaskComment}
      />
    </div>
  );
};

export default ProjectsModule;
