import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { Briefcase, Building2, Plus } from 'lucide-react';

const Clients: React.FC = () => {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return res.data;
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-outfit font-semibold text-white">Empresas Monitoradas</h1>
          <p className="text-sm text-text-secondary">Gestão de empresas e seus CNPJs raiz/filiais</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Cadastrar Empresa
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-text-secondary">Carregando empresas...</div>
      ) : clients.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-white/20">
          <Briefcase className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-outfit text-white mb-2">Nenhuma empresa monitorada</h2>
          <p className="text-sm text-text-secondary">Cadastre sua primeira empresa para começarmos a buscar os processos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map((client: any) => (
            <div key={client.id} className="glass-panel p-6 flex flex-col justify-between group cursor-pointer hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 border border-white/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-outfit font-bold text-white group-hover:text-primary transition-colors">{client.name}</h3>
                    <p className="text-xs text-text-secondary uppercase tracking-wider">{client.fantasyName || 'Matriz Principal'}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white font-outfit">{client._count?.establishments || 0}</span>
                  <span className="text-xs text-text-secondary uppercase tracking-wider">CNPJs Ativos</span>
                </div>
                <button className="text-sm font-medium text-primary hover:text-primary-hover">Gerenciar CNPJs &rarr;</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clients;
