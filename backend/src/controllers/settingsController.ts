import { Request, Response } from 'express';
import { prisma } from '../config/db';
import crypto from 'crypto';
import { logAuditAction } from '../middlewares/auditLogger';

const ALGORITHM = 'aes-256-gcm';

// Helpers de criptografia para as chaves AES-256-GCM
// É necessário que o env.API_KEY_SECRET tenha exatamente 32 bytes (256 bits).
function getSecretKey(): Buffer {
  const secret = process.env.API_KEY_SECRET || process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  if (Buffer.from(secret, 'utf8').length === 32) {
    return Buffer.from(secret, 'utf8');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return { encrypted, iv: iv.toString('hex'), authTag };
}

export async function getSettings(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        timezone: true,
        apiKeyJudit: true,
        apiKeyEscavador: true,
      }
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    // Mascara as chaves
    const maskKey = (key: string | null) => key ? '••••••••' + key.slice(-4) : '';

    return res.status(200).json({
      name: tenant.name,
      timezone: tenant.timezone,
      hasJuditKey: !!tenant.apiKeyJudit,
      juditKeyMasked: maskKey(tenant.apiKeyJudit),
      hasEscavadorKey: !!tenant.apiKeyEscavador,
      escavadorKeyMasked: maskKey(tenant.apiKeyEscavador)
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor') {
      return res.status(403).json({ error: 'Apenas supervisores podem editar as configurações do escritório' });
    }

    const { name, timezone } = req.body;

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { name, timezone }
      }),
      // Atualiza o timezone do sync_config para acompanhar
      prisma.syncConfig.updateMany({
        where: { tenantId },
        data: { timezone }
      })
    ]);

    await logAuditAction({
      tenantId,
      userId: req.user!.userId,
      action: 'SETTINGS_UPDATED',
      metadata: { name, timezone }
    });

    return res.status(200).json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
}

export async function updateApiKeys(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor') {
      return res.status(403).json({ error: 'Apenas supervisores podem editar as API Keys' });
    }

    const { juditKey, escavadorKey } = req.body;

    const data: any = {};

    if (juditKey !== undefined) {
      if (juditKey.trim() === '') {
        data.apiKeyJudit = null;
        data.apiKeyJuditIv = null;
      } else {
        const { encrypted, iv, authTag } = encrypt(juditKey);
        // O banco de dados no schema.prisma salva `apiKeyJudit` e `apiKeyJuditIv`
        // Vamos guardar o encrypted junto com a tag no campo apiKeyJudit no formato "authTag:encrypted"
        data.apiKeyJudit = `${authTag}:${encrypted}`;
        data.apiKeyJuditIv = iv;
      }
    }

    if (escavadorKey !== undefined) {
      if (escavadorKey.trim() === '') {
        data.apiKeyEscavador = null;
        data.apiKeyEscavadorIv = null;
      } else {
        const { encrypted, iv, authTag } = encrypt(escavadorKey);
        data.apiKeyEscavador = `${authTag}:${encrypted}`;
        data.apiKeyEscavadorIv = iv;
      }
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data
    });

    await logAuditAction({
      tenantId,
      userId: req.user!.userId,
      action: 'API_KEYS_UPDATED'
    });

    return res.status(200).json({ message: 'Chaves atualizadas com sucesso' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('API_KEY_SECRET')) {
       return res.status(500).json({ error: 'Servidor não configurado para criptografia (API_KEY_SECRET ausente).' });
    }
    console.error('Error updating api keys:', error);
    return res.status(500).json({ error: 'Erro ao atualizar chaves' });
  }
}
