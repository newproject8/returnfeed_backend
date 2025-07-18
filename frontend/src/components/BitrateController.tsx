import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './BitrateController.css';

interface BitrateSettings {
    sessionId: string;
    cameraId: string;
    maxBitrate: number;
    currentPercentage: number;
    effectiveBitrate: number;
    adaptiveEnabled: boolean;
    qualityPreset: 'low_latency' | 'balanced' | 'quality';
}

interface LatencyStats {
    current: number;
    average: number;
    min: number;
    max: number;
    jitter: number;
    samples: number;
}

interface QualityMetrics {
    packetLoss: number;
    jitter: number;
    roundTripTime: number;
    bandwidth: number;
    fps: number;
    resolution: string;
}

interface BitrateControllerProps {
    sessionId: string;
    cameraId: string;
    onBitrateChange?: (percentage: number) => void;
    onQualityChange?: (preset: string) => void;
    compact?: boolean;
}

const BitrateController: React.FC<BitrateControllerProps> = ({
    sessionId,
    cameraId,
    onBitrateChange,
    onQualityChange,
    compact = false
}) => {
    const [settings, setSettings] = useState<BitrateSettings | null>(null);
    const [latencyStats, setLatencyStats] = useState<LatencyStats | null>(null);
    const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [pendingPercentage, setPendingPercentage] = useState<number | null>(null);
    
    // 레이턴시 히스토리 (실시간 차트용)
    const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
    const maxHistorySize = 50;
    
    // 디바운스를 위한 타이머
    const bitrateUpdateTimer = useRef<NodeJS.Timeout | null>(null);
    const qualityUpdateTimer = useRef<NodeJS.Timeout | null>(null);
    
    // 비트레이트 설정 로드
    useEffect(() => {
        loadBitrateSettings();
        loadLatencyStats();
        
        // 주기적으로 업데이트
        const interval = setInterval(() => {
            loadLatencyStats();
            loadQualityMetrics();
        }, 1000);
        
        return () => clearInterval(interval);
    }, [sessionId, cameraId]);
    
    // WebSocket 메시지 처리
    useEffect(() => {
        const handleWebSocketMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'bitrate_changed':
                        if (data.sessionId === sessionId && data.cameraId === cameraId) {
                            setSettings(prev => prev ? {
                                ...prev,
                                currentPercentage: data.currentPercentage,
                                effectiveBitrate: data.effectiveBitrate,
                                adaptiveEnabled: data.adaptiveEnabled,
                                qualityPreset: data.qualityPreset
                            } : null);
                        }
                        break;
                        
                    case 'latency_update':
                        if (data.sessionId === sessionId && data.cameraId === cameraId) {
                            updateLatencyHistory(data.latency);
                        }
                        break;
                        
                    case 'quality_metrics_update':
                        if (data.sessionId === sessionId && data.cameraId === cameraId) {
                            setQualityMetrics(data.metrics);
                        }
                        break;
                }
            } catch (error) {
                console.error('WebSocket 메시지 처리 오류:', error);
            }
        };
        
        // 실제 환경에서는 WebSocket 연결을 통해 메시지 수신
        // 여기서는 시뮬레이션을 위한 코드
        window.addEventListener('message', handleWebSocketMessage);
        
        return () => {
            window.removeEventListener('message', handleWebSocketMessage);
        };
    }, [sessionId, cameraId]);
    
    // 비트레이트 설정 로드
    const loadBitrateSettings = async () => {
        try {
            const response = await fetch(`/api/bitrate/settings/${sessionId}/${cameraId}`);
            const result = await response.json();
            
            if (result.success) {
                setSettings(result.data.settings);
                setLatencyStats(result.data.latencyStats);
            }
        } catch (error) {
            console.error('비트레이트 설정 로드 오류:', error);
        }
    };
    
    // 레이턴시 통계 로드
    const loadLatencyStats = async () => {
        try {
            const response = await fetch(`/api/bitrate/latency/${sessionId}/${cameraId}`);
            const result = await response.json();
            
            if (result.success) {
                setLatencyStats(result.data.latencyStats);
                updateLatencyHistory(result.data.latencyStats.current);
            }
        } catch (error) {
            console.error('레이턴시 통계 로드 오류:', error);
        }
    };
    
    // 품질 메트릭 로드
    const loadQualityMetrics = async () => {
        // 시뮬레이션 데이터
        const simulatedMetrics: QualityMetrics = {
            packetLoss: Math.random() * 0.02,
            jitter: Math.random() * 0.1,
            roundTripTime: 50 + Math.random() * 100,
            bandwidth: 4000000 + Math.random() * 2000000,
            fps: 29 + Math.random() * 2,
            resolution: '1920x1080'
        };
        
        setQualityMetrics(simulatedMetrics);
    };
    
    // 레이턴시 히스토리 업데이트
    const updateLatencyHistory = (newLatency: number) => {
        setLatencyHistory(prev => {
            const updated = [...prev, newLatency];
            if (updated.length > maxHistorySize) {
                updated.shift();
            }
            return updated;
        });
    };
    
    // 비트레이트 변경 처리
    const handleBitrateChange = useCallback((percentage: number) => {
        setPendingPercentage(percentage);
        setIsAdjusting(true);
        
        // 디바운스 처리
        if (bitrateUpdateTimer.current) {
            clearTimeout(bitrateUpdateTimer.current);
        }
        
        bitrateUpdateTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/bitrate/percentage/${sessionId}/${cameraId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ percentage })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    setSettings(prev => prev ? {
                        ...prev,
                        currentPercentage: percentage,
                        effectiveBitrate: result.data.effectiveBitrate
                    } : null);
                    
                    onBitrateChange?.(percentage);
                } else {
                    console.error('비트레이트 변경 실패:', result.error);
                }
            } catch (error) {
                console.error('비트레이트 변경 오류:', error);
            } finally {
                setIsAdjusting(false);
                setPendingPercentage(null);
            }
        }, 300);
    }, [sessionId, cameraId, onBitrateChange]);
    
    // 품질 프리셋 변경
    const handleQualityChange = useCallback((preset: 'low_latency' | 'balanced' | 'quality') => {
        if (qualityUpdateTimer.current) {
            clearTimeout(qualityUpdateTimer.current);
        }
        
        qualityUpdateTimer.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/bitrate/quality/${sessionId}/${cameraId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ qualityPreset: preset })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    setSettings(prev => prev ? {
                        ...prev,
                        qualityPreset: preset
                    } : null);
                    
                    onQualityChange?.(preset);
                } else {
                    console.error('품질 설정 변경 실패:', result.error);
                }
            } catch (error) {
                console.error('품질 설정 변경 오류:', error);
            }
        }, 500);
    }, [sessionId, cameraId, onQualityChange]);
    
    // 적응적 조정 토글
    const toggleAdaptiveMode = useCallback(async () => {
        if (!settings) return;
        
        try {
            const response = await fetch(`/api/bitrate/quality/${sessionId}/${cameraId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    qualityPreset: settings.qualityPreset,
                    adaptiveEnabled: !settings.adaptiveEnabled 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                setSettings(prev => prev ? {
                    ...prev,
                    adaptiveEnabled: !prev.adaptiveEnabled
                } : null);
            }
        } catch (error) {
            console.error('적응적 조정 토글 오류:', error);
        }
    }, [sessionId, cameraId, settings]);
    
    // 설정 리셋
    const resetSettings = useCallback(async () => {
        try {
            const response = await fetch(`/api/bitrate/reset/${sessionId}/${cameraId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                setSettings(prev => prev ? {
                    ...prev,
                    currentPercentage: 1.0,
                    effectiveBitrate: prev.maxBitrate,
                    adaptiveEnabled: true,
                    qualityPreset: 'balanced'
                } : null);
            }
        } catch (error) {
            console.error('설정 리셋 오류:', error);
        }
    }, [sessionId, cameraId]);
    
    // 비트레이트 포맷 함수
    const formatBitrate = (bitrate: number): string => {
        if (bitrate < 1000000) {
            return `${(bitrate / 1000).toFixed(0)}K`;
        } else {
            return `${(bitrate / 1000000).toFixed(1)}M`;
        }
    };
    
    // 레이턴시 포맷 함수
    const formatLatency = (latency: number): string => {
        if (latency < 1) {
            return `${(latency * 1000).toFixed(0)}ms`;
        } else {
            return `${latency.toFixed(2)}s`;
        }
    };
    
    // 품질 상태 결정
    const getQualityStatus = (): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (!qualityMetrics) return 'fair';
        
        const packetLoss = qualityMetrics.packetLoss;
        const jitter = qualityMetrics.jitter;
        
        if (packetLoss < 0.001 && jitter < 0.02) return 'excellent';
        if (packetLoss < 0.005 && jitter < 0.05) return 'good';
        if (packetLoss < 0.02 && jitter < 0.1) return 'fair';
        return 'poor';
    };
    
    if (!settings) {
        return (
            <div className="bitrate-controller loading">
                <div className="loading-spinner" />
                <span>비트레이트 설정 로드 중...</span>
            </div>
        );
    }
    
    const currentPercentage = pendingPercentage ?? settings.currentPercentage;
    const qualityStatus = getQualityStatus();
    
    return (
        <div className={`bitrate-controller ${compact ? 'compact' : ''}`}>
            {/* 헤더 */}
            <div className="bitrate-header">
                <div className="header-left">
                    <h3>스트림 품질 조정</h3>
                    <span className="camera-id">Camera {cameraId}</span>
                </div>
                <div className="header-right">
                    <div className={`quality-indicator ${qualityStatus}`}>
                        <div className="indicator-dot" />
                        <span>{qualityStatus.toUpperCase()}</span>
                    </div>
                </div>
            </div>
            
            {/* 메인 컨트롤 */}
            <div className="bitrate-main-controls">
                {/* 비트레이트 슬라이더 */}
                <div className="bitrate-slider-container">
                    <div className="slider-header">
                        <span className="slider-label">비트레이트</span>
                        <div className="bitrate-display">
                            <span className="current-bitrate">
                                {formatBitrate(settings.maxBitrate * currentPercentage)}
                            </span>
                            <span className="max-bitrate">
                                / {formatBitrate(settings.maxBitrate)}
                            </span>
                            <span className="percentage">
                                ({(currentPercentage * 100).toFixed(0)}%)
                            </span>
                        </div>
                    </div>
                    
                    <div className="slider-wrapper">
                        <motion.input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.01"
                            value={currentPercentage}
                            onChange={(e) => handleBitrateChange(parseFloat(e.target.value))}
                            className="bitrate-slider"
                            animate={{ 
                                boxShadow: isAdjusting ? 
                                    "0 0 20px rgba(0, 198, 255, 0.5)" : 
                                    "0 0 0px rgba(0, 198, 255, 0)"
                            }}
                        />
                        
                        <div className="slider-markers">
                            <span className="marker min">10%</span>
                            <span className="marker mid">50%</span>
                            <span className="marker max">100%</span>
                        </div>
                    </div>
                </div>
                
                {/* 레이턴시 표시 */}
                <div className="latency-display">
                    <div className="latency-header">
                        <span className="latency-label">현재 레이턴시</span>
                        <motion.div 
                            className="latency-value"
                            key={latencyStats?.current}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            {latencyStats ? formatLatency(latencyStats.current) : '측정 중...'}
                        </motion.div>
                    </div>
                    
                    {/* 레이턴시 미니 차트 */}
                    <div className="latency-chart">
                        <svg width="100%" height="40" viewBox="0 0 200 40">
                            {latencyHistory.length > 1 && (
                                <motion.polyline
                                    points={latencyHistory.map((latency, index) => {
                                        const x = (index / (latencyHistory.length - 1)) * 200;
                                        const y = 40 - ((latency / Math.max(...latencyHistory)) * 35);
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="rgba(0, 198, 255, 0.8)"
                                    strokeWidth="2"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.5 }}
                                />
                            )}
                        </svg>
                    </div>
                    
                    {/* 레이턴시 통계 */}
                    {latencyStats && (
                        <div className="latency-stats">
                            <span className="stat">
                                평균: {formatLatency(latencyStats.average)}
                            </span>
                            <span className="stat">
                                지터: {formatLatency(latencyStats.jitter)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* 품질 프리셋 */}
            <div className="quality-presets">
                <span className="presets-label">품질 프리셋</span>
                <div className="preset-buttons">
                    {(['low_latency', 'balanced', 'quality'] as const).map((preset) => (
                        <button
                            key={preset}
                            onClick={() => handleQualityChange(preset)}
                            className={`preset-btn ${settings.qualityPreset === preset ? 'active' : ''}`}
                        >
                            {preset === 'low_latency' ? '저지연' : 
                             preset === 'balanced' ? '균형' : '고품질'}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* 고급 설정 */}
            <div className="advanced-controls">
                <button 
                    className="advanced-toggle"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    고급 설정 {showAdvanced ? '▲' : '▼'}
                </button>
                
                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            className="advanced-panel"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* 적응적 조정 */}
                            <div className="adaptive-control">
                                <label className="adaptive-label">
                                    <input
                                        type="checkbox"
                                        checked={settings.adaptiveEnabled}
                                        onChange={toggleAdaptiveMode}
                                    />
                                    <span>적응적 품질 조정</span>
                                </label>
                                <small className="adaptive-description">
                                    네트워크 상태에 따라 자동으로 품질을 조정합니다
                                </small>
                            </div>
                            
                            {/* 품질 메트릭 */}
                            {qualityMetrics && (
                                <div className="quality-metrics">
                                    <div className="metrics-header">품질 메트릭</div>
                                    <div className="metrics-grid">
                                        <div className="metric">
                                            <span className="metric-label">패킷 손실</span>
                                            <span className="metric-value">
                                                {(qualityMetrics.packetLoss * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">지터</span>
                                            <span className="metric-value">
                                                {(qualityMetrics.jitter * 1000).toFixed(0)}ms
                                            </span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">FPS</span>
                                            <span className="metric-value">
                                                {qualityMetrics.fps.toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="metric">
                                            <span className="metric-label">해상도</span>
                                            <span className="metric-value">
                                                {qualityMetrics.resolution}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* 리셋 버튼 */}
                            <div className="reset-controls">
                                <button
                                    className="reset-btn"
                                    onClick={resetSettings}
                                >
                                    기본값으로 리셋
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default BitrateController;