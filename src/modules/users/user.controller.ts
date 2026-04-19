import type { Request, Response } from 'express';

import { AppError } from '../../shared/errors/AppError';
import { HTTP } from '../../shared/constants';
import { privacySettingsSchema, notificationPrefsSchema } from '../../shared/validators';

import { listUsers } from './user.service';
import { User } from './user.model';

// GET /api/users?q=&cursor=&limit=
export async function getUsers(req: Request, res: Response) {
  const result = await listUsers({
    currentUserId: req.user!.userId,
    q: req.query.q as string | undefined,
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  res.json({ success: true, ...result });
}

// PUT /api/users/me
export async function updateMe(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { username, avatar, bio } = req.body;
  const update: Record<string, string> = {};
  if (username) update.username = username;
  if (avatar !== undefined) update.avatar = avatar;
  if (bio !== undefined) update.bio = bio;
  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).select('-password -passwordResetToken -passwordResetExpires');
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user });
}

// GET /api/users/me/privacy
export async function getPrivacy(req: Request, res: Response) {
  const user = await User.findById(req.user!.userId).select('privacy').lean();
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user.privacy });
}

// PUT /api/users/me/privacy
export async function updatePrivacy(req: Request, res: Response) {
  const parsed = privacySettingsSchema.parse(req.body);
  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) updateFields[`privacy.${k}`] = v;
  }
  const user = await User.findByIdAndUpdate(req.user!.userId, updateFields, { new: true })
    .select('privacy')
    .lean();
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user.privacy });
}

// GET /api/users/me/notifications
export async function getNotificationPrefs(req: Request, res: Response) {
  const user = await User.findById(req.user!.userId).select('notificationPrefs').lean();
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user.notificationPrefs });
}

// PUT /api/users/me/notifications
export async function updateNotificationPrefs(req: Request, res: Response) {
  const parsed = notificationPrefsSchema.parse(req.body);
  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) updateFields[`notificationPrefs.${k}`] = v;
  }
  const user = await User.findByIdAndUpdate(req.user!.userId, updateFields, { new: true })
    .select('notificationPrefs')
    .lean();
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user.notificationPrefs });
}

// GET /api/users/me/blocked
export async function getBlockedUsers(req: Request, res: Response) {
  const user = await User.findById(req.user!.userId)
    .select('blockedUsers')
    .populate('blockedUsers', '_id username avatar email')
    .lean();
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND);
  res.json({ success: true, data: user.blockedUsers });
}

// POST /api/users/:id/block
export async function blockUser(req: Request, res: Response) {
  const targetId = req.params.id;
  if (targetId === req.user!.userId) throw new AppError('Cannot block yourself', HTTP.BAD_REQ);
  await User.findByIdAndUpdate(req.user!.userId, { $addToSet: { blockedUsers: targetId } });
  res.json({ success: true, message: 'User blocked' });
}

// DELETE /api/users/:id/block
export async function unblockUser(req: Request, res: Response) {
  const targetId = req.params.id;
  await User.findByIdAndUpdate(req.user!.userId, { $pull: { blockedUsers: targetId } });
  res.json({ success: true, message: 'User unblocked' });
}

// DELETE /api/users/me — account deletion
export async function deleteAccount(req: Request, res: Response) {
  await User.findByIdAndDelete(req.user!.userId);
  res.clearCookie('relay_token');
  res.json({ success: true, message: 'Account deleted' });
}
