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
  const handlePrintProject = (project) => {
    const printWindow = window.open('', '_blank');
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    const content = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${project.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #1a365d; }
          .progress-bar { height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
          .progress-fill { height: 100%; background: #48bb78; border-radius: 10px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { background: #ebf8ff; padding: 15px; border-radius: 8px; text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'}; }
          th { background: #edf2f7; }
          .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
          .footer { margin-top: 40px; text-align: center; color: #718096; font-size: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${project.name}</h1>
          <p>${project.description || ''}</p>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
        </div>
        <p style="text-align: center">${isRTL ? 'التقدم' : 'Progress'}: ${project.progress || 0}%</p>
        
        <div class="stats">
          <div class="stat-card">
            <h3>${projectTasks.length}</h3>
            <p>${isRTL ? 'إجمالي المهام' : 'Total Tasks'}</p>
          </div>
          <div class="stat-card">
            <h3>${projectTasks.filter(t => t.status === 'completed').length}</h3>
            <p>${isRTL ? 'مكتملة' : 'Completed'}</p>
          </div>
          <div class="stat-card">
            <h3>${projectTasks.filter(t => t.status === 'in_progress').length}</h3>
            <p>${isRTL ? 'جارية' : 'In Progress'}</p>
          </div>
          <div class="stat-card">
            <h3>${projectTasks.filter(t => t.status === 'todo').length}</h3>
            <p>${isRTL ? 'قيد الانتظار' : 'To Do'}</p>
          </div>
        </div>
        
        <h3>${isRTL ? 'المهام' : 'Tasks'}</h3>
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
                <td>${t.title}</td>
                <td>${t.status}</td>
                <td>${t.priority}</td>
                <td>${t.due_date || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer"><p>DataLife Account ERP System - ${new Date().toLocaleDateString()}</p></div>
      </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // Export project to PDF
  const handleExportProjectPDF = (project) => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #1a365d;">${project.name}</h1>
          <p style="margin: 10px 0; color: #4a5568;">${project.description || ''}</p>
        </div>
        
        <div style="height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden; margin: 20px 0;">
          <div style="height: 100%; background: #48bb78; border-radius: 10px; width: ${project.progress || 0}%;"></div>
        </div>
        <p style="text-align: center; margin-bottom: 20px;">${isRTL ? 'التقدم' : 'Progress'}: ${project.progress || 0}%</p>
        
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <div style="flex: 1; background: #ebf8ff; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #2b6cb0;">${projectTasks.length}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'إجمالي المهام' : 'Total Tasks'}</p>
          </div>
          <div style="flex: 1; background: #c6f6d5; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #276749;">${projectTasks.filter(t => t.status === 'completed').length}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'مكتملة' : 'Completed'}</p>
          </div>
          <div style="flex: 1; background: #fefcbf; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #975a16;">${projectTasks.filter(t => t.status === 'in_progress').length}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'جارية' : 'In Progress'}</p>
          </div>
          <div style="flex: 1; background: #e9d8fd; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin: 0; font-size: 24px; color: #553c9a;">${projectTasks.filter(t => t.status === 'todo').length}</h3>
            <p style="margin: 5px 0 0; color: #4a5568;">${isRTL ? 'قيد الانتظار' : 'To Do'}</p>
          </div>
        </div>
        
        <h3 style="margin-bottom: 10px;">${isRTL ? 'المهام' : 'Tasks'}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #edf2f7;">
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'المهمة' : 'Task'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الحالة' : 'Status'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'الأولوية' : 'Priority'}</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: ${isRTL ? 'right' : 'left'};">${isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
            </tr>
          </thead>
          <tbody>
            ${projectTasks.map(t => `
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${t.title}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${t.status}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${t.priority}</td>
                <td style="border: 1px solid #e2e8f0; padding: 10px;">${t.due_date || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 40px; text-align: center; color: #718096; font-size: 12px;">
          <p>DataLife Account ERP System - ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = content;
    
    const opt = {
      margin: 10,
      filename: `project_${project.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
    toast.success(isRTL ? 'تم تصدير المشروع PDF' : 'Project exported as PDF');
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
