import http from 'http';

import { app } from './app';
import { env } from './config/env';
import { connectMongo } from './db/mongo';
import { connectMongoStub } from './db/mongo-stub';
import { initSocket } from './modules/socket';
import { connectRedis, disconnectRedis, isRedisHealthy } from './config/redis';
import { closeQueues } from './queues/message.queue';
import { monitorMemory, setupCleanupJobs } from './config/performance';
import { logger } from './shared/utils/logger';

let server: http.Server;

async function bootstrap() {
  logger.info(' Starting Relay Chat Server...');

  await connectMongo();

  // Connect to Redis (non-blocking, app works without Redis)
  try {
    await connectRedis();
    const redisOk = await isRedisHealthy();
    if (redisOk) {
      logger.info('OK - Redis connected - caching and queues enabled');
    } else {
      logger.warn('WARNING -  Redis unhealthy - running in degraded mode');
    }
  } catch (error) {
    logger.warn('WARNING -  Redis connection failed - running without caching');
    logger.warn('WARNING -  Features disabled: message queue, presence cache, rate limiting');
  }

  // 1️⃣ Create HTTP server from Express
  server = http.createServer(app);

  // 2️⃣ Attach Socket.IO to SAME server
  initSocket(server);

  // 3️⃣ Start listening
  server.listen(env.PORT, () => {
    logger.info(` Server running on port ${env.PORT}`);
    logger.info(` Frontend URL: ${env.ALLOWED_ORIGINS.split(',')[0].trim()}`);
  });

  // 4️⃣ Start performance monitoring
  if (env.NODE_ENV !== 'production') {
    monitorMemory();
  }

  // 5️⃣ Setup cleanup jobs
  setupCleanupJobs();

  // 6️⃣ Graceful shutdown
  setupGracefulShutdown();
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      // Close HTTP server (stop accepting new connections)
      server.close(() => {
        logger.info('OK - HTTP server closed');
      });

      // Close Redis connections
      try {
        await disconnectRedis();
        logger.info('OK - Redis disconnected');
      } catch (error) {
        logger.error('Failed to disconnect Redis:', error);
      }

      // Close message queues
      try {
        await closeQueues();
        logger.info('OK - Message queues closed');
      } catch (error) {
        logger.error('Failed to close queues:', error);
      }

      // Give ongoing requests time to finish (10 seconds max)
      setTimeout(() => {
        logger.info('OK - Graceful shutdown complete');
        process.exit(0);
      }, 10000);
    });
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('ERROR - Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('ERROR - Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

bootstrap();
