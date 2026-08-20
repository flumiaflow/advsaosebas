import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const useRedis = process.env.NO_REDIS !== 'true' && Boolean(process.env.REDIS_ENABLED === 'true');

export const redisClient = useRedis
  ? createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' })
  : null as any;

if (redisClient) {
  redisClient.on('error', (err: any) => {
    // Log silencioso no dev
  });
}

export async function connectRedis() {
  if (redisClient && !redisClient.isOpen) {
    try {
      await redisClient.connect();
      console.log('✅ Connected to Redis successfully');
    } catch (e) {
      console.warn('⚠️ Redis não disponível localmente - operando em modo direto sem cache');
    }
  } else {
    console.log('ℹ️ Operando em modo de banco direto (Supabase)');
  }
}

export async function addToBlacklist(jti: string, expInSeconds: number) {
  if (!redisClient || !redisClient.isOpen) return;
  await redisClient.set(`bl_${jti}`, 'true', { EX: expInSeconds }).catch(() => {});
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) return false;
  try {
    const exists = await redisClient.get(`bl_${jti}`);
    return exists === 'true';
  } catch {
    return false;
  }
}

export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!redisClient || !redisClient.isOpen) return;
  if (ttlSeconds > 0) {
    await redisClient.setEx(`blacklist:${jti}`, ttlSeconds, 'true').catch(() => {});
  }
}
