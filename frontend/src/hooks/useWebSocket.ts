import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url: string) => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  useEffect(() => {
    const connect = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;
      
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        // Aggressive Initial Sync: Request latest state multiple times
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'request_latest_state' }));
            }
          }, i * 250);
        }
      };

      ws.current.onmessage = (event) => {
        setLastMessage(event);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected. Attempting to reconnect...');
        setIsConnected(false);
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        // Exponential backoff could be implemented here
        reconnectTimeout.current = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  return { lastMessage, isConnected };
};