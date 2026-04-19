// ─────────────────────────────────────────────────────────────────────────────
// auth/auth.service.ts  — Business logic only.
// DB access via authRepository. Schemas from shared/validators.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger';
import { emailService } from '../../shared/services/email.service';
import { deriveUsername } from '../../shared/utils';
import { AUTH } from '../../shared/constants';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type RegisterInput,
  type LoginInput,
  type GoogleAuthInput,
  type UpdateProfileInput,
} from '../../shared/validators';
import type { IUser } from '../users/user.model';

import { authRepository } from './repository/auth.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: AUTH.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function safeUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.username,
    avatar: user.avatar ?? '',
    bio: user.bio ?? '',
    isEmailVerified: user.isEmailVerified,
    provider: user.provider,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(raw: RegisterInput) {
  const input = registerSchema.parse(raw); // throws ZodError if invalid

  const existing = await authRepository.findByEmailOrUsername(input.email, input.username);
  if (existing) {
    if (existing.email === input.email)
      throw new AppError('An account with this email already exists', 409);
    throw new AppError('Username is already taken', 409);
  }

  const hashed = await bcrypt.hash(input.password, AUTH.BCRYPT_ROUNDS);
  const user = await authRepository.create({
    username: input.username,
    email: input.email,
    password: hashed,
    provider: 'local',
    isEmailVerified: false,
  });

  emailService
    .sendWelcome(user.email, user.username)
    .catch((e) => logger.warn('Welcome email failed', { error: e }));

  logger.info('User registered', { userId: user._id });
  return { token: signToken(user._id.toString()), user: safeUser(user as IUser) };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(raw: LoginInput) {
  const input = loginSchema.parse(raw);
  const user = await authRepository.findByEmail(input.email);

  if (!user) throw new AppError('Invalid email or password', 401);

  if (user.provider === 'google' && !user.password)
    throw new AppError('This account uses Google sign-in. Please continue with Google.', 401);

  if (!user.password) throw new AppError('Invalid email or password', 401);

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) throw new AppError('Invalid email or password', 401);

  logger.info('Login successful', { userId: user._id });
  return { token: signToken(user._id.toString()), user: safeUser(user as unknown as IUser) };
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

export async function googleAuth(raw: GoogleAuthInput) {
  const { idToken } = googleAuthSchema.parse(raw);

  if (!googleClient || !env.GOOGLE_CLIENT_ID)
    throw new AppError('Google login is not configured on this server', 503);

  let payload: Record<string, unknown>;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload() as unknown as Record<string, unknown>;
  } catch (err) {
    logger.warn('Google token verification failed', { err });
    throw new AppError('Invalid Google token', 401);
  }

  const {
    sub: googleId,
    email,
    name,
    picture,
    email_verified,
  } = payload as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!email) throw new AppError('Google account has no email address', 400);

  const normalizedEmail = email.toLowerCase();
  let user = await authRepository.findByEmail(normalizedEmail);

  if (user) {
    if (!user.googleId) {
      // Link Google to existing local account
      if (!email_verified) throw new AppError('Cannot link — Google email is not verified', 403);
      await authRepository.linkGoogle(user._id.toString(), googleId, picture);
      user = (await authRepository.findByEmail(normalizedEmail))!;
    }
    // else: already linked — fall through to sign in
  } else {
    // New user via Google
    const base = (name ?? email.split('@')[0]) as string;
    const username = await _uniqueUsername(base);
    user = (await authRepository.create({
      email: normalizedEmail,
      username,
      avatar: picture ?? '',
      provider: 'google',
      googleId,
      isEmailVerified: !!email_verified,
    })) as unknown as Awaited<ReturnType<typeof authRepository.findByEmail>>;
    logger.info('New user via Google', { userId: (user as any)._id });
  }

  return {
    token: signToken((user as any)._id.toString()),
    user: safeUser(user as unknown as IUser),
  };
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPassword(raw: { email: string }) {
  const { email } = forgotPasswordSchema.parse(raw);
  const user = await authRepository.findByEmail(email);

  if (!user || (user.provider === 'google' && !user.password)) return; // silent

  const rawToken = crypto.randomBytes(AUTH.RESET_TOKEN_BYTES).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  await authRepository.updateById(user._id.toString(), {
    passwordResetToken: hashed,
    passwordResetExpires: Date.now() + AUTH.RESET_TTL_MS,
  });

  try {
    await emailService.sendPasswordReset(user.email, rawToken, user.username);
  } catch (err) {
    await authRepository.updateById(user._id.toString(), {
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });
    logger.error('Reset email failed', { error: err });
    throw new AppError('Failed to send reset email. Try again later.', 500);
  }
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPassword(raw: { token: string; password: string }) {
  const { token, password } = resetPasswordSchema.parse(raw);
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await authRepository.findByResetToken(hashed);

  if (!user) throw new AppError('Reset token is invalid or has expired', 400);

  const newHash = await bcrypt.hash(password, AUTH.BCRYPT_ROUNDS);
  await authRepository.updateById(user._id.toString(), {
    password: newHash,
    passwordResetToken: undefined,
    passwordResetExpires: undefined,
    provider: 'local',
  });
}

// ── Update profile ────────────────────────────────────────────────────────────

export async function updateProfile(userId: string, raw: UpdateProfileInput) {
  const input = updateProfileSchema.parse(raw);

  if (input.username) {
    const taken = await authRepository.findByEmailOrUsername('', input.username);
    if (taken && taken._id.toString() !== userId) throw new AppError('Username already taken', 409);
  }

  const updates: Record<string, unknown> = {};
  if (input.username !== undefined) updates.username = input.username;
  if (input.avatar !== undefined) updates.avatar = input.avatar;
  if (input.bio !== undefined) updates.bio = input.bio;

  const updated = await authRepository.updateById(userId, updates);
  if (!updated) throw new AppError('User not found', 404);
  return safeUser(updated as unknown as IUser);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _uniqueUsername(base: string): Promise<string> {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 30) || 'user';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? clean : deriveUsername(base);
    const exists = await authRepository.findByEmailOrUsername('', candidate);
    if (!exists) return candidate;
  }
  return deriveUsername(base);
}

// ── Change password (authenticated) ──────────────────────────────────────────

export async function changePassword(userId: string, newPassword: string) {
  const { password: newPwd } = resetPasswordSchema.parse({ token: 'dummy', password: newPassword });

  const hashed = await bcrypt.hash(newPwd, AUTH.BCRYPT_ROUNDS);
  const user = await authRepository.updateById(userId, { password: hashed, provider: 'local' });
  if (!user) throw new AppError('User not found', 404);
}
