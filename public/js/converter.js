/* ─── Converter section ────────────────────────────────────── */
(function () {
  const dropZone      = document.getElementById('drop-zone');
  const fileInput     = document.getElementById('audio-file-input');
  const fileInfoBox   = document.getElementById('file-info');
  const fileNameEl    = document.getElementById('file-name');
  const fileSizeEl    = document.getElementById('file-size');
  const btnClear      = document.getElementById('btn-clear-file');
  const formatSelect  = document.getElementById('output-format');
  const btnConvert    = document.getElementById('btn-convert');
  const progressWrap  = document.getElementById('cv-progress-wrap');
  const progressLabel = document.getElementById('cv-progress-label');
  const msgBox        = document.getElementById('cv-message');

  const MAX_BYTES = 50 * 1024 * 1024;
  let selectedFile = null;

  // ── Load supported formats ──
  (async function loadFormats() {
    try {
      const res  = await fetch('/api/convert/formats');
      const data = await res.json();
      if (!data.success) throw new Error();
      formatSelect.innerHTML = data.formats
        .map(f => `<option value="${f}">${f.toUpperCase()}</option>`)
        .join('');
    } catch {
      formatSelect.innerHTML = '<option value="">Error al cargar formatos</option>';
    }
  })();

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function showMessage(text, type) {
    msgBox.textContent = text;
    msgBox.className = `message ${type}`;
    msgBox.classList.remove('hidden');
  }

  function hideMessage() { msgBox.classList.add('hidden'); }

  function setFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showMessage(`El archivo supera el límite de 50 MB (${formatBytes(file.size)})`, 'error');
      return;
    }
    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileInfoBox.classList.remove('hidden');
    btnConvert.disabled = false;
    hideMessage();
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfoBox.classList.add('hidden');
    btnConvert.disabled = true;
    hideMessage();
  }

  // ── Drag & Drop ──
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
  dropZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') fileInput.click();
  });

  // ── File input ──
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  // ── Clear file ──
  btnClear.addEventListener('click', clearFile);

  // ── Convert ──
  btnConvert.addEventListener('click', async () => {
    if (!selectedFile) { showMessage('Selecciona un archivo primero', 'error'); return; }

    const outputFormat = formatSelect.value;
    if (!outputFormat) { showMessage('Selecciona un formato de salida', 'error'); return; }

    hideMessage();
    btnConvert.disabled = true;
    progressWrap.classList.remove('hidden');
    progressLabel.textContent = 'Convirtiendo... (puede tardar según la duración)';

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('outputFormat', outputFormat);

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${res.status})`);
      }

      const blob        = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match       = disposition.match(/filename="?([^"]+)"?/);
      const filename    = match ? match[1] : `convertido.${outputFormat}`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor    = document.createElement('a');
      anchor.href     = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      showMessage('Conversión completada. Archivo descargado.', 'success');
      clearFile();
    } catch (err) {
      showMessage(err.message || 'Error durante la conversión', 'error');
    } finally {
      progressWrap.classList.add('hidden');
      btnConvert.disabled = false;
    }
  });
})();
