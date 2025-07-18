import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// 고급 컴포넌트 임포트
import TallySystemAdvanced from '../components/TallySystemAdvanced';
import MobileOptimizedLayout from '../components/MobileOptimizedLayout';
import ResourceMonitor from '../components/ResourceMonitor';
import VideoPlayer from '../components/VideoPlayer';

// 고급 훅 임포트
import { useVoiceGuidance, defaultVoiceSettings } from '../hooks/useVoiceGuidance';
import useWebSocketEnhanced from '../hooks/useWebSocketEnhanced';
import { useErrorRecovery } from '../contexts/ErrorRecoveryContext';

// 스타일 임포트
import './StaffViewAdvanced.css';

interface Input {
  number: string;
  name?: string;
  title?: string;
  type?: string;
  state?: string;
  duration?: string;
  shortTitle?: string;
}

interface SessionInfo {
  sessionName: string;
  ownerName: string;
  isActive: boolean;
  participants: number;
  streamingStatus: 'idle' | 'streaming' | 'recording';
}

interface StaffSettings {
  voice: {
    enabled: boolean;
    volume: number;
    rate: number;
    pitch: number;
    forceMale: boolean;
    language: string;
  };
  display: {
    showResourceMonitor: boolean;
    compactMode: boolean;
    showAdvancedTally: boolean;
    enableAnimations: boolean;
  };
  notifications: {
    vibration: boolean;
    sound: boolean;
    toast: boolean;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    largeFonts: boolean;
  };
}

const StaffViewAdvanced: React.FC = () => {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const navigate = useNavigate();
  
  // 상태 관리
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [programInput, setProgramInput] = useState<number | null>(null);
  const [previewInput, setPreviewInput] = useState<number | null>(null);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 설정 상태
  const [settings, setSettings] = useState<StaffSettings>({
    voice: defaultVoiceSettings,
    display: {
      showResourceMonitor: true,
      compactMode: false,
      showAdvancedTally: true,
      enableAnimations: true,
    },
    notifications: {
      vibration: true,
      sound: true,
      toast: true,
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      largeFonts: false,
    },
  });

  // 스트림 URL 설정
  const HLS_STREAM_URL = `/ws/mediamtx/session_${sessionKey}/index.m3u8`;
  const WEBRTC_STREAM_URL = `/ws/mediamtx/session_${sessionKey}/whep`;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const RELAY_URL = `${wsProtocol}//${window.location.host}/ws/relay`;

  // 오류 복구 시스템
  const { addError, removeError, state: errorState } = useErrorRecovery();

  // 향상된 WebSocket 연결
  const {
    isConnected,
    isConnecting,
    isReconnecting,
    connectionAttempts,
    lastError,
    latency,
    sendJsonMessage,
    forceReconnect,
  } = useWebSocketEnhanced({
    url: RELAY_URL,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    heartbeatInterval: 30000,
    heartbeatTimeout: 5000,
    onConnect: () => {
      console.log('WebSocket 연결 성공');
      if (sessionKey) {
        sendJsonMessage({
          type: 'register',
          sessionId: sessionKey,
          role: 'staff',
          capabilities: {
            voice: settings.voice.enabled,
            notifications: settings.notifications,
            display: settings.display,
          },
        });
      }
    },
    onDisconnect: () => {
      console.log('WebSocket 연결 해제');
      addError({
        type: 'network',
        severity: 'high',
        message: 'WebSocket 연결이 해제되었습니다',
        recoverable: true,
        retryCount: 0,
        maxRetries: 5,
        autoRecover: true,
      });
    },
    onReconnect: () => {
      console.log('WebSocket 재연결 성공');
      removeError('websocket_disconnected');
    },
    onError: (error) => {
      console.error('WebSocket 오류:', error);
      addError({
        type: 'network',
        severity: 'medium',
        message: 'WebSocket 연결 오류',
        details: error.toString(),
        recoverable: true,
        retryCount: 0,
        maxRetries: 3,
        autoRecover: true,
      });
    },
    onMessage: (message) => {
      try {
        const data = JSON.parse(message.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
      }
    },
  });

  // 고급 음성 안내 시스템
  const {
    speak,
    announceConnection,
    announceError,
    announceSystemStatus,
    isInitialized: voiceInitialized,
  } = useVoiceGuidance({
    selectedCamera,
    programInput,
    previewInput,
    settings: settings.voice,
  });

  // WebSocket 메시지 처리
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'tally_update':
        setProgramInput(data.program);
        setPreviewInput(data.preview);
        
        if (data.inputs && Object.keys(data.inputs).length > 0) {
          setInputs(processInputsData(data.inputs));
        }
        break;
        
      case 'inputs_update':
      case 'inputs_list':
        if (data.inputs) {
          setInputs(processInputsData(data.inputs));
        }
        break;
        
      case 'session_info':
        setSessionInfo(data.session);
        break;
        
      case 'session_ended':
        addError({
          type: 'system',
          severity: 'high',
          message: '방송 세션이 종료되었습니다',
          recoverable: false,
          retryCount: 0,
          maxRetries: 0,
          autoRecover: false,
        });
        break;
        
      case 'error':
        addError({
          type: 'system',
          severity: data.severity || 'medium',
          message: data.message,
          details: data.details,
          recoverable: data.recoverable || false,
          retryCount: 0,
          maxRetries: data.maxRetries || 3,
          autoRecover: data.autoRecover || false,
        });
        break;
        
      case 'system_status':
        announceSystemStatus(data.message);
        break;
        
      default:
        console.log('알 수 없는 메시지 타입:', data.type);
    }
  }, [addError, announceSystemStatus]);

  // 입력 데이터 처리
  const processInputsData = (inputsData: any): Input[] => {
    return Object.entries(inputsData).map(([number, inputInfo]) => {
      if (typeof inputInfo === 'string') {
        return {
          number,
          name: inputInfo,
          title: inputInfo,
        };
      } else if (typeof inputInfo === 'object' && inputInfo !== null) {
        return {
          number,
          name: (inputInfo as any).name || (inputInfo as any).title,
          title: (inputInfo as any).title,
          type: (inputInfo as any).type,
          state: (inputInfo as any).state,
          duration: (inputInfo as any).duration,
          shortTitle: (inputInfo as any).shortTitle,
        };
      } else {
        return {
          number,
          name: `Input ${number}`,
          title: `Input ${number}`,
        };
      }
    }).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  };

  // 카메라 선택 처리
  const handleSelectCamera = useCallback((cameraNumber: number) => {
    setSelectedCamera(cameraNumber);
    setShowCameraSelector(false);
    localStorage.setItem(`staff_camera_${sessionKey}`, cameraNumber.toString());
    
    if (settings.voice.enabled) {
      speak(`카메라 ${cameraNumber}번이 선택되었습니다.`);
    }
  }, [sessionKey, settings.voice.enabled, speak]);

  // 설정 업데이트
  const updateSettings = useCallback((newSettings: Partial<StaffSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
    
    // 설정을 로컬 스토리지에 저장
    localStorage.setItem(`staff_settings_${sessionKey}`, JSON.stringify({
      ...settings,
      ...newSettings,
    }));
  }, [sessionKey, settings]);

  // 제스처 핸들러
  const handleSwipeUp = useCallback(() => {
    if (settings.display.showResourceMonitor) {
      setSettings(prev => ({
        ...prev,
        display: { ...prev.display, showResourceMonitor: false },
      }));
    }
  }, [settings.display.showResourceMonitor]);

  const handleSwipeDown = useCallback(() => {
    if (!settings.display.showResourceMonitor) {
      setSettings(prev => ({
        ...prev,
        display: { ...prev.display, showResourceMonitor: true },
      }));
    }
  }, [settings.display.showResourceMonitor]);

  const handleSwipeLeft = useCallback(() => {
    if (selectedCamera && inputs.length > 0) {
      const currentIndex = inputs.findIndex(input => parseInt(input.number) === selectedCamera);
      if (currentIndex > 0) {
        handleSelectCamera(parseInt(inputs[currentIndex - 1].number));
      }
    }
  }, [selectedCamera, inputs, handleSelectCamera]);

  const handleSwipeRight = useCallback(() => {
    if (selectedCamera && inputs.length > 0) {
      const currentIndex = inputs.findIndex(input => parseInt(input.number) === selectedCamera);
      if (currentIndex < inputs.length - 1) {
        handleSelectCamera(parseInt(inputs[currentIndex + 1].number));
      }
    }
  }, [selectedCamera, inputs, handleSelectCamera]);

  const handleDoubleTap = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleLongPress = useCallback(() => {
    setShowSettings(true);
  }, []);

  // 리소스 알림 처리
  const handleResourceAlert = useCallback((type: string, value: number) => {
    addError({
      type: 'system',
      severity: 'medium',
      message: `시스템 리소스 경고: ${type} 사용률 ${value.toFixed(1)}%`,
      recoverable: true,
      retryCount: 0,
      maxRetries: 1,
      autoRecover: false,
    });
  }, [addError]);

  // 초기 데이터 로드
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        // 세션 정보 로드 (실제 환경에서는 API 호출)
        setSessionInfo({
          sessionName: 'Live Production Studio',
          ownerName: 'PD User',
          isActive: true,
          participants: 5,
          streamingStatus: 'streaming',
        });
        
        // 저장된 카메라 선택 로드
        const savedCamera = localStorage.getItem(`staff_camera_${sessionKey}`);
        if (savedCamera) {
          setSelectedCamera(parseInt(savedCamera));
        }
        
        // 저장된 설정 로드
        const savedSettings = localStorage.getItem(`staff_settings_${sessionKey}`);
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('세션 데이터 로드 실패:', error);
        addError({
          type: 'system',
          severity: 'high',
          message: '세션 데이터를 로드할 수 없습니다',
          recoverable: true,
          retryCount: 0,
          maxRetries: 3,
          autoRecover: true,
        });
        setIsLoading(false);
      }
    };

    loadSessionData();
  }, [sessionKey, addError]);

  // 연결 상태 음성 안내
  useEffect(() => {
    if (voiceInitialized && settings.voice.enabled) {
      if (isConnected) {
        announceConnection('connected');
      } else if (isReconnecting) {
        announceConnection('reconnecting');
      } else if (lastError) {
        announceConnection('disconnected');
      }
    }
  }, [isConnected, isReconnecting, lastError, voiceInitialized, settings.voice.enabled, announceConnection]);

  // 로딩 화면
  if (isLoading) {
    return (
      <MobileOptimizedLayout>
        <div className="staff-view-loading">
          <div className="loading-spinner" />
          <p>세션 연결 중...</p>
        </div>
      </MobileOptimizedLayout>
    );
  }

  // 오류 화면
  if (errorState.errors.some(error => error.severity === 'critical')) {
    const criticalError = errorState.errors.find(error => error.severity === 'critical');
    return (
      <MobileOptimizedLayout>
        <div className="staff-view-error">
          <h2>시스템 오류</h2>
          <p>{criticalError?.message}</p>
          <button onClick={() => window.location.reload()} className="btn-advanced">
            새로고침
          </button>
        </div>
      </MobileOptimizedLayout>
    );
  }

  return (
    <MobileOptimizedLayout
      enableGestures={true}
      enableFullscreen={true}
      onFullscreenChange={setIsFullscreen}
      onSwipeUp={handleSwipeUp}
      onSwipeDown={handleSwipeDown}
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onDoubleTap={handleDoubleTap}
      onLongPress={handleLongPress}
    >
      <div className="staff-view-advanced">
        {/* 상태 표시 오버레이 */}
        <div className="connection-status-overlay">
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot" />
            <span className="status-text">
              {isConnected ? '연결됨' : isReconnecting ? '재연결 중' : '연결 해제'}
            </span>
            {latency > 0 && (
              <span className="latency-info">{latency}ms</span>
            )}
          </div>
        </div>

        {/* 리소스 모니터 */}
        <AnimatePresence>
          {settings.display.showResourceMonitor && (
            <motion.div
              className="resource-monitor-overlay"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ResourceMonitor
                compactMode={settings.display.compactMode}
                showDetailed={!settings.display.compactMode}
                onResourceAlert={handleResourceAlert}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 메인 비디오 영역 */}
        <div className="main-video-area">
          {selectedCamera ? (
            settings.display.showAdvancedTally ? (
              <TallySystemAdvanced
                programInput={programInput}
                previewInput={previewInput}
                myInputNumber={selectedCamera}
                showStatusText={true}
                animationDuration={settings.display.enableAnimations ? 0.3 : 0}
              >
                <VideoPlayer
                  hlsUrl={HLS_STREAM_URL}
                  webrtcUrl={WEBRTC_STREAM_URL}
                />
              </TallySystemAdvanced>
            ) : (
              <VideoPlayer
                hlsUrl={HLS_STREAM_URL}
                webrtcUrl={WEBRTC_STREAM_URL}
              />
            )
          ) : (
            <div className="no-camera-selected">
              <h2>카메라를 선택해주세요</h2>
              <p>아래 버튼을 눌러 담당 카메라를 선택하세요</p>
              <button
                onClick={() => setShowCameraSelector(true)}
                className="btn-advanced"
              >
                카메라 선택
              </button>
            </div>
          )}
        </div>

        {/* 하단 컨트롤 바 */}
        <div className="bottom-controls">
          <div className="control-group">
            <button
              onClick={() => setShowCameraSelector(true)}
              className="control-btn"
            >
              {selectedCamera ? `Camera ${selectedCamera}` : '카메라 선택'}
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="control-btn"
            >
              ⚙️ 설정
            </button>
          </div>
          
          <div className="tally-status">
            {selectedCamera && (
              <>
                {programInput === selectedCamera && (
                  <span className="status-badge program">🔴 ON AIR</span>
                )}
                {previewInput === selectedCamera && (
                  <span className="status-badge preview">🟢 PREVIEW</span>
                )}
                {programInput !== selectedCamera && previewInput !== selectedCamera && (
                  <span className="status-badge standby">⚪ STANDBY</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* 카메라 선택 모달 */}
        <AnimatePresence>
          {showCameraSelector && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCameraSelector(false)}
            >
              <motion.div
                className="modal-content"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2>카메라 선택</h2>
                <div className="camera-grid">
                  {inputs.length > 0 ? (
                    inputs.map((input) => (
                      <button
                        key={input.number}
                        onClick={() => handleSelectCamera(parseInt(input.number))}
                        className={`camera-card ${
                          parseInt(input.number) === selectedCamera ? 'selected' : ''
                        }`}
                      >
                        <div className="camera-number">Camera {input.number}</div>
                        <div className="camera-name">{input.title || input.name}</div>
                        {input.state && (
                          <div className={`camera-state ${input.state.toLowerCase()}`}>
                            {input.state}
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="no-cameras">
                      <p>사용 가능한 카메라가 없습니다</p>
                      <small>PD가 vMix를 연결하면 카메라 목록이 표시됩니다</small>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowCameraSelector(false)}
                  className="btn-advanced"
                >
                  닫기
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 설정 모달 */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
            >
              <motion.div
                className="modal-content settings-modal"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2>설정</h2>
                
                {/* 음성 안내 설정 */}
                <div className="settings-section">
                  <h3>음성 안내</h3>
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.voice.enabled}
                      onChange={(e) => updateSettings({
                        voice: { ...settings.voice, enabled: e.target.checked }
                      })}
                    />
                    <span>음성 안내 활성화</span>
                  </label>
                  
                  <label className="setting-item">
                    <span>음성 볼륨</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.voice.volume}
                      onChange={(e) => updateSettings({
                        voice: { ...settings.voice, volume: parseFloat(e.target.value) }
                      })}
                    />
                  </label>
                  
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.voice.forceMale}
                      onChange={(e) => updateSettings({
                        voice: { ...settings.voice, forceMale: e.target.checked }
                      })}
                    />
                    <span>남성 음성 강제 사용</span>
                  </label>
                </div>

                {/* 디스플레이 설정 */}
                <div className="settings-section">
                  <h3>디스플레이</h3>
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.display.showResourceMonitor}
                      onChange={(e) => updateSettings({
                        display: { ...settings.display, showResourceMonitor: e.target.checked }
                      })}
                    />
                    <span>리소스 모니터 표시</span>
                  </label>
                  
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.display.compactMode}
                      onChange={(e) => updateSettings({
                        display: { ...settings.display, compactMode: e.target.checked }
                      })}
                    />
                    <span>컴팩트 모드</span>
                  </label>
                  
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.display.showAdvancedTally}
                      onChange={(e) => updateSettings({
                        display: { ...settings.display, showAdvancedTally: e.target.checked }
                      })}
                    />
                    <span>고급 탤리 시스템</span>
                  </label>
                </div>

                {/* 알림 설정 */}
                <div className="settings-section">
                  <h3>알림</h3>
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.notifications.vibration}
                      onChange={(e) => updateSettings({
                        notifications: { ...settings.notifications, vibration: e.target.checked }
                      })}
                    />
                    <span>진동 알림</span>
                  </label>
                  
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={settings.notifications.sound}
                      onChange={(e) => updateSettings({
                        notifications: { ...settings.notifications, sound: e.target.checked }
                      })}
                    />
                    <span>소리 알림</span>
                  </label>
                </div>

                <div className="settings-actions">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="btn-advanced"
                  >
                    저장
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 오류 토스트 */}
        <div className="toast-container">
          <AnimatePresence>
            {errorState.errors.map((error) => (
              <motion.div
                key={error.id}
                className={`toast ${error.severity}`}
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
              >
                <div className="toast-content">
                  <div className="toast-message">{error.message}</div>
                  {error.details && (
                    <div className="toast-details">{error.details}</div>
                  )}
                </div>
                <div className="toast-actions">
                  {error.recoverable && (
                    <button
                      onClick={() => removeError(error.id)}
                      className="toast-action"
                    >
                      재시도
                    </button>
                  )}
                  <button
                    onClick={() => removeError(error.id)}
                    className="toast-dismiss"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MobileOptimizedLayout>
  );
};

export default StaffViewAdvanced;