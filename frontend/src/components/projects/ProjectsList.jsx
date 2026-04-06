/**
 * Projects List Component
 * مكون قائمة المشاريع
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { FolderKanban } from 'lucide-react';
import ProjectCard from './ProjectCard';

const ProjectsList = ({
  projects,
  t,
  isRTL,
  onView,
  onEdit,
  onDelete,
  onViewFinancials,
  onPrint,
  onExportPDF
}) => {
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
  );
};

export default ProjectsList;
