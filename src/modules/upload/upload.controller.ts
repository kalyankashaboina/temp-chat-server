import path from 'path';
import crypto from 'crypto';

import type { Request, Response } from 'express';

import { env } from '../../config/env';
import { logger } from '../../shared/logger';

// ── Cloudinary (optional) ─────────────────────────────────────────────

async function uploadToCloudinary(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ url: string; id: string }> {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const folder = 'relay-chat';
    const resourceType = mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('image/')
        ? 'image'
        : 'raw';

    cloudinary.uploader
      .upload_stream({ folder, resource_type: resourceType as any }, (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve({ url: result.secure_url, id: result.public_id });
      })
      .end(buffer);
  });
}

// ── Local fallback (dev) ──────────────────────────────────────────────

function localFallback(buffer: Buffer, originalName: string): { url: string; id: string } {
  // In dev without Cloudinary, return a data URL so the UI can still preview
  const base64 = buffer.toString('base64');
  const ext = path.extname(originalName).toLowerCase();
  const mime =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.mp4'
              ? 'video/mp4'
              : 'application/octet-stream';
  const id = crypto.randomBytes(8).toString('hex');
  return {
    url: `data:${mime};base64,${base64.slice(0, 50000)}`, // cap at 50KB for data URLs
    id,
  };
}

// ── Handler ───────────────────────────────────────────────────────────

export async function uploadFile(req: Request, res: Response) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    let result: { url: string; id: string };

    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      result = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype);
      logger.info('File uploaded to Cloudinary', { id: result.id });
    } else {
      // Dev fallback
      result = localFallback(file.buffer, file.originalname);
      logger.info('File stored as data URL (dev mode — configure Cloudinary for production)');
    }

    return res.status(201).json({
      success: true,
      url: result.url,
      id: result.id,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });
  } catch (err: any) {
    logger.error('Upload error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
}
