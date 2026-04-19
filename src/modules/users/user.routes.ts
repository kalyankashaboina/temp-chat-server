import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validate';
import {
  updateProfileSchema,
  privacySettingsSchema,
  notificationPrefsSchema,
  userIdParamSchema,
  userSearchQuerySchema,
} from '../../shared/validators';

import {
  getUsers,
  updateMe,
  getPrivacy,
  updatePrivacy,
  getNotificationPrefs,
  updateNotificationPrefs,
  getBlockedUsers,
  blockUser,
  unblockUser,
  deleteAccount,
} from './user.controller';

const router = Router();

router.get('/', requireAuth, validate(userSearchQuerySchema, 'query'), getUsers);
router.put('/me', requireAuth, validate(updateProfileSchema), updateMe);

// Privacy
router.get('/me/privacy', requireAuth, getPrivacy);
router.put('/me/privacy', requireAuth, validate(privacySettingsSchema), updatePrivacy);

// Notifications
router.get('/me/notifications', requireAuth, getNotificationPrefs);
router.put(
  '/me/notifications',
  requireAuth,
  validate(notificationPrefsSchema),
  updateNotificationPrefs
);

// Blocked
router.get('/me/blocked', requireAuth, getBlockedUsers);
router.post('/:id/block', requireAuth, validate(userIdParamSchema, 'params'), blockUser);
router.delete('/:id/block', requireAuth, validate(userIdParamSchema, 'params'), unblockUser);

// Account
router.delete('/me', requireAuth, deleteAccount);

export default router;
