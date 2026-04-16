// ─────────────────────────────────────────────────────────────────────────────
// messages/message.service.ts — Business logic only.
// DB access via messageRepository. Schemas from shared/validators.
// ─────────────────────────────────────────────────────────────────────────────
import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import {
  createMessageSchema,
  editMessageSchema,
  reactionSchema,
  messagesPaginationSchema,
  type CreateMessageInput,
  type EditMessageInput,
  type ReactionInput,
} from '../../shared/validators';
import { conversationRepository } from '../conversations/repository/conversation.repository';

import { messageRepository }      from './repository/message.repository';

// ── Create message ────────────────────────────────────────────────────────────

export async function createMessage(raw: CreateMessageInput) {
  const input = createMessageSchema.parse(raw);

  const convo = await conversationRepository.memberIds(input.conversationId);
  if (!convo) throw new AppError('Conversation not found', 404);

  const isMember = (convo as any).participants
    .some((p: Types.ObjectId) => p.toString() === input.senderId);
  if (!isMember) throw new AppError('You are not a member of this conversation', 403);

  const msg = await messageRepository.create({
    conversationId: new Types.ObjectId(input.conversationId),
    senderId:       new Types.ObjectId(input.senderId),
    content:        input.content,
    type:           input.type,
    attachments:    input.attachments as any,
    ...(input.replyTo ? {
      replyTo: {
        messageId:  new Types.ObjectId(input.replyTo.messageId),
        content:    input.replyTo.content,
        senderName: input.replyTo.senderName,
      },
    } : {}),
  });

  // Update sidebar preview
  await conversationRepository.updateLastMessage(input.conversationId, (msg as any)._id as Types.ObjectId);

  return msg;
}

// ── Edit message ──────────────────────────────────────────────────────────────

export async function editMessage(raw: EditMessageInput, requesterId: string) {
  const { messageId, content } = editMessageSchema.parse(raw);

  const msg = await messageRepository.findOwnedById(messageId, requesterId);
  if (!msg) throw new AppError('Message not found or permission denied', 404);

  return messageRepository.edit(messageId, content);
}

// ── Delete message ────────────────────────────────────────────────────────────

export async function deleteMessage(messageId: string, requesterId: string) {
  const msg = await messageRepository.findOwnedById(messageId, requesterId);
  if (!msg) throw new AppError('Message not found or permission denied', 404);

  return messageRepository.softDelete(messageId);
}

// ── Add reaction ──────────────────────────────────────────────────────────────

export async function addReaction(raw: ReactionInput, userId: string, username: string) {
  const { messageId, emoji } = reactionSchema.parse(raw);

  const msg = await messageRepository.findById(messageId);
  if (!msg || (msg as any).isDeleted) throw new AppError('Message not found', 404);

  // Idempotent — skip if already reacted with same emoji
  const already = ((msg as any).reactions ?? []).some(
    (r: any) => r.userId?.toString() === userId && r.emoji === emoji,
  );
  if (already) return msg;

  return messageRepository.addReaction(messageId, userId, username, emoji);
}

// ── Remove reaction ───────────────────────────────────────────────────────────

export async function removeReaction(raw: ReactionInput, userId: string) {
  const { messageId, emoji } = reactionSchema.parse(raw);
  return messageRepository.removeReaction(messageId, userId, emoji);
}

// ── Mark conversation read ────────────────────────────────────────────────────

export async function markConversationRead(conversationId: string, userId: string) {
  const unread = await messageRepository.unreadInConversation(conversationId, userId);
  const ids    = unread.map((m: any) => m._id.toString());
  if (!ids.length) return [];

  await messageRepository.markManyRead(ids, userId);
  return ids;
}

// ── Paginated messages ────────────────────────────────────────────────────────

export async function getPaginatedMessages(raw: {
  conversationId: string;
  cursor?: string;
  limit: number;
}) {
  const { conversationId, cursor, limit } = messagesPaginationSchema.parse(raw);

  const convOid  = new Types.ObjectId(conversationId);
  const cursorId = cursor ? new Types.ObjectId(cursor) : null;
  const rows     = await messageRepository.paginated(convOid, cursorId, limit);

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  rows.reverse();

  return {
    messages:   rows,
    nextCursor: hasMore ? rows[0]._id.toString() : null,
    hasMore,
  };
}
