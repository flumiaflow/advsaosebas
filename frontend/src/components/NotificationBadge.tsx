import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Bell } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function NotificationBadge() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const { data, refetch } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread');
      // Assume array of unread
      return res.data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data) {
      setUnreadCount(data.length);
    }
  }, [data]);

  useEffect(() => {
    if (!user) return;

    // Conecta ao namespace padrao onde Auth middleware existe se implementado
    // ou apenas raiz
    const newSocket = io('/', {
      path: '/socket.io',
      transports: ['websocket']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WS');
    });

    newSocket.on('notification:new', (payload) => {
      // Toca um som ou mostra um toast discreto aqui
      setUnreadCount(prev => prev + 1);
      refetch();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, refetch]);

  return (
    <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <Bell size={20} color="var(--color-text-secondary)" />
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          backgroundColor: 'var(--color-danger)',
          color: 'white',
          fontSize: '0.65rem',
          fontWeight: 'bold',
          padding: '2px 5px',
          borderRadius: '10px'
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  );
}
