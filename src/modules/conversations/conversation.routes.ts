import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validate';
import {
  createDirectBodySchema,
  createGroupBodySchema,
  conversationsPaginationQuerySchema,
  conversationsSearchQuerySchema,
} from '../../shared/validators';

import {
  createConversation,
  getSidebarConversations,
  searchSidebarConversations,
  createGroup,
  addMember,
  removeMember,
  updateGroup,
  leaveGroup,
  mute,
  unmute,
  archive,
  unarchive,
} from './conversation.controller';

const router = Router();

router.get(
  '/',
  requireAuth,
  validate(conversationsPaginationQuerySchema, 'query'),
  getSidebarConversations
);
router.get(
  '/search',
  requireAuth,
  validate(conversationsSearchQuerySchema, 'query'),
  searchSidebarConversations
);
router.post('/', requireAuth, validate(createDirectBodySchema), createConversation);
router.post('/direct', requireAuth, validate(createDirectBodySchema), createConversation); // alias — FE uses /direct
router.post('/group', requireAuth, validate(createGroupBodySchema), createGroup);

// Group management routes
router.post('/:id/members', requireAuth, addMember);
router.delete('/:id/members/:userId', requireAuth, removeMember);
router.patch('/:id', requireAuth, updateGroup);
router.post('/:id/leave', requireAuth, leaveGroup);

// Mute/Archive routes
router.post('/:id/mute', requireAuth, mute);
router.delete('/:id/mute', requireAuth, unmute);
router.post('/:id/archive', requireAuth, archive);
router.delete('/:id/archive', requireAuth, unarchive);

export default router;
