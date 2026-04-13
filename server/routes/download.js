const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { downloadVideo, getVideoInfo, isValidYouTubeUrl } = require('../utils/ytDownloader');

// GET /api/download/info?url=...
router.get('/info', async (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Se requiere el parámetro "url"' });
  }
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ success: false, error: 'URL de YouTube no válida' });
  }

  try {
    const info = await getVideoInfo(url);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
});

// Sanitize a user-supplied filename: strip path separators and reserved chars
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 200);
}

// POST /api/download
// Body: { url, format, quality, filename? }
router.post('/', async (req, res, next) => {
  const { url, format = 'mp4', quality = 'best', filename } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Se requiere el campo "url"' });
  }
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ success: false, error: 'URL de YouTube no válida' });
  }
  if (!['mp3', 'mp4'].includes(format)) {
    return res.status(400).json({ success: false, error: 'Formato no válido. Usa "mp3" o "mp4"' });
  }
  if (!['best', 'medium', 'low'].includes(quality)) {
    return res.status(400).json({ success: false, error: 'Calidad no válida. Usa "best", "medium" o "low"' });
  }

  try {
    const { filePath } = await downloadVideo(url, format, quality);

    // Build the download filename: use custom name if provided, otherwise the video title
    const baseName   = sanitizeFilename(filename) || 'descarga';
    const outputName = `${baseName}.${format}`;
    // RFC 5987 encoding for non-ASCII characters (tildes, accents, etc.)
    const encodedName = encodeURIComponent(outputName);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${outputName}"; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('close', () => {
      fs.unlink(filePath, () => {});
    });
    fileStream.on('error', (err) => {
      fs.unlink(filePath, () => {});
      next(err);
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
