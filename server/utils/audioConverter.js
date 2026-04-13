const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// Point fluent-ffmpeg to the installed binary if not in PATH
if (process.env.FFMPEG_BIN) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_BIN);
  ffmpeg.setFfprobePath(
    process.env.FFMPEG_BIN.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
  );
}
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const downloadsDir = path.join(__dirname, '..', '..', process.env.DOWNLOADS_DIR || 'downloads');

const SUPPORTED_FORMATS = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];

/**
 * Returns the list of supported output formats.
 */
function getSupportedFormats() {
  return SUPPORTED_FORMATS;
}

/**
 * Returns the duration (in seconds) of an audio file.
 */
function getFileDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(new Error('No se pudo leer el archivo de audio'));
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Converts an audio file to the specified format.
 * Calls onProgress(percent) as conversion progresses.
 * Returns the path to the converted file.
 */
function convertAudio(inputPath, outputFormat, onProgress) {
  return new Promise((resolve, reject) => {
    if (!SUPPORTED_FORMATS.includes(outputFormat)) {
      return reject(new Error(`Formato no soportado: ${outputFormat}. Usa: ${SUPPORTED_FORMATS.join(', ')}`));
    }
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('Archivo de entrada no encontrado'));
    }

    const fileId = uuidv4();
    const outputFilename = `${fileId}.${outputFormat}`;
    const outputPath = path.join(downloadsDir, outputFilename);

    const command = ffmpeg(inputPath)
      .toFormat(outputFormat)
      .audioCodec(getAudioCodec(outputFormat))
      .on('progress', (progress) => {
        if (typeof onProgress === 'function' && progress.percent != null) {
          onProgress(Math.min(Math.round(progress.percent), 100));
        }
      })
      .on('error', (err) => {
        reject(new Error(`Error de conversión: ${err.message}`));
      })
      .on('end', () => {
        resolve({ filePath: outputPath, filename: outputFilename });
      });

    command.save(outputPath);
  });
}

function getAudioCodec(format) {
  const codecs = {
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    aac: 'aac',
    flac: 'flac',
    ogg: 'libvorbis',
    m4a: 'aac'
  };
  return codecs[format] || 'copy';
}

module.exports = { convertAudio, getFileDuration, getSupportedFormats, SUPPORTED_FORMATS };
