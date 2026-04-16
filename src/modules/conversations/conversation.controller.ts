import type { Request, Response } from 'express';

import { parseIntQuery } from '../../shared/utils';
import { PAGINATION }    from '../../shared/constants';

import {
  createOrGetDirectConversation,
  createGroupConversation,
  getPaginatedConversations,
  searchConversations,
} from './conversation.service';

export async function getSidebarConversations(req: Request, res: Response) {
  try {
    const userId  = (req as any).user._id.toString();
    const limit   = parseIntQuery(req.query.limit, PAGINATION.DEFAULT_LIMIT);
    const cursor  = req.query.cursor as string | undefined;
    const result  = await getPaginatedConversations({ userId, cursor, limit });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
}

export async function createConversation(req: Request, res: Response) {
  try {
    const userId       = (req as any).user._id.toString();
    const targetUserId = req.body.targetUserId ?? req.body.userId;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId is required' });
    const result = await createOrGetDirectConversation({ userId, targetUserId });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
  }
}

export async function searchSidebarConversations(req: Request, res: Response) {
  try {
    const userId = (req as any).user._id.toString();
    const query  = req.query.q as string;
    if (!query) return res.status(400).json({ success: false, message: 'q is required' });
    const limit  = parseIntQuery(req.query.limit, PAGINATION.DEFAULT_LIMIT);
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
