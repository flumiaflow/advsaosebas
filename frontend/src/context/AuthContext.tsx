import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api, setAccessToken } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Tenta validar a sessão no carregamento inicial via refresh token
    const initAuth = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        // Precisamos dos dados do usuário, decodificamos do token ou buscamos no back
        // Como o JWT tem as infos básicas, o backend de refresh já poderia retornar o usuário
        // Assumindo que o back de refresh retorna { accessToken, user }
        if (data.user) {
          setUser(data.user);
        } else {
          // Se não vier no refresh, buscamos no /settings ou algo similar
          const userRes = await api.get('/auth/me').catch(() => null);
          if (userRes) setUser(userRes.data);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const handleForceLogout = () => {
      setUser(null);
      setAccessToken(null);
      navigate('/login');
    };

    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [navigate]);

  const login = (token: string, userData: User) => {
    setAccessToken(token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {} // Ignora erro no logout
    setUser(null);
    setAccessToken(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
