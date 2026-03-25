import { demoRecords } from './demo-data.js';
import { APP_VERSION } from './constants.js';
import { startScanner, startSequentialOcrScanner, stopScanner, isScannerActive } from './scanner.js';
import { loadRecords, saveRecords, loadSettings, saveSettings } from './storage.js';
import {
  createRecord,
  downloadCsv,
  ensureRecordHistory,
  normalizeMac,
  normalizeSerial,
  toCsv,
} from './utils.js';
import {
  renderFilterChips,
  renderRecordDetail,
  renderRecords,
  setFeedback,
  toggleDuplicateAlert,
  updateCounters,
  updateLastCapture,
} from './ui.js';

const isNativePlatform = Boolean(globalThis.Capacitor?.isNativePlatform?.());
const initialSettings = loadSettings();

const state = {
  registros: loadRecords().map(ensureRecordHistory),
  filtro: 'TODOS',
  busqueda: '',
  idEdicion: null,
  idRegistroSeleccionado: null,
  estadoObjetivoEscaneo: 'INSTALADO',
  scanModes: initialSettings.scanModes ?? { qr: false, barcode: false, text: true },
  ocrFields: initialSettings.ocrFields ?? ['marca', 'modelo', 'sn', 'mac'],
  promptDiferido: null,
};

const referencias = {
  botonInstalarApp: document.querySelector('#installButton'),
  // Checkboxes de modo
  checkQr: document.querySelector('#scanModeQr'),
  checkBarcode: document.querySelector('#scanModeBarcode'),
  checkText: document.querySelector('#scanModeText'),
  // OCR field selector
  ocrFieldSelector: document.querySelector('#ocrFieldSelector'),
  ocrFieldMarca: document.querySelector('#ocrFieldMarca'),
  ocrFieldModelo: document.querySelector('#ocrFieldModelo'),
  ocrFieldSn: document.querySelector('#ocrFieldSn'),
  ocrFieldMac: document.querySelector('#ocrFieldMac'),
  // Rest
  etiquetaModoLectura: document.querySelector('#scannerModeLabel'),
  botonEscaneoEquipoInstalado: document.querySelector('#scanEquipoInstaladoButton'),
  botonEscaneoEquipoDesinstalado: document.querySelector('#scanEquipoDesinstaladoButton'),
  botonDetenerCamara: document.querySelector('#stopScannerButton'),
  etiquetaModoEscaneo: document.querySelector('#scannerModeLabel'),
  alertaDuplicado: document.querySelector('#duplicateAlert'),
  bandaFeedback: document.querySelector('#feedbackBanner'),
  serialUltimaCaptura: document.querySelector('#lastSerial'),
  metaUltimaCaptura: document.querySelector('#lastCaptureMeta'),
  insigniaConexion: document.querySelector('#connectionBadge'),
  contadorRegistros: document.querySelector('#recordCount'),
  contadorEquiposInstalados: document.querySelector('#equipoInstaladoCount'),
  contadorEquiposDesinstalados: document.querySelector('#equipoDesinstaladoCount'),
  cuerpoTablaInventario: document.querySelector('#inventoryTableBody'),
  chipsFiltro: document.querySelector('#filterChips'),
  entradaBusqueda: document.querySelector('#searchInput'),
  formularioInventario: document.querySelector('#inventoryForm'),
  idRegistro: document.querySelector('#recordId'),
  serial: document.querySelector('#serial'),
  marca: document.querySelector('#marca'),
  modelo: document.querySelector('#modelo'),
  estado: document.querySelector('#estado'),
  mac: document.querySelector('#mac'),
  cliente: document.querySelector('#cliente'),
  ubicacion: document.querySelector('#ubicacion'),
  tecnico: document.querySelector('#tecnico'),
  observaciones: document.querySelector('#observaciones'),
  botonGuardar: document.querySelector('#saveButton'),
  botonCancelarEdicion: document.querySelector('#cancelEditButton'),
  botonExportar: document.querySelector('#exportButton'),
  botonVaciarTodo: document.querySelector('#clearAllButton'),
  botonCargarDemo: document.querySelector('#loadDemoButton'),
  panelDetalle: document.querySelector('#detailPanel'),
};

function getScanModeLabel() {
  const labels = [];
  if (state.scanModes.qr) labels.push('QR');
  if (state.scanModes.barcode) labels.push('Barras');
  if (state.scanModes.text) labels.push('Texto');
  return labels.length ? labels.join(' + ') : 'Sin modo';
}

function getSelectedOcrFields() {
  const fields = [];
  if (referencias.ocrFieldMarca?.checked) fields.push('marca');
  if (referencias.ocrFieldModelo?.checked) fields.push('modelo');
  if (referencias.ocrFieldSn?.checked) fields.push('sn');
  if (referencias.ocrFieldMac?.checked) fields.push('mac');
  return fields;
}

function syncCheckboxesToState() {
  state.scanModes = {
    qr: referencias.checkQr?.checked ?? false,
    barcode: referencias.checkBarcode?.checked ?? false,
    text: referencias.checkText?.checked ?? false,
  };
  state.ocrFields = getSelectedOcrFields();
  saveSettings({ ...loadSettings(), scanModes: state.scanModes, ocrFields: state.ocrFields });
}

function syncStateToCheckboxes() {
  if (referencias.checkQr) referencias.checkQr.checked = state.scanModes.qr;
  if (referencias.checkBarcode) referencias.checkBarcode.checked = state.scanModes.barcode;
  if (referencias.checkText) referencias.checkText.checked = state.scanModes.text;

  // OCR field checkboxes
  const ocrFields = state.ocrFields;
  if (referencias.ocrFieldMarca) referencias.ocrFieldMarca.checked = ocrFields.includes('marca');
  if (referencias.ocrFieldModelo) referencias.ocrFieldModelo.checked = ocrFields.includes('modelo');
  if (referencias.ocrFieldSn) referencias.ocrFieldSn.checked = ocrFields.includes('sn');
  if (referencias.ocrFieldMac) referencias.ocrFieldMac.checked = ocrFields.includes('mac');
}

function updateOcrFieldSelectorVisibility() {
  if (referencias.ocrFieldSelector) {
    referencias.ocrFieldSelector.classList.toggle('hidden', !state.scanModes.text);
  }
}

function beep(success = true) {
  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = success ? 'sine' : 'square';
    oscillator.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.03;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {
    // Sin audio disponible, se mantiene el feedback visual.
  }
}

function findDuplicate(serial, excludedId = null) {
  const normalized = normalizeSerial(serial);
  return state.registros.find((record) => record.serial === normalized && record.id !== excludedId) ?? null;
}

function getFilteredRecords() {
  const search = state.busqueda.trim().toLowerCase();
  return [...state.registros]
    .filter((record) => (state.filtro === 'TODOS' ? true : record.estado === state.filtro))
    .filter((record) => {
      if (!search) return true;
      return [record.serial, record.mac, record.modelo, record.marca, record.cliente, record.tecnico, record.ubicacion]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => new Date(b.fechaUltimoMovimiento) - new Date(a.fechaUltimoMovimiento));
}

function getSelectedRecord() {
  return state.registros.find((record) => record.id === state.idRegistroSeleccionado) ?? null;
}

function persistRecords() {
  saveRecords(state.registros);
}

function syncSelectedRecord(filteredRecords) {
  if (!state.registros.length) {
    state.idRegistroSeleccionado = null;
    return;
  }

  const stillExists = state.registros.some((record) => record.id === state.idRegistroSeleccionado);
  if (stillExists) return;

  state.idRegistroSeleccionado = filteredRecords[0]?.id ?? state.registros[0]?.id ?? null;
}

function refreshUi() {
  const filteredRecords = getFilteredRecords();
  syncSelectedRecord(filteredRecords);

  renderFilterChips(referencias.chipsFiltro, state.filtro, (nextFilter) => {
    state.filtro = nextFilter;
    refreshUi();
  });
  renderRecords({
    records: filteredRecords,
    tableBody: referencias.cuerpoTablaInventario,
    onEdit: startEditing,
    onDelete: removeRecord,
    onSelect: selectRecord,
    selectedId: state.idRegistroSeleccionado,
  });
  renderRecordDetail({
    container: referencias.panelDetalle,
    record: getSelectedRecord(),
    onEdit: startEditing,
  });
  updateCounters({
    records: state.registros,
    recordCount: referencias.contadorRegistros,
    equipoInstaladoCount: referencias.contadorEquiposInstalados,
    equipoDesinstaladoCount: referencias.contadorEquiposDesinstalados,
  });
  updateNetworkStatus();
  updateOcrFieldSelectorVisibility();
}

function setScannerLabel() {
  referencias.etiquetaModoEscaneo.textContent = isScannerActive()
    ? `Cámara activa · ${getScanModeLabel()} · alta ${state.estadoObjetivoEscaneo}`
    : `Cámara inactiva · ${getScanModeLabel()}`;
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  if (isNativePlatform) {
    referencias.insigniaConexion.textContent = `App nativa · v${APP_VERSION}`;
    return;
  }

  referencias.insigniaConexion.textContent = online
    ? `Local + offline · v${APP_VERSION}`
    : `Sin conexión · modo offline · v${APP_VERSION}`;
}

function resetForm() {
  state.idEdicion = null;
  referencias.formularioInventario.reset();
  referencias.idRegistro.value = '';
  referencias.estado.value = state.estadoObjetivoEscaneo;
  referencias.botonCancelarEdicion.classList.add('hidden');
  referencias.botonGuardar.textContent = 'Guardar registro';
  toggleDuplicateAlert(referencias.alertaDuplicado, false);
}

function fillForm(record) {
  state.idEdicion = record.id;
  referencias.idRegistro.value = record.id;
  referencias.serial.value = record.serial;
  referencias.mac.value = record.mac ?? '';
  referencias.marca.value = record.marca ?? '';
  referencias.modelo.value = record.modelo;
  referencias.estado.value = record.estado;
  referencias.cliente.value = record.cliente;
  referencias.ubicacion.value = record.ubicacion;
  referencias.tecnico.value = record.tecnico;
  referencias.observaciones.value = record.observaciones;
  referencias.botonCancelarEdicion.classList.remove('hidden');
  referencias.botonGuardar.textContent = 'Actualizar registro';
}

function selectRecord(id) {
  state.idRegistroSeleccionado = id;
  refreshUi();
}

function saveFormRecord(formData, source = 'manual') {
  const currentRecord = state.registros.find((record) => record.id === state.idEdicion) ?? null;
  const duplicate = findDuplicate(formData.serial, currentRecord?.id ?? null);
  toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(duplicate));

  if (duplicate) {
    throw new Error(`El serial ${duplicate.serial} ya existe en inventario.`);
  }

  const record = createRecord({ ...formData, fuenteCaptura: source }, currentRecord);
  if (currentRecord) {
    state.registros = state.registros.map((item) => (item.id === currentRecord.id ? record : item));
  } else {
    state.registros = [record, ...state.registros];
  }
  state.idRegistroSeleccionado = record.id;
  persistRecords();
  updateLastCapture({
    serialElement: referencias.serialUltimaCaptura,
    metaElement: referencias.metaUltimaCaptura,
    record,
  });
  refreshUi();
  resetForm();
  setFeedback(referencias.bandaFeedback, `Registro ${currentRecord ? 'actualizado' : 'guardado'}: ${record.serial}.`, 'success');
  beep(true);
}

function getScanPayload(scanResult) {
  if (typeof scanResult === 'string') {
    return {
      serial: scanResult,
      mac: '',
      marca: '',
      modelo: '',
    };
  }

  return {
    serial: scanResult?.serial ?? '',
    mac: scanResult?.mac ?? '',
    marca: scanResult?.marca ?? '',
    modelo: scanResult?.modelo ?? '',
  };
}

async function handleScan(scanResult) {
  const payload = getScanPayload(scanResult);
  const serial = normalizeSerial(payload.serial);
  const mac = normalizeMac(payload.mac);
  const marca = String(payload.marca ?? '').trim();
  const modelo = String(payload.modelo ?? '').trim();
  const duplicate = findDuplicate(serial);
  toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(duplicate));

  if (duplicate) {
    const cambios = [];

    if (mac && !duplicate.mac) {
      cambios.push(`MAC ${mac}`);
    }

    if (marca && !duplicate.marca) {
      cambios.push(`marca ${marca}`);
    }

    if (modelo && !duplicate.modelo) {
      cambios.push(`modelo ${modelo}`);
    }

    if (cambios.length) {
      const updatedRecord = createRecord(
        {
          ...duplicate,
          mac: mac || duplicate.mac,
          marca: marca || duplicate.marca,
          modelo: modelo || duplicate.modelo,
          fuenteCaptura: duplicate.fuenteCaptura ?? 'camara',
        },
        duplicate,
      );
      state.registros = state.registros.map((item) => (item.id === duplicate.id ? updatedRecord : item));
      state.idRegistroSeleccionado = updatedRecord.id;
      persistRecords();
      updateLastCapture({
        serialElement: referencias.serialUltimaCaptura,
        metaElement: referencias.metaUltimaCaptura,
        record: updatedRecord,
      });
      refreshUi();
      setFeedback(referencias.bandaFeedback, `${cambios.join(' y ')} añadido${cambios.length > 1 ? 's' : ''} al registro existente ${serial}.`, 'success');
      beep(true);
      return;
    }

    state.idRegistroSeleccionado = duplicate.id;
    updateLastCapture({
      serialElement: referencias.serialUltimaCaptura,
      metaElement: referencias.metaUltimaCaptura,
      record: duplicate,
    });
    refreshUi();
    setFeedback(referencias.bandaFeedback, `Duplicado detectado: ${serial} ya está registrado.`, 'error');
    beep(false);
    return;
  }

  const record = createRecord({
    serial,
    mac,
    marca,
    modelo,
    estado: state.estadoObjetivoEscaneo,
    cliente: referencias.cliente.value,
    ubicacion: referencias.ubicacion.value,
    tecnico: referencias.tecnico.value,
    observaciones: '',
    fuenteCaptura: 'camara',
  });

  state.registros = [record, ...state.registros];
  state.idRegistroSeleccionado = record.id;
  persistRecords();
  updateLastCapture({ serialElement: referencias.serialUltimaCaptura, metaElement: referencias.metaUltimaCaptura, record });
  refreshUi();
  setFeedback(
    referencias.bandaFeedback,
    [
      `Escaneo correcto: ${serial}`,
      mac ? `MAC ${mac}` : null,
      marca ? `marca ${marca}` : null,
      modelo ? `modelo ${modelo}` : null,
    ]
      .filter(Boolean)
      .join(' · ') + ` registrado como ${record.estado}.`,
    'success',
  );
  beep(true);
}

async function activateScanner(estadoObjetivo) {
  syncCheckboxesToState();
  state.estadoObjetivoEscaneo = estadoObjetivo;
  referencias.estado.value = estadoObjetivo;
  setFeedback(referencias.bandaFeedback, 'Inicializando cámara...', 'info');
  setScannerLabel();

  const modes = state.scanModes;
  const hasAnyMode = modes.qr || modes.barcode || modes.text;

  if (!hasAnyMode) {
    setFeedback(referencias.bandaFeedback, 'Selecciona al menos un modo de escaneo (QR, Código de barras o Texto).', 'error');
    return;
  }

  try {
    if (modes.text) {
      const fields = getSelectedOcrFields();
      if (!fields.length) {
        setFeedback(referencias.bandaFeedback, 'Selecciona al menos un campo OCR para escanear.', 'error');
        return;
      }

      await startSequentialOcrScanner({
        elementId: 'reader',
        fields,
        onFieldScan: (field, value, skipped) => {
          const fieldLabels = { marca: 'Marca', modelo: 'Modelo', sn: 'N/S', mac: 'MAC' };
          const label = fieldLabels[field] ?? field;
          if (skipped) {
            setFeedback(referencias.bandaFeedback, `${label}: no detectado, dejado en blanco.`, 'info');
          } else {
            setFeedback(referencias.bandaFeedback, `${label}: "${value}" capturado.`, 'success');
            beep(true);
          }
        },
        onComplete: async (collectedData) => {
          setScannerLabel();
          // Map OCR fields to form and create record
          const serial = collectedData.sn ?? '';
          const mac = collectedData.mac ?? '';
          const marca = collectedData.marca ?? '';
          const modelo = collectedData.modelo ?? '';

          if (!serial) {
            // Populate form for manual completion
            if (marca) referencias.marca.value = marca;
            if (modelo) referencias.modelo.value = modelo;
            if (mac) referencias.mac.value = mac;
            setFeedback(
              referencias.bandaFeedback,
              `Escaneo completado. No se detectó N/S. Completa el serial manualmente.${marca ? ` Marca: ${marca}` : ''}${modelo ? ` Modelo: ${modelo}` : ''}${mac ? ` MAC: ${mac}` : ''}`,
              'info',
            );
            return;
          }

          await handleScan({ serial, mac, marca, modelo });
        },
        onError: () => {},
      });
    } else {
      await startScanner({
        elementId: 'reader',
        modes,
        onScan: (decodedText) => handleScan(decodedText),
        onError: () => {},
      });
    }

    setScannerLabel();
    setFeedback(
      referencias.bandaFeedback,
      `Cámara lista para registrar equipos en estado ${estadoObjetivo} usando ${getScanModeLabel()}.`,
      'info',
    );
  } catch (error) {
    setScannerLabel();
    setFeedback(
      referencias.bandaFeedback,
      `No se pudo abrir la cámara. Verifica permisos en Safari/Chrome móvil. ${error.message}`,
      'error',
    );
  }
}

function startEditing(id) {
  const record = state.registros.find((item) => item.id === id);
  if (!record) return;
  state.idRegistroSeleccionado = record.id;
  fillForm(record);
  updateLastCapture({
    serialElement: referencias.serialUltimaCaptura,
    metaElement: referencias.metaUltimaCaptura,
    record,
  });
  refreshUi();
  setFeedback(referencias.bandaFeedback, `Editando ${record.serial}.`, 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeRecord(id) {
  const record = state.registros.find((item) => item.id === id);
  if (!record) return;

  state.registros = state.registros.filter((item) => item.id !== id);
  if (state.idRegistroSeleccionado === id) {
    state.idRegistroSeleccionado = null;
  }
  persistRecords();
  refreshUi();
  toggleDuplicateAlert(referencias.alertaDuplicado, false);
  setFeedback(referencias.bandaFeedback, `Registro eliminado: ${record.serial}.`, 'info');
}

function exportRecords() {
  if (!state.registros.length) {
    setFeedback(referencias.bandaFeedback, 'No hay registros para exportar.', 'error');
    return;
  }

  const content = toCsv(getFilteredRecords());
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  downloadCsv(`duartec-inventario-${timestamp}.csv`, content);
  setFeedback(referencias.bandaFeedback, 'CSV exportado correctamente.', 'success');
}

function loadDemoData() {
  const settings = loadSettings();
  if (!settings.demoLoaded && !state.registros.length) {
    state.registros = demoRecords.map(ensureRecordHistory);
    state.idRegistroSeleccionado = state.registros[0]?.id ?? null;
    persistRecords();
    saveSettings({ ...settings, demoLoaded: true });
    refreshUi();
    setFeedback(referencias.bandaFeedback, 'Datos demo cargados.', 'success');
    return;
  }

  state.registros = demoRecords.map(ensureRecordHistory);
  state.idRegistroSeleccionado = state.registros[0]?.id ?? null;
  persistRecords();
  refreshUi();
  setFeedback(referencias.bandaFeedback, 'Demo restablecida sobre el almacenamiento local.', 'info');
}

function clearRecords() {
  state.registros = [];
  state.idRegistroSeleccionado = null;
  persistRecords();
  refreshUi();
  resetForm();
  updateLastCapture({ serialElement: referencias.serialUltimaCaptura, metaElement: referencias.metaUltimaCaptura, record: null });
  setFeedback(referencias.bandaFeedback, 'Inventario local vaciado.', 'info');
}

function registerServiceWorker() {
  if (isNativePlatform) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setFeedback(referencias.bandaFeedback, 'No se pudo registrar el modo offline.', 'error');
    });
  }
}

function setupInstallPrompt() {
  if (isNativePlatform) {
    referencias.botonInstalarApp.classList.add('hidden');
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.promptDiferido = event;
    referencias.botonInstalarApp.classList.remove('hidden');
  });

  referencias.botonInstalarApp.addEventListener('click', async () => {
    if (!state.promptDiferido) return;
    state.promptDiferido.prompt();
    await state.promptDiferido.userChoice;
    state.promptDiferido = null;
    referencias.botonInstalarApp.classList.add('hidden');
  });
}

function handleScanModeChange() {
  syncCheckboxesToState();
  updateOcrFieldSelectorVisibility();
  setScannerLabel();
  const modeLabel = getScanModeLabel();
  setFeedback(referencias.bandaFeedback, `Modo de lectura: ${modeLabel}.`, 'info');
}

function bindEvents() {
  // Scan mode checkboxes
  referencias.checkQr?.addEventListener('change', handleScanModeChange);
  referencias.checkBarcode?.addEventListener('change', handleScanModeChange);
  referencias.checkText?.addEventListener('change', handleScanModeChange);

  // OCR field checkboxes
  referencias.ocrFieldMarca?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldModelo?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldSn?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldMac?.addEventListener('change', () => syncCheckboxesToState());

  referencias.botonEscaneoEquipoInstalado.addEventListener('click', () => activateScanner('INSTALADO'));
  referencias.botonEscaneoEquipoDesinstalado.addEventListener('click', () => activateScanner('DESINSTALADO'));
  referencias.botonDetenerCamara.addEventListener('click', async () => {
    await stopScanner();
    setScannerLabel();
    setFeedback(referencias.bandaFeedback, 'Cámara detenida.', 'info');
  });

  referencias.entradaBusqueda.addEventListener('input', (event) => {
    state.busqueda = event.target.value;
    refreshUi();
  });

  referencias.formularioInventario.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(referencias.formularioInventario));
    try {
      saveFormRecord(formData, 'manual');
    } catch (error) {
      setFeedback(referencias.bandaFeedback, error.message, 'error');
      beep(false);
    }
  });

  referencias.serial.addEventListener('input', (event) => {
    const duplicate = findDuplicate(event.target.value, state.idEdicion);
    toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(duplicate));
  });

  referencias.botonCancelarEdicion.addEventListener('click', () => {
    resetForm();
    setFeedback(referencias.bandaFeedback, 'Edición cancelada.', 'info');
  });

  referencias.botonExportar.addEventListener('click', exportRecords);
  referencias.botonVaciarTodo.addEventListener('click', clearRecords);
  referencias.botonCargarDemo.addEventListener('click', loadDemoData);

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

function init() {
  bindEvents();
  registerServiceWorker();
  setupInstallPrompt();

  // Restore checkbox states from settings
  syncStateToCheckboxes();
  updateOcrFieldSelectorVisibility();

  const [latest] = getFilteredRecords();
  state.idRegistroSeleccionado = latest?.id ?? null;

  refreshUi();
  resetForm();
  setScannerLabel();

  if (isNativePlatform) {
    referencias.botonInstalarApp.classList.add('hidden');
  }

  updateLastCapture({
    serialElement: referencias.serialUltimaCaptura,
    metaElement: referencias.metaUltimaCaptura,
    record: latest ?? null,
  });

  if (!state.registros.length) {
    setFeedback(
      referencias.bandaFeedback,
      'Inventario listo. Puedes empezar a escanear o cargar datos demo para probar el flujo.',
      'info',
    );
  }
}

init();
