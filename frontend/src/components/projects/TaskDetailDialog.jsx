/**
 * Task Detail Dialog Component
 * مكون نافذة تفاصيل المهمة
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CalendarDays, MessageSquare, Trash2 } from 'lucide-react';
import { PRIORITY_COLORS } from '../../config/projectsConfig';

const TaskDetailDialog = ({
  open,
  onOpenChange,
  task,
  projects,
  t,
  isRTL,
  onUpdateStatus,
  onDelete,
  onAddComment
}) => {
  const [newComment, setNewComment] = useState('');

  if (!task) return null;

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(task.id, newComment);
      setNewComment('');
    }
  };

  const projectName = projects.find(p => p.id === task.project_id)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="dark:text-white">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select 
              value={task.status} 
              onValueChange={(v) => onUpdateStatus(task.id, v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">{t.todo}</SelectItem>
                <SelectItem value="in_progress">{t.in_progress}</SelectItem>
                <SelectItem value="review">{t.review}</SelectItem>
                <SelectItem value="completed">{t.completed}</SelectItem>
              </SelectContent>
            </Select>
            
            <Badge className={PRIORITY_COLORS[task.priority]}>
              {t[task.priority]}
            </Badge>
            
            {task.due_date && (
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <CalendarDays className="h-4 w-4" /> {task.due_date}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-gray-600 dark:text-gray-300">{task.description}</p>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {task.estimated_hours > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">{t.estimatedHours}</p>
                <p className="font-medium dark:text-white">{task.estimated_hours}h</p>
              </div>
            )}
            {task.project_id && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">{t.project}</p>
                <p className="font-medium dark:text-white">{projectName || '-'}</p>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 dark:text-white">
              <MessageSquare className="h-4 w-4" />
              {t.comments} ({task.comments?.length || 0})
            </h3>
            
            {/* Comments List */}
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {task.comments?.map(comment => (
                <div key={comment.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm dark:text-white">
                      {comment.user_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {comment.created_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-sm dark:text-gray-300">{comment.text}</p>
                </div>
              ))}
            </div>
            
            {/* Add Comment */}
            <div className="flex gap-2 mt-3">
              <Input 
                placeholder={isRTL ? 'أضف تعليق...' : 'Add a comment...'} 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                className="dark:bg-gray-800 dark:text-white"
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                {t.addComment}
              </Button>
            </div>
          </div>

          {/* Delete Button */}
          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <Button 
              variant="destructive" 
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> {t.delete}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailDialog;
