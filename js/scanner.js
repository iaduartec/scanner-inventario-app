const scannerState = {
  instance: null,
  active: false,
};

const barcodeFormats = [
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'CODABAR',
  'EAN_13',
  'EAN_8',
  'ITF',
  'UPC_A',
  'UPC_E',
];

function getBarcodeFormatsToSupport() {
  const formats = window.Html5QrcodeSupportedFormats;
  if (!formats) return undefined;

  const supported = barcodeFormats
    .map((format) => formats[format])
    .filter((format) => typeof format === 'number');

  return supported.length ? supported : undefined;
}

export async function startScanner({ elementId, onScan, onError }) {
  if (!window.Html5Qrcode) {
    throw new Error('No se pudo cargar la librería html5-qrcode.');
  }

  if (!scannerState.instance) {
    scannerState.instance = new window.Html5Qrcode(elementId);
  }

  if (scannerState.active) {
    await stopScanner();
  }

  try {
    await scannerState.instance.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.min(420, Math.floor(viewfinderWidth * 0.9));
          const height = Math.min(180, Math.floor(viewfinderHeight * 0.22));
          return { width, height: Math.max(120, height) };
        },
        aspectRatio: 1.6,
        formatsToSupport: getBarcodeFormatsToSupport(),
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        disableFlip: true,
        rememberLastUsedCamera: true,
      },
      onScan,
      () => {},
    );
    scannerState.active = true;
  } catch (error) {
    onError?.(error);
    throw error;
  }
}

export async function stopScanner() {
  if (scannerState.instance && scannerState.active) {
    await scannerState.instance.stop();
    await scannerState.instance.clear();
    scannerState.active = false;
  }
}

export function isScannerActive() {
  return scannerState.active;
}
