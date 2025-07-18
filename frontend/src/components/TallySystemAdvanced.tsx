import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TallySystemAdvanced.css';

interface TallySystemAdvancedProps {
  programInput: number | null;
  previewInput: number | null;
  myInputNumber: number | null;
  children: React.ReactNode;
  showStatusText?: boolean;
  pulseIntensity?: number;
  animationDuration?: number;
}

type TallyState = 'program' | 'preview' | 'standby';

const TallySystemAdvanced: React.FC<TallySystemAdvancedProps> = ({
  programInput,
  previewInput,
  myInputNumber,
  children,
  showStatusText = true,
  pulseIntensity = 1,
  animationDuration = 0.3
}) => {
  const [currentState, setCurrentState] = useState<TallyState>('standby');
  const [previousState, setPreviousState] = useState<TallyState>('standby');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const borderRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 탤리 상태 결정
  useEffect(() => {
    if (!myInputNumber) {
      setCurrentState('standby');
      return;
    }

    let newState: TallyState = 'standby';
    
    if (myInputNumber === programInput) {
      newState = 'program';
    } else if (myInputNumber === previewInput) {
      newState = 'preview';
    }

    if (newState !== currentState) {
      setPreviousState(currentState);
      setCurrentState(newState);
      setIsTransitioning(true);
      
      // 상태 변경 시 플래시 효과
      if (newState === 'program' || (currentState === 'program' && newState !== 'program')) {
        triggerFlash();
      }
      
      // 상태 변경 시 촉각 피드백
      if (newState === 'program') {
        triggerVibration([200, 100, 200]);
      } else if (newState === 'preview') {
        triggerVibration([100]);
      }
      
      // 상태 변경 시 오디오 피드백
      playStateChangeSound(newState);
      
      // 트랜지션 완료 후 플래그 리셋
      setTimeout(() => {
        setIsTransitioning(false);
      }, animationDuration * 1000);
    }
  }, [myInputNumber, programInput, previewInput, currentState, animationDuration]);

  // 플래시 효과 트리거
  const triggerFlash = () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
  };

  // 진동 피드백
  const triggerVibration = (pattern: number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // 오디오 피드백
  const playStateChangeSound = (state: TallyState) => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext not supported');
        return;
      }
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // 상태별 다른 사운드
    switch (state) {
      case 'program':
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        break;
      case 'preview':
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        break;
      case 'standby':
        oscillator.frequency.setValueAtTime(400, ctx.currentTime);
        break;
    }
    
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  };

  // 애니메이션 설정
  const getAnimationProps = () => {
    const baseProps = {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { 
        duration: animationDuration,
        ease: "easeInOut"
      }
    };

    switch (currentState) {
      case 'program':
        return {
          ...baseProps,
          animate: { 
            ...baseProps.animate,
            boxShadow: [
              "0 0 0 rgba(255, 0, 0, 0.8)",
              "0 0 30px rgba(255, 0, 0, 0.8)",
              "0 0 0 rgba(255, 0, 0, 0.8)"
            ]
          },
          transition: {
            ...baseProps.transition,
            boxShadow: {
              repeat: Infinity,
              duration: 1.5 * pulseIntensity,
              ease: "easeInOut"
            }
          }
        };
      case 'preview':
        return {
          ...baseProps,
          animate: { 
            ...baseProps.animate,
            boxShadow: [
              "0 0 0 rgba(0, 255, 0, 0.6)",
              "0 0 20px rgba(0, 255, 0, 0.6)",
              "0 0 0 rgba(0, 255, 0, 0.6)"
            ]
          },
          transition: {
            ...baseProps.transition,
            boxShadow: {
              repeat: Infinity,
              duration: 2 * pulseIntensity,
              ease: "easeInOut"
            }
          }
        };
      default:
        return baseProps;
    }
  };

  // 상태 텍스트 가져오기
  const getStateText = () => {
    switch (currentState) {
      case 'program':
        return '🔴 ON AIR';
      case 'preview':
        return '🟢 PREVIEW';
      default:
        return '⚪ STANDBY';
    }
  };

  // 상태별 클래스 가져오기
  const getStateClass = () => {
    return `tally-advanced-${currentState}`;
  };

  return (
    <div className={`tally-advanced-container ${getStateClass()}`}>
      {/* 플래시 오버레이 */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            className="tally-flash-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>

      {/* 메인 탤리 컨테이너 */}
      <motion.div
        className="tally-advanced-main"
        {...getAnimationProps()}
      >
        {/* 테두리 애니메이션 */}
        <div ref={borderRef} className="tally-border-animation" />
        
        {/* 코너 마커 */}
        <div className="tally-corner-markers">
          <div className="corner-marker top-left" />
          <div className="corner-marker top-right" />
          <div className="corner-marker bottom-left" />
          <div className="corner-marker bottom-right" />
        </div>

        {/* 상태 표시 오버레이 */}
        {showStatusText && (
          <motion.div
            className="tally-status-overlay"
            key={currentState}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="tally-status-text">
              {getStateText()}
            </div>
            {myInputNumber && (
              <div className="tally-camera-number">
                CAM {myInputNumber}
              </div>
            )}
          </motion.div>
        )}

        {/* 파형 애니메이션 (ON AIR 상태에서만) */}
        {currentState === 'program' && (
          <div className="tally-waveform">
            {Array.from({ length: 20 }, (_, i) => (
              <motion.div
                key={i}
                className="wave-bar"
                animate={{ 
                  height: ['20%', '80%', '20%'],
                  backgroundColor: ['#ff0000', '#ff4444', '#ff0000']
                }}
                transition={{ 
                  duration: 0.5 + (i * 0.05),
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        )}

        {/* 자식 컴포넌트 */}
        <div className="tally-content">
          {children}
        </div>

        {/* 상태 전환 표시기 */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              className="tally-transition-indicator"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="transition-arrow">
                {previousState === 'standby' && currentState === 'preview' && '🔄'}
                {previousState === 'preview' && currentState === 'program' && '🚀'}
                {previousState === 'program' && currentState === 'standby' && '⏹️'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 하단 상태 바 */}
      <div className="tally-status-bar">
        <div className="status-indicators">
          <div className={`indicator ${currentState === 'program' ? 'active' : ''}`}>
            <div className="indicator-dot program" />
            <span>PGM</span>
          </div>
          <div className={`indicator ${currentState === 'preview' ? 'active' : ''}`}>
            <div className="indicator-dot preview" />
            <span>PVW</span>
          </div>
          <div className={`indicator ${currentState === 'standby' ? 'active' : ''}`}>
            <div className="indicator-dot standby" />
            <span>STB</span>
          </div>
        </div>
        
        {myInputNumber && (
          <div className="camera-info">
            <span className="camera-label">Camera {myInputNumber}</span>
            <div className="signal-strength">
              <div className="signal-bar" />
              <div className="signal-bar" />
              <div className="signal-bar" />
              <div className="signal-bar" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TallySystemAdvanced;