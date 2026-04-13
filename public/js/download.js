/* ─── Download section ─────────────────────────────────────── */
(function () {
  const { isValidUrl, formatDuration, formatCount, formatUploadDate, sanitizeFilename } = window.COMMON;

  const urlInput         = document.getElementById('yt-url');
  const btnGetInfo       = document.getElementById('btn-get-info');
  const btnDownload      = document.getElementById('btn-download');

  // Video info elements
  const videoInfo        = document.getElementById('video-info');
  const videoThumb       = document.getElementById('video-thumbnail');
  const videoDurBadge    = document.getElementById('video-duration');
  const videoTitle       = document.getElementById('video-title');
  const videoViewsWrap   = document.getElementById('vi-views');
  const videoViewsVal    = document.getElementById('video-views');
  const videoLikesWrap   = document.getElementById('vi-likes');
  const videoLikesVal    = document.getElementById('video-likes');
  const videoDateWrap    = document.getElementById('vi-date');
  const videoDateVal     = document.getElementById('video-date');
  const videoUploaderRow = document.getElementById('vi-uploader-row');
  const videoUploaderVal = document.getElementById('video-uploader');

  // Format picker
  const formatPicker     = document.getElementById('format-picker');
  const formatCards      = document.querySelectorAll('.format-card');

  // Filename
  const filenameGroup    = document.getElementById('filename-group');
  const filenameInput    = document.getElementById('yt-filename');
  const btnResetFilename = document.getElementById('btn-reset-filename');

  // Progress / message
  const progressWrap     = document.getElementById('dl-progress-wrap');
  const progressLabel    = document.getElementById('dl-progress-label');
  const msgBox           = document.getElementById('dl-message');

  let originalTitle   = '';
  let selectedFormat  = 'mp4';
  let selectedQuality = 'best';

  // ── UI helpers ──────────────────────────────────────────────
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

  function showStat(wrapEl, valEl, value) {
    if (value != null) {
      valEl.textContent = value;
      wrapEl.classList.remove('hidden');
    } else {
      wrapEl.classList.add('hidden');
    }
  }

  // ── Format card selection ───────────────────────────────────
  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      formatCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedFormat  = card.dataset.format;
      selectedQuality = card.dataset.quality;
      btnDownload.classList.remove('hidden');
    });
  });

  // ── Reset filename ──────────────────────────────────────────
  btnResetFilename.addEventListener('click', () => {
    filenameInput.value = originalTitle;
    filenameInput.focus();
  });

  // ── Get video info ──────────────────────────────────────────
  btnGetInfo.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url)            { showMessage('Introduce una URL', 'error'); urlInput.classList.add('shake'); setTimeout(() => urlInput.classList.remove('shake'), 500); return; }
    if (!isValidUrl(url)) { showMessage('URL no válida o plataforma no soportada', 'error'); urlInput.classList.add('shake'); setTimeout(() => urlInput.classList.remove('shake'), 500); return; }

    hideMessage();
    videoThumb.src = '';
    videoThumb.alt = '';
    videoTitle.textContent = '';
    videoInfo.classList.add('hidden');
    formatPicker.classList.add('hidden');
    btnDownload.classList.add('hidden');
    filenameGroup.classList.add('hidden');
    setLoading(true);
    progressLabel.textContent = 'Obteniendo información...';

    try {
      const res  = await fetch(`/api/download/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const info = data.data;

      videoThumb.src = info.thumbnail || '';
      videoThumb.alt = info.title     || '';

      const dur = formatDuration(info.duration);
      if (dur) {
        videoDurBadge.textContent = dur;
        videoDurBadge.classList.remove('hidden');
      } else {
        videoDurBadge.classList.add('hidden');
      }

      videoTitle.textContent = info.title || '—';

      showStat(videoViewsWrap, videoViewsVal, formatCount(info.viewCount));
      showStat(videoLikesWrap, videoLikesVal, formatCount(info.likeCount));
      showStat(videoDateWrap,  videoDateVal,  formatUploadDate(info.uploadDate));

      if (info.uploader) {
        videoUploaderVal.textContent = info.uploader;
        videoUploaderRow.classList.remove('hidden');
      } else {
        videoUploaderRow.classList.add('hidden');
      }

      originalTitle       = sanitizeFilename(info.title || 'descarga');
      filenameInput.value = originalTitle;

      videoInfo.classList.remove('hidden');
      formatPicker.classList.remove('hidden');
      filenameGroup.classList.remove('hidden');

      if (!document.querySelector('.format-card.selected')) {
        formatCards[0].click();
      }

      showMessage('Elige un formato y pulsa Descargar.', 'success');
    } catch (err) {
      showMessage(err.message || 'Error al obtener información', 'error');
    } finally {
      setLoading(false);
    }
  });

  // ── Download ────────────────────────────────────────────────
  btnDownload.addEventListener('click', async () => {
    const url      = urlInput.value.trim();
    const filename = sanitizeFilename(filenameInput.value) || originalTitle || 'descarga';

    if (!url || !isValidUrl(url)) {
      showMessage('URL no válida o plataforma no soportada', 'error');
      return;
    }
    if (!selectedFormat) {
      showMessage('Elige un formato antes de descargar', 'error');
      return;
    }

    hideMessage();
    setLoading(true);
    progressLabel.textContent = 'Descargando (puede tardar varios minutos)...';

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format: selectedFormat, quality: selectedQuality, filename })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const blob        = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match       = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      const serverName  = match ? decodeURIComponent(match[1]) : `${filename}.${selectedFormat}`;

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
