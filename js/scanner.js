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
  /(?:S\s*[\/\\]\s*N|SERIAL(?: NUMBER| NO\.?)?|REF|S\.?N\.?)\s*[:\-\.=\s\/\\]*\s*([A-Z0-9][A-Z0-9\s-]{4,})/i,
  /\bSN\s*[:\-\.=\s\/\\]*\s*([A-Z0-9][A-Z0-9\s-]{4,})/i,
];

const OCR_MODEL_PATTERNS = [
  /(?:MODEL NAME OF MANUFACTURE|MODEL NAME|MODELO|MODEL)\s*[:\-]?\s*(.+)/i,
];

const OCR_MAC_PATTERNS = [
  /(?:MAC|MAG|MC)\s*[:\-\.=\s\/\\]*\s*([0-9A-FOIL]{2}(?:[-:\s]?[0-9A-FOIL]{2}){5})/i,
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

const KNOWN_BRANDS = [
  'ZTE', 'HUAWEI', 'NOKIA', 'ALCATEL', 'CISCO', 'UBIQUITI', 'UBNT',
  'MIKROTIK', 'TP-LINK', 'D-LINK', 'ARUBA', 'JUNIPER', 'EXTREME', 'HP', 'DELL',
  'ARCADYAN', 'SERCOMM', 'SAGEMCOM', 'ASKEY', 'TECHNICOLOR', 'ZYXEL', 'OBSERVA', 
  'MITRASTAR', 'AMPER', 'NETGEAR'
];

function extractBrandFromOcr(text) {
  const raw = extractFromOcr(text, OCR_BRAND_PATTERNS);
  if (raw) return normalizeText(raw.replace(/\s+/g, ' '));

  const upperText = text.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upperText.includes(brand)) {
      return brand;
    }
  }
  return '';
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
    const safariConstraints = {
      audio: false,
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
    try {
      return await navigator.mediaDevices.getUserMedia(safariConstraints);
    } catch {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
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
  await worker.setParameters({
    tessedit_pageseg_mode: '11', // SPARSE_TEXT: ignora bloques gráficos pesados (barcodes) y pilla todo el texto
  });
  const canvas = ensureCanvas(1600, 1200);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const collectedData = {};
  let fieldQueue = [...fields];

  function updateFieldDisplay(debugText = '') {
    if (fieldQueue.length === 0) return;
    const remainingLabels = fieldQueue.map(f => OCR_FIELD_LABELS[f] ?? f).join(' · ');
    const displayAngle = [0, 90, 180, 270][scannerState?.rotationIndex ?? 0];
    overlay.innerHTML = `
      <div style="margin-bottom: 4px;">Apunta a la pegatina (${displayAngle}º).</div>
      <div style="font-size: 0.75rem; opacity: 0.8; color: var(--accent);">
        ${debugText ? `Lectura: ${debugText.substring(0, 45)}...` : 'Buscando datos...'}
      </div>
    `;
    fieldIndicator.innerHTML = `<span class="field-badge active">Buscando</span> <span class="field-remaining">${remainingLabels}</span>`;
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
    rotationIndex: 0,
  };

  updateFieldDisplay();

  const AUTO_TIMEOUT = 12000; // 12 seconds sum timeout without finding any new fields
  let lastFoundTime = Date.now();

  const scanFrame = async () => {
    if (scannerState.stopped) return;
    if (fieldQueue.length === 0) {
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

    // Auto-skip if timeout exceeded - wrap up with what we found
    if (Date.now() - lastFoundTime > AUTO_TIMEOUT) {
      for (const field of fieldQueue) {
        if (!collectedData[field]) {
          collectedData[field] = '';
          onFieldScan?.(field, '', true);
        }
      }
      fieldQueue = [];
      updateFieldDisplay();
      await stopScanner();
      await Promise.resolve(onComplete(collectedData));
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

      const rotationAngles = [0, 90, 180, 270];
      const angle = rotationAngles[scannerState.rotationIndex];
      const isSwapped = angle === 90 || angle === 270;

      scannerState.context.save();
      scannerState.context.filter = 'contrast(1.2) brightness(1.1)';
      scannerState.context.fillStyle = '#ffffff';
      scannerState.context.fillRect(0, 0, scannerState.canvas.width, scannerState.canvas.height);
      
      scannerState.context.translate(scannerState.canvas.width / 2, scannerState.canvas.height / 2);
      scannerState.context.rotate((angle * Math.PI) / 180);

      // Adjust draw targets for rotation
      const targetWidth = isSwapped ? drawHeight : drawWidth;
      const targetHeight = isSwapped ? drawWidth : drawHeight;

      scannerState.context.drawImage(
        scannerState.video,
        0,
        0,
        sourceWidth,
        sourceHeight,
        -targetWidth / 2,
        -targetHeight / 2,
        targetWidth,
        targetHeight,
      );
      scannerState.context.restore();

      const result = await scannerState.worker.recognize(scannerState.canvas);
      const text = result?.data?.text ?? '';

      updateFieldDisplay(text.trim().replace(/\s+/g, ' '));
      
      // Increment rotation for next frame
      scannerState.rotationIndex = (scannerState.rotationIndex + 1) % 4;

      let foundAny = false;
      const stillSearching = [];

      for (const currentField of fieldQueue) {
        const extractor = OCR_FIELD_EXTRACTORS[currentField];
        if (extractor) {
          const value = extractor(text);
          if (value) {
            collectedData[currentField] = value;
            onFieldScan?.(currentField, value, false);
            foundAny = true;
          } else {
            stillSearching.push(currentField);
          }
        } else {
          stillSearching.push(currentField);
        }
      }

      if (foundAny) {
        fieldQueue = stillSearching;
        lastFoundTime = Date.now();
        updateFieldDisplay();

        if (fieldQueue.length === 0) {
          await stopScanner();
          await Promise.resolve(onComplete(collectedData));
          return;
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

export async function processFileScan({ file, modes, fields, onScan, onError }) {
  try {
    if (modes.text) {
      if (!window.Tesseract?.createWorker) {
        throw new Error('La librería OCR no está disponible.');
      }
      const worker = await window.Tesseract.createWorker('eng', 1, OCR_ASSETS);
      await worker.setParameters({
        tessedit_pageseg_mode: '11', // SPARSE_TEXT
      });
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
        img.src = imgUrl;
      });

      const collectedData = {};
      const debugTexts = [];

      for (const angle of [0, 90, 180, 270]) {
        const isSwapped = angle === 90 || angle === 270;
        const canvas = ensureCanvas(
          isSwapped ? img.height : img.width,
          isSwapped ? img.width : img.height
        );
        const context = canvas.getContext('2d', { willReadFrequently: true });
        
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((angle * Math.PI) / 180);
        context.drawImage(img, -img.width / 2, -img.height / 2);

        const result = await worker.recognize(canvas);
        const text = result?.data?.text ?? '';
        debugTexts.push(`[Ángulo ${angle}º]\n${text}`);

        for (const currentField of fields) {
          if (!collectedData[currentField]) {
            const extractor = OCR_FIELD_EXTRACTORS[currentField];
            if (extractor) {
              const value = extractor(text);
              if (value) {
                collectedData[currentField] = value;
              }
            }
          }
        }

        // Si ya encontramos todos los campos solicitados, no seguimos rotando
        if (fields.every(f => collectedData[f])) {
          break;
        }
      }

      URL.revokeObjectURL(imgUrl);
      await worker.terminate();

      const payload = {
        serial: collectedData.sn ?? '',
        mac: collectedData.mac ?? '',
        marca: collectedData.marca ?? '',
        modelo: collectedData.modelo ?? '',
        rawText: debugTexts.join('\n\n')
      };
      
      return onScan(payload);
    }
    
    if (modes.qr || modes.barcode) {
      if (typeof Html5Qrcode !== 'function') throw new Error('Librería QR no detectada.');
      const formats = getFormatsForModes(modes);
      const html5Qrcode = new Html5Qrcode('reader', isSafari ? {} : { formatsToSupport: formats });
      const text = await html5Qrcode.scanFile(file, false);
      html5Qrcode.clear();
      return onScan(text);
    }
  } catch (error) {
    if (onError) onError(error);
    else throw error;
  }
}
