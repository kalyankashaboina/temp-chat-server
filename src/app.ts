import { createExpressApp } from './modules/http/express';
import authRoutes from './modules/auth/auth.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import userRoutes from './modules/users/user.routes';
import messageRoutes from './modules/messages/message.routes';
import uploadRoutes from './modules/upload/upload.routes';
import { notFound } from './shared/middleware/notFound';
import { errorHandler } from './shared/middleware/errorHandler';
import { logger } from './shared/logger';

const app = createExpressApp();

// ── Health check ──────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', messageRoutes);

app.get('/', (_req, res) => {
  logger.info('Root accessed');
  res.json({ message: 'Relay Chat API', version: '1.0.0' });
});

// ── Error handling (must be last) ─────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

export { app };
