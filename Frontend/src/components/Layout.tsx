import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type User, getCurrentUser, logoutUser } from '../api';
import NotificationCenter from './NotificationCenter';
import { useWebSocket } from '../context/WebSocketContext';
import {
  DashboardIcon,
  ProjectIcon,
  TaskIcon,
  CalendarIcon,
  TimelineIcon,
  SunIcon,
  MoonIcon
} from './Icons';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { isConnected } = useWebSocket();

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

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <DashboardIcon size={17} /> },
    { to: '/projects', label: 'Projects', icon: <ProjectIcon size={17} /> },
    { to: '/tasks', label: 'Tasks', icon: <TaskIcon size={17} /> },
    { to: '/calendar', label: 'Calendar', icon: <CalendarIcon size={17} /> },
    { to: '/timeline', label: 'Timeline', icon: <TimelineIcon size={17} /> },
  ];

  return (
    <div className="layout">
      {/* Enterprise Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 8px 12px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
            P
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Portal
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', backgroundColor: 'var(--primary-soft)', padding: '1px 6px', borderRadius: 4, marginLeft: 'auto' }}>
            Enterprise
          </span>
        </div>

        <nav className="flex flex-col gap-1" style={{ marginTop: '0.5rem' }}>
          {navItems.map(item => {
            const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-link ${isActive ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '9px 12px', fontSize: '0.88rem' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', color: isActive ? 'var(--primary)' : 'var(--text-soft)' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.5rem' }}>
              <div style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, flexShrink: 0, borderRadius: '50%', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.name}</div>
                <div style={{ color: 'var(--text-soft)', fontSize: '0.72rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.email}</div>
              </div>
            </div>
          )}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleLogout} 
            style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'center' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-navbar">
          <div className="top-navbar-left">
            <span 
              className={`ws-status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
              title={isConnected ? 'Connected to live updates' : 'Reconnecting to live sync'}
            >
              <span className="ws-dot" />
              <span>{isConnected ? 'Live Sync' : 'Connecting...'}</span>
            </span>
          </div>

          <div className="top-navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn btn-secondary btn-sm"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              style={{ padding: '0.35rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              {theme === 'light' ? <MoonIcon size={15} /> : <SunIcon size={15} />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            <NotificationCenter />
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
