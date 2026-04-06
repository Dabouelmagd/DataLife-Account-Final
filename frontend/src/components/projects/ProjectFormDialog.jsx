/**
 * Project Form Dialog Component
 * مكون نافذة إنشاء/تعديل المشروع
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const ProjectFormDialog = ({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  isEditing,
  employees,
  t,
  isRTL
}) => {
  const handleSubmit = () => {
    if (!form.name) return;
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (isRTL ? 'تعديل المشروع' : 'Edit Project') : t.createProject}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>{t.name} *</Label>
            <Input 
              value={form.name} 
              onChange={(e) => setForm({...form, name: e.target.value})}
              placeholder={isRTL ? 'اسم المشروع' : 'Project name'}
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label>{t.description}</Label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({...form, description: e.target.value})} 
              rows={3}
              placeholder={isRTL ? 'وصف المشروع' : 'Project description'}
            />
          </div>

          {/* Priority & Budget */}
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
              <Label>{t.budget}</Label>
              <Input 
                type="number" 
                value={form.budget} 
                onChange={(e) => setForm({...form, budget: parseFloat(e.target.value) || ''})}
                placeholder="0"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.startDate}</Label>
              <Input 
                type="date" 
                value={form.start_date} 
                onChange={(e) => setForm({...form, start_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.endDate}</Label>
              <Input 
                type="date" 
                value={form.end_date} 
                onChange={(e) => setForm({...form, end_date: e.target.value})}
              />
            </div>
          </div>

          {/* Manager */}
          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>{t.manager}</Label>
              <Select 
                value={form.manager_id || "none"} 
                onValueChange={(v) => setForm({...form, manager_id: v === "none" ? "" : v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر المدير' : 'Select Manager'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isRTL ? 'بدون مدير' : 'No Manager'}</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={!form.name}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectFormDialog;
