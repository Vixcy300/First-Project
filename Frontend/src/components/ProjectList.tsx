import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  type Project,
  type User,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getCurrentUser,
  addProjectMember,
  removeProjectMember,
  exportProjectCSV,
  createTask
} from '../api';
import { useToast } from '../context/ToastContext';
import { useWebSocket } from '../context/WebSocketContext';
import CsvUploadModal from './CsvUploadModal';
import {
  ProjectIcon,
  PlusIcon,
  SearchIcon,
  DownloadIcon,
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  ArrowRightIcon
} from './Icons';

const ProjectList: React.FC = () => {
  const { toast } = useToast();
  const { addListener } = useWebSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'on_track' | 'at_risk' | 'in_progress'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'progress' | 'tasks' | 'title'>('default');

  // New Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Edit Project Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Quick Task Drawer State
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<number | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState('Medium');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState('');
  const [submittingQuickTask, setSubmittingQuickTask] = useState(false);

  // Member Management State
  const [activeProjectForMember, setActiveProjectForMember] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);

  // CSV Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      const [user, projectList] = await Promise.all([
        getCurrentUser().catch(() => null),
        getProjects()
      ]);
      setCurrentUser(user);
      setProjects(projectList);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to fetch projects. Please check backend connection.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const unsubscribe = addListener((event) => {
      if (
        event.type === 'PROJECT_CREATED' ||
        event.type === 'PROJECT_UPDATED' ||
        event.type === 'TASK_CREATED' ||
        event.type === 'TASK_UPDATED' ||
        event.type === 'TASK_DELETED' ||
        event.type === 'CSV_IMPORTED'
      ) {
        getProjects().then(setProjects).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [addListener]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreatingProject(true);
      setError('');
      const created = await createProject({ title: newTitle.trim(), description: newDescription.trim() || undefined });
      setProjects([created, ...projects]);
      setNewTitle('');
      setNewDescription('');
      setShowCreateModal(false);
      toast.success('Project created successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create project.';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProject(p);
    setEditTitle(p.title);
    setEditDescription(p.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editTitle.trim()) return;
    try {
      setSavingEdit(true);
      const updated = await updateProject(editingProject.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined
      });
      setProjects(projects.map(p => p.id === editingProject.id ? { ...p, title: updated.title, description: updated.description } : p));
      setEditingProject(null);
      toast.success('Project updated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update project.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm("Are you sure you want to delete this project? All associated tasks will be removed.")) return;

    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Only the project owner can delete this project.');
    }
  };

  const handleAddMember = async (projectId: number) => {
    if (!memberEmail.trim()) return;
    try {
      setMemberLoading(true);
      await addProjectMember(projectId, { email: memberEmail.trim() });
      setMemberEmail('');
      setActiveProjectForMember(null);
      toast.success(`Team member ${memberEmail} added`);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'User not found. Ensure the user is registered.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (projectId: number, userId: number) => {
    try {
      await removeProjectMember(projectId, userId);
      toast.success("Team member removed");
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to remove member.');
    }
  };

  const handleQuickAddTask = async (e: React.FormEvent, projectId: number) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    try {
      setSubmittingQuickTask(true);
      await createTask({
        title: quickTaskTitle.trim(),
        project_id: projectId,
        priority: quickTaskPriority,
        due_date: quickTaskDueDate || undefined,
        status: 'To Do'
      });
      toast.success(`Task added to project`);
      setQuickTaskTitle('');
      setQuickTaskDueDate('');
      setQuickTaskProjectId(null);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create task.');
    } finally {
      setSubmittingQuickTask(false);
    }
  };

  const handleExportProject = async (projectId: number, projectTitle: string) => {
    try {
      const blob = await exportProjectCSV(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle.replace(/\s+/g, '_')}_tasks.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`Project report downloaded`);
    } catch {
      toast.error("Failed to export project tasks");
    }
  };

  const isTaskOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Metrics
  const globalMetrics = useMemo(() => {
    const totalProjects = projects.length;
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let activeProjects = 0;

    projects.forEach(p => {
      const pTasks = p.tasks || [];
      totalTasks += pTasks.length;
      const done = pTasks.filter(t => t.status === 'Done').length;
      completedTasks += done;
      const pOverdue = pTasks.filter(t => t.status !== 'Done' && isTaskOverdue(t.due_date)).length;
      overdueTasks += pOverdue;
      if (pTasks.some(t => t.status === 'In Progress')) activeProjects++;
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalProjects, totalTasks, completedTasks, overdueTasks, activeProjects, completionRate };
  }, [projects]);

  // Filtered & Sorted
  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => {
        const q = searchQuery.toLowerCase();
        if (q && !p.title.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) {
          return false;
        }

        const pTasks = p.tasks || [];
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'Done').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        const hasOverdue = pTasks.some(t => t.status !== 'Done' && isTaskOverdue(t.due_date));

        if (statusFilter === 'completed' && percent !== 100) return false;
        if (statusFilter === 'at_risk' && !hasOverdue) return false;
        if (statusFilter === 'on_track' && (percent < 50 || hasOverdue)) return false;
        if (statusFilter === 'in_progress' && !pTasks.some(t => t.status === 'In Progress')) return false;

        return true;
      })
      .sort((a, b) => {
        const aTotal = a.tasks?.length || 0;
        const bTotal = b.tasks?.length || 0;
        const aDone = a.tasks?.filter(t => t.status === 'Done').length || 0;
        const bDone = b.tasks?.filter(t => t.status === 'Done').length || 0;
        const aPercent = aTotal > 0 ? aDone / aTotal : 0;
        const bPercent = bTotal > 0 ? bDone / bTotal : 0;

        if (sortBy === 'progress') return bPercent - aPercent;
        if (sortBy === 'tasks') return bTotal - aTotal;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [projects, searchQuery, statusFilter, sortBy]);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.8rem' }}>Projects</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Enterprise initiatives, milestone delivery, and cross-functional team progress.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
            onClick={() => { setShowCsvModal(true); setError(''); }}
            title="Import projects & tasks from CSV"
          >
            <UploadIcon size={14} />
            <span>Import CSV</span>
          </button>
          
          <button 
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* ── Executive KPI Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <ProjectIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{globalMetrics.totalProjects}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Total Initiatives</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <CheckCircleIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', lineHeight: 1.2 }}>{globalMetrics.completionRate}%</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Average Completion</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <ClockIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{globalMetrics.activeProjects}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>In-Flight Projects</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: globalMetrics.overdueTasks > 0 ? 'var(--danger-soft)' : 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: globalMetrics.overdueTasks > 0 ? 'var(--danger)' : 'var(--text-soft)' }}>
            <AlertCircleIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: globalMetrics.overdueTasks > 0 ? 'var(--danger)' : 'var(--text)', lineHeight: 1.2 }}>
              {globalMetrics.overdueTasks}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Overdue Tasks</div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <SearchIcon size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-soft)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '28px', minWidth: '220px', maxWidth: '300px', fontSize: '0.85rem' }}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.85rem' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All Statuses</option>
          <option value="on_track">On Track (&gt;50%)</option>
          <option value="in_progress">In Progress</option>
          <option value="at_risk">At Risk</option>
          <option value="completed">Completed</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.85rem' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
        >
          <option value="default">Sort: Default</option>
          <option value="progress">Highest Progress %</option>
          <option value="tasks">Most Tasks</option>
          <option value="title">Project Name (A-Z)</option>
        </select>

        {(searchQuery || statusFilter !== 'all' || sortBy !== 'default') && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSortBy('default'); }}
            style={{ fontSize: '0.78rem' }}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 500 }}>
          {filteredProjects.length} of {projects.length} initiatives
        </span>
      </div>

      {/* ── Projects Grid ── */}
      {loading ? (
        <div className="loader"></div>
      ) : (
        <div className="grid grid-cols-2">
          {filteredProjects.map(project => {
            const isOwner = currentUser?.id === project.owner_id;
            const pTasks = project.tasks || [];
            const totalTasks = pTasks.length;
            const doneTasks = pTasks.filter(t => t.status === 'Done').length;
            const inProgressTasks = pTasks.filter(t => t.status === 'In Progress').length;
            const todoTasks = pTasks.filter(t => t.status === 'To Do').length;
            const overdueTasks = pTasks.filter(t => t.status !== 'Done' && isTaskOverdue(t.due_date)).length;
            const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

            const totalEstHours = pTasks.reduce((acc, t) => acc + (t.estimated_hours ? Number(t.estimated_hours) : 0), 0);
            const totalLoggedHours = pTasks.reduce((acc, t) => acc + (t.logged_hours ? Number(t.logged_hours) : 0), 0);

            // Enterprise Status Badge
            let healthLabel = 'Planning';
            let healthClass = 'status-planning';
            if (percent === 100 && totalTasks > 0) {
              healthLabel = 'Completed';
              healthClass = 'status-completed';
            } else if (overdueTasks > 0) {
              healthLabel = `At Risk (${overdueTasks})`;
              healthClass = 'status-at-risk';
            } else if (percent >= 50) {
              healthLabel = 'On Track';
              healthClass = 'status-on-track';
            } else if (inProgressTasks > 0 || totalTasks > 0) {
              healthLabel = 'In Progress';
              healthClass = 'status-in-flight';
            }

            const isAddingQuickTask = quickTaskProjectId === project.id;
            const isManagingMembers = activeProjectForMember === project.id;

            return (
              <div 
                key={project.id} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.85rem',
                  borderTop: `3px solid ${percent === 100 ? 'var(--success)' : 'var(--primary)'}` 
                }}
              >
                {/* Header */}
                <div className="flex justify-between items-start" style={{ gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', fontWeight: 600 }}>
                        {project.title}
                      </h3>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {project.description || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No description provided.</span>}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 600, 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        border: '1px solid var(--border)' 
                      }}
                      className={healthClass}
                    >
                      {healthLabel}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 500 }}>
                      {isOwner ? 'Project Lead' : 'Collaborator'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Ratio */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-soft)', marginBottom: '0.35rem' }}>
                    <span>Progress</span>
                    <span style={{ color: percent === 100 ? 'var(--success)' : 'var(--text)', fontWeight: 600 }}>
                      {percent}% ({doneTasks}/{totalTasks})
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '6px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: percent === 100 ? 'var(--success)' : 'var(--primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Status Breakdown Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
                    To Do: <strong style={{ color: 'var(--text)' }}>{todoTasks}</strong>
                  </span>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
                    In Progress: <strong style={{ color: 'var(--primary)' }}>{inProgressTasks}</strong>
                  </span>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
                    Done: <strong style={{ color: 'var(--success)' }}>{doneTasks}</strong>
                  </span>
                  {(totalEstHours > 0 || totalLoggedHours > 0) && (
                    <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-soft)' }}>
                      Effort: <strong style={{ color: 'var(--text)' }}>{totalLoggedHours}h / {totalEstHours}h</strong>
                    </span>
                  )}
                </div>

                {/* Quick Add Task Form */}
                {isAddingQuickTask && (
                  <form onSubmit={(e) => handleQuickAddTask(e, project.id)} style={{ backgroundColor: 'var(--surface-alt)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text)' }}>Create Task for {project.title}</span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Task name..."
                      value={quickTaskTitle}
                      onChange={e => setQuickTaskTitle(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
                      required
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="form-control"
                        value={quickTaskPriority}
                        onChange={e => setQuickTaskPriority(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 'auto' }}
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                        <option value="Urgent">Urgent Priority</option>
                      </select>
                      <input
                        type="date"
                        className="form-control"
                        value={quickTaskDueDate}
                        onChange={e => setQuickTaskDueDate(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQuickTaskProjectId(null)}>Cancel</button>
                      <button type="submit" className="btn btn-sm btn-primary" disabled={submittingQuickTask || !quickTaskTitle.trim()}>
                        {submittingQuickTask ? 'Creating...' : 'Create Task'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Team Collaborators Drawer */}
                <div style={{ backgroundColor: 'var(--surface-hover)', padding: '0.65rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <UsersIcon size={14} />
                      <span>Collaborators ({project.members?.length || 1})</span>
                    </span>
                    <button
                      className="btn btn-sm"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      onClick={() => setActiveProjectForMember(isManagingMembers ? null : project.id)}
                    >
                      {isManagingMembers ? 'Close' : '+ Manage'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                      Lead: {project.owner ? project.owner.name : (isOwner ? 'You' : `User #${project.owner_id}`)}
                    </span>
                    {project.members?.filter(m => m.user_id !== project.owner_id).map(m => (
                      <span key={m.id} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{m.user?.name || `User #${m.user_id}`}</span>
                        {isOwner && (
                          <span 
                            onClick={() => handleRemoveMember(project.id, m.user_id)} 
                            style={{ color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}
                            title="Remove member"
                          >&times;</span>
                        )}
                      </span>
                    ))}
                  </div>

                  {isManagingMembers && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Colleague email..."
                        value={memberEmail}
                        onChange={e => setMemberEmail(e.target.value)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddMember(project.id)}
                        disabled={memberLoading || !memberEmail.trim()}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {memberLoading ? 'Adding...' : 'Invite'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Link
                      to="/tasks"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Task Board</span>
                      <ArrowRightIcon size={13} />
                    </Link>
                    {!isAddingQuickTask && (
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: '0.78rem', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)', fontWeight: 600 }}
                        onClick={() => setQuickTaskProjectId(project.id)}
                      >
                        + Add Task
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleExportProject(project.id, project.title)}
                      title="Export CSV"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <DownloadIcon size={12} />
                      <span>CSV</span>
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenEdit(project)}
                          title="Edit Project"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          <EditIcon size={12} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteProject(project.id)}
                          title="Delete Project"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          <TrashIcon size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-soft)', marginBottom: '0.75rem' }}>
                <ProjectIcon size={36} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>No Initiatives Found</h3>
              <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem' }}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects match your filter criteria. Try clearing filters.'
                  : 'Get started by creating your organization’s first project.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Advanced "+ New Project" Modal Popup ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ProjectIcon size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Create New Project</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: 'var(--text-soft)', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Project Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Q4 Cloud Infrastructure Migration"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Business Objectives & Scope</label>
                <textarea
                  className="form-control"
                  placeholder="Briefly state project deliverables, target outcomes, or key stakeholders..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingProject || !newTitle.trim()}>
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Project Modal Popup ── */}
      {editingProject && (
        <div className="modal-backdrop" onClick={() => setEditingProject(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Edit Project Details</h3>
              <button 
                onClick={() => setEditingProject(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: 'var(--text-soft)', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Project Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingProject(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit || !editTitle.trim()}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Modal ── */}
      {showCsvModal && (
        <CsvUploadModal
          onClose={() => setShowCsvModal(false)}
          onSuccess={() => fetchInitialData()}
        />
      )}
    </div>
  );
};

export default ProjectList;
