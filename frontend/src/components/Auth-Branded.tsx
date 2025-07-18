import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Auth-Branded.css';

const AuthBranded: React.FC = () => {
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
          alert('회원가입이 완료되었습니다! 로그인해주세요.');
          setIsLogin(true);
        }
      } else {
        setError(data.message || '오류가 발생했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
  };

  return (
    <div className="rf-auth-container">
      {/* Background Effects */}
      <div className="rf-auth-background">
        <div className="rf-auth-light rf-auth-light-red"></div>
        <div className="rf-auth-light rf-auth-light-green"></div>
        <div className="rf-auth-grid"></div>
        <div className="rf-auth-scanlines"></div>
      </div>
      
      <div className="rf-auth-card">
        {/* Logo Section */}
        <div className="rf-auth-logo-container">
          <img 
            src="/returnfeed_logo_with_typo.png" 
            alt="ReturnFeed" 
            className="rf-auth-logo"
          />
          <p className="rf-auth-tagline">프로페셔널 방송 플랫폼</p>
        </div>
        
        {/* Form Section */}
        <div className="rf-auth-form-container">
          <h2 className="rf-auth-title">
            {isLogin ? '다시 만나서 반갑습니다' : '새로운 방송의 시작'}
          </h2>
          <p className="rf-auth-subtitle">
            {isLogin 
              ? '실시간 방송 제작을 계속하려면 로그인하세요' 
              : '지금 가입하고 14일 무료 체험을 시작하세요'}
          </p>
          
          <form onSubmit={handleSubmit} className="rf-auth-form">
            <div className="rf-auth-input-group">
              <input
                type="text"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rf-auth-input"
                required
              />
              <span className="rf-auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <div className="rf-auth-input-light"></div>
            </div>
            
            <div className="rf-auth-input-group">
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rf-auth-input"
                required
              />
              <span className="rf-auth-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <div className="rf-auth-input-light"></div>
            </div>
            
            {error && (
              <div className="rf-auth-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {error}
              </div>
            )}
            
            <button type="submit" className="rf-auth-button rf-auth-button-primary">
              <span className="rf-auth-button-text">
                {isLogin ? '로그인' : '회원가입'}
              </span>
              <span className="rf-auth-button-glow"></span>
            </button>
            
            <div className="rf-auth-divider">
              <span className="rf-auth-divider-line"></span>
              <span className="rf-auth-divider-text">또는</span>
              <span className="rf-auth-divider-line"></span>
            </div>
            
            <button 
              type="button" 
              onClick={() => window.location.href = '/api/auth/google'} 
              className="rf-auth-button rf-auth-button-google"
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              구글로 계속하기
            </button>
          </form>
          
          <div className="rf-auth-footer">
            <button onClick={toggleMode} className="rf-auth-toggle-button">
              {isLogin ? "아직 계정이 없으신가요? 회원가입" : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
        
        {/* Technical Info */}
        <div className="rf-auth-tech-info">
          <div className="rf-tech-item">
            <span className="rf-tech-label">지연시간</span>
            <span className="rf-tech-value">0.1초</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthBranded;