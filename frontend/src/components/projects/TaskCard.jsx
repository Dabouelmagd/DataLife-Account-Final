/**
 * Task Card Component
 * مكون بطاقة المهمة
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Flag, CalendarDays, Edit, Trash2, User, Timer,
  Circle, PlayCircle, CheckCircle
} from 'lucide-react';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../config/projectsConfig';

const statusIcons = {
  todo: Circle,
  in_progress: PlayCircle,
  review: Circle,
  completed: CheckCircle
};

const TaskCard = ({ 
  task, 
  t,
  isRTL,
  showProject = true,
  onView, 
  onEdit, 
  onDelete,
  onStatusChange
}) => {
  const StatusIcon = statusIcons[task.status] || Circle;
  
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800" 
      onClick={() => onView(task.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold dark:text-white">{task.title}</h3>
            {showProject && task.project_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {task.project_name}
              </p>
            )}
          </div>
          <Badge className={PRIORITY_COLORS[task.priority]}>
            <Flag className="h-3 w-3 mr-1" />
            {t[task.priority]}
          </Badge>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {task.description}
        </p>

        <div className="flex items-center justify-between">
          <Badge className={STATUS_COLORS[task.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {t[task.status]}
          </Badge>
          
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {task.due_date}
              </span>
            )}
            {task.estimated_hours && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {task.estimated_hours}h
              </span>
            )}
          </div>
        </div>

        {task.assigned_to_name && (
          <div className="mt-3 pt-3 border-t dark:border-gray-700 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <User className="h-4 w-4" />
            <span>{task.assigned_to_name}</span>
          </div>
        )}

        <div className="mt-3 pt-3 border-t dark:border-gray-700 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(task)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:text-red-600" 
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;
