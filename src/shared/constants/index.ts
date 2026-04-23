// ─────────────────────────────────────────────────────────────────────────────
// shared/constants/index.ts
// Single source of truth for every magic string / number in the backend.
// Import from here — never hard-code in controllers, services, or socket files.
// ─────────────────────────────────────────────────────────────────────────────

// ── HTTP status codes ────────────────────────────────────────────────────────
export const HTTP = {
  OK: 200,
  CREATED: 201,
  BAD_REQ: 400,
  UNAUTH: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_LARGE: 413,
  SERVER_ERR: 500,
  UNAVAIL: 503,
} as const;

// ── API route prefixes ───────────────────────────────────────────────────────
export const API_ROUTES = {
  AUTH: '/api/auth',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api', // /api/conversations/:id/messages
  USERS: '/api/users',
  UPLOAD: '/api/upload',
} as const;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const AUTH = {
  COOKIE_NAME: 'relay_token',
  JWT_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  RESET_TOKEN_BYTES: 32,
  RESET_TTL_MS: 15 * 60 * 1000, // 15 minutes
  LOCAL_STORAGE_KEY: 'relay-user',
} as const;

// ── Pagination defaults ──────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  MSG_DEFAULT_LIMIT: 40,
  USERS_MAX_LIMIT: 100,
} as const;

// ── File upload ──────────────────────────────────────────────────────────────
export const UPLOAD = {
  MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  ALLOWED_MIMES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ] as readonly string[],
} as const;

// ── Socket event names ───────────────────────────────────────────────────────
// Both BE and FE should import from their own constants file.
// Keep these in sync manually (or share via a package later).
export const SOCKET_EVENTS = {
  // Presence
  PRESENCE_INIT: 'presence:init',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',

  // Messages
  MSG_SEND: 'message:send',
  MSG_NEW: 'message:new',
  MSG_SENT: 'message:sent',
  MSG_CONFIRMED: 'message:confirmed', // BUG FIX #4: Real ID from queue processor
  MSG_DELIVERED: 'message:delivered',
  MSG_READ: 'message:read',
  MSG_DELETE: 'message:delete',
  MSG_DELETED: 'message:deleted',
  MSG_EDIT: 'message:edit',
  MSG_EDITED: 'message:edited',
  MSG_FAILED: 'message:failed',

  // Reactions
  MSG_REACT: 'message:react',
  MSG_UNREACT: 'message:unreact',
  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVED: 'reaction:removed',

  // Typing
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Conversations
  CONV_READ: 'conversation:read',
  CONV_NEW: 'conversation:new',

  // Calls
  CALL_INITIATE: 'call:initiate',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPT: 'call:accept',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECT: 'call:reject',
  CALL_REJECTED: 'call:rejected',
  CALL_END: 'call:end',
  CALL_ENDED: 'call:ended',
  CALL_BUSY: 'call:busy',

  // WebRTC Signaling
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE: 'webrtc:ice',
} as const;

// ── Validation limits ────────────────────────────────────────────────────────
export const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  BIO_MAX: 300,
  MSG_MAX: 10_000,
  GROUP_NAME_MAX: 100,
  SEARCH_MAX: 100,
} as const;

// ── Rate-limit windows ───────────────────────────────────────────────────────
export const RATE_LIMITS = {
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 min
  AUTH_MAX: 10,
  FORGOT_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  FORGOT_MAX: 5,
} as const;

// ── Typing auto-stop ─────────────────────────────────────────────────────────
export const SOCKET = {
  TYPING_TIMEOUT_MS: 8_000,
} as const;

// ── Local-storage keys (for reference — used in FE constants too) ────────────
export const STORAGE_KEYS = {
  USER: 'relay-user',
  SETTINGS_THEME: 'settings_theme',
  SETTINGS_LANGUAGE: 'settings_language',
  SETTINGS_TONE: 'settings_tone',
  SETTINGS_NOTIFS: 'settings_notifications',
  SETTINGS_RECEIPTS: 'settings_readReceipts',
  SETTINGS_TYPING: 'settings_typingIndicators',
  SETTINGS_MEDIA: 'settings_mediaAutoDownload',
  SETTINGS_FONT: 'settings_fontSize',
  NOTIF_PREFS: 'notification_preferences',
  USER_PROFILE: 'user_profile',
  PRIVACY_SETTINGS: 'privacy_settings',
} as const;
