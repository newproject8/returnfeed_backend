import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Auth: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (isLogin) {
          login(data.token);
        } else {
          alert('Registration successful! Please log in.');
          setIsLogin(true);
        }
      } else {
        setError(data.message || 'An error occurred.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
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
          <h1 className="auth-brand">리턴피드</h1>
          <p className="auth-tagline">프로페셔널 방송 플랫폼</p>
        </div>
        
        <div className="auth-form-container">
          <h2 className="auth-title">{isLogin ? '다시 만나서 반갑습니다' : '회원가입'}</h2>
          <p className="auth-subtitle">
            {isLogin ? '계정에 로그인하여 방송을 시작하세요' : '리턴피드와 함께 전문 방송을 시작하세요'}
          </p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-input-group">
              <input
                type="text"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input"
                required
              />
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
            </div>
            
            <div className="auth-input-group">
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
              />
              <span className="auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
            </div>
            
            {error && <div className="auth-error">{error}</div>}
            
            <button type="submit" className="auth-button auth-button-primary">
              {isLogin ? '로그인' : '회원가입'}
            </button>
            
            <div className="auth-divider">
              <span>또는</span>
            </div>
            
            <button type="button" onClick={() => window.location.href = '/api/auth/google'} className="auth-button auth-button-google">
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              구글로 계속하기
            </button>
          </form>
          
          <div className="auth-footer">
            <button onClick={toggleMode} className="auth-toggle-button">
              {isLogin ? "아직 계정이 없으신가요? 회원가입" : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;