import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

const useRedis = process.env.NO_REDIS !== 'true';

redisClient.on('error', (err) => console.log('Redis Client Error', err));

export async function connectRedis() {
  if (useRedis && !redisClient.isOpen) {
    await redisClient.connect().catch(console.error);
  }
}

export async function addToBlacklist(jti: string, expInSeconds: number) {
  if (!useRedis) return;
  await redisClient.set(`bl_${jti}`, 'true', { EX: expInSeconds });
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!useRedis) return false;
  const exists = await redisClient.get(`bl_${jti}`);
  return exists === 'true';
}

export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!useRedis) return;
  if (ttlSeconds > 0) {
    await redisClient.setEx(`blacklist:${jti}`, ttlSeconds, 'true');
  }
}
