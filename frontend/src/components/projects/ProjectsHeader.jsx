/**
 * Projects Header Component
 * مكون رأس صفحة المشاريع
 */

import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FolderKanban, Plus, ListTodo, FileDown, Wifi, WifiOff } from 'lucide-react';

const ProjectsHeader = ({ 
  isRTL, 
  isConnected, 
  onExport, 
  onNewTask, 
  onNewProject,
  t 
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-700 p-6 text-white">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <FolderKanban className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">
              {isRTL ? 'المشاريع والمهام' : 'Projects & Tasks'}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-violet-100 text-sm">
                {isRTL ? 'إدارة المشاريع والمهام وتتبع التقدم' : 'Manage projects, tasks and track progress'}
              </p>
              <Badge 
                variant="outline" 
                className={`border-white/30 ${isConnected ? 'bg-green-500/20 text-green-100' : 'bg-gray-500/20 text-gray-200'}`}
              >
                {isConnected ? <Wifi className="h-3 w-3 me-1" /> : <WifiOff className="h-3 w-3 me-1" />}
                {isConnected ? 'Live' : 'Offline'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onExport} 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <FileDown className="h-4 w-4 me-2" />
            {isRTL ? 'تصدير' : 'Export'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onNewTask} 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <ListTodo className="h-4 w-4 me-2" />
            {t.createTask}
          </Button>
          <Button 
            onClick={onNewProject} 
            className="bg-white text-violet-700 hover:bg-violet-50"
          >
            <Plus className="h-4 w-4 me-2" />
            {t.createProject}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectsHeader;
