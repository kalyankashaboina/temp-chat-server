import type { Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from '../../config/env';

export function createExpressApp() {
  const app = express();

  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}
