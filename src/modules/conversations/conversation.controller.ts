import type { Request, Response } from 'express';

import { parseIntQuery } from '../../shared/utils';
import { PAGINATION } from '../../shared/constants';

import {
  createOrGetDirectConversation,
  createGroupConversation,
  getPaginatedConversations,
  searchConversations,
  addGroupMember,
  removeGroupMember,
  updateGroupInfo,
  leaveGroup as leaveGroupFunc,
  muteConversation,
  unmuteConversation,
  archiveConversation,
  unarchiveConversation,
} from './conversation.service';

export async function getSidebarConversations(req: Request, res: Response) {
  try {
    const userId = (req as any).user._id.toString();
    const limit = parseIntQuery(req.query.limit, PAGINATION.DEFAULT_LIMIT);
    const cursor = req.query.cursor as string | undefined;
    const result = await getPaginatedConversations({ userId, cursor, limit });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
}

export async function createConversation(req: Request, res: Response) {
  try {
    const userId = (req as any).user._id.toString();
    const targetUserId = req.body.targetUserId ?? req.body.userId;
    if (!targetUserId)
      return res.status(400).json({ success: false, message: 'targetUserId is required' });
    const result = await createOrGetDirectConversation({ userId, targetUserId });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
}

export async function searchSidebarConversations(req: Request, res: Response) {
  try {
    const userId = (req as any).user._id.toString();
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ success: false, message: 'q is required' });
    const limit = parseIntQuery(req.query.limit, PAGINATION.DEFAULT_LIMIT);
    const cursor = req.query.cursor as string | undefined;
    const result = await searchConversations({ userId, query, cursor, limit });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
}

export async function createGroup(req: Request, res: Response) {
  try {
    const creatorId = (req as any).user._id.toString();
    const { name, memberIds } = req.body;
    const result = await createGroupConversation({ creatorId, name, memberIds });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 400).json({ success: false, message: err.message });
  }
}

// ── Group Management ──────────────────────────────────────────────────────────

export async function addMember(req: Request, res: Response) {
  const { id } = req.params;
  const { userId: newMemberId } = req.body;
  const currentUserId = req.user!.userId;
  const updated = await addGroupMember(id, currentUserId, newMemberId);
  res.json({ success: true, data: updated });
}

export async function removeMember(req: Request, res: Response) {
  const { id, userId: memberToRemove } = req.params;
  const currentUserId = req.user!.userId;
  const updated = await removeGroupMember(id, currentUserId, memberToRemove);
  res.json({ success: true, data: updated });
}

export async function updateGroup(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const { name, avatar } = req.body;
  const updated = await updateGroupInfo(id, userId, { name, avatar });
  res.json({ success: true, data: updated });
}

export async function leaveGroup(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const updated = await leaveGroupFunc(id, userId);
  res.json({ success: true, data: updated });
}

// ── Mute / Archive ────────────────────────────────────────────────────────────

export async function mute(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await muteConversation(id, userId);
  res.json(result);
}

export async function unmute(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await unmuteConversation(id, userId);
  res.json(result);
}

export async function archive(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await archiveConversation(id, userId);
  res.json(result);
}

export async function unarchive(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await unarchiveConversation(id, userId);
  res.json(result);
}
