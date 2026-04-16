import type { Server } from 'socket.io';

import { User } from '../users/user.model';
import { Conversation } from '../conversations/conversation.model';
import { Message } from '../messages/message.model';
import { createMessage } from '../messages/message.service';
import { SOCKET_EVENTS, SOCKET } from '../../shared/constants';
import { logger } from '../../shared/logger';
import { queueMessageSave, queueConversationUpdate, queueReadReceipts } from '../../queues/message.queue';
import { SocketIdempotency } from '../../shared/middleware/idempotency';
import { presenceCache, typingCache } from '../../config/redis';

import type {
  AuthenticatedSocket,
  SendMessagePayload,
  DeleteMessagePayload,
  TypingPayload,
  ReadConversationPayload,
  CallInitiatePayload,
} from './socket.types';

// ── In-process state (use Redis for multi-instance) ───────────────────

const onlineUsers = new Set<string>();
const activeCalls = new Map<string, string>(); // userId → peerId
const typingTimeouts = new Map<string, NodeJS.Timeout>(); // `${userId}:${convId}` → timeout

// ── Helpers ───────────────────────────────────────────────────────────

async function assertConversationMember(conversationId: string, userId: string): Promise<void> {
  const convo = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).select('_id');

  if (!convo) {
    throw new Error('FORBIDDEN');
  }
}

function safeAsync(fn: () => Promise<void>, onError?: (err: Error) => void): void {
  fn().catch((err) => {
    logger.error('[SOCKET] Unhandled async error', { error: (err as Error).message });
    onError?.(err as Error);
  });
}

// ── Main event registration ───────────────────────────────────────────

export function registerSocketEvents(io: Server): void {
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;

    if (!userId) { socket.disconnect(); return; }

    const user = await User.findById(userId).select('username').lean();
    if (!user) { socket.disconnect(); return; }

    const username = (user as any).username as string;

    logger.info('[SOCKET] Connected', { socketId: socket.id, userId, username });

    // Join personal room
    socket.join(userId);

    // Mark online
    onlineUsers.add(userId);
    io.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
    socket.emit(SOCKET_EVENTS.PRESENCE_INIT, { onlineUsers: Array.from(onlineUsers) });

    // Join all conversation rooms
    const conversations = await Conversation.find({ participants: userId }).select('_id').lean();
    conversations.forEach((c) => socket.join(c._id.toString()));

    // ── message:send ───────────────────────────────────── ASYNC QUEUE
    // ✨ LOW LATENCY: Queue DB write, broadcast immediately, don't wait

    socket.on(SOCKET_EVENTS.MSG_SEND, ({ conversationId, content, tempId, replyTo }: SendMessagePayload & { replyTo?: any }) => {
      safeAsync(async () => {
        if (!conversationId || !content?.trim()) {
          socket.emit(SOCKET_EVENTS.MSG_FAILED, { tempId, reason: 'INVALID_PAYLOAD' });
          return;
        }

        // IDEMPOTENCY: Check for duplicates
        if (tempId && await SocketIdempotency.checkAndMark(tempId)) {
          logger.warn(`Duplicate message blocked: ${tempId}`);
          return; // Silently ignore duplicate
        }

        await assertConversationMember(conversationId, userId);

        // ✨ CRITICAL: Queue DB write (NON-BLOCKING)
        await queueMessageSave({
          conversationId,
          senderId: userId,
          content: content.trim(),
          type: 'text',
          tempId: tempId || `temp-${Date.now()}-${Math.random()}`,
          replyTo,
        });

        // ✨ INSTANT BROADCAST: Don't wait for DB save
        const msgData = {
          id: tempId, // Use tempId temporarily
          tempId,
          conversationId,
          senderId: userId,
          content: content.trim(),
          createdAt: new Date().toISOString(),
          replyTo: replyTo ?? null,
          sender: { _id: userId, username },
          status: 'sent',
        };

        // Broadcast to room immediately
        io.to(conversationId).emit(SOCKET_EVENTS.MSG_NEW, msgData);

        // ACK to sender
        socket.emit(SOCKET_EVENTS.MSG_SENT, {
          tempId,
          messageId: tempId, // Real ID will be updated by queue processor
          timestamp: msgData.createdAt,
        });

        // Mark as delivered to other participants
        io.to(conversationId).except(socket.id).emit(SOCKET_EVENTS.MSG_DELIVERED, {
          messageId: tempId,
          conversationId,
        });

        logger.info(`OK - Message queued for async save: ${tempId}`);
      });
    });

    // ── message:delete ────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.MSG_DELETE, ({ messageId }: DeleteMessagePayload) => {
      safeAsync(async () => {
        const msg = await Message.findOne({
          _id: messageId,
          senderId: userId,
          isDeleted: false,
        });
        if (!msg) return;

        await assertConversationMember(msg.conversationId.toString(), userId);

        msg.isDeleted = true;
        msg.deletedAt = new Date();
        await msg.save();

        io.to(msg.conversationId.toString()).emit(SOCKET_EVENTS.MSG_DELETED, {
          messageId,
          conversationId: msg.conversationId.toString(),
        });
      });
    });

    // ── message:edit ──────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.MSG_EDIT, async ({ messageId, content }: { messageId: string; content: string }) => {
      safeAsync(async () => {
        if (!content?.trim()) return;

        const msg = await Message.findOne({
          _id: messageId,
          senderId: userId,
          isDeleted: false,
        });
        if (!msg) return;

        await assertConversationMember(msg.conversationId.toString(), userId);

        msg.content = content.trim();
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        io.to(msg.conversationId.toString()).emit(SOCKET_EVENTS.MSG_EDITED, {
          messageId,
          content: msg.content,
          conversationId: msg.conversationId.toString(),
          editedAt: msg.editedAt.toISOString(),
        });
      });
    });

    // ── message:react ─────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.MSG_REACT, async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      safeAsync(async () => {
        await assertConversationMember(conversationId, userId);

        const msg = await Message.findById(messageId);
        if (!msg || msg.isDeleted) return;

        if (!msg.reactions) (msg as any).reactions = [];

        // Prevent duplicate reaction from same user+emoji
        const exists = (msg.reactions as any[]).some(
          (r: any) => r.userId?.toString() === userId && r.emoji === emoji,
        );
        if (!exists) {
          (msg.reactions as any[]).push({ userId, emoji, username });
          await msg.save();
        }

        io.to(conversationId).emit(SOCKET_EVENTS.REACTION_ADDED, {
          messageId,
          conversationId,
          emoji,
          userId,
          username,
        });
      });
    });

    // ── message:unreact ───────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.MSG_UNREACT, async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      safeAsync(async () => {
        await assertConversationMember(conversationId, userId);

        const msg = await Message.findById(messageId);
        if (!msg) return;

        if (msg.reactions) {
          (msg as any).reactions = (msg.reactions as any[]).filter(
            (r: any) => !(r.userId?.toString() === userId && r.emoji === emoji),
          );
          await msg.save();
        }

        io.to(conversationId).emit(SOCKET_EVENTS.REACTION_REMOVED, {
          messageId,
          conversationId,
          emoji,
          userId,
        });
      });
    });

    // ── conversation:read ────────────────────────────────── ASYNC QUEUE
    // ✨ LOW LATENCY: Queue read receipt processing, broadcast immediately

    socket.on(SOCKET_EVENTS.CONV_READ, ({ conversationId }: ReadConversationPayload) => {
      safeAsync(async () => {
        await assertConversationMember(conversationId, userId);

        const unread = await Message.find({
          conversationId,
          senderId: { $ne: userId },
          readBy: { $nin: [userId] },
        }).select('_id');

        const ids = unread.map((m) => m._id.toString());
        if (!ids.length) return;

        // ✨ CRITICAL: Queue read receipt processing (NON-BLOCKING)
        await queueReadReceipts({
          conversationId,
          userId,
          messageIds: ids,
        });

        // ✨ INSTANT BROADCAST: Don't wait for DB update
        io.to(conversationId).emit(SOCKET_EVENTS.MSG_READ, {
          conversationId,
          messageIds: ids,
          userId,
          readAt: new Date().toISOString(),
        });

        logger.info(`OK - Read receipts queued for ${ids.length} messages`);
      });
    });

    // ── typing:start ──────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.TYPING_START, ({ conversationId }: TypingPayload) => {
      safeAsync(async () => {
        await assertConversationMember(conversationId, userId);
        socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_START, { conversationId, userName: username });

        // Auto-stop after 8s (handles tab-close without typing:stop)
        const key = `${userId}:${conversationId}`;
        if (typingTimeouts.has(key)) clearTimeout(typingTimeouts.get(key)!);
        const timer = setTimeout(() => {
          socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_STOP, { conversationId, userName: username });
          typingTimeouts.delete(key);
        }, SOCKET.TYPING_TIMEOUT_MS);
        typingTimeouts.set(key, timer);
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, ({ conversationId }: TypingPayload) => {
      safeAsync(async () => {
        await assertConversationMember(conversationId, userId);
        const key = `${userId}:${conversationId}`;
        if (typingTimeouts.has(key)) {
          clearTimeout(typingTimeouts.get(key)!);
          typingTimeouts.delete(key);
        }
        socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_STOP, { conversationId, userName: username });
      });
    });

    // ── call:initiate ─────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.CALL_INITIATE, ({ toUserId, type }: CallInitiatePayload) => {
      if (activeCalls.has(userId) || activeCalls.has(toUserId)) {
        socket.emit(SOCKET_EVENTS.CALL_BUSY, { toUserId });
        return;
      }
      activeCalls.set(userId, toUserId);
      activeCalls.set(toUserId, userId);
      io.to(toUserId).emit(SOCKET_EVENTS.CALL_INCOMING, { fromUserId: userId, type });
    });

    socket.on(SOCKET_EVENTS.CALL_ACCEPT, ({ fromUserId }: { fromUserId: string }) => {
      io.to(fromUserId).emit(SOCKET_EVENTS.CALL_ACCEPTED, { byUserId: userId });
    });

    socket.on(SOCKET_EVENTS.CALL_REJECT, ({ fromUserId }: { fromUserId: string }) => {
      activeCalls.delete(userId);
      activeCalls.delete(fromUserId);
      io.to(fromUserId).emit(SOCKET_EVENTS.CALL_REJECTED, { byUserId: userId });
    });

    socket.on(SOCKET_EVENTS.CALL_END, ({ toUserId }: { toUserId: string }) => {
      activeCalls.delete(userId);
      activeCalls.delete(toUserId);
      io.to(toUserId).emit(SOCKET_EVENTS.CALL_ENDED, { fromUserId: userId });
    });

    // ── disconnect ────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      logger.info('[SOCKET] Disconnected', { socketId: socket.id, userId });

      onlineUsers.delete(userId);
      io.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });

      // Clean up typing timeouts for this user
      for (const [key, timer] of typingTimeouts.entries()) {
        if (key.startsWith(`${userId}:`)) {
          clearTimeout(timer);
          typingTimeouts.delete(key);
        }
      }

      // End any active call
      const peer = activeCalls.get(userId);
      if (peer) {
        io.to(peer).emit(SOCKET_EVENTS.CALL_ENDED, { fromUserId: userId });
        activeCalls.delete(peer);
        activeCalls.delete(userId);
      }
    });
  });
}
