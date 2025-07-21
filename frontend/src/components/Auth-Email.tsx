import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext-Email';
import './Auth.css';

interface AuthFormData {
  email: string;
  password: string;
  displayName?: string;
}

const AuthEmail: React.FC = () => {
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    displayName: '',
  });
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (!isLogin && formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const payload: any = {
        email: formData.email,
        password: formData.password,
      };

      if (!isLogin && formData.displayName) {
        payload.displayName = formData.displayName;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (isLogin) {
          login(data.token, data.user);
        } else {
          setError('Registration successful! Please log in.');
          setIsLogin(true);
          setFormData({ email: formData.email, password: '', displayName: '' });
        }
      } else {
        setError(data.message || 'An error occurred.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ email: '', password: '', displayName: '' });
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-background-shape auth-background-shape-1"></div>
        <div className="auth-background-shape auth-background-shape-2"></div>
        <div className="auth-background-shape auth-background-shape-3"></div>
      </div>
      
      <div className="auth-card">
        <div className="auth-logo-container">
          <img src="/returnfeed_logo.png" alt="ReturnFeed" className="auth-logo" />
          <h1 className="auth-brand">ReturnFeed</h1>
          <p className="auth-tagline">Professional Broadcasting Platform</p>
        </div>
        
        <div className="auth-form-container">
          <h2 className="auth-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to your account to start broadcasting' : 'Join ReturnFeed for professional broadcasting'}
          </p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-input-group">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                className="auth-input"
                required
                autoComplete="email"
              />
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
            </div>
            
            {!isLogin && (
              <div className="auth-input-group">
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  placeholder="Display Name (optional)"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="auth-input"
                  autoComplete="name"
                />
                <span className="auth-input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
              </div>
            )}
            
            <div className="auth-input-group">
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <button 
              type="submit" 
              className="auth-button auth-button-primary"
              disabled={loading}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
            
            <div className="auth-divider">
              <span>or</span>
            </div>
            
            <button 
              type="button" 
              onClick={() => window.location.href = '/api/auth/google'} 
              className="auth-button auth-button-google"
              disabled={loading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>
          
          <div className="auth-footer">
            <button onClick={toggleMode} className="auth-toggle-button">
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthEmail;