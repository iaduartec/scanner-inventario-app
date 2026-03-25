import { demoRecords } from './demo-data.js';
import { APP_VERSION } from './constants.js';
import { startScanner, startSequentialOcrScanner, stopScanner, isScannerActive, processFileScan } from './scanner.js';
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
  scanModes: initialSettings.scanModes ?? { qr: false, barcode: false, text: true },
  ocrFields: initialSettings.ocrFields ?? ['marca', 'modelo', 'sn', 'mac'],
  promptDiferido: null,
  sessionLog: [],
};

const referencias = {
  botonInstalarApp: document.querySelector('#installButton'),
  checkQr: document.querySelector('#scanModeQr'),
  checkBarcode: document.querySelector('#scanModeBarcode'),
  checkText: document.querySelector('#scanModeText'),
  ocrFieldSelector: document.querySelector('#ocrFieldSelector'),
  ocrFieldMarca: document.querySelector('#ocrFieldMarca'),
  ocrFieldModelo: document.querySelector('#ocrFieldModelo'),
  ocrFieldSn: document.querySelector('#ocrFieldSn'),
  ocrFieldMac: document.querySelector('#ocrFieldMac'),
  botonEscaneoUnificado: document.querySelector('#startUnifiedScanButton'),
  selectEstadoRapido: document.querySelector('#quickStatusSelect'),
  inputEstadoRapidoCustom: document.querySelector('#quickStatusCustom'),
  entradaImagenPrueba: document.querySelector('#uploadImageInput'),
  alertaDuplicado: document.querySelector('#duplicateAlert'),
  bandaFeedback: document.querySelector('#feedbackBanner'),
  insigniaConexion: document.querySelector('#connectionBadge'),
  contadorRegistros: document.querySelector('#recordCount'),
  contadorEquiposInstalados: document.querySelector('#equipoInstaladoCount'),
  contadorEquiposDesinstalados: document.querySelector('#equipoDesinstaladoCount'),
  cuerpoTablaInventario: document.querySelector('#inventoryTableBody'),
  chipsFiltro: document.querySelector('#filterChips'),
  entradaBusqueda: document.querySelector('#searchInput'),
  seccionFormulario: document.querySelector('#formSection'),
  formularioInventario: document.querySelector('#inventoryForm'),
  idRegistro: document.querySelector('#recordId'),
  serial: document.querySelector('#serial'),
  marca: document.querySelector('#marca'),
  modelo: document.querySelector('#modelo'),
  estado: document.querySelector('#estado'),
  inputEstadoCustom: document.querySelector('#estadoCustom'),
  mac: document.querySelector('#mac'),
  actuacion: document.querySelector('#actuacion'),
  cliente: document.querySelector('#cliente'),
  ubicacion: document.querySelector('#ubicacion'),
  tecnico: document.querySelector('#tecnico'),
  observaciones: document.querySelector('#observaciones'),
  botonGuardar: document.querySelector('#saveButton'),
  botonCancelarEdicion: document.querySelector('#cancelEditButton'),
  botonExportar: document.querySelector('#exportButton'),
  botonVaciarTodo: document.querySelector('#clearAllButton'),
  btnDescargarLog: document.querySelector('#downloadLogButton'),
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
  } catch { }
}

function findDuplicate(serial, excludedId = null) {
  const normalized = normalizeSerial(serial);
  return state.registros.find((record) => record.serial === normalized && record.id !== excludedId) ?? null;
}

function getFilteredRecords() {
  const search = state.busqueda.trim().toLowerCase();
  const standardStatuses = ['INSTALADO', 'DESINSTALADO', 'RETIRADO', 'AVERIADO'];
  
  return [...state.registros]
    .filter((record) => {
      if (state.filtro === 'TODOS') return true;
      if (state.filtro === 'OTRO') return !standardStatuses.includes(record.estado);
      return record.estado === state.filtro;
    })
    .filter((record) => {
      if (!search) return true;
      return [record.serial, record.mac, record.modelo, record.marca, record.actuacion, record.cliente, record.tecnico, record.ubicacion]
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
  referencias.botonCancelarEdicion.classList.add('hidden');
  referencias.botonGuardar.textContent = 'Guardar registro';
  referencias.seccionFormulario.classList.add('hidden');
  referencias.inputEstadoCustom.classList.add('hidden');
  referencias.inputEstadoCustom.value = '';
  toggleDuplicateAlert(referencias.alertaDuplicado, false);
}

function fillForm(record) {
  state.idEdicion = record.id;
  referencias.idRegistro.value = record.id;
  referencias.serial.value = record.serial;
  referencias.mac.value = record.mac ?? '';
  referencias.marca.value = record.marca ?? '';
  referencias.modelo.value = record.modelo;
  
  const isCustomStatus = !['INSTALADO', 'DESINSTALADO', 'RETIRADO', 'AVERIADO'].includes(record.estado);
  if (isCustomStatus) {
    referencias.estado.value = 'OTRO';
    referencias.inputEstadoCustom.value = record.estado;
    referencias.inputEstadoCustom.classList.remove('hidden');
  } else {
    referencias.estado.value = record.estado;
    referencias.inputEstadoCustom.classList.add('hidden');
    referencias.inputEstadoCustom.value = '';
  }

  referencias.actuacion.value = record.actuacion ?? '';
  referencias.cliente.value = record.cliente;
  referencias.ubicacion.value = record.ubicacion;
  referencias.tecnico.value = record.tecnico;
  referencias.observaciones.value = record.observaciones;
  referencias.botonCancelarEdicion.classList.remove('hidden');
  referencias.botonGuardar.textContent = 'Actualizar registro';
  referencias.seccionFormulario.classList.remove('hidden');
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

  const finalEstado = formData.estado === 'OTRO' ? (formData.estadoCustom || 'OTRO') : formData.estado;
  const record = createRecord({ ...formData, estado: finalEstado, fuenteCaptura: source }, currentRecord);
  if (currentRecord) {
    state.registros = state.registros.map((item) => (item.id === currentRecord.id ? record : item));
  } else {
    state.registros = [record, ...state.registros];
  }
  state.idRegistroSeleccionado = record.id;
  persistRecords();
  refreshUi();
  resetForm();
  setFeedback(referencias.bandaFeedback, `Registro ${currentRecord ? 'actualizado' : 'guardado'}: ${record.serial}.`, 'success');
  beep(true);
}

function getScanPayload(scanResult) {
  if (typeof scanResult === 'string') {
    return { serial: scanResult, mac: '', marca: '', modelo: '' };
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
  
  let estadoObjetivo = referencias.selectEstadoRapido.value;
  if (estadoObjetivo === 'OTRO') {
    estadoObjetivo = referencias.inputEstadoRapidoCustom.value.trim() || 'OTRO';
  }

  const duplicate = findDuplicate(serial);
  toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(duplicate));

  if (duplicate) {
    const cambios = [];
    if (mac && !duplicate.mac) cambios.push(`MAC ${mac}`);
    if (marca && !duplicate.marca) cambios.push(`marca ${marca}`);
    if (modelo && !duplicate.modelo) cambios.push(`modelo ${modelo}`);

    if (cambios.length) {
      const updatedRecord = createRecord(
        {
          ...duplicate,
          mac: mac || duplicate.mac,
          marca: marca || duplicate.marca,
          modelo: modelo || duplicate.modelo,
        },
        duplicate,
      );
      state.registros = state.registros.map((item) => (item.id === duplicate.id ? updatedRecord : item));
      state.idRegistroSeleccionado = updatedRecord.id;
      persistRecords();
      refreshUi();
      setFeedback(referencias.bandaFeedback, `${cambios.join(' y ')} añadido al registro ${serial}.`, 'success');
      beep(true);
      return;
    }

    state.idRegistroSeleccionado = duplicate.id;
    refreshUi();
    setFeedback(referencias.bandaFeedback, `Duplicado: ${serial} ya registrado.`, 'error');
    beep(false);
    return;
  }

  const record = createRecord({
    serial, mac, marca, modelo,
    estado: estadoObjetivo,
    actuacion: referencias.actuacion.value,
    cliente: referencias.cliente.value,
    ubicacion: referencias.ubicacion.value,
    tecnico: referencias.tecnico.value,
    fuenteCaptura: 'camara',
  });

  state.registros = [record, ...state.registros];
  state.idRegistroSeleccionado = record.id;
  persistRecords();
  refreshUi();
  setFeedback(referencias.bandaFeedback, `Escaneo OK: ${serial} -> ${record.estado}.`, 'success');
  beep(true);
}

async function activateScanner() {
  syncCheckboxesToState();
  const estadoObjetivo = referencias.selectEstadoRapido.value;
  setFeedback(referencias.bandaFeedback, 'Inicializando cámara...', 'info');

  const modes = state.scanModes;
  const hasAnyMode = modes.qr || modes.barcode || modes.text;

  if (!hasAnyMode) {
    setFeedback(referencias.bandaFeedback, 'Selecciona al menos un modo de escaneo.', 'error');
    return;
  }

  try {
    if (modes.text) {
      const fields = getSelectedOcrFields();
      if (!fields.length) {
        setFeedback(referencias.bandaFeedback, 'Selecciona al menos un campo OCR.', 'error');
        return;
      }

      await startSequentialOcrScanner({
        elementId: 'reader',
        fields,
        onFieldScan: (field, value, skipped) => {
          if (!skipped) beep(true);
        },
        onComplete: async (collectedData) => {
          const serial = collectedData.sn ?? '';
          const mac = collectedData.mac ?? '';
          const marca = collectedData.marca ?? '';
          const modelo = collectedData.modelo ?? '';

          if (!serial) {
            setFeedback(referencias.bandaFeedback, 'N/S no detectado. Reintenta o edita manualmente.', 'info');
            return;
          }

          if (collectedData.rawText) {
            state.sessionLog.push({
              fecha: new Date().toISOString(),
              tipo: 'ESCANEO_CAMARA_VIVO',
              datos: { serial, mac, marca, modelo },
              raw: collectedData.rawText
            });
          }
          await handleScan({ serial, mac, marca, modelo });
        },
        onError: () => { },
      });
    } else {
      await startScanner({
        elementId: 'reader',
        modes,
        onScan: (decodedText) => handleScan(decodedText),
        onError: () => { },
      });
    }

    setFeedback(referencias.bandaFeedback, `Escaneando en estado ${estadoObjetivo}.`, 'info');
  } catch (error) {
    setFeedback(referencias.bandaFeedback, `Error cámara: ${error.message}`, 'error');
  }
}

function startEditing(id) {
  const record = state.registros.find((item) => item.id === id);
  if (!record) return;
  state.idRegistroSeleccionado = record.id;
  fillForm(record);
  refreshUi();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeRecord(id) {
  const record = state.registros.find((item) => item.id === id);
  if (!record) return;
  state.registros = state.registros.filter((item) => item.id !== id);
  if (state.idRegistroSeleccionado === id) state.idRegistroSeleccionado = null;
  persistRecords();
  refreshUi();
  setFeedback(referencias.bandaFeedback, `Eliminado: ${record.serial}.`, 'info');
}

function exportRecords() {
  if (!state.registros.length) return;
  const content = toCsv(getFilteredRecords());
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  downloadCsv(`duartec-inv-${timestamp}.csv`, content);
  setFeedback(referencias.bandaFeedback, 'CSV exportado.', 'success');
}

function clearRecords() {
  if (!confirm('¿Vaciar todo el inventario local?')) return;
  state.registros = [];
  state.idRegistroSeleccionado = null;
  persistRecords();
  refreshUi();
  resetForm();
  setFeedback(referencias.bandaFeedback, 'Inventario vaciado.', 'info');
}

function registerServiceWorker() {
  if (!isNativePlatform && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
}

function setupInstallPrompt() {
  if (isNativePlatform) return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.promptDiferido = event;
    referencias.botonInstalarApp.classList.remove('hidden');
  });
  referencias.botonInstalarApp.addEventListener('click', async () => {
    if (!state.promptDiferido) return;
    state.promptDiferido.prompt();
    state.promptDiferido = null;
    referencias.botonInstalarApp.classList.add('hidden');
  });
}

function handleScanModeChange() {
  syncCheckboxesToState();
  updateOcrFieldSelectorVisibility();
  setFeedback(referencias.bandaFeedback, `Modo: ${getScanModeLabel()}.`, 'info');
}

function bindEvents() {
  referencias.checkQr?.addEventListener('change', handleScanModeChange);
  referencias.checkBarcode?.addEventListener('change', handleScanModeChange);
  referencias.checkText?.addEventListener('change', handleScanModeChange);

  referencias.ocrFieldMarca?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldModelo?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldSn?.addEventListener('change', () => syncCheckboxesToState());
  referencias.ocrFieldMac?.addEventListener('change', () => syncCheckboxesToState());

  referencias.botonEscaneoUnificado.addEventListener('click', activateScanner);

  referencias.selectEstadoRapido.addEventListener('change', (e) => {
    referencias.inputEstadoRapidoCustom.classList.toggle('hidden', e.target.value !== 'OTRO');
    if (e.target.value === 'OTRO') referencias.inputEstadoRapidoCustom.focus();
  });

  referencias.estado.addEventListener('change', (e) => {
    referencias.inputEstadoCustom.classList.toggle('hidden', e.target.value !== 'OTRO');
    if (e.target.value === 'OTRO') referencias.inputEstadoCustom.focus();
  });

  referencias.entradaImagenPrueba?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    syncCheckboxesToState();
    setFeedback(referencias.bandaFeedback, 'Procesando archivo...', 'info');
    try {
      await processFileScan({
        file, modes: state.scanModes, fields: state.scanModes.text ? getSelectedOcrFields() : [],
        onScan: async (data) => {
          if (state.scanModes.text) {
            if (data.rawText) {
              state.sessionLog.push({ fecha: new Date().toISOString(), tipo: 'ESCANEO_ARCHIVO', datos: data, raw: data.rawText });
            }
            await handleScan(data);
          } else {
            await handleScan(data);
          }
        },
        onError: (err) => setFeedback(referencias.bandaFeedback, `Error: ${err.message}`, 'error')
      });
    } catch (err) { } finally { event.target.value = ''; }
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
    }
  });

  referencias.serial.addEventListener('input', (event) => {
    toggleDuplicateAlert(referencias.alertaDuplicado, Boolean(findDuplicate(event.target.value, state.idEdicion)));
  });

  referencias.botonCancelarEdicion.addEventListener('click', resetForm);
  referencias.botonExportar.addEventListener('click', exportRecords);
  referencias.botonVaciarTodo.addEventListener('click', clearRecords);

  referencias.btnDescargarLog?.addEventListener('click', () => {
    if (!state.sessionLog.length) return;
    const content = state.sessionLog
      .map(entry => `[${entry.fecha}] - ${entry.tipo}\nDATOS: ${JSON.stringify(entry.datos)}\nRAW:\n${entry.raw}\n---`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diag-${Date.now()}.txt`;
    a.click();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isScannerActive()) {
      stopScanner();
      setFeedback(referencias.bandaFeedback, 'Cámara auto-apagada por inactividad.', 'info');
    }
  });

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

function init() {
  bindEvents();
  registerServiceWorker();
  setupInstallPrompt();
  syncStateToCheckboxes();
  updateOcrFieldSelectorVisibility();
  const [latest] = getFilteredRecords();
  state.idRegistroSeleccionado = latest?.id ?? null;
  refreshUi();
  resetForm();
}

init();
