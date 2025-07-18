import React from 'react';

interface ControlOverlayProps {
  isVisible: boolean;
  isVibrationEnabled: boolean;
  isSoundEnabled: boolean;
  onVibrationToggle: () => void;
  onSoundToggle: () => void;
}

const ControlOverlay: React.FC<ControlOverlayProps> = ({
  isVisible,
  isVibrationEnabled,
  isSoundEnabled,
  onVibrationToggle,
  onSoundToggle,
}) => {
  if (!isVisible) return null;

  return (
    <div className="control-overlay">
      <div className="control-menu">
        <button className="control-button" onClick={onVibrationToggle}>
          Vibration: {isVibrationEnabled ? 'ON' : 'OFF'}
        </button>
        <button className="control-button" onClick={onSoundToggle}>
          Sound: {isSoundEnabled ? 'ON' : 'OFF'}
        </button>
        <button className="control-button" onClick={() => {
          localStorage.removeItem('myInputNumber');
          window.location.reload();
        }}>Change Camera</button>
      </div>
    </div>
  );
};

export default ControlOverlay;