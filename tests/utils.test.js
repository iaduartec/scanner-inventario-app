import test from 'node:test';
import assert from 'node:assert/strict';

import { createRecord, normalizeSerial, toCsv } from '../js/utils.js';

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
  assert.ok(record.fechaAlta);
  assert.ok(record.fechaUltimoMovimiento);
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
