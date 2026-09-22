import axios from 'axios';

// Create an Axios instance with a base URL pointing to our FastAPI backend.
const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- TypeScript Interfaces ---

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: string;
  user?: User;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  project_id: number;
  assigned_user_id?: number;
  assignee?: User;
  priority?: string;
  due_date?: string;
}

export interface Project {
  id: number;
  title: string;
  description?: string;
  owner_id?: number;
  owner?: User;
  members?: ProjectMember[];
  tasks: Task[];
}

export interface TaskCreate {
  title: string;
  description?: string;
  status?: string;
  project_id: number;
  assigned_user_id?: number;
  priority?: string;
  due_date?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: string;
  assigned_user_id?: number;
  priority?: string;
  due_date?: string;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  user_id: number;
  user?: User;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
  created_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user?: User;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface CSVImportResult {
  projects_created: number;
  tasks_created: number;
  tasks_updated: number;
  errors: string[];
}

export interface ProjectCreate {
  title: string;
  description?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// --- Auth Storage Helper ---

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('access_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('access_token');
    delete api.defaults.headers.common['Authorization'];
  }
};

// Initialize authorization header if token exists in localStorage
const savedToken = localStorage.getItem('access_token');
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Global 401 Interceptor: If token is expired or invalid, log out and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.includes('/login') &&
      !window.location.pathname.includes('/register')
    ) {
      setAuthToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth API ---

export const loginUser = async (payload: LoginRequest): Promise<AuthToken> => {
  const response = await api.post<AuthToken>('/login', payload);
  setAuthToken(response.data.access_token);
  return response.data;
};

export const registerUser = async (payload: RegisterRequest): Promise<User> => {
  const response = await api.post<User>('/register', payload);
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/users/me');
  return response.data;
};

export const logoutUser = () => {
  setAuthToken(null);
};

// --- Projects API ---

export const getProjects = async () => {
  const response = await api.get<Project[]>('/projects/');
  return response.data;
};

export const getProject = async (projectId: number) => {
  const response = await api.get<Project>(`/projects/${projectId}`);
  return response.data;
};

export const createProject = async (project: ProjectCreate) => {
  const response = await api.post<Project>('/projects/', project);
  return response.data;
};

export const deleteProject = async (projectId: number) => {
  const response = await api.delete(`/projects/${projectId}`);
  return response.data;
};

// --- Project Membership API (Week 3) ---

export const getProjectMembers = async (projectId: number): Promise<ProjectMember[]> => {
  const response = await api.get<ProjectMember[]>(`/projects/${projectId}/members`);
  return response.data;
};

export const addProjectMember = async (
  projectId: number,
  payload: { email?: string; user_id?: number; role?: string }
): Promise<ProjectMember> => {
  const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, payload);
  return response.data;
};

export const removeProjectMember = async (projectId: number, userId: number): Promise<void> => {
  await api.delete(`/projects/${projectId}/members/${userId}`);
};

// --- Tasks API ---

export const getTasks = async (projectId?: number) => {
  const url = projectId ? `/tasks/?project_id=${projectId}` : '/tasks/';
  const response = await api.get<Task[]>(url);
  return response.data;
};

export const createTask = async (task: TaskCreate) => {
  const response = await api.post<Task>('/tasks/', task);
  return response.data;
};

export const updateTask = async (taskId: number, task: TaskUpdate) => {
  const response = await api.patch<Task>(`/tasks/${taskId}`, task);
  return response.data;
};

export const deleteTask = async (taskId: number) => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

// --- Users API ---

export const getUsers = async () => {
  const response = await api.get<User[]>('/users/');
  return response.data;
};

// --- History/Comments API ---

export const getTaskActivities = async (taskId: number) => {
  const response = await api.get<TaskActivity[]>(`/tasks/${taskId}/activities`);
  return response.data;
};

export const getTaskComments = async (taskId: number) => {
  const response = await api.get<TaskComment[]>(`/tasks/${taskId}/comments`);
  return response.data;
};

export const createTaskComment = async (taskId: number, content: string) => {
  const response = await api.post<TaskComment>(`/tasks/${taskId}/comments`, { content });
  return response.data;
};

// --- CSV Import ---

export const uploadCSV = async (file: File): Promise<CSVImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<CSVImportResult>('/csv/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default api;
