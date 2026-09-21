import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type User, getCurrentUser, logoutUser } from '../api';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-title">Portal.</div>

        <nav className="flex flex-col gap-2">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Dashboard
          </Link>
          <Link to="/projects" className={`nav-link ${location.pathname.startsWith('/projects') ? 'active' : ''}`}>
            Projects
          </Link>
          <Link to="/tasks" className={`nav-link ${location.pathname.startsWith('/tasks') ? 'active' : ''}`}>
            Tasks
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
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
