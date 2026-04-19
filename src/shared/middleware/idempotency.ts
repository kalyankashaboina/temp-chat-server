import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../../config/redis';
import { logger } from '../utils/logger';

const IDEMPOTENCY_TTL = 86400; // 24 hours

/**
 * Idempotency middleware to prevent duplicate requests
 * Client must send X-Idempotency-Key header (UUID)
 */
export const idempotency = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    // Skip if no idempotency key provided
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format (should be UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return res.status(400).json({
        error: 'Invalid idempotency key format. Must be UUID.',
      });
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    try {
      // Check if request already processed
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        logger.info(`Idempotent request detected: ${idempotencyKey}`);
        const parsed = JSON.parse(cachedResponse);
        return res.status(parsed.status).json(parsed.body);
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);

      res.json = function (body: any) {
        // Cache the response
        const responseData = {
          status: res.statusCode,
          body: body,
        };

        redisClient
          .setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(responseData))
          .catch((err: Error) => logger.error('Failed to cache idempotent response:', err));

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error:', error);
      // Continue without idempotency if Redis fails
      next();
    }
  };
};

/**
 * Socket.IO idempotency for messages
 */
export class SocketIdempotency {
  /**
   * Check if message with this ID was already processed
   */
  static async isDuplicate(messageId: string): Promise<boolean> {
    try {
      const key = `message:processed:${messageId}`;
      const exists = await redisClient.exists(key);

      if (exists) {
        logger.warn(`Duplicate message detected: ${messageId}`);
        return true;
      }

      // Mark as processed (expire after 24 hours)
      await redisClient.setex(key, IDEMPOTENCY_TTL, '1');
      return false;
    } catch (error) {
      logger.error('Socket idempotency check failed:', error);
      return false; // Allow message if Redis fails
    }
  }

  /**
   * Mark message as processed
   */
  static async markProcessed(messageId: string): Promise<void> {
    try {
      await redisClient.setex(`message:processed:${messageId}`, IDEMPOTENCY_TTL, '1');
    } catch (error) {
      logger.error('Failed to mark message as processed:', error);
    }
  }

  /**
   * Check and mark in one atomic operation
   */
  static async checkAndMark(messageId: string): Promise<boolean> {
    try {
      const key = `message:processed:${messageId}`;

      // SET NX (set if not exists) with expiry
      const result = await redisClient.set(key, '1', 'EX', IDEMPOTENCY_TTL, 'NX');

      // If result is null, key already existed (duplicate)
      if (result === null) {
        logger.warn(`Duplicate message blocked: ${messageId}`);
        return true; // Is duplicate
      }

      return false; // Not duplicate, marked as processed
    } catch (error) {
      logger.error('Idempotency check failed:', error);
      return false; // Allow on error
    }
  }
}

/**
 * Rate limiting with Redis
 */
export class RateLimiter {
  /**
   * Check if user exceeded rate limit
   * @param key - Unique identifier (userId, IP, etc.)
   * @param limit - Max requests
   * @param windowSeconds - Time window
   */
  static async isLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const redisKey = `ratelimit:${key}`;

      // Increment counter
      const current = await redisClient.incr(redisKey);

      // Set expiry on first request
      if (current === 1) {
        await redisClient.expire(redisKey, windowSeconds);
      }

      // Check if limit exceeded
      if (current > limit) {
        logger.warn(`Rate limit exceeded for: ${key}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return false; // Allow on error
    }
  }

  /**
   * Get remaining requests
   */
  static async getRemaining(key: string, limit: number): Promise<number> {
    try {
      const redisKey = `ratelimit:${key}`;
      const current = await redisClient.get(redisKey);
      const used = current ? parseInt(current) : 0;
      return Math.max(0, limit - used);
    } catch {
      return limit;
    }
  }
}

export default idempotency;
