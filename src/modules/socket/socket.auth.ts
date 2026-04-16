import cookie from 'cookie';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';

import type { AuthenticatedSocket } from './socket.types';

export function socketAuth(socket: AuthenticatedSocket, next: (err?: Error) => void) {
  try {
    const rawCookie = socket.request.headers.cookie;

    if (!rawCookie) {
      return next(new Error('Authentication required'));
    }

    const cookies = cookie.parse(rawCookie);
    const token = cookies.relay_token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
    };

    // OK - correct place
    socket.data.userId = payload.userId;

    next();
  } catch {
    next(new Error('Invalid token'));
  }
}
