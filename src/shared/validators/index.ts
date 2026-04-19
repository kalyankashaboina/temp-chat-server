// ─────────────────────────────────────────────────────────────────────────────
// shared/validators/index.ts
// Central Zod schema library for the entire backend.
// Every controller, service, and repository imports schemas from here.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';
import { Types } from 'mongoose';

import { LIMITS, PAGINATION, UPLOAD } from '../constants';

// ── Primitives ────────────────────────────────────────────────────────────────

/** A string that is a valid MongoDB ObjectId. */
export const objectIdSchema = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' });

/** Cursor must be a valid ObjectId when provided. */
export const cursorSchema = z
  .string()
  .optional()
  .refine((v) => !v || Types.ObjectId.isValid(v), { message: 'Invalid cursor' });

/** Safe pagination limit — clamped to configured max. */
export const limitSchema = (
  max: number = PAGINATION.MAX_LIMIT,
  def: number = PAGINATION.DEFAULT_LIMIT
) => z.coerce.number().int().min(1).max(max).default(def);

// ── Auth schemas ──────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  username: z
    .string()
    .min(LIMITS.USERNAME_MIN, `Username must be at least ${LIMITS.USERNAME_MIN} characters`)
    .max(LIMITS.USERNAME_MAX, `Username must be at most ${LIMITS.USERNAME_MAX} characters`)
    .trim()
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
    .max(LIMITS.PASSWORD_MAX, `Password must be at most ${LIMITS.PASSWORD_MAX} characters`),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
    .max(LIMITS.PASSWORD_MAX),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;

export const updateProfileSchema = z
  .object({
    username: z
      .string()
      .min(LIMITS.USERNAME_MIN)
      .max(LIMITS.USERNAME_MAX)
      .trim()
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
      .optional(),
    avatar: z.string().url('Invalid avatar URL').optional(),
    bio: z
      .string()
      .max(LIMITS.BIO_MAX, `Bio must be at most ${LIMITS.BIO_MAX} characters`)
      .optional(),
  })
  .refine((d) => d.username || d.avatar !== undefined || d.bio !== undefined, {
    message: 'At least one field is required',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ── Message schemas ───────────────────────────────────────────────────────────

export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z
    .string()
    .min(1)
    .refine((v) => UPLOAD.ALLOWED_MIMES.includes(v), { message: 'Unsupported file type' }),
  size: z.number().int().min(1).max(UPLOAD.MAX_SIZE_BYTES),
  url: z.string().url('Invalid attachment URL'),
  type: z.enum(['image', 'video', 'audio', 'document', 'text']).default('document'),
});
export type AttachmentInput = z.infer<typeof attachmentSchema>;

export const replyToSchema = z.object({
  messageId: objectIdSchema,
  content: z.string().min(1).max(500),
  senderName: z.string().min(1).max(100),
});
export type ReplyToInput = z.infer<typeof replyToSchema>;

export const createMessageSchema = z.object({
  conversationId: objectIdSchema,
  senderId: objectIdSchema,
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(LIMITS.MSG_MAX, `Message exceeds ${LIMITS.MSG_MAX} characters`)
    .trim(),
  type: z.enum(['text', 'image', 'file', 'system']).default('text'),
  attachments: z.array(attachmentSchema).max(10, 'Max 10 attachments').default([]),
  replyTo: replyToSchema.optional(),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const editMessageSchema = z.object({
  messageId: objectIdSchema,
  content: z.string().min(1, 'Message cannot be empty').max(LIMITS.MSG_MAX).trim(),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const reactionSchema = z.object({
  messageId: objectIdSchema,
  conversationId: objectIdSchema,
  emoji: z.string().min(1).max(10),
});
export type ReactionInput = z.infer<typeof reactionSchema>;

export const messagesPaginationSchema = z.object({
  conversationId: objectIdSchema,
  cursor: cursorSchema,
  limit: limitSchema(PAGINATION.MAX_LIMIT, PAGINATION.MSG_DEFAULT_LIMIT),
});
export type MessagesPaginationInput = z.infer<typeof messagesPaginationSchema>;

// ── Conversation schemas ──────────────────────────────────────────────────────

export const createDirectSchema = z
  .object({
    userId: objectIdSchema,
    targetUserId: objectIdSchema,
  })
  .refine((d) => d.userId !== d.targetUserId, {
    message: 'Cannot start a conversation with yourself',
    path: ['targetUserId'],
  });
export type CreateDirectInput = z.infer<typeof createDirectSchema>;

export const createGroupSchema = z.object({
  creatorId: objectIdSchema,
  name: z.string().min(1, 'Group name is required').max(LIMITS.GROUP_NAME_MAX).trim(),
  memberIds: z
    .array(objectIdSchema)
    .min(2, 'A group needs at least 2 other members')
    .max(256, 'Group cannot exceed 256 members'),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const conversationsPaginationSchema = z.object({
  userId: objectIdSchema,
  cursor: cursorSchema,
  limit: limitSchema(),
});
export type ConversationsPaginationInput = z.infer<typeof conversationsPaginationSchema>;

export const conversationsSearchSchema = z.object({
  userId: objectIdSchema,
  query: z.string().min(1).max(LIMITS.SEARCH_MAX).trim(),
  cursor: cursorSchema,
  limit: limitSchema(),
});
export type ConversationsSearchInput = z.infer<typeof conversationsSearchSchema>;

// ── User schemas ──────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  currentUserId: objectIdSchema,
  q: z.string().max(LIMITS.SEARCH_MAX).optional(),
  cursor: cursorSchema,
  limit: limitSchema(PAGINATION.USERS_MAX_LIMIT, PAGINATION.DEFAULT_LIMIT),
});
export type ListUsersInput = z.infer<typeof listUsersSchema>;

// ── Message extended schemas ──────────────────────────────────────────────────

export const forwardMessageSchema = z.object({
  messageId: objectIdSchema,
  toConversationId: objectIdSchema,
  requesterId: objectIdSchema,
});
export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;

export const scheduledMessageSchema = z.object({
  conversationId: objectIdSchema,
  senderId: objectIdSchema,
  content: z.string().min(1).max(LIMITS.MSG_MAX).trim(),
  scheduledAt: z.coerce.date().refine((d) => d > new Date(), {
    message: 'scheduledAt must be in the future',
  }),
});
export type ScheduledMessageInput = z.infer<typeof scheduledMessageSchema>;

// ── Privacy / user preference schemas ────────────────────────────────────────

export const privacySettingsSchema = z.object({
  lastSeenVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  profilePhotoVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  aboutVisibility: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  readReceipts: z.boolean().optional(),
  typingIndicators: z.boolean().optional(),
  onlineStatus: z.boolean().optional(),
});
export type PrivacySettingsInput = z.infer<typeof privacySettingsSchema>;

export const notificationPrefsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  callNotifications: z.boolean().optional(),
  groupNotifications: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  showPreview: z.boolean().optional(),
});
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
    .max(LIMITS.PASSWORD_MAX),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Route-level validation schemas (for request validation) ──────────────────

export const createDirectBodySchema = z.object({
  targetUserId: objectIdSchema,
});

export const createGroupBodySchema = z.object({
  name: z.string().min(1, 'Group name is required').max(LIMITS.GROUP_NAME_MAX).trim(),
  memberIds: z
    .array(objectIdSchema)
    .min(2, 'A group needs at least 2 other members')
    .max(256, 'Group cannot exceed 256 members'),
});

export const conversationsPaginationQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema().optional(),
});

export const conversationsSearchQuerySchema = z.object({
  q: z.string().min(1).max(LIMITS.SEARCH_MAX).trim(),
  cursor: cursorSchema,
  limit: limitSchema().optional(),
});

export const messageIdParamSchema = z.object({
  id: objectIdSchema,
});

export const conversationIdParamSchema = z.object({
  conversationId: objectIdSchema,
});

export const messagesPaginationQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema(PAGINATION.MAX_LIMIT, PAGINATION.MSG_DEFAULT_LIMIT).optional(),
});

export const forwardMessageBodySchema = z.object({
  toConversationId: objectIdSchema,
});

export const createScheduledMessageBodySchema = z.object({
  conversationId: objectIdSchema,
  content: z.string().min(1).max(LIMITS.MSG_MAX).trim(),
  scheduledAt: z.coerce.date().refine((d) => d > new Date(), {
    message: 'scheduledAt must be in the future',
  }),
});

export const userSearchQuerySchema = z.object({
  q: z.string().max(LIMITS.SEARCH_MAX).optional(),
});

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});
