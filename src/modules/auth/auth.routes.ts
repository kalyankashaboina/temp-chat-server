import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { RATE_LIMITS } from '../../shared/constants';
import { validate } from '../../shared/middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../../shared/validators';

import {
  register,
  login,
  googleLogin,
  logout,
  me,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
} from './auth.controller';
import { requireAuth } from './auth.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
  max: RATE_LIMITS.AUTH_MAX,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: RATE_LIMITS.FORGOT_WINDOW_MS,
  max: RATE_LIMITS.FORGOT_MAX,
  message: { success: false, message: 'Too many password reset requests. Try again later.' },
});

// Public routes with validation
router.post('/register', validate(registerSchema), authLimiter, register);
router.post('/login', validate(loginSchema), authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/logout', logout);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotLimiter, forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authLimiter, resetPassword);

// Protected routes with validation
router.get('/me', requireAuth, me);
router.put('/me', requireAuth, validate(updateProfileSchema), updateProfile);
router.post('/change-password', requireAuth, validate(changePasswordSchema), changePassword);

export default router;
