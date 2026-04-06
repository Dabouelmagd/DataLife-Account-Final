/**
 * Projects Stats Component
 * مكون إحصائيات المشاريع
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { FolderKanban, ListTodo, AlertCircle, Calendar } from 'lucide-react';

const ProjectsStats = ({ projects, tasks, stats, t }) => {
  const statCards = [
    {
      label: t.totalProjects,
      value: projects.length,
      icon: FolderKanban,
      gradient: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-600',
      valueColor: 'text-blue-900'
    },
    {
      label: t.totalTasks,
      value: tasks.length,
      icon: ListTodo,
      gradient: 'from-purple-50 to-purple-100',
      border: 'border-purple-200',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-600',
      valueColor: 'text-purple-900'
    },
    {
      label: t.overdue,
      value: stats?.overdue_tasks || 0,
      icon: AlertCircle,
      gradient: 'from-red-50 to-red-100',
      border: 'border-red-200',
      iconBg: 'bg-red-500',
      textColor: 'text-red-600',
      valueColor: 'text-red-900'
    },
    {
      label: t.dueThisWeek,
      value: stats?.due_this_week || 0,
      icon: Calendar,
      gradient: 'from-amber-50 to-amber-100',
      border: 'border-amber-200',
      iconBg: 'bg-amber-500',
      textColor: 'text-amber-600',
      valueColor: 'text-amber-900'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className={`bg-gradient-to-br ${stat.gradient} ${stat.border}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${stat.iconBg} rounded-lg`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className={`text-sm ${stat.textColor}`}>{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.valueColor}`}>{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProjectsStats;
