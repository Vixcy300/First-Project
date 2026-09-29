import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

export interface WebSocketEvent {
  type: string;
  data?: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  addListener: (listener: (event: WebSocketEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastEvent: null,
  addListener: () => () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<(event: WebSocketEvent) => void>>(new Set());
  const reconnectTimeoutRef = useRef<any>(null);

  const addListener = useCallback((listener: (event: WebSocketEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = (window.location.hostname === 'localhost' || !window.location.hostname) ? '127.0.0.1' : window.location.hostname;
    const wsUrl = `${protocol}//${host}:8000/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(parsed);
          listenersRef.current.forEach((fn) => fn(parsed));
        } catch {
          // Plain text message like "pong"
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Attempt reconnection after 3 seconds
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = () => {
        setIsConnected(false);
        socket.close();
      };
    } catch {
      setIsConnected(false);
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    // Heartbeat ping every 25 seconds
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send('ping');
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastEvent, addListener }}>
      {children}
    </WebSocketContext.Provider>
  );
};

