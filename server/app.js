require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const config         = require('./config');
const requestLogger  = require('./middleware/requestLogger');
const rateLimiter    = require('./middleware/rateLimiter');
const errorHandler   = require('./middleware/errorHandler');
const downloadRoutes = require('./routes/download');
const convertRoutes  = require('./routes/convert');
const healthRoutes   = require('./routes/health');

const { PORT, DOWNLOADS_DIR, UPLOADS_DIR } = config;
const app = express();

// ── Request logger ────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://*.ytimg.com https://img.youtube.com https://*.fbcdn.net https://*.cdninstagram.com https://*.tiktokcdn.com https://pbs.twimg.com https://i1.sndcdn.com https://*.twimg.com",
      "connect-src 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Startup: ensure temp dirs exist and purge orphan files ────────────────────
[DOWNLOADS_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  const files = fs.readdirSync(dir);
  if (files.length === 0) return;
  files.forEach(file => {
    try { fs.unlinkSync(path.join(dir, file)); } catch { /* ignore */ }
  });
  console.log(`[startup] Limpiados ${files.length} archivo(s) huérfano(s) de "${path.basename(dir)}"`);
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Health check (no rate limit) ─────────────────────────────────────────────
app.use('/health', healthRoutes);

// ── API routes (rate limited) ─────────────────────────────────────────────────
app.use('/api', rateLimiter);
app.use('/api/download', downloadRoutes);
app.use('/api/convert', convertRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server with graceful shutdown ───────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT} (${config.NODE_ENV})`);
});

process.on('SIGTERM', () => {
  console.log('[shutdown] SIGTERM received — closing HTTP server');
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
});
process.on('SIGINT', () => server.close(() => process.exit(0)));

module.exports = app;
