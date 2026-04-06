/**
 * Project Card Component
 * مكون بطاقة المشروع
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  FolderKanban, Flag, CalendarDays, Edit, Trash2, Calculator, 
  Printer, File, Circle, PlayCircle, PauseCircle, CheckCircle 
} from 'lucide-react';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../config/projectsConfig';

const statusIcons = {
  planning: Circle,
  in_progress: PlayCircle,
  on_hold: PauseCircle,
  completed: CheckCircle,
  cancelled: Circle
};

const ProjectCard = ({ 
  project, 
  t, 
  isRTL,
  onView, 
  onEdit, 
  onDelete,
  onViewFinancials,
  onPrint,
  onExportPDF
}) => {
  const StatusIcon = statusIcons[project.status] || Circle;
  
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800" 
      onClick={() => onView(project.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg dark:text-white">{project.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {project.description}
            </p>
          </div>
          <Badge className={PRIORITY_COLORS[project.priority]}>
            <Flag className="h-3 w-3 mr-1" />
            {t[project.priority]}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Badge className={STATUS_COLORS[project.status]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {t[project.status]}
            </Badge>
            <span className="text-gray-500 dark:text-gray-400">
              {project.tasks_count || 0} {t.tasksCount}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-gray-400">{t.progress}</span>
              <span className="font-medium dark:text-white">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2" />
          </div>

          {project.end_date && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <CalendarDays className="h-4 w-4" />
              <span>{project.end_date}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t dark:border-gray-700 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onViewFinancials(project)} 
            title={t.viewFinancials}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
          >
            <Calculator className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onPrint(project)} 
            title={isRTL ? 'طباعة' : 'Print'}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onExportPDF(project)} 
            title={isRTL ? 'تصدير PDF' : 'Export PDF'} 
            className="text-red-600"
          >
            <File className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(project)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:text-red-600" 
            onClick={() => onDelete(project.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
