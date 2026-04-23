import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/AppError';
import { logger } from '../logger';
import { env } from '../../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  logger.error(`[${req.method}] ${req.originalUrl}`, {
    message: err.message,
    name: err.name,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.errors[0]?.message ?? 'Validation error',
      errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // Operational AppErrors (expected)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? 'field';
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // Multer file-size error
  if (err.message?.includes('File too large')) {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 25MB.',
    });
  }

  // Unknown errors — don't leak internals in production
  const isProd = env.NODE_ENV === 'production';
  return res.status(500).json({
    success: false,
    message: isProd ? 'Internal server error' : err.message,
  });
}
