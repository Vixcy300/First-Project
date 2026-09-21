import React, { useState, useEffect } from 'react';
import { type Project, type ProjectMember, getProjects, getProjectMembers } from '../api';

interface TaskFormProps {
  initialData?: any; 
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'To Do');
  const [projectId, setProjectId] = useState<number | ''>(initialData?.project_id || '');
  const [assignedUserId, setAssignedUserId] = useState<number | ''>(initialData?.assigned_user_id || '');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchProj = async () => {
      try {
        const data = await getProjects();
        if (isMounted) {
          setProjects(data);
          if (!initialData && data.length === 1) {
            setProjectId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load projects for form", err);
      }
    };
    fetchProj();
    return () => {
      isMounted = false;
    };
  }, [initialData]);

  useEffect(() => {
    let isMounted = true;
    if (projectId !== '') {
      setLoadingMembers(true);
      getProjectMembers(Number(projectId))
        .then(memberList => {
          if (isMounted) setMembers(memberList);
        })
        .catch(err => {
          console.error("Failed to load members for project", err);
          if (isMounted) setMembers([]);
        })
        .finally(() => {
          if (isMounted) setLoadingMembers(false);
        });
    } else {
      setMembers([]);
    }
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!title.trim() || projectId === '') {
      setFormError("Title and Project are required!");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        title,
        description,
        status,
        project_id: Number(projectId),
        assigned_user_id: assignedUserId === '' ? null : Number(assignedUserId),
      };
      await onSubmit(data);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "Failed to save task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
      <h3>{initialData ? 'Edit Task' : 'Create New Task'}</h3>

      {formError && <div className="error-message" style={{ marginBottom: '1rem' }}>{formError}</div>}
      
      <div className="form-group">
        <label className="form-label">Task Title *</label>
        <input 
          type="text" 
          className="form-control" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="e.g. Design database schema"
          required 
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea 
          className="form-control" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          rows={3} 
          placeholder="Describe the task details..."
        />
      </div>

      <div className="grid grid-cols-3">
        <div className="form-group">
          <label className="form-label">Project *</label>
          <select 
            className="form-control" 
            value={projectId} 
            onChange={e => {
              const val = e.target.value === '' ? '' : Number(e.target.value);
              setProjectId(val);
              setAssignedUserId('');
            }}
            required
            disabled={!!initialData}
          >
            <option value="">-- Select Project --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Assignee (Project Members Only)</label>
          <select 
            className="form-control" 
            value={assignedUserId} 
            onChange={e => setAssignedUserId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={projectId === '' || loadingMembers}
          >
            <option value="">-- Unassigned --</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.user?.name || `User #${m.user_id}`} ({m.role})
              </option>
            ))}
          </select>
          {projectId !== '' && members.length === 0 && !loadingMembers && (
            <small style={{ color: 'var(--text-secondary)' }}>No other members in this project yet.</small>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select 
            className="form-control" 
            value={status} 
            onChange={e => setStatus(e.target.value)}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>
        </div>
      </div>

      <div className="task-card-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn" onClick={onCancel} style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
