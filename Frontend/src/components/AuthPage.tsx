import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, registerUser } from '../api';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await loginUser({ email, password });
        navigate('/');
      } else {
        await registerUser({ name, email, password });
        navigate('/login');
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title" style={{ marginBottom: '1rem' }}>
          {isLogin ? 'Login' : 'Register'}
        </h1>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!isLogin && (
            <input
              className="form-control"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            className="form-control"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="form-control"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          {isLogin ? 'Need an account? ' : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'}>
            {isLogin ? 'Register here' : 'Login here'}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
