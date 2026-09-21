import React, { useState, useEffect } from 'react';
import { type Task, type Project, getTasks, getProjects, createTask, updateTask, deleteTask } from '../api';
import TaskForm from './TaskForm';
import TaskDetailModal, { getDueDateBadge } from './TaskDetailModal';
import KanbanBoard from './KanbanBoard';
import { useToast } from '../context/ToastContext';

const TaskList: React.FC = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    const saved = localStorage.getItem('task_view_mode');
    return saved === 'list' ? 'list' : 'kanban';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);

  const handleViewModeChange = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('task_view_mode', mode);
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
          const msg = err?.response?.data?.detail || 'Failed to fetch tasks.';
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const refreshTasks = async () => {
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

  return (
    <div>
      {/* Top Header & Controls */}
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Tasks</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Manage, organize, and drag tasks across your workflow.
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

          {/* View Toggle */}
          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('kanban')}
              title="Kanban Board View"
            >
              🗂️ Board
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('list')}
              title="List View"
            >
              📋 List
            </button>
          </div>

          {!showForm && (
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); }}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Task Creation / Edit Form Modal or Inline */}
      {showForm && (
        <div style={{ marginBottom: '2rem' }}>
          <TaskForm 
            onSubmit={handleCreate} 
            onCancel={() => setShowForm(false)} 
          />
        </div>
      )}

      {loading ? (
        <div className="loader"></div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onEditTask={(t) => { setEditingTaskId(t.id); setShowForm(false); }}
          onDeleteTask={handleDelete}
          onOpenDetails={(t) => setSelectedTaskForModal(t)}
        />
      ) : (
        <div className="grid grid-cols-2">
          {tasks.map(task => {
            const dueBadge = getDueDateBadge(task.due_date);
            const priority = task.priority || 'Medium';

            return (
              <div key={task.id} className="card task-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {editingTaskId === task.id ? (
                  <TaskForm 
                    initialData={task} 
                    onSubmit={handleUpdate} 
                    onCancel={() => setEditingTaskId(null)} 
                  />
                ) : (
                  <>
                    <div className="task-form-header">
                      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{task.title}</h3>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`priority-badge priority-${priority.toLowerCase()}`}>
                          {priority}
                        </span>
                        <span className={`badge ${getStatusClass(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>

                    {dueBadge && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <span className={`due-badge ${dueBadge.className}`}>
                          {dueBadge.text}
                        </span>
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

                    {/* Quick status mover */}
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
                      >
                        💬 Discussion & History
                      </button>
                      
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => { setEditingTaskId(task.id); setError(''); }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(task.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {tasks.length === 0 && !showForm && (
            <p style={{ color: 'var(--text-soft)' }}>No tasks found. Create one above!</p>
          )}
        </div>
      )}

      {/* Task Discussion & Activity History Modal */}
      {selectedTaskForModal && (
        <TaskDetailModal 
          task={selectedTaskForModal}
          onClose={() => setSelectedTaskForModal(null)}
        />
      )}
    </div>
  );
};

export default TaskList;
