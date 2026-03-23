const scannerState = {
  instance: null,
  active: false,
};

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
        qrbox: { width: 240, height: 140 },
        aspectRatio: 1.6,
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
