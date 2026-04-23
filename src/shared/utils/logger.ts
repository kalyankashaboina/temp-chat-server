/**
 * Production-grade Logger using Pino
 * - Fast and reliable logging
 * - Different modes for dev/prod
 * - Windows compatible (no Unicode symbols)
 */

import pino from 'pino';
import { env } from '../../config/env';

const isDevelopment = env.NODE_ENV !== 'production';

// Pino logger instance
const pinoLogger = pino({
  level: env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Development: Pretty print WITHOUT colors/symbols for Windows
  // Production: JSON for log aggregation
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: false, // Disable colors for Windows compatibility
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '[{level}] {msg}',
        },
      }
    : undefined,

  // Timestamp
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Backward-compatible logger wrapper
 * Supports both old API: logger.info(string, ...args)
 * And Pino API: logger.info({ obj }, msg)
 */
class Logger {
  info(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      pinoLogger.info(args.length > 0 ? { data: args } : {}, msgOrObj);
    } else {
      pinoLogger.info(msgOrObj, args[0]);
    }
  }

  warn(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      pinoLogger.warn(args.length > 0 ? { data: args } : {}, msgOrObj);
    } else {
      pinoLogger.warn(msgOrObj, args[0]);
    }
  }

  error(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      pinoLogger.error(args.length > 0 ? { error: args[0] } : {}, msgOrObj);
    } else {
      pinoLogger.error(msgOrObj, args[0]);
    }
  }

  debug(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      pinoLogger.debug(args.length > 0 ? { data: args } : {}, msgOrObj);
    } else {
      pinoLogger.debug(msgOrObj, args[0]);
    }
  }

  // Create child logger with context
  child(bindings: object) {
    return pinoLogger.child(bindings);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default logger
export default logger;
