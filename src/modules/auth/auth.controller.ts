// ─────────────────────────────────────────────────────────────────────────────
// auth/auth.controller.ts — HTTP layer only. Delegates to service.
// ─────────────────────────────────────────────────────────────────────────────
import type { Request, Response, NextFunction } from 'express';

import { AppError } from '../../shared/errors/AppError';
import { AUTH } from '../../shared/constants';

import * as service from './auth.service';

// ── Cookie helper ─────────────────────────────────────────────────────────────

function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(AUTH.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(AUTH.COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.register(req.body);
    setAuthCookie(res, result.token);
    return res.status(201).json({ success: true, data: result.user });
  } catch (err) {
    next(err);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.login(req.body);
    setAuthCookie(res, result.token);
    return res.status(200).json({ success: true, data: result.user });
  } catch (err) {
    next(err);
  }
}

// ── Google login ──────────────────────────────────────────────────────────────

export async function googleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.googleAuth(req.body);
    setAuthCookie(res, result.token);
    return res.status(200).json({ success: true, data: result.user });
  } catch (err) {
    next(err);
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response) {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out' });
}

// ── Me ────────────────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response) {
  const u = (req as any).user;
  return res.status(200).json({
    success: true,
    data: {
      id: u._id.toString(),
      email: u.email,
      name: u.username,
      avatar: u.avatar ?? '',
      bio: u.bio ?? '',
      isEmailVerified: u.isEmailVerified,
      provider: u.provider,
    },
  });
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await service.forgotPassword(req.body);
    return res.status(200).json({
      success: true,
      message: 'If an account exists, a reset link has been sent',
    });
  } catch (err) {
    next(err);
  }
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await service.resetPassword(req.body);
    return res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}

// ── Update profile ────────────────────────────────────────────────────────────

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user._id.toString();
    const updated = await service.updateProfile(userId, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Change password (authenticated) ──────────────────────────────────────────

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user._id.toString();
    const { password } = req.body;
    if (!password) return next(new AppError('New password is required', 400));
    await service.changePassword(userId, password);
    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
