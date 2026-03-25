import { normalizeMac, normalizeSerial, normalizeText } from './utils.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || isIOS;

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
];

const BARCODE_FORMATS_IOS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
];

const OCR_SERIAL_PATTERNS = [
  /S\s*\/\s*N\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
  /\bSN\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
];

const OCR_MODEL_PATTERNS = [
  /(?:MODEL|MODELO)\s*[:\-]?\s*(.+)/i,
];

const OCR_MAC_PATTERNS = [
  /MAC\s*[:\-]?\s*([0-9A-FOIL]{2}(?:[-:\s]?[0-9A-FOIL]{2}){5})/i,
];

const OCR_BRAND_PATTERNS = [
  /(?:BRAND|MARCA)\s*[:\-]?\s*(.+)/i,
];

let activeScanner = null;

const OCR_ASSETS = {
  workerPath: './vendor/tesseract/worker.min.js',
  corePath: './vendor/tesseract/core',
  langPath: './vendor/tesseract/lang',
};

function getScannerContainer(elementId) {
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error(`No se encontró el contenedor de escaneo #${elementId}.`);
  }
  return container;
}

function clearContainer(container) {
  container.innerHTML = '';
}

function injectScanLine(parent) {
  const existing = parent.querySelector('.scan-line');
  if (existing) return;
  const line = document.createElement('div');
  line.className = 'scan-line';
  parent.style.position = 'relative';
  parent.appendChild(line);
}

function getQrBox(viewfinderWidth, viewfinderHeight, scanMode) {
  if (scanMode === 'QR') {
    const size = Math.max(220, Math.min(viewfinderWidth, viewfinderHeight, 320));
    return { width: size, height: size };
  }

  const width = Math.max(280, Math.min(Math.floor(viewfinderWidth * 0.92), 560));
  const height = Math.max(140, Math.min(Math.floor(viewfinderHeight * 0.3), 190));
  return { width, height };
}

function getFormatsForModes(modes) {
  const formats = [];
  if (modes.qr) {
    formats.push(Html5QrcodeSupportedFormats.QR_CODE);
  }
  if (modes.barcode) {
    const barcodeFormats = isSafari ? BARCODE_FORMATS_IOS : BARCODE_FORMATS;
    formats.push(...barcodeFormats);
  }
  return formats;
}

function getScannerConfig(modes) {
  const hasQr = modes.qr;
  const hasBarcode = modes.barcode;
  const isQrOnly = hasQr && !hasBarcode;

  const qrBoxMode = isQrOnly ? 'QR' : 'BARCODE';

  return {
    fps: isSafari ? 8 : 12,
    qrbox: (viewfinderWidth, viewfinderHeight) => getQrBox(viewfinderWidth, viewfinderHeight, qrBoxMode),
    formatsToSupport: getFormatsForModes(modes),
  };
}

async function getPreferredCameraConfig() {
  // Safari/iOS: never call getCameras(), use direct constraints
  if (isSafari) {
    return [{ facingMode: 'environment' }];
  }

  if (typeof globalThis.Html5Qrcode?.getCameras !== 'function') {
    return [{ facingMode: { ideal: 'environment' } }];
  }

  try {
    const cameras = await globalThis.Html5Qrcode.getCameras();
    if (!Array.isArray(cameras) || !cameras.length) {
      return [{ facingMode: { ideal: 'environment' } }];
    }

    const preferredCamera = cameras.find((camera) =>
      /back|rear|environment|trasera|posterior/i.test(camera.label ?? ''),
    ) ?? cameras[0];

    const preferredConfig = preferredCamera?.id
      ? { deviceId: { exact: preferredCamera.id } }
      : { facingMode: { ideal: 'environment' } };

    return [
      { facingMode: { ideal: 'environment' } },
      preferredConfig,
      { facingMode: 'environment' },
      { facingMode: 'user' },
    ];
  } catch {
    return [
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      { facingMode: 'user' },
    ];
  }
}

function normalizeOcrText(text) {
  return String(text ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[|]/g, '/')
    .replace(/\r/g, '\n');
}

function extractFromOcr(text, patterns) {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [...lines, normalizedText.replace(/\s+/g, ' ')];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  // Try merging consecutive lines for multi-line labels
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].replace(/\s+/g, ' ');
    const nextLine = lines[index + 1] ?? '';
    const merged = `${current} ${nextLine}`.trim();
    for (const pattern of patterns) {
      const match = merged.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return null;
}

function extractSerialFromOcr(text) {
  const raw = extractFromOcr(text, OCR_SERIAL_PATTERNS);
  return raw ? normalizeSerial(raw) : null;
}

function extractMacFromOcr(text) {
  const raw = extractFromOcr(text, OCR_MAC_PATTERNS);
  return raw ? normalizeMac(raw) : '';
}

function extractModelFromOcr(text) {
  const raw = extractFromOcr(text, OCR_MODEL_PATTERNS);
  return raw ? normalizeText(raw.replace(/\s+/g, ' ')) : '';
}

function extractBrandFromOcr(text) {
  const raw = extractFromOcr(text, OCR_BRAND_PATTERNS);
  return raw ? normalizeText(raw.replace(/\s+/g, ' ')) : '';
}

const OCR_FIELD_EXTRACTORS = {
  marca: extractBrandFromOcr,
  modelo: extractModelFromOcr,
  sn: extractSerialFromOcr,
  mac: extractMacFromOcr,
};

const OCR_FIELD_LABELS = {
  marca: 'Marca',
  modelo: 'Modelo',
  sn: 'N/S (Serial)',
  mac: 'MAC',
};

async function startBarcodeScanner({ elementId, modes, onScan, onError }) {
  if (typeof Html5Qrcode !== 'function') {
    throw new Error('La librería de códigos de barras no está disponible.');
  }

  const container = getScannerContainer(elementId);
  clearContainer(container);

  const formats = getFormatsForModes(modes);

  // On Safari, don't pass formats to constructor to avoid initialization errors
  const constructorOptions = isSafari ? {} : { formatsToSupport: formats };
  const html5Qrcode = new Html5Qrcode(elementId, constructorOptions);

  const successCallback = async (decodedText) => {
    await stopScanner();
    await Promise.resolve(onScan(decodedText));
  };

  const cameraConfigs = await getPreferredCameraConfig();
  let lastError = null;

  try {
    for (const cameraConfig of cameraConfigs) {
      try {
        await html5Qrcode.start(cameraConfig, getScannerConfig(modes), successCallback, onError);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
  } catch (error) {
    lastError = error;
  }

  if (lastError) {
    clearContainer(container);
    throw lastError;
  }

  // Inject red scan line after camera starts
  requestAnimationFrame(() => {
    injectScanLine(container);
  });

  activeScanner = {
    mode: 'barcode',
    html5Qrcode,
    container,
  };
}

function ensureCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function getRearCameraStream() {
  // Safari-safe: use simple constraints first
  if (isSafari) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }
  }

  const preferredConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferredConstraints);
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
  }
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

/**
 * Sequential OCR scanner that cycles through selected fields.
 */
export async function startSequentialOcrScanner({ elementId, fields, onFieldScan, onComplete, onError }) {
  if (!window.Tesseract?.createWorker) {
    throw new Error('La librería OCR no está disponible.');
  }

  const container = getScannerContainer(elementId);
  clearContainer(container);

  const frame = document.createElement('div');
  frame.className = 'ocr-frame';

  const video = document.createElement('video');
  video.className = 'ocr-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  const overlay = document.createElement('div');
  overlay.className = 'ocr-overlay';

  const fieldIndicator = document.createElement('div');
  fieldIndicator.className = 'ocr-field-indicator';

  frame.append(video, overlay, fieldIndicator);
  container.append(frame);

  // Inject red scan line
  injectScanLine(frame);

  let stream;
  try {
    stream = await getRearCameraStream();
  } catch (err) {
    clearContainer(container);
    throw new Error(`No se pudo acceder a la cámara. Verifica permisos. ${err.message}`);
  }

  video.srcObject = stream;
  await video.play();

  const worker = await window.Tesseract.createWorker('eng', 1, OCR_ASSETS);
  const canvas = ensureCanvas(1600, 1200);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const collectedData = {};
  let fieldIndex = 0;
  const fieldQueue = [...fields];

  function updateFieldDisplay() {
    if (fieldIndex >= fieldQueue.length) return;
    const currentField = fieldQueue[fieldIndex];
    const label = OCR_FIELD_LABELS[currentField] ?? currentField;
    const progress = `${fieldIndex + 1}/${fieldQueue.length}`;
    overlay.textContent = `Apunta a la etiqueta "${label}" del equipo y mantenla centrada.`;
    fieldIndicator.innerHTML = `<span class="field-badge active">${label}</span> <span class="field-progress">${progress}</span>`;
    // Show remaining fields
    const remaining = fieldQueue.slice(fieldIndex + 1).map(f => OCR_FIELD_LABELS[f] ?? f);
    if (remaining.length) {
      fieldIndicator.innerHTML += ` <span class="field-remaining">→ ${remaining.join(' → ')}</span>`;
    }
  }

  const scannerState = {
    mode: 'sequential-ocr',
    container,
    stream,
    video,
    worker,
    canvas,
    context,
    stopped: false,
    busy: false,
    timerId: null,
  };

  updateFieldDisplay();

  const AUTO_SKIP_TIMEOUT = 15000; // 15 seconds per field
  let fieldStartTime = Date.now();

  const scanFrame = async () => {
    if (scannerState.stopped) return;
    if (fieldIndex >= fieldQueue.length) {
      await stopScanner();
      await Promise.resolve(onComplete(collectedData));
      return;
    }
    if (scannerState.busy) {
      scannerState.timerId = window.setTimeout(scanFrame, 250);
      return;
    }

    if (!scannerState.video.videoWidth || !scannerState.video.videoHeight) {
      scannerState.timerId = window.setTimeout(scanFrame, 250);
      return;
    }

    // Auto-skip if timeout exceeded — leave field blank
    if (Date.now() - fieldStartTime > AUTO_SKIP_TIMEOUT) {
      const currentField = fieldQueue[fieldIndex];
      collectedData[currentField] = '';
      onFieldScan?.(currentField, '', true);
      fieldIndex += 1;
      fieldStartTime = Date.now();
      updateFieldDisplay();
      if (fieldIndex >= fieldQueue.length) {
        await stopScanner();
        await Promise.resolve(onComplete(collectedData));
        return;
      }
      scannerState.timerId = window.setTimeout(scanFrame, 300);
      return;
    }

    scannerState.busy = true;

    try {
      const sourceWidth = scannerState.video.videoWidth;
      const sourceHeight = scannerState.video.videoHeight;
      const ratio = Math.min(scannerState.canvas.width / sourceWidth, scannerState.canvas.height / sourceHeight, 1);
      const drawWidth = Math.max(1, Math.floor(sourceWidth * ratio));
      const drawHeight = Math.max(1, Math.floor(sourceHeight * ratio));
      const offsetX = Math.floor((scannerState.canvas.width - drawWidth) / 2);
      const offsetY = Math.floor((scannerState.canvas.height - drawHeight) / 2);

      scannerState.context.fillStyle = '#ffffff';
      scannerState.context.fillRect(0, 0, scannerState.canvas.width, scannerState.canvas.height);
      scannerState.context.drawImage(
        scannerState.video,
        0,
        0,
        sourceWidth,
        sourceHeight,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight,
      );

      const result = await scannerState.worker.recognize(scannerState.canvas);
      const text = result?.data?.text ?? '';

      const currentField = fieldQueue[fieldIndex];
      const extractor = OCR_FIELD_EXTRACTORS[currentField];

      if (extractor) {
        const value = extractor(text);
        if (value) {
          collectedData[currentField] = value;
          onFieldScan?.(currentField, value, false);
          fieldIndex += 1;
          fieldStartTime = Date.now();
          updateFieldDisplay();

          if (fieldIndex >= fieldQueue.length) {
            await stopScanner();
            await Promise.resolve(onComplete(collectedData));
            return;
          }
        }
      }
    } catch (error) {
      onError?.(error);
    } finally {
      scannerState.busy = false;
    }

    if (!scannerState.stopped) {
      scannerState.timerId = window.setTimeout(scanFrame, 1100);
    }
  };

  activeScanner = scannerState;
  scannerState.timerId = window.setTimeout(scanFrame, 500);
}

/**
 * Legacy single-pass OCR scanner (kept for backwards compatibility).
 */
async function startOcrScanner({ elementId, onScan, onError }) {
  await startSequentialOcrScanner({
    elementId,
    fields: ['sn', 'mac', 'modelo'],
    onFieldScan: () => {},
    onComplete: (data) => {
      onScan({
        serial: data.sn ?? '',
        mac: data.mac ?? '',
        modelo: data.modelo ?? '',
        rawText: '',
      });
    },
    onError,
  });
}

export async function startScanner({ elementId, modes, onScan, onError = () => {} }) {
  await stopScanner();

  if (modes.text) {
    await startOcrScanner({ elementId, onScan, onError });
    return;
  }

  if (modes.qr || modes.barcode) {
    await startBarcodeScanner({ elementId, modes, onScan, onError });
    return;
  }

  throw new Error('Selecciona al menos un modo de escaneo (QR, Código de barras o Texto).');
}

export async function stopScanner() {
  if (!activeScanner) return;

  const scanner = activeScanner;
  activeScanner = null;

  if (scanner.timerId) {
    window.clearTimeout(scanner.timerId);
  }

  scanner.stopped = true;

  try {
    if (scanner.mode === 'sequential-ocr' || scanner.mode === 'SN') {
      stopMediaStream(scanner.stream);
      await scanner.worker?.terminate?.();
    } else {
      await scanner.html5Qrcode?.stop?.();
      await scanner.html5Qrcode?.clear?.();
    }
  } catch {
    // Limpieza best-effort.
  } finally {
    scanner.container && clearContainer(scanner.container);
  }
}

export function isScannerActive() {
  return Boolean(activeScanner);
}

/**
 * Manually skip the current OCR field (leaves it blank).
 */
export function skipCurrentOcrField() {
  // No-op: auto-skip via timeout handles this.
  // This is a hook for future manual skip button.
}
