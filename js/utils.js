import { ESTADOS_REGISTRO } from './constants.js';

export function normalizeSerial(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function isValidEstado(estado) {
  return ESTADOS_REGISTRO.includes(estado);
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
    estado: record.estado,
    modelo: record.modelo,
    cliente: record.cliente,
    ubicacion: record.ubicacion,
    tecnico: record.tecnico,
    observaciones: record.observaciones,
    fuenteCaptura: record.fuenteCaptura,
    fecha: record.fechaUltimoMovimiento,
  };
}

export function ensureRecordHistory(record) {
  if (!record) return record;
  if (Array.isArray(record.historial) && record.historial.length > 0) {
    return record;
  }

  const baseRecord = {
    ...record,
    modelo: normalizeText(record.modelo),
    cliente: normalizeText(record.cliente),
    ubicacion: normalizeText(record.ubicacion),
    tecnico: normalizeText(record.tecnico),
    observaciones: normalizeText(record.observaciones),
    fuenteCaptura: record.fuenteCaptura ?? 'manual',
    fechaUltimoMovimiento: record.fechaUltimoMovimiento ?? record.fechaAlta ?? nowIso(),
  };

  return {
    ...baseRecord,
    historial: [
      buildHistoryEntry({
        ...baseRecord,
        fechaUltimoMovimiento: baseRecord.fechaAlta ?? baseRecord.fechaUltimoMovimiento,
      }, 'alta'),
    ],
  };
}

export function toCsv(records) {
  const header = [
    'id',
    'serial',
    'modelo',
    'estado',
    'cliente',
    'ubicacion',
    'tecnico',
    'fechaAlta',
    'fechaUltimoMovimiento',
    'observaciones',
    'fuenteCaptura',
  ];

  const rows = records.map((record) =>
    [
      record.id,
      record.serial,
      record.modelo,
      record.estado,
      record.cliente,
      record.ubicacion,
      record.tecnico,
      record.fechaAlta,
      record.fechaUltimoMovimiento,
      record.observaciones,
      record.fuenteCaptura,
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

  if (!serial) {
    throw new Error('El serial es obligatorio.');
  }

  if (!isValidEstado(input.estado)) {
    throw new Error('El estado seleccionado no es válido.');
  }

  const nextRecord = {
    id: currentRecord?.id ?? createId(),
    serial,
    modelo: normalizeText(input.modelo),
    estado: input.estado,
    cliente: normalizeText(input.cliente),
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
