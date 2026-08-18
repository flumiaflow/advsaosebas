import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';

import BackofficeLayout from './layouts/BackofficeLayout';
import BackofficeDashboard from './pages/Backoffice/Dashboard';
import Tenants from './pages/Backoffice/Tenants';

import WorkspaceLayout from './layouts/WorkspaceLayout';
import WorkspaceDashboard from './pages/Workspace/Dashboard';
import Clients from './pages/Workspace/Clients';
import Processes from './pages/Workspace/Processes';
import Users from './pages/Workspace/Users';
import Audit from './pages/Workspace/Audit';
import Settings from './pages/Workspace/Settings';

import React from 'react';

const queryClient = new QueryClient();

// A simple protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div>Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected routes */}
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      
      {/* Backoffice (Super Admin Only) */}
      <Route path="/backoffice" element={<ProtectedRoute allowedRoles={['super_admin']}><BackofficeLayout /></ProtectedRoute>}>
        <Route index element={<BackofficeDashboard />} />
        <Route path="tenants" element={<Tenants />} />
      </Route>

      {/* Workspace (Supervisor and User) */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['supervisor', 'user']}><WorkspaceLayout /></ProtectedRoute>}>
        <Route index element={<WorkspaceDashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="processes" element={<Processes />} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['supervisor']}><Users /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute allowedRoles={['supervisor']}><Audit /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={['supervisor']}><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App;
