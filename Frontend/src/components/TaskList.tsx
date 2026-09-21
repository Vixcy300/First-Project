import React, { useState, useEffect } from 'react';
import { type Task, getTasks, createTask, updateTask, deleteTask } from '../api';
import TaskForm from './TaskForm';

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTasksData = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getTasks();
        if (isMounted) setTasks(data);
      } catch (err: any) {
        if (isMounted) setError(err?.response?.data?.detail || 'Failed to fetch tasks.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTasksData();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to refresh tasks.');
    }
  };

  const handleCreate = async (data: any) => {
    try {
      setError('');
      await createTask(data);
      setShowForm(false);
      await refreshTasks();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create task.');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (editingTaskId) {
      try {
        setError('');
        await updateTask(editingTaskId, data);
        setEditingTaskId(null);
        await refreshTasks();
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to update task.');
        throw err;
      }
    }
  };

  const handleDelete = async (taskId: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        setError('');
        await deleteTask(taskId);
        setTasks(tasks.filter(t => t.id !== taskId));
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to delete task.');
      }
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'To Do': return 'badge-todo';
      case 'In Progress': return 'badge-inprogress';
      case 'Done': return 'badge-done';
      default: return '';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Tasks</h1>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); }}>
            + New Task
          </button>
        )}
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}

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
      ) : (
        <div className="grid grid-cols-2">
          {tasks.map(task => (
            <div key={task.id} className="card task-card">
              {editingTaskId === task.id ? (
                <TaskForm 
                  initialData={task} 
                  onSubmit={handleUpdate} 
                  onCancel={() => setEditingTaskId(null)} 
                />
              ) : (
                <>
                  <div className="task-form-header">
                    <h3>{task.title}</h3>
                    <span className={`badge ${getBadgeClass(task.status)}`}>{task.status}</span>
                  </div>
                  <p>{task.description || 'No description provided.'}</p>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.75rem 0' }}>
                    <span><strong>Project ID:</strong> #{task.project_id}</span>
                    <span>
                      <strong>Assignee:</strong>{' '}
                      {task.assignee ? task.assignee.name : (task.assigned_user_id ? `User #${task.assigned_user_id}` : 'Unassigned')}
                    </span>
                  </div>
                  
                  <div className="task-card-actions">
                    <button 
                      className="btn btn-sm" 
                      style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}
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
                </>
              )}
            </div>
          ))}
          {tasks.length === 0 && !showForm && (
            <p style={{ color: 'var(--text-secondary)' }}>No tasks found. Create one above!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskList;
