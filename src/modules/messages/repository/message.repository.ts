// ─────────────────────────────────────────────────────────────────────────────
// messages/repository/message.repository.ts
// All DB queries for messages. No business logic here.
// ─────────────────────────────────────────────────────────────────────────────
import type { Types } from 'mongoose';

import { Message } from '../message.model';

interface ReplyToInput {
  messageId: Types.ObjectId;
  content: string;
  senderName: string;
}

interface CreateMessageData {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: string;
  attachments: Array<{
    name: string;
    mimeType: string;
    size: number;
    url: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'text';
  }>;
  replyTo?: ReplyToInput;
}

export const messageRepository = {
  findById: (id: string) => Message.findById(id),

  findOwnedById: (id: string, senderId: string) =>
    Message.findOne({ _id: id, senderId, isDeleted: false }),

  create: (data: CreateMessageData) => Message.create(data),

  paginated: (conversationId: Types.ObjectId, cursor: Types.ObjectId | null, limit: number) => {
    const query: Record<string, unknown> = { conversationId };
    if (cursor) query._id = { $lt: cursor };
    return Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('senderId', '_id username avatar')
      .lean();
  },

  unreadInConversation: (conversationId: string, excludeSenderId: string) =>
    Message.find({
      conversationId,
      senderId: { $ne: excludeSenderId },
      readBy: { $nin: [excludeSenderId] },
    }).select('_id'),

  markManyRead: (ids: string[], userId: string) =>
    Message.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: userId } }),

  softDelete: (id: string) =>
    Message.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      content: '[Message deleted]',
    }),

  edit: (id: string, content: string) =>
    Message.findByIdAndUpdate(id, { content, isEdited: true, editedAt: new Date() }, { new: true }),

  addReaction: (messageId: string, userId: string, username: string, emoji: string) =>
    Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { reactions: { userId, username, emoji } } },
      { new: true }
    ),

  removeReaction: (messageId: string, userId: string, emoji: string) =>
    Message.findByIdAndUpdate(
      messageId,
      { $pull: { reactions: { userId, emoji } } },
      { new: true }
    ),

  // New: star/unstar
  star: (id: string, userId: string) =>
    Message.findByIdAndUpdate(id, { $addToSet: { starredBy: userId } }, { new: true }),

  unstar: (id: string, userId: string) =>
    Message.findByIdAndUpdate(id, { $pull: { starredBy: userId } }, { new: true }),

  // New: pin/unpin
  pin: (id: string) =>
    Message.findByIdAndUpdate(id, { isPinned: true, pinnedAt: new Date() }, { new: true }),

  unpin: (id: string) =>
    Message.findByIdAndUpdate(id, { isPinned: false, $unset: { pinnedAt: '' } }, { new: true }),

  pinnedInConversation: (conversationId: string) =>
    Message.find({ conversationId, isPinned: true, isDeleted: false })
      .populate('senderId', '_id username avatar')
      .sort({ pinnedAt: -1 })
      .lean(),

  // New: scheduled
  createScheduled: (data: CreateMessageData & { scheduledAt: Date }) =>
    Message.create({ ...data, isScheduled: true }),

  findScheduled: (senderId: string) =>
    Message.find({ senderId, isScheduled: true, isDeleted: false }).sort({ scheduledAt: 1 }).lean(),

  deleteScheduled: (id: string, senderId: string) =>
    Message.findOneAndDelete({ _id: id, senderId, isScheduled: true }),

  // Search messages with text index
  searchMessages: (filter: any, limit: number, skip: number) =>
    Message.find(filter)
      .select('_id conversationId senderId content createdAt')
      .populate('senderId', '_id username avatar')
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
};
