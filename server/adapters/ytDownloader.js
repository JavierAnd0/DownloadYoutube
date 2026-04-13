const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const { DOWNLOADS_DIR, YTDLP_BIN, YTDLP_COOKIES, FFMPEG_BIN, PLATFORM_PATTERNS, DOWNLOAD_AUDIO_FORMATS } = config;

// yt-dlp 2026+ requires a JS runtime + EJS challenge solver for YouTube.
// node is always available in our node:22-alpine base image.
// ejs:github downloads the solver once and caches it in XDG_CACHE_HOME.
const JS_RUNTIME_ARGS = ['--js-runtimes', 'node', '--remote-components', 'ejs:github'];

// Use the web client with cookies auth — on datacenter IPs YouTube blocks
// all clients (ios, android_vr, tv_embedded) at the IP level. Cookies from
// a logged-in account bypass that check. tv_embedded is kept as first choice
// since it requires fewer cookie scopes; web is the authoritative fallback.
function buildYoutubeClientArgs() {
  const args = ['--extractor-args', 'youtube:player_client=web,mweb'];
  const bgutilUrl = process.env.BGUTIL_HTTP_ENDPOINT;
  if (bgutilUrl) {
    // Pass as a separate --extractor-args to avoid semicolon parsing issues
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${bgutilUrl}`);
  }
  return args;
}

/**
 * Optional cookies fallback (e.g. for age-restricted content).
 * Only used if YTDLP_COOKIES env var points to an existing file.
 */
function cookiesArgs() {
  if (!YTDLP_COOKIES) return [];
  try {
    const stat = fs.statSync(YTDLP_COOKIES);
    if (!stat.isFile()) {
      console.warn(`[yt-dlp] YTDLP_COOKIES path is not a file (got ${stat.isDirectory() ? 'directory' : 'other'}): ${YTDLP_COOKIES}`);
      return [];
    }
  } catch {
    console.warn(`[yt-dlp] cookies file not found: ${YTDLP_COOKIES}`);
    return [];
  }
  return ['--cookies', YTDLP_COOKIES];
}

/**
 * Returns true if the URL belongs to a supported platform.
 * All patterns are anchored to prevent trailing shell metacharacter injection.
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  } catch {
    return false;
  }
  return PLATFORM_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Maps format + quality to yt-dlp selectors.
 * Audio formats always extract at best quality (--audio-quality 0).
 */
function buildFormatSelector(format, quality) {
  if (DOWNLOAD_AUDIO_FORMATS.includes(format)) {
    return { extractAudio: true, audioFormat: format, audioQuality: '0' };
  }

  const qualityMap = {
    best:   'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
    medium: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
    low:    'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]/best'
  };
  return { formatSelector: qualityMap[quality] || qualityMap.best };
}

/**
 * Returns basic info (title, duration, thumbnail) for a supported URL.
 * Uses execFile — the URL is passed as a literal argument, never shell-interpolated.
 */
function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    if (!isValidUrl(url)) {
      return reject(new Error('URL no válida o plataforma no soportada'));
    }

    const args = [
      '--dump-json',
      '--no-playlist',
      ...JS_RUNTIME_ARGS,
      ...buildYoutubeClientArgs(),
      ...cookiesArgs(),
      url
    ];

    execFile(YTDLP_BIN, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        const lines  = (stderr || '').split('\n').filter(Boolean);
        const errLine = lines.find(l => l.includes('ERROR:')) || lines.find(l => l.includes('error'));
        const detail  = errLine ? errLine.replace(/^ERROR:\s*/, '').trim() : 'Verifica la URL o inténtalo de nuevo';
        console.error('[yt-dlp getVideoInfo stderr]\n', stderr);
        return reject(new Error(`yt-dlp: ${detail}`));
      }
      try {
        const info = JSON.parse(stdout);
        resolve({
          title:      info.title,
          duration:   info.duration,
          thumbnail:  info.thumbnail,
          uploader:   info.uploader || info.channel || info.creator,
          viewCount:  info.view_count,
          likeCount:  info.like_count  ?? null,
          uploadDate: info.upload_date ?? null,
          formats:    (info.formats || [])
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
 * Downloads a video/audio from any supported platform.
 * Uses execFile — all arguments are array elements, never shell-interpolated.
 */
function downloadVideo(url, format = 'mp4', quality = 'best') {
  return new Promise((resolve, reject) => {
    if (!isValidUrl(url)) {
      return reject(new Error('URL no válida o plataforma no soportada'));
    }
    const isAudio = DOWNLOAD_AUDIO_FORMATS.includes(format);
    if (!isAudio && format !== 'mp4') {
      return reject(new Error(`Formato no soportado: ${format}`));
    }
    if (!isAudio && !['best', 'medium', 'low'].includes(quality)) {
      return reject(new Error('Calidad no válida. Usa best, medium o low'));
    }

    const fileId         = uuidv4();
    const outputTemplate = path.join(DOWNLOADS_DIR, `${fileId}.%(ext)s`);
    const sel            = buildFormatSelector(format, quality);

    let args;
    if (isAudio) {
      args = [
        '--no-playlist',
        '-x',
        '--audio-format', sel.audioFormat,
        '--audio-quality', sel.audioQuality,
        '--ffmpeg-location', FFMPEG_BIN,
        ...JS_RUNTIME_ARGS,
        ...buildYoutubeClientArgs(),
        ...cookiesArgs(),
        '-o', outputTemplate,
        url
      ];
    } else {
      args = [
        '--no-playlist',
        '-f', sel.formatSelector,
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', FFMPEG_BIN,
        ...JS_RUNTIME_ARGS,
        ...buildYoutubeClientArgs(),
        ...cookiesArgs(),
        '-o', outputTemplate,
        url
      ];
    }

    execFile(YTDLP_BIN, args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        const lines   = (stderr || '').split('\n').filter(Boolean);
        const errLine = lines.find(l => l.includes('ERROR:')) || lines.find(l => l.includes('error'));
        const detail  = errLine ? errLine.replace(/^ERROR:\s*/, '').trim() : 'Comprueba que yt-dlp y ffmpeg están instalados';
        console.error('[yt-dlp downloadVideo stderr]\n', stderr);
        return reject(new Error(`yt-dlp: ${detail}`));
      }

      const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(fileId));
      if (files.length === 0) {
        return reject(new Error('Archivo descargado no encontrado'));
      }

      const filePath = path.join(DOWNLOADS_DIR, files[0]);
      resolve({ filePath, filename: files[0] });
    });
  });
}

module.exports = { downloadVideo, getVideoInfo, isValidUrl };
