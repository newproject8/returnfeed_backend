import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthCallback: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      login(token);
      navigate('/dashboard');
    } else {
      // 토큰이 없는 경우에 대한 처리 (예: 로그인 페이지로 리디렉션)
      navigate('/');
    }
  }, [location, navigate, login]);

  return (
    <div>
      <p>Authenticating...</p>
    </div>
  );
};

export default AuthCallback;