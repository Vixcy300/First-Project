import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type User, getCurrentUser, logoutUser, sendTestNotification } from '../api';
import NotificationCenter from './NotificationCenter';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from '../context/ToastContext';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { isConnected } = useWebSocket();
  const { toast } = useToast();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  useEffect(() => {
    getCurrentUser()
      .then(user => setCurrentUser(user))
      .catch(() => {
        logoutUser();
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const handleTestAlert = async () => {
    try {
      await sendTestNotification();
      toast.success('🔔 Test notification sent!');
    } catch {
      toast.error('Failed to send test notification');
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-title">Portal.</div>

        <nav className="flex flex-col gap-2">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            📊 Dashboard
          </Link>
          <Link to="/projects" className={`nav-link ${location.pathname.startsWith('/projects') ? 'active' : ''}`}>
            📁 Projects
          </Link>
          <Link to="/tasks" className={`nav-link ${location.pathname.startsWith('/tasks') ? 'active' : ''}`}>
            ✅ Tasks
          </Link>
          <Link to="/calendar" className={`nav-link ${location.pathname.startsWith('/calendar') ? 'active' : ''}`}>
            📅 Calendar
          </Link>
          <Link to="/timeline" className={`nav-link ${location.pathname.startsWith('/timeline') ? 'active' : ''}`}>
            📊 Timeline
          </Link>
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentUser && (
            <div style={{ fontSize: '0.85rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--surface-hover)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>👤 {currentUser.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-all' }}>{currentUser.email}</div>
            </div>
          )}
          <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-navbar">
          <div className="top-navbar-left">
            <span 
              className={`ws-status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
              title={isConnected ? 'Real-time WebSocket connected' : 'WebSocket reconnecting'}
            >
              <span className="ws-dot" />
              <span>{isConnected ? 'Live Synced' : 'Reconnecting...'}</span>
            </span>
          </div>

          <div className="top-navbar-right">
            <button
              onClick={toggleTheme}
              className="btn btn-secondary btn-sm"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>

            <button
              onClick={handleTestAlert}
              className="btn btn-secondary btn-sm"
              title="Send a test notification"
              style={{ fontSize: '0.82rem' }}
            >
              🔔 Test Alert
            </button>

            <NotificationCenter />
            {currentUser && (
              <div className="user-pill">
                <span className="user-avatar">{currentUser.name.charAt(0).toUpperCase()}</span>
                <span className="user-name">{currentUser.name}</span>
              </div>
            )}
          </div>
        </header>

        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
