import { demoRecords } from './demo-data.js';
import { APP_VERSION } from './constants.js';
import { startScanner, stopScanner, isScannerActive } from './scanner.js';
import { loadRecords, saveRecords, loadSettings, saveSettings } from './storage.js';
import {
  createRecord,
  downloadCsv,
  ensureRecordHistory,
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

const state = {
  records: loadRecords().map(ensureRecordHistory),
  filter: 'TODOS',
  search: '',
  editId: null,
  selectedRecordId: null,
  scanTargetState: 'INSTALADO',
  deferredPrompt: null,
};

const elements = {
  installButton: document.querySelector('#installButton'),
  scanInstalledButton: document.querySelector('#scanInstalledButton'),
  scanReserveButton: document.querySelector('#scanReserveButton'),
  stopScannerButton: document.querySelector('#stopScannerButton'),
  scannerModeLabel: document.querySelector('#scannerModeLabel'),
  duplicateAlert: document.querySelector('#duplicateAlert'),
  feedbackBanner: document.querySelector('#feedbackBanner'),
  lastSerial: document.querySelector('#lastSerial'),
  lastCaptureMeta: document.querySelector('#lastCaptureMeta'),
  connectionBadge: document.querySelector('#connectionBadge'),
  recordCount: document.querySelector('#recordCount'),
  installedCount: document.querySelector('#installedCount'),
  reserveCount: document.querySelector('#reserveCount'),
  inventoryTableBody: document.querySelector('#inventoryTableBody'),
  filterChips: document.querySelector('#filterChips'),
  searchInput: document.querySelector('#searchInput'),
  inventoryForm: document.querySelector('#inventoryForm'),
  recordId: document.querySelector('#recordId'),
  serial: document.querySelector('#serial'),
  modelo: document.querySelector('#modelo'),
  estado: document.querySelector('#estado'),
  cliente: document.querySelector('#cliente'),
  ubicacion: document.querySelector('#ubicacion'),
  tecnico: document.querySelector('#tecnico'),
  observaciones: document.querySelector('#observaciones'),
  saveButton: document.querySelector('#saveButton'),
  cancelEditButton: document.querySelector('#cancelEditButton'),
  exportButton: document.querySelector('#exportButton'),
  clearAllButton: document.querySelector('#clearAllButton'),
  loadDemoButton: document.querySelector('#loadDemoButton'),
  detailPanel: document.querySelector('#detailPanel'),
};

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
  return state.records.find((record) => record.serial === normalized && record.id !== excludedId) ?? null;
}

function getFilteredRecords() {
  const search = state.search.trim().toLowerCase();
  return [...state.records]
    .filter((record) => (state.filter === 'TODOS' ? true : record.estado === state.filter))
    .filter((record) => {
      if (!search) return true;
      return [record.serial, record.modelo, record.cliente, record.tecnico, record.ubicacion]
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => new Date(b.fechaUltimoMovimiento) - new Date(a.fechaUltimoMovimiento));
}

function getSelectedRecord() {
  return state.records.find((record) => record.id === state.selectedRecordId) ?? null;
}

function persistRecords() {
  saveRecords(state.records);
}

function syncSelectedRecord(filteredRecords) {
  if (!state.records.length) {
    state.selectedRecordId = null;
    return;
  }

  const stillExists = state.records.some((record) => record.id === state.selectedRecordId);
  if (stillExists) return;

  state.selectedRecordId = filteredRecords[0]?.id ?? state.records[0]?.id ?? null;
}

function refreshUi() {
  const filteredRecords = getFilteredRecords();
  syncSelectedRecord(filteredRecords);

  renderFilterChips(elements.filterChips, state.filter, (nextFilter) => {
    state.filter = nextFilter;
    refreshUi();
  });
  renderRecords({
    records: filteredRecords,
    tableBody: elements.inventoryTableBody,
    onEdit: startEditing,
    onDelete: removeRecord,
    onSelect: selectRecord,
    selectedId: state.selectedRecordId,
  });
  renderRecordDetail({
    container: elements.detailPanel,
    record: getSelectedRecord(),
    onEdit: startEditing,
  });
  updateCounters({
    records: state.records,
    recordCount: elements.recordCount,
    installedCount: elements.installedCount,
    reserveCount: elements.reserveCount,
  });
  updateNetworkStatus();
}

function setScannerLabel() {
  elements.scannerModeLabel.textContent = isScannerActive()
    ? `Cámara activa · alta ${state.scanTargetState}`
    : 'Cámara inactiva';
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  elements.connectionBadge.textContent = online
    ? `Local + offline · v${APP_VERSION}`
    : `Sin conexión · modo offline · v${APP_VERSION}`;
}

function resetForm() {
  state.editId = null;
  elements.inventoryForm.reset();
  elements.recordId.value = '';
  elements.estado.value = state.scanTargetState;
  elements.cancelEditButton.classList.add('hidden');
  elements.saveButton.textContent = 'Guardar registro';
  toggleDuplicateAlert(elements.duplicateAlert, false);
}

function fillForm(record) {
  state.editId = record.id;
  elements.recordId.value = record.id;
  elements.serial.value = record.serial;
  elements.modelo.value = record.modelo;
  elements.estado.value = record.estado;
  elements.cliente.value = record.cliente;
  elements.ubicacion.value = record.ubicacion;
  elements.tecnico.value = record.tecnico;
  elements.observaciones.value = record.observaciones;
  elements.cancelEditButton.classList.remove('hidden');
  elements.saveButton.textContent = 'Actualizar registro';
}

function selectRecord(id) {
  state.selectedRecordId = id;
  refreshUi();
}

function saveFormRecord(formData, source = 'manual') {
  const currentRecord = state.records.find((record) => record.id === state.editId) ?? null;
  const duplicate = findDuplicate(formData.serial, currentRecord?.id ?? null);
  toggleDuplicateAlert(elements.duplicateAlert, Boolean(duplicate));

  if (duplicate) {
    throw new Error(`El serial ${duplicate.serial} ya existe en inventario.`);
  }

  const record = createRecord({ ...formData, fuenteCaptura: source }, currentRecord);
  if (currentRecord) {
    state.records = state.records.map((item) => (item.id === currentRecord.id ? record : item));
  } else {
    state.records = [record, ...state.records];
  }
  state.selectedRecordId = record.id;
  persistRecords();
  updateLastCapture({
    serialElement: elements.lastSerial,
    metaElement: elements.lastCaptureMeta,
    record,
  });
  refreshUi();
  resetForm();
  setFeedback(elements.feedbackBanner, `Registro ${currentRecord ? 'actualizado' : 'guardado'}: ${record.serial}.`, 'success');
  beep(true);
}

async function handleScan(serialText) {
  const serial = normalizeSerial(serialText);
  const duplicate = findDuplicate(serial);
  toggleDuplicateAlert(elements.duplicateAlert, Boolean(duplicate));

  if (duplicate) {
    state.selectedRecordId = duplicate.id;
    updateLastCapture({
      serialElement: elements.lastSerial,
      metaElement: elements.lastCaptureMeta,
      record: duplicate,
    });
    refreshUi();
    setFeedback(elements.feedbackBanner, `Duplicado detectado: ${serial} ya está registrado.`, 'error');
    beep(false);
    return;
  }

  const record = createRecord({
    serial,
    modelo: '',
    estado: state.scanTargetState,
    cliente: elements.cliente.value,
    ubicacion: elements.ubicacion.value,
    tecnico: elements.tecnico.value,
    observaciones: '',
    fuenteCaptura: 'camara',
  });

  state.records = [record, ...state.records];
  state.selectedRecordId = record.id;
  persistRecords();
  updateLastCapture({ serialElement: elements.lastSerial, metaElement: elements.lastCaptureMeta, record });
  refreshUi();
  setFeedback(elements.feedbackBanner, `Escaneo correcto: ${serial} registrado como ${record.estado}.`, 'success');
  beep(true);
}

async function activateScanner(targetState) {
  state.scanTargetState = targetState;
  elements.estado.value = targetState;
  setFeedback(elements.feedbackBanner, 'Inicializando cámara...', 'info');
  setScannerLabel();

  try {
    await startScanner({
      elementId: 'reader',
      onScan: (decodedText) => handleScan(decodedText),
      onError: () => {},
    });
    setScannerLabel();
    setFeedback(
      elements.feedbackBanner,
      `Cámara lista para registrar equipos en estado ${targetState}.`,
      'info',
    );
  } catch (error) {
    setScannerLabel();
    setFeedback(
      elements.feedbackBanner,
      `No se pudo abrir la cámara. Verifica permisos en Safari/Chrome móvil. ${error.message}`,
      'error',
    );
  }
}

function startEditing(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  state.selectedRecordId = record.id;
  fillForm(record);
  updateLastCapture({
    serialElement: elements.lastSerial,
    metaElement: elements.lastCaptureMeta,
    record,
  });
  refreshUi();
  setFeedback(elements.feedbackBanner, `Editando ${record.serial}.`, 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  state.records = state.records.filter((item) => item.id !== id);
  if (state.selectedRecordId === id) {
    state.selectedRecordId = null;
  }
  persistRecords();
  refreshUi();
  toggleDuplicateAlert(elements.duplicateAlert, false);
  setFeedback(elements.feedbackBanner, `Registro eliminado: ${record.serial}.`, 'info');
}

function exportRecords() {
  if (!state.records.length) {
    setFeedback(elements.feedbackBanner, 'No hay registros para exportar.', 'error');
    return;
  }

  const content = toCsv(getFilteredRecords());
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  downloadCsv(`duartec-inventario-${timestamp}.csv`, content);
  setFeedback(elements.feedbackBanner, 'CSV exportado correctamente.', 'success');
}

function loadDemoData() {
  const settings = loadSettings();
  if (!settings.demoLoaded && !state.records.length) {
    state.records = demoRecords.map(ensureRecordHistory);
    state.selectedRecordId = state.records[0]?.id ?? null;
    persistRecords();
    saveSettings({ ...settings, demoLoaded: true });
    refreshUi();
    setFeedback(elements.feedbackBanner, 'Datos demo cargados.', 'success');
    return;
  }

  state.records = demoRecords.map(ensureRecordHistory);
  state.selectedRecordId = state.records[0]?.id ?? null;
  persistRecords();
  refreshUi();
  setFeedback(elements.feedbackBanner, 'Demo restablecida sobre el almacenamiento local.', 'info');
}

function clearRecords() {
  state.records = [];
  state.selectedRecordId = null;
  persistRecords();
  refreshUi();
  resetForm();
  updateLastCapture({ serialElement: elements.lastSerial, metaElement: elements.lastCaptureMeta, record: null });
  setFeedback(elements.feedbackBanner, 'Inventario local vaciado.', 'info');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setFeedback(elements.feedbackBanner, 'No se pudo registrar el modo offline.', 'error');
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    elements.installButton.classList.remove('hidden');
  });

  elements.installButton.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    elements.installButton.classList.add('hidden');
  });
}

function bindEvents() {
  elements.scanInstalledButton.addEventListener('click', () => activateScanner('INSTALADO'));
  elements.scanReserveButton.addEventListener('click', () => activateScanner('RESERVA'));
  elements.stopScannerButton.addEventListener('click', async () => {
    await stopScanner();
    setScannerLabel();
    setFeedback(elements.feedbackBanner, 'Cámara detenida.', 'info');
  });

  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    refreshUi();
  });

  elements.inventoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(elements.inventoryForm));
    try {
      saveFormRecord(formData, 'manual');
    } catch (error) {
      setFeedback(elements.feedbackBanner, error.message, 'error');
      beep(false);
    }
  });

  elements.serial.addEventListener('input', (event) => {
    const duplicate = findDuplicate(event.target.value, state.editId);
    toggleDuplicateAlert(elements.duplicateAlert, Boolean(duplicate));
  });

  elements.cancelEditButton.addEventListener('click', () => {
    resetForm();
    setFeedback(elements.feedbackBanner, 'Edición cancelada.', 'info');
  });

  elements.exportButton.addEventListener('click', exportRecords);
  elements.clearAllButton.addEventListener('click', clearRecords);
  elements.loadDemoButton.addEventListener('click', loadDemoData);

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

function init() {
  bindEvents();
  registerServiceWorker();
  setupInstallPrompt();

  const [latest] = getFilteredRecords();
  state.selectedRecordId = latest?.id ?? null;

  refreshUi();
  resetForm();
  setScannerLabel();

  updateLastCapture({
    serialElement: elements.lastSerial,
    metaElement: elements.lastCaptureMeta,
    record: latest ?? null,
  });

  if (!state.records.length) {
    setFeedback(
      elements.feedbackBanner,
      'Inventario listo. Puedes empezar a escanear o cargar datos demo para probar el flujo.',
      'info',
    );
  }
}

init();
