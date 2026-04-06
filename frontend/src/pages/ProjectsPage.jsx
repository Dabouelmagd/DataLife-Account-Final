import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, Plus, Search, Filter, Calendar, Users, 
  CheckCircle, Clock, AlertCircle, MoreVertical, Trash2, Edit,
  Calculator, DollarSign
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { toast } from 'sonner';
import ProjectFinancialsModule from '../components/ProjectFinancialsModule';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const getToken = () => localStorage.getItem('token');

export default function ProjectsPage({ language = 'en' }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFinancialsDialog, setShowFinancialsDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', status: 'active' });

  const text = {
    ar: {
      title: 'المشاريع والمهام',
      subtitle: 'إدارة المشاريع ومتابعة المهام',
      addProject: 'مشروع جديد',
      search: 'بحث...',
      projectName: 'اسم المشروع',
      description: 'الوصف',
      status: 'الحالة',
      startDate: 'تاريخ البدء',
      endDate: 'تاريخ الانتهاء',
      tasks: 'المهام',
      team: 'الفريق',
      progress: 'التقدم',
      active: 'نشط',
      completed: 'مكتمل',
      onHold: 'معلق',
      cancelled: 'ملغي',
      save: 'حفظ',
      cancel: 'إلغاء',
      noProjects: 'لا توجد مشاريع',
      noProjectsDesc: 'ابدأ بإضافة مشروع جديد',
      financials: 'الحسابات المالية',
      viewFinancials: 'عرض الحسابات'
    },
    en: {
      title: 'Projects & Tasks',
      subtitle: 'Manage projects and track tasks',
      addProject: 'New Project',
      search: 'Search...',
      projectName: 'Project Name',
      description: 'Description',
      status: 'Status',
      startDate: 'Start Date',
      endDate: 'End Date',
      tasks: 'Tasks',
      team: 'Team',
      progress: 'Progress',
      active: 'Active',
      completed: 'Completed',
      onHold: 'On Hold',
      cancelled: 'Cancelled',
      save: 'Save',
      cancel: 'Cancel',
      noProjects: 'No Projects',
      noProjectsDesc: 'Start by adding a new project',
      financials: 'Financial Accounts',
      viewFinancials: 'View Financials'
    }
  }[language];

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProject)
      });
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم إضافة المشروع بنجاح' : 'Project added successfully');
        setShowModal(false);
        setNewProject({ name: '', description: '', status: 'active' });
        fetchProjects();
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || colors.active;
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: <Clock className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      on_hold: <AlertCircle className="w-4 h-4" />,
      cancelled: <AlertCircle className="w-4 h-4" />
    };
    return icons[status] || icons.active;
  };

  const filteredProjects = projects.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Demo projects for display
  const demoProjects = [
    { id: 1, name: language === 'ar' ? 'تطوير النظام' : 'System Development', status: 'active', progress: 65, tasks: 12, team: 4 },
    { id: 2, name: language === 'ar' ? 'تحديث الموقع' : 'Website Update', status: 'completed', progress: 100, tasks: 8, team: 2 },
    { id: 3, name: language === 'ar' ? 'تدريب الموظفين' : 'Employee Training', status: 'on_hold', progress: 30, tasks: 5, team: 3 },
  ];

  const displayProjects = filteredProjects.length > 0 ? filteredProjects : demoProjects;

  return (
    <div className="p-6 space-y-6" data-testid="projects-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderKanban className="w-7 h-7 text-indigo-600" />
            {text.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{text.subtitle}</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          {text.addProject}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={text.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : displayProjects.length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{text.noProjects}</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{text.noProjectsDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(project.status)}`}>
                    {getStatusIcon(project.status)}
                    {text[project.status] || project.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {project.description || (language === 'ar' ? 'لا يوجد وصف' : 'No description')}
                </p>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{text.progress}</span>
                    <span className="font-medium">{project.progress || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${project.progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {project.tasks || 0} {text.tasks}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {project.team || 0} {text.team}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="mt-4 pt-3 border-t flex justify-end gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setSelectedProject(project); setShowFinancialsDialog(true); }}
                    title={text.viewFinancials}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Calculator className="h-4 w-4" />
                    <span className="mx-1 text-xs">{text.financials}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">{text.addProject}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{text.projectName}</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{text.description}</label>
                <textarea
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{text.status}</label>
                <select
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                >
                  <option value="active">{text.active}</option>
                  <option value="on_hold">{text.onHold}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                {text.cancel}
              </Button>
              <Button onClick={handleAddProject} className="bg-indigo-600 hover:bg-indigo-700">
                {text.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Project Financials Dialog */}
      <Dialog open={showFinancialsDialog} onOpenChange={setShowFinancialsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {selectedProject && (
            <ProjectFinancialsModule 
              projectId={selectedProject.id} 
              projectName={selectedProject.name}
              onClose={() => setShowFinancialsDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
