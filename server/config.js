// Settings shared by several server files. Values come from .env (see .env.example).
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

// Where uploaded files are saved and served from (/uploads/...). A relative UPLOAD_DIR is relative to the project folder.
const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || path.join('server', 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

module.exports = {
  isProd,
  uploadDir,
  enquiriesEnabled: String(process.env.ENQUIRIES_ENABLED || '').trim().toLowerCase() === 'true',
};
