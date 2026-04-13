/* ─── Download section ─────────────────────────────────────── */
(function () {
  const urlInput        = document.getElementById('yt-url');
  const formatSelect    = document.getElementById('yt-format');
  const qualitySelect   = document.getElementById('yt-quality');
  const btnGetInfo      = document.getElementById('btn-get-info');
  const btnDownload     = document.getElementById('btn-download');
  const videoInfo       = document.getElementById('video-info');
  const videoThumb      = document.getElementById('video-thumbnail');
  const videoTitle      = document.getElementById('video-title');
  const videoUploader   = document.getElementById('video-uploader');
  const videoDuration   = document.getElementById('video-duration');
  const filenameGroup   = document.getElementById('filename-group');
  const filenameInput   = document.getElementById('yt-filename');
  const btnResetFilename = document.getElementById('btn-reset-filename');
  const progressWrap    = document.getElementById('dl-progress-wrap');
  const progressLabel   = document.getElementById('dl-progress-label');
  const msgBox          = document.getElementById('dl-message');

  // Original title from the API, used to restore the field
  let originalTitle = '';

  function formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  // Strip characters that are invalid in file names on Windows / macOS / Linux
  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '').trim();
  }

  function isValidYTUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/.test(url);
  }

  function showMessage(text, type) {
    msgBox.textContent = text;
    msgBox.className = `message ${type}`;
    msgBox.classList.remove('hidden');
  }

  function hideMessage() { msgBox.classList.add('hidden'); }

  function setLoading(loading) {
    btnGetInfo.disabled  = loading;
    btnDownload.disabled = loading;
    progressWrap.classList.toggle('hidden', !loading);
  }

  // ── Restore original title ──
  btnResetFilename.addEventListener('click', () => {
    filenameInput.value = originalTitle;
    filenameInput.focus();
  });

  // ── Get video info ──
  btnGetInfo.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { showMessage('Introduce una URL de YouTube', 'error'); return; }
    if (!isValidYTUrl(url)) { showMessage('La URL no parece ser de YouTube', 'error'); return; }

    hideMessage();
    videoInfo.classList.add('hidden');
    btnDownload.classList.add('hidden');
    filenameGroup.classList.add('hidden');
    setLoading(true);
    progressLabel.textContent = 'Obteniendo información...';

    try {
      const res  = await fetch(`/api/download/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const info = data.data;
      videoThumb.src            = info.thumbnail || '';
      videoTitle.textContent    = info.title     || '—';
      videoUploader.textContent = info.uploader  ? `Canal: ${info.uploader}` : '';
      videoDuration.textContent = info.duration  ? `Duración: ${formatDuration(info.duration)}` : '';

      // Pre-fill filename with the video title (sanitized)
      originalTitle       = sanitizeFilename(info.title || 'descarga');
      filenameInput.value = originalTitle;

      videoInfo.classList.remove('hidden');
      filenameGroup.classList.remove('hidden');
      btnDownload.classList.remove('hidden');
      showMessage('Información obtenida. Puedes cambiar el nombre y pulsar Descargar.', 'success');
    } catch (err) {
      showMessage(err.message || 'Error al obtener información', 'error');
    } finally {
      setLoading(false);
    }
  });

  // ── Download ──
  btnDownload.addEventListener('click', async () => {
    const url      = urlInput.value.trim();
    const format   = formatSelect.value;
    const quality  = qualitySelect.value;
    const filename = sanitizeFilename(filenameInput.value) || originalTitle || 'descarga';

    if (!url || !isValidYTUrl(url)) {
      showMessage('URL no válida', 'error');
      return;
    }

    hideMessage();
    setLoading(true);
    progressLabel.textContent = 'Descargando (puede tardar varios minutos)...';

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality, filename })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const blob        = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match       = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      const serverName  = match ? decodeURIComponent(match[1]) : `${filename}.${format}`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor    = document.createElement('a');
      anchor.href     = objectUrl;
      anchor.download = serverName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      showMessage('Descarga completada.', 'success');
    } catch (err) {
      showMessage(err.message || 'Error al descargar', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Allow pressing Enter in the URL field to fetch info
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnGetInfo.click();
  });
})();
