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
} from './conversation.controller';

const router = Router();

router.get('/',           requireAuth, validate(conversationsPaginationQuerySchema, 'query'), getSidebarConversations);
router.get('/search',     requireAuth, validate(conversationsSearchQuerySchema, 'query'), searchSidebarConversations);
router.post('/',          requireAuth, validate(createDirectBodySchema), createConversation);
router.post('/direct',    requireAuth, validate(createDirectBodySchema), createConversation); // alias — FE uses /direct
router.post('/group',     requireAuth, validate(createGroupBodySchema), createGroup);

export default router;
