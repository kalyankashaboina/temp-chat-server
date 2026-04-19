import type { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { User } from '../users/user.model';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger';
import { env } from '../../config/env';

interface JwtPayload {
  userId: string;
}

// Augment Express Request so req.user is available everywhere
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        _id: any;
        username: string;
        email: string;
        avatar?: string;
        [key: string]: any;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.relay_token;

    if (!token) {
      return next(new AppError('Authentication required', 401));
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        return next(new AppError('Session expired. Please log in again.', 401));
      }
      if (err instanceof JsonWebTokenError) {
        return next(new AppError('Invalid session. Please log in again.', 401));
      }
      throw err;
    }

    const user = await User.findById(payload.userId).select(
      '-password -passwordResetToken -passwordResetExpires'
    );

    if (!user) {
      return next(new AppError('User account not found', 401));
    }

    req.user = { ...user.toObject(), userId: user._id.toString() };
    logger.debug('Auth success', { userId: user._id });
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: (err as Error).message });
    next(err);
  }
}
