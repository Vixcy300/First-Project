import React, { useState, useEffect, useCallback } from 'react';
import { 
  type Task, 
  type TaskActivity, 
  type TaskComment, 
  type Subtask,
  getTaskActivities, 
  getTaskComments, 
  createTaskComment,
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask
} from '../api';
import { useToast } from '../context/ToastContext';
import { useWebSocket } from '../context/WebSocketContext';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
};

export const getDueDateBadge = (dueDate?: string) => {
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate + 'T00:00:00');
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: `🔴 Overdue by ${days} day${days === 1 ? '' : 's'}`,
      className: 'badge-overdue'
    };
  } else if (diffDays === 0) {
    return {
      text: '🟡 Due today',
      className: 'badge-today'
    };
  } else {
    return {
      text: `🟢 Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${dueDate})`,
      className: 'badge-future'
    };
  }
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const { addListener } = useWebSocket();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commentsData, activitiesData, subtasksData] = await Promise.all([
        getTaskComments(task.id),
        getTaskActivities(task.id),
        getSubtasks(task.id)
      ]);
      setComments(commentsData);
      setActivities(activitiesData);
      setSubtasks(subtasksData);
    } catch (err) {
      console.error("Failed to load task discussion data", err);
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    loadData();

    const unsubscribe = addListener((event) => {
      if (
        (event.type === 'SUBTASK_UPDATED' && event.data?.task_id === task.id) ||
        (event.type === 'COMMENT_CREATED' && event.data?.task_id === task.id)
      ) {
        loadData();
      }
    });

    return () => unsubscribe();
  }, [loadData, addListener, task.id]);

  const handleToggleSubtask = async (subtask: Subtask) => {
    try {
      const updated = await updateSubtask(subtask.id, { completed: !subtask.completed });
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)));
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    setAddingSubtask(true);
    try {
      const created = await createSubtask(task.id, newSubtaskTitle.trim());
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle('');
      toast.success('Subtask added!');
    } catch {
      toast.error('Failed to add subtask');
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      await deleteSubtask(subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
      toast.success('Subtask deleted');
    } catch {
      toast.error('Failed to delete subtask');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setPostingComment(true);
    try {
      await createTaskComment(task.id, newComment.trim());
      setNewComment('');
      toast.success("Comment posted!");
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to post comment";
      toast.error(msg);
    } finally {
      setPostingComment(false);
    }
  };

  const dueBadge = getDueDateBadge(task.due_date);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <span className={`status-pill status-${task.status.toLowerCase().replace(' ', '-')}`}>
                {task.status}
              </span>
              <span className={`priority-badge priority-${(task.priority || 'Medium').toLowerCase()}`}>
                {task.priority || 'Medium'}
              </span>
              {dueBadge && (
                <span className={`due-badge ${dueBadge.className}`}>
                  {dueBadge.text}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{task.title}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Description & Assignee */}
          <div className="task-detail-info">
            <p style={{ color: 'var(--text-soft)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
              {task.description || <em>No description provided.</em>}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-soft)' }}>
              <div>
                <strong>Assignee:</strong> {task.assignee ? task.assignee.name : 'Unassigned'}
              </div>
              {task.due_date && (
                <div>
                  <strong>Deadline:</strong> {task.due_date}
                </div>
              )}
            </div>
          </div>

          {/* Subtasks & Checklist Section */}
          <div className="subtasks-section" style={{ margin: '1.25rem 0', padding: '1rem', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                ☑ Subtasks Checklist ({subtasks.filter(s => s.completed).length}/{subtasks.length})
              </span>
              {subtasks.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 600 }}>
                  {Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)}%
                </span>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="progress-bar-track" style={{ height: '6px', marginBottom: '0.9rem' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)}%`,
                    backgroundColor: subtasks.filter(s => s.completed).length === subtasks.length ? 'var(--success)' : 'var(--primary)'
                  }}
                />
              </div>
            )}

            {/* Subtasks List */}
            <div className="subtasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {subtasks.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.4rem 0.6rem',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '5px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => handleToggleSubtask(s)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: '0.88rem',
                      textDecoration: s.completed ? 'line-through' : 'none',
                      color: s.completed ? 'var(--text-soft)' : 'var(--text)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleToggleSubtask(s)}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={() => handleDeleteSubtask(s.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Delete subtask"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add Subtask Form */}
            <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Add a new checklist subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.7rem' }}
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={addingSubtask || !newSubtaskTitle.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                + Add
              </button>
            </form>
          </div>

          {/* Tab Navigation */}
          <div className="modal-tabs">
            <button 
              className={`modal-tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              💬 Comments & Discussion ({comments.length})
            </button>
            <button 
              className={`modal-tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
              onClick={() => setActiveTab('activities')}
            >
              📜 Activity History ({activities.length})
            </button>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-soft)' }}>
              Loading...
            </div>
          ) : activeTab === 'comments' ? (
            <div className="comments-section">
              <div className="comments-stream">
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                    No comments yet. Start the discussion below!
                  </div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="comment-bubble">
                      <div className="comment-header">
                        <span className="comment-author">👤 {c.user?.name || `User #${c.user_id}`}</span>
                        <span className="comment-time">{formatTimeAgo(c.created_at)}</span>
                      </div>
                      <div className="comment-content">{c.content}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="comment-form">
                <textarea
                  className="form-control"
                  placeholder="Leave an update, note, or question..."
                  rows={2}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  disabled={postingComment}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={postingComment || !newComment.trim()}
                  style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}
                >
                  {postingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </form>
            </div>
          ) : (
            <div className="activities-section">
              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                  No activity recorded yet.
                </div>
              ) : (
                <div className="timeline">
                  {activities.map(a => (
                    <div key={a.id} className="timeline-item">
                      <div className="timeline-marker" />
                      <div className="timeline-content">
                        <span className="timeline-actor">{a.user?.name || `User #${a.user_id}`}</span>{' '}
                        <span className="timeline-action">{a.action}</span>
                        <div className="timeline-time">{formatTimeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;

