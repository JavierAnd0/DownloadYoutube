const express = require('express');
const router  = express.Router();
const { isValidUrl } = require('../adapters/ytDownloader');
const { fetchVideoInfo, prepareDownload, streamFileToResponse } = require('../services/downloadService');
const { DOWNLOAD_AUDIO_FORMATS } = require('../config');

const VALID_FORMATS  = ['mp4', ...DOWNLOAD_AUDIO_FORMATS];
const VIDEO_QUALITIES = ['best', 'medium', 'low'];

// GET /api/download/info?url=...
router.get('/info', async (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Se requiere el parámetro "url"' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ success: false, error: 'URL no válida o plataforma no soportada' });
  }

  try {
    const info = await fetchVideoInfo(url);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
});

// POST /api/download
// Body: { url, format, quality, filename? }
router.post('/', async (req, res, next) => {
  const { url, format = 'mp4', quality = 'best', filename } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Se requiere el campo "url"' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ success: false, error: 'URL no válida o plataforma no soportada' });
  }
  if (!VALID_FORMATS.includes(format)) {
    return res.status(400).json({ success: false, error: `Formato no válido. Usa: ${VALID_FORMATS.join(', ')}` });
  }
  // Quality only applies to MP4 video downloads
  if (format === 'mp4' && !VIDEO_QUALITIES.includes(quality)) {
    return res.status(400).json({ success: false, error: 'Calidad no válida. Usa "best", "medium" o "low"' });
  }

  try {
    const { filePath, outputName, contentType } = await prepareDownload(url, format, quality, filename);
    streamFileToResponse(filePath, outputName, contentType, res, next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
