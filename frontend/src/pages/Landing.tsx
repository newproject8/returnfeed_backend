import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import './Landing.css';

const Landing: React.FC = () => {
  return (
    <div className="rf-landing">
      <Header />
      
      {/* Hero Section */}
      <section className="rf-hero">
        <div className="rf-hero-background">
          <div className="rf-hero-gradient rf-hero-gradient-1"></div>
          <div className="rf-hero-gradient rf-hero-gradient-2"></div>
          <div className="rf-hero-grid"></div>
        </div>
        
        <div className="rf-container">
          <div className="rf-hero-content">
            <h1 className="rf-hero-title">
              전문가 수준의 클라우드 프로덕션<br />
              <span className="rf-hero-highlight">혁신적으로 단순화하다</span>
            </h1>
            <p className="rf-hero-subtitle">
              vMix의 강력한 기능을 클라우드에서 즉시 사용하세요<br />
              하드웨어 관리 없이, 브라우저에서 바로 프로페셔널 방송 제작
            </p>
            
            <div className="rf-hero-actions">
              <Link to="/register" className="rf-btn rf-btn-hero-primary">
                14일 무료 체험
              </Link>
              <button className="rf-btn rf-btn-hero-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                데모 보기
              </button>
            </div>
            
            <div className="rf-hero-stats">
              <div className="rf-stat">
                <span className="rf-stat-value">70%</span>
                <span className="rf-stat-label">비용 절감</span>
              </div>
              <div className="rf-stat-divider"></div>
              <div className="rf-stat">
                <span className="rf-stat-value">SRT+WebRTC</span>
                <span className="rf-stat-label">이중 프로토콜</span>
              </div>
              <div className="rf-stat-divider"></div>
              <div className="rf-stat">
                <span className="rf-stat-value">제로</span>
                <span className="rf-stat-label">하드웨어 부담</span>
              </div>
            </div>
          </div>
          
          <div className="rf-hero-visual">
            <div className="rf-monitor-card">
              <div className="rf-monitor-header">
                <span className="rf-monitor-name">Program Output</span>
              </div>
              <div className="rf-monitor-screen">
                <div className="rf-tally-border rf-tally-border-program"></div>
                <video 
                  className="rf-monitor-video"
                  autoPlay 
                  muted 
                  loop 
                  playsInline
                  poster="/demo-thumbnail.jpg"
                >
                  <source src="/demo-video.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="rf-features">
        <div className="rf-container">
          <div className="rf-section-header">
            <h2 className="rf-section-title">클라우드 네이티브 프로덕션의 핵심 기능</h2>
            <p className="rf-section-subtitle">
              온프레미스의 복잡성 없이 방송 스튜디오급 기능을 구현합니다
            </p>
          </div>
          
          <div className="rf-features-grid">
            <div className="rf-feature-card rf-feature-large">
              <div className="rf-feature-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 24l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>안정적인 영상 수급</h3>
              <p>SRT 프로토콜로 불안정한 네트워크에서도 방송급 품질 보장</p>
              <span className="rf-feature-badge">핵심 기술</span>
            </div>
            
            <div className="rf-feature-card">
              <div className="rf-feature-icon">
                <div className="rf-tally-icon">
                  <div className="rf-tally-light rf-tally-light-red"></div>
                  <div className="rf-tally-light rf-tally-light-green"></div>
                </div>
              </div>
              <h3>실시간 탈리 신호</h3>
              <p>PGM/PVW 상태를 즉시 전달</p>
            </div>
            
            <div className="rf-feature-card">
              <div className="rf-feature-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="14" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M20 40h8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16 34h16" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3>진정한 클라우드 네이티브</h3>
              <p>GPU 설정, VM 구성 없이 브라우저에서 즉시 프로덕션</p>
            </div>
            
            <div className="rf-feature-card">
              <div className="rf-feature-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <rect x="20" y="18" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3>다중 디바이스 지원</h3>
              <p>PC, 태블릿, 스마트폰 모두 지원</p>
            </div>
            
            <div className="rf-feature-card">
              <div className="rf-feature-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M24 8v16l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3>워크플로우 통합</h3>
              <p>NDI, SRT, WebRTC를 하나의 플랫폼에서 통합 관리</p>
            </div>
            
            <div className="rf-feature-card">
              <div className="rf-feature-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M24 12l4 8h8l-6 5 2 9-8-5-8 5 2-9-6-5h8z" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <h3>내장된 이중화</h3>
              <p>자동 페일오버로 단일 장애 지점 제거</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="rf-usecases">
        <div className="rf-container">
          <div className="rf-section-header">
            <h2 className="rf-section-title">당신의 프로덕션 환경에 최적화</h2>
            <p className="rf-section-subtitle">
              대기업 방송부터 프로슈머까지, 모든 규모의 제작을 지원합니다
            </p>
          </div>
          
          <div className="rf-usecases-grid">
            <div className="rf-usecase-card">
              <div className="rf-usecase-image">
                <img src="/usecase-studio.jpg" alt="스튜디오 방송" />
              </div>
              <h3>방송 & 스포츠</h3>
              <p>원격 프로덕션(REMI)으로 현장 비용 70% 절감</p>
              <ul className="rf-usecase-list">
                <li>다중 SRT 피드 동시 수신</li>
                <li>실시간 스위칭 및 믹싱</li>
                <li>AI 기반 하이라이트 생성 준비</li>
              </ul>
            </div>
            
            <div className="rf-usecase-card">
              <div className="rf-usecase-image">
                <img src="/usecase-outdoor.jpg" alt="야외 중계" />
              </div>
              <h3>기업 & 교육</h3>
              <p>전담 엔지니어 없이도 전문가급 스트리밍</p>
              <ul className="rf-usecase-list">
                <li>원클릭 게스트 초대 (WebRTC)</li>
                <li>기존 도구와 완벽 통합</li>
                <li>직관적인 사용자 인터페이스</li>
              </ul>
            </div>
            
            <div className="rf-usecase-card">
              <div className="rf-usecase-image">
                <img src="/usecase-corporate.jpg" alt="기업 방송" />
              </div>
              <h3>종교 기관 & 프로슈머</h3>
              <p>자원봉사자도 운영 가능한 단순함</p>
              <ul className="rf-usecase-list">
                <li>5분 내 설정 완료</li>
                <li>다중 플랫폼 동시 송출</li>
                <li>예산 친화적인 가격</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="rf-cta">
        <div className="rf-container">
          <div className="rf-cta-content">
            <h2 className="rf-cta-title">
              더 이상 GPU와 씨름하지 마세요
            </h2>
            <p className="rf-cta-subtitle">
              클라우드 VM 설정의 악몽에서 벗어나 프로듀싱에만 집중하세요<br />
              14일 무료 체험으로 진정한 클라우드 프로덕션을 경험해보세요
            </p>
            <div className="rf-cta-actions">
              <Link to="/register" className="rf-btn rf-btn-cta">
                무료 체험 시작하기
              </Link>
              <Link to="/contact" className="rf-btn rf-btn-cta-secondary">
                문의하기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rf-footer">
        <div className="rf-container">
          <div className="rf-footer-content">
            <div className="rf-footer-brand">
              <h3>ReturnFeed</h3>
              <p>실시간 방송 제작의 새로운 기준</p>
              <p className="rf-footer-copyright">
                © 2025 ReturnFeed. All rights reserved.
              </p>
            </div>
            
            <div className="rf-footer-links">
              <div className="rf-footer-column">
                <h4>제품</h4>
                <a href="/features">기능</a>
                <a href="/pricing">가격</a>
                <a href="/roadmap">로드맵</a>
              </div>
              
              <div className="rf-footer-column">
                <h4>회사</h4>
                <a href="/about">소개</a>
                <a href="/blog">블로그</a>
                <a href="/careers">채용</a>
              </div>
              
              <div className="rf-footer-column">
                <h4>지원</h4>
                <a href="/docs">문서</a>
                <a href="/support">고객지원</a>
                <a href="/status">시스템 상태</a>
              </div>
              
              <div className="rf-footer-column">
                <h4>법적고지</h4>
                <a href="/privacy">개인정보처리방침</a>
                <a href="/terms">이용약관</a>
                <a href="/security">보안</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;