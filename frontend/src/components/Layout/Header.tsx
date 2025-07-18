import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

const Header: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="rf-header">
      <div className="rf-header-container">
        <div className="rf-header-content">
          {/* Logo */}
          <Link to="/" className="rf-logo">
            <img 
              src="/returnfeed_logo.png" 
              alt="ReturnFeed" 
              className="rf-logo-icon"
              style={{ height: '36px', width: 'auto' }}
            />
            <span className="rf-logo-text">ReturnFeed</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="rf-nav-desktop">
            <Link to="/features" className="rf-nav-link">기능</Link>
            <Link to="/solutions" className="rf-nav-link">솔루션</Link>
            <Link to="/pricing" className="rf-nav-link">가격</Link>
            <Link to="/resources" className="rf-nav-link">리소스</Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="rf-nav-link">대시보드</Link>
                <button onClick={handleLogout} className="rf-btn rf-btn-secondary">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rf-nav-link">로그인</Link>
                <Link to="/register" className="rf-btn rf-btn-primary">
                  무료 체험
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="rf-mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="메뉴"
          >
            <span className={`rf-menu-icon ${isMobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className={`rf-nav-mobile ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="rf-nav-mobile-content">
          <Link to="/features" className="rf-nav-mobile-link">기능</Link>
          <Link to="/solutions" className="rf-nav-mobile-link">솔루션</Link>
          <Link to="/pricing" className="rf-nav-mobile-link">가격</Link>
          <Link to="/resources" className="rf-nav-mobile-link">리소스</Link>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="rf-nav-mobile-link">대시보드</Link>
              <button onClick={handleLogout} className="rf-btn rf-btn-secondary rf-btn-block">
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rf-nav-mobile-link">로그인</Link>
              <Link to="/register" className="rf-btn rf-btn-primary rf-btn-block">
                무료 체험 시작
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;