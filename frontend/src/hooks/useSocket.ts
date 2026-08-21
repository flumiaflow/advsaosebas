import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { getAccessToken } from '../services/api';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

export function useSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    // Connect to backend WS
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || apiUrl.replace(/\/api\/?$/, '');
    
    const newSocket = io(socketBaseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        token
      },
      query: {
        token
      }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket Connected');
    });

    newSocket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket Connect Error:', err.message);
    });

    newSocket.on('notification:new', (payload) => {
      // Toast Notification (Módulo D)
      toast.success(payload.title || 'Nova Notificação Recebida!', {
        duration: 4000,
        position: 'top-right',
      });
      
      // Invalidate queries to update unread count
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, queryClient]);

  return socket;
}
