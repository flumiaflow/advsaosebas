export interface User {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: 'super_admin' | 'supervisor' | 'user';
  mustChangePassword?: boolean;
  googleId?: string | null;
  isImpersonating?: boolean;
  originalRole?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'trial' | 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  trialEndsAt?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  description?: string;
  isRead: boolean;
  processId?: string;
  movementId?: string;
  createdAt: string;
}
