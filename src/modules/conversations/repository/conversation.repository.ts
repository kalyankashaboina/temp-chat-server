// ─────────────────────────────────────────────────────────────────────────────
// conversations/repository/conversation.repository.ts
// All DB queries for conversations. No business logic here.
// ─────────────────────────────────────────────────────────────────────────────
import type { Types } from 'mongoose';

import { Conversation } from '../conversation.model';

const PARTICIPANT_FIELDS = '_id username avatar isOnline';
const LAST_MSG_FIELDS = '_id content senderId createdAt isDeleted';

export const conversationRepository = {
  findDirect: (userA: Types.ObjectId, userB: Types.ObjectId) =>
    Conversation.findOne({
      type: 'direct',
      participants: { $all: [userA, userB], $size: 2 },
    })
      .populate('participants', PARTICIPANT_FIELDS)
      .lean(),

  findById: (id: string) =>
    Conversation.findById(id).populate('participants', PARTICIPANT_FIELDS).lean(),

  findByIdWithMessages: (id: string) =>
    Conversation.findById(id)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate({ path: 'lastMessage', select: LAST_MSG_FIELDS })
      .lean(),

  create: (data: {
    type: 'direct' | 'group';
    participants: Types.ObjectId[];
    name?: string;
    createdBy?: Types.ObjectId;
  }) => Conversation.create(data),

  paginatedForUser: (userId: Types.ObjectId, cursor: Types.ObjectId | null, limit: number) => {
    const query: Record<string, unknown> = { participants: userId };
    if (cursor) query._id = { $lt: cursor };
    return Conversation.find(query)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate({ path: 'lastMessage', select: LAST_MSG_FIELDS })
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .lean();
  },

  searchForUser: (
    userId: Types.ObjectId,
    matchingUserIds: Types.ObjectId[],
    nameRegex: RegExp,
    cursor: Types.ObjectId | null,
    limit: number
  ) => {
    const query: Record<string, unknown> = {
      participants: userId,
      $or: [{ name: nameRegex }, { type: 'direct', participants: { $in: matchingUserIds } }],
    };
    if (cursor) query._id = { $lt: cursor };
    return Conversation.find(query)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate({ path: 'lastMessage', select: LAST_MSG_FIELDS })
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .lean();
  },

  updateLastMessage: (conversationId: string, messageId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: messageId,
      updatedAt: new Date(),
    }),

  memberIds: (conversationId: string) =>
    Conversation.findById(conversationId).select('participants').lean(),

  findByParticipant: (userId: string) =>
    Conversation.find({ participants: userId }).select('_id').lean(),

  // Group management
  addMember: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { participants: userId }, updatedAt: new Date() },
      { new: true }
    ).populate('participants', PARTICIPANT_FIELDS),

  removeMember: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { $pull: { participants: userId }, updatedAt: new Date() },
      { new: true }
    ).populate('participants', PARTICIPANT_FIELDS),

  updateGroupInfo: (conversationId: string, updates: { name?: string; avatar?: string }) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('participants', PARTICIPANT_FIELDS),

  // Mute/Archive
  muteConversation: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { mutedBy: userId } },
      { new: true }
    ),

  unmuteConversation: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(conversationId, { $pull: { mutedBy: userId } }, { new: true }),

  archiveConversation: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { archivedBy: userId } },
      { new: true }
    ),

  unarchiveConversation: (conversationId: string, userId: Types.ObjectId) =>
    Conversation.findByIdAndUpdate(
      conversationId,
      { $pull: { archivedBy: userId } },
      { new: true }
    ),
};
