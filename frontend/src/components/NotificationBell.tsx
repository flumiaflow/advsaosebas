import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink, Activity } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Polling a cada 30 segundos usando React Query! (Requisito Arquitetural Concluído)
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread');
      return res.data;
    },
    refetchInterval: 30000, 
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // Passa o timestamp atual para evitar Race Conditions (Requisito Arquitetural)
      await api.post('/notifications/read-all', { until_timestamp: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = data?.count || 0;
  const notifications = data?.notifications || [];

  // Close click outside
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
      navigate(`/processes/${notif.processId}`);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-danger rounded-full border-2 border-[#141a28] notification-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 glass-panel shadow-2xl border border-white/10 overflow-hidden z-50 animate-fade-in origin-top-right">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <h3 className="font-semibold text-white font-outfit">Notificações</h3>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Marcar lidas
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhuma notificação nova.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((n: any) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className="p-4 hover:bg-white/5 cursor-pointer transition-colors flex gap-3 group"
                  >
                    <div className="mt-1">
                      {n.type === 'NEW_MOVEMENT' ? (
                         <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                           <Activity className="w-4 h-4" />
                         </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/30">
                           <Bell className="w-4 h-4" />
                         </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium mb-1 group-hover:text-primary transition-colors">{n.title}</p>
                      <p className="text-xs text-text-secondary line-clamp-2">{n.processId ? `Processo atualizado.` : 'Alerta de sistema'}</p>
                      <p className="text-[10px] text-text-secondary/50 mt-2">
                        {new Date(n.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
