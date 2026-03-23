import test from 'node:test';
import assert from 'node:assert/strict';

import { createRecord, ensureRecordHistory, normalizeSerial, toCsv } from '../js/utils.js';

test('normalizeSerial limpia espacios y pasa a mayúsculas', () => {
  assert.equal(normalizeSerial(' 001ae8f7918f  '), '001AE8F7918F');
});

test('createRecord genera estructura completa válida', () => {
  const record = createRecord({
    serial: '001AE8F79C13',
    modelo: 'iPhone',
    estado: 'INSTALADO',
    cliente: 'Cliente Demo',
    ubicacion: 'Rack A',
    tecnico: 'Técnico',
    observaciones: 'Ok',
    fuenteCaptura: 'manual',
  });

  assert.equal(record.serial, '001AE8F79C13');
  assert.equal(record.estado, 'INSTALADO');
  assert.equal(record.fuenteCaptura, 'manual');
  assert.equal(record.historial.length, 1);
  assert.equal(record.historial[0].tipo, 'alta');
  assert.ok(record.fechaAlta);
  assert.ok(record.fechaUltimoMovimiento);
});

test('createRecord añade movimiento al editar un registro existente', () => {
  const original = createRecord({
    serial: '001AE8FBDDED',
    modelo: 'Motorola',
    estado: 'RESERVA',
    cliente: 'Cliente',
    ubicacion: 'Ubicacion',
    tecnico: 'Tecnico',
    observaciones: 'Obs',
    fuenteCaptura: 'camara',
  });

  const updated = createRecord(
    {
      ...original,
      estado: 'INSTALADO',
      observaciones: 'Instalado correctamente',
      fuenteCaptura: 'manual',
    },
    original,
  );

  assert.equal(updated.historial.length, 2);
  assert.equal(updated.historial.at(-1)?.tipo, 'actualizacion');
  assert.equal(updated.historial.at(-1)?.estado, 'INSTALADO');
});

test('ensureRecordHistory migra registros antiguos sin historial', () => {
  const migrated = ensureRecordHistory({
    id: 'legacy-1',
    serial: 'ABC123',
    modelo: 'Legacy',
    estado: 'AVERIADO',
    cliente: 'Cliente legado',
    ubicacion: 'Taller',
    tecnico: 'Ana',
    fechaAlta: '2026-03-20T10:00:00.000Z',
    fechaUltimoMovimiento: '2026-03-21T11:00:00.000Z',
    observaciones: 'Pendiente revisión',
    fuenteCaptura: 'manual',
  });

  assert.equal(migrated.historial.length, 1);
  assert.equal(migrated.historial[0].tipo, 'alta');
  assert.equal(migrated.historial[0].fecha, '2026-03-20T10:00:00.000Z');
});

test('toCsv incluye cabecera y BOM UTF-8', () => {
  const csv = toCsv([
    {
      id: '1',
      serial: '001AE8FBDDED',
      modelo: 'Motorola',
      estado: 'RESERVA',
      cliente: 'Cliente',
      ubicacion: 'Ubicacion',
      tecnico: 'Tecnico',
      fechaAlta: '2026-03-23T10:00:00.000Z',
      fechaUltimoMovimiento: '2026-03-23T10:00:00.000Z',
      observaciones: 'Obs',
      fuenteCaptura: 'camara',
    },
  ]);

  assert.ok(csv.startsWith('\uFEFFid;serial;modelo;estado'));
  assert.match(csv, /001AE8FBDDED/);
});
