import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ResourceMonitor.css';

interface ResourceData {
  cpu: {
    usage: number;
    temperature: number;
    cores: number;
    threads: number;
    frequency: number;
    model: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    available: number;
  };
  gpu: {
    usage: number;
    memoryUsed: number;
    memoryTotal: number;
    temperature: number;
    powerDraw: number;
    powerLimit: number;
    model: string;
    encoder: string;
    fanSpeed: number;
  };
  network: {
    upload: number;
    download: number;
    latency: number;
    packetsLost: number;
  };
  streaming: {
    isActive: boolean;
    bitrate: number;
    fps: number;
    droppedFrames: number;
    encoding: string;
    resolution: string;
  };
}

interface ResourceMonitorProps {
  updateInterval?: number;
  showDetailed?: boolean;
  compactMode?: boolean;
  onResourceAlert?: (type: string, value: number) => void;
}

const ResourceMonitor: React.FC<ResourceMonitorProps> = ({
  updateInterval = 1000,
  showDetailed = true,
  compactMode = false,
  onResourceAlert
}) => {
  const [resourceData, setResourceData] = useState<ResourceData>({
    cpu: {
      usage: 0,
      temperature: 0,
      cores: 0,
      threads: 0,
      frequency: 0,
      model: ''
    },
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
      available: 0
    },
    gpu: {
      usage: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      temperature: 0,
      powerDraw: 0,
      powerLimit: 0,
      model: '',
      encoder: '',
      fanSpeed: 0
    },
    network: {
      upload: 0,
      download: 0,
      latency: 0,
      packetsLost: 0
    },
    streaming: {
      isActive: false,
      bitrate: 0,
      fps: 0,
      droppedFrames: 0,
      encoding: '',
      resolution: ''
    }
  });

  const [alertThresholds] = useState({
    cpu: 80,
    memory: 90,
    gpu: 85,
    temperature: 85,
    network: 100
  });

  const [history, setHistory] = useState<{
    cpu: number[];
    memory: number[];
    gpu: number[];
    network: number[];
  }>({
    cpu: [],
    memory: [],
    gpu: [],
    network: []
  });

  const [isExpanded, setIsExpanded] = useState(!compactMode);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 리소스 데이터 가져오기 (실제 구현에서는 WebSocket 또는 API 호출)
  const fetchResourceData = useCallback(async () => {
    try {
      // 실제 환경에서는 백엔드 API 호출
      // 현재는 시뮬레이션 데이터
      const simulatedData: ResourceData = {
        cpu: {
          usage: Math.random() * 100,
          temperature: 40 + Math.random() * 40,
          cores: 8,
          threads: 16,
          frequency: 3.2 + Math.random() * 1.8,
          model: 'Intel Core i7-12700K'
        },
        memory: {
          used: 8 + Math.random() * 8,
          total: 32,
          percentage: 25 + Math.random() * 50,
          available: 16 + Math.random() * 8
        },
        gpu: {
          usage: Math.random() * 100,
          memoryUsed: 2 + Math.random() * 6,
          memoryTotal: 12,
          temperature: 45 + Math.random() * 35,
          powerDraw: 150 + Math.random() * 200,
          powerLimit: 350,
          model: 'NVIDIA RTX 4070 Ti',
          encoder: 'NVENC H.264',
          fanSpeed: 30 + Math.random() * 70
        },
        network: {
          upload: Math.random() * 50,
          download: Math.random() * 100,
          latency: 10 + Math.random() * 40,
          packetsLost: Math.random() * 5
        },
        streaming: {
          isActive: Math.random() > 0.3,
          bitrate: 5000 + Math.random() * 5000,
          fps: 30 + Math.random() * 30,
          droppedFrames: Math.random() * 100,
          encoding: 'H.264 (NVENC)',
          resolution: '1920x1080'
        }
      };

      setResourceData(simulatedData);

      // 히스토리 업데이트
      setHistory(prev => ({
        cpu: [...prev.cpu.slice(-29), simulatedData.cpu.usage],
        memory: [...prev.memory.slice(-29), simulatedData.memory.percentage],
        gpu: [...prev.gpu.slice(-29), simulatedData.gpu.usage],
        network: [...prev.network.slice(-29), simulatedData.network.upload + simulatedData.network.download]
      }));

      // 임계값 확인 및 알림
      if (simulatedData.cpu.usage > alertThresholds.cpu) {
        onResourceAlert?.('cpu', simulatedData.cpu.usage);
      }
      if (simulatedData.memory.percentage > alertThresholds.memory) {
        onResourceAlert?.('memory', simulatedData.memory.percentage);
      }
      if (simulatedData.gpu.usage > alertThresholds.gpu) {
        onResourceAlert?.('gpu', simulatedData.gpu.usage);
      }
      if (simulatedData.gpu.temperature > alertThresholds.temperature) {
        onResourceAlert?.('temperature', simulatedData.gpu.temperature);
      }

    } catch (error) {
      console.error('리소스 데이터 가져오기 실패:', error);
    }
  }, [onResourceAlert, alertThresholds]);

  // 리소스 모니터링 시작
  useEffect(() => {
    fetchResourceData();
    intervalRef.current = setInterval(fetchResourceData, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchResourceData, updateInterval]);

  // 원형 프로그레스 바 컴포넌트
  const CircularProgress: React.FC<{
    value: number;
    max: number;
    size: number;
    strokeWidth: number;
    color: string;
    label: string;
    unit?: string;
  }> = ({ value, max, size, strokeWidth, color, label, unit = '%' }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = (value / max) * circumference;

    return (
      <div className="circular-progress">
        <svg width={size} height={size} className="circular-progress-svg">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
          />
        </svg>
        <div className="circular-progress-content">
          <div className="progress-value">{Math.round(value)}{unit}</div>
          <div className="progress-label">{label}</div>
        </div>
      </div>
    );
  };

  // 미니 차트 컴포넌트
  const MiniChart: React.FC<{
    data: number[];
    color: string;
    height: number;
  }> = ({ data, color, height }) => {
    const width = 100;
    const max = Math.max(...data, 1);
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="mini-chart">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#gradient-${color})`}
        />
      </svg>
    );
  };

  // 상태 색상 결정
  const getStatusColor = (value: number, threshold: number) => {
    if (value >= threshold) return '#ff4444';
    if (value >= threshold * 0.8) return '#ffaa00';
    return '#00ff00';
  };

  // 포맷 헬퍼 함수들
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (mbps: number) => {
    if (mbps < 1) return (mbps * 1000).toFixed(0) + ' Kbps';
    return mbps.toFixed(1) + ' Mbps';
  };

  return (
    <div className={`resource-monitor ${compactMode ? 'compact' : ''} ${isExpanded ? 'expanded' : ''}`}>
      {/* 헤더 */}
      <div className="monitor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className="monitor-title">System Monitor</span>
          <div className="status-indicators">
            <div className={`status-dot ${resourceData.streaming.isActive ? 'streaming' : 'idle'}`} />
            <span className="status-text">
              {resourceData.streaming.isActive ? 'Streaming' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button className="expand-button">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="monitor-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* 메인 리소스 차트 */}
            <div className="main-resources">
              <div className="resource-group">
                <CircularProgress
                  value={resourceData.cpu.usage}
                  max={100}
                  size={80}
                  strokeWidth={6}
                  color={getStatusColor(resourceData.cpu.usage, alertThresholds.cpu)}
                  label="CPU"
                />
                {showDetailed && (
                  <div className="resource-details">
                    <div className="detail-item">
                      <span className="label">Temp:</span>
                      <span className="value">{resourceData.cpu.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Freq:</span>
                      <span className="value">{resourceData.cpu.frequency.toFixed(1)}GHz</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="resource-group">
                <CircularProgress
                  value={resourceData.memory.percentage}
                  max={100}
                  size={80}
                  strokeWidth={6}
                  color={getStatusColor(resourceData.memory.percentage, alertThresholds.memory)}
                  label="RAM"
                />
                {showDetailed && (
                  <div className="resource-details">
                    <div className="detail-item">
                      <span className="label">Used:</span>
                      <span className="value">{formatBytes(resourceData.memory.used * 1024 * 1024 * 1024)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Total:</span>
                      <span className="value">{formatBytes(resourceData.memory.total * 1024 * 1024 * 1024)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="resource-group">
                <CircularProgress
                  value={resourceData.gpu.usage}
                  max={100}
                  size={80}
                  strokeWidth={6}
                  color={getStatusColor(resourceData.gpu.usage, alertThresholds.gpu)}
                  label="GPU"
                />
                {showDetailed && (
                  <div className="resource-details">
                    <div className="detail-item">
                      <span className="label">Temp:</span>
                      <span className="value">{resourceData.gpu.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Power:</span>
                      <span className="value">{resourceData.gpu.powerDraw.toFixed(0)}W</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 스트리밍 상태 */}
            {resourceData.streaming.isActive && (
              <div className="streaming-status">
                <div className="streaming-header">
                  <span className="streaming-title">🔴 Live Streaming</span>
                  <span className="streaming-encoder">{resourceData.streaming.encoding}</span>
                </div>
                <div className="streaming-metrics">
                  <div className="metric">
                    <span className="metric-label">Bitrate:</span>
                    <span className="metric-value">{formatSpeed(resourceData.streaming.bitrate / 1000)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">FPS:</span>
                    <span className="metric-value">{resourceData.streaming.fps.toFixed(1)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Dropped:</span>
                    <span className="metric-value">{resourceData.streaming.droppedFrames.toFixed(0)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Resolution:</span>
                    <span className="metric-value">{resourceData.streaming.resolution}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 네트워크 상태 */}
            <div className="network-status">
              <div className="network-header">
                <span className="network-title">Network</span>
                <span className="network-latency">
                  {resourceData.network.latency.toFixed(0)}ms
                </span>
              </div>
              <div className="network-metrics">
                <div className="network-metric">
                  <span className="metric-label">↑ Upload:</span>
                  <span className="metric-value">{formatSpeed(resourceData.network.upload)}</span>
                </div>
                <div className="network-metric">
                  <span className="metric-label">↓ Download:</span>
                  <span className="metric-value">{formatSpeed(resourceData.network.download)}</span>
                </div>
              </div>
            </div>

            {/* 히스토리 차트 */}
            {showDetailed && (
              <div className="history-charts">
                <div className="chart-group">
                  <div className="chart-header">
                    <span className="chart-title">CPU Usage</span>
                    <span className="chart-current">{resourceData.cpu.usage.toFixed(1)}%</span>
                  </div>
                  <MiniChart data={history.cpu} color="#ff6b6b" height={40} />
                </div>
                <div className="chart-group">
                  <div className="chart-header">
                    <span className="chart-title">Memory Usage</span>
                    <span className="chart-current">{resourceData.memory.percentage.toFixed(1)}%</span>
                  </div>
                  <MiniChart data={history.memory} color="#4ecdc4" height={40} />
                </div>
                <div className="chart-group">
                  <div className="chart-header">
                    <span className="chart-title">GPU Usage</span>
                    <span className="chart-current">{resourceData.gpu.usage.toFixed(1)}%</span>
                  </div>
                  <MiniChart data={history.gpu} color="#45b7d1" height={40} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResourceMonitor;