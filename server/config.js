// Settings shared by several server files. Values come from .env (see .env.example).
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

// Where uploaded files are saved and served from (/uploads/...). A relative UPLOAD_DIR is relative to the project folder.
// On Vercel the app folder is read-only, so uploads go to Vercel Blob (BLOB_READ_WRITE_TOKEN) instead,
// and the local folder falls back to /tmp, which is temporary.
const onVercel = !!process.env.VERCEL;
const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || (onVercel ? '/tmp/uploads' : path.join('server', 'uploads')));
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { console.warn('[warning] Could not create ' + uploadDir + ': ' + e.message); }
const blobEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;

module.exports = {
  isProd,
  uploadDir,
  onVercel,
  blobEnabled,
  enquiriesEnabled: String(process.env.ENQUIRIES_ENABLED || '').trim().toLowerCase() === 'true',
};
