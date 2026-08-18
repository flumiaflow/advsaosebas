import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { Bell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotificationBadge() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Inicializa a conexão WS e os toasts
  useSocket();

  const { data: notificationsData, refetch } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread');
      // Esperamos { count: number, notifications: any[] } ou um array
      if (Array.isArray(res.data)) {
        return { count: res.data.length, notifications: res.data };
      }
      return res.data;
    },
    enabled: !!user,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all', { until_timestamp: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }
  });

  const unreadCount = notificationsData?.count || (Array.isArray(notificationsData) ? notificationsData.length : 0);
  const notifications = notificationsData?.notifications || (Array.isArray(notificationsData) ? notificationsData : []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: any) => {
    markAsReadMutation.mutate(notif.id);
    setIsOpen(false);
    if (notif.processId) {
      navigate(`/dashboard/processes`); // Ajustado para a rota existente
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'transparent', border: 'none', cursor: 'pointer', 
          display: 'flex', alignItems: 'center', padding: '0.5rem',
          borderRadius: '50%'
        }}
      >
        <Bell size={20} color="var(--color-text-secondary)" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
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
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          width: '320px',
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          zIndex: 50,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-surface)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Notificações</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllAsReadMutation.mutate()}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--color-primary)',
                  fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
                }}
              >
                <Check size={14} /> Lidas
              </button>
            )}
          </div>
          
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nenhuma notificação nova.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map((n: any) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.875rem' }}>{n.title}</p>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{n.message || n.content}</p>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.65rem', opacity: 0.7 }}>
                      {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
