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
  registros: loadRecords().map(ensureRecordHistory),
  filtro: 'TODOS',
  busqueda: '',
  idEdicion: null,
  idRegistroSeleccionado: null,
  estadoObjetivoEscaneo: 'INSTALADO',
  promptDiferido: null,
};

const referencias = {
  botonInstalarApp: document.querySelector('#installButton'),
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
  modelo: document.querySelector('#modelo'),
  estado: document.querySelector('#estado'),
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
      return [record.serial, record.modelo, record.cliente, record.tecnico, record.ubicacion]
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
}

function setScannerLabel() {
  referencias.etiquetaModoEscaneo.textContent = isScannerActive()
    ? `Cámara activa · alta ${state.estadoObjetivoEscaneo}`
    : 'Cámara inactiva';
}

function updateNetworkStatus() {
  const online = navigator.onLine;
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

async function handleScan(serialText) {
  const serial = normalizeSerial(serialText);
  const duplicate = findDuplicate(serial);
  toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(duplicate));

  if (duplicate) {
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
    modelo: '',
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
  setFeedback(referencias.bandaFeedback, `Escaneo correcto: ${serial} registrado como ${record.estado}.`, 'success');
  beep(true);
}

async function activateScanner(estadoObjetivo) {
  state.estadoObjetivoEscaneo = estadoObjetivo;
  referencias.estado.value = estadoObjetivo;
  setFeedback(referencias.bandaFeedback, 'Inicializando cámara...', 'info');
  setScannerLabel();

  try {
    await startScanner({
      elementId: 'reader',
      onScan: (decodedText) => handleScan(decodedText),
      onError: () => {},
    });
    setScannerLabel();
    setFeedback(
      referencias.bandaFeedback,
      `Cámara lista para registrar equipos en estado ${estadoObjetivo}.`,
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setFeedback(referencias.bandaFeedback, 'No se pudo registrar el modo offline.', 'error');
    });
  }
}

function setupInstallPrompt() {
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

function bindEvents() {
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

  const [latest] = getFilteredRecords();
  state.idRegistroSeleccionado = latest?.id ?? null;

  refreshUi();
  resetForm();
  setScannerLabel();

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
