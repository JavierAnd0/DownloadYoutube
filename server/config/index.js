require('dotenv').config();
const path = require('path');
const fs   = require('fs');

// ── Binary resolution ─────────────────────────────────────────────────────────
function resolveYtDlpBin() {
  if (process.env.YTDLP_BIN) return process.env.YTDLP_BIN;
  // Windows local-dev fallback only (not used in Docker)
  if (process.platform === 'win32') {
    const winPip = path.join(
      process.env.APPDATA || '',
      'Python', 'Python314', 'Scripts', 'yt-dlp.exe'
    );
    if (fs.existsSync(winPip)) return winPip;
  }
  return 'yt-dlp';
}

// ── Directory resolution ──────────────────────────────────────────────────────
const rootDir      = path.join(__dirname, '..', '..');
const DOWNLOADS_DIR = path.resolve(rootDir, process.env.DOWNLOADS_DIR || 'downloads');
const UPLOADS_DIR   = path.resolve(rootDir, process.env.UPLOADS_DIR   || 'uploads');

// ── Platform URL patterns ─────────────────────────────────────────────────────
// Single source of truth — imported by adapters and served to frontend via common.js
const PLATFORM_PATTERNS = [
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}([?&][^"'\s<>]*)?$/,
  /^https?:\/\/(www\.|m\.)?facebook\.com\/.+/,
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/,
  /^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+/,
  /^https?:\/\/(www\.)?soundcloud\.com\/.+/,
  /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+/,
];

module.exports = {
  PORT:              parseInt(process.env.PORT || '3000', 10),
  NODE_ENV:          process.env.NODE_ENV || 'development',
  DOWNLOADS_DIR,
  UPLOADS_DIR,
  YTDLP_BIN:         resolveYtDlpBin(),
  YTDLP_COOKIES:     process.env.YTDLP_COOKIES || '',
  FFMPEG_BIN:        process.env.FFMPEG_BIN || 'ffmpeg',
  MAX_FILE_SIZE_MB:  parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  TRUST_PROXY:       process.env.TRUST_PROXY === 'true',
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX:    parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
  PLATFORM_PATTERNS,
  // Formats supported by the audio converter (upload → convert)
  SUPPORTED_FORMATS: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'],
  // Audio formats supported for direct download via yt-dlp -x
  DOWNLOAD_AUDIO_FORMATS: ['mp3', 'wav', 'aac', 'm4a', 'opus', 'flac'],
};
