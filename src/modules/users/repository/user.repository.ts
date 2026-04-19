// ─────────────────────────────────────────────────────────────────────────────
// users/repository/user.repository.ts
// All DB queries for users. No business logic here.
// ─────────────────────────────────────────────────────────────────────────────
import type { Types } from 'mongoose';

import { User } from '../user.model';

const PUBLIC_FIELDS = '_id username email avatar isOnline';

export const userRepository = {
  findById: (id: string) => User.findById(id).select(PUBLIC_FIELDS).lean(),

  findByUsername: (username: string) => User.findOne({ username }).select(PUBLIC_FIELDS).lean(),

  searchExcluding: (
    currentUserId: Types.ObjectId,
    query: string | undefined,
    cursor: Types.ObjectId | null,
    limit: number
  ) => {
    const filter: Record<string, unknown> = { _id: { $ne: currentUserId } };

    if (query?.trim()) {
      filter.$or = [
        { username: { $regex: query.trim(), $options: 'i' } },
        { email: { $regex: query.trim(), $options: 'i' } },
      ];
    }

    if (cursor) {
      (filter._id as Record<string, unknown>).$gt = cursor;
    }

    return User.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .select(PUBLIC_FIELDS)
      .lean();
  },

  findByUsernameRegex: (regex: RegExp) => User.find({ username: regex }).select('_id').lean(),

  updateById: (id: string, updates: Record<string, unknown>) =>
    User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select(PUBLIC_FIELDS),

  setOnline: (userId: string, isOnline: boolean) => User.findByIdAndUpdate(userId, { isOnline }),
};
