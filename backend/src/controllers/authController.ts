import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db';
import { generateTokens, verifyToken, verifyRefreshToken } from '../utils/jwt';
import { blacklistToken } from '../config/redis';
import { logAuditAction } from '../middlewares/auditLogger';

export async function refresh(req: Request, res: Response) {
  try {
    console.log('[Refresh] Headers:', req.headers.cookie);
    console.log('[Refresh] Cookies:', req.cookies);
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      console.log('[Refresh] No refresh token');
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    console.log('[Refresh] Verifying token...');
    const decoded = verifyRefreshToken(refreshToken) as any;
    if (!decoded) {
      console.log('[Refresh] Decode failed');
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    console.log('[Refresh] Fetching user...', decoded.userId);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      console.log('[Refresh] User invalid or inactive', user);
      return res.status(401).json({ error: 'Usuário inválido' });
    }
    
    console.log('[Refresh] Generating tokens...');
    const tokens = generateTokens(user.id, user.tenantId, user.role);
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true, // Always true for localhost exception
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    console.log('[Refresh] Returning 200 OK');
    return res.status(200).json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    console.error('[Refresh] Catch error:', error);
    return res.status(401).json({ error: 'Sessão expirada' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user || !user.passwordHash || !user.isActive) {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário inativo' });
    }

    if (user.tenantId && user.tenant?.status === 'suspended') {
      return res.status(402).json({ error: 'Escritório suspenso. Entre em contato com o suporte.' });
    }

    if (user.tenantId && user.tenant?.status === 'cancelled') {
      return res.status(403).json({ error: 'Escritório cancelado.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const { accessToken, refreshToken, jti } = generateTokens(user.id, user.tenantId, user.role);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    await logAuditAction({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'USER_LOGIN',
      metadata: { email: user.email }
    });

    // Refresh token via httpOnly cookie per architectural plan
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });

    return res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyToken(token);
        // Blacklist token based on its remaining TTL (approximate 15m)
        await blacklistToken(decoded.jti, 15 * 60);
      } catch (e) {
        // Token might already be expired, ignore
      }
    }
    
    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });
    
    // Ler os campos do payload do token customizado que o middleware de auth adiciona no req.user
    const isImpersonating = (req.user as any).isImpersonating || false;
    const originalRole = (req.user as any).originalRole || null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        isActive: true,
        mustChangePassword: true,
        tenant: {
          select: {
            name: true,
            status: true,
            plan: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({ 
      user: {
        ...user,
        isImpersonating,
        originalRole
      }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Se o usuário só tiver Google e não tiver password_hash, não deixamos resetar senha via email
    // Retornamos 200 silencioso em caso de não encontrado ou erro de fluxo, por segurança (evitar enumeração)
    if (!user || (!user.passwordHash && user.googleId)) {
      return res.status(200).json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
    }

    const token = require('crypto').randomUUID();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // 2 hours valid

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // TODO: Enviar E-mail real via Resend / AWS SES
    console.log(`[EMAIL MOCK] Reset password token para ${email}: ${token}`);

    return res.status(200).json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });

    // Busca tokens não usados
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    let matchedToken = null;
    for (const t of resetTokens) {
      const isMatch = await bcrypt.compare(token, t.tokenHash);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualiza a senha e invalida o token atomicamente
    await prisma.$transaction([
      prisma.user.update({
        where: { id: matchedToken.userId },
        data: { passwordHash, mustChangePassword: false }
      }),
      prisma.passwordResetToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() }
      })
    ]);

    return res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
export async function changePassword(req: Request, res: Response) {
  try {
    const { newPassword } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Não autorizado' });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { passwordHash, mustChangePassword: false }
    });
    
    return res.status(200).json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}


export async function impersonate(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    
    // Apenas Super Admins podem invadir escritórios
    if (req.user?.role !== 'super_admin' && !(req.user as any)?.originalRole) {
      return res.status(403).json({ error: 'Permissão negada' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Escritório não encontrado' });

    // Gera um novo Token passando-se por Supervisor do Escritório Alvo
    const { accessToken, refreshToken } = generateTokens(
      req.user.userId, 
      tenantId, 
      'supervisor', 
      true, // isImpersonating
      'super_admin' // originalRole
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1 * 24 * 60 * 60 * 1000 // 1 dia para sessão fantasma
    });

    await logAuditAction({
      tenantId: null, // Logado no contexto do sistema
      userId: req.user.userId,
      action: 'IMPERSONATE_START',
      metadata: { targetTenantId: tenantId, targetTenantName: tenant.name }
    });

    return res.status(200).json({
      accessToken,
      message: `Acessando como administrador do escritório ${tenant.name}`
    });
  } catch (error) {
    console.error('Impersonate error:', error);
    return res.status(500).json({ error: 'Erro ao invadir escritório' });
  }
}

export async function impersonateExit(req: Request, res: Response) {
  try {
    const isImpersonating = (req.user as any).isImpersonating;
    const originalRole = (req.user as any).originalRole;

    if (!isImpersonating || originalRole !== 'super_admin') {
      return res.status(400).json({ error: 'Sessão atual não é uma sessão fantasma' });
    }

    // Retorna ao estado normal (tenantId null, role super_admin)
    const { accessToken, refreshToken } = generateTokens(
      req.user!.userId, 
      null, 
      'super_admin'
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await logAuditAction({
      tenantId: null,
      userId: req.user!.userId,
      action: 'IMPERSONATE_EXIT',
      metadata: { fromTenantId: req.user!.tenantId }
    });

    return res.status(200).json({
      accessToken,
      message: 'Sessão fantasma encerrada. Retornando ao Backoffice.'
    });
  } catch (error) {
    console.error('Impersonate Exit error:', error);
    return res.status(500).json({ error: 'Erro ao encerrar sessão fantasma' });
  }
}
