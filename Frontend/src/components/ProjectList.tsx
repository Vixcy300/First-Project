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

const ProjectList: React.FC = () => {
  const { toast } = useToast();
  const { addListener } = useWebSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Toolbar & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'on_track' | 'at_risk' | 'in_progress'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'progress' | 'tasks' | 'title'>('default');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create Project State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Edit Project State
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Quick Add Task State (per project)
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
      const msg = err?.response?.data?.detail || 'Failed to fetch projects. Is the backend running?';
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
      setShowCreateForm(false);
      toast.success('Project created successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create project.';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleStartEdit = (p: Project) => {
    setEditingProjectId(p.id);
    setEditTitle(p.title);
    setEditDescription(p.description || '');
  };

  const handleSaveEdit = async (projectId: number) => {
    if (!editTitle.trim()) return;
    try {
      const updated = await updateProject(projectId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined
      });
      setProjects(projects.map(p => p.id === projectId ? { ...p, title: updated.title, description: updated.description } : p));
      setEditingProjectId(null);
      toast.success('Project updated successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update project.');
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm("Are you sure you want to delete this project and all its tasks?")) return;

    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted successfully.');
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
      toast.success(`Added ${memberEmail} to the project!`);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add member. Ensure email is registered.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (projectId: number, userId: number) => {
    try {
      await removeProjectMember(projectId, userId);
      toast.success("Member removed.");
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
      toast.success(`Task added to project!`);
      setQuickTaskTitle('');
      setQuickTaskDueDate('');
      setQuickTaskProjectId(null);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add task.');
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
      toast.success(`Exported ${projectTitle} tasks to CSV!`);
    } catch {
      toast.error("Failed to export project tasks");
    }
  };

  // Helper: check if task is overdue
  const isTaskOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  // ── Metrics Calculation across all projects ──
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

  // ── Filter & Sort Projects ──
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
      {/* ── Top Header ── */}
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Projects Hub</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Plan, collaborate, track milestones, and manage team members across all initiatives.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => { setShowCsvModal(true); setError(''); }}
            title="Import projects & tasks from CSV"
          >
            📊 Upload CSV
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowCreateForm(prev => !prev)}
          >
            {showCreateForm ? '✕ Close Form' : '+ New Project'}
          </button>
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* ── KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.2rem', backgroundColor: 'var(--primary-soft)', padding: '0.6rem', borderRadius: '12px' }}>📁</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{globalMetrics.totalProjects}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Total Projects</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.2rem', backgroundColor: 'var(--success-soft)', padding: '0.6rem', borderRadius: '12px' }}>🎯</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{globalMetrics.completionRate}%</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Avg. Completion Rate</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.2rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.6rem', borderRadius: '12px' }}>⚡</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{globalMetrics.activeProjects}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Active In-Flight</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2.2rem', backgroundColor: globalMetrics.overdueTasks > 0 ? 'var(--danger-soft)' : 'var(--surface-hover)', padding: '0.6rem', borderRadius: '12px' }}>
            {globalMetrics.overdueTasks > 0 ? '⚠️' : '✅'}
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: globalMetrics.overdueTasks > 0 ? 'var(--danger)' : 'var(--text)' }}>
              {globalMetrics.overdueTasks}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Overdue Tasks</div>
          </div>
        </div>
      </div>

      {/* ── Create New Project Card (Collapsible) ── */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: '1.75rem', borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>✨ Create New Project</h3>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            You will be assigned as Project Owner with administrative access. Team members can be added anytime.
          </p>
          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Project Title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <textarea
              className="form-control"
              placeholder="Project Description & Milestones (Optional)"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creatingProject || !newTitle.trim()}>
                {creatingProject ? 'Creating...' : '+ Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Projects Toolbar: Search + Filter + Sort ── */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Search projects..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ minWidth: '220px', maxWidth: '300px', fontSize: '0.88rem' }}
        />

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
        >
          <option value="all">📁 All Statuses</option>
          <option value="on_track">🟢 On Track (&gt;50%)</option>
          <option value="in_progress">⚡ In Progress</option>
          <option value="at_risk">🔴 At Risk (Overdue Tasks)</option>
          <option value="completed">🏁 Completed (100%)</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
        >
          <option value="default">⇅ Sort: Default</option>
          <option value="progress">🎯 Highest Progress %</option>
          <option value="tasks">📝 Most Tasks</option>
          <option value="title">🔤 Project Name (A-Z)</option>
        </select>

        {(searchQuery || statusFilter !== 'all' || sortBy !== 'default') && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSortBy('default'); }}
          >
            ✕ Clear
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-soft)', fontWeight: 600 }}>
          {filteredProjects.length} / {projects.length} Projects
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

            // Total effort metrics
            const totalEstHours = pTasks.reduce((acc, t) => acc + (t.estimated_hours ? Number(t.estimated_hours) : 0), 0);
            const totalLoggedHours = pTasks.reduce((acc, t) => acc + (t.logged_hours ? Number(t.logged_hours) : 0), 0);

            // Project health label
            let healthLabel = '⚪ Not Started';
            let healthColor = 'var(--text-soft)';
            if (percent === 100 && totalTasks > 0) {
              healthLabel = '🏁 Completed';
              healthColor = 'var(--success)';
            } else if (overdueTasks > 0) {
              healthLabel = `🔴 At Risk (${overdueTasks} overdue)`;
              healthColor = 'var(--danger)';
            } else if (percent >= 50) {
              healthLabel = '🟢 On Track';
              healthColor = 'var(--success)';
            } else if (inProgressTasks > 0 || totalTasks > 0) {
              healthLabel = '🟡 In Flight';
              healthColor = 'var(--warning)';
            }

            const isEditing = editingProjectId === project.id;
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
                  borderTop: `4px solid ${percent === 100 ? 'var(--success)' : 'var(--primary)'}` 
                }}
              >
                {/* Header & Badges */}
                <div className="flex justify-between items-start" style={{ gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Project Title"
                          style={{ fontSize: '1.05rem', fontWeight: 700 }}
                        />
                        <textarea
                          className="form-control"
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          placeholder="Project Description"
                          rows={2}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => handleSaveEdit(project.id)}>Save</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingProjectId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--text)' }}>
                          {project.title}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                          {project.description || <em>No description provided.</em>}
                        </p>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        color: healthColor, 
                        backgroundColor: 'var(--surface-hover)', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        border: '1px solid var(--border)' 
                      }}
                    >
                      {healthLabel}
                    </span>
                    <span className={`badge ${isOwner ? 'badge-inprogress' : 'badge-todo'}`} style={{ fontSize: '0.72rem' }}>
                      {isOwner ? '👑 Owner' : '👥 Member'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Breakdown */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '0.35rem' }}>
                    <span>Progress</span>
                    <span style={{ color: percent === 100 ? 'var(--success)' : 'var(--primary)', fontWeight: 700 }}>
                      {percent}% ({doneTasks}/{totalTasks} done)
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '8px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: percent === 100 ? 'var(--success)' : 'var(--primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Task Breakdown Chips */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    📝 {todoTasks} To Do
                  </span>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    ⚡ {inProgressTasks} In Progress
                  </span>
                  <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    ✅ {doneTasks} Done
                  </span>
                  {(totalEstHours > 0 || totalLoggedHours > 0) && (
                    <span style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--primary)' }}>
                      ⏱️ {totalLoggedHours}h / {totalEstHours}h
                    </span>
                  )}
                </div>

                {/* Quick Add Task Form */}
                {isAddingQuickTask && (
                  <form onSubmit={(e) => handleQuickAddTask(e, project.id)} style={{ backgroundColor: 'var(--surface-alt)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>➕ Add Task to this Project</span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Task Title *"
                      value={quickTaskTitle}
                      onChange={e => setQuickTaskTitle(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
                      required
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="form-control"
                        value={quickTaskPriority}
                        onChange={e => setQuickTaskPriority(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 'auto' }}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
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
                        {submittingQuickTask ? 'Adding...' : 'Add Task'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Team Members Section */}
                <div style={{ backgroundColor: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                      👥 Team ({project.members?.length || 1}):
                    </span>
                    <button
                      className="btn btn-sm"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      onClick={() => setActiveProjectForMember(isManagingMembers ? null : project.id)}
                    >
                      {isManagingMembers ? 'Close' : '+ Manage Team'}
                    </button>
                  </div>

                  {/* Members badges */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                      👑 {project.owner ? project.owner.name : (isOwner ? 'You' : `User #${project.owner_id}`)}
                    </span>
                    {project.members?.filter(m => m.user_id !== project.owner_id).map(m => (
                      <span key={m.id} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        👤 {m.user?.name || `User #${m.user_id}`}
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

                  {/* Add member inline drawer */}
                  {isManagingMembers && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Invite teammate by email"
                        value={memberEmail}
                        onChange={e => setMemberEmail(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddMember(project.id)}
                        disabled={memberLoading || !memberEmail.trim()}
                      >
                        {memberLoading ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div style={{ marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link
                      to="/tasks"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="View all tasks for this project"
                    >
                      🗂️ View Tasks
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
                      title="Export tasks to CSV"
                      style={{ fontSize: '0.75rem' }}
                    >
                      📥 CSV
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleStartEdit(project)}
                          title="Edit Title & Description"
                          style={{ fontSize: '0.75rem' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteProject(project.id)}
                          title="Delete Project"
                          style={{ fontSize: '0.75rem' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
              <h3>No Projects Found</h3>
              <p style={{ color: 'var(--text-soft)' }}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects match your current filters. Try resetting them.'
                  : 'Get started by creating your first project above!'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bulk CSV Modal */}
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
