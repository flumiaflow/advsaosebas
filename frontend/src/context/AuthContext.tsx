import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api, setAccessToken } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const initAuth = async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      if (data.user) {
        setUser(data.user);
      } else {
        const userRes = await api.get('/auth/me').catch(() => null);
        if (userRes) setUser(userRes.data?.user || userRes.data);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, initAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
