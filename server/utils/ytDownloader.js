const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const downloadsDir = path.join(__dirname, '..', '..', process.env.DOWNLOADS_DIR || 'downloads');

// Resolve yt-dlp binary: honour env var, then common Windows pip location, then PATH
function getYtDlpBin() {
  if (process.env.YTDLP_BIN) return process.env.YTDLP_BIN;
  const winPip = path.join(
    process.env.APPDATA || '',
    'Python', 'Python314', 'Scripts', 'yt-dlp.exe'
  );
  if (fs.existsSync(winPip)) return `"${winPip}"`;
  return 'yt-dlp';
}

/**
 * Validates that the given string is a YouTube URL.
 */
function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/;
  return pattern.test(url);
}

/**
 * Maps a quality label to yt-dlp format selectors.
 */
function buildFormatSelector(format, quality) {
  if (format === 'mp3') {
    const qualityMap = { best: '0', medium: '5', low: '9' };
    return { extractAudio: true, audioQuality: qualityMap[quality] || '5' };
  }

  // MP4
  const qualityMap = {
    best: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    medium: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    low: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]'
  };
  return { formatSelector: qualityMap[quality] || qualityMap.best };
}

/**
 * Returns basic info (title, duration, thumbnail) for a YouTube URL.
 */
function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    if (!isValidYouTubeUrl(url)) {
      return reject(new Error('URL de YouTube no válida'));
    }

    const bin = getYtDlpBin();
    const cmd = `${bin} --dump-json --no-playlist "${url}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        // Extract the most useful line from yt-dlp's stderr
        const errLine = (stderr || '')
          .split('\n')
          .find(l => l.includes('ERROR:') || l.includes('error'));
        const detail = errLine ? errLine.replace(/^ERROR:\s*/, '').trim() : 'Verifica la URL o inténtalo de nuevo';
        return reject(new Error(`yt-dlp: ${detail}`));
      }
      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          uploader: info.uploader,
          viewCount: info.view_count,
          formats: (info.formats || [])
            .filter(f => f.ext && f.format_note)
            .map(f => ({ id: f.format_id, ext: f.ext, note: f.format_note, resolution: f.resolution }))
        });
      } catch {
        reject(new Error('Error al parsear información del vídeo'));
      }
    });
  });
}

/**
 * Downloads a YouTube video as MP3 or MP4.
 * Returns the path to the downloaded file.
 */
function downloadVideo(url, format = 'mp4', quality = 'best') {
  return new Promise((resolve, reject) => {
    if (!isValidYouTubeUrl(url)) {
      return reject(new Error('URL de YouTube no válida'));
    }
    if (!['mp3', 'mp4'].includes(format)) {
      return reject(new Error('Formato no soportado. Usa mp3 o mp4'));
    }
    if (!['best', 'medium', 'low'].includes(quality)) {
      return reject(new Error('Calidad no válida. Usa best, medium o low'));
    }

    const fileId = uuidv4();
    const outputTemplate = path.join(downloadsDir, `${fileId}.%(ext)s`);
    const sel = buildFormatSelector(format, quality);
    const bin = getYtDlpBin();

    let cmd;
    if (format === 'mp3') {
      cmd = [
        bin,
        '--no-playlist',
        '-x',
        '--audio-format mp3',
        `--audio-quality ${sel.audioQuality}`,
        `--ffmpeg-location "${process.env.FFMPEG_BIN || 'ffmpeg'}"`,
        `-o "${outputTemplate}"`,
        `"${url}"`
      ].join(' ');
    } else {
      cmd = [
        bin,
        '--no-playlist',
        `-f "${sel.formatSelector}"`,
        '--merge-output-format mp4',
        `--ffmpeg-location "${process.env.FFMPEG_BIN || 'ffmpeg'}"`,
        `-o "${outputTemplate}"`,
        `"${url}"`
      ].join(' ');
    }

    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        const errLine = (stderr || '')
          .split('\n')
          .find(l => l.includes('ERROR:') || l.includes('error'));
        const detail = errLine ? errLine.replace(/^ERROR:\s*/, '').trim() : 'Comprueba que yt-dlp y ffmpeg están instalados';
        return reject(new Error(`yt-dlp: ${detail}`));
      }

      // Find the created file
      const files = fs.readdirSync(downloadsDir).filter(f => f.startsWith(fileId));
      if (files.length === 0) {
        return reject(new Error('Archivo descargado no encontrado'));
      }

      const filePath = path.join(downloadsDir, files[0]);
      resolve({ filePath, filename: files[0] });
    });
  });
}

module.exports = { downloadVideo, getVideoInfo, isValidYouTubeUrl };
