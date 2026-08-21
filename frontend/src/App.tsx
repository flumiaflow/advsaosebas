import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';

import BackofficeLayout from './layouts/BackofficeLayout';
import BackofficeDashboard from './pages/Backoffice/Dashboard';
import Tenants from './pages/Backoffice/Tenants';
import SystemSettings from './pages/Backoffice/SystemSettings';

import WorkspaceLayout from './layouts/WorkspaceLayout';
import WorkspaceDashboard from './pages/Workspace/Dashboard';
import Clients from './pages/Workspace/Clients';
import Processes from './pages/Workspace/Processes';
import Users from './pages/Workspace/Users';
import Audit from './pages/Workspace/Audit';
import Settings from './pages/Workspace/Settings';

import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutos de cache no navegador (evita refetch desnecessário ao mudar de aba)
      gcTime: 1000 * 60 * 10,   // Mantém em memória por 10 minutos
      refetchOnWindowFocus: false, // Não trava a tela ao focar a janela
      retry: 1,
    }
  }
});

import Unauthorized from './pages/Unauthorized';

// A simple protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) return <div>Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  
  if (allowedRoles) {
    const isSuperAdmin = user.role === 'super_admin' || user.isImpersonating || (user as any).originalRole === 'super_admin';
    const isAllowed = isSuperAdmin || allowedRoles.includes(user.role);

    if (!isAllowed) return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      
      {/* Protected routes */}
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      
      {/* Backoffice (Super Admin Only) */}
      <Route path="/backoffice" element={<ProtectedRoute allowedRoles={['super_admin']}><BackofficeLayout /></ProtectedRoute>}>
        <Route index element={<BackofficeDashboard />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="settings" element={<SystemSettings />} />
      </Route>

      {/* Workspace (Supervisor, User, and Super Admin) */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['supervisor', 'user', 'super_admin']}><WorkspaceLayout /></ProtectedRoute>}>
        <Route index element={<WorkspaceDashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="processes" element={<Processes />} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['supervisor', 'super_admin']}><Users /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute allowedRoles={['supervisor', 'super_admin']}><Audit /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={['supervisor', 'super_admin']}><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App;
