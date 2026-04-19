import { Router } from 'express';
import multer from 'multer';

import { UPLOAD } from '../../shared/constants';
import { requireAuth } from '../auth/auth.middleware';

import { uploadFile } from './upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((UPLOAD.ALLOWED_MIMES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed`));
    }
  },
});

const router = Router();
router.post('/', requireAuth, upload.single('file'), uploadFile);

export default router;
