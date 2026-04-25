import Bull, { Queue, Job } from 'bull';
import { logger } from '../shared/utils/logger';
import { Message } from '../modules/messages/message.model';
import { Conversation } from '../modules/conversations/conversation.model';
import { getIO } from '../modules/socket/socket.events'; // BUG FIX #4
import { SOCKET_EVENTS } from '../shared/constants'; // BUG FIX #4
import { env } from '../config/env';

// Queue configuration
const REDIS_CONFIG = {
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};

// Message processing queue
export const messageQueue: Queue = new Bull('message-processing', {
  redis: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Conversation update queue
export const conversationQueue: Queue = new Bull('conversation-updates', {
  redis: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

// Read receipt queue
export const readReceiptQueue: Queue = new Bull('read-receipts', {
  redis: REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

/**
 * Job Data Interfaces
 */
interface SaveMessageJobData {
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  tempId: string; // Client-generated ID for deduplication
  attachments?: any[];
  replyTo?: string;
}

interface UpdateConversationJobData {
  conversationId: string;
  lastMessage: string;
  lastMessageAt: Date;
}

interface ReadReceiptJobData {
  conversationId: string;
  userId: string;
  messageIds: string[];
}

/**
 * MESSAGE QUEUE PROCESSORS
 */

// Process message saving (ASYNC - don't block socket)
messageQueue.process(async (job: Job<SaveMessageJobData>) => {
  const { conversationId, senderId, content, type, tempId, attachments, replyTo } = job.data;

  logger.info(`Processing message save: ${tempId}`);

  try {
    // Create message in database
    const message = await (Message.create as any)({
      conversationId,
      senderId,
      content,
      type,
      attachments: attachments || [],
      deliveredTo: [],
      readBy: [],
    });

    logger.info('Message saved to DB', { messageId: message._id });

    // BUG FIX #4: Emit message:confirmed with real ID
    try {
      const io = getIO();
      io.to(conversationId).emit(SOCKET_EVENTS.MSG_CONFIRMED, {
        tempId,
        realId: message._id.toString(),
        conversationId,
        createdAt: message.createdAt,
      });
      logger.info('message:confirmed emitted', { tempId, realId: message._id });
    } catch (error) {
      logger.error('Failed to emit message:confirmed', error);
      // Don't fail the job - message is already saved
    }

    // Queue conversation update (non-blocking)
    await conversationQueue.add({
      conversationId,
      lastMessage: message._id, // OK - FIX: Send message ID, not content!
      lastMessageAt: message.createdAt,
    });

    return {
      messageId: message._id.toString(),
      tempId,
      createdAt: message.createdAt,
    };
  } catch (error) {
    logger.error('Failed to save message:', error);
    throw error; // Will trigger retry
  }
});

// Process conversation updates
conversationQueue.process(async (job: Job<UpdateConversationJobData>) => {
  const { conversationId, lastMessage, lastMessageAt } = job.data;

  try {
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage,
      lastMessageAt,
      $inc: { messageCount: 1 },
    });

    logger.info(`OK - Conversation updated: ${conversationId}`);
  } catch (error) {
    logger.error('Failed to update conversation:', error);
    throw error;
  }
});

// Process read receipts
readReceiptQueue.process(async (job: Job<ReadReceiptJobData>) => {
  const { conversationId, userId, messageIds } = job.data;

  try {
    // Update all unread messages in one query
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        conversationId,
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
        $set: { status: 'read' },
      }
    );

    logger.info(`OK - Read receipts processed for ${messageIds.length} messages`);
  } catch (error) {
    logger.error('Failed to process read receipts:', error);
    throw error;
  }
});

/**
 * QUEUE EVENT HANDLERS
 */

messageQueue.on('completed', (job, result) => {
  logger.info(`Message job completed: ${job.id}`, result);
});

messageQueue.on('failed', (job, err) => {
  logger.error(`Message job failed: ${job?.id}`, err);
});

messageQueue.on('stalled', (job) => {
  logger.warn(`Message job stalled: ${job.id}`);
});

conversationQueue.on('failed', (job, err) => {
  logger.error(`Conversation update failed: ${job?.id}`, err);
});

readReceiptQueue.on('failed', (job, err) => {
  logger.error(`Read receipt job failed: ${job?.id}`, err);
});

/**
 * HELPER FUNCTIONS FOR SOCKET HANDLERS
 */

/**
 * Queue a message for async DB save (NON-BLOCKING)
 * Socket.IO handler calls this and returns immediately
 */
export async function queueMessageSave(data: SaveMessageJobData): Promise<void> {
  await messageQueue.add(data, {
    priority: 1, // High priority
    timeout: 10000,
  });
}

/**
 * Queue conversation update (NON-BLOCKING)
 */
export async function queueConversationUpdate(data: UpdateConversationJobData): Promise<void> {
  await conversationQueue.add(data, {
    priority: 2, // Lower priority than messages
  });
}

/**
 * Queue read receipts (NON-BLOCKING)
 */
export async function queueReadReceipts(data: ReadReceiptJobData): Promise<void> {
  await readReceiptQueue.add(data, {
    priority: 3, // Lowest priority
  });
}

/**
 * Get queue stats for monitoring
 */
export async function getQueueStats() {
  const [messageStats, conversationStats, readReceiptStats] = await Promise.all([
    messageQueue.getJobCounts(),
    conversationQueue.getJobCounts(),
    readReceiptQueue.getJobCounts(),
  ]);

  return {
    messages: messageStats,
    conversations: conversationStats,
    readReceipts: readReceiptStats,
  };
}

/**
 * Graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  await messageQueue.close();
  await conversationQueue.close();
  await readReceiptQueue.close();
  logger.info('All queues closed');
}

export default {
  messageQueue,
  conversationQueue,
  readReceiptQueue,
  queueMessageSave,
  queueConversationUpdate,
  queueReadReceipts,
  getQueueStats,
  closeQueues,
};
