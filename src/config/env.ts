import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  PORT:           Number(process.env.PORT) || 4000,
  NODE_ENV:       optionalEnv('NODE_ENV', 'development'),
  MONGO_URI:      requireEnv('MONGO_URI'),
  JWT_SECRET:     requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  FRONTEND_URL:   optionalEnv('FRONTEND_URL', 'http://localhost:5173'),

  GOOGLE_CLIENT_ID:     optionalEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET', ''),

  SMTP_HOST:  optionalEnv('SMTP_HOST', ''),
  SMTP_PORT:  Number(process.env.SMTP_PORT) || 587,
  SMTP_USER:  optionalEnv('SMTP_USER', ''),
  SMTP_PASS:  optionalEnv('SMTP_PASS', ''),
  EMAIL_FROM: optionalEnv('EMAIL_FROM', 'noreply@relay-chat.com'),

  CLOUDINARY_CLOUD_NAME: optionalEnv('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_API_KEY:    optionalEnv('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: optionalEnv('CLOUDINARY_API_SECRET', ''),
};
