/**
 * useProjects Hook Tests
 * اختبارات الـ Hook الخاص بإدارة المشاريع والمهام
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects } from '../../hooks/useProjects';
import { LanguageProvider } from '../../contexts/LanguageContext';

// Mock axios before imports
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  })),
  defaults: { headers: { common: {} } }
}));

// Import axios after mock
const axios = require('axios');

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Mock useRealTimeSync
jest.mock('../../hooks/useRealTimeSync', () => ({
  __esModule: true,
  default: () => ({ isConnected: true })
}));

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'user123', name: 'Test User' }
  }),
  AuthProvider: ({ children }) => children
}));

// Test data
const mockProjects = [
  { id: '1', name: 'Project 1', status: 'in_progress', priority: 'high', progress: 50 },
  { id: '2', name: 'Project 2', status: 'planning', priority: 'medium', progress: 0 }
];

const mockTasks = [
  { id: 't1', title: 'Task 1', project_id: '1', status: 'in_progress', priority: 'high' },
  { id: 't2', title: 'Task 2', project_id: '1', status: 'completed', priority: 'low' }
];

const mockStats = {
  total_projects: 2,
  total_tasks: 5,
  overdue_tasks: 1,
  due_this_week: 3
};

// Wrapper component
const wrapper = ({ children }) => (
  <LanguageProvider>
    {children}
  </LanguageProvider>
);

describe('useProjects Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    axios.get.mockImplementation((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ data: mockProjects });
      }
      if (url.includes('/my-tasks')) {
        return Promise.resolve({ data: mockTasks });
      }
      if (url.includes('/stats')) {
        return Promise.resolve({ data: mockStats });
      }
      if (url.includes('/tasks/')) {
        return Promise.resolve({ data: mockTasks });
      }
      if (url.includes('/employees')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('Initial State', () => {
    it('should initialize with empty arrays and loading true', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      expect(result.current.projects).toEqual([]);
      expect(result.current.tasks).toEqual([]);
      expect(result.current.loading).toBe(true);
    });

    it('should have initial form states', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      expect(result.current.projectForm).toBeDefined();
      expect(result.current.taskForm).toBeDefined();
      expect(result.current.editingProject).toBeNull();
      expect(result.current.editingTask).toBeNull();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch projects on mount', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/projects'),
        expect.any(Object)
      );
    });

    it('should fetch tasks on mount', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/'),
        expect.any(Object)
      );
    });

    it('should fetch stats on mount', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.stats).not.toBeNull();
      });
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/stats'),
        expect.any(Object)
      );
    });
  });

  describe('Project CRUD Operations', () => {
    it('should create a new project', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: '3', name: 'New Project' } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.createProject({ name: 'New Project' });
      });
      
      expect(success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/projects'),
        { name: 'New Project' },
        expect.any(Object)
      );
    });

    it('should handle create project error', async () => {
      axios.post.mockRejectedValueOnce({ 
        response: { data: { detail: 'Creation failed' } } 
      });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.createProject({ name: 'Fail Project' });
      });
      
      expect(success).toBe(false);
    });

    it('should update an existing project', async () => {
      axios.put.mockResolvedValueOnce({ data: { id: '1', name: 'Updated Project' } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.updateProject('1', { name: 'Updated Project' });
      });
      
      expect(success).toBe(true);
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/projects/1'),
        { name: 'Updated Project' },
        expect.any(Object)
      );
    });

    it('should delete a project', async () => {
      axios.delete.mockResolvedValueOnce({ data: { success: true } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.deleteProject('1');
      });
      
      expect(success).toBe(true);
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/projects/1'),
        expect.any(Object)
      );
    });
  });

  describe('Task CRUD Operations', () => {
    it('should create a new task', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 't3', title: 'New Task' } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.createTask({ title: 'New Task', project_id: '1' });
      });
      
      expect(success).toBe(true);
    });

    it('should update task status', async () => {
      axios.patch.mockResolvedValueOnce({ data: { status: 'completed' } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.updateTaskStatus('t1', 'completed');
      });
      
      expect(success).toBe(true);
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/t1/status'),
        { status: 'completed' },
        expect.any(Object)
      );
    });

    it('should delete a task', async () => {
      axios.delete.mockResolvedValueOnce({ data: { success: true } });
      
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let success;
      await act(async () => {
        success = await result.current.deleteTask('t1');
      });
      
      expect(success).toBe(true);
    });
  });

  describe('Form Helpers', () => {
    it('should reset project form', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // First set some values
      act(() => {
        result.current.setProjectFormForEdit({ 
          name: 'Test', 
          description: 'Test Description',
          priority: 'high'
        });
      });
      
      expect(result.current.projectForm.name).toBe('Test');
      
      // Then reset
      act(() => {
        result.current.resetProjectForm();
      });
      
      expect(result.current.projectForm.name).toBe('');
      expect(result.current.editingProject).toBeNull();
    });

    it('should reset task form', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      act(() => {
        result.current.setTaskFormForEdit({ 
          title: 'Test Task', 
          description: 'Test',
          priority: 'high'
        });
      });
      
      expect(result.current.taskForm.title).toBe('Test Task');
      
      act(() => {
        result.current.resetTaskForm();
      });
      
      expect(result.current.taskForm.title).toBe('');
      expect(result.current.editingTask).toBeNull();
    });

    it('should set project form for editing', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const projectToEdit = {
        id: '1',
        name: 'Project to Edit',
        description: 'Description',
        priority: 'high',
        budget: 10000
      };
      
      act(() => {
        result.current.setProjectFormForEdit(projectToEdit);
      });
      
      expect(result.current.projectForm.name).toBe('Project to Edit');
      expect(result.current.projectForm.priority).toBe('high');
      expect(result.current.editingProject).toEqual(projectToEdit);
    });
  });

  describe('Export Functions', () => {
    it('should have exportProjectsCSV function', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(typeof result.current.exportProjectsCSV).toBe('function');
    });
  });

  describe('Comments', () => {
    it('should have addComment function', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(typeof result.current.addComment).toBe('function');
    });
  });
});
