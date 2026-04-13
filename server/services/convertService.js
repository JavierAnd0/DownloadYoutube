const fs = require('fs');
const { convertAudio } = require('../adapters/audioConverter');

const MIME_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
};

/**
 * Converts the uploaded file and returns streaming metadata.
 * The caller is responsible for piping the stream and cleaning up both files.
 */
async function prepareConversion(inputPath, outputFormat) {
  const { filePath, filename } = await convertAudio(inputPath, outputFormat);
  const contentType = MIME_TYPES[outputFormat] || 'application/octet-stream';
  return { filePath, filename, contentType };
}

/**
 * Pipes a converted file to the response and cleans up both input and output.
 */
function streamConvertedFile(filePath, inputPath, filename, contentType, res, next) {
  const encodedFilename = encodeURIComponent(filename);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader('Content-Type', contentType);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  fileStream.on('close', () => {
    fs.unlink(filePath, () => {});
    fs.unlink(inputPath, () => {});
  });
  fileStream.on('error', (err) => {
    fs.unlink(filePath, () => {});
    fs.unlink(inputPath, () => {});
    next(err);
  });
}

module.exports = { prepareConversion, streamConvertedFile };
