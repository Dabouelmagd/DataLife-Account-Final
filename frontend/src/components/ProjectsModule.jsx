/**
 * المشاريع — the simple flow:
 *   list of projects (revenue, expenses, profit, % of budget)  →  one project:
 *   summary strip + one table of money in/out + «إضافة إيراد» / «إضافة مصروف».
 * BOQ, claims, retention and the detailed form sit in the project's «متقدم» tab.
 * Tasks keep their own tab.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FolderKanban, ListTodo, Plus, Circle, PlayCircle, PauseCircle, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import useRealTimeSync from '../hooks/useRealTimeSync';
import {
  getProjectTranslations, STATUS_COLORS, PRIORITY_COLORS, INITIAL_TASK_FORM,
} from '../config/projectsConfig';
import { TasksList, TaskFormDialog, TaskDetailDialog } from './projects';
import ProjectsOverview from './projects/ProjectsOverview';
import ProjectWorkspace from './projects/ProjectWorkspace';
import ProjectQuickForm from './projects/ProjectQuickForm';
import { API_URL, authHeaders, errText } from './projects/simpleShared';

const STATUS_ICONS = {
  planning: Circle, in_progress: PlayCircle, on_hold: PauseCircle, completed: CheckCircle,
  cancelled: AlertCircle, todo: Circle, review: Eye,
};

const ProjectsModule = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language !== 'en';
  const L = (ar, en) => (isRTL ? ar : en);
  const t = getProjectTranslations(isRTL);

  const [area, setArea] = useState('projects');           // 'projects' | 'tasks'
  const [openId, setOpenId] = useState(null);             // project being viewed
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState(null);                 // {} new | project to edit
  const [wsKey, setWsKey] = useState(0);

  // tasks
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const { data } = await axios.get(`${API_URL}/api/projects/all/overview`, authHeaders(token));
      setOverview(data);
    } catch (e) {
      setLoadErr(errText(e, isRTL ? 'تعذّر تحميل المشاريع' : 'Could not load projects'));
    } finally { setLoading(false); }
  }, [token, isRTL]);

  const loadTasks = useCallback(async () => {
    const h = authHeaders(token);
    const [all, mine] = await Promise.allSettled([
      axios.get(`${API_URL}/api/tasks/`, h), axios.get(`${API_URL}/api/tasks/my-tasks`, h)]);
    if (all.status === 'fulfilled') setTasks(all.value.data || []);
    if (mine.status === 'fulfilled') setMyTasks(mine.value.data || []);
  }, [token]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => {
    if (area !== 'tasks') return;
    loadTasks();
    axios.get(`${API_URL}/api/hr/employees`, authHeaders(token))
      .then((r) => { const d = r.data?.data || r.data || []; setEmployees(Array.isArray(d) ? d : []); })
      .catch(() => setEmployees([]));
  }, [area, loadTasks, token]);

  const onSync = useCallback((message) => {
    if (message?.type === 'project_updated' || message?.type === 'task_updated') {
      loadOverview();
      if (area === 'tasks') loadTasks();
    }
  }, [loadOverview, loadTasks, area]);
  useRealTimeSync(onSync);

  const projects = overview?.projects || [];

  const deleteProject = async (p) => {
    if (!window.confirm(L(`حذف «${p.name}»؟`, `Delete "${p.name}"?`))) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/projects/${p.id}`, authHeaders(token));
      toast.success(L('تم حذف المشروع', 'Project deleted'));
      setForm(null); setOpenId(null); loadOverview();
    } catch (e) { toast.error(errText(e, L('تعذّر الحذف', 'Could not delete'))); }
  };

  // ── tasks handlers (unchanged behaviour) ────────────────────────────
  const taskCall = async (fn, ok) => {
    try { await fn(); if (ok) toast.success(ok); loadTasks(); return true; } catch (e) {
      toast.error(errText(e, L('حصل خطأ', 'Something went wrong'))); return false;
    }
  };
  const createTask = () => taskCall(() => axios.post(`${API_URL}/api/tasks/`, taskForm, authHeaders(token)),
    L('تم إنشاء المهمة', 'Task created')).then((ok) => { if (ok) { setShowTaskDialog(false); setTaskForm(INITIAL_TASK_FORM); } });
  const updateTask = (id, updates) => taskCall(() => axios.put(`${API_URL}/api/tasks/${id}`, updates, authHeaders(token)),
    L('تم تحديث المهمة', 'Task updated')).then(() => { if (selectedTask?.id === id) setSelectedTask({ ...selectedTask, ...updates }); });
  const deleteTask = (id) => {
    if (!window.confirm(L('حذف المهمة؟', 'Delete task?'))) return;
    taskCall(() => axios.delete(`${API_URL}/api/tasks/${id}`, authHeaders(token)), L('تم حذف المهمة', 'Task deleted'))
      .then(() => setShowTaskDetail(false));
  };
  const viewTask = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/tasks/${id}`, authHeaders(token));
      setSelectedTask(data); setShowTaskDetail(true);
    } catch (e) { toast.error(errText(e, L('تعذّر فتح المهمة', 'Could not open task'))); }
  };
  const setTaskStatus = (id, status) => taskCall(() => axios.patch(`${API_URL}/api/tasks/${id}/status`, { status }, authHeaders(token)),
    L('تم تحديث الحالة', 'Status updated')).then(() => { if (selectedTask?.id === id) setSelectedTask({ ...selectedTask, status }); });
  const addComment = async (id, text) => {
    try {
      await axios.post(`${API_URL}/api/tasks/${id}/comments`, { text }, authHeaders(token));
      const { data } = await axios.get(`${API_URL}/api/tasks/${id}`, authHeaders(token));
      setSelectedTask(data);
    } catch (e) { toast.error(errText(e, L('تعذّر إضافة التعليق', 'Could not add comment'))); }
  };

  const areaBtn = (id, label, Icon) => (
    <button type="button" role="tab" aria-selected={area === id} onClick={() => { setArea(id); setOpenId(null); }}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold ${area === id
        ? 'bg-white shadow-sm text-[#28376B]' : 'text-slate-600 hover:text-slate-900'}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'} data-testid="projects-module">
      <div role="tablist" className="inline-flex gap-1 p-1 rounded-xl bg-slate-100">
        {areaBtn('projects', L('المشاريع', 'Projects'), FolderKanban)}
        {areaBtn('tasks', L('المهام', 'Tasks'), ListTodo)}
      </div>

      {area === 'projects' && (openId ? (
        <ProjectWorkspace key={`${openId}-${wsKey}`} token={token} isRTL={isRTL} projectId={openId}
          onBack={() => setOpenId(null)} onChanged={loadOverview}
          onEdit={(p) => setForm(p)} />
      ) : (
        <ProjectsOverview data={overview} loading={loading} error={loadErr} isRTL={isRTL}
          onRetry={loadOverview} onOpen={(p) => setOpenId(p.id)} onNew={() => setForm({})} />
      ))}

      {area === 'tasks' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
              <button type="button" onClick={() => setOnlyMine(false)} aria-pressed={!onlyMine}
                className={`px-3 py-1.5 ${!onlyMine ? 'bg-slate-900 text-white' : 'bg-white'}`}>{L('كل المهام', 'All tasks')}</button>
              <button type="button" onClick={() => setOnlyMine(true)} aria-pressed={onlyMine}
                className={`px-3 py-1.5 ${onlyMine ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                {L('مهامي', 'My tasks')} <bdi dir="ltr" className="tabular-nums">{myTasks.length}</bdi>
              </button>
            </div>
            <button type="button" onClick={() => setShowTaskDialog(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#28376B] text-white text-sm font-bold">
              <Plus className="w-4 h-4" />{L('مهمة جديدة', 'New task')}
            </button>
          </div>
          <TasksList tasks={onlyMine ? myTasks : tasks} t={t} statusColors={STATUS_COLORS} priorityColors={PRIORITY_COLORS}
            statusIcons={STATUS_ICONS} onView={viewTask} onUpdate={updateTask} onDelete={deleteTask} isRTL={isRTL}
            projects={projects} isMyTasks={onlyMine} />
        </div>
      )}

      {form && (
        <ProjectQuickForm token={token} isRTL={isRTL} project={form.id ? form : null}
          onClose={() => setForm(null)} onDelete={form.id ? () => deleteProject(form) : undefined}
          onSaved={(p, msg) => {
            toast.success(msg); setForm(null); loadOverview();
            if (p?.id) { setOpenId(p.id); setWsKey((k) => k + 1); }
          }} />
      )}

      <TaskFormDialog open={showTaskDialog}
        onOpenChange={(o) => { setShowTaskDialog(o); if (!o) setTaskForm(INITIAL_TASK_FORM); }}
        form={taskForm} setForm={setTaskForm} onSave={createTask} isEditing={false}
        projects={projects} employees={employees} t={t} isRTL={isRTL} />
      <TaskDetailDialog open={showTaskDetail} onOpenChange={setShowTaskDetail} task={selectedTask} projects={projects}
        t={t} isRTL={isRTL} onUpdateStatus={setTaskStatus} onDelete={deleteTask} onAddComment={addComment} />
    </div>
  );
};

export default ProjectsModule;
