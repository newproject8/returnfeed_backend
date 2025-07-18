import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketEnhancedOptions {
  url: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: MessageEvent) => void;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionAttempts: number;
  lastError: string | null;
  latency: number;
}

export const useWebSocketEnhanced = ({
  url,
  reconnectAttempts = 10,
  reconnectInterval = 3000,
  heartbeatInterval = 30000,
  heartbeatTimeout = 5000,
  onConnect,
  onDisconnect,
  onReconnect,
  onError,
  onMessage
}: WebSocketEnhancedOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingStartTimeRef = useRef<number>(0);
  const isManualCloseRef = useRef<boolean>(false);
  const messageQueueRef = useRef<string[]>([]);
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    connectionAttempts: 0,
    lastError: null,
    latency: 0
  });

  // WebSocket 연결 함수
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setState(prev => ({
      ...prev,
      isConnecting: true,
      lastError: null
    }));

    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket 연결 성공');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          connectionAttempts: 0,
          lastError: null
        }));
        
        // 대기 중인 메시지 전송
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          if (message && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(message);
          }
        }
        
        // 하트비트 시작
        startHeartbeat();
        
        if (state.isReconnecting) {
          onReconnect?.();
        } else {
          onConnect?.();
        }
      };

      wsRef.current.onmessage = (event) => {
        // 핑/퐁 메시지 처리
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            const latency = Date.now() - pingStartTimeRef.current;
            setState(prev => ({ ...prev, latency }));
            
            // 하트비트 타이머 리셋
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
            }
            return;
          }
        } catch (e) {
          // JSON 파싱 실패 시 일반 메시지로 처리
        }
        
        onMessage?.(event);
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));
        
        stopHeartbeat();
        
        if (!isManualCloseRef.current && !event.wasClean) {
          // 자동 재연결 시도
          attemptReconnect();
        }
        
        onDisconnect?.();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        
        setState(prev => ({
          ...prev,
          lastError: 'WebSocket 연결 오류',
          isConnecting: false
        }));
        
        onError?.(error);
      };

    } catch (error) {
      console.error('WebSocket 생성 오류:', error);
      setState(prev => ({
        ...prev,
        lastError: 'WebSocket 생성 실패',
        isConnecting: false
      }));
    }
  }, [url, onConnect, onDisconnect, onReconnect, onError, onMessage, state.isReconnecting]);

  // 재연결 시도
  const attemptReconnect = useCallback(() => {
    if (state.connectionAttempts >= reconnectAttempts) {
      console.log('최대 재연결 시도 횟수 초과');
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        lastError: '재연결 실패: 최대 시도 횟수 초과'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isReconnecting: true,
      connectionAttempts: prev.connectionAttempts + 1
    }));

    const delay = Math.min(reconnectInterval * Math.pow(1.5, state.connectionAttempts), 30000);
    console.log(`${delay}ms 후 재연결 시도... (${state.connectionAttempts + 1}/${reconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [state.connectionAttempts, reconnectAttempts, reconnectInterval, connect]);

  // 하트비트 시작
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingStartTimeRef.current = Date.now();
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: pingStartTimeRef.current }));
        
        // 하트비트 응답 타이머 설정
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.log('하트비트 타임아웃 - 연결 재시도');
          wsRef.current?.close(1000, 'Heartbeat timeout');
        }, heartbeatTimeout);
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, heartbeatTimeout]);

  // 하트비트 중지
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // 메시지 전송
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      // 연결되지 않은 경우 큐에 저장
      messageQueueRef.current.push(message);
      
      // 연결 시도
      if (!state.isConnecting && !state.isReconnecting) {
        connect();
      }
    }
  }, [state.isConnecting, state.isReconnecting, connect]);

  // 안전한 JSON 메시지 전송
  const sendJsonMessage = useCallback((data: any) => {
    try {
      const message = JSON.stringify(data);
      sendMessage(message);
    } catch (error) {
      console.error('JSON 직렬화 오류:', error);
    }
  }, [sendMessage]);

  // 연결 강제 재시도
  const forceReconnect = useCallback(() => {
    isManualCloseRef.current = true;
    wsRef.current?.close(1000, 'Manual reconnect');
    
    setState(prev => ({
      ...prev,
      connectionAttempts: 0
    }));
    
    setTimeout(() => {
      isManualCloseRef.current = false;
      connect();
    }, 100);
  }, [connect]);

  // 연결 해제
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
    }
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      connectionAttempts: 0
    }));
  }, [stopHeartbeat]);

  // 컴포넌트 마운트 시 연결
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 페이지 가시성 변경 시 연결 관리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨졌을 때 하트비트 중지
        stopHeartbeat();
      } else {
        // 페이지가 다시 보일 때 연결 확인
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        } else {
          startHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, startHeartbeat, stopHeartbeat]);

  return {
    ...state,
    sendMessage,
    sendJsonMessage,
    forceReconnect,
    disconnect
  };
};

export default useWebSocketEnhanced;