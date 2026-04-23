/**
 * Performance Optimizations for Render.com Free Tier
 *
 * Free Tier Limits:
 * - 512 MB RAM
 * - 0.1 CPU
 * - Spins down after 15 min inactivity
 *
 * Optimizations:
 * - MongoDB connection pooling
 * - Redis caching
 * - Async DB writes
 * - Message batching
 * - Compression
 */

import compression from 'compression';
import { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from './env';

/**
 * MongoDB Connection Pool Configuration
 * Optimized for free tier RAM constraints
 */
export const mongooseOptions = {
  maxPoolSize: 5, // Reduced for free tier (default: 10)
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4

  // Memory optimization
  maxIdleTimeMS: 30000,

  // Retry config
  retryWrites: true,
  retryReads: true,

  // Performance
  maxConnecting: 2,
};

/**
 * Redis Connection Configuration
 * Optimized for free tier
 */
export const redisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false, // Don't queue when offline
  connectTimeout: 10000,
  commandTimeout: 5000,

  // Memory optimization
  maxmemory: '100mb',
  maxmemoryPolicy: 'allkeys-lru', // Evict least recently used
};

/**
 * Apply compression middleware
 */
export function setupCompression(app: Express): void {
  app.use(
    compression({
      level: 6, // Balance between speed and size
      threshold: 1024, // Only compress >1KB
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );
}

/**
 * Message batching configuration
 * Group multiple messages into single DB operation
 */
export const batchConfig = {
  maxBatchSize: 10,
  maxWaitMs: 100, // Max wait time before flush
};

/**
 * Cache TTL settings (seconds)
 */
export const cacheTTL = {
  presence: 300, // 5 minutes
  typing: 10, // 10 seconds
  onlineUsers: 60, // 1 minute
  conversation: 300, // 5 minutes
  message: 180, // 3 minutes
  user: 600, // 10 minutes
  idempotency: 86400, // 24 hours
};

/**
 * Rate limiting configuration
 */
export const rateLimits = {
  messages: {
    points: 30, // 30 messages
    duration: 60, // per minute
  },
  api: {
    points: 100, // 100 requests
    duration: 60, // per minute
  },
  auth: {
    points: 5, // 5 attempts
    duration: 300, // per 5 minutes
  },
};

/**
 * Queue worker configuration
 */
export const queueConfig = {
  concurrency: 2, // Process 2 jobs concurrently (free tier limit)
  maxStalledCount: 3,
  stalledInterval: 5000,

  // Job timeouts
  messageJobTimeout: 10000, // 10 seconds
  conversationJobTimeout: 5000, // 5 seconds
  readReceiptJobTimeout: 5000, // 5 seconds
};

/**
 * Socket.IO configuration for free tier
 */
export const socketConfig = {
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1 MB

  // Limit connections for free tier
  maxConnections: 100,

  // Transport priority
  transports: ['websocket', 'polling'],

  // Memory optimization
  perMessageDeflate: false, // Disable compression (CPU intensive)
};

/**
 * Express session configuration
 */
export const sessionConfig = {
  resave: false,
  saveUninitialized: false,

  // Use Redis for sessions (better than in-memory for free tier)
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
};

/**
 * File upload configuration
 */
export const uploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  maxFiles: 5,
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
  ],
};

/**
 * Graceful shutdown configuration
 */
export const shutdownConfig = {
  timeout: 10000, // 10 seconds to clean up
  signals: ['SIGTERM', 'SIGINT'],
};

/**
 * Health check configuration
 */
export const healthCheckConfig = {
  interval: 30000, // Check every 30 seconds
  timeout: 5000, // 5 second timeout
  checks: {
    mongodb: true,
    redis: true,
    memory: true,
  },
};

/**
 * Memory monitoring
 */
export function monitorMemory(): void {
  setInterval(() => {
    const used = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

    console.log('Memory Usage:', {
      rss: `${mb(used.rss)} MB`, // Total memory
      heapTotal: `${mb(used.heapTotal)} MB`,
      heapUsed: `${mb(used.heapUsed)} MB`,
      external: `${mb(used.external)} MB`,
    });

    // Alert if nearing free tier limit (512 MB)
    if (mb(used.rss) > 400) {
      console.warn('WARNING -  Memory usage high: ', `${mb(used.rss)} MB / 512 MB`);
    }
  }, 60000); // Every minute
}

/**
 * Cleanup old data periodically
 */
export function setupCleanupJobs(): void {
  // Clean up old idempotency keys (older than 24h)
  setInterval(async () => {
    console.log(' Running cleanup job...');
    // Implementation would delete old keys
  }, 3600000); // Every hour
}

export default {
  mongooseOptions,
  redisOptions,
  batchConfig,
  cacheTTL,
  rateLimits,
  queueConfig,
  socketConfig,
  sessionConfig,
  uploadConfig,
  shutdownConfig,
  healthCheckConfig,
  setupCompression,
  monitorMemory,
  setupCleanupJobs,
};
