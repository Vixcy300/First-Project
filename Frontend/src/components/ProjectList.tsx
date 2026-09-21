import React, { useState, useEffect } from 'react';
import {
  type Project,
  type User,
  getProjects,
  createProject,
  deleteProject,
  getCurrentUser,
  addProjectMember,
  removeProjectMember
} from '../api';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // State for the "Create Project" form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // State for adding a member
  const [activeProjectForMember, setActiveProjectForMember] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError('');
        const [user, projectList] = await Promise.all([
          getCurrentUser().catch(() => null),
          getProjects()
        ]);
        if (isMounted) {
          setCurrentUser(user);
          setProjects(projectList);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.response?.data?.detail || 'Failed to fetch projects. Is the backend running?');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setError('');
      setSuccessMsg('');
      const created = await createProject({ title: newTitle, description: newDescription });
      setProjects([created, ...projects]);
      setNewTitle('');
      setNewDescription('');
      setSuccessMsg('Project created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create project.');
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm("Are you sure you want to delete this project? Only the owner can delete it.")) {
      return;
    }

    try {
      setError('');
      setSuccessMsg('');
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      setSuccessMsg('Project deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete project. Only the project owner can delete it.');
    }
  };

  const handleAddMember = async (projectId: number) => {
    if (!memberEmail.trim()) return;
    try {
      setMemberLoading(true);
      setError('');
      setSuccessMsg('');
      await addProjectMember(projectId, { email: memberEmail.trim() });
      setMemberEmail('');
      setActiveProjectForMember(null);
      setSuccessMsg(`Added ${memberEmail} to the project!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to add member. Check that the user email exists.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (projectId: number, userId: number) => {
    try {
      setError('');
      await removeProjectMember(projectId, userId);
      const updated = await getProjects();
      setProjects(updated);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to remove member.');
    }
  };

  return (
    <div>
      <h1 className="page-title">Projects</h1>
      
      {error && <div className="error-message" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {successMsg && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 500 }}>
          {successMsg}
        </div>
      )}
      
      {/* Create Project Form */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>Create New Project</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          You will be set as the project owner. You can invite team members to collaborate on tasks.
        </p>
        <form onSubmit={handleCreateProject} className="project-form">
          <input
            type="text"
            className="form-control"
            placeholder="Project Title *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <input
            type="text"
            className="form-control"
            placeholder="Description (Optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            + Create Project
          </button>
        </form>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="loader"></div>
      ) : (
        <div className="grid grid-cols-2">
          {projects.map(project => {
            const isOwner = currentUser?.id === project.owner_id;

            return (
              <div key={project.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="flex justify-between items-center">
                  <h3 style={{ margin: 0 }}>{project.title}</h3>
                  <span className="badge badge-inprogress">
                    {isOwner ? '👑 Owner' : '👥 Member'}
                  </span>
                </div>

                <p style={{ margin: 0 }}>{project.description || 'No description provided.'}</p>
                
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>Owner:</strong> {project.owner ? project.owner.name : (isOwner ? 'You' : `User #${project.owner_id}`)}
                </div>

                {/* Team Members List */}
                <div style={{ backgroundColor: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                    <strong>Team Members ({project.members?.length || 0}):</strong>
                    <button 
                      className="btn btn-sm" 
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setActiveProjectForMember(activeProjectForMember === project.id ? null : project.id);
                        setError('');
                      }}
                    >
                      {activeProjectForMember === project.id ? 'Close' : '+ Add Member'}
                    </button>
                  </div>

                  {project.members && project.members.length > 0 ? (
                    <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                      {project.members.map(m => (
                        <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span>
                            {m.user?.name || `User #${m.user_id}`} ({m.user?.email || m.role})
                          </span>
                          {/* Owner can remove members (except self) */}
                          {isOwner && m.user_id !== project.owner_id && (
                            <button 
                              onClick={() => handleRemoveMember(project.id, m.user_id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No other members yet.</p>
                  )}

                  {/* Add Member inline form */}
                  {activeProjectForMember === project.id && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Teammate's email"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAddMember(project.id)}
                        disabled={memberLoading}
                      >
                        {memberLoading ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center" style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <span className="badge badge-todo">{project.tasks?.length || 0} Tasks</span>
                  {/* Delete button: Visible to owner */}
                  {isOwner && (
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      Delete Project
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {projects.length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>
              No projects found. Create your first project above!
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
