import React, { useState, useEffect, useCallback } from 'react';
import { 
  type Task, 
  type TaskActivity, 
  type TaskComment, 
  getTaskActivities, 
  getTaskComments, 
  createTaskComment 
} from '../api';
import { useToast } from '../context/ToastContext';

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
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commentsData, activitiesData] = await Promise.all([
        getTaskComments(task.id),
        getTaskActivities(task.id)
      ]);
      setComments(commentsData);
      setActivities(activitiesData);
    } catch (err) {
      console.error("Failed to load task discussion data", err);
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
