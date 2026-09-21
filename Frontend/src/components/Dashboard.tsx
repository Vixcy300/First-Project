import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { type Project, type Task, getProjects, getTasks, getCurrentUser, type User } from '../api';
import { getDueDateBadge } from './TaskDetailModal';

const Dashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [user, projectList, taskList] = await Promise.all([
          getCurrentUser().catch(() => null),
          getProjects().catch(() => []),
          getTasks().catch(() => [])
        ]);
        if (isMounted) {
          setCurrentUser(user);
          setProjects(projectList);
          setTasks(taskList);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const todoTasks = tasks.filter(t => t.status === 'To Do').length;
  const urgentTasks = tasks.filter(t => t.priority === 'Urgent' || t.priority === 'High');

  // Tasks assigned to current user
  const myTasks = tasks.filter(t => currentUser && t.assigned_user_id === currentUser.id);

  // Calculate overdue tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'Done') return false;
    const due = new Date(t.due_date + 'T00:00:00');
    return due.getTime() < today.getTime();
  });

  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Format today's date
  const todayDateString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="dashboard-wrapper">
      {/* Top Header Bar */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-date-chip">{todayDateString}</div>
          <h1 className="dashboard-greeting">
            Welcome back, {currentUser?.name ? currentUser.name.split(' ')[0] : 'there'}
          </h1>
          <p className="dashboard-subtitle">
            Here's what is happening across your team and active projects today.
          </p>
        </div>

        <div className="dashboard-actions">
          <Link to="/tasks" className="btn btn-primary">
            🗂️ Kanban Board
          </Link>
          <Link to="/projects" className="btn btn-secondary">
            + New Project
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loader" style={{ margin: '3rem auto' }}></div>
      ) : (
        <>
          {/* Key Metrics Row */}
          <div className="dashboard-stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-icon-projects">📁</div>
              <div>
                <div className="stat-value">{projects.length}</div>
                <div className="stat-label">Active Projects</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-tasks">📝</div>
              <div>
                <div className="stat-value">{inProgressTasks}</div>
                <div className="stat-label">Tasks In Progress ({todoTasks} To Do)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-completed">✅</div>
              <div>
                <div className="stat-value">{completedTasks}</div>
                <div className="stat-label">{overallPercent}% Completed Total</div>
              </div>
            </div>

            <div className="stat-card">
              <div className={`stat-icon ${overdueTasks.length > 0 ? 'stat-icon-overdue' : 'stat-icon-neutral'}`}>
                {overdueTasks.length > 0 ? '⚠️' : '🎯'}
              </div>
              <div>
                <div className="stat-value" style={{ color: overdueTasks.length > 0 ? 'var(--danger)' : 'var(--text)' }}>
                  {overdueTasks.length}
                </div>
                <div className="stat-label">{overdueTasks.length > 0 ? 'Overdue Tasks' : 'All on Track'}</div>
              </div>
            </div>
          </div>

          {/* Two-Column Layout */}
          <div className="dashboard-layout-grid">
            {/* Left Column (Main Content) */}
            <div className="dashboard-main-col">
              {/* Project Health & Progress Cards */}
              <div className="dashboard-section-card">
                <div className="dashboard-section-header">
                  <div>
                    <h3 className="dashboard-section-title">Projects & Milestones</h3>
                    <p className="dashboard-section-desc">Track progress and health across your workspaces</p>
                  </div>
                  <Link to="/projects" className="dashboard-link">
                    Manage all ({projects.length}) &rarr;
                  </Link>
                </div>

                {projects.length === 0 ? (
                  <div className="dashboard-empty-state">
                    <p>No projects created yet.</p>
                    <Link to="/projects" className="btn btn-sm btn-primary" style={{ marginTop: '0.5rem' }}>
                      Create your first project
                    </Link>
                  </div>
                ) : (
                  <div className="dashboard-project-list">
                    {projects.map(project => {
                      const pTasks = tasks.filter(t => t.project_id === project.id);
                      const pTotal = pTasks.length;
                      const pDone = pTasks.filter(t => t.status === 'Done').length;
                      const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;
                      const isOwner = currentUser?.id === project.owner_id;

                      return (
                        <div key={project.id} className="dashboard-project-item">
                          <div className="dashboard-project-meta">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className="dashboard-project-name">{project.title}</span>
                              <span className="dashboard-role-badge">
                                {isOwner ? '👑 Owner' : '👥 Member'}
                              </span>
                            </div>
                            <span className="dashboard-progress-number">
                              {pPercent}% ({pDone}/{pTotal} done)
                            </span>
                          </div>

                          <div className="progress-bar-track" style={{ height: '7px', margin: '0.5rem 0 0.6rem' }}>
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${pPercent}%`,
                                backgroundColor: pPercent === 100 ? 'var(--success)' : 'var(--primary)'
                              }}
                            />
                          </div>

                          <div className="dashboard-project-footer">
                            <span className="dashboard-team-count">
                              👥 {project.members?.length || 1} team member{(project.members?.length || 1) === 1 ? '' : 's'}
                            </span>
                            <Link 
                              to="/tasks" 
                              className="dashboard-view-tasks-btn"
                            >
                              Open Board &rarr;
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* My Assigned Tasks Section */}
              <div className="dashboard-section-card">
                <div className="dashboard-section-header">
                  <div>
                    <h3 className="dashboard-section-title">Assigned to Me</h3>
                    <p className="dashboard-section-desc">Quick overview of tasks you need to complete</p>
                  </div>
                  <Link to="/tasks" className="dashboard-link">
                    View in Tasks &rarr;
                  </Link>
                </div>

                {myTasks.length === 0 ? (
                  <div className="dashboard-empty-state">
                    <p>🎉 You have no pending tasks assigned to you.</p>
                  </div>
                ) : (
                  <div className="dashboard-my-tasks-list">
                    {myTasks.slice(0, 5).map(task => {
                      const dueBadge = getDueDateBadge(task.due_date);
                      const priority = task.priority || 'Medium';

                      return (
                        <div key={task.id} className="dashboard-my-task-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                            <span className={`priority-badge priority-${priority.toLowerCase()}`}>
                              {priority}
                            </span>
                            <span className="dashboard-task-title" title={task.title}>
                              {task.title}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                            {dueBadge && (
                              <span className={`due-badge ${dueBadge.className}`} style={{ fontSize: '0.72rem' }}>
                                {dueBadge.text}
                              </span>
                            )}
                            <span className={`status-pill status-${task.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (Side Panel Insights) */}
            <div className="dashboard-side-col">
              {/* Task Breakdown by Status */}
              <div className="dashboard-section-card">
                <h3 className="dashboard-section-title" style={{ marginBottom: '1rem' }}>Task Distribution</h3>
                <div className="distribution-list">
                  <div className="distribution-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="status-indicator status-ind-todo" />
                      <span>To Do</span>
                    </div>
                    <strong>{todoTasks}</strong>
                  </div>

                  <div className="distribution-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="status-indicator status-ind-inprogress" />
                      <span>In Progress</span>
                    </div>
                    <strong>{inProgressTasks}</strong>
                  </div>

                  <div className="distribution-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="status-indicator status-ind-done" />
                      <span>Done</span>
                    </div>
                    <strong>{completedTasks}</strong>
                  </div>
                </div>
              </div>

              {/* High Priority Alerts */}
              {urgentTasks.length > 0 && (
                <div className="dashboard-section-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                  <h3 className="dashboard-section-title" style={{ color: 'var(--warning)', marginBottom: '0.5rem' }}>
                    ⚡ High Priority Focus ({urgentTasks.length})
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', marginBottom: '0.75rem' }}>
                    Critical tasks needing your attention
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {urgentTasks.slice(0, 3).map(ut => (
                      <div key={ut.id} style={{ fontSize: '0.85rem', padding: '6px 8px', background: 'var(--surface-alt)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                          {ut.title}
                        </span>
                        <span className={`priority-badge priority-${(ut.priority || 'High').toLowerCase()}`}>
                          {ut.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
