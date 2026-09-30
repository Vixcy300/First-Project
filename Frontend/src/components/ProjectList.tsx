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
  createTask,
  updateTask,
  deleteTask
} from '../api';
import { useToast } from '../context/ToastContext';
import { useWebSocket } from '../context/WebSocketContext';
import CsvUploadModal from './CsvUploadModal';
import {
  ProjectIcon,
  TaskIcon,
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
  ArrowRightIcon,
  GridIcon,
  TableIcon
} from './Icons';

const ProjectList: React.FC = () => {
  const { toast } = useToast();
  const { addListener } = useWebSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View Mode: grid or table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('project_view_mode') as 'grid' | 'table') || 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('project_view_mode', mode);
  };

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

  // Quick Task Drawer State (Grid Card inline)
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<number | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState('Medium');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState('');
  const [submittingQuickTask, setSubmittingQuickTask] = useState(false);

  // Member Management State (Grid Card inline)
  const [activeProjectForMember, setActiveProjectForMember] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);

  // Deep Drill-down Modal (Project Workspace)
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null);
  const [detailTaskFilter, setDetailTaskFilter] = useState<'all' | 'To Do' | 'In Progress' | 'Done'>('all');
  const [detailTaskSearch, setDetailTaskSearch] = useState('');
  const [detailNewTaskTitle, setDetailNewTaskTitle] = useState('');
  const [detailNewTaskPriority, setDetailNewTaskPriority] = useState('Medium');
  const [detailNewTaskDueDate, setDetailNewTaskDueDate] = useState('');
  const [detailSubmittingTask, setDetailSubmittingTask] = useState(false);
  const [detailMemberEmail, setDetailMemberEmail] = useState('');
  const [detailMemberLoading, setDetailMemberLoading] = useState(false);

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

      // Keep detail modal updated if open
      setSelectedProjectForDetail(prev => {
        if (!prev) return null;
        return projectList.find(p => p.id === prev.id) || null;
      });
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
        getProjects().then(updated => {
          setProjects(updated);
          setSelectedProjectForDetail(prev => {
            if (!prev) return null;
            return updated.find(p => p.id === prev.id) || null;
          });
        }).catch(() => {});
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
      toast.success('Initiative created successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create project.';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleOpenEdit = (p: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      const updatedList = projects.map(p => p.id === editingProject.id ? { ...p, title: updated.title, description: updated.description } : p);
      setProjects(updatedList);
      if (selectedProjectForDetail && selectedProjectForDetail.id === editingProject.id) {
        setSelectedProjectForDetail({ ...selectedProjectForDetail, title: updated.title, description: updated.description });
      }
      setEditingProject(null);
      toast.success('Project details updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update project.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProject = async (projectId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this initiative? All associated tasks will be removed.")) return;

    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      if (selectedProjectForDetail?.id === projectId) {
        setSelectedProjectForDetail(null);
      }
      toast.success('Initiative deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Only the project lead can delete this project.');
    }
  };

  const handleAddMember = async (projectId: number, emailToUse: string, isDetail = false) => {
    if (!emailToUse.trim()) return;
    try {
      if (isDetail) setDetailMemberLoading(true);
      else setMemberLoading(true);

      await addProjectMember(projectId, { email: emailToUse.trim() });
      if (isDetail) setDetailMemberEmail('');
      else {
        setMemberEmail('');
        setActiveProjectForMember(null);
      }
      toast.success(`Team member ${emailToUse} added`);
      const updated = await getProjects();
      setProjects(updated);
      if (selectedProjectForDetail && selectedProjectForDetail.id === projectId) {
        const up = updated.find(p => p.id === projectId);
        if (up) setSelectedProjectForDetail(up);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'User not found. Ensure the user is registered.');
    } finally {
      if (isDetail) setDetailMemberLoading(false);
      else setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (projectId: number, userId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await removeProjectMember(projectId, userId);
      toast.success("Team member removed");
      const updated = await getProjects();
      setProjects(updated);
      if (selectedProjectForDetail && selectedProjectForDetail.id === projectId) {
        const up = updated.find(p => p.id === projectId);
        if (up) setSelectedProjectForDetail(up);
      }
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
      toast.success(`Work item added to initiative`);
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

  // Workspace Modal Tasks Actions
  const handleDetailCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectForDetail || !detailNewTaskTitle.trim()) return;

    try {
      setDetailSubmittingTask(true);
      await createTask({
        title: detailNewTaskTitle.trim(),
        project_id: selectedProjectForDetail.id,
        priority: detailNewTaskPriority,
        due_date: detailNewTaskDueDate || undefined,
        status: 'To Do'
      });
      toast.success(`Task added to ${selectedProjectForDetail.title}`);
      setDetailNewTaskTitle('');
      setDetailNewTaskDueDate('');
      const updated = await getProjects();
      setProjects(updated);
      const up = updated.find(p => p.id === selectedProjectForDetail.id);
      if (up) setSelectedProjectForDetail(up);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create task.');
    } finally {
      setDetailSubmittingTask(false);
    }
  };

  const handleDetailUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      const updated = await getProjects();
      setProjects(updated);
      if (selectedProjectForDetail) {
        const up = updated.find(p => p.id === selectedProjectForDetail.id);
        if (up) setSelectedProjectForDetail(up);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update task.');
    }
  };

  const handleDetailDeleteTask = async (taskId: number) => {
    if (!window.confirm("Remove this work item from the initiative?")) return;
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
      const updated = await getProjects();
      setProjects(updated);
      if (selectedProjectForDetail) {
        const up = updated.find(p => p.id === selectedProjectForDetail.id);
        if (up) setSelectedProjectForDetail(up);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete task.');
    }
  };

  const handleExportProject = async (projectId: number, projectTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      toast.success(`Initiative report downloaded`);
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

  const getHealthBadge = (p: Project) => {
    const pTasks = p.tasks || [];
    const total = pTasks.length;
    const done = pTasks.filter(t => t.status === 'Done').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const hasOverdue = pTasks.some(t => t.status !== 'Done' && isTaskOverdue(t.due_date));
    const inProgress = pTasks.some(t => t.status === 'In Progress');

    if (percent === 100 && total > 0) {
      return { label: 'Completed', className: 'status-completed' };
    }
    if (hasOverdue) {
      const count = pTasks.filter(t => t.status !== 'Done' && isTaskOverdue(t.due_date)).length;
      return { label: `At Risk (${count})`, className: 'status-at-risk' };
    }
    if (percent >= 50) {
      return { label: 'On Track', className: 'status-on-track' };
    }
    if (inProgress || total > 0) {
      return { label: 'In Flight', className: 'status-in-flight' };
    }
    return { label: 'Planning', className: 'status-planning' };
  };

  // Metrics
  const globalMetrics = useMemo(() => {
    const totalProjects = projects.length;
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let activeProjects = 0;
    let totalEstHours = 0;
    let totalLoggedHours = 0;

    projects.forEach(p => {
      const pTasks = p.tasks || [];
      totalTasks += pTasks.length;
      const done = pTasks.filter(t => t.status === 'Done').length;
      completedTasks += done;
      const pOverdue = pTasks.filter(t => t.status !== 'Done' && isTaskOverdue(t.due_date)).length;
      overdueTasks += pOverdue;
      if (pTasks.some(t => t.status === 'In Progress')) activeProjects++;
      pTasks.forEach(t => {
        if (t.estimated_hours) totalEstHours += Number(t.estimated_hours);
        if (t.logged_hours) totalLoggedHours += Number(t.logged_hours);
      });
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { totalProjects, totalTasks, completedTasks, overdueTasks, activeProjects, completionRate, totalEstHours, totalLoggedHours };
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

  // Tasks inside Workspace Modal
  const modalTasks = useMemo(() => {
    if (!selectedProjectForDetail) return [];
    let list = selectedProjectForDetail.tasks || [];
    if (detailTaskFilter !== 'all') {
      list = list.filter(t => t.status === detailTaskFilter);
    }
    if (detailTaskSearch.trim()) {
      const q = detailTaskSearch.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [selectedProjectForDetail, detailTaskFilter, detailTaskSearch]);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.8rem' }}>Projects</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Enterprise initiative tracking, resource capacity, and cross-functional team delivery.
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
            <span>New Initiative</span>
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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Active Initiatives</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <CheckCircleIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', lineHeight: 1.2 }}>{globalMetrics.completionRate}%</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Avg Delivery Velocity</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <ClockIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>
              {globalMetrics.totalLoggedHours}h <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-soft)' }}>/ {globalMetrics.totalEstHours}h</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Resource Effort Logged</div>
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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: 2 }}>Overdue Bottlenecks</div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar + View Switcher ── */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <SearchIcon size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-soft)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search initiatives..."
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
          <option value="in_progress">In Flight</option>
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
          <option value="title">Initiative Name (A-Z)</option>
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

        <div style={{ flex: 1 }} />

        {/* View Toggle: Grid vs Table */}
        <div className="view-toggle-group">
          <button
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('grid')}
            title="Card Grid View"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <GridIcon size={14} />
            <span>Cards</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('table')}
            title="Executive Table View"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <TableIcon size={14} />
            <span>Table</span>
          </button>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 500 }}>
          {filteredProjects.length} of {projects.length}
        </span>
      </div>

      {/* ── Main Projects Display ── */}
      {loading ? (
        <div className="loader"></div>
      ) : viewMode === 'table' ? (
        /* ── Executive Table View ── */
        <div className="project-table-card">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Initiative</th>
                <th style={{ width: '12%' }}>Health</th>
                <th style={{ width: '20%' }}>Delivery Progress</th>
                <th style={{ width: '14%' }}>Work Breakdown</th>
                <th style={{ width: '12%' }}>Resource Effort</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => {
                const isOwner = currentUser?.id === project.owner_id;
                const pTasks = project.tasks || [];
                const totalTasks = pTasks.length;
                const doneTasks = pTasks.filter(t => t.status === 'Done').length;
                const inProgressTasks = pTasks.filter(t => t.status === 'In Progress').length;
                const todoTasks = pTasks.filter(t => t.status === 'To Do').length;
                const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                const totalEst = pTasks.reduce((acc, t) => acc + (t.estimated_hours ? Number(t.estimated_hours) : 0), 0);
                const totalLogged = pTasks.reduce((acc, t) => acc + (t.logged_hours ? Number(t.logged_hours) : 0), 0);
                const health = getHealthBadge(project);

                return (
                  <tr key={project.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectForDetail(project)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ marginTop: '2px', color: 'var(--primary)' }}>
                          <ProjectIcon size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>
                            {project.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: '2px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No scope description</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={health.className}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          display: 'inline-block'
                        }}
                      >
                        {health.label}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-soft)' }}>
                          <span>{percent}%</span>
                          <span>{doneTasks} / {totalTasks} items</span>
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
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '4px', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          {todoTasks} To Do
                        </span>
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          {inProgressTasks} In Flight
                        </span>
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          {doneTasks} Done
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                        <strong style={{ fontWeight: 600 }}>{totalLogged}h</strong>
                        <span style={{ color: 'var(--text-soft)', fontSize: '0.75rem' }}> / {totalEst}h</span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setSelectedProjectForDetail(project)}
                          title="Open Project Workspace"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                        >
                          Workspace
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => handleExportProject(project.id, project.title, e)}
                          title="Export CSV"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          <DownloadIcon size={13} />
                        </button>
                        {isOwner && (
                          <>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => handleOpenEdit(project, e)}
                              title="Edit Initiative"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              <EditIcon size={13} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={(e) => handleDeleteProject(project.id, e)}
                              title="Delete Initiative"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-soft)' }}>
                    <div style={{ marginBottom: '0.5rem' }}><ProjectIcon size={32} /></div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>No initiatives match your criteria</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Try resetting your search query or status filter.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Enterprise Grid Cards View ── */
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

            const health = getHealthBadge(project);
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
                  borderTop: `3px solid ${percent === 100 ? 'var(--success)' : overdueTasks > 0 ? 'var(--danger)' : 'var(--primary)'}` 
                }}
              >
                {/* Header */}
                <div className="flex justify-between items-start" style={{ gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <h3 
                        style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setSelectedProjectForDetail(project)}
                        title="Click to open full initiative workspace"
                      >
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
                      className={health.className}
                    >
                      {health.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 500 }}>
                      {isOwner ? 'Project Lead' : 'Collaborator'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Ratio */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-soft)', marginBottom: '0.35rem' }}>
                    <span>Delivery Progress</span>
                    <span style={{ color: percent === 100 ? 'var(--success)' : 'var(--text)', fontWeight: 600 }}>
                      {percent}% ({doneTasks}/{totalTasks} items)
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
                    In Flight: <strong style={{ color: 'var(--primary)' }}>{inProgressTasks}</strong>
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
                      <span>Team Roster ({project.members?.length || 1})</span>
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
                            onClick={(e) => handleRemoveMember(project.id, m.user_id, e)} 
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
                        onClick={() => handleAddMember(project.id, memberEmail, false)}
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
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSelectedProjectForDetail(project)}
                      style={{ fontSize: '0.78rem', fontWeight: 600 }}
                      title="Open full workspace with task management"
                    >
                      Workspace
                    </button>
                    <Link
                      to="/tasks"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Board</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                    {!isAddingQuickTask && (
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: '0.78rem', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)', fontWeight: 600 }}
                        onClick={() => setQuickTaskProjectId(project.id)}
                      >
                        + Task
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => handleExportProject(project.id, project.title, e)}
                      title="Export CSV Report"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <DownloadIcon size={12} />
                      <span>CSV</span>
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => handleOpenEdit(project, e)}
                          title="Edit Initiative"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          <EditIcon size={12} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          title="Delete Initiative"
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
                  ? 'No initiatives match your filter criteria. Try clearing filters.'
                  : 'Get started by creating your organization’s first project initiative.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MNC-Grade Deep Drill-Down Workspace Modal (Project Detail) ── */}
      {selectedProjectForDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedProjectForDetail(null)}>
          <div 
            className="modal-box" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', background: 'var(--surface-alt)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProjectIcon size={18} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>
                    {selectedProjectForDetail.title}
                  </h2>
                  <span
                    className={getHealthBadge(selectedProjectForDetail).className}
                    style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                  >
                    {getHealthBadge(selectedProjectForDetail).label}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {selectedProjectForDetail.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No scope description provided.</span>}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={(e) => handleExportProject(selectedProjectForDetail.id, selectedProjectForDetail.title, e)}
                  title="Export Work Items CSV"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                >
                  <DownloadIcon size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setSelectedProjectForDetail(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-soft)', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Executive Overview KPI Strip */}
              {(() => {
                const pTasks = selectedProjectForDetail.tasks || [];
                const total = pTasks.length;
                const done = pTasks.filter(t => t.status === 'Done').length;
                const inProgress = pTasks.filter(t => t.status === 'In Progress').length;
                const todo = pTasks.filter(t => t.status === 'To Do').length;
                const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                const totalEst = pTasks.reduce((acc, t) => acc + (t.estimated_hours ? Number(t.estimated_hours) : 0), 0);
                const totalLogged = pTasks.reduce((acc, t) => acc + (t.logged_hours ? Number(t.logged_hours) : 0), 0);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Delivery Velocity</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: percent === 100 ? 'var(--success)' : 'var(--text)', marginTop: '2px' }}>
                        {percent}%
                      </div>
                      <div className="progress-bar-track" style={{ height: '4px', marginTop: '6px' }}>
                        <div className="progress-bar-fill" style={{ width: `${percent}%`, backgroundColor: percent === 100 ? 'var(--success)' : 'var(--primary)' }} />
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Work Items</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                        {done} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-soft)' }}>/ {total} completed</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginTop: '4px' }}>
                        {todo} To Do &bull; {inProgress} In Flight
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Resource Effort</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                        {totalLogged}h <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-soft)' }}>/ {totalEst}h</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginTop: '4px' }}>
                        {totalEst > 0 ? `${Math.round((totalLogged / totalEst) * 100)}% effort burn` : 'No estimates set'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Initiative Lead</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedProjectForDetail.owner ? selectedProjectForDetail.owner.name : 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginTop: '4px' }}>
                        {selectedProjectForDetail.members?.length || 1} team collaborator(s)
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Work Items Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TaskIcon size={16} />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Initiative Work Items</h3>
                  </div>

                  {/* Filter tabs inside modal */}
                  <div className="view-toggle-group">
                    {(['all', 'To Do', 'In Progress', 'Done'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`view-toggle-btn ${detailTaskFilter === tab ? 'active' : ''}`}
                        onClick={() => setDetailTaskFilter(tab)}
                        style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      >
                        {tab === 'all' ? 'All' : tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search within Project Tasks */}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filter project tasks..."
                    value={detailTaskSearch}
                    onChange={e => setDetailTaskSearch(e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  />
                </div>

                {/* Project Tasks Table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface)' }}>
                  <table className="enterprise-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '45%' }}>Work Item</th>
                        <th style={{ width: '15%' }}>Priority</th>
                        <th style={{ width: '20%' }}>Status</th>
                        <th style={{ width: '15%' }}>Due Date</th>
                        <th style={{ width: '5%', textAlign: 'right' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalTasks.map(task => {
                        const overdue = isTaskOverdue(task.due_date) && task.status !== 'Done';
                        return (
                          <tr key={task.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{task.title}</div>
                              {task.description && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-soft)', marginTop: '2px' }}>
                                  {task.description}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`priority-badge priority-${(task.priority || 'medium').toLowerCase()}`}>
                                {task.priority || 'Medium'}
                              </span>
                            </td>
                            <td>
                              <select
                                className="form-control"
                                style={{ fontSize: '0.78rem', padding: '3px 8px', width: 'auto' }}
                                value={task.status}
                                onChange={e => handleDetailUpdateTaskStatus(task.id, e.target.value)}
                              >
                                <option value="To Do">To Do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Done">Done</option>
                              </select>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: overdue ? 'var(--danger)' : 'var(--text-soft)', fontWeight: overdue ? 700 : 500 }}>
                                {task.due_date || 'No deadline'}
                                {overdue && ' (Overdue)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-icon btn-icon-danger"
                                onClick={() => handleDetailDeleteTask(task.id)}
                                title="Delete task"
                                style={{ color: 'var(--danger)' }}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {modalTasks.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
                            No work items found matching this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline Add Task Form inside Modal */}
                <form 
                  onSubmit={handleDetailCreateTask} 
                  style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    alignItems: 'center', 
                    backgroundColor: 'var(--surface-alt)', 
                    padding: '0.65rem 0.85rem', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap'
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+ Add new work item to this initiative..."
                    value={detailNewTaskTitle}
                    onChange={e => setDetailNewTaskTitle(e.target.value)}
                    style={{ flex: 2, minWidth: '200px', fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                    required
                  />
                  <select
                    className="form-control"
                    value={detailNewTaskPriority}
                    onChange={e => setDetailNewTaskPriority(e.target.value)}
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                  <input
                    type="date"
                    className="form-control"
                    value={detailNewTaskDueDate}
                    onChange={e => setDetailNewTaskDueDate(e.target.value)}
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={detailSubmittingTask || !detailNewTaskTitle.trim()}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {detailSubmittingTask ? 'Adding...' : 'Add Work Item'}
                  </button>
                </form>
              </div>

              {/* Team Collaborators & Roster Section */}
              <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UsersIcon size={16} />
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>Team Roster & Permissions</h3>
                  </div>

                  {currentUser?.id === selectedProjectForDetail.owner_id && (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Invite team member email..."
                        value={detailMemberEmail}
                        onChange={e => setDetailMemberEmail(e.target.value)}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', width: '220px' }}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddMember(selectedProjectForDetail.id, detailMemberEmail, true)}
                        disabled={detailMemberLoading || !detailMemberEmail.trim()}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {detailMemberLoading ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {/* Owner */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem' }}>
                      {selectedProjectForDetail.owner ? selectedProjectForDetail.owner.name.charAt(0).toUpperCase() : 'L'}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {selectedProjectForDetail.owner ? selectedProjectForDetail.owner.name : 'Project Lead'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>Lead / Owner</div>
                    </div>
                  </div>

                  {/* Members */}
                  {selectedProjectForDetail.members?.filter(m => m.user_id !== selectedProjectForDetail.owner_id).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--surface-hover)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem' }}>
                        {m.user ? m.user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {m.user ? m.user.name : `User #${m.user_id}`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>Contributor</div>
                      </div>
                      {currentUser?.id === selectedProjectForDetail.owner_id && (
                        <button
                          onClick={(e) => handleRemoveMember(selectedProjectForDetail.id, m.user_id, e)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                          title="Remove member"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
              <Link
                to="/tasks"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Open in Kanban Board</span>
                <ArrowRightIcon size={13} />
              </Link>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedProjectForDetail(null)}
                style={{ fontSize: '0.8rem' }}
              >
                Close Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Advanced "+ New Initiative" Modal Popup ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ProjectIcon size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Create New Initiative</h3>
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
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Initiative Name *</label>
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
                  placeholder="State project deliverables, milestones, resource constraints, or target outcomes..."
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
                  {creatingProject ? 'Creating...' : 'Create Initiative'}
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Edit Initiative Details</h3>
              <button 
                onClick={() => setEditingProject(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: 'var(--text-soft)', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Initiative Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Scope & Description</label>
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
