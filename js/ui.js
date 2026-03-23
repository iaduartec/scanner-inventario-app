import { ESTADOS } from './constants.js';
import { formatDateTime } from './utils.js';

export function renderFilterChips(container, activeFilter, onChange) {
  container.innerHTML = ESTADOS.map(
    (estado) => `
      <button
        type="button"
        class="filter-chip ${activeFilter === estado ? 'active' : ''}"
        data-filter="${estado}"
        role="tab"
        aria-selected="${activeFilter === estado}"
      >
        ${estado}
      </button>
    `,
  ).join('');

  container.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => onChange(button.dataset.filter));
  });
}

export function renderRecords({ records, tableBody, onEdit, onDelete }) {
  if (!records.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No hay registros para este filtro. Escanea un equipo o crea uno manualmente.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = records
    .map(
      (record) => `
        <tr>
          <td class="serial-cell">
            <strong>${record.serial}</strong>
            <span class="serial-meta">${record.fuenteCaptura} · ${record.observaciones || 'Sin observaciones'}</span>
          </td>
          <td><span class="status-pill status-${record.estado}">${record.estado}</span></td>
          <td>${record.modelo || '—'}</td>
          <td>${record.cliente || '—'}</td>
          <td>${record.ubicacion || '—'}</td>
          <td>${record.tecnico || '—'}</td>
          <td>
            <strong>${formatDateTime(record.fechaUltimoMovimiento)}</strong>
            <span class="serial-meta">Alta: ${formatDateTime(record.fechaAlta)}</span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="ghost-button" data-edit="${record.id}">Editar</button>
              <button type="button" class="ghost-button danger-text" data-delete="${record.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  tableBody.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(button.dataset.edit));
  });

  tableBody.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => onDelete(button.dataset.delete));
  });
}

export function setFeedback(element, message, variant = 'info') {
  if (!message) {
    element.textContent = '';
    element.className = 'feedback-banner hidden';
    return;
  }

  element.textContent = message;
  element.className = `feedback-banner ${variant}`;
}

export function toggleDuplicateAlert(element, visible) {
  element.classList.toggle('hidden', !visible);
}

export function updateLastCapture({ serialElement, metaElement, record }) {
  serialElement.textContent = record?.serial ?? 'Sin lecturas todavía';
  metaElement.textContent = record
    ? `${record.estado} · ${record.modelo || 'Sin modelo'} · ${formatDateTime(record.fechaUltimoMovimiento)}`
    : 'Esperando el primer escaneo o alta manual.';
}

export function updateCounters({ records, recordCount, installedCount, reserveCount }) {
  recordCount.textContent = `${records.length} registros`;
  installedCount.textContent = `${records.filter((item) => item.estado === 'INSTALADO').length} instalados`;
  reserveCount.textContent = `${records.filter((item) => item.estado === 'RESERVA').length} reserva`;
}
