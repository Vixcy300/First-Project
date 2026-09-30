import React, { useState, useEffect, useCallback } from 'react';
import { 
  type Task, 
  type Project, 
  getTasks, 
  getProjects, 
  createTask, 
  updateTask, 
  deleteTask,
  exportProjectCSV,
  exportAllTasksCSV
} from '../api';
import TaskForm from './TaskForm';
import TaskDetailModal, { getDueDateBadge } from './TaskDetailModal';
import KanbanBoard from './KanbanBoard';
import CsvUploadModal from './CsvUploadModal';
import { useToast } from '../context/ToastContext';
import { useWebSocket } from '../context/WebSocketContext';

// ─── Calendar View ───────────────────────────────────────────────────────────
const CalendarView: React.FC<{ tasks: Task[]; onOpenDetails: (t: Task) => void }> = ({ tasks, onOpenDetails }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (t.due_date) {
      if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = [];
      tasksByDate[t.due_date].push(t);
    }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const priorityColor: Record<string, string> = {
    Urgent: '#ef4444',
    High: '#f97316',
    Medium: '#3b82f6',
    Low: '#22c55e',
  };

  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>← Prev</button>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>📅 {monthName}</h3>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Next →</button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayTasks = tasksByDate[dateStr] || [];
          return (
            <div
              key={dateStr}
              style={{
                minHeight: '80px',
                border: `1px solid var(--border)`,
                borderRadius: '6px',
                padding: '4px',
                backgroundColor: isToday(day) ? 'var(--primary-soft)' : 'var(--surface)',
                boxShadow: isToday(day) ? '0 0 0 2px var(--primary)' : undefined,
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? 'var(--primary)' : 'var(--text)', marginBottom: '2px' }}>{day}</div>
              {dayTasks.slice(0, 3).map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpenDetails(t)}
                  title={t.title}
                  style={{
                    fontSize: '0.68rem',
                    backgroundColor: priorityColor[t.priority || 'Medium'] + '22',
                    borderLeft: `3px solid ${priorityColor[t.priority || 'Medium']}`,
                    borderRadius: '3px',
                    padding: '1px 4px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    color: 'var(--text)',
                  }}
                >
                  {t.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-soft)' }}>+{dayTasks.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
        {Object.entries(priorityColor).map(([p, c]) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c, display: 'inline-block' }} />
            {p}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>
          {tasks.filter(t => t.due_date).length} tasks with deadlines
        </span>
      </div>
    </div>
  );
};

// ─── Gantt / Timeline View ───────────────────────────────────────────────────
const GanttView: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const tasksWithDates = tasks.filter(t => t.due_date || t.start_date);
  
  if (tasksWithDates.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <h3>No Timeline Data</h3>
        <p style={{ color: 'var(--text-soft)' }}>Set start dates and due dates on your tasks to see the Gantt timeline.</p>
      </div>
    );
  }

  const allDates = tasksWithDates.flatMap(t => [t.start_date, t.due_date].filter(Boolean) as string[]);
  const minDate = new Date(allDates.reduce((a, b) => a < b ? a : b));
  const maxDate = new Date(allDates.reduce((a, b) => a > b ? a : b));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  const getPercent = (dateStr: string) => {
    const d = new Date(dateStr);
    return Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100));
  };

  const getWidth = (start?: string | null, end?: string | null) => {
    const s = start ? new Date(start) : minDate;
    const e = end ? new Date(end) : (start ? new Date(start) : maxDate);
    e.setDate(e.getDate() + 1);
    return Math.max(2, ((e.getTime() - s.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100);
  };

  const priorityColor: Record<string, string> = {
    Urgent: '#ef4444',
    High: '#f97316',
    Medium: '#3b82f6',
    Low: '#22c55e',
  };

  const dateLabels: { label: string; pct: number }[] = [];
  const d = new Date(minDate);
  while (d <= maxDate) {
    const pct = ((d.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
    dateLabels.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, pct });
    d.setDate(d.getDate() + Math.max(1, Math.floor(totalDays / 8)));
  }

  const today = new Date();
  const todayPct = ((today.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;

  return (
    <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
      <h3 style={{ marginBottom: '1.25rem' }}>📊 Gantt Timeline</h3>
      
      {/* Date header */}
      <div style={{ display: 'flex', marginBottom: '0.5rem', marginLeft: '200px', position: 'relative', height: '20px' }}>
        {dateLabels.map((dl, i) => (
          <div key={i} style={{ position: 'absolute', left: `${dl.pct}%`, fontSize: '0.7rem', color: 'var(--text-soft)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {dl.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ minWidth: '600px' }}>
        {tasksWithDates.map(task => {
          const color = priorityColor[task.priority || 'Medium'];
          const left = task.start_date ? getPercent(task.start_date) : (task.due_date ? getPercent(task.due_date) : 0);
          const width = getWidth(task.start_date, task.due_date);
          const statusDone = task.status === 'Done';

          return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
              {/* Task name */}
              <div style={{ width: '200px', minWidth: '200px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={task.title}>
                {task.title}
              </div>

              {/* Bar track */}
              <div style={{ flex: 1, position: 'relative', height: '28px', backgroundColor: 'var(--surface-hover)', borderRadius: '4px', overflow: 'visible' }}>
                {/* Today line */}
                {todayPct > 0 && todayPct < 100 && (
                  <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 2, backgroundColor: 'var(--danger)', zIndex: 2 }} title="Today" />
                )}
                {/* Gantt bar */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${width}%`,
                    height: '100%',
                    backgroundColor: statusDone ? '#22c55e44' : color + '44',
                    border: `2px solid ${statusDone ? '#22c55e' : color}`,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    cursor: 'default',
                  }}
                  title={`${task.start_date || '?'} → ${task.due_date || '?'}`}
                >
                  {statusDone ? '✅ ' : ''}{task.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-soft)', alignItems: 'center' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: 'var(--danger)', marginRight: 4 }} />Today</span>
        {Object.entries(priorityColor).map(([p, c]) => (
          <span key={p}><span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: c, marginRight: 4 }} />{p}</span>
        ))}
        <span style={{ marginLeft: 'auto' }}>Set start_date + due_date on tasks to extend bars</span>
      </div>
    </div>
  );
};

// ─── Main TaskList Component ─────────────────────────────────────────────────
interface TaskListProps {
  initialView?: 'kanban' | 'list' | 'calendar' | 'gantt';
}

const TaskList: React.FC<TaskListProps> = ({ initialView }) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar' | 'gantt'>(() => {
    if (initialView) return initialView;
    const saved = localStorage.getItem('task_view_mode');
    return (saved as any) || 'kanban';
  });

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'due_date' | 'priority'>('default');

  const editingTask = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null;

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setShowForm(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewModeChange = (mode: 'kanban' | 'list' | 'calendar' | 'gantt') => {
    setViewMode(mode);
    localStorage.setItem('task_view_mode', mode);
  };

  const handleCsvSuccess = async () => {
    await refreshTasks();
    const updatedProjects = await getProjects().catch(() => []);
    setProjects(updatedProjects);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError('');
        const [taskList, projectList] = await Promise.all([
          getTasks(selectedProjectId === '' ? undefined : Number(selectedProjectId)),
          getProjects()
        ]);
        if (isMounted) {
          setTasks(taskList);
          setProjects(projectList);
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err?.response?.data?.detail || 'Failed to fetch tasks. Is the backend running?';
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInitialData();
    return () => { isMounted = false; };
  }, [selectedProjectId]);

  const { addListener } = useWebSocket();

  const refreshTasks = useCallback(async () => {
    try {
      const data = await getTasks(selectedProjectId === '' ? undefined : Number(selectedProjectId));
      setTasks(data);
      if (selectedTaskForModal) {
        const updated = data.find(t => t.id === selectedTaskForModal.id);
        if (updated) setSelectedTaskForModal(updated);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to refresh tasks.';
      setError(msg);
      toast.error(msg);
    }
  }, [selectedProjectId, selectedTaskForModal, toast]);

  useEffect(() => {
    const unsubscribe = addListener((event) => {
      if (
        event.type === 'TASK_CREATED' ||
        event.type === 'TASK_UPDATED' ||
        event.type === 'TASK_DELETED' ||
        event.type === 'SUBTASK_UPDATED' ||
        event.type === 'CSV_IMPORTED' ||
        event.type === 'ATTACHMENT_UPLOADED' ||
        event.type === 'ATTACHMENT_DELETED'
      ) {
        refreshTasks();
      }
    });
    return () => unsubscribe();
  }, [addListener, refreshTasks]);

  const handleExportTasks = async () => {
    try {
      let blob: Blob;
      if (selectedProjectId !== '') {
        blob = await exportProjectCSV(Number(selectedProjectId));
      } else {
        blob = await exportAllTasksCSV();
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks_report_${selectedProjectId ? `project_${selectedProjectId}` : 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Tasks exported to CSV!");
    } catch {
      toast.error("Failed to export tasks to CSV");
    }
  };

  const handleCreate = async (data: any) => {
    try {
      setError('');
      await createTask(data);
      setShowForm(false);
      toast.success("Task created successfully!");
      await refreshTasks();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create task.';
      setError(msg);
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (editingTaskId) {
      try {
        setError('');
        await updateTask(editingTaskId, data);
        setEditingTaskId(null);
        toast.success("Task updated successfully!");
        await refreshTasks();
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Failed to update task.';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await updateTask(taskId, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      await refreshTasks();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update status");
    }
  };

  const handleDelete = async (taskId: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        setError('');
        await deleteTask(taskId);
        setTasks(prev => prev.filter(t => t.id !== taskId));
        toast.success("Task deleted successfully!");
        if (selectedTaskForModal?.id === taskId) {
          setSelectedTaskForModal(null);
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Failed to delete task.';
        setError(msg);
        toast.error(msg);
      }
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'To Do': return 'badge-todo';
      case 'In Progress': return 'badge-inprogress';
      case 'Done': return 'badge-done';
      default: return '';
    }
  };

  // ── Derived: all tags from tasks ──
  const allTags = Array.from(new Set(
    tasks.flatMap(t => t.tags ? t.tags.split(',').map(s => s.trim()).filter(Boolean) : [])
  )).sort();

  // ── Filtering & Sorting ──
  const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

  const filteredTasks = tasks
    .filter(t => {
      const q = searchQuery.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      if (selectedTag) {
        const taskTags = t.tags ? t.tags.split(',').map(s => s.trim()) : [];
        if (!taskTags.includes(selectedTag)) return false;
      }
      if (selectedStatus && t.status !== selectedStatus) return false;
      if (selectedPriority && t.priority !== selectedPriority) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === 'priority') {
        return (priorityOrder[a.priority || 'Medium'] ?? 2) - (priorityOrder[b.priority || 'Medium'] ?? 2);
      }
      return 0;
    });

  const hasFilters = searchQuery || selectedTag || selectedStatus || selectedPriority || sortBy !== 'default';

  return (
    <div>
      {/* ── Top Header ── */}
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Tasks</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Manage, organize, and visualize tasks across your workflow.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Project Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '170px', padding: '0.5rem 0.8rem', fontSize: '0.88rem' }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">📁 All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          <button 
            className="btn btn-secondary" 
            onClick={() => { setShowCsvModal(true); setError(''); }}
            title="Import tasks from CSV"
          >📊 Upload CSV</button>

          <button 
            className="btn btn-secondary" 
            onClick={handleExportTasks}
            title="Export tasks to CSV"
          >📥 Export CSV</button>

          {!showForm && (
            <button 
              className="btn btn-primary" 
              onClick={() => { setShowForm(true); setEditingTaskId(null); setError(''); }}
            >+ New Task</button>
          )}
        </div>
      </div>

      {/* ── Toolbar: Search + Filters + View Toggles ── */}
      <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Search tasks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ minWidth: '200px', maxWidth: '260px', fontSize: '0.88rem' }}
        />

        {/* Tag Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={selectedTag}
          onChange={e => setSelectedTag(e.target.value)}
        >
          <option value="">🏷️ All Tags</option>
          {allTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
        </select>

        {/* Status Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>

        {/* Priority Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={selectedPriority}
          onChange={e => setSelectedPriority(e.target.value)}
        >
          <option value="">All Priority</option>
          <option value="Urgent">🔴 Urgent</option>
          <option value="High">🟠 High</option>
          <option value="Medium">🔵 Medium</option>
          <option value="Low">🟢 Low</option>
        </select>

        {/* Sort */}
        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '0.88rem' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
        >
          <option value="default">⇅ Sort: Default</option>
          <option value="due_date">📅 By Due Date</option>
          <option value="priority">⚡ By Priority</option>
        </select>

        {hasFilters && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setSearchQuery(''); setSelectedTag(''); setSelectedStatus(''); setSelectedPriority(''); setSortBy('default'); }}
          >✕ Clear Filters</button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* View Toggles */}
        <div className="view-toggle-group">
          <button className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => handleViewModeChange('kanban')} title="Kanban Board">🗂️ Board</button>
          <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => handleViewModeChange('list')} title="List View">📋 List</button>
          <button className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => handleViewModeChange('calendar')} title="Calendar View">📅 Calendar</button>
          <button className={`view-toggle-btn ${viewMode === 'gantt' ? 'active' : ''}`} onClick={() => handleViewModeChange('gantt')} title="Gantt / Timeline">📊 Timeline</button>
        </div>

        {/* Filter count badge */}
        {hasFilters && (
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
            {filteredTasks.length} / {tasks.length} tasks
          </span>
        )}
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Task Creation Form */}
      {showForm && (
        <div style={{ marginBottom: '2rem' }}>
          <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="loader" />
      ) : viewMode === 'calendar' ? (
        <CalendarView tasks={filteredTasks} onOpenDetails={(t) => setSelectedTaskForModal(t)} />
      ) : viewMode === 'gantt' ? (
        <GanttView tasks={filteredTasks} />
      ) : viewMode === 'kanban' ? (
        <>
          {editingTask && (
            <div style={{ marginBottom: '2rem' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>✏️ Edit Task: {editingTask.title}</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingTaskId(null)}>✕ Close Edit</button>
              </div>
              <TaskForm initialData={editingTask} onSubmit={handleUpdate} onCancel={() => setEditingTaskId(null)} />
            </div>
          )}
          <KanbanBoard
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            onEditTask={handleStartEdit}
            onDeleteTask={handleDelete}
            onOpenDetails={(t) => setSelectedTaskForModal(t)}
          />
        </>
      ) : (
        // List View
        <div className="grid grid-cols-2">
          {filteredTasks.map(task => {
            const dueBadge = getDueDateBadge(task.due_date);
            const priority = task.priority || 'Medium';
            const taskTags = task.tags ? task.tags.split(',').map(s => s.trim()).filter(Boolean) : [];

            return (
              <div key={task.id} className="card task-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {editingTaskId === task.id ? (
                  <TaskForm initialData={task} onSubmit={handleUpdate} onCancel={() => setEditingTaskId(null)} />
                ) : (
                  <>
                    <div className="task-form-header">
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{task.title}</h3>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`priority-badge priority-${priority.toLowerCase()}`}>{priority}</span>
                        <span className={`badge ${getStatusClass(task.status)}`}>{task.status}</span>
                      </div>
                    </div>

                    {dueBadge && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <span className={`due-badge ${dueBadge.className}`}>{dueBadge.text}</span>
                      </div>
                    )}

                    {/* Tags */}
                    {taskTags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {taskTags.map(tag => (
                          <span key={tag} className="task-tag" onClick={() => setSelectedTag(tag)} style={{ cursor: 'pointer' }}>#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Time Tracking */}
                    {(task.estimated_hours || task.logged_hours) && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: '0.5rem' }}>
                        ⏱️ {task.logged_hours ?? 0}h logged / {task.estimated_hours ?? '?'}h est.
                      </div>
                    )}

                    <p style={{ margin: '0.75rem 0', color: 'var(--text-soft)', flex: '1 1 auto', fontSize: '0.92rem' }}>
                      {task.description || <em>No description provided.</em>}
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-soft)', marginBottom: '0.75rem' }}>
                      <span><strong>Project:</strong> #{task.project_id}</span>
                      <span>
                        <strong>Assignee:</strong>{' '}
                        {task.assignee ? task.assignee.name : (task.assigned_user_id ? `User #${task.assigned_user_id}` : 'Unassigned')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>Status:</span>
                      <select
                        className="form-control"
                        style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.82rem', height: 'auto' }}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>

                    <div className="task-card-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                      <button
                        className="btn btn-sm"
                        style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)', fontWeight: 600 }}
                        onClick={() => setSelectedTaskForModal(task)}
                      >💬 Discussion & History</button>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditingTaskId(task.id); setError(''); }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task.id)}>Delete</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {filteredTasks.length === 0 && !showForm && (
            <p style={{ color: 'var(--text-soft)', gridColumn: '1 / -1' }}>
              {hasFilters ? 'No tasks match your filters. Try clearing them.' : 'No tasks found. Create one above!'}
            </p>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskForModal && (
        <TaskDetailModal
          task={selectedTaskForModal}
          onClose={() => setSelectedTaskForModal(null)}
        />
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <CsvUploadModal
          onClose={() => setShowCsvModal(false)}
          onSuccess={handleCsvSuccess}
        />
      )}
    </div>
  );
};

export default TaskList;
