import { normalizeMac, normalizeSerial, normalizeText } from './utils.js';

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
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

let activeScanner = null;

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

function getQrBox(viewfinderWidth, viewfinderHeight, scanMode) {
  if (scanMode === 'QR') {
    const size = Math.max(220, Math.min(viewfinderWidth, viewfinderHeight, 320));
    return { width: size, height: size };
  }

  const width = Math.max(280, Math.min(Math.floor(viewfinderWidth * 0.92), 560));
  const height = Math.max(140, Math.min(Math.floor(viewfinderHeight * 0.3), 190));
  return { width, height };
}

function getScannerConfig(scanMode) {
  if (scanMode === 'QR') {
    return {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => getQrBox(viewfinderWidth, viewfinderHeight, scanMode),
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    };
  }

  return {
    fps: 12,
    qrbox: (viewfinderWidth, viewfinderHeight) => getQrBox(viewfinderWidth, viewfinderHeight, scanMode),
    formatsToSupport: BARCODE_FORMATS,
  };
}

function normalizeOcrText(text) {
  return String(text ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[|]/g, '/')
    .replace(/\r/g, '\n');
}

function extractSerialFromOcr(text) {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [...lines, normalizedText.replace(/\s+/g, ' ')];

  for (const candidate of candidates) {
    for (const pattern of OCR_SERIAL_PATTERNS) {
      const match = candidate.match(pattern);
      if (match?.[1]) {
        return normalizeSerial(match[1]);
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].replace(/\s+/g, ' ');
    if (/S\s*\/\s*N/i.test(current) || /\bSN\b/i.test(current)) {
      const nextLine = lines[index + 1] ?? '';
      const merged = `${current} ${nextLine}`.trim();
      for (const pattern of OCR_SERIAL_PATTERNS) {
        const match = merged.match(pattern);
        if (match?.[1]) {
          return normalizeSerial(match[1]);
        }
      }
    }
  }

  return null;
}

function extractMacFromOcr(text) {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [...lines, normalizedText.replace(/\s+/g, ' ')];

  for (const candidate of candidates) {
    for (const pattern of OCR_MAC_PATTERNS) {
      const match = candidate.match(pattern);
      if (match?.[1]) {
        return normalizeMac(match[1]);
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].replace(/\s+/g, ' ');
    if (/MAC/i.test(current)) {
      const nextLine = lines[index + 1] ?? '';
      const merged = `${current} ${nextLine}`.trim();
      for (const pattern of OCR_MAC_PATTERNS) {
        const match = merged.match(pattern);
        if (match?.[1]) {
          return normalizeMac(match[1]);
        }
      }
    }
  }

  return '';
}

function extractModelFromOcr(text) {
  const normalizedText = normalizeOcrText(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [...lines, normalizedText.replace(/\s+/g, ' ')];

  for (const candidate of candidates) {
    for (const pattern of OCR_MODEL_PATTERNS) {
      const match = candidate.match(pattern);
      if (match?.[1]) {
        return normalizeText(match[1].replace(/\s+/g, ' '));
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].replace(/\s+/g, ' ');
    if (/MODEL|MODELO/i.test(current)) {
      const nextLine = lines[index + 1] ?? '';
      const merged = `${current} ${nextLine}`.trim();
      for (const pattern of OCR_MODEL_PATTERNS) {
        const match = merged.match(pattern);
        if (match?.[1]) {
          return normalizeText(match[1].replace(/\s+/g, ' '));
        }
      }
    }
  }

  return '';
}

async function startBarcodeScanner({ elementId, scanMode, onScan, onError }) {
  if (typeof Html5Qrcode !== 'function') {
    throw new Error('La librería de códigos de barras no está disponible.');
  }

  const container = getScannerContainer(elementId);
  clearContainer(container);

  const html5Qrcode = new Html5Qrcode(elementId, { formatsToSupport: BARCODE_FORMATS });
  const successCallback = async (decodedText) => {
    await stopScanner();
    await Promise.resolve(onScan(decodedText));
  };

  try {
    await html5Qrcode.start(
      { facingMode: 'environment' },
      getScannerConfig(scanMode),
      successCallback,
      onError,
    );
  } catch (error) {
    clearContainer(container);
    throw error;
  }

  activeScanner = {
    mode: scanMode,
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

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

async function startOcrScanner({ elementId, onScan, onError }) {
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

  const overlay = document.createElement('div');
  overlay.className = 'ocr-overlay';
  overlay.textContent = 'Apunta a la línea S/N y MAC y mantenla centrada un momento.';

  frame.append(video, overlay);
  container.append(frame);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });

  video.srcObject = stream;
  await video.play();

  const worker = await window.Tesseract.createWorker('eng');
  const canvas = ensureCanvas(1600, 1200);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const scannerState = {
    mode: 'SN',
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

  const scanFrame = async () => {
    if (scannerState.stopped) return;
    if (scannerState.busy) {
      scannerState.timerId = window.setTimeout(scanFrame, 250);
      return;
    }

    if (!scannerState.video.videoWidth || !scannerState.video.videoHeight) {
      scannerState.timerId = window.setTimeout(scanFrame, 250);
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
      const serial = extractSerialFromOcr(text);
      const mac = extractMacFromOcr(text);
      const modelo = extractModelFromOcr(text);

      if (serial) {
        await stopScanner();
        await Promise.resolve(onScan({ serial, mac, modelo, rawText: text }));
        return;
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

export async function startScanner({ elementId, scanMode = 'BARCODE', onScan, onError = () => {} }) {
  await stopScanner();

  if (scanMode === 'SN') {
    await startOcrScanner({ elementId, onScan, onError });
    return;
  }

  await startBarcodeScanner({ elementId, scanMode, onScan, onError });
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
    if (scanner.mode === 'SN') {
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
