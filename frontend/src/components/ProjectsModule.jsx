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
import { 
  FolderKanban, Plus, ListTodo, Calendar, Users, Clock, AlertCircle,
  CheckCircle, Circle, PlayCircle, PauseCircle, Trash2, Edit, Eye,
  RefreshCw, Target, TrendingUp, ChevronRight, MessageSquare, Wifi, WifiOff,
  Flag, User, CalendarDays, Timer
} from 'lucide-react';
import useRealTimeSync from '../hooks/useRealTimeSync';

const ProjectsModule = () => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const [projectForm, setProjectForm] = useState({
    name: '', description: '', priority: 'medium', start_date: '', end_date: '', budget: '', manager_id: '', team_members: []
  });

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', project_id: '', priority: 'medium', assigned_to: '', due_date: '', estimated_hours: ''
  });

  const [newComment, setNewComment] = useState('');

  const t = {
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
    project: isRTL ? 'المشروع' : 'Project'
  };

  const statusColors = {
    planning: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    on_hold: 'bg-gray-100 text-gray-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    todo: 'bg-gray-100 text-gray-700',
    review: 'bg-purple-100 text-purple-700'
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-amber-100 text-amber-600',
    urgent: 'bg-red-100 text-red-600'
  };

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
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
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
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.projects}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500">
              {isRTL ? 'إدارة المشاريع والمهام' : 'Manage projects and tasks'}
            </p>
            <Badge variant="outline" className={isConnected ? 'text-green-600 border-green-300' : 'text-gray-400 border-gray-200'}>
              {isConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTaskDialog(true)} className="gap-2">
            <ListTodo className="h-4 w-4" />
            {t.createTask}
          </Button>
          <Button onClick={() => setShowProjectDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.createProject}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FolderKanban className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalProjects}</p>
                <p className="text-2xl font-bold text-blue-900">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <ListTodo className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">{t.totalTasks}</p>
                <p className="text-2xl font-bold text-green-900">{stats?.total_tasks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-600">{t.overdue}</p>
                <p className="text-2xl font-bold text-red-900">{stats?.overdue || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.dueThisWeek}</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.due_this_week || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderKanban className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">{t.noProjects}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const StatusIcon = statusIcons[project.status] || Circle;
                return (
                  <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewProjectDetails(project.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
                        </div>
                        <Badge className={priorityColors[project.priority]}>
                          <Flag className="h-3 w-3 mr-1" />
                          {t[project.priority]}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <Badge className={statusColors[project.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t[project.status]}
                          </Badge>
                          <span className="text-gray-500">
                            {project.tasks_count || 0} {t.tasksCount}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-500">{t.progress}</span>
                            <span className="font-medium">{project.progress || 0}%</span>
                          </div>
                          <Progress value={project.progress || 0} className="h-2" />
                        </div>

                        {project.end_date && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <CalendarDays className="h-4 w-4" />
                            <span>{project.end_date}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEditProject(project)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteProject(project.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={(open) => { setShowProjectDialog(open); if (!open) { setEditingProject(null); resetProjectForm(); }}}>
        <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingProject ? (isRTL ? 'تعديل المشروع' : 'Edit Project') : t.createProject}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.name} *</Label>
              <Input value={projectForm.name} onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea value={projectForm.description} onChange={(e) => setProjectForm({...projectForm, description: e.target.value})} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.priority}</Label>
                <Select value={projectForm.priority} onValueChange={(v) => setProjectForm({...projectForm, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.low}</SelectItem>
                    <SelectItem value="medium">{t.medium}</SelectItem>
                    <SelectItem value="high">{t.high}</SelectItem>
                    <SelectItem value="urgent">{t.urgent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.budget}</Label>
                <Input type="number" value={projectForm.budget} onChange={(e) => setProjectForm({...projectForm, budget: parseFloat(e.target.value) || ''})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.startDate}</Label>
                <Input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm({...projectForm, start_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t.endDate}</Label>
                <Input type="date" value={projectForm.end_date} onChange={(e) => setProjectForm({...projectForm, end_date: e.target.value})} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>{t.cancel}</Button>
            <Button onClick={editingProject ? handleUpdateProject : handleCreateProject} disabled={!projectForm.name}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.createTask}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.title} *</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>{t.project}</Label>
              <Select value={taskForm.project_id} onValueChange={(v) => setTaskForm({...taskForm, project_id: v})}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المشروع' : 'Select Project'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{isRTL ? 'بدون مشروع' : 'No Project'}</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.priority}</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({...taskForm, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.low}</SelectItem>
                    <SelectItem value="medium">{t.medium}</SelectItem>
                    <SelectItem value="high">{t.high}</SelectItem>
                    <SelectItem value="urgent">{t.urgent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.dueDate}</Label>
                <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.assignedTo}</Label>
                <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({...taskForm, assigned_to: v})}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.estimatedHours}</Label>
                <Input type="number" value={taskForm.estimated_hours} onChange={(e) => setTaskForm({...taskForm, estimated_hours: parseFloat(e.target.value) || ''})} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCreateTask} disabled={!taskForm.title}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog */}
      <Dialog open={showProjectDetailDialog} onOpenChange={setShowProjectDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              {selectedProject?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge className={statusColors[selectedProject.status]}>{t[selectedProject.status]}</Badge>
                <Badge className={priorityColors[selectedProject.priority]}>{t[selectedProject.priority]}</Badge>
                <span className="text-sm text-gray-500">{selectedProject.progress}% {t.progress}</span>
              </div>

              {selectedProject.description && (
                <p className="text-gray-600">{selectedProject.description}</p>
              )}

              <Progress value={selectedProject.progress || 0} className="h-3" />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.startDate}</p>
                  <p className="font-medium">{selectedProject.start_date || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.endDate}</p>
                  <p className="font-medium">{selectedProject.end_date || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.budget}</p>
                  <p className="font-medium">{selectedProject.budget ? `${selectedProject.budget.toLocaleString()} EGP` : '-'}</p>
                </div>
              </div>

              {/* Project Tasks */}
              <div>
                <h3 className="font-semibold mb-3">{t.tasks} ({selectedProject.tasks?.length || 0})</h3>
                {selectedProject.tasks?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProject.tasks.map(task => {
                      const TaskStatusIcon = statusIcons[task.status] || Circle;
                      return (
                        <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                          onClick={() => viewTaskDetails(task.id)}>
                          <div className="flex items-center gap-3">
                            <TaskStatusIcon className={`h-4 w-4 ${task.status === 'completed' ? 'text-green-500' : 'text-gray-400'}`} />
                            <span className={task.status === 'completed' ? 'line-through text-gray-400' : ''}>{task.title}</span>
                          </div>
                          <Badge className={priorityColors[task.priority]} variant="outline">{t[task.priority]}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">{t.noTasks}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={showTaskDetailDialog} onOpenChange={setShowTaskDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedTask.status} onValueChange={(v) => handleUpdateTask(selectedTask.id, { status: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{t.todo}</SelectItem>
                    <SelectItem value="in_progress">{t.in_progress}</SelectItem>
                    <SelectItem value="review">{t.review}</SelectItem>
                    <SelectItem value="completed">{t.completed}</SelectItem>
                  </SelectContent>
                </Select>
                <Badge className={priorityColors[selectedTask.priority]}>{t[selectedTask.priority]}</Badge>
                {selectedTask.due_date && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" /> {selectedTask.due_date}
                  </span>
                )}
              </div>

              {selectedTask.description && (
                <p className="text-gray-600">{selectedTask.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedTask.estimated_hours > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">{t.estimatedHours}</p>
                    <p className="font-medium">{selectedTask.estimated_hours}h</p>
                  </div>
                )}
                {selectedTask.project_id && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">{t.project}</p>
                    <p className="font-medium">{projects.find(p => p.id === selectedTask.project_id)?.name || '-'}</p>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t.comments} ({selectedTask.comments?.length || 0})
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {selectedTask.comments?.map(comment => (
                    <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        <span className="text-xs text-gray-400">{comment.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input 
                    placeholder={isRTL ? 'أضف تعليق...' : 'Add a comment...'} 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>{t.addComment}</Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="destructive" onClick={() => handleDeleteTask(selectedTask.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> {t.delete}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Task List Component
const TaskList = ({ tasks, t, statusColors, priorityColors, statusIcons, onView, onUpdate, onDelete, isRTL, projects, isMyTasks }) => {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListTodo className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{t.noTasks}</p>
        </CardContent>
      </Card>
    );
  }

  // Group by status
  const grouped = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed')
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Object.entries(grouped).map(([status, statusTasks]) => {
        const StatusIcon = statusIcons[status] || Circle;
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <StatusIcon className="h-4 w-4" />
              <span className="font-medium">{t[status]}</span>
              <Badge variant="secondary" className="ml-auto">{statusTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px] p-2 bg-gray-50 rounded-lg">
              {statusTasks.map(task => (
                <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(task.id)}>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>
                    <div className="flex items-center justify-between">
                      <Badge className={priorityColors[task.priority]} variant="outline" className="text-xs">
                        {t[task.priority]}
                      </Badge>
                      {task.due_date && (
                        <span className="text-xs text-gray-400">{task.due_date}</span>
                      )}
                    </div>
                    {task.project_id && (
                      <p className="text-xs text-gray-400 mt-2 truncate">
                        {projects.find(p => p.id === task.project_id)?.name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectsModule;
