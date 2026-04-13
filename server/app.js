require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const downloadRoutes = require('./routes/download');
const convertRoutes = require('./routes/convert');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure temp directories exist and purge any orphan files from a previous crash
const downloadsDir = path.join(__dirname, '..', process.env.DOWNLOADS_DIR || 'downloads');
const uploadsDir = path.join(__dirname, '..', process.env.UPLOADS_DIR || 'uploads');

[downloadsDir, uploadsDir].forEach(dir => {
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/download', downloadRoutes);
app.use('/api/convert', convertRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
