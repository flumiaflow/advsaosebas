declare global {
  namespace Express {
    interface User {
      userId: string;
      tenantId: string | null;
      role: string;
      name?: string;
      isImpersonating?: boolean;
      originalRole?: string;
    }
  }
}

export {};
