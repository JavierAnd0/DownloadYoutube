/* ─── Shared utilities (single source of truth) ─────────────────────────── */
/* global COMMON */
window.COMMON = (function () {

  // ── Platform URL patterns (mirrors server/config/index.js) ──────────────────
  const PLATFORM_PATTERNS = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}([?&][^"'\s<>]*)?$/,
    /^https?:\/\/(www\.|m\.)?facebook\.com\/.+/,
    /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|stories)\/.+/,
    /^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+/,
    /^https?:\/\/(www\.)?soundcloud\.com\/.+/,
    /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+/,
  ];

  function isValidUrl(url) {
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) return false;
    } catch {
      return false;
    }
    return PLATFORM_PATTERNS.some(p => p.test(url));
  }

  // ── Formatters ──────────────────────────────────────────────────────────────
  function formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatCount(n) {
    if (n == null) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  // "20160423" → "23 abr. 2016"
  function formatUploadDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    const y    = yyyymmdd.slice(0, 4);
    const m    = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
    const d    = yyyymmdd.slice(6, 8);
    const date = new Date(Date.UTC(y, m, d));
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return '';
    return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 200);
  }

  return {
    PLATFORM_PATTERNS,
    isValidUrl,
    formatDuration,
    formatCount,
    formatUploadDate,
    formatBytes,
    sanitizeFilename,
  };
})();
