/**
 * Tasks List Component
 * مكون قائمة المهام
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ListTodo, Flag, CalendarDays, User, Edit, Trash2, Circle, PlayCircle, CheckCircle } from 'lucide-react';

const TasksList = ({
  tasks,
  projects,
  t,
  isRTL,
  statusColors,
  priorityColors,
  statusIcons,
  onView,
  onUpdate,
  onDelete,
  isMyTasks = false
}) => {
  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListTodo className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t.noTasks}</p>
        </CardContent>
      </Card>
    );
  }

  // Group by status for kanban view
  const grouped = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed')
  };

  const icons = statusIcons || {
    todo: Circle,
    in_progress: PlayCircle,
    review: Circle,
    completed: CheckCircle
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Object.entries(grouped).map(([status, statusTasks]) => {
        const StatusIcon = icons[status] || Circle;
        return (
          <div key={status} className="space-y-3">
            {/* Column Header */}
            <div className={`flex items-center gap-2 px-2 ${
              status === 'completed' ? 'text-green-600 dark:text-green-400' :
              status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' :
              status === 'review' ? 'text-purple-600 dark:text-purple-400' :
              'text-gray-600 dark:text-gray-400'
            }`}>
              <StatusIcon className="h-4 w-4" />
              <span className="font-medium">{t[status]}</span>
              <Badge variant="secondary" className="ml-auto">
                {statusTasks.length}
              </Badge>
            </div>
            
            {/* Column Content */}
            <div className="space-y-2 min-h-[200px] p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              {statusTasks.map(task => {
                const projectName = projects?.find(p => p.id === task.project_id)?.name;
                return (
                  <Card 
                    key={task.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow dark:bg-gray-800 dark:hover:bg-gray-700" 
                    onClick={() => onView(task.id)}
                  >
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm mb-2 line-clamp-2 dark:text-white">
                        {task.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <Badge className={priorityColors?.[task.priority] || 'bg-gray-100'} variant="outline">
                          <Flag className="h-3 w-3 mr-1" />
                          {t[task.priority]}
                        </Badge>
                        {task.due_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {task.due_date}
                          </span>
                        )}
                      </div>
                      {projectName && (
                        <p className="text-xs text-gray-400 mt-2 truncate">
                          {projectName}
                        </p>
                      )}
                      {task.assigned_to_name && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <User className="h-3 w-3" />
                          {task.assigned_to_name}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Empty state for column */}
              {statusTasks.length === 0 && (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  {isRTL ? 'لا توجد مهام' : 'No tasks'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TasksList;
