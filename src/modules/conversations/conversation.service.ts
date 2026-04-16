// ─────────────────────────────────────────────────────────────────────────────
// conversations/conversation.service.ts — Business logic only.
// DB access via conversationRepository. Schemas from shared/validators.
// ─────────────────────────────────────────────────────────────────────────────
import { Types } from 'mongoose';

import { logger } from '../../shared/logger';
import { AppError } from '../../shared/errors/AppError';
import {
  createDirectSchema,
  createGroupSchema,
  conversationsPaginationSchema,
  conversationsSearchSchema,
  type CreateDirectInput,
  type CreateGroupInput,
  type ConversationsPaginationInput,
  type ConversationsSearchInput,
} from '../../shared/validators';
import { userRepository }         from '../users/repository/user.repository';

import { conversationRepository } from './repository/conversation.repository';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapConversation(conv: Record<string, any>, userId: string) {
  const isGroup   = conv.type === 'group';
  const otherUser = isGroup
    ? null
    : (conv.participants ?? []).find((p: any) => p._id.toString() !== userId);

  return {
    id:       conv._id.toString(),
    type:     conv.type,
    isGroup,
    groupName: isGroup ? conv.name : undefined,
    user:      otherUser
      ? {
          id:       otherUser._id.toString(),
          name:     otherUser.username ?? 'Unknown',
          username: otherUser.username ?? 'Unknown',
          avatar:   otherUser.avatar   ?? '',
          isOnline: otherUser.isOnline ?? false,
        }
      : undefined,
    users: isGroup
      ? (conv.participants ?? []).map((p: any) => ({
          id:       p._id.toString(),
          name:     p.username ?? 'Unknown',
          username: p.username ?? 'Unknown',
          avatar:   p.avatar   ?? '',
          isOnline: p.isOnline ?? false,
        }))
      : undefined,
    participants: (conv.participants ?? []).map((p: any) => p._id.toString()),
    lastMessage:  conv.lastMessage ?? null,
    unreadCount:  0,
    updatedAt:    conv.updatedAt,
  };
}

function slicePaginated<T>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return { items, hasMore };
}

// ── Create or get direct ──────────────────────────────────────────────────────

export async function createOrGetDirectConversation(raw: CreateDirectInput) {
  const { userId, targetUserId } = createDirectSchema.parse(raw);

  const userOid   = new Types.ObjectId(userId);
  const targetOid = new Types.ObjectId(targetUserId);

  const existing = await conversationRepository.findDirect(userOid, targetOid);
  if (existing) return mapConversation(existing as any, userId);

  const created   = await conversationRepository.create({ type: 'direct', participants: [userOid, targetOid] });
  const populated = await conversationRepository.findById(created._id.toString());

  return mapConversation(populated as any, userId);
}

// ── Create group ──────────────────────────────────────────────────────────────

export async function createGroupConversation(raw: CreateGroupInput) {
  const { creatorId, name, memberIds } = createGroupSchema.parse(raw);

  const uniqueIds = Array.from(new Set([creatorId, ...memberIds]));
  if (uniqueIds.length < 3)
    throw new AppError('Group requires at least 3 members total', 400);

  const participants = uniqueIds.map((id) => new Types.ObjectId(id));

  const created   = await conversationRepository.create({
    type: 'group',
    name: name.trim(),
    createdBy: new Types.ObjectId(creatorId),
    participants,
  });

  const populated = await conversationRepository.findById(created._id.toString());
  logger.info('Group created', { groupId: created._id, creatorId });
  return mapConversation(populated as any, creatorId);
}

// ── Paginated sidebar conversations ──────────────────────────────────────────

export async function getPaginatedConversations(raw: ConversationsPaginationInput) {
  const { userId, cursor, limit } = conversationsPaginationSchema.parse(raw);

  const userOid  = new Types.ObjectId(userId);
  const cursorId = cursor ? new Types.ObjectId(cursor) : null;
  const rows     = await conversationRepository.paginatedForUser(userOid, cursorId, limit);

  const { items, hasMore } = slicePaginated(rows, limit);

  return {
    conversations: items.map((c) => mapConversation(c as any, userId)),
    nextCursor:    hasMore ? items[items.length - 1]._id.toString() : null,
    hasMore,
  };
}

// ── Search conversations ──────────────────────────────────────────────────────

export async function searchConversations(raw: ConversationsSearchInput) {
  const { userId, query, cursor, limit } = conversationsSearchSchema.parse(raw);

  const userOid   = new Types.ObjectId(userId);
  const nameRegex = new RegExp(query, 'i');
  const cursorId  = cursor ? new Types.ObjectId(cursor) : null;

  // Find users matching the query (for direct chat lookup)
  const matchingUsers   = await userRepository.findByUsernameRegex(nameRegex);
  const matchingUserIds = matchingUsers.map((u) => new Types.ObjectId(u._id.toString()));

  const rows = await conversationRepository.searchForUser(
    userOid, matchingUserIds, nameRegex, cursorId, limit,
  );

  const { items, hasMore } = slicePaginated(rows, limit);

  return {
    conversations: items.map((c) => mapConversation(c as any, userId)),
    nextCursor:    hasMore ? items[items.length - 1]._id.toString() : null,
    hasMore,
  };
}
