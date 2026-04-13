const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { convertAudio, getSupportedFormats, SUPPORTED_FORMATS } = require('../utils/audioConverter');

const uploadsDir = path.join(__dirname, '..', '..', process.env.UPLOADS_DIR || 'uploads');
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
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

// GET /api/formats
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
    const { filePath, filename } = await convertAudio(req.file.path, outputFormat);

    const mimeTypes = {
      mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
      flac: 'audio/flac', ogg: 'audio/ogg', m4a: 'audio/mp4'
    };

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeTypes[outputFormat] || 'application/octet-stream');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('close', () => {
      fs.unlink(filePath, () => {});
      fs.unlink(req.file.path, () => {});
    });
    fileStream.on('error', (err) => {
      fs.unlink(filePath, () => {});
      fs.unlink(req.file.path, () => {});
      next(err);
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: `El archivo supera el límite de ${MAX_MB}MB` });
  }
  next(err);
});

module.exports = router;
