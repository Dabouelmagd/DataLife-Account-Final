/**
 * ProjectsStats Component Tests
 * اختبارات مكون إحصائيات المشاريع
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectsStats from '../../components/projects/ProjectsStats';

// Mock translations
const mockTranslations = {
  totalProjects: 'Total Projects',
  totalTasks: 'Total Tasks',
  overdue: 'Overdue',
  dueThisWeek: 'Due This Week'
};

// Arabic translations
const mockArabicTranslations = {
  totalProjects: 'إجمالي المشاريع',
  totalTasks: 'إجمالي المهام',
  overdue: 'متأخرة',
  dueThisWeek: 'مستحقة هذا الأسبوع'
};

// Test data
const mockProjects = [
  { id: '1', name: 'Project 1' },
  { id: '2', name: 'Project 2' },
  { id: '3', name: 'Project 3' }
];

const mockTasks = [
  { id: 't1', title: 'Task 1' },
  { id: 't2', title: 'Task 2' },
  { id: 't3', title: 'Task 3' },
  { id: 't4', title: 'Task 4' },
  { id: 't5', title: 'Task 5' }
];

const mockStats = {
  overdue_tasks: 2,
  due_this_week: 4
};

describe('ProjectsStats Component', () => {
  describe('Rendering', () => {
    it('should render all stat cards', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('Total Projects')).toBeInTheDocument();
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Due This Week')).toBeInTheDocument();
    });

    it('should display correct project count', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 projects
    });

    it('should display correct task count', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument(); // 5 tasks
    });

    it('should display overdue count from stats', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 overdue
    });

    it('should display due this week count from stats', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('4')).toBeInTheDocument(); // 4 due this week
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty projects array', () => {
      render(
        <ProjectsStats 
          projects={[]}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      expect(screen.getByText('0')).toBeInTheDocument(); // 0 projects
    });

    it('should handle empty tasks array', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={[]}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      // Should still render with 0 tasks
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    });

    it('should handle null stats', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={null}
          t={mockTranslations}
        />
      );
      
      // Should display 0 for overdue and due this week when stats is null
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle undefined stats properties', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={{}}
          t={mockTranslations}
        />
      );
      
      // Should display 0 when stats properties are undefined
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Due This Week')).toBeInTheDocument();
    });
  });

  describe('Arabic Language Support', () => {
    it('should render with Arabic translations', () => {
      render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockArabicTranslations}
        />
      );
      
      expect(screen.getByText('إجمالي المشاريع')).toBeInTheDocument();
      expect(screen.getByText('إجمالي المهام')).toBeInTheDocument();
      expect(screen.getByText('متأخرة')).toBeInTheDocument();
      expect(screen.getByText('مستحقة هذا الأسبوع')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply gradient backgrounds to cards', () => {
      const { container } = render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      // Check for gradient class
      const cards = container.querySelectorAll('[class*="bg-gradient"]');
      expect(cards.length).toBe(4); // 4 stat cards
    });

    it('should render icons for each stat card', () => {
      const { container } = render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      // Check for icon containers
      const iconContainers = container.querySelectorAll('[class*="rounded-lg"]');
      expect(iconContainers.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Grid Layout', () => {
    it('should use responsive grid layout', () => {
      const { container } = render(
        <ProjectsStats 
          projects={mockProjects}
          tasks={mockTasks}
          stats={mockStats}
          t={mockTranslations}
        />
      );
      
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('md:grid-cols-4');
    });
  });
});
