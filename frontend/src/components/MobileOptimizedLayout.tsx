import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import './MobileOptimizedLayout.css';

interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  showControls?: boolean;
  enableGestures?: boolean;
  enableFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
}

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  hasTouch: boolean;
  platform: string;
}

interface GestureState {
  isPressed: boolean;
  startTime: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  velocity: { x: number; y: number };
}

const MobileOptimizedLayout: React.FC<MobileOptimizedLayoutProps> = ({
  children,
  showControls = true,
  enableGestures = true,
  enableFullscreen = true,
  onFullscreenChange,
  onSwipeUp,
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
  onDoubleTap,
  onLongPress
}) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    orientation: 'landscape',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hasTouch: 'ontouchstart' in window,
    platform: navigator.platform
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUIControls, setShowUIControls] = useState(true);
  const [gestureState, setGestureState] = useState<GestureState>({
    isPressed: false,
    startTime: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    velocity: { x: 0, y: 0 }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gestureStartTimeRef = useRef<number>(0);

  // 디바이스 정보 업데이트
  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width <= 768;
      const isTablet = width > 768 && width <= 1024;
      const isDesktop = width > 1024;
      const orientation = width > height ? 'landscape' : 'portrait';

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        orientation,
        screenWidth: width,
        screenHeight: height,
        devicePixelRatio: window.devicePixelRatio || 1,
        hasTouch: 'ontouchstart' in window,
        platform: navigator.platform
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  // 전체화면 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      onFullscreenChange?.(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [onFullscreenChange]);

  // 전체화면 토글
  const toggleFullscreen = useCallback(async () => {
    if (!enableFullscreen || !containerRef.current) return;

    try {
      if (!isFullscreen) {
        // 전체화면 진입
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).mozRequestFullScreen) {
          await (containerRef.current as any).mozRequestFullScreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        }
      } else {
        // 전체화면 해제
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('전체화면 토글 실패:', error);
    }
  }, [enableFullscreen, isFullscreen]);

  // 컨트롤 자동 숨기기
  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    
    setShowUIControls(true);
    
    if (deviceInfo.isMobile) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowUIControls(false);
      }, 3000);
    }
  }, [deviceInfo.isMobile]);

  // 제스처 처리
  const handlePanStart = useCallback((event: any, info: PanInfo) => {
    if (!enableGestures) return;

    const now = Date.now();
    gestureStartTimeRef.current = now;
    
    setGestureState({
      isPressed: true,
      startTime: now,
      startX: info.point.x,
      startY: info.point.y,
      currentX: info.point.x,
      currentY: info.point.y,
      velocity: { x: 0, y: 0 }
    });

    // 길게 누르기 타이머 시작
    if (onLongPress) {
      longPressTimeoutRef.current = setTimeout(() => {
        onLongPress();
      }, 500);
    }

    resetHideControlsTimer();
  }, [enableGestures, onLongPress, resetHideControlsTimer]);

  const handlePan = useCallback((event: any, info: PanInfo) => {
    if (!enableGestures || !gestureState.isPressed) return;

    setGestureState(prev => ({
      ...prev,
      currentX: info.point.x,
      currentY: info.point.y,
      velocity: info.velocity
    }));

    // 길게 누르기 취소 (움직임 감지)
    if (longPressTimeoutRef.current) {
      const distance = Math.sqrt(
        Math.pow(info.point.x - gestureState.startX, 2) +
        Math.pow(info.point.y - gestureState.startY, 2)
      );
      
      if (distance > 10) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  }, [enableGestures, gestureState.isPressed, gestureState.startX, gestureState.startY]);

  const handlePanEnd = useCallback((event: any, info: PanInfo) => {
    if (!enableGestures) return;

    // 길게 누르기 타이머 정리
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    const deltaX = info.point.x - gestureState.startX;
    const deltaY = info.point.y - gestureState.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - gestureState.startTime;

    // 탭 감지 (짧은 시간, 작은 움직임)
    if (duration < 300 && distance < 10) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < 300 && onDoubleTap) {
        // 더블 탭
        onDoubleTap();
        lastTapRef.current = 0;
      } else {
        // 단일 탭
        lastTapRef.current = now;
        resetHideControlsTimer();
      }
    }
    // 스와이프 감지
    else if (distance > 50) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      if (absX > absY) {
        // 가로 스와이프
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // 세로 스와이프
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    setGestureState(prev => ({
      ...prev,
      isPressed: false
    }));
  }, [
    enableGestures,
    gestureState.startX,
    gestureState.startY,
    gestureState.startTime,
    onDoubleTap,
    onSwipeUp,
    onSwipeDown,
    onSwipeLeft,
    onSwipeRight,
    resetHideControlsTimer
  ]);

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen();
          }
          break;
        case 'h':
        case 'H':
          setShowUIControls(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // 스크린 웨이크 락 (모바일에서 화면 꺼짐 방지)
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && deviceInfo.isMobile) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('화면 웨이크 락 활성화');
        } catch (err) {
          console.error('웨이크 락 요청 실패:', err);
        }
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
        console.log('화면 웨이크 락 해제');
      }
    };
  }, [deviceInfo.isMobile]);

  // 레이아웃 클래스 결정
  const getLayoutClasses = () => {
    const classes = ['mobile-optimized-layout'];
    
    if (deviceInfo.isMobile) classes.push('mobile');
    if (deviceInfo.isTablet) classes.push('tablet');
    if (deviceInfo.isDesktop) classes.push('desktop');
    if (deviceInfo.orientation === 'portrait') classes.push('portrait');
    if (deviceInfo.orientation === 'landscape') classes.push('landscape');
    if (isFullscreen) classes.push('fullscreen');
    if (!showUIControls) classes.push('controls-hidden');
    
    return classes.join(' ');
  };

  return (
    <motion.div
      ref={containerRef}
      className={getLayoutClasses()}
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#000',
        userSelect: 'none'
      }}
    >
      {/* 메인 콘텐츠 */}
      <div className="content-area">
        {children}
      </div>

      {/* 모바일 컨트롤 오버레이 */}
      <AnimatePresence>
        {showControls && showUIControls && (
          <motion.div
            className="mobile-controls-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* 상단 컨트롤 바 */}
            <div className="top-controls">
              <div className="device-info">
                <span className="orientation-indicator">
                  {deviceInfo.orientation === 'portrait' ? '📱' : '🖥️'}
                </span>
                <span className="resolution">
                  {deviceInfo.screenWidth}×{deviceInfo.screenHeight}
                </span>
              </div>
              
              {enableFullscreen && (
                <button
                  className="fullscreen-button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? '전체화면 해제' : '전체화면'}
                >
                  {isFullscreen ? '⛶' : '⛶'}
                </button>
              )}
            </div>

            {/* 하단 컨트롤 바 */}
            <div className="bottom-controls">
              <div className="gesture-hints">
                {deviceInfo.hasTouch && (
                  <>
                    <span className="hint">💡 위/아래 스와이프로 밝기 조절</span>
                    <span className="hint">💡 좌/우 스와이프로 카메라 전환</span>
                    <span className="hint">💡 더블 탭으로 전체화면</span>
                  </>
                )}
              </div>
              
              <div className="status-indicators">
                <div className={`connection-status ${gestureState.isPressed ? 'active' : ''}`}>
                  <div className="status-dot" />
                  <span>연결됨</span>
                </div>
                
                <div className="battery-status">
                  {deviceInfo.isMobile && '🔋'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 제스처 피드백 오버레이 */}
      <AnimatePresence>
        {gestureState.isPressed && (
          <motion.div
            className="gesture-feedback"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'absolute',
              left: gestureState.currentX - 25,
              top: gestureState.currentY - 25,
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        )}
      </AnimatePresence>

      {/* 디바이스 정보 디버그 오버레이 (개발 모드에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-overlay">
          <div className="debug-info">
            <div>Device: {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'}</div>
            <div>Orientation: {deviceInfo.orientation}</div>
            <div>Touch: {deviceInfo.hasTouch ? 'Yes' : 'No'}</div>
            <div>Fullscreen: {isFullscreen ? 'Yes' : 'No'}</div>
            <div>DPR: {deviceInfo.devicePixelRatio}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MobileOptimizedLayout;