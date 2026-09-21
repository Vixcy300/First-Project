import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import AuthPage from './components/AuthPage';
import './index.css'; // Import our premium CSS

const Dashboard = () => (
  <div>
    <h1 className="page-title">Dashboard</h1>
    <div className="card">
      <h3>Welcome to the Task & Project Management Portal</h3>
      <p>Use the sidebar to navigate to Projects and Tasks.</p>
      <p>This application demonstrates a full-stack integration with FastAPI, SQLAlchemy, React, and TypeScript.</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
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
  );
};

export default App;
