import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { type Project, type Task, getProjects, getTasks, getCurrentUser, type User } from '../api';

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

  // Calculate overdue tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'Done') return false;
    const due = new Date(t.due_date + 'T00:00:00');
    return due.getTime() < today.getTime();
  });

  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div>
      {/* Welcome Banner */}
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Welcome back, <strong>{currentUser?.name || 'Developer'}</strong>! Here is an overview of your active workflow.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/tasks" className="btn btn-primary">
            🗂️ Open Kanban Board
          </Link>
          <Link to="/projects" className="btn btn-secondary">
            + New Project
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loader"></div>
      ) : (
        <>
          {/* Summary Metric Stats Grid */}
          <div className="dashboard-stats-grid" style={{ marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>📁</div>
              <div>
                <div className="stat-value">{projects.length}</div>
                <div className="stat-label">Active Projects</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>📝</div>
              <div>
                <div className="stat-value">{totalTasks}</div>
                <div className="stat-label">Tasks ({todoTasks} To Do, {inProgressTasks} In Progress)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>✅</div>
              <div>
                <div className="stat-value">{completedTasks}</div>
                <div className="stat-label">Completed ({overallPercent}%)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: overdueTasks.length > 0 ? 'var(--danger-soft)' : '#f1f5f9', color: overdueTasks.length > 0 ? 'var(--danger)' : '#475569' }}>
                {overdueTasks.length > 0 ? '🔴' : '🕒'}
              </div>
              <div>
                <div className="stat-value" style={{ color: overdueTasks.length > 0 ? 'var(--danger)' : 'var(--text)' }}>
                  {overdueTasks.length}
                </div>
                <div className="stat-label">Overdue Tasks</div>
              </div>
            </div>
          </div>

          {/* Project Progress Section */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📊 Project Completion Progress</h3>
              <Link to="/projects" style={{ fontSize: '0.88rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                View All Projects &rarr;
              </Link>
            </div>

            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-soft)' }}>No projects found. Create a project to start tracking progress!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {projects.map(project => {
                  const pTasks = tasks.filter(t => t.project_id === project.id);
                  const pTotal = pTasks.length;
                  const pDone = pTasks.filter(t => t.status === 'Done').length;
                  const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

                  return (
                    <div key={project.id} style={{ backgroundColor: 'var(--surface-alt)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{project.title}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginLeft: '0.75rem' }}>
                            {project.members?.length || 1} team member{(project.members?.length || 1) === 1 ? '' : 's'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: pPercent === 100 ? 'var(--success)' : 'var(--primary)' }}>
                          {pPercent}% ({pDone}/{pTotal} done)
                        </span>
                      </div>

                      <div className="progress-bar-track">
                        <div 
                          className="progress-bar-fill"
                          style={{
                            width: `${pPercent}%`,
                            backgroundColor: pPercent === 100 ? 'var(--success)' : 'var(--primary)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
