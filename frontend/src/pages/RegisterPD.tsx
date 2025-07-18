import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RegisterPD.css';

const RegisterPD: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [streamConfig, setStreamConfig] = useState<any>(null);
  
  const isPDSoftware = searchParams.get('source') === 'pd_software';
  const token = searchParams.get('token');

  useEffect(() => {
    // Add class to body for special styling
    document.body.classList.add('pd-registration');
    
    return () => {
      document.body.classList.remove('pd-registration');
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('유효한 이메일 주소를 입력해주세요.');
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

    try {
      const response = await fetch('/api/pd-auth/register-pd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          isPDSoftware,
          token,
          softwareVersion: searchParams.get('version') || '1.0.0',
          vmixPort: searchParams.get('vmixPort') || 8088,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegistrationSuccess(true);
        setStreamConfig(data.streamConfig);
        
        // Auto-login after registration
        if (data.tokens.authToken) {
          login(data.tokens.authToken);
        }

        // If from PD software, send message to parent window
        if (isPDSoftware && window.opener) {
          window.opener.postMessage({
            type: 'PD_REGISTRATION_SUCCESS',
            data: {
              tokens: data.tokens,
              streamConfig: data.streamConfig,
              user: data.user,
            },
          }, '*');
        }
      } else {
        setError(data.message || '회원가입 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show toast or feedback
  };

  if (registrationSuccess && streamConfig) {
    return (
      <div className="pd-register-container">
        <div className="pd-register-success">
          <div className="success-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h1>🎉 PD 계정 생성 완료!</h1>
          <p className="success-subtitle">ReturnFeed 프로페셔널 방송 시스템에 오신 것을 환영합니다.</p>
          
          <div className="config-section">
            <h2>📡 스트리밍 설정 정보</h2>
            
            <div className="config-item">
              <label>SRT 스트리밍 URL</label>
              <div className="config-value">
                <code>{streamConfig.srtUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.srtUrl)} className="copy-btn">
                  복사
                </button>
              </div>
              <small>vMix의 스트리밍 출력에 이 URL을 입력하세요.</small>
            </div>
            
            <div className="config-item">
              <label>스트림 키</label>
              <div className="config-value">
                <code>{streamConfig.streamKey}</code>
                <button onClick={() => copyToClipboard(streamConfig.streamKey)} className="copy-btn">
                  복사
                </button>
              </div>
              <small>이 키는 절대 공유하지 마세요.</small>
            </div>
            
            <div className="config-item">
              <label>스태프 접속 URL</label>
              <div className="config-value">
                <code>{streamConfig.staffUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.staffUrl)} className="copy-btn">
                  복사
                </button>
              </div>
              <small>카메라맨과 스태프들에게 이 링크를 공유하세요.</small>
            </div>
            
            <div className="config-item">
              <label>WebSocket URL</label>
              <div className="config-value">
                <code>{streamConfig.websocketUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.websocketUrl)} className="copy-btn">
                  복사
                </button>
              </div>
              <small>탈리 시스템 연결용 WebSocket 주소입니다.</small>
            </div>
          </div>
          
          <div className="action-buttons">
            {isPDSoftware ? (
              <button onClick={() => window.close()} className="primary-btn">
                PD 소프트웨어로 돌아가기
              </button>
            ) : (
              <button onClick={() => navigate('/dashboard')} className="primary-btn">
                대시보드로 이동
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-register-container">
      <div className="pd-register-card">
        <div className="pd-header">
          <img src="/returnfeed_logo.png" alt="ReturnFeed" className="pd-logo" />
          <h1>PD 전용 계정 생성</h1>
          <p>ReturnFeed 프로페셔널 방송 플랫폼</p>
          {isPDSoftware && (
            <div className="pd-badge">
              <span>PD Software 연동</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="pd-form">
          <div className="form-group">
            <label htmlFor="username">아이디</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="영문, 숫자 조합"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="최소 8자 이상"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요"
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '계정 생성 중...' : 'PD 계정 생성'}
          </button>

          <div className="form-footer">
            <p>이미 계정이 있으신가요?</p>
            <a href="/login" className="login-link">로그인하기</a>
          </div>
        </form>

        <div className="pd-features">
          <h3>PD 계정 특별 혜택</h3>
          <ul>
            <li>✅ vMix 탈리 시스템 연동</li>
            <li>✅ SRT 스트리밍 지원</li>
            <li>✅ 무제한 스태프 접속</li>
            <li>✅ 실시간 방송 모니터링</li>
            <li>✅ 전용 기술 지원</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RegisterPD;