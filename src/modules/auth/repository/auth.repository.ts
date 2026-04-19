// ─────────────────────────────────────────────────────────────────────────────
// auth/repository/auth.repository.ts
// All DB queries for authentication. No business logic here.
// ─────────────────────────────────────────────────────────────────────────────
import type { IUser } from '../../../modules/users/user.model';
import { User } from '../../../modules/users/user.model';

export const authRepository = {
  findByEmail: (email: string) => User.findOne({ email: email.toLowerCase() }).select('+password'),

  findByEmailOrUsername: (email: string, username: string) =>
    User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] }),

  findByGoogleId: (googleId: string) => User.findOne({ googleId }),

  findById: (id: string) =>
    User.findById(id).select('-password -passwordResetToken -passwordResetExpires'),

  findByResetToken: (hashedToken: string) =>
    User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }),

  create: (data: Partial<IUser>) => User.create(data),

  updateById: (id: string, updates: Partial<IUser>) =>
    User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select(
      '-password -passwordResetToken -passwordResetExpires'
    ),

  linkGoogle: (userId: string, googleId: string, avatar?: string) =>
    User.findByIdAndUpdate(
      userId,
      {
        googleId,
        isEmailVerified: true,
        ...(avatar ? { avatar } : {}),
      },
      { new: true }
    ).select('-password'),
};
