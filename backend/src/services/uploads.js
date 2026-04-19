import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}
ensureUploadsDir();

function sanitizeName(name = '') {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

/**
 * Renvoie un multer configuré pour stocker sous uploads/{companyId}/{kind}/
 * kind = 'receipts' | 'documents'
 */
export function makeUploader(kind) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const companyId = req.user?.companyId;
      if (!companyId) return cb(new Error('Non authentifié'));
      const dir = path.join(UPLOADS_ROOT, String(companyId), kind);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const base = sanitizeName(file.originalname || 'file');
      cb(null, `${ts}-${rand}-${base}`);
    }
  });
  return multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 Mo
  });
}

export function toRelative(absPath) {
  return path.relative(UPLOADS_ROOT, absPath).split(path.sep).join('/');
}

export function toAbsolute(relPath) {
  return path.join(UPLOADS_ROOT, relPath);
}

export function safeDelete(relPath) {
  try {
    const abs = toAbsolute(relPath);
    if (abs.startsWith(UPLOADS_ROOT) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch { /* ignore */ }
}
