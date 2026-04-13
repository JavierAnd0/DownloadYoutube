const fs   = require('fs');
const { downloadVideo, getVideoInfo } = require('../adapters/ytDownloader');

/**
 * Sanitizes a user-supplied filename: strips path separators and reserved chars.
 */
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 200);
}

/**
 * Fetches video metadata for a given URL.
 * Returns the info object; throws on failure.
 */
async function fetchVideoInfo(url) {
  return getVideoInfo(url);
}

/**
 * Downloads a video/audio and returns streaming metadata.
 * The caller is responsible for piping the stream and deleting the file.
 */
async function prepareDownload(url, format, quality, filename) {
  const { filePath } = await downloadVideo(url, format, quality);

  const baseName    = sanitizeFilename(filename) || 'descarga';
  const outputName  = `${baseName}.${format}`;
  const AUDIO_MIME  = { mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4', opus: 'audio/ogg', flac: 'audio/flac' };
  const contentType = AUDIO_MIME[format] || 'video/mp4';

  return { filePath, outputName, contentType };
}

/**
 * Pipes a file to the response and cleans up afterward.
 * Preserves the close/error pattern that prevents orphan files.
 */
function streamFileToResponse(filePath, outputName, contentType, res, next) {
  const encodedName = encodeURIComponent(outputName);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${outputName}"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('Content-Type', contentType);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  fileStream.on('close', () => fs.unlink(filePath, () => {}));
  fileStream.on('error', (err) => {
    fs.unlink(filePath, () => {});
    next(err);
  });
}

module.exports = { fetchVideoInfo, prepareDownload, streamFileToResponse, sanitizeFilename };
