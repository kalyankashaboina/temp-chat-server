import type { Server } from 'socket.io';

import { User } from '../users/user.model';
import { Conversation } from '../conversations/conversation.model';
import { Message } from '../messages/message.model';
import { createMessage } from '../messages/message.service';
import { SOCKET_EVENTS, SOCKET } from '../../shared/constants';
import { logger } from '../../shared/logger';
import {
  queueMessageSave,
  queueConversationUpdate,
  queueReadReceipts,
} from '../../queues/message.queue';
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

// BUG FIX #4: Store io instance for access from queue processor
let ioInstance: Server | null = null;

export function getIO(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized');
  }
  return ioInstance;
}

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
  // BUG FIX #4: Store io instance for queue processor access
  ioInstance = io;

  io.on('connection', async (socket: AuthenticatedSocket) => {
    logger.info('[SOCKET] Connection attempt initiated', {
      socketId: socket.id,
      handshakeAuth: !!socket.handshake.auth,
      handshakeQuery: socket.handshake.query,
    });

    const userId = socket.data.userId;

    if (!userId) {
      logger.warn('[SOCKET] Connection rejected - no userId in socket data', {
        socketId: socket.id,
        socketData: socket.data,
        reason: 'Missing authentication userId',
      });
      socket.disconnect(true);
      return;
    }

    logger.info('[SOCKET] userId extracted from socket data', {
      socketId: socket.id,
      userId,
    });

    logger.info('[SOCKET] Fetching user from database', {
      socketId: socket.id,
      userId,
    });

    const user = await User.findById(userId).select('username').lean();

    if (!user) {
      logger.warn('[SOCKET] Connection rejected - user not found', {
        socketId: socket.id,
        userId,
        reason: 'User does not exist in database',
      });
      socket.disconnect(true);
      return;
    }

    const username = (user as any).username as string;

    logger.info('[SOCKET] User authenticated successfully', {
      socketId: socket.id,
      userId,
      username,
      timestamp: new Date().toISOString(),
    });

    // Join personal room
    socket.join(userId);
    logger.debug('[SOCKET] User joined personal room', {
      socketId: socket.id,
      userId,
      roomId: userId,
    });

    // Mark online
    onlineUsers.add(userId);
    logger.info('[SOCKET] User marked as online', {
      userId,
      onlineUsersCount: onlineUsers.size,
      onlineUsersList: Array.from(onlineUsers),
    });

    logger.info('[SOCKET] Broadcasting USER_ONLINE to all clients', {
      userId,
      username,
      broadcastToAll: true,
    });

    io.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
    logger.debug('[SOCKET] USER_ONLINE emitted', { userId, username });

    logger.info('[SOCKET] Emitting PRESENCE_INIT to connecting client', {
      socketId: socket.id,
      userId,
      onlineUsersCount: onlineUsers.size,
    });

    socket.emit(SOCKET_EVENTS.PRESENCE_INIT, { onlineUsers: Array.from(onlineUsers) });
    logger.debug('[SOCKET] PRESENCE_INIT emitted', {
      userId,
      onlineUsersCount: onlineUsers.size,
    });

    // Join all conversation rooms
    logger.info('[SOCKET] Fetching user conversations from database', {
      userId,
      socketId: socket.id,
    });

    const conversations = await Conversation.find({ participants: userId }).select('_id').lean();

    logger.info('[SOCKET] User conversations retrieved', {
      userId,
      conversationCount: conversations.length,
      conversationIds: conversations.map((c) => c._id.toString()).slice(0, 10),
    });

    conversations.forEach((c) => {
      const conversationId = c._id.toString();
      socket.join(conversationId);
      logger.debug('[SOCKET] User joined conversation room', {
        userId,
        socketId: socket.id,
        conversationId,
      });
    });

    logger.info('[SOCKET] Connection complete', {
      socketId: socket.id,
      userId,
      username,
      conversationCount: conversations.length,
      totalOnlineUsers: onlineUsers.size,
      timestamp: new Date().toISOString(),
    });

    // ── message:send ───────────────────────────────────── ASYNC QUEUE
    // ✨ LOW LATENCY: Queue DB write, broadcast immediately, don't wait

    socket.on(
      SOCKET_EVENTS.MSG_SEND,
      ({ conversationId, content, tempId, replyTo }: SendMessagePayload & { replyTo?: any }) => {
        logger.info('[SOCKET] MSG_SEND received', {
          userId,
          socketId: socket.id,
          conversationId,
          tempId,
          contentLength: content?.length,
          hasReplyTo: !!replyTo,
          payload: { conversationId, content: content?.substring(0, 50), tempId, replyTo },
        });

        safeAsync(async () => {
          if (!conversationId || !content?.trim()) {
            logger.warn('[SOCKET] MSG_SEND invalid payload', {
              userId,
              conversationId,
              tempId,
              contentTrim: content?.trim(),
              reason: 'Missing conversationId or empty content',
            });

            socket.emit(SOCKET_EVENTS.MSG_FAILED, {
              tempId,
              conversationId,
              reason: 'INVALID_PAYLOAD',
            });
            logger.debug('[SOCKET] MSG_FAILED emitted to client', { userId, tempId });
            return;
          }

          // IDEMPOTENCY: Check for duplicates
          if (tempId) {
            const isDuplicate = await SocketIdempotency.checkAndMark(tempId);
            logger.info('[SOCKET] Idempotency check', { tempId, isDuplicate });
            if (isDuplicate) {
              logger.warn('[SOCKET] Duplicate message blocked', { userId, tempId });
              return; // Silently ignore duplicate
            }
          }

          // Verify conversation membership
          try {
            await assertConversationMember(conversationId, userId);
            logger.info('[SOCKET] User verified as conversation member', {
              userId,
              conversationId,
            });
          } catch (err) {
            logger.error('[SOCKET] User not member of conversation', {
              userId,
              conversationId,
              error: (err as Error).message,
            });
            socket.emit(SOCKET_EVENTS.MSG_FAILED, {
              tempId,
              conversationId,
              reason: 'FORBIDDEN',
            });
            return;
          }

          const finalTempId = tempId || `temp-${Date.now()}-${Math.random()}`;

          // ✨ CRITICAL: Queue DB write (NON-BLOCKING)
          logger.info('[SOCKET] Queuing message for DB save', {
            userId,
            conversationId,
            tempId: finalTempId,
            contentLength: content.trim().length,
            hasReplyTo: !!replyTo,
          });

          try {
            await queueMessageSave({
              conversationId,
              senderId: userId,
              content: content.trim(),
              type: 'text',
              tempId: finalTempId,
              replyTo,
            });
            logger.info('[SOCKET] Message successfully queued', {
              userId,
              conversationId,
              tempId: finalTempId,
            });
          } catch (queueErr) {
            logger.error('[SOCKET] Failed to queue message', {
              userId,
              conversationId,
              tempId: finalTempId,
              error: (queueErr as Error).message,
            });
            socket.emit(SOCKET_EVENTS.MSG_FAILED, {
              tempId: finalTempId,
              conversationId,
              reason: 'QUEUE_ERROR',
            });
            return;
          }

          // ✨ INSTANT BROADCAST: Don't wait for DB save
          const msgData = {
            id: finalTempId,
            tempId: finalTempId,
            conversationId,
            senderId: userId,
            content: content.trim(),
            createdAt: new Date().toISOString(),
            replyTo: replyTo ?? null,
            sender: { _id: userId, username },
            status: 'sent',
          };

          // Broadcast to room immediately
          logger.info('[SOCKET] Broadcasting MSG_NEW to room', {
            conversationId,
            tempId: finalTempId,
            recipientCount: 'all users in conversation',
          });
          io.to(conversationId).emit(SOCKET_EVENTS.MSG_NEW, msgData);
          logger.debug('[SOCKET] MSG_NEW emitted', {
            conversationId,
            tempId: finalTempId,
            msgData,
          });

          // ACK to sender
          logger.info('[SOCKET] Emitting MSG_SENT acknowledgment to sender', {
            userId,
            tempId: finalTempId,
            conversationId,
          });
          socket.emit(SOCKET_EVENTS.MSG_SENT, {
            tempId: finalTempId,
            messageId: finalTempId,
            conversationId,
            createdAt: msgData.createdAt,
          });
          logger.debug('[SOCKET] MSG_SENT emitted to sender', { userId, tempId: finalTempId });

          // Mark as delivered to other participants
          logger.info('[SOCKET] Emitting MSG_DELIVERED to others', {
            conversationId,
            tempId: finalTempId,
            excludeSocketId: socket.id,
          });
          io.to(conversationId).except(socket.id).emit(SOCKET_EVENTS.MSG_DELIVERED, {
            messageId: finalTempId,
            conversationId,
          });
          logger.debug('[SOCKET] MSG_DELIVERED emitted to others', {
            conversationId,
            tempId: finalTempId,
          });

          logger.info('[SOCKET] MSG_SEND complete', {
            userId,
            conversationId,
            tempId: finalTempId,
          });
        });
      }
    );

    // ── message:delete ────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.MSG_DELETE, ({ messageId }: DeleteMessagePayload) => {
      logger.info('[SOCKET] MSG_DELETE received', {
        userId,
        socketId: socket.id,
        messageId,
      });

      safeAsync(async () => {
        try {
          logger.info('[SOCKET] Fetching message from DB', { messageId, userId });
          const msg = await Message.findOne({
            _id: messageId,
            senderId: userId,
            isDeleted: false,
          });

          if (!msg) {
            logger.warn('[SOCKET] Message not found or already deleted', {
              messageId,
              userId,
              reason: 'Message not found or user not sender or already deleted',
            });
            return;
          }

          logger.info('[SOCKET] Message found, verifying conversation access', {
            messageId,
            conversationId: msg.conversationId.toString(),
            userId,
          });

          await assertConversationMember(msg.conversationId.toString(), userId);
          logger.info('[SOCKET] Conversation access verified', {
            conversationId: msg.conversationId.toString(),
            userId,
          });

          msg.isDeleted = true;
          msg.deletedAt = new Date();
          await msg.save();
          logger.info('[SOCKET] Message marked as deleted in DB', {
            messageId,
            conversationId: msg.conversationId.toString(),
            deletedAt: msg.deletedAt,
          });

          logger.info('[SOCKET] Broadcasting MSG_DELETED to room', {
            conversationId: msg.conversationId.toString(),
            messageId,
          });
          io.to(msg.conversationId.toString()).emit(SOCKET_EVENTS.MSG_DELETED, {
            messageId,
            conversationId: msg.conversationId.toString(),
          });
          logger.debug('[SOCKET] MSG_DELETED emitted', {
            messageId,
            conversationId: msg.conversationId.toString(),
          });
        } catch (err) {
          logger.error('[SOCKET] MSG_DELETE error', {
            userId,
            messageId,
            error: (err as Error).message,
            stack: (err as Error).stack,
          });
        }
      });
    });

    // ── message:edit ──────────────────────────────────────────────────

    socket.on(
      SOCKET_EVENTS.MSG_EDIT,
      async ({ messageId, content }: { messageId: string; content: string }) => {
        logger.info('[SOCKET] MSG_EDIT received', {
          userId,
          socketId: socket.id,
          messageId,
          contentLength: content?.length,
          payload: { messageId, content: content?.substring(0, 50) },
        });

        safeAsync(async () => {
          try {
            if (!content?.trim()) {
              logger.warn('[SOCKET] MSG_EDIT invalid payload', {
                userId,
                messageId,
                reason: 'Content is empty',
              });
              return;
            }

            logger.info('[SOCKET] Fetching message from DB for edit', { messageId, userId });
            const msg = await Message.findOne({
              _id: messageId,
              senderId: userId,
              isDeleted: false,
            });

            if (!msg) {
              logger.warn('[SOCKET] Message not found for edit', {
                messageId,
                userId,
                reason: 'Message not found or user not sender',
              });
              return;
            }

            logger.info('[SOCKET] Message found, verifying conversation access', {
              messageId,
              conversationId: msg.conversationId.toString(),
              userId,
            });

            await assertConversationMember(msg.conversationId.toString(), userId);

            const oldContent = msg.content;
            msg.content = content.trim();
            msg.isEdited = true;
            msg.editedAt = new Date();
            await msg.save();

            logger.info('[SOCKET] Message updated in DB', {
              messageId,
              conversationId: msg.conversationId.toString(),
              oldContentLength: oldContent.length,
              newContentLength: msg.content.length,
              editedAt: msg.editedAt,
            });

            logger.info('[SOCKET] Broadcasting MSG_EDITED to room', {
              conversationId: msg.conversationId.toString(),
              messageId,
            });

            io.to(msg.conversationId.toString()).emit(SOCKET_EVENTS.MSG_EDITED, {
              messageId,
              content: msg.content,
              conversationId: msg.conversationId.toString(),
              editedAt: msg.editedAt.toISOString(),
            });

            logger.debug('[SOCKET] MSG_EDITED emitted', {
              messageId,
              conversationId: msg.conversationId.toString(),
            });
          } catch (err) {
            logger.error('[SOCKET] MSG_EDIT error', {
              userId,
              messageId,
              error: (err as Error).message,
              stack: (err as Error).stack,
            });
          }
        });
      }
    );

    // ── message:react ─────────────────────────────────────────────────

    socket.on(
      SOCKET_EVENTS.MSG_REACT,
      async ({
        messageId,
        emoji,
        conversationId,
      }: {
        messageId: string;
        emoji: string;
        conversationId: string;
      }) => {
        logger.info('[SOCKET] MSG_REACT received', {
          userId,
          socketId: socket.id,
          messageId,
          emoji,
          conversationId,
          payload: { messageId, emoji, conversationId },
        });

        safeAsync(async () => {
          try {
            logger.info('[SOCKET] Verifying conversation membership for reaction', {
              userId,
              conversationId,
            });

            await assertConversationMember(conversationId, userId);
            logger.info('[SOCKET] User verified as conversation member', {
              userId,
              conversationId,
            });

            logger.info('[SOCKET] Fetching message for reaction', {
              messageId,
              conversationId,
            });

            const msg = await Message.findById(messageId);

            if (!msg) {
              logger.warn('[SOCKET] Message not found for reaction', {
                messageId,
                conversationId,
              });
              return;
            }

            if (msg.isDeleted) {
              logger.warn('[SOCKET] Cannot react to deleted message', {
                messageId,
                conversationId,
              });
              return;
            }

            if (!msg.reactions) {
              logger.debug('[SOCKET] Initializing reactions array', { messageId });
              (msg as any).reactions = [];
            }

            const existingReaction = (msg.reactions as any[]).some(
              (r: any) => r.userId?.toString() === userId && r.emoji === emoji
            );

            if (existingReaction) {
              logger.info('[SOCKET] Duplicate reaction prevented', {
                messageId,
                userId,
                emoji,
                reason: 'User already reacted with this emoji',
              });
              return;
            }

            logger.info('[SOCKET] Adding reaction to message', {
              messageId,
              userId,
              emoji,
              username,
            });

            (msg.reactions as any[]).push({ userId, emoji, username });
            await msg.save();

            logger.info('[SOCKET] Reaction saved to DB', {
              messageId,
              conversationId,
              userId,
              emoji,
              totalReactions: msg.reactions.length,
            });

            logger.info('[SOCKET] Broadcasting REACTION_ADDED to room', {
              conversationId,
              messageId,
              emoji,
              userId,
            });

            io.to(conversationId).emit(SOCKET_EVENTS.REACTION_ADDED, {
              messageId,
              conversationId,
              emoji,
              userId,
              username,
            });

            logger.debug('[SOCKET] REACTION_ADDED emitted', {
              messageId,
              conversationId,
              emoji,
            });
          } catch (err) {
            logger.error('[SOCKET] MSG_REACT error', {
              userId,
              messageId,
              conversationId,
              emoji,
              error: (err as Error).message,
              stack: (err as Error).stack,
            });
          }
        });
      }
    );

    // ── message:unreact ───────────────────────────────────────────────

    socket.on(
      SOCKET_EVENTS.MSG_UNREACT,
      async ({
        messageId,
        emoji,
        conversationId,
      }: {
        messageId: string;
        emoji: string;
        conversationId: string;
      }) => {
        logger.info('[SOCKET] MSG_UNREACT received', {
          userId,
          socketId: socket.id,
          messageId,
          emoji,
          conversationId,
          payload: { messageId, emoji, conversationId },
        });

        safeAsync(async () => {
          try {
            logger.info('[SOCKET] Verifying conversation membership for unreact', {
              userId,
              conversationId,
            });

            await assertConversationMember(conversationId, userId);
            logger.info('[SOCKET] User verified as conversation member', {
              userId,
              conversationId,
            });

            logger.info('[SOCKET] Fetching message for unreact', {
              messageId,
              conversationId,
            });

            const msg = await Message.findById(messageId);

            if (!msg) {
              logger.warn('[SOCKET] Message not found for unreact', {
                messageId,
                conversationId,
              });
              return;
            }

            if (!msg.reactions || msg.reactions.length === 0) {
              logger.info('[SOCKET] No reactions to remove', {
                messageId,
                emoji,
                reason: 'Message has no reactions',
              });
              return;
            }

            const reactionsBeforeCount = msg.reactions.length;
            (msg as any).reactions = (msg.reactions as any[]).filter(
              (r: any) => !(r.userId?.toString() === userId && r.emoji === emoji)
            );
            const reactionsAfterCount = msg.reactions.length;
            const reactionRemoved = reactionsBeforeCount > reactionsAfterCount;

            if (reactionRemoved) {
              await msg.save();
              logger.info('[SOCKET] Reaction removed from DB', {
                messageId,
                conversationId,
                userId,
                emoji,
                reactionsBeforeCount,
                reactionsAfterCount,
              });
            } else {
              logger.info('[SOCKET] No matching reaction found to remove', {
                messageId,
                userId,
                emoji,
                reason: 'User did not have this emoji reaction',
              });
              return;
            }

            logger.info('[SOCKET] Broadcasting REACTION_REMOVED to room', {
              conversationId,
              messageId,
              emoji,
              userId,
            });

            io.to(conversationId).emit(SOCKET_EVENTS.REACTION_REMOVED, {
              messageId,
              conversationId,
              emoji,
              userId,
            });

            logger.debug('[SOCKET] REACTION_REMOVED emitted', {
              messageId,
              conversationId,
              emoji,
            });
          } catch (err) {
            logger.error('[SOCKET] MSG_UNREACT error', {
              userId,
              messageId,
              conversationId,
              emoji,
              error: (err as Error).message,
              stack: (err as Error).stack,
            });
          }
        });
      }
    );

    // ── conversation:read ────────────────────────────────── ASYNC QUEUE
    // ✨ LOW LATENCY: Queue read receipt processing, broadcast immediately

    socket.on(SOCKET_EVENTS.CONV_READ, ({ conversationId }: ReadConversationPayload) => {
      logger.info('[SOCKET] CONV_READ received', {
        userId,
        socketId: socket.id,
        conversationId,
        payload: { conversationId },
      });

      safeAsync(async () => {
        try {
          logger.info('[SOCKET] Verifying conversation membership for read receipt', {
            userId,
            conversationId,
          });

          await assertConversationMember(conversationId, userId);
          logger.info('[SOCKET] User verified as conversation member', {
            userId,
            conversationId,
          });

          logger.info('[SOCKET] Fetching unread messages', {
            conversationId,
            userId,
          });

          const unread = await Message.find({
            conversationId,
            senderId: { $ne: userId },
            readBy: { $nin: [userId] },
          }).select('_id');

          const ids = unread.map((m) => m._id.toString());

          logger.info('[SOCKET] Unread messages found', {
            conversationId,
            userId,
            unreadCount: ids.length,
            messageIds: ids.length > 0 ? ids.slice(0, 5) : [],
          });

          if (!ids.length) {
            logger.info('[SOCKET] No unread messages to mark', {
              conversationId,
              userId,
              reason: 'All messages already read',
            });
            return;
          }

          logger.info('[SOCKET] Queuing read receipts for processing', {
            conversationId,
            userId,
            messageCount: ids.length,
          });

          // ✨ CRITICAL: Queue read receipt processing (NON-BLOCKING)
          await queueReadReceipts({
            conversationId,
            userId,
            messageIds: ids,
          });

          logger.info('[SOCKET] Read receipts queued successfully', {
            conversationId,
            userId,
            messageCount: ids.length,
          });

          // ✨ INSTANT BROADCAST: Don't wait for DB update
          logger.info('[SOCKET] Broadcasting MSG_READ to room', {
            conversationId,
            userId,
            messageCount: ids.length,
          });

          io.to(conversationId).emit(SOCKET_EVENTS.MSG_READ, {
            conversationId,
            messageIds: ids,
            userId,
            readAt: new Date().toISOString(),
          });

          logger.debug('[SOCKET] MSG_READ emitted', {
            conversationId,
            userId,
            messageCount: ids.length,
          });

          logger.info('[SOCKET] CONV_READ complete', {
            conversationId,
            userId,
            messageCount: ids.length,
          });
        } catch (err) {
          logger.error('[SOCKET] CONV_READ error', {
            userId,
            conversationId,
            error: (err as Error).message,
            stack: (err as Error).stack,
          });
        }
      });
    });

    // ── typing:start ──────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.TYPING_START, ({ conversationId }: TypingPayload) => {
      logger.info('[SOCKET] TYPING_START received', {
        userId,
        socketId: socket.id,
        conversationId,
        username,
        payload: { conversationId },
      });

      safeAsync(async () => {
        try {
          logger.info('[SOCKET] Verifying conversation membership for typing', {
            userId,
            conversationId,
          });

          await assertConversationMember(conversationId, userId);
          logger.info('[SOCKET] User verified as conversation member', {
            userId,
            conversationId,
          });

          logger.info('[SOCKET] Broadcasting TYPING_START to others in room', {
            conversationId,
            userId,
            username,
            excludeSocketId: socket.id,
          });

          socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_START, {
            conversationId,
            userName: username,
            userId,
          });

          logger.debug('[SOCKET] TYPING_START emitted', {
            conversationId,
            userId,
            username,
          });

          // Auto-stop after 8s (handles tab-close without typing:stop)
          const key = `${userId}:${conversationId}`;
          if (typingTimeouts.has(key)) {
            logger.debug('[SOCKET] Clearing previous typing timeout', { key });
            clearTimeout(typingTimeouts.get(key)!);
          }

          logger.debug('[SOCKET] Setting typing auto-stop timeout', {
            key,
            timeoutMs: SOCKET.TYPING_TIMEOUT_MS,
          });

          const timer = setTimeout(() => {
            logger.info('[SOCKET] Typing timeout triggered - auto-stop', {
              userId,
              conversationId,
              reason: 'Auto-stop after 8 seconds of inactivity',
            });

            socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_STOP, {
              conversationId,
              userName: username,
              userId,
            });

            logger.debug('[SOCKET] TYPING_STOP auto-emitted', {
              conversationId,
              userId,
              username,
            });

            typingTimeouts.delete(key);
            logger.debug('[SOCKET] Typing timeout cleared from map', { key });
          }, SOCKET.TYPING_TIMEOUT_MS);

          typingTimeouts.set(key, timer);
          logger.debug('[SOCKET] Typing timeout registered', {
            key,
            activeTypingUsers: typingTimeouts.size,
          });
        } catch (err) {
          logger.error('[SOCKET] TYPING_START error', {
            userId,
            conversationId,
            error: (err as Error).message,
            stack: (err as Error).stack,
          });
        }
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, ({ conversationId }: TypingPayload) => {
      logger.info('[SOCKET] TYPING_STOP received', {
        userId,
        socketId: socket.id,
        conversationId,
        username,
        payload: { conversationId },
      });

      safeAsync(async () => {
        try {
          logger.info('[SOCKET] Verifying conversation membership for typing stop', {
            userId,
            conversationId,
          });

          await assertConversationMember(conversationId, userId);
          logger.info('[SOCKET] User verified as conversation member', {
            userId,
            conversationId,
          });

          const key = `${userId}:${conversationId}`;
          if (typingTimeouts.has(key)) {
            logger.debug('[SOCKET] Clearing typing timeout', {
              key,
              reason: 'Explicit typing:stop received',
            });

            clearTimeout(typingTimeouts.get(key)!);
            typingTimeouts.delete(key);
            logger.debug('[SOCKET] Typing timeout removed from map', {
              key,
              remainingTypers: typingTimeouts.size,
            });
          } else {
            logger.debug('[SOCKET] No active typing timeout found', {
              key,
              reason: 'Already cleared or never started',
            });
          }

          logger.info('[SOCKET] Broadcasting TYPING_STOP to others in room', {
            conversationId,
            userId,
            username,
            excludeSocketId: socket.id,
          });

          socket.to(conversationId).emit(SOCKET_EVENTS.TYPING_STOP, {
            conversationId,
            userName: username,
            userId,
          });

          logger.debug('[SOCKET] TYPING_STOP emitted', {
            conversationId,
            userId,
            username,
          });
        } catch (err) {
          logger.error('[SOCKET] TYPING_STOP error', {
            userId,
            conversationId,
            error: (err as Error).message,
            stack: (err as Error).stack,
          });
        }
      });
    });

    // ── call:initiate ─────────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.CALL_INITIATE, ({ toUserId, type }: CallInitiatePayload) => {
      logger.info('[SOCKET] CALL_INITIATE received', {
        userId,
        socketId: socket.id,
        toUserId,
        callType: type,
        payload: { toUserId, type },
      });

      const fromUserActive = activeCalls.has(userId);
      const toUserActive = activeCalls.has(toUserId);

      logger.info('[SOCKET] Checking active calls status', {
        userId,
        toUserId,
        userHasActiveCall: fromUserActive,
        recipientHasActiveCall: toUserActive,
        activeCallsCount: activeCalls.size,
      });

      if (fromUserActive || toUserActive) {
        logger.warn('[SOCKET] Call rejected - busy', {
          userId,
          toUserId,
          userBusy: fromUserActive,
          recipientBusy: toUserActive,
          reason: 'One or both users already have active calls',
        });
        socket.emit(SOCKET_EVENTS.CALL_BUSY, { toUserId });
        logger.debug('[SOCKET] CALL_BUSY emitted', { userId, toUserId });
        return;
      }

      logger.info('[SOCKET] Registering active call', {
        userId,
        toUserId,
        callType: type,
      });

      activeCalls.set(userId, toUserId);
      activeCalls.set(toUserId, userId);

      logger.info('[SOCKET] Broadcasting CALL_INCOMING to recipient', {
        toUserId,
        fromUserId: userId,
        callType: type,
        activeCallsCount: activeCalls.size,
      });

      io.to(toUserId).emit(SOCKET_EVENTS.CALL_INCOMING, { fromUserId: userId, type });
      logger.debug('[SOCKET] CALL_INCOMING emitted', { toUserId, fromUserId: userId, type });
    });

    socket.on(SOCKET_EVENTS.CALL_ACCEPT, ({ fromUserId }: { fromUserId: string }) => {
      logger.info('[SOCKET] CALL_ACCEPT received', {
        userId,
        socketId: socket.id,
        fromUserId,
        payload: { fromUserId },
      });

      logger.info('[SOCKET] Broadcasting CALL_ACCEPTED to caller', {
        toUserId: fromUserId,
        byUserId: userId,
      });

      io.to(fromUserId).emit(SOCKET_EVENTS.CALL_ACCEPTED, { byUserId: userId });
      logger.debug('[SOCKET] CALL_ACCEPTED emitted', { toUserId: fromUserId, byUserId: userId });
    });

    socket.on(SOCKET_EVENTS.CALL_REJECT, ({ fromUserId }: { fromUserId: string }) => {
      logger.info('[SOCKET] CALL_REJECT received', {
        userId,
        socketId: socket.id,
        fromUserId,
        payload: { fromUserId },
      });

      logger.info('[SOCKET] Cleaning up active call', {
        userId,
        fromUserId,
        reason: 'Call rejected by recipient',
      });

      activeCalls.delete(userId);
      activeCalls.delete(fromUserId);

      logger.info('[SOCKET] Broadcasting CALL_REJECTED to caller', {
        toUserId: fromUserId,
        byUserId: userId,
        activeCallsCount: activeCalls.size,
      });

      io.to(fromUserId).emit(SOCKET_EVENTS.CALL_REJECTED, { byUserId: userId });
      logger.debug('[SOCKET] CALL_REJECTED emitted', { toUserId: fromUserId, byUserId: userId });
    });

    socket.on(SOCKET_EVENTS.CALL_END, ({ toUserId }: { toUserId: string }) => {
      logger.info('[SOCKET] CALL_END received', {
        userId,
        socketId: socket.id,
        toUserId,
        payload: { toUserId },
      });

      logger.info('[SOCKET] Cleaning up active call', {
        userId,
        toUserId,
        reason: 'Call ended by participant',
      });

      activeCalls.delete(userId);
      activeCalls.delete(toUserId);

      logger.info('[SOCKET] Broadcasting CALL_ENDED to peer', {
        toUserId,
        fromUserId: userId,
        activeCallsCount: activeCalls.size,
      });

      io.to(toUserId).emit(SOCKET_EVENTS.CALL_ENDED, { fromUserId: userId });
      logger.debug('[SOCKET] CALL_ENDED emitted', { toUserId, fromUserId: userId });
    });

    // ── webrtc:offer ──────────────────────────────────────────────────────
    // Send SDP offer to peer for WebRTC connection establishment
    socket.on(
      SOCKET_EVENTS.WEBRTC_OFFER,
      ({ toUserId, offer }: { toUserId: string; offer: RTCSessionDescriptionInit }) => {
        logger.info('[WEBRTC] WEBRTC_OFFER received', {
          userId,
          socketId: socket.id,
          toUserId,
          offerType: offer?.type,
          hasSdp: !!offer?.sdp,
          sdpLength: offer?.sdp?.length,
        });

        logger.info('[WEBRTC] Broadcasting WEBRTC_OFFER to peer', {
          toUserId,
          fromUserId: userId,
          offerType: offer?.type,
        });

        io.to(toUserId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
          fromUserId: userId,
          offer,
        });

        logger.debug('[WEBRTC] WEBRTC_OFFER emitted', {
          toUserId,
          fromUserId: userId,
        });
      }
    );

    // ── webrtc:answer ─────────────────────────────────────────────────────
    // Send SDP answer to peer to complete WebRTC handshake
    socket.on(
      SOCKET_EVENTS.WEBRTC_ANSWER,
      ({ toUserId, answer }: { toUserId: string; answer: RTCSessionDescriptionInit }) => {
        logger.info('[WEBRTC] WEBRTC_ANSWER received', {
          userId,
          socketId: socket.id,
          toUserId,
          answerType: answer?.type,
          hasSdp: !!answer?.sdp,
          sdpLength: answer?.sdp?.length,
        });

        logger.info('[WEBRTC] Broadcasting WEBRTC_ANSWER to peer', {
          toUserId,
          fromUserId: userId,
          answerType: answer?.type,
        });

        io.to(toUserId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
          fromUserId: userId,
          answer,
        });

        logger.debug('[WEBRTC] WEBRTC_ANSWER emitted', {
          toUserId,
          fromUserId: userId,
        });
      }
    );

    // ── webrtc:ice ────────────────────────────────────────────────────────
    // Exchange ICE candidates for NAT traversal
    socket.on(
      SOCKET_EVENTS.WEBRTC_ICE,
      ({ toUserId, candidate }: { toUserId: string; candidate: RTCIceCandidateInit }) => {
        logger.debug('[WEBRTC] WEBRTC_ICE received', {
          userId,
          socketId: socket.id,
          toUserId,
          // candidateType: candidate?.type,
          hasCandidate: !!candidate?.candidate,
          candidateLength: candidate?.candidate?.length,
        });

        logger.debug('[WEBRTC] Broadcasting WEBRTC_ICE to peer', {
          toUserId,
          fromUserId: userId,
        });

        io.to(toUserId).emit(SOCKET_EVENTS.WEBRTC_ICE, {
          fromUserId: userId,
          candidate,
        });

        logger.debug('[WEBRTC] WEBRTC_ICE emitted', {
          toUserId,
          fromUserId: userId,
        });
      }
    );

    // ── disconnect ────────────────────────────────────────────────────

    socket.on('disconnect', (reason: string) => {
      logger.info('[SOCKET] Disconnect initiated', {
        socketId: socket.id,
        userId,
        reason,
        wasOnline: onlineUsers.has(userId),
      });

      const wasOnline = onlineUsers.has(userId);
      onlineUsers.delete(userId);

      logger.info('[SOCKET] User removed from online set', {
        userId,
        wasOnline,
        remainingOnlineUsers: onlineUsers.size,
      });

      logger.info('[SOCKET] Broadcasting USER_OFFLINE to all clients', {
        userId,
        broadcastToAll: true,
      });

      io.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
      logger.debug('[SOCKET] USER_OFFLINE emitted', { userId });

      // Clean up typing timeouts for this user
      let typingTimeoutsCleared = 0;
      for (const [key, timer] of typingTimeouts.entries()) {
        if (key.startsWith(`${userId}:`)) {
          clearTimeout(timer);
          typingTimeouts.delete(key);
          typingTimeoutsCleared++;
        }
      }

      if (typingTimeoutsCleared > 0) {
        logger.info('[SOCKET] Cleared typing timeouts', {
          userId,
          timeoutsCleared: typingTimeoutsCleared,
          remainingTypingTimeouts: typingTimeouts.size,
        });
      }

      // End any active call
      const peer = activeCalls.get(userId);
      if (peer) {
        logger.info('[SOCKET] Ending active call due to disconnect', {
          userId,
          peerId: peer,
          reason: `Peer disconnected (${reason})`,
        });

        io.to(peer).emit(SOCKET_EVENTS.CALL_ENDED, { fromUserId: userId });
        logger.debug('[SOCKET] CALL_ENDED emitted to peer', {
          toUserId: peer,
          fromUserId: userId,
          reason,
        });

        activeCalls.delete(peer);
        activeCalls.delete(userId);

        logger.info('[SOCKET] Active call cleaned up', {
          userId,
          peerId: peer,
          activeCallsRemaining: activeCalls.size,
        });
      }

      logger.info('[SOCKET] Disconnect complete', {
        socketId: socket.id,
        userId,
        onlineUsersRemaining: onlineUsers.size,
        activeCallsRemaining: activeCalls.size,
        typingTimeoutsRemaining: typingTimeouts.size,
      });
    });
  });
}
