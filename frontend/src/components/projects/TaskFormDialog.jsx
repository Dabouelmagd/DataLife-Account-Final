/**
 * Task Form Dialog Component
 * مكون نافذة إنشاء/تعديل المهمة
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const TaskFormDialog = ({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  isEditing,
  projects,
  employees,
  t,
  isRTL
}) => {
  const handleSubmit = () => {
    if (!form.title) return;
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (isRTL ? 'تعديل المهمة' : 'Edit Task') : t.createTask}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>{t.title} *</Label>
            <Input 
              value={form.title} 
              onChange={(e) => setForm({...form, title: e.target.value})}
              placeholder={isRTL ? 'عنوان المهمة' : 'Task title'}
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label>{t.description}</Label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({...form, description: e.target.value})} 
              rows={3}
              placeholder={isRTL ? 'وصف المهمة' : 'Task description'}
            />
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label>{t.project}</Label>
            <Select 
              value={form.project_id || "none"} 
              onValueChange={(v) => setForm({...form, project_id: v === "none" ? "" : v})}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر المشروع' : 'Select Project'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{isRTL ? 'بدون مشروع' : 'No Project'}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.priority}</Label>
              <Select 
                value={form.priority} 
                onValueChange={(v) => setForm({...form, priority: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t.low}</SelectItem>
                  <SelectItem value="medium">{t.medium}</SelectItem>
                  <SelectItem value="high">{t.high}</SelectItem>
                  <SelectItem value="urgent">{t.urgent}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.dueDate}</Label>
              <Input 
                type="date" 
                value={form.due_date} 
                onChange={(e) => setForm({...form, due_date: e.target.value})}
              />
            </div>
          </div>

          {/* Assigned To & Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.assignedTo}</Label>
              <Select 
                value={form.assigned_to || "none"} 
                onValueChange={(v) => setForm({...form, assigned_to: v === "none" ? "" : v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isRTL ? 'غير مسند' : 'Unassigned'}</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.estimatedHours}</Label>
              <Input 
                type="number" 
                value={form.estimated_hours} 
                onChange={(e) => setForm({...form, estimated_hours: parseFloat(e.target.value) || ''})}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskFormDialog;
