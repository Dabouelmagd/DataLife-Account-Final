import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useRealTimeSync = (onUpdate) => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!user?.company_id || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const fullUrl = `${wsUrl}/api/attachments/ws/sync/${user.company_id}`;

    try {
      wsRef.current = new WebSocket(fullUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            return; // Ignore pong responses
          }

          // Call the update handler
          if (onUpdate) {
            onUpdate(message);
          }

          // Show toast notification for important updates
          if (message.type === 'invoice_created') {
            toast.info('فاتورة جديدة تم إنشاؤها');
          } else if (message.type === 'approval_updated') {
            toast.info('تم تحديث طلب موافقة');
          } else if (message.type === 'purchase_order_updated') {
            toast.info('تم تحديث أمر شراء');
          }
        } catch (e) {
          // Silent error handling for WebSocket messages
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [user?.company_id, onUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Send ping to keep connection alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [sendMessage]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, sendMessage, reconnect: connect };
};

export default useRealTimeSync;
