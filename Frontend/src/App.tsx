import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import AuthPage from './components/AuthPage';
import { ToastProvider } from './context/ToastContext';
import './index.css';

const Dashboard = () => (
  <div>
    <h1 className="page-title">Dashboard</h1>
    <div className="card">
      <h3>Welcome to the Task & Project Management Portal</h3>
      <p style={{ marginTop: '0.5rem', color: 'var(--text-soft)' }}>
        Use the sidebar to navigate to Projects and Tasks.
      </p>
      <p style={{ marginTop: '0.25rem', color: 'var(--text-soft)' }}>
        This application demonstrates a full-stack integration with FastAPI, SQLAlchemy, React, and TypeScript.
      </p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="tasks" element={<TaskList />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
