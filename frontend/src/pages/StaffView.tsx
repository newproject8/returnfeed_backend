import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SimulcastVideoPlayer } from '../components/SimulcastVideoPlayer';
import TallyOverlay from '../components/TallyOverlay';
import StaffBitratePanel from '../components/StaffBitratePanel';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVoiceGuidance, defaultVoiceSettings } from '../hooks/useVoiceGuidance';
import './StaffView.css';

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
}

const StaffView: React.FC = () => {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const navigate = useNavigate();
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const HLS_STREAM_URL = `/ws/mediamtx/session_${sessionKey}/index.m3u8`;
  const WEBRTC_STREAM_URL = `/ws/mediamtx/session_${sessionKey}/whep`;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const RELAY_URL = `${wsProtocol}//${window.location.host}/ws/relay`;

  const { lastMessage, sendMessage } = useWebSocket(RELAY_URL);

  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [programInput, setProgramInput] = useState<number | null>(null);
  const [previewInput, setPreviewInput] = useState<number | null>(null);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showBitratePanel, setShowBitratePanel] = useState(false);

  // 음성 설정 (굵은 남성 음성으로 cut/standby 안내)
  const voiceSettings = {
    ...defaultVoiceSettings,
    enabled: isSoundEnabled,
    volume: 0.9,
    pitch: 0.7, // 더 낮은 톤으로 남성스럽게
    rate: 1.2   // 빠른 대응을 위해 약간 빠르게
  };

  const { speak, announceConnection, announceError } = useVoiceGuidance({
    selectedCamera,
    programInput,
    previewInput,
    settings: voiceSettings
  });

  // Fetch session info
  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        // For now, we'll use mock data
        // In production, this would be an API call
        setSessionInfo({
          sessionName: "Live Production Studio",
          ownerName: "PD User",
          isActive: true
        });
        setIsLoading(false);
      } catch (err) {
        setError('세션을 찾을 수 없습니다.');
        setIsLoading(false);
      }
    };

    fetchSessionInfo();
  }, [sessionKey]);

  // Register with WebSocket when connected
  useEffect(() => {
    if (sessionKey && sendMessage) {
      // Staff members don't need authentication for viewing
      sendMessage(JSON.stringify({
        type: 'register',
        sessionId: sessionKey,
        role: 'staff'
      }));
    }
  }, [sessionKey, sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        if (data.type === 'tally_update') {
          setProgramInput(data.program);
          setPreviewInput(data.preview);
          
          // tally_update may include inputs data
          if (data.inputs && Object.keys(data.inputs).length > 0) {
            setInputs(processInputsData(data.inputs));
          }
        } else if (data.type === 'inputs_update') {
          // New message type from vMix with detailed input information
          console.log('Inputs updated from vMix:', data);
          if (data.inputs) {
            setInputs(processInputsData(data.inputs));
          }
        } else if (data.type === 'inputs_list') {
          // Response to get_inputs request
          if (data.inputs) {
            setInputs(processInputsData(data.inputs));
          }
        } else if (data.type === 'input_list' && data.inputs) {
          // Legacy compatibility
          setInputs(processInputsData(data.inputs));
        } else if (data.type === 'session_ended') {
          setError('방송이 종료되었습니다.');
        } else if (data.type === 'session_registered') {
          // Request inputs data after registration
          sendMessage(JSON.stringify({ type: 'get_inputs' }));
        }
      } catch (e) {
        console.error('Failed to parse message data:', e);
      }
    }
  }, [lastMessage, sendMessage]);

  // Helper function to process inputs data from different formats
  const processInputsData = (inputsData: any): Input[] => {
    return Object.entries(inputsData).map(([number, inputInfo]) => {
      if (typeof inputInfo === 'string') {
        // Old format: inputs[number] = "Camera Name"
        return {
          number,
          name: inputInfo,
          title: inputInfo
        };
      } else if (typeof inputInfo === 'object' && inputInfo !== null) {
        // New format: inputs[number] = {title, type, state, etc.}
        return {
          number,
          name: inputInfo.name || inputInfo.title,
          title: inputInfo.title,
          type: inputInfo.type,
          state: inputInfo.state,
          duration: inputInfo.duration,
          shortTitle: inputInfo.shortTitle
        };
      } else {
        // Fallback
        return {
          number,
          name: `Input ${number}`,
          title: `Input ${number}`
        };
      }
    }).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  };

  const handleSelectCamera = (cameraNumber: number) => {
    setSelectedCamera(cameraNumber);
    setShowCameraSelector(false);
    localStorage.setItem(`staff_camera_${sessionKey}`, cameraNumber.toString());
  };

  const handleLatencyUpdate = (latency: number) => {
    // 레이턴시 업데이트 처리
    // 필요시 상태 업데이트나 로깅 추가 가능
    console.log(`Latency updated: ${latency}ms`);
  };

  // Load saved camera selection
  useEffect(() => {
    const savedCamera = localStorage.getItem(`staff_camera_${sessionKey}`);
    if (savedCamera) {
      setSelectedCamera(parseInt(savedCamera));
    }
  }, [sessionKey]);

  if (isLoading) {
    return (
      <div className="staff-view-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>세션 연결 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="staff-view-container">
        <div className="error-screen">
          <h2>연결 오류</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="back-button">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!sessionInfo?.isActive) {
    return (
      <div className="staff-view-container">
        <div className="error-screen">
          <h2>세션 비활성</h2>
          <p>현재 방송이 진행중이지 않습니다.</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-view">
      {/* Header */}
      <div className="staff-header">
        <div className="session-info">
          <h3>{sessionInfo.sessionName}</h3>
          <p>PD: {sessionInfo.ownerName}</p>
        </div>
        
        <div className="staff-controls">
          <button
            onClick={() => setShowCameraSelector(true)}
            className="camera-select-btn"
          >
            {selectedCamera ? `Camera ${selectedCamera}` : '카메라 선택'}
          </button>
          
          <button
            onClick={() => setIsVibrationEnabled(!isVibrationEnabled)}
            className={`control-btn ${isVibrationEnabled ? 'active' : ''}`}
            title="진동 알림"
          >
            📳
          </button>
          
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`control-btn ${isSoundEnabled ? 'active' : ''}`}
            title="음성 알림"
          >
            🔊
          </button>
          
          <button
            onClick={() => setShowBitratePanel(!showBitratePanel)}
            className={`control-btn ${showBitratePanel ? 'active' : ''}`}
            title="비트레이트 조정"
          >
            📊
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="staff-content">
        {selectedCamera ? (
          <TallyOverlay
            programInput={programInput}
            previewInput={previewInput}
            myInputNumber={selectedCamera}
          >
            <SimulcastVideoPlayer
              sessionKey={sessionKey || ''}
              mediamtxUrl={window.location.hostname}
              onLatencyUpdate={(latency) => {
                console.log(`측정된 레이턴시: ${latency.toFixed(1)}ms`);
                handleLatencyUpdate(latency);
              }}
            />
          </TallyOverlay>
        ) : (
          <div className="no-camera-selected">
            <h2>카메라를 선택해주세요</h2>
            <p>상단의 카메라 선택 버튼을 눌러 담당 카메라를 선택하세요.</p>
          </div>
        )}
      </div>

      {/* Camera Selector Modal */}
      {showCameraSelector && (
        <div className="camera-selector-modal">
          <div className="modal-content">
            <h2>담당 카메라 선택</h2>
            <div className="camera-list">
              {inputs.length > 0 ? (
                inputs.map((input) => {
                  const displayName = input.title || input.name || `Input ${input.number}`;
                  const isLive = input.state === 'Running';
                  const isPaused = input.state === 'Paused';
                  
                  return (
                    <button
                      key={input.number}
                      onClick={() => handleSelectCamera(parseInt(input.number))}
                      className={`camera-option ${
                        parseInt(input.number) === selectedCamera ? 'selected' : ''
                      } ${isLive ? 'live' : ''} ${isPaused ? 'paused' : ''}`}
                      title={`${displayName} ${input.type ? `(${input.type})` : ''} - ${input.state || 'Unknown'}`}
                    >
                      <div className="camera-header">
                        <span className="camera-number">Camera {input.number}</span>
                        {isLive && <span className="status-indicator live">🔴 LIVE</span>}
                        {isPaused && <span className="status-indicator paused">⏸️</span>}
                      </div>
                      <span className="camera-name">{displayName}</span>
                      {input.type && (
                        <span className="camera-type">({input.type})</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="loading-message">
                  <p>vMix에서 카메라 정보를 가져오는 중...</p>
                  <small>PD가 vMix를 연결하면 카메라 목록이 표시됩니다.</small>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCameraSelector(false)}
              className="close-button"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="staff-status-bar">
        <div className="connection-status">
          <span className="status-dot active"></span>
          연결됨
        </div>
        
        {selectedCamera && (
          <div className="tally-status">
            {programInput === selectedCamera && (
              <span className="status-badge program">ON AIR</span>
            )}
            {previewInput === selectedCamera && (
              <span className="status-badge preview">PREVIEW</span>
            )}
            {programInput !== selectedCamera && previewInput !== selectedCamera && (
              <span className="status-badge standby">STANDBY</span>
            )}
          </div>
        )}
        
        <div className="session-key">
          Session: {sessionKey}
        </div>
      </div>

      {/* 비트레이트 조정 패널 */}
      <StaffBitratePanel
        sessionKey={sessionKey!}
        selectedCamera={selectedCamera}
        isVisible={showBitratePanel}
        onClose={() => setShowBitratePanel(false)}
      />
    </div>
  );
};

export default StaffView;