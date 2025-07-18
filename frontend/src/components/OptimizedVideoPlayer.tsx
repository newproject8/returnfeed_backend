import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCOptimizer, createLowLatencyConfig, createUltraLowLatencyConfig } from '../utils/webrtcOptimizer';
import './OptimizedVideoPlayer.css';

interface OptimizedVideoPlayerProps {
  /** WebRTC 스트림 URL */
  webrtcUrl: string;
  /** HLS 폴백 URL */
  hlsUrl?: string;
  /** 저지연 모드 활성화 */
  lowLatencyMode?: boolean;
  /** 울트라 저지연 모드 활성화 */
  ultraLowLatencyMode?: boolean;
  /** 비트레이트 조정 콜백 */
  onBitrateChange?: (bitrate: number) => void;
  /** 연결 상태 콜백 */
  onConnectionStateChange?: (state: string) => void;
  /** 레이턴시 측정 콜백 */
  onLatencyMeasured?: (latency: number) => void;
  /** 자동 재시도 활성화 */
  autoRetry?: boolean;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
}

interface ConnectionStats {
  bitrate: number;
  packetLoss: number;
  rtt: number;
  jitter: number;
  fps: number;
  resolution: string;
  bytesReceived: number;
  isConnected: boolean;
}

const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
  webrtcUrl,
  hlsUrl,
  lowLatencyMode = true,
  ultraLowLatencyMode = false,
  onBitrateChange,
  onConnectionStateChange,
  onLatencyMeasured,
  autoRetry = true,
  maxRetries = 3
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const optimizerRef = useRef<WebRTCOptimizer | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    bitrate: 0,
    packetLoss: 0,
    rtt: 0,
    jitter: 0,
    fps: 0,
    resolution: '0x0',
    bytesReceived: 0,
    isConnected: false
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  // WebRTC 연결 초기화
  const initializeWebRTC = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // 기존 연결 정리
      if (pcRef.current) {
        pcRef.current.close();
      }
      
      // 최적화 설정 생성
      const config = ultraLowLatencyMode 
        ? createUltraLowLatencyConfig()
        : createLowLatencyConfig();
      
      // WebRTC 옵티마이저 초기화
      optimizerRef.current = new WebRTCOptimizer(config);
      
      // PeerConnection 생성
      const rtcConfig = optimizerRef.current.createOptimizedConfiguration();
      pcRef.current = new RTCPeerConnection(rtcConfig);
      
      // 통계 모니터링 설정
      optimizerRef.current.setStatsUpdateCallback((stats) => {
        updateConnectionStats(stats);
      });
      
      // 연결 최적화 적용
      await optimizerRef.current.optimizeConnection(pcRef.current);
      
      // 이벤트 리스너 설정
      setupEventListeners();
      
      // WebRTC 연결 시작
      await startWebRTCConnection();
      
    } catch (error) {
      console.error('WebRTC 초기화 실패:', error);
      setConnectionError('WebRTC 초기화에 실패했습니다.');
      
      // 폴백 또는 재시도
      if (autoRetry && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`재시도 ${retryCountRef.current}/${maxRetries}`);
        setTimeout(() => initializeWebRTC(), 2000);
      } else if (hlsUrl) {
        console.log('HLS 폴백으로 전환');
        setUseFallback(true);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [webrtcUrl, ultraLowLatencyMode, autoRetry, maxRetries, hlsUrl]);

  // WebRTC 연결 시작
  const startWebRTCConnection = async () => {
    if (!pcRef.current) return;
    
    try {
      // WHEP 프로토콜을 사용한 연결
      const response = await fetch(webrtcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'Accept': 'application/sdp'
        },
        body: await createOffer()
      });
      
      if (!response.ok) {
        throw new Error(`WebRTC 연결 실패: ${response.status}`);
      }
      
      const answerSdp = await response.text();
      await pcRef.current.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });
      
      console.log('WebRTC 연결 성공');
      
    } catch (error) {
      console.error('WebRTC 연결 오류:', error);
      throw error;
    }
  };

  // Offer 생성
  const createOffer = async (): Promise<string> => {
    if (!pcRef.current) throw new Error('PeerConnection이 없습니다');
    
    // 수신 전용 트랜시버 추가
    pcRef.current.addTransceiver('video', { direction: 'recvonly' });
    pcRef.current.addTransceiver('audio', { direction: 'recvonly' });
    
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    
    return offer.sdp || '';
  };

  // 이벤트 리스너 설정
  const setupEventListeners = () => {
    if (!pcRef.current) return;
    
    // 연결 상태 변경
    pcRef.current.onconnectionstatechange = () => {
      if (pcRef.current) {
        const state = pcRef.current.connectionState;
        console.log(`연결 상태 변경: ${state}`);
        
        setConnectionStats(prev => ({
          ...prev,
          isConnected: state === 'connected'
        }));
        
        onConnectionStateChange?.(state);
        
        if (state === 'connected') {
          retryCountRef.current = 0; // 재시도 카운터 리셋
          setConnectionError(null);
        } else if (state === 'failed' || state === 'disconnected') {
          handleConnectionFailure();
        }
      }
    };
    
    // 스트림 수신
    pcRef.current.ontrack = (event) => {
      console.log('스트림 수신:', event.track.kind);
      
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(console.error);
      }
    };
    
    // ICE 연결 상태 변경
    pcRef.current.oniceconnectionstatechange = () => {
      if (pcRef.current) {
        console.log(`ICE 연결 상태: ${pcRef.current.iceConnectionState}`);
      }
    };
  };

  // 연결 실패 처리
  const handleConnectionFailure = () => {
    console.log('연결 실패 처리 시작');
    
    if (autoRetry && retryCountRef.current < maxRetries) {
      retryCountRef.current++;
      console.log(`자동 재연결 시도 ${retryCountRef.current}/${maxRetries}`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        initializeWebRTC();
      }, 3000);
    } else {
      setConnectionError('연결에 실패했습니다.');
      
      if (hlsUrl) {
        console.log('HLS 폴백으로 전환');
        setUseFallback(true);
      }
    }
  };

  // 통계 업데이트
  const updateConnectionStats = (stats: RTCStatsReport) => {
    let newStats: Partial<ConnectionStats> = {};
    
    stats.forEach((report) => {
      // 인바운드 비디오 통계
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        newStats.bitrate = report.bytesReceived * 8 / 1000; // kbps
        newStats.fps = report.framesPerSecond || 0;
        newStats.bytesReceived = report.bytesReceived || 0;
        newStats.packetLoss = report.packetsLost || 0;
        newStats.jitter = (report.jitter || 0) * 1000; // ms
        
        if (report.frameWidth && report.frameHeight) {
          newStats.resolution = `${report.frameWidth}x${report.frameHeight}`;
        }
      }
      
      // 연결 통계
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        newStats.rtt = (report.currentRoundTripTime || 0) * 1000; // ms
        
        // 레이턴시 측정 콜백
        if (onLatencyMeasured) {
          onLatencyMeasured(newStats.rtt);
        }
      }
    });
    
    setConnectionStats(prev => ({ ...prev, ...newStats }));
    
    // 비트레이트 변경 콜백
    if (newStats.bitrate && onBitrateChange) {
      onBitrateChange(newStats.bitrate);
    }
  };

  // HLS 폴백 초기화
  const initializeHLS = useCallback(async () => {
    if (!hlsUrl || !videoRef.current) return;
    
    try {
      console.log('HLS 폴백 초기화');
      
      // Hls.js 사용 (동적 import)
      const Hls = (await import('hls.js')).default;
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: lowLatencyMode,
          backBufferLength: 10,
          maxBufferLength: 20,
          maxMaxBufferLength: 30,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3
        });
        
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS 폴백 준비 완료');
          videoRef.current?.play();
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS 오류:', data);
          setConnectionError('HLS 스트림 오류');
        });
        
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari 네이티브 HLS 지원
        videoRef.current.src = hlsUrl;
        videoRef.current.play();
      }
      
    } catch (error) {
      console.error('HLS 폴백 초기화 실패:', error);
      setConnectionError('HLS 폴백 초기화에 실패했습니다.');
    }
  }, [hlsUrl, lowLatencyMode]);

  // 수동 재연결
  const handleManualReconnect = () => {
    retryCountRef.current = 0;
    setUseFallback(false);
    initializeWebRTC();
  };

  // 초기화 및 정리
  useEffect(() => {
    if (useFallback) {
      initializeHLS();
    } else {
      initializeWebRTC();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pcRef.current) {
        pcRef.current.close();
      }
      
      if (optimizerRef.current) {
        optimizerRef.current.cleanup();
      }
    };
  }, [useFallback, initializeWebRTC, initializeHLS]);

  return (
    <div className="optimized-video-player">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          autoPlay
          muted
          playsInline
          controls={false}
        />
        
        {/* 연결 상태 오버레이 */}
        {isConnecting && (
          <div className="connection-overlay">
            <div className="loading-spinner" />
            <span>연결 중...</span>
          </div>
        )}
        
        {connectionError && (
          <div className="error-overlay">
            <div className="error-message">
              <h3>연결 오류</h3>
              <p>{connectionError}</p>
              {autoRetry && retryCountRef.current < maxRetries && (
                <p>자동 재연결 시도 중... ({retryCountRef.current}/{maxRetries})</p>
              )}
              <button onClick={handleManualReconnect} className="retry-button">
                다시 시도
              </button>
            </div>
          </div>
        )}
        
        {/* 통계 정보 */}
        <div className="stats-overlay">
          <div className="connection-indicator">
            <div className={`status-dot ${connectionStats.isConnected ? 'connected' : 'disconnected'}`} />
            <span className="protocol-label">
              {useFallback ? 'HLS' : ultraLowLatencyMode ? 'WebRTC Ultra' : 'WebRTC'}
            </span>
          </div>
          
          {connectionStats.isConnected && (
            <div className="stats-info">
              <div className="stat">
                <span className="stat-label">비트레이트:</span>
                <span className="stat-value">{Math.round(connectionStats.bitrate)} kbps</span>
              </div>
              <div className="stat">
                <span className="stat-label">레이턴시:</span>
                <span className="stat-value">{connectionStats.rtt.toFixed(0)} ms</span>
              </div>
              <div className="stat">
                <span className="stat-label">FPS:</span>
                <span className="stat-value">{connectionStats.fps.toFixed(0)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">해상도:</span>
                <span className="stat-value">{connectionStats.resolution}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizedVideoPlayer;