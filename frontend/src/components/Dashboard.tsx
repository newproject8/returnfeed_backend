import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Dashboard.css';

interface StreamStats {
    activeSources: number;
    totalBandwidth: string;
    uptime: string;
    protocol: string;
}

const Dashboard: React.FC = () => {
    const [srtUrl, setSrtUrl] = useState('');
    const [monitoringUrl, setMonitoringUrl] = useState('');
    const [streamStats, setStreamStats] = useState<StreamStats>({
        activeSources: 0,
        totalBandwidth: '0 Mbps',
        uptime: '00:00:00',
        protocol: 'SRT + WebRTC'
    });
    const auth = useAuth();

    useEffect(() => {
        const fetchStreamConfig = async () => {
            try {
                const response = await fetch('/api/stream/config', {
                    headers: {
                        'Authorization': `Bearer ${auth?.token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSrtUrl(data.srtUrl);
                    setMonitoringUrl(data.monitoringUrl);
                } else {
                    console.error('Failed to fetch stream config');
                }
            } catch (error) {
                console.error('Error fetching stream config:', error);
            }
        };

        if (auth?.token) {
            fetchStreamConfig();
        }
    }, [auth?.token]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Professional toast notification instead of alert
        const toast = document.createElement('div');
        toast.className = 'rf-toast';
        toast.textContent = '클립보드에 복사되었습니다';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    return (
        <div className="rf-dashboard">
            <div className="rf-dashboard-header">
                <h1 className="rf-dashboard-title">프로덕션 대시보드</h1>
                <p className="rf-dashboard-subtitle">클라우드 기반 방송 제작 플랫폼</p>
            </div>

            {/* Quick Stats */}
            <div className="rf-stats-grid">
                <div className="rf-stat-card">
                    <div className="rf-stat-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 6v6l4 4" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                    </div>
                    <div className="rf-stat-content">
                        <span className="rf-stat-label">업타임</span>
                        <span className="rf-stat-value">{streamStats.uptime}</span>
                    </div>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="8" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="8" cy="12" r="2" fill="currentColor"/>
                        </svg>
                    </div>
                    <div className="rf-stat-content">
                        <span className="rf-stat-label">활성 소스</span>
                        <span className="rf-stat-value">{streamStats.activeSources}</span>
                    </div>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                    </div>
                    <div className="rf-stat-content">
                        <span className="rf-stat-label">대역폭</span>
                        <span className="rf-stat-value">{streamStats.totalBandwidth}</span>
                    </div>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                    </div>
                    <div className="rf-stat-content">
                        <span className="rf-stat-label">프로토콜</span>
                        <span className="rf-stat-value">{streamStats.protocol}</span>
                    </div>
                </div>
            </div>

            {/* Connection Info */}
            <div className="rf-connection-section">
                <h2 className="rf-section-title">연결 정보</h2>
                <div className="rf-connection-grid">
                    {srtUrl && (
                        <div className="rf-connection-card">
                            <div className="rf-connection-header">
                                <h3>SRT 수신 URL</h3>
                                <span className="rf-protocol-badge">영상 수급용</span>
                            </div>
                            <div className="rf-connection-content">
                                <code className="rf-connection-url">{srtUrl}</code>
                                <button className="rf-copy-button" onClick={() => handleCopy(srtUrl)}>
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                                        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                    복사
                                </button>
                            </div>
                            <p className="rf-connection-help">
                                vMix, OBS 등의 방송 소프트웨어에서 이 URL로 스트리밍하세요
                            </p>
                        </div>
                    )}
                    {monitoringUrl && (
                        <div className="rf-connection-card">
                            <div className="rf-connection-header">
                                <h3>모니터링 URL</h3>
                                <span className="rf-protocol-badge rf-protocol-webrtc">실시간 모니터링</span>
                            </div>
                            <div className="rf-connection-content">
                                <code className="rf-connection-url">{monitoringUrl}</code>
                                <Link to={monitoringUrl} target="_blank" rel="noopener noreferrer" className="rf-open-button">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                    열기
                                </Link>
                            </div>
                            <p className="rf-connection-help">
                                카메라맨, PD, 클라이언트가 실시간으로 모니터링할 수 있습니다
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="rf-actions-section">
                <h2 className="rf-section-title">빠른 작업</h2>
                <div className="rf-actions-grid">
                    <button className="rf-action-card">
                        <svg viewBox="0 0 24 24" fill="none">
                            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span>새 프로덕션</span>
                    </button>
                    <button className="rf-action-card">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span>보안 설정</span>
                    </button>
                    <button className="rf-action-card">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <span>도움말</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;