import { Request, Response } from 'express';
import { prisma } from '../config/db';

// Listar todos os escritórios (Super Admin)
export async function getTenants(req: Request, res: Response) {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return res.status(500).json({ error: 'Erro ao buscar escritórios' });
  }
}

// Obter detalhes de um escritório
export async function getTenantById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } }
      }
    });
    
    if (!tenant) return res.status(404).json({ error: 'Escritório não encontrado' });
    
    return res.status(200).json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return res.status(500).json({ error: 'Erro ao buscar escritório' });
  }
}

// Criar um novo escritório e o Supervisor correspondente (Super Admin)
export async function createTenant(req: Request, res: Response) {
  try {
    const { name, plan, timezone, supervisorName, supervisorEmail } = req.body;
    
    if (!name || !supervisorName || !supervisorEmail) {
      return res.status(400).json({ error: 'Nome do escritório, nome e email do supervisor são obrigatórios' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: supervisorEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'O email do supervisor já está em uso' });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Gerar senha provisória aleatória
    const tempPassword = require('crypto').randomBytes(8).toString('hex');
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Carregar configuração padrão de sincronização do sistema
    const globalSetting = await prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_SYNC_CONFIG' }
    });
    const defaultSync = (globalSetting?.value as any) || {
      daysOfWeek: [1, 2, 3, 4, 5],
      times: ['07:00'],
      timezone: 'America/Sao_Paulo',
      onlyActiveClients: true,
      tribunalTypes: [],
      isActive: true
    };

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          plan: plan || 'trial',
          status: 'active',
          timezone: timezone || 'America/Sao_Paulo',
          trialEndsAt
        }
      });

      const supervisor = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: supervisorName,
          email: supervisorEmail,
          passwordHash,
          role: 'supervisor',
          mustChangePassword: true
        }
      });

      // Provisiona o SyncConfig herdando os padrões globais
      const syncConfig = await tx.syncConfig.create({
        data: {
          tenantId: tenant.id,
          daysOfWeek: defaultSync.daysOfWeek || [1, 2, 3, 4, 5],
          times: defaultSync.times || ['07:00'],
          timezone: tenant.timezone || defaultSync.timezone || 'America/Sao_Paulo',
          onlyActiveClients: defaultSync.onlyActiveClients !== undefined ? defaultSync.onlyActiveClients : true,
          tribunalTypes: defaultSync.tribunalTypes || [],
          isActive: defaultSync.isActive !== undefined ? defaultSync.isActive : true
        }
      });

      return { tenant, supervisor, syncConfig, tempPassword };
    });

    // TODO: Disparar e-mail com tempPassword para supervisorEmail
    console.log(`[EMAIL MOCK] Bem-vindo ${result.supervisor.name}! Seu login: ${result.supervisor.email} / Senha: ${result.tempPassword}`);

    return res.status(201).json({
      tenant: result.tenant,
      supervisor: {
        id: result.supervisor.id,
        name: result.supervisor.name,
        email: result.supervisor.email
      }
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return res.status(500).json({ error: 'Erro ao criar escritório' });
  }
}

// Atualizar um escritório
export async function updateTenant(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, plan, status, timezone } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (plan) updateData.plan = plan;
    if (status) {
      updateData.status = status;
      if (status === 'cancelled') updateData.cancelledAt = new Date();
      if (status === 'active' || status === 'suspended') updateData.cancelledAt = null;
    }
    if (timezone) updateData.timezone = timezone;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json(tenant);
  } catch (error) {
    console.error('Error updating tenant:', error);
    return res.status(500).json({ error: 'Erro ao atualizar escritório' });
  }
}

// SMTP Config

export async function getTenantSmtp(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpFrom: true,
        smtpPass: true
      }
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    return res.status(200).json({
      smtpHost: tenant.smtpHost,
      smtpPort: tenant.smtpPort,
      smtpSecure: tenant.smtpSecure,
      smtpUser: tenant.smtpUser,
      smtpFrom: tenant.smtpFrom,
      hasPassword: !!tenant.smtpPass
    });
  } catch (error) {
    console.error('getTenantSmtp error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function updateTenantSmtp(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom } = req.body;

    const data: any = {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpFrom
    };

    if (smtpPass) {
      const { encrypt } = await import('../utils/crypto');
      data.smtpPass = encrypt(smtpPass);
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data
    });

    return res.status(200).json({ message: 'Configurações de SMTP atualizadas' });
  } catch (error) {
    console.error('updateTenantSmtp error:', error);
    return res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
}

export async function testTenantSmtp(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }
    
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom } = req.body;
    
    // If no pass in body, get from DB
    let password = smtpPass;
    if (!password) {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant?.smtpPass) {
        const { decrypt } = await import('../utils/crypto');
        password = decrypt(tenant.smtpPass);
      }
    }

    if (!smtpHost || !smtpPort || !smtpUser || !password) {
      return res.status(400).json({ error: 'Dados incompletos para testar SMTP' });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: password
      }
    });

    await transporter.verify();

    const mailOptions = {
      from: smtpFrom || smtpUser,
      to: req.user!.email,
      subject: 'JurisWatch - Teste de Configuração SMTP',
      text: 'Sua configuração de envio de e-mails está funcionando perfeitamente!',
      html: '<h3>JurisWatch</h3><p>Sua configuração de envio de e-mails está funcionando perfeitamente!</p>'
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'Conexão bem sucedida. Email de teste enviado.' });
  } catch (error: any) {
    console.error('testTenantSmtp error:', error);
    return res.status(400).json({ error: 'Falha na conexão SMTP: ' + (error.message || 'Verifique as credenciais') });
  }
}

