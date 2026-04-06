/**
 * Project Detail Dialog Component
 * مكون نافذة تفاصيل المشروع
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { FolderKanban, Circle, PlayCircle, PauseCircle, CheckCircle } from 'lucide-react';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../config/projectsConfig';

const statusIcons = {
  planning: Circle,
  in_progress: PlayCircle,
  on_hold: PauseCircle,
  completed: CheckCircle,
  cancelled: Circle,
  todo: Circle,
  review: Circle
};

const ProjectDetailDialog = ({
  open,
  onOpenChange,
  project,
  t,
  isRTL,
  onViewTask
}) => {
  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex items-center gap-3">
            <Badge className={STATUS_COLORS[project.status]}>
              {t[project.status]}
            </Badge>
            <Badge className={PRIORITY_COLORS[project.priority]}>
              {t[project.priority]}
            </Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {project.progress}% {t.progress}
            </span>
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-gray-600 dark:text-gray-300">{project.description}</p>
          )}

          {/* Progress Bar */}
          <Progress value={project.progress || 0} className="h-3" />

          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">{t.startDate}</p>
              <p className="font-medium dark:text-white">{project.start_date || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">{t.endDate}</p>
              <p className="font-medium dark:text-white">{project.end_date || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">{t.budget}</p>
              <p className="font-medium dark:text-white">
                {project.budget ? `${project.budget.toLocaleString()} EGP` : '-'}
              </p>
            </div>
          </div>

          {/* Project Tasks */}
          <div>
            <h3 className="font-semibold mb-3 dark:text-white">
              {t.tasks} ({project.tasks?.length || 0})
            </h3>
            {project.tasks?.length > 0 ? (
              <div className="space-y-2">
                {project.tasks.map(task => {
                  const TaskStatusIcon = statusIcons[task.status] || Circle;
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => onViewTask(task.id)}
                    >
                      <div className="flex items-center gap-3">
                        <TaskStatusIcon 
                          className={`h-4 w-4 ${task.status === 'completed' ? 'text-green-500' : 'text-gray-400'}`} 
                        />
                        <span className={`dark:text-white ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </span>
                      </div>
                      <Badge className={PRIORITY_COLORS[task.priority]} variant="outline">
                        {t[task.priority]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">{t.noTasks}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailDialog;
