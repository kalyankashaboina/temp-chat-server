// ── Group Management Controllers ──────────────────────────────────────────────

import type { Request, Response } from 'express';
import { HTTP } from '../../shared/constants';
import * as conversationService from './conversation.service';

// POST /api/conversations/:id/members
export async function addMemberController(req: Request, res: Response) {
  const { id } = req.params;
  const { userId: newMemberId } = req.body;
  const currentUserId = req.user!.userId;

  const updated = await conversationService.addGroupMember(id, currentUserId, newMemberId);
  res.json({ success: true, data: updated });
}

// DELETE /api/conversations/:id/members/:userId
export async function removeMemberController(req: Request, res: Response) {
  const { id, userId: memberToRemove } = req.params;
  const currentUserId = req.user!.userId;

  const updated = await conversationService.removeGroupMember(id, currentUserId, memberToRemove);
  res.json({ success: true, data: updated });
}

// PATCH /api/conversations/:id
export async function updateGroupController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const { name, avatar } = req.body;

  const updated = await conversationService.updateGroupInfo(id, userId, { name, avatar });
  res.json({ success: true, data: updated });
}

// POST /api/conversations/:id/leave
export async function leaveGroupController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const updated = await conversationService.leaveGroup(id, userId);
  res.json({ success: true, data: updated });
}

// ── Mute / Archive Controllers ────────────────────────────────────────────────

// POST /api/conversations/:id/mute
export async function muteController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const result = await conversationService.muteConversation(id, userId);
  res.json(result);
}

// DELETE /api/conversations/:id/mute
export async function unmuteController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const result = await conversationService.unmuteConversation(id, userId);
  res.json(result);
}

// POST /api/conversations/:id/archive
export async function archiveController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const result = await conversationService.archiveConversation(id, userId);
  res.json(result);
}

// DELETE /api/conversations/:id/archive
export async function unarchiveController(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  const result = await conversationService.unarchiveConversation(id, userId);
  res.json(result);
}
