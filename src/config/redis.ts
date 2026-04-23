import Redis from 'ioredis';
import { logger } from '../shared/utils/logger';
import { env } from './env';

// Redis client for caching and general operations
export const redisClient = new Redis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Redis client for pub/sub (separate connection required)
export const redisPub = new Redis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true,
});

export const redisSub = new Redis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true,
});

// Connect to Redis
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    await redisPub.connect();
    await redisSub.connect();
    logger.info('OK - Redis connected successfully');
  } catch (error) {
    logger.error('ERROR - Redis connection failed:', error);
    logger.warn('WARNING -  Running without Redis - some features will be disabled');
    // Don't throw - allow app to run without Redis for development
  }
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
  await redisPub.quit();
  await redisSub.quit();
  logger.info('Redis disconnected');
}

// Health check
export async function isRedisHealthy(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redisClient.setex(key, ttlSeconds, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache del error:', error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      return (await redisClient.exists(key)) === 1;
    } catch {
      return false;
    }
  },

  async setWithExpiry(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.set(key, value, ttlSeconds);
  },
};

// Presence cache (online users)
export const presenceCache = {
  async setOnline(userId: string): Promise<void> {
    await redisClient.sadd('online_users', userId);
    await redisClient.setex(`user:${userId}:last_seen`, 300, Date.now().toString());
  },

  async setOffline(userId: string): Promise<void> {
    await redisClient.srem('online_users', userId);
    await redisClient.setex(`user:${userId}:last_seen`, 86400, Date.now().toString());
  },

  async getOnlineUsers(): Promise<string[]> {
    return await redisClient.smembers('online_users');
  },

  async isOnline(userId: string): Promise<boolean> {
    return (await redisClient.sismember('online_users', userId)) === 1;
  },

  async getLastSeen(userId: string): Promise<number | null> {
    const lastSeen = await redisClient.get(`user:${userId}:last_seen`);
    return lastSeen ? parseInt(lastSeen) : null;
  },
};

// Typing indicator cache
export const typingCache = {
  async setTyping(conversationId: string, userId: string): Promise<void> {
    await redisClient.sadd(`typing:${conversationId}`, userId);
    await redisClient.expire(`typing:${conversationId}`, 10); // Auto-expire after 10s
  },

  async removeTyping(conversationId: string, userId: string): Promise<void> {
    await redisClient.srem(`typing:${conversationId}`, userId);
  },

  async getTypingUsers(conversationId: string): Promise<string[]> {
    return await redisClient.smembers(`typing:${conversationId}`);
  },
};

export default redisClient;
