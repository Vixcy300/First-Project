import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { type Project, type Task, getProjects, getTasks, exportAllTasksCSV } from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from '../context/ToastContext';

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

    // Auto-update dashboard on real-time WebSocket events
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
      a.download = `project_portal_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("CSV report downloaded successfully!");
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

  // Donut chart calculations
  const priorityColors = {
    Urgent: '#ef4444',
    High: '#f97316',
    Medium: '#3b82f6',
    Low: '#10b981',
  };

  const circumference = 2 * Math.PI * 40; // r=40
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
          <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Live performance analytics, project burndown, and workflow trends.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={exporting || totalTasks === 0}
            title="Download CSV task report"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            📥 Export CSV
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handlePrintReport}
            title="Print or Save as PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            🖨️ Print / PDF
          </button>
          <Link to="/tasks" className="btn btn-primary">
            🗂️ Tasks & Board
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loader"></div>
      ) : (
        <>
          {/* Summary Stat Cards */}
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
                <div className="stat-label">{overdueTasks.length > 0 ? 'Overdue Tasks' : 'All on Track'}</div>
              </div>
            </div>
          </div>

          {/* Visual Analytics Grid */}
          <div className="grid grid-cols-2" style={{ marginBottom: '2rem' }}>
            {/* Priority Breakdown Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>
                🎯 Task Priority Breakdown
              </h3>

              {totalTasks === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-soft)' }}>
                  No tasks available to visualize.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1.5rem', flex: 1 }}>
                  {/* Interactive SVG Donut */}
                  <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                    <svg viewBox="0 0 100 100" width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="12" />
                      {donutSegments.map(seg => (
                        <circle
                          key={seg.priority}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="12"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          style={{ transition: 'stroke-dasharray 0.5s ease' }}
                        />
                      ))}
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalTasks}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>Tasks</span>
                    </div>
                  </div>

                  {/* Priority Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {donutSegments.map(seg => (
                      <div key={seg.priority} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: seg.color }} />
                        <span style={{ minWidth: '65px', fontWeight: 600 }}>{seg.priority}</span>
                        <span style={{ color: 'var(--text-soft)' }}>{seg.count} ({seg.percent}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Workflow Distribution Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1rem' }}>
                ⚡ Status Distribution & Flow
              </h3>

              {totalTasks === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-soft)' }}>
                  No tasks available to visualize.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
                  {/* Stacked Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--text-soft)' }}>
                      <span>Overall Flow</span>
                      <span>{overallPercent}% Complete</span>
                    </div>
                    <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--border)' }}>
                      <div style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`, backgroundColor: 'var(--success)' }} title={`Done: ${completedTasks}`} />
                      <div style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%`, backgroundColor: 'var(--primary)' }} title={`In Progress: ${inProgressTasks}`} />
                      <div style={{ width: `${totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0}%`, backgroundColor: '#94a3b8' }} title={`To Do: ${todoTasks}`} />
                    </div>
                  </div>

                  {/* Individual Bar Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                    <div className="flex justify-between items-center">
                      <span>✅ <strong>Done</strong></span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{completedTasks} tasks ({totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>⚡ <strong>In Progress</strong></span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{inProgressTasks} tasks ({totalTasks > 0 ? Math.round((inProgressTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>📝 <strong>To Do</strong></span>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>{todoTasks} tasks ({totalTasks > 0 ? Math.round((todoTasks/totalTasks)*100) : 0}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Project Burndown & Completion Progress */}
          <div className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📊 Project Burndown & Completion</h3>
                <p style={{ color: 'var(--text-soft)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                  Track completion percentages, task loads, and team members across all projects.
                </p>
              </div>
              <Link to="/projects" className="no-print" style={{ fontSize: '0.88rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Manage Projects &rarr;
              </Link>
            </div>

            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-soft)' }}>No projects found. Create a project to start tracking progress!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {projects.map(project => {
                  const pTasks = tasks.filter(t => t.project_id === project.id);
                  const pTotal = pTasks.length;
                  const pDone = pTasks.filter(t => t.status === 'Done').length;
                  const pInProgress = pTasks.filter(t => t.status === 'In Progress').length;
                  const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

                  return (
                    <div key={project.id} style={{ backgroundColor: 'var(--surface-alt)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-center" style={{ marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.98rem', color: 'var(--text)' }}>{project.title}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginLeft: '0.75rem' }}>
                            {project.members?.length || 1} member{(project.members?.length || 1) === 1 ? '' : 's'} • {pInProgress} in flight
                          </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: pPercent === 100 ? 'var(--success)' : 'var(--primary)' }}>
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
