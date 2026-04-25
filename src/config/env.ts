import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function warnEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.warn(`⚠️ Env var ${name} is not set`);
    return '';
  }
  return val;
}

export const env = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),

  MONGO_URI: requireEnv('MONGO_URI'),

  REDIS_HOST: optionalEnv('REDIS_HOST', 'localhost'),
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: optionalEnv('REDIS_PASSWORD', ''),

  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: warnEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  ALLOWED_ORIGINS: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:5173'),

  MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE) || 10485760,
  UPLOAD_DIR: optionalEnv('UPLOAD_DIR', './uploads'),

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),
  LOG_FILE: optionalEnv('LOG_FILE', './logs/app.log'),

  SMTP_HOST: warnEnv('SMTP_HOST'),
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: warnEnv('SMTP_USER'),
  SMTP_PASS: warnEnv('SMTP_PASS'),
  EMAIL_FROM: optionalEnv('EMAIL_FROM', 'noreply@relaychat.com'),

  GOOGLE_CLIENT_ID: warnEnv('GOOGLE_CLIENT_ID'),

  CLOUDINARY_CLOUD_NAME: warnEnv('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: warnEnv('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: warnEnv('CLOUDINARY_API_SECRET'),

  STUN_SERVER: optionalEnv('STUN_SERVER', 'stun:stun.l.google.com:19302'),
  TURN_SERVER: warnEnv('TURN_SERVER'),
  TURN_USERNAME: warnEnv('TURN_USERNAME'),
  TURN_PASSWORD: warnEnv('TURN_PASSWORD'),
};
