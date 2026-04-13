const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { UPLOADS_DIR, MAX_FILE_SIZE_MB, SUPPORTED_FORMATS } = require('../config');
const { getSupportedFormats } = require('../adapters/audioConverter');
const { prepareConversion, streamConvertedFile } = require('../services/convertService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
      'audio/aac', 'audio/flac', 'audio/ogg', 'audio/x-flac',
      'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'video/mp4'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|aac|flac|ogg|m4a|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// GET /api/convert/formats
router.get('/formats', (req, res) => {
  res.json({ success: true, formats: getSupportedFormats() });
});

// POST /api/convert
// Form-data: file (audio), outputFormat (string)
router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
  }

  const { outputFormat } = req.body;
  if (!outputFormat) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, error: 'Se requiere el campo "outputFormat"' });
  }
  if (!SUPPORTED_FORMATS.includes(outputFormat)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      error: `Formato de salida no válido. Usa: ${SUPPORTED_FORMATS.join(', ')}`
    });
  }

  try {
    const { filePath, filename, contentType } = await prepareConversion(req.file.path, outputFormat, req.file.originalname);
    streamConvertedFile(filePath, req.file.path, filename, contentType, res, next);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: `El archivo supera el límite de ${MAX_FILE_SIZE_MB}MB` });
  }
  next(err);
});

module.exports = router;
