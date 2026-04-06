/**
 * useProjects Hook
 * Custom hook for projects and tasks management
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import useRealTimeSync from './useRealTimeSync';
import { INITIAL_PROJECT_FORM, INITIAL_TASK_FORM } from '../config/projectsConfig';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useProjects = () => {
  const { token, user } = useAuth();
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selected items
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Form states
  const [projectForm, setProjectForm] = useState(INITIAL_PROJECT_FORM);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // Request config
  const config = { headers: { Authorization: `Bearer ${token}` } };

  // Real-time sync handler
  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type === 'project_updated' || message.type === 'task_updated') {
      fetchProjects();
      fetchTasks();
      fetchMyTasks();
      fetchStats();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  // Fetch functions
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/tasks/projects`, config);
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/`, config);
      setTasks(response.data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/my-tasks`, config);
      setMyTasks(response.data || []);
    } catch (error) {
      console.error('Error fetching my tasks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/stats`, config);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/hr/employees`, config);
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAll = () => {
    fetchProjects();
    fetchTasks();
    fetchMyTasks();
    fetchStats();
    fetchEmployees();
  };

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, []);

  // CRUD Operations - Projects
  const createProject = async (data) => {
    try {
      await axios.post(`${API_URL}/api/tasks/projects`, data, config);
      toast.success('Project created successfully');
      fetchProjects();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating project');
      return false;
    }
  };

  const updateProject = async (projectId, data) => {
    try {
      await axios.put(`${API_URL}/api/tasks/projects/${projectId}`, data, config);
      toast.success('Project updated successfully');
      fetchProjects();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating project');
      return false;
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await axios.delete(`${API_URL}/api/tasks/projects/${projectId}`, config);
      toast.success('Project deleted successfully');
      fetchProjects();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting project');
      return false;
    }
  };

  const getProjectDetails = async (projectId) => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/projects/${projectId}`, config);
      setSelectedProject(response.data);
      return response.data;
    } catch (error) {
      toast.error('Error loading project');
      return null;
    }
  };

  // CRUD Operations - Tasks
  const createTask = async (data) => {
    try {
      await axios.post(`${API_URL}/api/tasks/`, data, config);
      toast.success('Task created successfully');
      fetchTasks();
      fetchMyTasks();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating task');
      return false;
    }
  };

  const updateTask = async (taskId, data) => {
    try {
      await axios.put(`${API_URL}/api/tasks/${taskId}`, data, config);
      toast.success('Task updated successfully');
      fetchTasks();
      fetchMyTasks();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating task');
      return false;
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API_URL}/api/tasks/${taskId}`, config);
      toast.success('Task deleted successfully');
      fetchTasks();
      fetchMyTasks();
      fetchStats();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting task');
      return false;
    }
  };

  const getTaskDetails = async (taskId) => {
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${taskId}`, config);
      setSelectedTask(response.data);
      return response.data;
    } catch (error) {
      toast.error('Error loading task');
      return null;
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(
        `${API_URL}/api/tasks/${taskId}/status`,
        { status },
        config
      );
      toast.success('Task status updated');
      fetchTasks();
      fetchMyTasks();
      fetchStats();
      return true;
    } catch (error) {
      toast.error('Error updating task status');
      return false;
    }
  };

  // Comments
  const addComment = async (taskId, comment) => {
    try {
      await axios.post(
        `${API_URL}/api/tasks/${taskId}/comments`,
        { content: comment },
        config
      );
      toast.success('Comment added');
      return true;
    } catch (error) {
      toast.error('Error adding comment');
      return false;
    }
  };

  // Form helpers
  const resetProjectForm = () => {
    setProjectForm(INITIAL_PROJECT_FORM);
    setEditingProject(null);
  };

  const resetTaskForm = () => {
    setTaskForm(INITIAL_TASK_FORM);
    setEditingTask(null);
  };

  const setProjectFormForEdit = (project) => {
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
  };

  const setTaskFormForEdit = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      project_id: task.project_id || '',
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      estimated_hours: task.estimated_hours || ''
    });
  };

  // Export functions
  const exportProjectsCSV = () => {
    if (projects.length === 0) {
      toast.error('No projects to export');
      return;
    }
    
    const headers = ['Name', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Progress'];
    const rows = projects.map(p => [
      p.name,
      p.status,
      p.priority,
      p.start_date || '',
      p.end_date || '',
      p.budget || '',
      `${p.progress || 0}%`
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projects_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Projects exported successfully');
  };

  return {
    // Data
    projects,
    tasks,
    myTasks,
    stats,
    employees,
    loading,
    isConnected,
    
    // Selected items
    selectedProject,
    selectedTask,
    setSelectedProject,
    setSelectedTask,
    
    // Forms
    projectForm,
    taskForm,
    setProjectForm,
    setTaskForm,
    editingProject,
    editingTask,
    
    // Project operations
    createProject,
    updateProject,
    deleteProject,
    getProjectDetails,
    
    // Task operations
    createTask,
    updateTask,
    deleteTask,
    getTaskDetails,
    updateTaskStatus,
    addComment,
    
    // Form helpers
    resetProjectForm,
    resetTaskForm,
    setProjectFormForEdit,
    setTaskFormForEdit,
    
    // Utilities
    fetchAll,
    exportProjectsCSV
  };
};

export default useProjects;
