import React, { useState, useEffect } from 'react';
import BitrateController from './BitrateController';
import './StaffBitratePanel.css';

interface StaffBitratePanelProps {
  sessionKey: string;
  selectedCamera: number | null;
  isVisible: boolean;
  onClose: () => void;
}

const StaffBitratePanel: React.FC<StaffBitratePanelProps> = ({
  sessionKey,
  selectedCamera,
  isVisible,
  onClose
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isVisible || !selectedCamera) return null;

  return (
    <div className={`staff-bitrate-panel ${isMinimized ? 'minimized' : ''}`}>
      <div className="panel-header">
        <h4>스트림 품질 조정</h4>
        <div className="panel-controls">
          <button
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? '확장' : '최소화'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            className="close-btn"
            onClick={onClose}
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <div className="panel-content">
          <BitrateController
            sessionId={sessionKey}
            cameraId={selectedCamera.toString()}
            compact={true}
            onBitrateChange={(percentage) => {
              console.log(`카메라 ${selectedCamera} 비트레이트: ${(percentage * 100).toFixed(1)}%`);
            }}
            onQualityChange={(preset) => {
              console.log(`카메라 ${selectedCamera} 품질 프리셋: ${preset}`);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default StaffBitratePanel;