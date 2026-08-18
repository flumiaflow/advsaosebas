import { Request, Response } from 'express';
import { prisma } from '../config/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { logAuditAction } from '../middlewares/auditLogger';

export async function getUsers(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    // Apenas supervisor pode criar usuários
    if (req.user?.role !== 'supervisor') {
      return res.status(403).json({ error: 'Apenas supervisores podem criar usuários' });
    }

    const { name, email, role } = req.body;

    if (!name || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'Email já cadastrado na plataforma' });

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        tenantId,
        name,
        email,
        role: role === 'supervisor' ? 'supervisor' : 'user',
        passwordHash,
        mustChangePassword: true
      }
    });

    // TODO: Send Email
    console.log(`[EMAIL MOCK] Novo usuário: ${newUser.name}. Login: ${newUser.email} / Senha Provisória: ${tempPassword}`);

    await logAuditAction({
      tenantId,
      userId: req.user.userId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      metadata: { role: newUser.role, email: newUser.email }
    });

    return res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor') {
      return res.status(403).json({ error: 'Apenas supervisores podem editar usuários' });
    }

    // Não pode editar a si mesmo
    if (req.user.userId === id) {
      return res.status(403).json({ error: 'Você não pode alterar seu próprio perfil por aqui. Use a tela Meu Perfil.' });
    }

    const { name, email, role, isActive } = req.body;

    const userToEdit = await prisma.user.findUnique({ where: { id } });
    if (!userToEdit || userToEdit.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se estiver removendo o supervisor ou desativando
    if ((role === 'user' && userToEdit.role === 'supervisor') || isActive === false) {
      const activeSupervisorsCount = await prisma.user.count({
        where: { tenantId, role: 'supervisor', isActive: true }
      });

      if (activeSupervisorsCount <= 1 && userToEdit.role === 'supervisor') {
        return res.status(409).json({ error: 'Não é possível remover ou desativar o último supervisor ativo do escritório.' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, email, role, isActive }
    });

    await logAuditAction({
      tenantId,
      userId: req.user.userId,
      action: isActive === false && userToEdit.isActive ? 'USER_DEACTIVATED' : 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { role, email, isActive }
    });

    return res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}
