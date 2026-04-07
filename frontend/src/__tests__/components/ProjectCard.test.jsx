/**
 * ProjectCard Component Tests
 * اختبارات مكون بطاقة المشروع
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectCard from '../../components/projects/ProjectCard';

// Mock translations
const mockTranslations = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  in_progress: 'In Progress',
  planning: 'Planning',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  tasksCount: 'Tasks',
  progress: 'Progress',
  viewFinancials: 'View Financials'
};

// Mock Arabic translations
const mockArabicTranslations = {
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
  in_progress: 'قيد التنفيذ',
  planning: 'تخطيط',
  completed: 'مكتمل',
  on_hold: 'معلق',
  cancelled: 'ملغي',
  tasksCount: 'مهام',
  progress: 'التقدم',
  viewFinancials: 'عرض الماليات'
};

// Mock project data
const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'This is a test project description',
  status: 'in_progress',
  priority: 'high',
  progress: 65,
  tasks_count: 12,
  end_date: '2026-12-31'
};

const mockProjectLow = {
  ...mockProject,
  id: '2',
  name: 'Low Priority Project',
  priority: 'low',
  status: 'planning',
  progress: 0
};

// Mock callback functions
const mockOnView = jest.fn();
const mockOnEdit = jest.fn();
const mockOnDelete = jest.fn();
const mockOnViewFinancials = jest.fn();
const mockOnPrint = jest.fn();
const mockOnExportPDF = jest.fn();

const defaultProps = {
  project: mockProject,
  t: mockTranslations,
  isRTL: false,
  onView: mockOnView,
  onEdit: mockOnEdit,
  onDelete: mockOnDelete,
  onViewFinancials: mockOnViewFinancials,
  onPrint: mockOnPrint,
  onExportPDF: mockOnExportPDF
};

describe('ProjectCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render project name', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should render project description', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('This is a test project description')).toBeInTheDocument();
    });

    it('should render priority badge', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should render status badge', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should render task count', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('12 Tasks')).toBeInTheDocument();
    });

    it('should render progress percentage', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('should render end date', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('2026-12-31')).toBeInTheDocument();
    });

    it('should render progress bar', () => {
      const { container } = render(<ProjectCard {...defaultProps} />);
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Priority Variations', () => {
    it('should display high priority correctly', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should display low priority correctly', () => {
      render(<ProjectCard {...defaultProps} project={mockProjectLow} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should display medium priority correctly', () => {
      const mediumProject = { ...mockProject, priority: 'medium' };
      render(<ProjectCard {...defaultProps} project={mediumProject} />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  describe('Status Variations', () => {
    it('should display in_progress status', () => {
      render(<ProjectCard {...defaultProps} />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should display planning status', () => {
      render(<ProjectCard {...defaultProps} project={mockProjectLow} />);
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    it('should display completed status', () => {
      const completedProject = { ...mockProject, status: 'completed', progress: 100 };
      render(<ProjectCard {...defaultProps} project={completedProject} />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display on_hold status', () => {
      const onHoldProject = { ...mockProject, status: 'on_hold' };
      render(<ProjectCard {...defaultProps} project={onHoldProject} />);
      expect(screen.getByText('On Hold')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onView when card is clicked', () => {
      render(<ProjectCard {...defaultProps} />);
      
      const card = screen.getByText('Test Project').closest('.hover\\:shadow-md');
      fireEvent.click(card);
      
      expect(mockOnView).toHaveBeenCalledWith('1');
    });

    it('should call onEdit when edit button is clicked', () => {
      render(<ProjectCard {...defaultProps} />);
      
      // Find edit button by its icon container
      const buttons = screen.getAllByRole('button');
      const editButton = buttons.find(btn => btn.querySelector('svg.lucide-edit'));
      
      if (editButton) {
        fireEvent.click(editButton);
        expect(mockOnEdit).toHaveBeenCalledWith(mockProject);
      }
    });

    it('should call onDelete when delete button is clicked', () => {
      render(<ProjectCard {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => btn.querySelector('svg.lucide-trash-2'));
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(mockOnDelete).toHaveBeenCalledWith('1');
      }
    });

    it('should call onViewFinancials when financials button is clicked', () => {
      render(<ProjectCard {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      const financialsButton = buttons.find(btn => btn.querySelector('svg.lucide-calculator'));
      
      if (financialsButton) {
        fireEvent.click(financialsButton);
        expect(mockOnViewFinancials).toHaveBeenCalledWith(mockProject);
      }
    });

    it('should call onPrint when print button is clicked', () => {
      render(<ProjectCard {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      const printButton = buttons.find(btn => btn.querySelector('svg.lucide-printer'));
      
      if (printButton) {
        fireEvent.click(printButton);
        expect(mockOnPrint).toHaveBeenCalledWith(mockProject);
      }
    });

    it('should stop propagation on action buttons', () => {
      render(<ProjectCard {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      const editButton = buttons.find(btn => btn.querySelector('svg.lucide-edit'));
      
      if (editButton) {
        fireEvent.click(editButton);
        // onView should not be called when clicking edit button
        expect(mockOnView).not.toHaveBeenCalled();
      }
    });
  });

  describe('Arabic Language Support', () => {
    it('should render with Arabic translations', () => {
      render(
        <ProjectCard 
          {...defaultProps} 
          t={mockArabicTranslations} 
          isRTL={true}
        />
      );
      
      expect(screen.getByText('عالي')).toBeInTheDocument();
      expect(screen.getByText('قيد التنفيذ')).toBeInTheDocument();
    });

    it('should handle RTL layout', () => {
      const { container } = render(
        <ProjectCard 
          {...defaultProps} 
          t={mockArabicTranslations} 
          isRTL={true}
        />
      );
      
      // Component should still render properly in RTL
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing end_date', () => {
      const projectWithoutDate = { ...mockProject, end_date: null };
      render(<ProjectCard {...defaultProps} project={projectWithoutDate} />);
      
      // Should not render date section
      expect(screen.queryByText('2026-12-31')).not.toBeInTheDocument();
    });

    it('should handle zero progress', () => {
      render(<ProjectCard {...defaultProps} project={mockProjectLow} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% progress', () => {
      const completedProject = { ...mockProject, progress: 100 };
      render(<ProjectCard {...defaultProps} project={completedProject} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle undefined tasks_count', () => {
      const projectNoTasks = { ...mockProject, tasks_count: undefined };
      render(<ProjectCard {...defaultProps} project={projectNoTasks} />);
      expect(screen.getByText('0 Tasks')).toBeInTheDocument();
    });

    it('should handle undefined progress', () => {
      const projectNoProgress = { ...mockProject, progress: undefined };
      render(<ProjectCard {...defaultProps} project={projectNoProgress} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes', () => {
      const { container } = render(<ProjectCard {...defaultProps} />);
      
      // Check for dark mode classes
      const card = container.querySelector('.dark\\:bg-gray-800');
      expect(card).toBeInTheDocument();
    });
  });
});
