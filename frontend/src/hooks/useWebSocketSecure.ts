import { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

interface WebSocketOptions {
  sessionId?: string;
  role?: string;
}

export const useWebSocketSecure = (baseUrl: string, options?: WebSocketOptions) => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    const connect = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      
      // JWT 토큰을 URL 쿼리 파라미터로 전달하거나
      // 연결 후 첫 메시지로 전달할 수 있습니다
      const urlWithToken = `${baseUrl}?token=${encodeURIComponent(token)}`;
      ws.current = new WebSocket(urlWithToken);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        
        // 세션 등록 메시지 전송 (JWT 포함)
        if (options?.sessionId) {
          ws.current?.send(JSON.stringify({
            type: 'register',
            token: token,
            sessionId: options.sessionId,
            role: options.role || 'viewer'
          }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 인증 성공 메시지 처리
          if (data.type === 'session_registered' && data.authenticated) {
            setIsAuthenticated(true);
            console.log('WebSocket authenticated successfully');
          }
          
          // 에러 메시지 처리
          if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
            if (data.message.includes('auth') || data.message.includes('token')) {
              setIsAuthenticated(false);
            }
          }
        } catch (e) {
          // JSON이 아닌 메시지도 처리
        }
        
        setLastMessage(event);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setIsAuthenticated(false);
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket Disconnected. Code:', event.code, 'Reason:', event.reason);
        setIsConnected(false);
        setIsAuthenticated(false);
        
        // 인증 실패로 인한 종료가 아닌 경우에만 재연결
        if (event.code !== 1008) { // 1008: Policy Violation (인증 실패)
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [baseUrl, token, options?.sessionId, options?.role]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticated) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected or authenticated');
    }
  };

  return { 
    lastMessage, 
    isConnected, 
    isAuthenticated,
    sendMessage
  };
};