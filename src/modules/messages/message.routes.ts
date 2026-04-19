import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware';
import { validate, validateMultiple } from '../../shared/middleware/validate';
import {
  conversationIdParamSchema,
  messageIdParamSchema,
  messagesPaginationQuerySchema,
  forwardMessageBodySchema,
  createScheduledMessageBodySchema,
} from '../../shared/validators';

import {
  getConversationMessages,
  starMessage,
  unstarMessage,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  forwardMessage,
  getScheduledMessages,
  createScheduledMessage,
  deleteScheduledMessage,
  searchMessagesController,
} from './message.controller';

const router = Router();

// Paginated messages per conversation
router.get(
  '/conversations/:conversationId/messages',
  requireAuth,
  validateMultiple({
    params: conversationIdParamSchema,
    query: messagesPaginationQuerySchema,
  }),
  getConversationMessages
);

// Pinned messages per conversation
router.get(
  '/conversations/:conversationId/pinned',
  requireAuth,
  validate(conversationIdParamSchema, 'params'),
  getPinnedMessages
);

// Star / unstar
router.put(
  '/messages/:id/star',
  requireAuth,
  validate(messageIdParamSchema, 'params'),
  starMessage
);
router.delete(
  '/messages/:id/star',
  requireAuth,
  validate(messageIdParamSchema, 'params'),
  unstarMessage
);

// Pin / unpin
router.put('/messages/:id/pin', requireAuth, validate(messageIdParamSchema, 'params'), pinMessage);
router.delete(
  '/messages/:id/pin',
  requireAuth,
  validate(messageIdParamSchema, 'params'),
  unpinMessage
);

// Forward
router.post(
  '/messages/:id/forward',
  requireAuth,
  validateMultiple({
    params: messageIdParamSchema,
    body: forwardMessageBodySchema,
  }),
  forwardMessage
);

// Search messages
router.get('/messages/search', requireAuth, searchMessagesController);

// Scheduled messages
router.get('/messages/scheduled', requireAuth, getScheduledMessages);
router.post(
  '/messages/scheduled',
  requireAuth,
  validate(createScheduledMessageBodySchema),
  createScheduledMessage
);
router.delete(
  '/messages/scheduled/:id',
  requireAuth,
  validate(messageIdParamSchema, 'params'),
  deleteScheduledMessage
);

export default router;
