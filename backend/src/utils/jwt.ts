import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  tenantId: string | null;
  role: string;
  jti: string; // unique token id
  isImpersonating?: boolean;
  originalRole?: string;
}

export function generateTokens(userId: string, tenantId: string | null, role: string, isImpersonating?: boolean, originalRole?: string) {
  // Generate a random jti (JWT ID)
  const jti = require('crypto').randomUUID();
  
  const payload: TokenPayload = { userId, tenantId, role, jti, isImpersonating, originalRole };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  
  return { accessToken, refreshToken, jti };
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
