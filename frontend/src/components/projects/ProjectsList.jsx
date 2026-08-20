/**
 * Projects List Component — with grid/list view toggle
 */

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { FolderKanban, LayoutGrid, LayoutList } from 'lucide-react';
import ProjectCard from './ProjectCard';

const ProjectsList = ({
  projects, t, isRTL,
  onView, onEdit, onDelete,
  onViewFinancials, onPrint, onExportPDF
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t.noProjects}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex justify-end gap-1">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('grid')}
          className="h-8 w-8 p-0"
          title={isRTL ? 'عرض مربعات' : 'Grid view'}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('list')}
          className="h-8 w-8 p-0"
          title={isRTL ? 'عرض صفوف' : 'List view'}
        >
          <LayoutList className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              t={t}
              isRTL={isRTL}
              onView={() => onView(project.id)}
              onEdit={() => onEdit(project)}
              onDelete={() => onDelete(project.id)}
              onViewFinancials={() => onViewFinancials(project)}
              onPrint={() => onPrint(project)}
              onExportPDF={() => onExportPDF(project)}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {projects.map(project => (
            <Card key={project.id} className="hover:shadow-md transition-shadow dark:bg-gray-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <button
                        onClick={() => onView(project.id)}
                        className="font-semibold text-gray-800 dark:text-white hover:text-blue-600 truncate text-sm"
                      >
                        {project.name}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {project.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                    <span className="hidden md:block">{project.status}</span>
                    <span className="hidden md:block">{project.progress || 0}%</span>
                    <span className="hidden lg:block">{project.end_date || '—'}</span>
                    <span>{project.tasks_count || 0} {t.tasksCount}</span>
                  </div>

                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                      onClick={() => onViewFinancials(project)} title={t.viewFinancials}>
                      <span className="text-sm">💰</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => onPrint(project)} title={isRTL ? 'طباعة' : 'Print'}>
                      <span className="text-sm">🖨️</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                      onClick={() => onExportPDF(project)} title={isRTL ? 'تصدير PDF' : 'Export PDF'}>
                      <span className="text-sm">📄</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => onEdit(project)}>
                      <span className="text-sm">✏️</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                      onClick={() => onDelete(project.id)}>
                      <span className="text-sm">🗑️</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsList;
