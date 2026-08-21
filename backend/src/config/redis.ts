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
  await redisClient.set(`jwt_bl:${jti}`, 'true', { EX: expInSeconds }).catch(() => {});
}

export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!redisClient || !redisClient.isOpen) return;
  if (ttlSeconds > 0) {
    await redisClient.set(`jwt_bl:${jti}`, 'true', { EX: ttlSeconds }).catch(() => {});
  }
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) return false;
  try {
    const exists = await redisClient.get(`jwt_bl:${jti}`);
    if (exists === 'true') return true;
    const legacy2 = await redisClient.get(`blacklist:${jti}`);
    return legacy2 === 'true';
  } catch {
    return false;
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient || !redisClient.isOpen) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
  if (!redisClient || !redisClient.isOpen) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    // Falha silenciosa em cache
  }
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redisClient || !redisClient.isOpen) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    // Falha silenciosa
  }
}

