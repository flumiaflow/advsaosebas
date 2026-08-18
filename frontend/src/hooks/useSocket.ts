import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
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

    // Connect to backend WS
    const newSocket = io('http://localhost:4000', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket Connected');
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
