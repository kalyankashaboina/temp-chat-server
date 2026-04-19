import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { HTTP } from '../../shared/constants';
import { Conversation } from '../conversations/conversation.model';
import { scheduledMessageSchema } from '../../shared/validators';

import { getPaginatedMessages, searchMessages } from './message.service';
import { Message } from './message.model';
import { messageRepository } from './repository/message.repository';

// GET /api/conversations/:conversationId/messages
export async function getConversationMessages(req: Request, res: Response) {
  const { conversationId } = req.params;
  const userId = req.user!.userId;

  // Verify membership
  const convo = await Conversation.findOne({ _id: conversationId, participants: userId }).select(
    '_id'
  );
  if (!convo) throw new AppError('Conversation not found or access denied', HTTP.FORBIDDEN);

  const result = await getPaginatedMessages({
    conversationId,
    cursor: req.query.cursor as string | undefined,
    limit: Number(req.query.limit) || 40,
  });

  res.json({ success: true, ...result });
}

// PUT /api/messages/:id/star
export async function starMessage(req: Request, res: Response) {
  const msg = await messageRepository.star(req.params.id, req.user!.userId);
  if (!msg) throw new AppError('Message not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: msg });
}

// DELETE /api/messages/:id/star
export async function unstarMessage(req: Request, res: Response) {
  const msg = await messageRepository.unstar(req.params.id, req.user!.userId);
  if (!msg) throw new AppError('Message not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: msg });
}

// PUT /api/messages/:id/pin
export async function pinMessage(req: Request, res: Response) {
  const msg = await Message.findById(req.params.id).lean();
  if (!msg) throw new AppError('Message not found', HTTP.NOT_FOUND);
  await messageRepository.pin(req.params.id);
  res.json({ success: true });
}

// DELETE /api/messages/:id/pin
export async function unpinMessage(req: Request, res: Response) {
  await messageRepository.unpin(req.params.id);
  res.json({ success: true });
}

// GET /api/conversations/:conversationId/pinned
export async function getPinnedMessages(req: Request, res: Response) {
  const { conversationId } = req.params;
  const userId = req.user!.userId;
  const convo = await Conversation.findOne({ _id: conversationId, participants: userId }).select(
    '_id'
  );
  if (!convo) throw new AppError('Access denied', HTTP.FORBIDDEN);
  const messages = await messageRepository.pinnedInConversation(conversationId);
  res.json({ success: true, data: messages });
}

// POST /api/messages/:id/forward
export async function forwardMessage(req: Request, res: Response) {
  const { toConversationId } = req.body;
  const userId = req.user!.userId;

  if (!toConversationId) throw new AppError('toConversationId is required', HTTP.BAD_REQ);

  const original = await Message.findById(req.params.id).lean();
  if (!original || (original as any).isDeleted)
    throw new AppError('Message not found', HTTP.NOT_FOUND);

  const destConvo = await Conversation.findOne({
    _id: toConversationId,
    participants: userId,
  }).select('_id');
  if (!destConvo) throw new AppError('Destination conversation not found', HTTP.FORBIDDEN);

  const forwarded = await Message.create({
    conversationId: new Types.ObjectId(toConversationId),
    senderId: new Types.ObjectId(userId),
    content: (original as any).content,
    type: (original as any).type,
    attachments: (original as any).attachments || [],
    forwardedFrom: (original as any).senderId?.toString(),
  });

  res.status(HTTP.CREATED).json({ success: true, data: forwarded });
}

// GET /api/messages/scheduled
export async function getScheduledMessages(req: Request, res: Response) {
  const messages = await messageRepository.findScheduled(req.user!.userId);
  res.json({ success: true, data: messages });
}

// POST /api/messages/scheduled
export async function createScheduledMessage(req: Request, res: Response) {
  const parsed = scheduledMessageSchema.parse({ ...req.body, senderId: req.user!.userId });
  const msg = await Message.create({
    conversationId: new Types.ObjectId(parsed.conversationId),
    senderId: new Types.ObjectId(parsed.senderId),
    content: parsed.content,
    type: 'text',
    attachments: [],
    isScheduled: true,
    scheduledAt: parsed.scheduledAt,
  });
  res.status(HTTP.CREATED).json({ success: true, data: msg });
}

// DELETE /api/messages/scheduled/:id
export async function deleteScheduledMessage(req: Request, res: Response) {
  const deleted = await messageRepository.deleteScheduled(req.params.id, req.user!.userId);
  if (!deleted) throw new AppError('Scheduled message not found', HTTP.NOT_FOUND);
  res.json({ success: true });
}

// GET /api/messages/search
export async function searchMessagesController(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { query, conversationId, senderId, limit, skip } = req.query;

  if (!query || typeof query !== 'string') {
    throw new AppError('Search query is required', HTTP.BAD_REQ);
  }

  const results = await searchMessages({
    userId,
    query,
    conversationId: conversationId as string | undefined,
    senderId: senderId as string | undefined,
    limit: limit ? Number(limit) : 20,
    skip: skip ? Number(skip) : 0,
  });

  res.json({ success: true, ...results });
}
