import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { type Project, type Task, getProjects, getTasks, exportAllTasksCSV } from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from '../context/ToastContext';
import {
  ProjectIcon,
  TaskIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DownloadIcon,
  ArrowRightIcon
} from './Icons';

const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const { addListener } = useWebSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectList, taskList] = await Promise.all([
        getProjects().catch(() => []),
        getTasks().catch(() => [])
      ]);
      setProjects(projectList);
      setTasks(taskList);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const unsubscribe = addListener((event) => {
      if (
        event.type === 'TASK_CREATED' ||
        event.type === 'TASK_UPDATED' ||
        event.type === 'TASK_DELETED' ||
        event.type === 'CSV_IMPORTED'
      ) {
        loadDashboardData();
      }
    });

    return () => unsubscribe();
  }, [loadDashboardData, addListener]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await exportAllTasksCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enterprise_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("CSV report downloaded");
    } catch {
      toast.error("Failed to export CSV report");
    } finally {
      setExporting(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const todoTasks = tasks.filter(t => t.status === 'To Do').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'Done') return false;
    const due = new Date(t.due_date + 'T00:00:00');
    return due.getTime() < today.getTime();
  });

  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Priority Breakdown
  const priorityCounts = {
    Urgent: tasks.filter(t => (t.priority || '').toLowerCase() === 'urgent').length,
    High: tasks.filter(t => (t.priority || '').toLowerCase() === 'high').length,
    Medium: tasks.filter(t => (t.priority || '').toLowerCase() === 'medium' || !t.priority).length,
    Low: tasks.filter(t => (t.priority || '').toLowerCase() === 'low').length,
  };

  const priorityColors = {
    Urgent: '#ef4444',
    High: '#f97316',
    Medium: '#3b82f6',
    Low: '#10b981',
  };

  const circumference = 2 * Math.PI * 40;
  let accumulatedOffset = 0;
  const donutSegments = Object.entries(priorityCounts).map(([priority, count]) => {
    const fraction = totalTasks > 0 ? count / totalTasks : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += fraction * circumference;
    return {
      priority,
      count,
      percent: Math.round(fraction * 100),
      color: priorityColors[priority as keyof typeof priorityColors],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="dashboard-container">
      {/* Printable Report Header */}
      <div className="print-only" style={{ marginBottom: '1.5rem', display: 'none' }}>
        <h1 style={{ margin: 0 }}>Executive Task & Project Status Report</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
      </div>

      {/* Top Header & Actions */}
      <div className="flex justify-between items-center no-print" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.8rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Operational analytics, project burndown metrics, and team capacity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={exporting || totalTasks === 0}
            title="Download CSV task report"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <DownloadIcon size={14} />
            <span>Export CSV</span>
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handlePrintReport}
            title="Print or Save as PDF"
            style={{ fontSize: '0.82rem' }}
          >
            Print Report
          </button>
          <Link 
            to="/tasks" 
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', textDecoration: 'none' }}
          >
            <span>Task Board</span>
            <ArrowRightIcon size={14} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loader"></div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="dashboard-stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>
                <ProjectIcon size={20} />
              </div>
              <div>
                <div className="stat-value">{projects.length}</div>
                <div className="stat-label">Active Projects</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}>
                <TaskIcon size={20} />
              </div>
              <div>
                <div className="stat-value">{totalTasks}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
                <ClockIcon size={20} />
              </div>
              <div>
                <div className="stat-value">{inProgressTasks}</div>
                <div className="stat-label">In Progress</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                <CheckCircleIcon size={20} />
              </div>
              <div>
                <div className="stat-value">{completedTasks}</div>
                <div className="stat-label">Completed ({overallPercent}%)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: overdueTasks.length > 0 ? 'var(--danger-soft)' : 'var(--surface-hover)', color: overdueTasks.length > 0 ? 'var(--danger)' : 'var(--text-soft)' }}>
                <AlertCircleIcon size={20} />
              </div>
              <div>
                <div className="stat-value" style={{ color: overdueTasks.length > 0 ? 'var(--danger)' : 'inherit' }}>
                  {overdueTasks.length}
                </div>
                <div className="stat-label">Overdue Tasks</div>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-2" style={{ marginBottom: '1.5rem' }}>
            {/* Priority Breakdown Chart */}
            <div className="card">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Task Priority Breakdown</h3>
              {totalTasks === 0 ? (
                <p style={{ color: 'var(--text-soft)' }}>No tasks found to analyze priority.</p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="14" />
                      {donutSegments.map(segment => (
                        <circle
                          key={segment.priority}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={segment.color}
                          strokeWidth="14"
                          strokeDasharray={segment.strokeDasharray}
                          strokeDashoffset={segment.strokeDashoffset}
                          style={{ transition: 'stroke-dasharray 0.3s ease' }}
                        />
                      ))}
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{totalTasks}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: 2 }}>Tasks</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {donutSegments.map(segment => (
                      <div key={segment.priority} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: segment.color, display: 'inline-block' }} />
                          <span style={{ color: 'var(--text)' }}>{segment.priority}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-soft)' }}>
                          {segment.count} ({segment.percent}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Status Distribution */}
            <div className="card">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Workflow Status Distribution</h3>
              {totalTasks === 0 ? (
                <p style={{ color: 'var(--text-soft)' }}>No tasks found to analyze workflow.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 500 }}>Overall Progress</span>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{overallPercent}% Completed</span>
                    </div>
                    <div className="progress-bar-track" style={{ height: '8px' }}>
                      <div className="progress-bar-fill" style={{ width: `${overallPercent}%`, backgroundColor: 'var(--success)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div className="flex justify-between items-center" style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span>Done</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{completedTasks} tasks ({totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center" style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span>In Progress</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{inProgressTasks} tasks ({totalTasks > 0 ? Math.round((inProgressTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center" style={{ padding: '0.35rem 0' }}>
                      <span>To Do</span>
                      <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>{todoTasks} tasks ({totalTasks > 0 ? Math.round((todoTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Project Burndown & Completion */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Project Burndown & Completion</h3>
                <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Track completion progress and task distribution across initiatives.
                </p>
              </div>
              <Link to="/projects" className="no-print" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Manage Projects &rarr;
              </Link>
            </div>

            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-soft)' }}>No projects found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {projects.map(project => {
                  const pTasks = tasks.filter(t => t.project_id === project.id);
                  const pTotal = pTasks.length;
                  const pDone = pTasks.filter(t => t.status === 'Done').length;
                  const pInProgress = pTasks.filter(t => t.status === 'In Progress').length;
                  const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

                  return (
                    <div key={project.id} style={{ backgroundColor: 'var(--surface-alt)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{project.title}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginLeft: '0.75rem' }}>
                            {project.members?.length || 1} collaborator{(project.members?.length || 1) === 1 ? '' : 's'} • {pInProgress} active
                          </span>
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: pPercent === 100 ? 'var(--success)' : 'var(--primary)' }}>
                          {pPercent}% ({pDone}/{pTotal} done)
                        </span>
                      </div>

                      <div className="progress-bar-track" style={{ height: '6px' }}>
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

          {/* Team Workload & Capacity Matrix */}
          <div className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Team Workload & Capacity</h3>
                <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Resource allocation, active task distribution, and capacity monitoring.
                </p>
              </div>
            </div>

            {(() => {
              const memberMap: Record<string, { name: string; email?: string; tasksCount: number; activeTasksCount: number; estHours: number; loggedHours: number }> = {};

              tasks.forEach(t => {
                const key = t.assignee ? t.assignee.email : (t.assigned_user_id ? `User #${t.assigned_user_id}` : 'Unassigned');
                const displayName = t.assignee ? t.assignee.name : (t.assigned_user_id ? `User #${t.assigned_user_id}` : 'Unassigned');
                if (!memberMap[key]) {
                  memberMap[key] = { name: displayName, email: t.assignee?.email, tasksCount: 0, activeTasksCount: 0, estHours: 0, loggedHours: 0 };
                }
                memberMap[key].tasksCount += 1;
                if (t.status !== 'Done') {
                  memberMap[key].activeTasksCount += 1;
                }
                if (t.estimated_hours) memberMap[key].estHours += Number(t.estimated_hours);
                if (t.logged_hours) memberMap[key].loggedHours += Number(t.logged_hours);
              });

              const membersList = Object.values(memberMap);

              if (membersList.length === 0) {
                return <p style={{ color: 'var(--text-soft)' }}>No assigned tasks found.</p>;
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {membersList.map((m, idx) => {
                    const isOverloaded = m.activeTasksCount >= 4 || m.estHours >= 30;
                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--surface-alt)',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: `1px solid ${isOverloaded ? 'var(--warning)' : 'var(--border)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem'
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                            {m.name}
                          </span>
                          {isOverloaded ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--warning)', backgroundColor: 'var(--warning-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                              High Load
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--success)', backgroundColor: 'var(--success-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                              Optimal
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                          <span>Active Tasks: <strong style={{ color: 'var(--text)' }}>{m.activeTasksCount}</strong></span>
                          <span>Effort: <strong style={{ color: 'var(--text)' }}>{m.estHours}h est.</strong></span>
                        </div>

                        <div className="progress-bar-track" style={{ height: '4px' }}>
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.round((m.activeTasksCount / 5) * 100))}%`,
                              backgroundColor: isOverloaded ? 'var(--warning)' : 'var(--primary)'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
