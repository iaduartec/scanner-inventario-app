import { ESTADOS_REGISTRO } from './constants.js';

const LEGACY_ESTADO_MAP = {
  RESERVA: 'DESINSTALADO',
};

export function normalizeSerial(value) {
  return String(value ?? '')
    .trim()
    .replace(/^[:\-\.=\s\/\\]+/, '') // Remove leading noise
    .replace(/[!|\\\/]/g, 'I') // Convert common separators to I (conservative for Cisco)
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/^EH5KE/, 'EHSKE')
    .replace(/^ZTE5/, 'ZTES');
}

export function normalizeText(value) {
  let text = String(value ?? '').trim();
  // Clean common OCR prefix leftovers
  text = text.replace(/^(?:OF AN|OF|AN|MANUFACTURE|NAME|MODEL|[:\-\s,=])*[\s,=]*/i, '');
  return text.trim();
}

export function normalizeMac(value) {
  const compact = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL!|]/g, '1')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/[^0-9A-F]/g, '');

  if (compact.length < 12) {
    return '';
  }

  return compact
    .slice(0, 12)
    .match(/.{1,2}/g)
    ?.join('-') ?? compact;
}

export function normalizeEstado(estado) {
  const normalized = normalizeText(estado).toUpperCase();
  return LEGACY_ESTADO_MAP[normalized] ?? normalized;
}

export function isValidEstado(estado) {
  return ESTADOS_REGISTRO.includes(normalizeEstado(estado));
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function createId() {
  return `reg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildHistoryEntry(record, tipo) {
  return {
    id: createId(),
    tipo,
    estado: normalizeEstado(record.estado),
    marca: record.marca,
    modelo: record.modelo,
    mac: record.mac,
    cliente: record.cliente,
    actuacion: record.actuacion,
    ubicacion: record.ubicacion,
    tecnico: record.tecnico,
    observaciones: record.observaciones,
    fuenteCaptura: record.fuenteCaptura,
    fecha: record.fechaUltimoMovimiento,
  };
}

export function ensureRecordHistory(record) {
  if (!record) return record;

  const baseRecord = {
    ...record,
    estado: normalizeEstado(record.estado),
    marca: normalizeText(record.marca),
    modelo: normalizeText(record.modelo),
    mac: normalizeMac(record.mac),
    cliente: normalizeText(record.cliente),
    actuacion: normalizeText(record.actuacion),
    ubicacion: normalizeText(record.ubicacion),
    tecnico: normalizeText(record.tecnico),
    observaciones: normalizeText(record.observaciones),
    fuenteCaptura: record.fuenteCaptura ?? 'manual',
    fechaUltimoMovimiento: record.fechaUltimoMovimiento ?? record.fechaAlta ?? nowIso(),
  };

  const history = Array.isArray(record.historial) ? record.historial : [];

  return {
    ...baseRecord,
    historial:
      history.length > 0
        ? history.map((entry) => ({
            ...entry,
            estado: normalizeEstado(entry.estado),
            mac: normalizeMac(entry.mac),
          }))
        : [
            buildHistoryEntry(
              {
                ...baseRecord,
                fechaUltimoMovimiento: baseRecord.fechaAlta ?? baseRecord.fechaUltimoMovimiento,
              },
              'alta',
            ),
          ],
  };
}

export function toCsv(records) {
  const header = [
    'FECHA',
    'SERIAL',
    'MAC',
    'MARCA',
    'MODELO',
    'ESTADO',
    'OBSERVACIONES',
  ];

  const rows = records.map((record) =>
    [
      formatDateTime(record.fechaUltimoMovimiento),
      record.serial,
      record.mac || '—',
      record.marca || '—',
      record.modelo || '—',
      normalizeEstado(record.estado),
      record.observaciones || '',
    ]
      .map(escapeCsv)
      .join(';'),
  );

  return `\uFEFF${header.join(';')}\n${rows.join('\n')}`;
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createRecord(input, currentRecord) {
  const timestamp = nowIso();
  const serial = normalizeSerial(input.serial);
  const estado = normalizeEstado(input.estado);

  if (!serial) {
    throw new Error('El serial es obligatorio.');
  }

  if (!isValidEstado(estado)) {
    throw new Error('El estado seleccionado no es válido.');
  }

  const nextRecord = {
    id: currentRecord?.id ?? createId(),
    serial,
    mac: normalizeMac(input.mac),
    marca: normalizeText(input.marca),
    modelo: normalizeText(input.modelo),
    estado,
    cliente: normalizeText(input.cliente),
    actuacion: normalizeText(input.actuacion),
    ubicacion: normalizeText(input.ubicacion),
    tecnico: normalizeText(input.tecnico),
    fechaAlta: currentRecord?.fechaAlta ?? timestamp,
    fechaUltimoMovimiento: timestamp,
    observaciones: normalizeText(input.observaciones),
    fuenteCaptura: input.fuenteCaptura ?? currentRecord?.fuenteCaptura ?? 'manual',
  };

  const previousRecord = ensureRecordHistory(currentRecord);
  const historyType = previousRecord ? 'actualizacion' : 'alta';
  const history = previousRecord?.historial ?? [];

  return {
    ...nextRecord,
    historial: [...history, buildHistoryEntry(nextRecord, historyType)],
  };
}
